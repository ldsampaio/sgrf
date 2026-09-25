// Prova SAFE-04: apply só avança com as três fechaduras, verify/plan não
// mutam nada, e a saída jamais carrega material de credencial.
//
// Roda com: node --test tools/release-close/ (zero dependências, sem rede, sem
// banco, sem relógio). Nomes em PT-BR, como em backend/tests/.
//
// Este arquivo é o ÚNICO lugar do tool island onde as formas de credencial são
// escritas por extenso (Pitfall 7 da pesquisa): as fontes de implementação
// nunca as nomeiam, e a varredura abaixo é o que mantém essa separação honesta.

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { execFileSync, spawnSync } from 'node:child_process';
import { PassThrough } from 'node:stream';
import { checkTagEligibility } from './eligibility.js';
import { classifySnapshot } from './classify.js';
import { makeFakeClient } from './fake-client.js';
import {
  confirmApply,
  CONFIRMATION_WORD,
  APPLY_LOCKS,
} from './apply-gate.js';

const TOOL_DIR = new URL('./', import.meta.url);
const CLI_PATH = new URL('./release-close.js', import.meta.url).pathname;

// Tabela de expectativa EXATA de cada cenário congelado. Um valor esperado lido
// da saída observada seria uma tautologia, e uma tautologia não pega regressão:
// os valores abaixo vêm da PRECEDÊNCIA documentada do classificador — FAILED →
// CONCURRENT → CONFLICTING → DUPLICATE → no-op → PARTIAL → MISSING — e do
// critério do no-op (release não-rascunho com alvo validado, exatamente uma
// milestone da versão pedida fechada sem issue aberta).
//
// `forma` diz de onde vem o snapshot: 'plana' são fixtures de estado, que
// descrevem releases e milestones como listas e precisam do adaptador de
// cliente; 'cliente' são snapshots JÁ no formato que o cliente serve, usados
// como estão. Nenhuma prova sniffa a forma de um fixture — a forma é declarada
// aqui, uma vez, e é a forma que o arquivo tem.
const CENARIOS_EXATOS = [
  {
    nome: 'duplicate',
    forma: 'plana',
    elegibilidade: 'ELIGIBLE',
    classificacao: 'DUPLICATE',
    retidos: [9001, 9002],
    outcome: undefined,
    revisado: false,
  },
  {
    nome: 'conflicting',
    forma: 'plana',
    elegibilidade: 'ELIGIBLE',
    classificacao: 'CONFLICTING',
    retidos: [9001, 9003],
    outcome: undefined,
    revisado: false,
  },
  {
    nome: 'partial',
    forma: 'plana',
    elegibilidade: 'ELIGIBLE',
    classificacao: 'PARTIAL',
    retidos: [9000],
    outcome: undefined,
    revisado: false,
  },
  {
    nome: 'missing',
    forma: 'plana',
    elegibilidade: 'ELIGIBLE',
    classificacao: 'MISSING',
    retidos: [],
    outcome: undefined,
    revisado: false,
  },
  {
    nome: 'unrelated',
    forma: 'plana',
    elegibilidade: 'ELIGIBLE',
    classificacao: 'MISSING',
    retidos: [],
    outcome: undefined,
    revisado: false,
  },
  {
    nome: 'concurrent',
    forma: 'plana',
    elegibilidade: 'ELIGIBLE',
    classificacao: 'MISSING',
    retidos: [],
    outcome: undefined,
    revisado: false,
  },
  {
    nome: 'failed',
    forma: 'plana',
    elegibilidade: 'ELIGIBLE',
    classificacao: 'FAILED',
    retidos: [],
    outcome: undefined,
    revisado: false,
  },
  {
    // O no-op concluído: par exato MISSING + COMPLETE_NOOP, o mesmo literal que
    // o plano 09-05 fixou e que o plano 09-07 provou alcançável pela costura de
    // produção. Nenhum sétimo estado de taxonomia existe.
    nome: 'complete',
    forma: 'plana',
    elegibilidade: 'ELIGIBLE',
    classificacao: 'MISSING',
    retidos: [9010],
    outcome: 'COMPLETE_NOOP',
    revisado: false,
  },
  {
    // O baseline de referência é um snapshot de CLIENTE: 404 na release, lista
    // de milestones vazia, e nenhum campo revisado. É o único que a CLI serve.
    nome: 'reference',
    forma: 'cliente',
    elegibilidade: 'ELIGIBLE',
    classificacao: 'MISSING',
    retidos: [],
    outcome: undefined,
    revisado: false,
  },
  {
    // O cenário revisado é também um snapshot de cliente, com a Release
    // publicada e anotada e a Milestone fechada com o registro de conclusão. É
    // o no-op concluído COM conteúdo revisado.
    nome: 'reviewed',
    forma: 'cliente',
    elegibilidade: 'ELIGIBLE',
    classificacao: 'MISSING',
    retidos: [9010],
    outcome: 'COMPLETE_NOOP',
    revisado: true,
  },
];

// A lista de milestones que o cenário declara, seja ele plano ou de cliente.
function fixtureMilestones(nome) {
  const carregado = fixture(nome);
  if (Array.isArray(carregado.milestones)) return carregado.milestones;
  if (carregado.milestones && Array.isArray(carregado.milestones.data)) return carregado.milestones.data;
  return [];
}

function snapshotDoCenario(cenario) {
  const carregado = fixture(cenario.nome);
  return cenario.forma === 'cliente' ? carregado : clientSnapshotFor(carregado);
}

// Ordem fixa da recuperação (D-15): rascunho, releitura, publicação,
// releitura, abertura da milestone, releitura, fechamento, releitura final.
const ORDEM_FIXADA_DOS_PASSOS = [
  'release-rascunho',
  'release-rascunho-readback',
  'release-publicar',
  'release-publicada-readback',
  'milestone-abrir',
  'milestone-readback',
  'milestone-fechar',
  'milestone-readback-final',
];

// Marcadores de destino no baseline ausente: criar nos passos de escrita e ler
// em todas as releituras.
const MARCADORES_NO_BASELINE_AUSENTE = [
  'criar',
  'ler',
  'criar',
  'ler',
  'criar',
  'ler',
  'criar',
  'ler',
];

// Formas de credencial que jamais podem atravessar fonte ou saída (Pitfall 7):
// nome de variável de token, forma do cabeçalho de autorização e a marca de
// traço verboso. Escrevidas apenas neste arquivo de teste.
const FORMAS_DE_CREDENCIAL = [
  'GH_TOKEN',
  'GITHUB_TOKEN',
  'Authorization',
  'Bearer',
  '--verbose',
  'ghp_',
  'gho_',
  '-----BEGIN',
];

const PLANO_DE_EXEMPLO = [
  'Plano de fechamento — versão v0.1.1 (Fase 9: previsão, sem escrita)',
  '  1. [criar] release-rascunho — Criar o rascunho da Release v0.1.1 no commit 10c62ac85fd3ab275b8926c89f5f34ba4116e2cf.',
  '  8. [ler] milestone-readback-final — Reler a Milestone v0.1.1 fechada junto da Release v0.1.1 publicada.',
  'mutations: 0',
].join('\n');

const fixture = (name) =>
  JSON.parse(readFileSync(new URL(`./fixtures/${name}.json`, import.meta.url), 'utf8'));

// O texto revisado do operador tem UMA fonte nomeada no repositório: os campos
// `release.data.notes` e `milestones.data[0].completionRecord` do fixture
// congelado `fixtures/reviewed.json`. Nada aqui é prosa de template — um digest
// sobre texto inventado vincularia a aprovação do operador a nada.
const FIXTURE_REVISADO = fixture('reviewed');

const CONTEUDO_REVISADO = Object.freeze({
  version: FIXTURE_REVISADO.version,
  expectedSha: FIXTURE_REVISADO.expectedSha,
  commitSha: FIXTURE_REVISADO.tagObject.data.object.sha,
  releaseNotes: FIXTURE_REVISADO.release.data.notes,
  milestoneCompletionRecord: FIXTURE_REVISADO.milestones.data[0].completionRecord,
});

// Os símbolos novos do portão entram por `import` DINÂMICO e com guarda de tipo
// por prova. Um `import` estático de um símbolo que ainda não existe derruba o
// carregamento do arquivo inteiro: o runner morre antes de descobrir qualquer
// teste, o que é descoberta zero — RED inválido — e não RED. A guarda também
// separa "o símbolo não é exportado" (falha que descreve o comportamento
// faltante) de "não é uma função" (erro de sonda).
let moduloDoPortao = null;
async function portao() {
  if (moduloDoPortao === null) {
    const mod = await import('./apply-gate.js');
    for (const nome of ['canonicalReviewedDigest', 'renderReviewedText']) {
      assert.equal(typeof mod[nome], 'function', `${nome} não é exportado por apply-gate.js`);
    }
    moduloDoPortao = mod;
  }
  return moduloDoPortao;
}

// O digest NUNCA é escrito à mão: vem da função exportada que o portão recalcula
// no momento da pergunta, de modo que o valor que a suíte compara é o mesmo
// valor que a fechadura de conteúdo compara.
async function revisadoComDigest() {
  const mod = await portao();
  return {
    reviewed: CONTEUDO_REVISADO,
    reviewedDigest: mod.canonicalReviewedDigest(CONTEUDO_REVISADO),
  };
}

// Sink de gravação que RELATA a contagem de caracteres recebidos. Um
// `process.stdout.write` de verdade devolve booleano, e é exatamente por isso
// que a CLI entrega um adaptador: a fechadura de sink precisa saber se o plano
// chegou a algum lugar.
function sinkQueConta(eventos, rotulo) {
  return (texto) => {
    const recebido = typeof texto === 'string' ? texto : '';
    eventos.push(`${rotulo}:${recebido}`);
    return recebido.length;
  };
}

