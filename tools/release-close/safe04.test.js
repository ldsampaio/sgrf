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

const NOMES_FIXTURE = [
  'reference',
  'missing',
  'partial',
  'duplicate',
  'conflicting',
  'failed',
  'concurrent',
];

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

function evidenceFromSnapshot(snapshot) {
  if (!snapshot.milestones || !snapshot.milestones.ok) {
    throw new TypeError('Snapshot de cliente inválido: milestones ausente.');
  }
  const milestones = snapshot.milestones.data;
  const release = snapshot.release && snapshot.release.ok ? snapshot.release.data : null;
  return {
    target: { version: snapshot.version, expectedSha: snapshot.expectedSha },
    ci: snapshot.ci,
    releases: release ? [release] : [],
    milestones: Array.isArray(milestones) ? [...milestones] : [],
    closeMarkers: [],
  };
}

// Discriminador de forma: o ÚNICO literal que separa as duas formas declaradas
// nesta fase é `Array.isArray(snapshot.milestones)` — true é evidência plana de
// classificação, false é snapshot de cliente cujo `milestones` é um envelope
// `ok`. Nunca discrimine por `target` ou `ci`: o fixture de referência é
// formato de cliente e carrega os dois blocos, então usá-los como marca de
// evidência plana o rotearia pelo caminho errado.
//
// Temporário: a tarefa 3 do plano 09-08 apaga este helper e o `evidenceFromSnapshot`
// junto, no lugar do construtor de cinco leituras de produção.
function evidenciaDe(fixtureCarregado) {
  return Array.isArray(fixtureCarregado.milestones)
    ? fixtureCarregado
    : evidenceFromSnapshot(fixtureCarregado);
}

// Snapshot no formato do cliente para um fixture de estado: as três leituras de
// tag e main são o baseline imutável (o mesmo v0.1.1 em todos os estados) e
// só as leituras de release e milestone variam por estado. Os campos migrados
// `releases` e `milestones` são lidos das listas, nunca dos campos singulares
// removidos.
function clientSnapshotFor(estado) {
  const base = fixture('reference');
  const release = Array.isArray(estado.releases) ? estado.releases[0] ?? null : null;
  const milestones = Array.isArray(estado.milestones) ? estado.milestones : [];
  return {
    version: estado.version,
    expectedSha: estado.expectedSha,
    tagRef: base.tagRef,
    tagObject: base.tagObject,
    branchHead: base.branchHead,
    release: release
      ? { ok: true, status: 200, data: release }
      : { ok: false, status: 404, data: null },
    milestones: { ok: true, status: 200, data: milestones },
    ci: estado.ci ?? base.ci,
    runs: estado.runs ?? base.runs,
  };
}

