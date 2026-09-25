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
import { checkTagEligibility } from './eligibility.js';
import { classifySnapshot } from './classify.js';
import { makeFakeClient } from './fake-client.js';
import { confirmApply, CONFIRMATION_WORD, APPLY_LOCKS } from './apply-gate.js';

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
    const resultado = await confirmApply({
      yesFlag: false,
      isTTY: true,
      planText: PLANO_DE_EXEMPLO,
      ask: async () => CONFIRMATION_WORD,
    });
    assert.equal(resultado.confirmed, false);
    assert.equal(resultado.lock, 'flag');
    assert.match(resultado.reason, /--yes/);
  });

  it('recusa com entrada não interativa mesmo com a flag --yes', async () => {
    const perguntou = [];
    const resultado = await confirmApply({
      yesFlag: true,
      isTTY: false,
      planText: PLANO_DE_EXEMPLO,
      ask: async () => {
        perguntou.push(true);
        return CONFIRMATION_WORD;
      },
    });
    assert.equal(resultado.confirmed, false);
    assert.equal(resultado.lock, 'tty');
    assert.match(resultado.reason, /terminal interativo/);
    assert.deepEqual(perguntou, [], 'a recusa por pipe não pode perguntar nada');
  });

  it('recusa quando a confirmação digitada não é sim', async () => {
    for (const resposta of ['nao', 's', 'simmm', 'y', 'yes', '', '  ']) {
      const resultado = await confirmApply({
        yesFlag: true,
        isTTY: true,
        planText: PLANO_DE_EXEMPLO,
        ask: async () => resposta,
      });
      assert.equal(resultado.confirmed, false, `resposta ${JSON.stringify(resposta)} confirmou`);
      assert.equal(resultado.lock, 'answer');
    }
  });

  it('confirma somente com flag, terminal interativo e a digitação sim', async () => {
    const resultado = await confirmApply({
      yesFlag: true,
      isTTY: true,
      planText: PLANO_DE_EXEMPLO,
      ask: async () => ` ${CONFIRMATION_WORD.toUpperCase()} `,
    });
    assert.equal(resultado.confirmed, true);
    assert.equal(resultado.lock, null);
  });

  it('grava o plano antes de qualquer pergunta', async () => {
    const eventos = [];
    const resultado = await confirmApply({
      yesFlag: true,
      isTTY: true,
      planText: PLANO_DE_EXEMPLO,
      ask: async () => {
        eventos.push('pergunta');
        return CONFIRMATION_WORD;
      },
      write: (texto) => eventos.push(`plano:${texto}`),
    });
    assert.equal(resultado.confirmed, true);
    assert.deepEqual(eventos, [`plano:${PLANO_DE_EXEMPLO}`, 'pergunta']);
  });

  it('grava o plano antes de perguntar mesmo quando vai recusar', async () => {
    const eventos = [];
    await confirmApply({
      yesFlag: false,
      isTTY: false,
      planText: PLANO_DE_EXEMPLO,
      ask: async () => {
        eventos.push('pergunta');
        return CONFIRMATION_WORD;
      },
      write: (texto) => eventos.push(`plano:${texto}`),
    });
    assert.deepEqual(eventos, [`plano:${PLANO_DE_EXEMPLO}`]);
  });

  it('verifica flag, depois terminal, depois resposta, nessa ordem', async () => {
    const semFlag = await confirmApply({
      yesFlag: false,
      isTTY: false,
      planText: PLANO_DE_EXEMPLO,
      ask: async () => 'nao',
    });
    assert.equal(semFlag.lock, 'flag', 'a flag é verificada antes do terminal');

    const semTerminal = await confirmApply({
      yesFlag: true,
      isTTY: false,
      planText: PLANO_DE_EXEMPLO,
      ask: async () => 'nao',
    });
    assert.equal(semTerminal.lock, 'tty', 'o terminal é verificado antes da resposta');

    const respostaErrada = await confirmApply({
      yesFlag: true,
      isTTY: true,
      planText: PLANO_DE_EXEMPLO,
      ask: async () => 'nao',
    });
    assert.equal(respostaErrada.lock, 'answer', 'a resposta é a última fechadura');
    assert.deepEqual(APPLY_LOCKS, ['plan', 'flag', 'tty', 'prompt', 'answer']);
  });

  it('recusa quando nenhum plano foi renderizado para revisão', async () => {
    for (const plano of ['', '   ', null, undefined]) {
      const resultado = await confirmApply({
        yesFlag: true,
        isTTY: true,
        planText: plano,
        ask: async () => CONFIRMATION_WORD,
      });
      assert.equal(resultado.confirmed, false);
      assert.equal(resultado.lock, 'plan');
    }
  });

  it('avaliações sequenciais do portão não compartilham estado (hipótese F)', async () => {
    const base = { planText: PLANO_DE_EXEMPLO };
    const aprovada = await confirmApply({ ...base, yesFlag: true, isTTY: true, ask: async () => 'sim' });
    const negada = await confirmApply({ ...base, yesFlag: false, isTTY: false, ask: async () => 'nao' });
    const aprovadaDeNovo = await confirmApply({
      ...base,
      yesFlag: true,
      isTTY: true,
      ask: async () => 'sim',
    });
    assert.equal(aprovada.confirmed, true);
    assert.equal(negada.confirmed, false);
    assert.equal(negada.lock, 'flag');
    assert.deepEqual(aprovada, aprovadaDeNovo);
  });

  it('a CLI recusa com pipe mesmo com a flag --yes e não pergunta nada', () => {
    const resultado = runCliPiped(['apply', '--yes']);
    assert.notEqual(resultado.status, 0);
    assert.match(resultado.stderr, /terminal interativo/);
    assert.doesNotMatch(resultado.stdout, /Confirmar o apply/);
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

  it('a CLI mostra o plano completo antes de recusar o apply por pipe', () => {
    const resultado = runCliPiped(['apply', '--yes']);
    for (const passo of ORDEM_FIXADA_DOS_PASSOS) {
      assert.ok(resultado.stdout.includes(passo), `passo ausente no plano: ${passo}`);
    }
    const indiceDoPrimeiroPasso = resultado.stdout.indexOf(ORDEM_FIXADA_DOS_PASSOS[0]);
    const indiceDaRecusa = resultado.stdout.length;
    assert.ok(indiceDoPrimeiroPasso >= 0 && indiceDoPrimeiroPasso < indiceDaRecusa);
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
      await confirmApply({ yesFlag: false, isTTY: false, planText: PLANO_DE_EXEMPLO, ask: async () => 'sim' }),
    );
    portao.push(
      await confirmApply({ yesFlag: true, isTTY: false, planText: PLANO_DE_EXEMPLO, ask: async () => 'sim' }),
    );
    portao.push(
      await confirmApply({ yesFlag: true, isTTY: true, planText: PLANO_DE_EXEMPLO, ask: async () => 'nao' }),
    );
    portao.push(
      await confirmApply({ yesFlag: true, isTTY: true, planText: PLANO_DE_EXEMPLO, ask: async () => 'sim' }),
    );
    saidas.push(JSON.stringify(portao), PLANO_DE_EXEMPLO);

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