// Snapshot no formato do CLIENTE para um fixture de estado plano: as três
// leituras de tag e de main são o baseline imutável (o mesmo v0.1.1 em todos os
// estados) e só as cargas de release e milestone variam por estado.
//
// A carga de release é retida INTEIRA, nunca o primeiro elemento: escolher o
// primeiro é exatamente o defeito que fazia os fixtures de duplicata e de
// conflito atravessarem a suíte verde enquanto exercitavam um estado parcial
// (WR-03). O envelope `data` aceita um array inteiro, e o construtor de
// evidência de produção o normaliza sem colapsar.
function clientSnapshotFor(estado) {
  const base = fixture('reference');
  const releases = Array.isArray(estado.releases) ? estado.releases : [];
  return {
    version: estado.version,
    expectedSha: estado.expectedSha,
    tagRef: base.tagRef,
    tagObject: base.tagObject,
    branchHead: base.branchHead,
    release:
      releases.length > 0
        ? { ok: true, status: 200, data: releases }
        : { ok: false, status: 404, data: null },
    milestones: {
      ok: true,
      status: 200,
      data: Array.isArray(estado.milestones) ? estado.milestones : [],
    },
    ci: estado.ci ?? base.ci,
    runs: estado.runs ?? base.runs,
  };
}

// A decisão vem SEMPRE da costura de produção exportada pelo plano 09-07: ela
// monta o cliente, percorre as CINCO leituras declaradas na ordem fixa e entrega
// ao classificador a evidência que elas produziram. Não existe mais helper local
// de snapshot nem de evidência neste arquivo — o que existia reimplementava a
// normalização, e por isso a suíte podia passar exercitando um estado diferente
// do que alegava (WR-03).
async function runContractsOver(fake, snapshot) {
  const mod = await cli();
  const decisao = await mod.decide({
    client: fake,
    version: snapshot.version,
    expectedSha: snapshot.expectedSha,
    ci: snapshot.ci,
  });
  return {
    elegibilidade: decisao.eligibility,
    classificacao: decisao.classification,
    // A evidência e a versão resolvida viajam junto porque o construtor de
    // plano as consome: reconstruir a evidência aqui seria exatamente o
    // helper local que esta tarefa apaga.
    evidencia: decisao.evidence,
    versao: decisao.version,
    // O valor emitido é o contador real do fake, não um literal: zero escritas
    // implica zero mutações, executavelmente.
    mutations: decisao.mutations,
  };
}

function runCli(args) {
  return execFileSync(process.execPath, [CLI_PATH, ...args], { encoding: 'utf8' });
}

function runCliPiped(args) {
  const resultado = spawnSync(process.execPath, [CLI_PATH, ...args], {
    encoding: 'utf8',
    input: '',
  });
  return {
    status: resultado.status,
    stdout: resultado.stdout,
    stderr: resultado.stderr,
  };
}

function listAllFiles(dir) {
  const found = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) found.push(...listAllFiles(full));
    else found.push(full);
  }
  return found;
}

describe('zero mutação em verify e plan (D-16)', () => {
  it('nenhum fixture registra escrita: verify e plan emitem mutations 0', async () => {
    for (const cenario of CENARIOS_EXATOS) {
      const snapshot = snapshotDoCenario(cenario);
      const fake = makeFakeClient(snapshot);
      const mod = await cli();
      const saida = await runContractsOver(fake, snapshot);
      const rotulo = `[${cenario.nome}]`;
      assert.equal(fake.writes.length, 0, `${rotulo} deixou escape de escrita`);
      assert.equal(saida.mutations, 0, `${rotulo} emitiu mutações diferentes de zero`);
      assert.equal(saida.mutations, fake.mutations, `${rotulo} relatou uma contagem que não é a medida`);
      assert.equal(saida.elegibilidade.writeAction, null, `${rotulo} carregou writeAction`);
      assert.equal(saida.classificacao.writeAction, null, `${rotulo} carregou writeAction`);

      // Valor EXATO, nunca mera presença. Um código de estado que a suíte
      // affirmed só como "é uma string" não detectaria um classificador que
      // devolvesse o estado errado — que era o defeito WR-03.
      assert.equal(saida.elegibilidade.code, cenario.elegibilidade, `${rotulo} código de elegibilidade`);
      assert.equal(saida.elegibilidade.eligible, true, `${rotulo} elegibilidade`);
      assert.equal(saida.classificacao.code, cenario.classificacao, `${rotulo} código de classificação`);
      assert.ok(saida.classificacao.reason.length > 0, `${rotulo} sem motivo PT-BR`);

      // `outcome` é um campo a parte: só o no-op concluído o carrega, e nenhum
      // outro estado pode carregá-lo. A ausência é afirmada, não implícita.
      assert.equal(saida.classificacao.outcome, cenario.outcome, `${rotulo} outcome`);
      if (cenario.outcome === undefined) {
        assert.ok(
          !Object.prototype.hasOwnProperty.call(saida.classificacao, 'outcome'),
          `${rotulo} carrega um campo outcome que não deveria existir`,
        );
      }

      // A decisão carrega a lista INTEIRA de identificadores retidos, não um
      // registro colapsado, e a lista dos alheios ao alvo também.
      assert.deepEqual(
        saida.classificacao.releases.map((registro) => registro.id),
        cenario.retidos,
        `${rotulo} identificadores de release retidos`,
      );
      const milestonesEsperadas = (cenario.milestonesAlvo ?? fixtureMilestones(cenario.nome))
        .filter((registro) => registro.title === snapshot.version)
        .map((registro) => registro.number);
      assert.deepEqual(
        saida.classificacao.milestones.map((registro) => registro.number),
        milestonesEsperadas,
        `${rotulo} números de milestone retidos`,
      );
      assert.ok(Array.isArray(saida.classificacao.unrelatedReleases), `${rotulo} sem lista de releases alheias`);
      assert.ok(Array.isArray(saida.classificacao.unrelatedMilestones), `${rotulo} sem lista de milestones alheias`);

      // A presença de conteúdo revisado é exata: o cenário revisado carrega as
      // DUAS frases do próprio fixture, byte a byte, e o baseline de referência
      // não carrega objeto revisado nenhum — não um objeto vazio.
      const plano = mod.buildClosePlan({
        version: saida.versao,
        expectedSha: snapshot.expectedSha,
        snapshot,
        eligibility: saida.elegibilidade,
        classificacao: saida.classificacao,
        evidence: saida.evidencia,
        mutations: saida.mutations,
      });
      if (cenario.revisado === true) {
        assert.notEqual(plano.reviewed, null, `${rotulo} sem objeto revisado`);
        assert.equal(plano.reviewed.releaseNotes, FIXTURE_REVISADO.release.data.notes);
        assert.equal(
          plano.reviewed.milestoneCompletionRecord,
          FIXTURE_REVISADO.milestones.data[0].completionRecord,
        );
        assert.equal(plano.reviewedDigest, mod.canonicalReviewedDigest(plano.reviewed));
      } else {
        assert.equal(plano.reviewed, null, `${rotulo} carregou objeto revisado`);
        assert.equal(plano.reviewedDigest, null, `${rotulo} carregou digest sem objeto revisado`);
      }
    }
  });

  it('a verificação em texto e em json carrega o contador mutations 0', () => {
    const args = ['verify', '--version', 'v0.1.1', '--sha', '10c62ac85fd3ab275b8926c89f5f34ba4116e2cf'];
    const texto = runCli(args);
    assert.match(texto, /^mutations: 0$/m);
    const json = JSON.parse(runCli([...args, '--json']));
    assert.equal(json.mutations, 0);
  });

  it('o plano em texto e em json carrega o contador mutations 0', () => {
    const texto = runCli(['plan']);
    assert.match(texto, /^mutations: 0$/m);
    const json = JSON.parse(runCli(['plan', '--json']));
    assert.equal(json.mutations, 0);
  });

  it('a saída json de verify e de plan é parseável e traz o campo mutations', () => {
    for (const verbo of ['verify', 'plan']) {
      const args = verbo === 'verify' ? ['verify', '--json', '--version', 'v0.1.1', '--sha', '10c62ac85fd3ab275b8926c89f5f34ba4116e2cf'] : [verbo, '--json'];
      const json = JSON.parse(runCli(args));
      assert.equal(typeof json.mutations, 'number', `${verbo} sem campo mutations`);
      assert.equal(json.mutations, 0, `${verbo} com mutações`);
      const decisao = json.tag ?? json.elegibilidade ?? json;
      assert.equal(typeof decisao.code, 'string', `${verbo} sem decisão`);
      assert.equal(decisao.writeAction, null, `${verbo} carregou writeAction`);
    }
    const verify = JSON.parse(runCli(['verify', '--json', '--version', 'v0.1.1', '--sha', '10c62ac85fd3ab275b8926c89f5f34ba4116e2cf']));
    const plan = JSON.parse(runCli(['plan', '--json']));
    assert.equal(verify.tag.code, 'ELIGIBLE');
    assert.equal(plan.elegibilidade.code, 'ELIGIBLE');
    // A decisão embutida no plano é a mesma que verify emite; o contador
    // mutations vive no topo de cada saída.
    const { mutations: _contador, ...decisaoDoVerify } = verify;
    assert.deepEqual(plan.elegibilidade, decisaoDoVerify.tag);
  });

  it('verificação seguida de plano sobre o mesmo fake: decisões idênticas, zero escritas (hipótese E)', async () => {
    const carregado = fixture('reference');
    const fake = makeFakeClient(clientSnapshotFor(carregado));
    const primeira = await runContractsOver(fake, carregado);
    const segunda = await runContractsOver(fake, carregado);
    assert.deepEqual(primeira, segunda);
    assert.equal(fake.writes.length, 0);
    assert.equal(fake.mutations, 0);
  });

  it('verificação e plano pela CLI concordam na elegibilidade (hipótese E, nível de saída)', () => {
    const verify = JSON.parse(runCli(['verify', '--json', '--version', 'v0.1.1', '--sha', '10c62ac85fd3ab275b8926c89f5f34ba4116e2cf']));
    const plan = JSON.parse(runCli(['plan', '--json']));
    assert.equal(plan.elegibilidade.code, verify.tag.code);
    assert.equal(plan.elegibilidade.reason, verify.tag.reason);
    assert.equal(plan.mutations, 0);
    assert.equal(verify.mutations, 0);
  });
});