// Roda os dois contratos puros sobre um único cliente fake (as mesmas leituras
// que verify e plan fazem) e devolve as decisões junto do contador real de
// escritas do fake.
async function runContractsOver(fake, fixtureCarregado) {
  const elegibilidade = await checkTagEligibility(fake, {
    version: fixtureCarregado.version,
    expectedSha: fixtureCarregado.expectedSha,
  });
  const classificacao = classifySnapshot(evidenciaDe(fixtureCarregado));
  return {
    elegibilidade,
    classificacao,
    // O valor emitido é o contador real do fake, não um literal: zero escritas
    // implica zero mutações, executavelmente.
    mutations: fake.mutations,
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
    for (const nome of NOMES_FIXTURE) {
      const carregado = fixture(nome);
      const fake = makeFakeClient(clientSnapshotFor(carregado));
      const saida = await runContractsOver(fake, carregado);
      assert.equal(fake.writes.length, 0, `${nome} deixou escape de escrita`);
      assert.equal(saida.mutations, 0, `${nome} emitiu mutações diferentes de zero`);
      assert.equal(saida.elegibilidade.writeAction, null, `${nome} carregou writeAction`);
      assert.equal(saida.classificacao.writeAction, null, `${nome} carregou writeAction`);
      if (nome === 'reference') {
        // O baseline de referência é o único que chega ao classificador pelo
        // caminho normalizado de produção, então é o único aqui que pode
        // carregar o código exato. Os outros seis ainda passam por um helper
        // local que colapsa os arrays de duplicata e conflito, e afirmar
        // códigos exatos neles falharia até a tarefa 3 do plano 09-08 trocar
        // esse helper pelo construtor de produção.
        assert.equal(saida.classificacao.code, 'MISSING');
        assert.equal(saida.classificacao.eligible, false);
        assert.ok(saida.classificacao.reason.length > 0, `${nome} sem motivo PT-BR`);
      } else {
        assert.equal(typeof saida.classificacao.code, 'string', `${nome} sem código de estado`);
      }
    }
  });

  it('a verificação em texto e em json carrega o contador mutations 0', () => {
    const texto = runCli(['verify']);
    assert.match(texto, /^mutations: 0$/m);
    const json = JSON.parse(runCli(['verify', '--json']));
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
      const json = JSON.parse(runCli([verbo, '--json']));
      assert.equal(typeof json.mutations, 'number', `${verbo} sem campo mutations`);
      assert.equal(json.mutations, 0, `${verbo} com mutações`);
      const decisao = json.elegibilidade ?? json;
      assert.equal(typeof decisao.code, 'string', `${verbo} sem decisão`);
      assert.equal(decisao.writeAction, null, `${verbo} carregou writeAction`);
    }
    const verify = JSON.parse(runCli(['verify', '--json']));
    const plan = JSON.parse(runCli(['plan', '--json']));
    assert.equal(verify.code, 'ELIGIBLE');
    assert.equal(plan.elegibilidade.code, 'ELIGIBLE');
    // A decisão embutida no plano é a mesma que verify emite; o contador
    // mutations vive no topo de cada saída.
    const { mutations: _contador, ...decisaoDoVerify } = verify;
    assert.deepEqual(plan.elegibilidade, decisaoDoVerify);
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
    const verify = JSON.parse(runCli(['verify', '--json']));
    const plan = JSON.parse(runCli(['plan', '--json']));
    assert.equal(plan.elegibilidade.code, verify.code);
    assert.equal(plan.elegibilidade.reason, verify.reason);
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
      runCli(['verify']),
      runCli(['verify', '--json']),
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

it('toda recusa antes do render nomeia a primeira fechadura que falhou e deixa o sink intocado', async () => {
  const { reviewed, reviewedDigest } = await revisadoComDigest();
  const base = {
    yesFlag: true,
    isTTY: true,
    outputIsTTY: true,
    planText: PLANO_DE_EXEMPLO,
    reviewed,
    reviewedDigest,
    ask: async () => CONFIRMATION_WORD,
    write: () => PLANO_DE_EXEMPLO.length,
  };
  const familia = [
    ['plan', { ...base, planText: '   ' }],
    ['flag', { ...base, yesFlag: false }],
    ['tty', { ...base, isTTY: false }],
    ['output', { ...base, outputIsTTY: false }],
    ['sink', { ...base, write: undefined }],
    ['content', { ...base, reviewed: { ...CONTEUDO_REVISADO, releaseNotes: '' } }],
  ];
  for (const [fechadura, entrada] of familia) {
    const eventos = [];
    const montar = {
      ...entrada,
      ask: async () => {
        eventos.push('pergunta');
        return CONFIRMATION_WORD;
      },
    };
    // A família de sink é a ÚNICA cuja recusa não pode ser observada por um sink
    // gravador: o sink é justamente o que falta. Nesses casos o sink gravador
    // NÃO é instalado, e a única coisa observável é que nada foi perguntado.
    if (entrada.write !== undefined) {
      montar.write = (texto) => {
        eventos.push(`plano:${texto}`);
        return typeof texto === 'string' ? texto.length : 0;
      };
    }
    const resultado = await confirmApply(montar);
    assert.equal(resultado.confirmed, false, `fechadura ${fechadura} confirmou`);
    assert.equal(resultado.lock, fechadura, `fechadura esperada ${fechadura}, recebida ${resultado.lock}`);
    assert.deepEqual(eventos, [], `fechadura ${fechadura} tocou o sink ou a pergunta`);
  }
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