describe('portão de dupla trava do apply (D-14)', () => {
  it('recusa sem a flag --yes e nomeia a fechadura ausente', async () => {
    const { reviewed, reviewedDigest } = await revisadoComDigest();
    const eventos = [];
    const perguntou = [];
    const resultado = await confirmApply({
      yesFlag: false,
      isTTY: true,
      outputIsTTY: false,
      planText: PLANO_DE_EXEMPLO,
      reviewed,
      reviewedDigest,
      ask: async () => {
        perguntou.push(true);
        return CONFIRMATION_WORD;
      },
      write: sinkQueConta(eventos, 'plano'),
    });
    assert.equal(resultado.confirmed, false);
    assert.equal(resultado.lock, 'flag');
    assert.match(resultado.reason, /--yes/);
    // A recusa por flag é uma recusa ANTES da renderização: o sink não é
    // chamado nenhuma vez e nenhuma pergunta é aberta. Esta é a prova canônica da
    // posição de renderização.
    assert.deepEqual(eventos, [], 'a recusa por flag escreveu no sink');
    assert.deepEqual(perguntou, [], 'a recusa por flag perguntou algo');
  });

  it('recusa com entrada não interativa mesmo com a flag --yes', async () => {
    const { reviewed, reviewedDigest } = await revisadoComDigest();
    const eventos = [];
    const perguntou = [];
    const resultado = await confirmApply({
      yesFlag: true,
      isTTY: false,
      outputIsTTY: false,
      planText: PLANO_DE_EXEMPLO,
      reviewed,
      reviewedDigest,
      ask: async () => {
        perguntou.push(true);
        return CONFIRMATION_WORD;
      },
      write: sinkQueConta(eventos, 'plano'),
    });
    assert.equal(resultado.confirmed, false);
    assert.equal(resultado.lock, 'tty');
    assert.match(resultado.reason, /terminal interativo/);
    assert.deepEqual(perguntou, [], 'a recusa por pipe não pode perguntar nada');
    assert.deepEqual(eventos, [], 'a recusa por pipe escreveu no sink');
  });

  it('recusa quando a confirmação digitada não é sim', async () => {
    const { reviewed, reviewedDigest } = await revisadoComDigest();
    for (const resposta of ['nao', 's', 'simmm', 'y', 'yes', '', '  ']) {
      const resultado = await confirmApply({
        yesFlag: true,
        isTTY: true,
        outputIsTTY: true,
        planText: PLANO_DE_EXEMPLO,
        reviewed,
        reviewedDigest,
        ask: async () => resposta,
        write: () => PLANO_DE_EXEMPLO.length,
      });
      assert.equal(resultado.confirmed, false, `resposta ${JSON.stringify(resposta)} confirmou`);
      assert.equal(resultado.lock, 'answer');
    }
  });

  it('confirma somente com flag, terminal interativo e a digitação sim', async () => {
    const { reviewed, reviewedDigest } = await revisadoComDigest();
    const resultado = await confirmApply({
      yesFlag: true,
      isTTY: true,
      outputIsTTY: true,
      planText: PLANO_DE_EXEMPLO,
      reviewed,
      reviewedDigest,
      ask: async () => ` ${CONFIRMATION_WORD.toUpperCase()} `,
      write: () => PLANO_DE_EXEMPLO.length,
    });
    assert.equal(resultado.confirmed, true);
    assert.equal(resultado.lock, null);
    assert.equal(resultado.reviewedDigest, reviewedDigest);
  });

  it('grava o plano antes de qualquer pergunta', async () => {
    const { reviewed, reviewedDigest } = await revisadoComDigest();
    const eventos = [];
    const resultado = await confirmApply({
      yesFlag: true,
      isTTY: true,
      outputIsTTY: true,
      planText: PLANO_DE_EXEMPLO,
      reviewed,
      reviewedDigest,
      ask: async () => {
        eventos.push('pergunta');
        return CONFIRMATION_WORD;
      },
      write: sinkQueConta(eventos, 'plano'),
    });
    assert.equal(resultado.confirmed, true);
    // Ordem declarada uma única vez: o plano ordenado, o conteúdo revisado e só
    // então a pergunta.
    assert.deepEqual(eventos, [
      `plano:${PLANO_DE_EXEMPLO}`,
      `plano:${(await portao()).renderReviewedText(reviewed)}`,
      'pergunta',
    ]);
  });

  it('não mostra plano algum para um apply que já ia recusar', async () => {
    const { reviewed, reviewedDigest } = await revisadoComDigest();
    const eventos = [];
    const resultado = await confirmApply({
      yesFlag: false,
      isTTY: false,
      outputIsTTY: false,
      planText: PLANO_DE_EXEMPLO,
      reviewed,
      reviewedDigest,
      ask: async () => {
        eventos.push('pergunta');
        return CONFIRMATION_WORD;
      },
      write: sinkQueConta(eventos, 'plano'),
    });
    assert.deepEqual(eventos, []);
    assert.equal(resultado.confirmed, false);
    assert.equal(resultado.lock, 'flag');
  });

  it('verifica flag, depois terminal, depois resposta, nessa ordem', async () => {
    const { reviewed, reviewedDigest } = await revisadoComDigest();
    const semFlag = await confirmApply({
      yesFlag: false,
      isTTY: false,
      outputIsTTY: false,
      planText: PLANO_DE_EXEMPLO,
      ask: async () => 'nao',
    });
    assert.equal(semFlag.lock, 'flag', 'a flag é verificada antes do terminal');

    const semTerminal = await confirmApply({
      yesFlag: true,
      isTTY: false,
      outputIsTTY: false,
      planText: PLANO_DE_EXEMPLO,
      ask: async () => 'nao',
    });
    assert.equal(semTerminal.lock, 'tty', 'o terminal é verificado antes da resposta');

    const respostaErrada = await confirmApply({
      yesFlag: true,
      isTTY: true,
      outputIsTTY: true,
      planText: PLANO_DE_EXEMPLO,
      reviewed,
      reviewedDigest,
      ask: async () => 'nao',
      write: () => PLANO_DE_EXEMPLO.length,
    });
    assert.equal(respostaErrada.lock, 'answer', 'a resposta é a última fechadura');
    // A ordem é comparada com a lista EXPORTADA pelo portão, nunca repetida
    // aqui como cópia literal do mesmo texto.
    assert.deepEqual(APPLY_LOCKS, [
      'plan',
      'flag',
      'tty',
      'output',
      'sink',
      'content',
      'prompt',
      'answer',
    ]);
  });

  it('recusa quando nenhum plano foi renderizado para revisão', async () => {
    const { reviewed, reviewedDigest } = await revisadoComDigest();
    for (const plano of ['', '   ', null, undefined]) {
      const resultado = await confirmApply({
        yesFlag: true,
        isTTY: true,
        outputIsTTY: true,
        planText: plano,
        reviewed,
        reviewedDigest,
        ask: async () => CONFIRMATION_WORD,
      });
      assert.equal(resultado.confirmed, false);
      assert.equal(resultado.lock, 'plan');
    }
  });

  it('avaliações sequenciais do portão não compartilham estado (hipótese F)', async () => {
    const { reviewed, reviewedDigest } = await revisadoComDigest();
    const base = { planText: PLANO_DE_EXEMPLO };
    const aprovada = await confirmApply({
      ...base,
      yesFlag: true,
      isTTY: true,
      outputIsTTY: true,
      reviewed,
      reviewedDigest,
      ask: async () => 'sim',
      write: () => PLANO_DE_EXEMPLO.length,
    });
    const negada = await confirmApply({ ...base, yesFlag: false, isTTY: false, ask: async () => 'nao' });
    const aprovadaDeNovo = await confirmApply({
      ...base,
      yesFlag: true,
      isTTY: true,
      outputIsTTY: true,
      reviewed,
      reviewedDigest,
      ask: async () => 'sim',
      write: () => PLANO_DE_EXEMPLO.length,
    });
    assert.equal(aprovada.confirmed, true);
    assert.equal(negada.confirmed, false);
    assert.equal(negada.lock, 'flag');
    assert.deepEqual(aprovada, aprovadaDeNovo);
  });

  it('a CLI recusa com pipe mesmo com a flag --yes e não pergunta nada', () => {
    const resultado = runCliPiped(['apply', '--yes']);
    assert.notEqual(resultado.status, 0);
    // A cláusula `terminal interativo` mora no motivo da fechadura `tty`, e
    // `tty` é a fechadura que um filho com pipe alcança: o processo filho tem a
    // entrada E a saída em pipe, então a fechadura de saída é inalcançável a
    // partir dele. A recusa NÃO é atribuída a `output`.
    assert.match(resultado.stderr, /terminal interativo/);
    assert.doesNotMatch(resultado.stdout, /Confirmar o apply/);
    assert.equal(resultado.stdout, '', 'um apply com pipe não pode renderizar nada antes de recusa');
  });

  it('a CLI recusa sem a flag --yes antes de abrir qualquer prompt', () => {
    const resultado = runCliPiped(['apply']);
    assert.notEqual(resultado.status, 0);
    assert.match(resultado.stderr, /--yes/);
    assert.doesNotMatch(resultado.stdout, /Confirmar o apply/);
  });
});

describe('plano ordenado visível antes da pergunta (D-15)', () => {
  it('o plano json lista os oito passos na ordem fixa da recuperação', () => {
    const plan = JSON.parse(runCli(['plan', '--json']));
    assert.equal(plan.steps.length, 8);
    assert.deepEqual(
      plan.steps.map((passo) => passo.id),
      ORDEM_FIXADA_DOS_PASSOS,
    );
    assert.deepEqual(
      plan.steps.map((passo) => passo.ordem),
      [1, 2, 3, 4, 5, 6, 7, 8],
    );
  });

  it('o plano marca criação e leitura passo a passo no baseline ausente', () => {
    const plan = JSON.parse(runCli(['plan', '--json']));
    assert.deepEqual(
      plan.steps.map((passo) => passo.marcador),
      MARCADORES_NO_BASELINE_AUSENTE,
    );
    const texto = runCli(['plan']);
    for (const passo of plan.steps) {
      assert.match(texto, new RegExp(`\\[${passo.marcador}\\] ${passo.id}`));
    }
  });

  it('o plano carrega os SHAs e as execuções congeladas do baseline', () => {
    const plan = JSON.parse(runCli(['plan', '--json']));
    assert.equal(plan.tagSha, '0a68d6f0c55e7be07d13a0bbc4ed36d4af772630');
    assert.equal(plan.commitSha, '10c62ac85fd3ab275b8926c89f5f34ba4116e2cf');
    assert.equal(plan.expectedSha, '10c62ac85fd3ab275b8926c89f5f34ba4116e2cf');
    assert.deepEqual(plan.runs, [36095855139, 36095872529]);
    assert.equal(plan.applyLiberado, true);
    assert.equal(plan.bloqueio, null);
  });

  it('a CLI com pipe não renderiza nada e recusa na fechadura de terminal de entrada', () => {
    const resultado = runCliPiped(['apply', '--yes']);
    // A afirmação é o oposto da antiga: um apply com pipe não mostra plano
    // algum. Ele falha na fechadura `tty` (lock três), que vem ANTES da
    // fechadura de saída (lock quatro), então um processo filho com pipe jamais
    // alcança `output`.
    assert.notEqual(resultado.status, 0);
    assert.match(resultado.stderr, /terminal interativo/);
    assert.equal(resultado.stdout, '');
    assert.doesNotMatch(resultado.stderr, /Confirmar o apply/);
  });
});

describe('higiene de segredo na saída e nas fontes (Pitfall 7)', () => {
  it('nenhuma fonte de implementação nomeia forma de credencial', () => {
    const implementacao = listAllFiles(TOOL_DIR.pathname).filter(
      (arquivo) => !arquivo.endsWith('.test.js'),
    );
    assert.ok(implementacao.length >= 10, 'varredura da implementação vazia');
    for (const arquivo of implementacao) {
      const texto = readFileSync(arquivo, 'utf8');
      for (const forma of FORMAS_DE_CREDENCIAL) {
        assert.ok(!texto.includes(forma), `${arquivo} nomeia forma de credencial: ${forma}`);
      }
    }
  });

  it('as formas de credencial só são escritas dentro de arquivos de teste', () => {
    for (const arquivo of listAllFiles(TOOL_DIR.pathname)) {
      const texto = readFileSync(arquivo, 'utf8');
      const nomeiaAlguma = FORMAS_DE_CREDENCIAL.some((forma) => texto.includes(forma));
      if (nomeiaAlguma) {
        assert.ok(arquivo.endsWith('.test.js'), `forma de credencial fora de teste: ${arquivo}`);
      }
    }
  });

  it('as saídas capturadas de verify, plan e apply não carregam forma de credencial', async () => {
    const { reviewed, reviewedDigest } = await revisadoComDigest();
    const saidas = [
      runCli(['verify', '--version', 'v0.1.1', '--sha', '10c62ac85fd3ab275b8926c89f5f34ba4116e2cf']),
      runCli(['verify', '--json', '--version', 'v0.1.1', '--sha', '10c62ac85fd3ab275b8926c89f5f34ba4116e2cf']),
      runCli(['plan']),
      runCli(['plan', '--json']),
      runCli(['verify', '--help']),
    ];
    for (const args of [['apply', '--yes'], ['apply'], ['apply', '--json']]) {
      const piped = runCliPiped(args);
      assert.notEqual(piped.status, 0, `${args.join(' ')} deveria recusar`);
      saidas.push(piped.stdout, piped.stderr);
    }
    const portao = [];
    portao.push(
      await confirmApply({ yesFlag: false, isTTY: false, outputIsTTY: false, planText: PLANO_DE_EXEMPLO, ask: async () => 'sim' }),
    );
    portao.push(
      await confirmApply({ yesFlag: true, isTTY: false, outputIsTTY: false, planText: PLANO_DE_EXEMPLO, ask: async () => 'sim' }),
    );
    portao.push(
      await confirmApply({
        yesFlag: true,
        isTTY: true,
        outputIsTTY: true,
        planText: PLANO_DE_EXEMPLO,
        reviewed,
        reviewedDigest,
        ask: async () => 'nao',
        write: () => PLANO_DE_EXEMPLO.length,
      }),
    );
    const renderizados = [];
    portao.push(
      await confirmApply({
        yesFlag: true,
        isTTY: true,
        outputIsTTY: true,
        planText: PLANO_DE_EXEMPLO,
        reviewed,
        reviewedDigest,
        ask: async () => 'sim',
        write: sinkQueConta(renderizados, 'render'),
      }),
    );
    saidas.push(JSON.stringify(portao), PLANO_DE_EXEMPLO, ...renderizados);

    // E o texto do conteúdo revisado que o portão acabou de renderizar entra na
    // varredura pela MESMA via: a lista acima carrega o render inteiro, e é ele
    // que contém as duas frases do fixture congelado. Um segredo que aparecesse
    // nas notas de Release encontraria a prova pelo mesmo caminho que o
    // encontra no resto da saída.
    assert.ok(
      renderizados.some((evento) => evento.includes(reviewed.releaseNotes)),
      'a varredura de credencial não cobriu o render do conteúdo revisado',
    );
    assert.ok(
      renderizados.some((evento) => evento.includes(reviewed.milestoneCompletionRecord)),
      'a varredura de credencial não cobriu o registro de conclusão da Milestone',
    );

    for (const saida of saidas) {
      for (const forma of FORMAS_DE_CREDENCIAL) {
        assert.ok(!saida.includes(forma), `saída carrega forma de credencial: ${forma}`);
      }
    }
  });

  it('a ferramenta não lê variável de ambiente de credencial em lugar nenhum', () => {
    const implementacao = listAllFiles(TOOL_DIR.pathname).filter(
      (arquivo) => !arquivo.endsWith('.test.js'),
    );
    for (const arquivo of implementacao) {
      const texto = readFileSync(arquivo, 'utf8');
      assert.ok(!/process\.env\./.test(texto), `${arquivo} lê process.env`);
    }
  });
});

// ===========================================================================
// fechaduras novas: terminal de saída, sink real, conteúdo revisado ligado ao
// digest canônico, e a posição única de renderização
// ===========================================================================
//
// CONVENÇÃO OBRIGATÓRIA: toda prova NOVA deste arquivo é um `it()` de nível
// superior, nunca aninhado em `describe`. O node indenta subtestes TAP aninhados,
// e um teste alvo dentro de um `describe` fica invisível para o verificador de
// evidência RED (`check tdd-red-evidence`), que precisa enxergar a falha do
// teste nomeado. Os `describe` acima agrupam as provas herdadas de 09-03; as
// provas novas ficam aqui, no nível superior, por esse motivo e não por gosto.

it('recusa com terminal de entrada vivo e saída ausente, sem escrever e sem perguntar', async () => {
  const { reviewed, reviewedDigest } = await revisadoComDigest();
  const eventos = [];
  const perguntou = [];
  const resultado = await confirmApply({
    yesFlag: true,
    isTTY: true,
    outputIsTTY: false,
    planText: PLANO_DE_EXEMPLO,
    reviewed,
    reviewedDigest,
    ask: async () => {
      perguntou.push(true);
      return CONFIRMATION_WORD;
    },
    write: sinkQueConta(eventos, 'plano'),
  });
  assert.equal(resultado.confirmed, false);
  assert.equal(resultado.lock, 'output');
  assert.match(resultado.reason, /terminal/i);
  assert.deepEqual(eventos, [], 'a recusa por saída renderizou algo');
  assert.deepEqual(perguntou, [], 'a recusa por saída perguntou algo');
});

it('recusa com sink ausente ou que não é função, antes de qualquer renderização', async () => {
  const { reviewed, reviewedDigest } = await revisadoComDigest();
  for (const write of [undefined, null, 'stdout', 42, {}]) {
    const eventos = [];
    const resultado = await confirmApply({
      yesFlag: true,
      isTTY: true,
      outputIsTTY: true,
      planText: PLANO_DE_EXEMPLO,
      reviewed,
      reviewedDigest,
      ask: async () => {
        eventos.push('pergunta');
        return CONFIRMATION_WORD;
      },
      write,
    });
    assert.equal(resultado.confirmed, false, `sink ${JSON.stringify(write)} confirmou`);
    assert.equal(resultado.lock, 'sink', `sink ${JSON.stringify(write)} não recusa em sink`);
    assert.deepEqual(eventos, [], `sink ${JSON.stringify(write)} abriu a pergunta`);
  }
});

it('recusa com sink que relata zero caracteres depois do render e antes da pergunta', async () => {
  const { reviewed, reviewedDigest } = await revisadoComDigest();
  const eventos = [];
  const perguntou = [];
  const resultado = await confirmApply({
    yesFlag: true,
    isTTY: true,
    outputIsTTY: true,
    planText: PLANO_DE_EXEMPLO,
    reviewed,
    reviewedDigest,
    ask: async () => {
      perguntou.push(true);
      return CONFIRMATION_WORD;
    },
    write: (texto) => {
      eventos.push(`plano:${texto}`);
      return 0;
    },
  });
  assert.equal(resultado.confirmed, false);
  assert.equal(resultado.lock, 'sink');
  // Esta é a ÚNICA família de recusa cujo observável de escrita são chamadas de
  // sink, e não zero chamadas: o render aconteceu e o total relatado foi zero.
  assert.equal(eventos.length, 2, 'a recusa por zero caracteres não fez as duas renderizações');
  assert.deepEqual(perguntou, [], 'a recusa por zero caracteres perguntou algo');
});

it('recusa com sink que não relata contagem de caracteres', async () => {
  const { reviewed, reviewedDigest } = await revisadoComDigest();
  for (const relato of [true, false, null, undefined, 'dois', NaN, -1]) {
    const resultado = await confirmApply({
      yesFlag: true,
      isTTY: true,
      outputIsTTY: true,
      planText: PLANO_DE_EXEMPLO,
      reviewed,
      reviewedDigest,
      ask: async () => CONFIRMATION_WORD,
      // `process.stdout.write` devolve booleano: um sink que não relata contagem
      // não pode ser distinguido de um sink que engoliu o plano.
      write: () => relato,
    });
    assert.equal(resultado.confirmed, false, `relato ${String(relato)} confirmou`);
    assert.equal(resultado.lock, 'sink', `relato ${String(relato)} não recusa em sink`);
  }
});

it('recusa sem conteúdo revisado, em branco, ou sem notas e sem registro de conclusão', async () => {
  const mod = await portao();
  const semCampos = {
    version: CONTEUDO_REVISADO.version,
    expectedSha: CONTEUDO_REVISADO.expectedSha,
    commitSha: CONTEUDO_REVISADO.commitSha,
  };
  const casos = [
    ['ausente', undefined],
    ['nulo', null],
    ['objeto vazio', {}],
    ['lista', []],
    ['sem notas de release', { ...CONTEUDO_REVISADO, releaseNotes: '' }],
    ['notas em branco', { ...CONTEUDO_REVISADO, releaseNotes: '   \n  ' }],
    ['sem registro de conclusão', { ...CONTEUDO_REVISADO, milestoneCompletionRecord: '' }],
    ['registro em branco', { ...CONTEUDO_REVISADO, milestoneCompletionRecord: '  ' }],
    ['sem os dois textos', semCampos],
    ['sem versão', { ...CONTEUDO_REVISADO, version: '' }],
    ['sem sha esperado', { ...CONTEUDO_REVISADO, expectedSha: '' }],
    ['sem commit observations', { ...CONTEUDO_REVISADO, commitSha: '' }],
  ];
  for (const [rotulo, reviewed] of casos) {
    const eventos = [];
    const perguntou = [];
    // O digest só é calculado para o que É um objeto revisado: serializar uma
    // lista ou um ausente não é o que se está provando aqui, e o gate recusa
    // antes de recalcular qualquer coisa nesses casos.
    const podeSerializar =
      reviewed !== null && typeof reviewed === 'object' && !Array.isArray(reviewed);
    const resultado = await confirmApply({
      yesFlag: true,
      isTTY: true,
      outputIsTTY: true,
      planText: PLANO_DE_EXEMPLO,
      reviewed,
      reviewedDigest: podeSerializar ? mod.canonicalReviewedDigest(reviewed) : undefined,
      ask: async () => {
        perguntou.push(true);
        return CONFIRMATION_WORD;
      },
      write: sinkQueConta(eventos, 'plano'),
    });
    assert.equal(resultado.confirmed, false, `conteúdo ${rotulo} confirmou`);
    assert.equal(resultado.lock, 'content', `conteúdo ${rotulo} não recusa em content`);
    assert.deepEqual(eventos, [], `conteúdo ${rotulo} renderizou algo`);
    assert.deepEqual(perguntou, [], `conteúdo ${rotulo} perguntou algo`);
  }
});

it('recusa quando o conteúdo revisado mudou entre a renderização e a confirmação', async () => {
  const { reviewed } = await revisadoComDigest();
  const eventos = [];
  const perguntou = [];
  const resultado = await confirmApply({
    yesFlag: true,
    isTTY: true,
    outputIsTTY: true,
    planText: PLANO_DE_EXEMPLO,
    reviewed,
    // O digest é o que o plano carregava; o conteúdo é o que mudou. Um gate que
    // aceitasse o digest sem recalcular deixaria uma frase trocada passar.
    reviewedDigest: '0'.repeat(64),
    ask: async () => {
      perguntou.push(true);
      return CONFIRMATION_WORD;
    },
    write: sinkQueConta(eventos, 'plano'),
  });
  assert.equal(resultado.confirmed, false);
  assert.equal(resultado.lock, 'content');
  assert.match(resultado.reason, /mudou|mudou entre/i);
  assert.deepEqual(eventos, [], 'a recusa por digest renderizou algo');
  assert.deepEqual(perguntou, [], 'a recusa por digest perguntou algo');
});

// Matriz consolidada de recusas (T-09-08-08). Cada linha é uma família com a
// fechadura que ela nomeia, o NÚMERO de chamadas de sink que o observável
// permite, os caracteres relatados pelo sink e se a pergunta foi aberta.
//
// As duas famílias de sink são linhas SEPARADAS de propósito, e a diferença
// entre elas é a que mais importa aqui: recusa por sink AUSENTE ou que não é
// função se observa com zero chamadas de sink, porque nada foi escrito;
// recusa por sink com TOTAL ZERO DE CARACTERES se observa com as DUAS chamadas
// de renderização feitas e a soma relatada igual a zero. Juntar as duas numa
// linha só permitiria que uma passasse pela outra — e as duas pedem ações
// diferentes do operador.
//
// A invocação TOTALMENTE em pipe é uma terceira linha, fora desta matriz, com
// forma própria: é um processo filho, e ele falha na fechadura `tty`, que vem
// ANTES da de saída. A linha de saída redirecionada e a linha de pipe nunca
// podem ser a mesma linha.
it('a matriz de recusas nomeia a fechadura certa e o observável de escrita de cada família', async () => {
  const { reviewed, reviewedDigest } = await revisadoComDigest();
  const completo = {
    yesFlag: true,
    isTTY: true,
    outputIsTTY: true,
    planText: PLANO_DE_EXEMPLO,
    reviewed,
    reviewedDigest,
  };
  // `observavel`:
  //   chamadas  — quantas vezes o sink gravador foi chamado
  //   caracteres — soma relatada pelos renders
  //   perguntou  — se a pergunta foi aberta
  const matriz = [
    {
      nome: 'plano ausente',
      entrada: { ...completo, planText: '   ' },
      fechadura: 'plan',
      observavel: { chamadas: 0, caracteres: 0, perguntou: false },
    },
    {
      nome: 'flag --yes ausente',
      entrada: { ...completo, yesFlag: false },
      fechadura: 'flag',
      observavel: { chamadas: 0, caracteres: 0, perguntou: false },
    },
    {
      nome: 'entrada não interativa (pipe de entrada)',
      entrada: { ...completo, isTTY: false },
      fechadura: 'tty',
      observavel: { chamadas: 0, caracteres: 0, perguntou: false },
    },
    {
      nome: 'saída redirecionada com entrada viva',
      entrada: { ...completo, outputIsTTY: false },
      fechadura: 'output',
      observavel: { chamadas: 0, caracteres: 0, perguntou: false },
    },
    {
      nome: 'conteúdo revisado em branco',
      entrada: { ...completo, reviewed: { ...reviewed, releaseNotes: '' } },
      fechadura: 'content',
      observavel: { chamadas: 0, caracteres: 0, perguntou: false },
    },
    {
      nome: 'conteúdo revisado ausente',
      entrada: { ...completo, reviewed: undefined, reviewedDigest: undefined },
      fechadura: 'content',
      observavel: { chamadas: 0, caracteres: 0, perguntou: false },
    },
    {
      nome: 'digest recalculado diferente do do plano',
      entrada: { ...completo, reviewedDigest: 'f'.repeat(64) },
      fechadura: 'content',
      observavel: { chamadas: 0, caracteres: 0, perguntou: false },
    },
    {
      nome: 'sink ausente (o destino de saída não existe)',
      entrada: { ...completo, write: undefined },
      semGravador: true,
      fechadura: 'sink',
      observavel: { chamadas: 0, caracteres: 0, perguntou: false },
    },
    {
      nome: 'sink que não é função',
      entrada: { ...completo, write: 'stdout' },
      semGravador: true,
      fechadura: 'sink',
      observavel: { chamadas: 0, caracteres: 0, perguntou: false },
    },
    {
      // A ÚNICA linha da matriz com chamadas de sink e ainda sem pergunta.
      nome: 'sink que relata zero caracteres',
      entrada: { ...completo },
      gravador: () => 0,
      fechadura: 'sink',
      observavel: { chamadas: 2, caracteres: 0, perguntou: false },
    },
    {
      // A renderização JÁ aconteceu: duas chamadas, caracteres acima de zero e a
      // pergunta aberta. É a recusa mais tarde da ordem, e a única em que o
      // operador viu algo antes de dizer não.
      nome: 'palavra digitada diferente de sim',
      entrada: { ...completo },
      resposta: 'nao',
      fechadura: 'answer',
      observavel: { chamadas: 2, caracteres: 'acima-de-zero', perguntou: true },
    },
  ];

  for (const linha of matriz) {
    const chamadas = [];
    const perguntas = [];
    let caracteres = 0;
    const entrada = { ...linha.entrada };
    entrada.ask = async () => {
      perguntas.push(true);
      return linha.resposta ?? CONFIRMATION_WORD;
    };
    if (!linha.semGravador) {
      const relatar = linha.gravador ?? ((texto) => (typeof texto === 'string' ? texto.length : 0));
      entrada.write = (texto) => {
        chamadas.push(typeof texto === 'string' ? texto : '');
        const relatorio = relatar(texto);
        caracteres += typeof relatorio === 'number' && Number.isFinite(relatorio) ? relatorio : 0;
        return relatorio;
      };
    }
    const resultado = await confirmApply(entrada);
    const rotulo = `[${linha.nome}]`;
    assert.equal(resultado.confirmed, false, `${rotulo} confirmou`);
    assert.equal(resultado.lock, linha.fechadura, `${rotulo} nomeou a fechadura errada`);
    assert.equal(chamadas.length, linha.observavel.chamadas, `${rotulo} número de chamadas de sink`);
    if (linha.observavel.caracteres === 'acima-de-zero') {
      assert.ok(caracteres > 0, `${rotulo} sem caracteres relatados depois do render`);
    } else {
      assert.equal(caracteres, linha.observavel.caracteres, `${rotulo} caracteres relatados pelo sink`);
    }
    assert.equal(perguntas.length > 0, linha.observavel.perguntou, `${rotulo} estado da pergunta`);
  }
});

// A invocação TOTALMENTE em pipe tem forma própria — processo filho com entrada
// E saída não terminais — e por isso falha na fechadura de TTY, que é a lock
// três. A fechadura de saída (lock quatro) é INALCANÇÁVEL a partir dela, e
// escrevê-la de outro jeito faria a prova falhar pelo motivo errado e esconderia
// a ordem real.
it('a invocação totalmente em pipe recusa na fechadura de tty, com stdout vazio', () => {
  const piped = runCliPiped(['apply', '--yes']);
  assert.notEqual(piped.status, 0);
  assert.match(piped.stderr, /terminal interativo/);
  assert.doesNotMatch(piped.stderr, /não foi mostrado em um terminal vivo/);
  assert.equal(piped.stdout, '');
  assert.doesNotMatch(piped.stderr, /Confirmar o apply/);
});

it('as três fechaduras novas ficam entre a de terminal e a de pergunta, e as cinco antigas guardam a ordem', () => {
  assert.equal(APPLY_LOCKS.length, 8);
  const posicao = (fechadura) => APPLY_LOCKS.indexOf(fechadura);
  assert.ok(posicao('tty') < posicao('output'), 'output precisa vir depois de tty');
  assert.ok(posicao('output') < posicao('sink'), 'sink precisa vir depois de output');
  assert.ok(posicao('sink') < posicao('content'), 'content precisa vir depois de sink');
  assert.ok(posicao('content') < posicao('prompt'), 'prompt precisa vir depois de content');
  // As cinco originais mantêm a ordem relativa entre si, e as três novas são
  // exatamente o acréscimo.
  const antigas = APPLY_LOCKS.filter((fechadura) =>
    ['plan', 'flag', 'tty', 'prompt', 'answer'].includes(fechadura),
  );
  assert.deepEqual(antigas, ['plan', 'flag', 'tty', 'prompt', 'answer']);
  const novas = APPLY_LOCKS.filter(
    (fechadura) => !['plan', 'flag', 'tty', 'prompt', 'answer'].includes(fechadura),
  );
  assert.deepEqual(novas, ['output', 'sink', 'content']);
});

it('mostra o plano ordenado e o conteúdo revisado no terminal vivo, antes da pergunta', async () => {
  // O texto do plano é o que a própria CLI renderiza, não uma cópia local: a
  // prova é sobre o que o operador leria, não sobre um literal do teste.
  const textoDoPlano = runCli(['plan']);
  const { reviewed, reviewedDigest } = await revisadoComDigest();
  const eventos = [];
  const resultado = await confirmApply({
    yesFlag: true,
    isTTY: true,
    outputIsTTY: true,
    planText: textoDoPlano,
    reviewed,
    reviewedDigest,
    ask: async () => {
      eventos.push('pergunta');
      return CONFIRMATION_WORD;
    },
    write: sinkQueConta(eventos, 'render'),
  });
  assert.equal(resultado.confirmed, true);
  const [plano, revisado] = eventos;
  for (const passo of ORDEM_FIXADA_DOS_PASSOS) {
    assert.ok(plano.includes(passo), `passo ausente no que o sink recebeu: ${passo}`);
  }
  assert.ok(plano.includes('Passos ordenados'), 'o render do plano não carrega os passos ordenados');
  assert.ok(
    revisado.includes(CONTEUDO_REVISADO.releaseNotes),
    'o render do conteúdo revisado não mostra as notas de Release do fixture',
  );
  assert.ok(
    revisado.includes(CONTEUDO_REVISADO.milestoneCompletionRecord),
    'o render do conteúdo revisado não mostra o registro de conclusão do fixture',
  );
  assert.equal(eventos[2], 'pergunta', 'a pergunta não veio depois dos dois renders');
});

// ===========================================================================
// conteúdo revisado no plano, saída lida do fluxo de saída, prompt que se
// liquida sozinho, e as provas de ausência de deriva
// ===========================================================================
//
// Convenção de nível superior mantida (ver o bloco anterior): toda prova nova
// é um `it()` fora de `describe`, para que a falha do teste nomeado fique
// visível para o verificador de evidência RED.

let moduloDaCli = null;
async function cli() {
  if (moduloDaCli === null) {
    const mod = await import('./release-close.js');
    for (const nome of ['decide', 'buildClosePlan', 'renderPlanText', 'runReleaseClose']) {
      assert.equal(typeof mod[nome], 'function', `${nome} não é exportado por release-close.js`);
    }
    moduloDaCli = mod;
  }
  return moduloDaCli;
}

// A fábrica de prompt é verificada à parte de propósito: uma guarda única
// falharia no `makeAsk` e faria as provas de conteúdo revisado falharem por um
// símbolo ausente, em vez de pela afirmação de comportamento que cada uma faz.
async function fabricaDePrompt() {
  const mod = await cli();
  assert.equal(typeof mod.makeAsk, 'function', 'makeAsk não é exportado por release-close.js');
  return mod.makeAsk;
}

// Plano construído pelo caminho de produção sobre um snapshot no formato do
// cliente. Nenhuma normalização é reimplementada aqui: a costura real monta o
// cliente, percorre as cinco leituras e entrega a evidência que o construtor
// recibió de fato.
async function planoDoFixture(mod, snapshot) {
  const decisao = await mod.decide({
    snapshot,
    version: snapshot.version,
    expectedSha: snapshot.expectedSha,
    ci: snapshot.ci,
  });
  const plano = mod.buildClosePlan({
    version: decisao.version,
    expectedSha: decisao.expectedSha,
    snapshot,
    eligibility: decisao.eligibility,
    classificacao: decisao.classification,
    evidence: decisao.evidence,
    mutations: decisao.mutations,
  });
  return { decisao, plano };
}

it('o plano carrega as notas e o registro de conclusão do fixture revisado, com digest estável', async () => {
  const mod = await cli();
  const { plano } = await planoDoFixture(mod, FIXTURE_REVISADO);
  assert.notEqual(plano.reviewed, null, 'o snapshot revisado não produziu objeto revisado');
  assert.equal(plano.reviewed.releaseNotes, FIXTURE_REVISADO.release.data.notes);
  assert.equal(
    plano.reviewed.milestoneCompletionRecord,
    FIXTURE_REVISADO.milestones.data[0].completionRecord,
  );
  assert.equal(plano.reviewed.version, FIXTURE_REVISADO.version);
  assert.equal(plano.reviewed.expectedSha, FIXTURE_REVISADO.expectedSha);
  assert.equal(plano.reviewed.commitSha, FIXTURE_REVISADO.tagObject.data.object.sha);
  // O digest do plano é o que a função exportada recalcula — byte a byte.
  assert.equal(plano.reviewedDigest, mod.canonicalReviewedDigest(plano.reviewed));
  assert.equal(plano.reviewedDigest, mod.canonicalReviewedDigest(CONTEUDO_REVISADO));
  assert.match(plano.reviewedDigest, /^[0-9a-f]{64}$/);
  // Duas execuções do construtor sobre o mesmo snapshot congelado dão o mesmo
  // digest: um digest não determinístico nunca chega ao operador.
  const segundo = await planoDoFixture(mod, FIXTURE_REVISADO);
  assert.equal(segundo.plano.reviewedDigest, plano.reviewedDigest);
});

it('o plano sem campos revisados não carrega objeto nem digest, e o texto diz isso em PT-BR', async () => {
  const mod = await cli();
  const { plano } = await planoDoFixture(mod, fixture('reference'));
  assert.equal(plano.reviewed, null, 'o baseline de referência não tem notas nem registro de conclusão');
  assert.equal(plano.reviewedDigest, null, 'o baseline de referência não tem digest');
  const texto = mod.renderPlanText(plano);
  assert.match(texto, /não há conteúdo revisado/i);
  assert.doesNotMatch(texto, /notas da Release: {2,}\S/, 'o texto do plano inventou notas de Release');
  assert.doesNotMatch(texto, /registro de conclusão: {2,}\S/, 'o texto do plano inventou registro de conclusão');
});

it('o texto do plano mostra o conteúdo revisado acima dos passos e do contador mutations', async () => {
  const mod = await cli();
  const { plano } = await planoDoFixture(mod, FIXTURE_REVISADO);
  const texto = mod.renderPlanText(plano);
  const indiceNotas = texto.indexOf(CONTEUDO_REVISADO.releaseNotes);
  const indiceRegistro = texto.indexOf(CONTEUDO_REVISADO.milestoneCompletionRecord);
  const indiceDigest = texto.indexOf(plano.reviewedDigest);
  const indicePassos = texto.indexOf('Passos ordenados');
  const indiceMutacoes = texto.indexOf('mutations:');
  assert.ok(indiceNotas >= 0, 'o texto do plano não mostra as notas de Release');
  assert.ok(indiceRegistro > indiceNotas, 'o registro de conclusão não vem depois das notas');
  assert.ok(indiceDigest > indiceRegistro, 'o digest não vem depois dos dois textos');
  assert.ok(indicePassos > indiceDigest, 'os passos ordenados vêm antes do conteúdo revisado');
  assert.ok(indiceMutacoes > indicePassos, 'o contador mutations não vem depois dos passos');
  // Os oito passos, a ordem e os marcadores continuam no texto, e o marcador
  // de cada passo vem do próprio plano — o alvo revisado JÁ tem release e
  // milestone, então os passos de escrita são de adoção, não de criação.
  for (const passo of ORDEM_FIXADA_DOS_PASSOS) {
    assert.ok(texto.includes(passo), `passo ausente no texto do plano: ${passo}`);
  }
  assert.equal(plano.steps[0].marcador, 'adotar', 'o passo de escrita do alvo revisado deveria ser adoção');
  assert.equal(plano.steps[7].marcador, 'ler');
  assert.ok(texto.includes(`  1. [${plano.steps[0].marcador}] ${plano.steps[0].id} `));
  assert.ok(texto.includes(`  8. [${plano.steps[7].marcador}] ${plano.steps[7].id} `));
});

it('a CLI recusa na fechadura de saída com terminal de entrada vivo e saída redirecionada', async () => {
  const mod = await cli();
  // Os dois lados do booleano são afirmados, e é a combinação que torna a
  // prova carregante: se a CLI lesse `isTTY` do fluxo de ENTRADA, o primeiro
  // caso passaria da fechadura de saída e cairia na de conteúdo, e o segundo
  // caso cairia na de saída. Ler do fluxo de saída é a única leitura que
  // satisfaz os dois.
  const rodar = async (saidaIsTTY) => {
    const saida = [];
    const codigo = await mod.runReleaseClose(['apply', '--yes'], {
      stdin: { isTTY: true },
      stdout: { isTTY: saidaIsTTY, write: (t) => saida.push(String(t)) },
      stderr: { isTTY: true, write: (t) => saida.push(`ERRO:${t}`) },
    });
    return {
      codigo,
      stdout: saida.filter((t) => !t.startsWith('ERRO:')).join(''),
      stderr: saida
        .filter((t) => t.startsWith('ERRO:'))
        .map((t) => t.slice('ERRO:'.length))
        .join(''),
    };
  };

  const redirecionada = await rodar(false);
  assert.equal(redirecionada.codigo, 1);
  assert.equal(redirecionada.stdout, '', 'a recusa por saída escreveu na saída redirecionada');
  assert.doesNotMatch(redirecionada.stderr, /Confirmar o apply/, 'a recusa por saída abriu a pergunta');
  assert.match(redirecionada.stderr, /não foi mostrado em um terminal vivo/);
  assert.doesNotMatch(redirecionada.stderr, /terminal interativo/);

  // Com os dois terminais vivos, a fechadura de saída PASSA e a recusa que vem
  // a seguir é a de conteúdo revisado — o baseline de referência não tem notas
  // de Release nem registro de conclusão. O texto distingue as duas famílias,
  // e é essa distinção que prova de onde o booleano foi lido.
  const viva = await rodar(true);
  assert.equal(viva.codigo, 1);
  assert.match(viva.stderr, /notas de Release nem registro de conclusão/i);
  assert.doesNotMatch(viva.stderr, /não foi mostrado em um terminal vivo/);
});

it('o prompt se liquida sozinho quando o terminal fecha logo depois de abrir', async () => {
  const makeAsk = await fabricaDePrompt();
  const { reviewed, reviewedDigest } = await revisadoComDigest();
  const entrada = new PassThrough();
  entrada.isTTY = true;
  const eventos = [];
  const destino = {
    write: (t) => {
      eventos.push(`render:${t}`);
      return true;
    },
  };
  const perguntar = () => {
    // O desfecho é agendado DEPOIS de a fábrica instalar seus ouvintes: um fim
    // de entrada que chegasse antes seria um evento sem quem o tratasse, o que
    // é outra falha e não a que esta prova cobre.
    const promessa = makeAsk(entrada, destino)();
    setTimeout(() => entrada.end(), 1);
    return promessa;
  };
  // O fim de entrada chega DEPOIS de a pergunta abrir, que é o caso que mantinha
  // o processo vivo até um tempo externo estourar.
  const resultado = await confirmApply({
    yesFlag: true,
    isTTY: true,
    outputIsTTY: true,
    planText: PLANO_DE_EXEMPLO,
    reviewed,
    reviewedDigest,
    ask: perguntar,
    write: (texto) => {
      eventos.push(`render:${texto}`);
      return typeof texto === 'string' ? texto.length : 0;
    },
  });
  assert.equal(resultado.confirmed, false);
  assert.equal(resultado.lock, 'answer');
  assert.match(resultado.reason, /confirmação não foi recebida|não foi recebida/i);
  // Uma única pergunta foi aberta, e nenhuma segunda.
  const perguntas = eventos.filter((e) => e.includes('Confirmar o apply'));
  assert.equal(perguntas.length, 1, 'a pergunta não foi liquidada uma única vez');
});

it('o prompt se liquida sozinho quando o fluxo de entrada dá erro depois de abrir', async () => {
  const makeAsk = await fabricaDePrompt();
  const { reviewed, reviewedDigest } = await revisadoComDigest();
  const entrada = new PassThrough();
  entrada.isTTY = true;
  const eventos = [];
  const perguntar = () => {
    const promessa = makeAsk(entrada, {
      write: (t) => {
        eventos.push(`render:${t}`);
        return true;
      },
    })();
    setTimeout(() => entrada.destroy(new Error('falha de leitura simulada')), 1);
    return promessa;
  };
  const resultado = await confirmApply({
    yesFlag: true,
    isTTY: true,
    outputIsTTY: true,
    planText: PLANO_DE_EXEMPLO,
    reviewed,
    reviewedDigest,
    ask: perguntar,
    write: (texto) => {
      eventos.push(`render:${texto}`);
      return typeof texto === 'string' ? texto.length : 0;
    },
  });
  assert.equal(resultado.confirmed, false);
  assert.equal(resultado.lock, 'answer');
  assert.match(resultado.reason, /fluxo de entrada falhou/i);
  // O motivo é o de FLUXO, e não o de fim de entrada: os dois liquidam sem
  // resposta, mas são causas diferentes e o operador precisa saber qual.
  assert.doesNotMatch(resultado.reason, /terminal foi fechado/i);
  const perguntas = eventos.filter((e) => e.includes('Confirmar o apply'));
  assert.equal(perguntas.length, 1, 'a pergunta não foi liquidada uma única vez');
});

it('dois planos sobre o mesmo snapshot congelado rendem texto e digest byte-idênticos', async () => {
  const mod = await cli();
  const primeiro = await planoDoFixture(mod, FIXTURE_REVISADO);
  const segundo = await planoDoFixture(mod, FIXTURE_REVISADO);
  assert.equal(segundo.plano.reviewedDigest, primeiro.plano.reviewedDigest);
  assert.equal(mod.renderPlanText(segundo.plano), mod.renderPlanText(primeiro.plano));
  assert.equal(primeiro.plano.mutations, 0);
  assert.equal(segundo.plano.mutations, 0);
});

// Prova de ausência de deriva na CONFIRMAÇÃO, e não só na renderização: o
// pré-flight da confirmação é rodado duas vezes sobre as MESMAS entradas e tem de
// devolver a decisão idêntica e deixar o digest exatamente onde estava. Um gate
// que mutasse o objeto revisado, ou que consumisse um settle, mudaria a segunda
// decisão — e é exatamente isso que a reconciliação da Fase 11 vai depender.
it('o pré-flight da confirmação duas vezes devolve a decisão idêntica e não move o digest', async () => {
  const mod = await portao();
  const { reviewed, reviewedDigest } = await revisadoComDigest();
  const digestAntes = mod.canonicalReviewedDigest(reviewed);
  const base = {
    yesFlag: true,
    isTTY: true,
    outputIsTTY: true,
    planText: PLANO_DE_EXEMPLO,
    reviewed,
    reviewedDigest,
  };
  const negada = () =>
    confirmApply({
      ...base,
      ask: async () => 'nao',
      write: () => PLANO_DE_EXEMPLO.length,
    });
  const primeira = await negada();
  const segunda = await negada();
  assert.deepEqual(segunda, primeira, 'o pré-flight da confirmação não é idempotente');
  assert.equal(primeira.lock, 'answer');
  // O objeto revisado é o MESMO objeto depois das duas passagens: a aprovação
  // continua vinculada ao conteúdo que o operador leu.
  assert.equal(reviewed, CONTEUDO_REVISADO, 'o gate trocou o objeto revisado');
  assert.equal(mod.canonicalReviewedDigest(reviewed), digestAntes, 'o gate alterou o conteúdo revisado');
  assert.equal(digestAntes, reviewedDigest);

  // E o caminho aprovado também é idempotente, com o digest ecoado na decisão.
  const aprovada = async () =>
    confirmApply({
      ...base,
      ask: async () => CONFIRMATION_WORD,
      write: () => PLANO_DE_EXEMPLO.length,
    });
  const decisaoA = await aprovada();
  const decisaoB = await aprovada();
  assert.deepEqual(decisaoB, decisaoA);
  assert.equal(decisaoA.reviewedDigest, digestAntes);
});

// ===========================================================================
// fronteiras declaradas da prova SAFE-04, em PT-BR
// ===========================================================================
//
// O que ESTA prova afirma:
//   - a dupla trava do apply exige as oito fechaduras na ordem exportada, e cada
//     recusa nomeia a primeira que falhou;
//   - nada é escrito e nenhuma pergunta é aberta até que toda fechadura de
//     `plan` a `content` tenha passado; depois disso o plano ordenado é escrito
//     primeiro e o conteúdo revisado segundo, ambos antes da pergunta;
//   - o conteúdo revisado é o objeto que o digest cobre, e o digest é
//     recalculado no momento da pergunta;
//   - fim de entrada e erro de fluxo recusam em vez de ficar pendentes ou
//     perguntar de novo;
//   - verify, plan e apply são somente-leitura, e a contagem relatada é a
//     contagem medida na fronteira de escrita.
//
// O que ESTA prova NÃO afirma, e é deliberado:
//   - arbitragem ENTRE PROCESSOS. A instância-isolação prova é sobre o estado
//     dentro de um processo; duas execuções simultâneas da CLI não são
//     coordenadas por nada aqui, e essa coordenação é da Fase 11;
//   - qualquer escrita remota. Nenhum verbo escreve no remoto nesta fase, e a
//     confirmação aceita ainda assim falha fechado;
//   - que a CI esteja verde de verdade. O bloco `ci` é evidência CONGELADA do
//     fixture; a releitura ao vivo é da Fase 10;
//   - que `closeMarkers` e `failedRunIds` sejam alcançáveis: eles não têm fonte
//     entre as cinco leituras declaradas, o que COVERAGE.md registra como
//     entrega da costura de reconciliação do plano 09-09.

// As guardas de fonte leem o texto do arquivo, e elas existem para duas
// propriedades que nenhuma sonda de comportamento consegue observar de fora:
// que a suíte não voltou a ter um helper local de snapshot ou de evidência, e
// que ela não reescreveu a ordem das fechaduras como cópia literal do texto
// exportado (o que faria uma reordenação passar em silêncio).
it('a suíte não define helper local de snapshot nem de evidência', () => {
  const fonte = readFileSync(new URL('./safe04.test.js', import.meta.url), 'utf8');
  assert.doesNotMatch(
    fonte,
    /function\s+evidenceFromSnapshot|function\s+evidenciaDe/,
    'a suíte voltou a ter um helper local de evidência: a normalização precisa ser a de produção',
  );
  assert.doesNotMatch(
    fonte,
    /function\s+.*[Ss]napshot\s*\(/,
    'a suíte voltou a ter um helper local de snapshot',
  );
  // E a decisão tem de VIR do seam exportado, não do classificador chamado
  // diretamente: `classifySnapshot` e `checkTagEligibility` continuam importados
  // para a varredura de fonte, e não para decidir nada aqui.
  const foraDaVarredura = fonte
    .split('\n')
    .filter((linha) => !/^\s*(\/\/|\*|\/\*)/.test(linha))
    .filter((linha) => !/assert\.doesNotMatch\(fonte/.test(linha))
    .filter((linha) => !/classifySnapshot\)|checkTagEligibility\)/.test(linha));
  assert.doesNotMatch(
    foraDaVarredura.join('\n'),
    /classifySnapshot\(|checkTagEligibility\(/,
    'a suíte chamou um contrato puro diretamente em vez da costura de produção',
  );
  assert.match(
    fonte,
    /mod\.decide\(/,
    'a suíte não dirige a costura de produção exportada',
  );
});

it('a suíte não reescreve a ordem das fechaduras como cópia literal fora da asserção de posição', () => {
  const fonte = readFileSync(new URL('./safe04.test.js', import.meta.url), 'utf8');
  // A lista literal aparece UMA vez, na asserção que compara a lista exportada
  // com a ordem declarada pelo plano. Qualquer segunda ocorrência é uma cópia
  // que passaria a divergir do código sem ninguém perceber.
  const ocorrencias = (fonte.match(/'plan',\s*\n\s*'flag',\s*\n\s*'tty'/g) ?? []).length;
  assert.equal(ocorrencias, 1, 'a ordem das fechaduras foi reescrita como cópia literal em mais de um lugar');
  // E a lista é comparada com a EXPORTADA, não com um literal de oito entradas
  // montado no lugar.
  assert.match(fonte, /assert\.deepEqual\(APPLY_LOCKS,/, 'a lista de fechaduras não é comparada com a exportada');
});

// A segunda computation do digest dentro do construtor de plano é, por
// natureza, INVISÍVEL a uma sonda de comportamento: uma função determinística
// devolve o mesmo valor nas duas chamadas, então apagar a segunda computation
// não muda nada que a suíte consiga observar. A afirmação que a torna
// carregante é de código, e ela é explícita sobre isso: duas chamadas à função
// exportada dentro do construtor, e uma recusa quando elas discordam.
it('o construtor de plano computa o digest duas vezes e recusa quando elas discordam', () => {
  const fonte = readFileSync(new URL('./release-close.js', import.meta.url), 'utf8');
  const inicio = fonte.search(/^export function buildClosePlan\(/m);
  assert.ok(inicio >= 0, 'buildClosePlan não está declarado no módulo da CLI');
  let profundidade = 0;
  let chave = -1;
  for (let i = fonte.indexOf('(', inicio); i < fonte.length; i += 1) {
    if (fonte[i] === '(') profundidade += 1;
    else if (fonte[i] === ')') {
      profundidade -= 1;
      if (profundidade === 0) {
        chave = fonte.indexOf('{', i);
        break;
      }
    }
  }
  let fim = -1;
  profundidade = 0;
  for (let i = chave; i < fonte.length; i += 1) {
    if (fonte[i] === '{') profundidade += 1;
    else if (fonte[i] === '}') {
      profundidade -= 1;
      if (profundidade === 0) {
        fim = i + 1;
        break;
      }
    }
  }
  const corpo = fonte.slice(inicio, fim);
  const chamadas = (corpo.match(/canonicalReviewedDigest\(/g) ?? []).length;
  assert.equal(
    chamadas,
    2,
    'o construtor chama a serialização ' + chamadas + ' vezes, e não 2',
  );
  assert.match(
    corpo,
    /new RecusaDeIntegridade\(/,
    'o construtor não recusa quando as duas computações discordam',
  );
  // E a segunda computation não é a mesma variável relida: tem de ser uma
  // chamada nova, senão a comparação é consigo mesma e sempre concorda.
  assert.match(corpo, /const segunda = canonicalReviewedDigest\(/);
  assert.match(corpo, /segunda !== reviewedDigest/);
});

// Corta o corpo de uma declaração de função a partir do texto-fonte inteiro,
// começando na ocorrência de `expressao` e terminando na chave que fecha o
// CORPO. A chave inicial é a que abre depois de fecharem todos os parênteses da
// lista de parâmetros — e não a primeira chave qualquer: numa assinatura
// desestruturada (`{ evidence, mutations }`) a primeira chave é a da
// desestruturação, e um contador que começa nela devolve a assinatura e nada
// mais. Uma guarda que inspeciona um fragmento é pior do que nenhuma guarda,
// porque ela relata uma aprovação sem ter olhado.
function fatiarFuncao(fonte, expressao) {
  const inicio = fonte.search(expressao);
  assert.ok(inicio >= 0, 'declaração não encontrada no módulo da CLI: ' + String(expressao));
  let profundidade = 0;
  let chave = -1;
  for (let i = fonte.indexOf('(', inicio); i < fonte.length; i += 1) {
    if (fonte[i] === '(') profundidade += 1;
    else if (fonte[i] === ')') {
      profundidade -= 1;
      if (profundidade === 0) {
        chave = fonte.indexOf('{', i);
        break;
      }
    }
  }
  let fim = -1;
  profundidade = 0;
  for (let i = chave; i < fonte.length; i += 1) {
    if (fonte[i] === '{') profundidade += 1;
    else if (fonte[i] === '}') {
      profundidade -= 1;
      if (profundidade === 0) {
        fim = i + 1;
        break;
      }
    }
  }
  assert.ok(fim > 0, 'o corpo da declaração não fechou: ' + String(expressao));
  return fonte.slice(inicio, fim);
}

// A CLI entrega ao portão um destino de saída que RELATA QUANTOS CARACTERES
// escreveu, e não o booleano que `process.stdout.write` devolve.
//
// Esta afirmação é de FONTE por uma razão concreta, e a razão vale mais que a
// prova: o caminho de apply da CLI carrega SEMPRE o baseline de referência, e
// esse baseline não tem Release nem Milestone — a fechadura de conteúdo recusa e
// o render NUNCA acontece nesse caminho. Toda chamada a `confirmApply` feita
// aqui injeta o próprio `write`. Nenhuma prova de comportamento consegue
// observar o que o adaptador da CLI entrega ao portão, porque nenhum caminho
// alcançável chega a entregá-lo. Isso não é um buraco da suíte: é uma
// propriedade da superfície de produção, e vale escrito.
//
// A consequência prática é que o adaptador só passa a ter prova COMPORTAMENTAL
// quando a CLI passar a servir um baseline COM conteúdo revisado, e isso é a
// Fase 10/11. Até lá a afirmação fica viva por leitura de código.
it('a CLI entrega ao portão um sink que relata contagem de caracteres, e não um booleano', () => {
  const fonte = readFileSync(new URL('./release-close.js', import.meta.url), 'utf8');

  const adaptador = fatiarFuncao(fonte, /^function sinkQueContaCaracteres\(/m);
  // A escrita no fluxo continua acontecendo…
  assert.match(adaptador, /fluxo\.write\(/, 'o adaptador não escreve no fluxo de saída');
  // …e o que volta é o comprimento do que foi escrito. O retorno direto de
  // `write` seria booleano, e a fechadura de sink trata qualquer valor não
  // numérico como total inválido — o plano engolido passaria a ser recusado
  // por um motivo que não é o motivo, ou pior, aceito se o booleano virar 1.
  assert.match(adaptador, /return recebido\.length;/, 'o adaptador não devolve uma contagem de caracteres');
  assert.doesNotMatch(
    adaptador,
    /return\s+fluxo\.write\(/,
    'o adaptador devolve o booleano de write em vez da contagem de caracteres',
  );
  assert.doesNotMatch(
    adaptador,
    /return\s+(true|false)\s*;/,
    'o adaptador devolve um literal booleano em vez da contagem de caracteres',
  );

  // E o caminho de apply entrega ESSE adaptador ao portão, e não o `write` cru.
  const apply = fatiarFuncao(fonte, /^async function runApply\(/m);
  assert.match(
    apply,
    /write:\s*sinkQueContaCaracteres\(io\.stdout\)/,
    'o caminho de apply não entrega o adaptador que conta ao portão',
  );
  assert.doesNotMatch(
    apply,
    /write:\s*io\.stdout\.write/,
    'o caminho de apply entrega o write cru, que devolve booleano',
  );
  // E o booleano de terminal de saída vem do fluxo de SAÍDA. Ler a entrada duas
  // vezes reabriria exatamente o desvio que a fechadura de saída existe para
  // fechar, e nenhuma outra prova poderia enxergar isso: com os dois fluxos no
  // mesmo estado, a combinação.live-viva / morta-viva é a única que separa os
  // dois casos, e ela só existe aqui.
  assert.match(
    apply,
    /outputIsTTY:\s*io\.stdout\.isTTY === true/,
    'o caminho de apply não lê o booleano de terminal de saída do fluxo de saída',
  );
  assert.doesNotMatch(
    apply,
    /outputIsTTY:\s*io\.stdin\.isTTY/,
    'o caminho de apply lê o booleano de terminal de saída do fluxo de entrada',
  );
});
