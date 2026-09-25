// Suíte de adaptador de produção: dirige a costura de decisão REAL que a CLI
// executa, em vez de um log de chamadas montado à mão.
//
// Roda com: node --test tools/release-close/ (zero dependências, sem rede, sem
// banco, sem relógio). Nomes em PT-BR, como em backend/tests/.
//
// CONVENÇÃO OBRIGATÓRIA — nenhum `describe` neste arquivo, em nenhum momento.
// O node indenta subtestes aninhados na saída TAP, e `check tdd-red-evidence`
// só enxerga um teste-alvo no primeiro nível: um teste dentro de um `describe`
// é invisível para o portão de RED. Os grupos são delimitados por comentários
// de banner. A mesma restrição vale para canary.test.js.
//
// Cada grupo de banner indica a tarefa do plano 09-07 que o possui:
//
//   grupo 1 — tarefa 1: entrypoint importável sem efeito colateral
//   grupo 2 — tarefa 2: construtor de evidência de produção, cinco leituras,
//              CI congelada e contagem medida de mutações
//   grupo 3 — tarefa 3: suíte de adaptador sobre todos os cenários congelados
//
// Nenhuma normalização de evidência é reimplementada aqui. Este arquivo chama o
// construtor exportado ou a entrada exportada e nunca monta contrato de
// classificação por conta própria: foi justamente um helper de teste que
// colapsava os arrays de duplicata e conflito enquanto a suíte ficava verde.

import { it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';

const TOOL_DIR = new URL('./', import.meta.url);
const MODULO = new URL('./release-close.js', import.meta.url).href;
const CLI_PATH = new URL('./release-close.js', import.meta.url).pathname;

// Ambiente do processo filho sem o contexto do runner de teste. Um filho que
// acredita ser subteste de outro processo reporta sucesso sem chegar ao código
// de saída, que é o modo de falha permanente que um guarda de fronteira jamais
// pode ter (o plano 09-06 encontrou exatamente isso no seu próprio canário).
function ambienteDeProcessoLimpo() {
  const env = { ...process.env };
  delete env.NODE_TEST_CONTEXT;
  delete env.NODE_TEST_WORKER_ID;
  return env;
}

function executarProbe(roteiro) {
  return spawnSync(process.execPath, ['--input-type=module', '-e', roteiro], {
    encoding: 'utf8',
    cwd: TOOL_DIR.pathname,
    env: ambienteDeProcessoLimpo(),
  });
}

function rodarCli(args) {
  return spawnSync(process.execPath, [CLI_PATH, ...args], {
    encoding: 'utf8',
    input: '',
    env: ambienteDeProcessoLimpo(),
  });
}

function fonteDoModulo() {
  return readFileSync(new URL('./release-close.js', import.meta.url), 'utf8');
}

function fixture(name) {
  return JSON.parse(readFileSync(new URL(`./fixtures/${name}.json`, import.meta.url), 'utf8'));
}

function ocorrencias(texto, agulha) {
  return texto.split(agulha).length - 1;
}

// Nome da função que envolve um índice do texto. Um `process.stdout` fora de
// qualquer função é um acesso de nível de módulo e é nomeado explicitamente,
// para que o resultado da varredura nunca seja um vazio silencioso.
function funcaoQueContem(texto, indice) {
  const antes = texto.slice(0, indice);
  const encontrados = [...antes.matchAll(/^(?:export\s+)?(?:async\s+)?function\s+([A-Za-z0-9_$]+)/gm)];
  if (encontrados.length === 0) return '<fora de função>';
  return encontrados[encontrados.length - 1][1];
}

// Corpo de uma função declarada, contado por chave. Usado para provar que uma
// guarda está DENTRO de uma função e não ao lado dela — o tipo de afirmação que
// uma regex solta sobre o arquivo inteiro não consegue fazer.
//
// A contagem começa na chave que abre o CORPO, e não na chave de desestruturação
// dos parâmetros: `function f({ a, b }, io) {` tem duas chaves antes do corpo, e
// contar desde a primeira devolveria só a assinatura — uma prova que passa sem
// olhar para nada.
function fatiarFuncao(texto, nome) {
  const inicio = texto.search(new RegExp(`^(?:export\\s+)?(?:async\\s+)?function\\s+${nome}\\s*\\(`, 'm'));
  if (inicio < 0) return '';
  let profundidade = 0;
  let chave = -1;
  for (let i = inicio; i < texto.length; i += 1) {
    if (texto[i] === '(') profundidade += 1;
    else if (texto[i] === ')') {
      profundidade -= 1;
      // Fechou a lista de parâmetros: a próxima chave abre o corpo.
      if (profundidade === 0) {
        chave = texto.indexOf('{', i);
        break;
      }
    }
  }
  if (chave < 0) return '';
  profundidade = 0;
  for (let i = chave; i < texto.length; i += 1) {
    if (texto[i] === '{') profundidade += 1;
    else if (texto[i] === '}') {
      profundidade -= 1;
      if (profundidade === 0) return texto.slice(inicio, i + 1);
    }
  }
  return texto.slice(inicio);
}

function listarFontesNaoTeste(diretorio) {
  const encontradas = [];
  for (const entrada of readdirSync(diretorio)) {
    const completa = join(diretorio, entrada);
    if (statSync(completa).isDirectory()) encontradas.push(...listarFontesNaoTeste(completa));
    else if (entrada.endsWith('.js') && !entrada.endsWith('.test.js')) encontradas.push(completa);
  }
  return encontradas;
}

// Uma varredura de valor tem de olhar CÓDIGO, não prosa: o comentário que
// documenta a remoção do literal verde de CI o nomeia por extenso, e varrer o
// texto bruto acusaria a própria documentação. Retirar os comentários torna a
// guarda mais forte (o valor não pode existir em lugar nenhum do código) em
// vez de mais fraca.
function semComentarios(texto) {
  return texto.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:])\/\/.*$/gm, '$1');
}

// Módulo da CLI com os exports obrigatórios verificados por ASSERÇÃO. Sem esta
// guarda, uma prova que só chama `mod.decide(...)` falha com "not a function",
// que é um erro de sonda e não uma falha que descreva o comportamento faltante.
async function moduloCom(nomes) {
  const mod = await modulo();
  for (const nome of nomes) {
    assert.equal(typeof mod[nome], 'function', `${nome} não é exportado pelo módulo da CLI`);
  }
  return mod;
}

// ===========================================================================
// grupo 1 — tarefa 1: entrypoint importável sem efeito colateral
// ===========================================================================

// Toda prova de importação roda num PROCESSO FILHO, nunca no processo de teste.
// Um `import` estático morreria com `process.exit` e tiraria o runner inteiro:
// o arquivo de teste morreria antes de descobrir qualquer teste, o que é RED
// inválido (descoberta zero), não RED. O filho é quem prova que o processo que
// importou continuou vivo, porque é ele quem imprime a marca depois do import.
const ROTEIRO_IMPORTACAO = `
const capturadoSaida = [];
const capturadoErro = [];
const saidaReal = process.stdout.write.bind(process.stdout);
const erroReal = process.stderr.write.bind(process.stderr);
process.stdout.write = (trecho) => { capturadoSaida.push(String(trecho)); return true; };
process.stderr.write = (trecho) => { capturadoErro.push(String(trecho)); return true; };
const mod = await import(${JSON.stringify(MODULO)});
process.stdout.write = saidaReal;
process.stderr.write = erroReal;
saidaReal(JSON.stringify({
  capturadoSaida,
  capturadoErro,
  exports: Object.keys(mod).sort(),
  runReleaseClose: typeof mod.runReleaseClose,
  buildClosePlan: typeof mod.buildClosePlan,
  renderPlanText: typeof mod.renderPlanText,
}) + '\\n');
`;

it('importar o módulo não imprime nada, não termina o processo e devolve os helpers', () => {
  const resultado = executarProbe(ROTEIRO_IMPORTACAO);
  assert.equal(
    resultado.status,
    0,
    `importar o módulo encerrou o processo importador (status ${resultado.status}): ${resultado.stderr}`,
  );
  assert.notEqual(
    resultado.stdout.trim(),
    '',
    'importar o módulo não devolveu a marca do processo que continuou vivo: a importação terminou o processo ou o silenciou',
  );
  const relato = JSON.parse(resultado.stdout);
  assert.deepEqual(relato.capturadoSaida, [], 'a importação escreveu na saída padrão');
  assert.deepEqual(relato.capturadoErro, [], 'a importação escreveu no fluxo de erro padrão');
  assert.equal(relato.runReleaseClose, 'function', 'a entrada do CLI não é exportada');
  assert.equal(relato.buildClosePlan, 'function', 'o construtor de plano não é exportado');
  assert.equal(relato.renderPlanText, 'function', 'o renderizador de plano não é exportado');
  assert.ok(relato.exports.includes('runReleaseClose'), `exports: ${relato.exports.join(', ')}`);
});

// Cada verbo e cada recusa, dirigidos pela entrada exportada com sinks
// injetados. Se algum renderizador ainda alcançasse o global de fluxo do
// processo, a saída real do filho registraria algo e esta prova acenderia.
//
// A captura é instalada ANTES do import de propósito: é assim que a prova
// distingue "a importação escreveu" de "a entrada com sink escreveu". Sem isso,
// um import que termina o processo deixa o filho morrer no meio da própria
// medição e o pai recebe uma saida ilegível em vez de uma asserção.
const ROTEIRO_SINKS = `
const capturadoSaida = [];
const capturadoErro = [];
const saidaReal = process.stdout.write.bind(process.stdout);
const erroReal = process.stderr.write.bind(process.stderr);
process.stdout.write = (trecho) => { capturadoSaida.push(String(trecho)); return true; };
process.stderr.write = (trecho) => { capturadoErro.push(String(trecho)); return true; };
const mod = await import(${JSON.stringify(MODULO)});

const fora = [];
const sinkSaida = { write: (t) => { fora.push(['saida', String(t)]); return true; } };
const sinkErro = { write: (t) => { fora.push(['erro', String(t)]); return true; } };
const casos = [
  ['--help'],
  ['verify'],
  ['verify', '--json'],
  ['plan'],
  ['plan', '--json'],
  ['apply'],
  ['apply', '--yes'],
  ['verbo-desconhecido'],
  ['--opcao-desconhecida'],
];
const codigos = [];
for (const args of casos) {
  codigos.push(await mod.runReleaseClose(args, {
    stdin: { isTTY: false },
    stdout: sinkSaida,
    stderr: sinkErro,
  }));
}

process.stdout.write = saidaReal;
process.stderr.write = erroReal;
saidaReal(JSON.stringify({ codigos, fora, capturadoSaida, capturadoErro }) + '\\n');
`;

it('a entrada exportada escreve tudo nos sinks injetados e não toca os fluxos do processo', () => {
  const resultado = executarProbe(ROTEIRO_SINKS);
  assert.equal(resultado.status, 0, `probe falhou: ${resultado.stderr}`);
  assert.notEqual(
    resultado.stdout.trim(),
    '',
    'importar o módulo encerrou o processo filho antes de a entrada exportada rodar: a importação ainda tem efeito colateral',
  );
  const relato = JSON.parse(resultado.stdout);
  assert.deepEqual(
    relato.capturadoSaida,
    [],
    'a importação ou a entrada com sinks injetados escreveu no fluxo real do processo',
  );
  assert.deepEqual(
    relato.capturadoErro,
    [],
    'a importação ou a entrada com sinks injetados escreveu no fluxo de erro real do processo',
  );
  assert.deepEqual(
    relato.codigos,
    [0, 0, 0, 0, 0, 1, 1, 2, 2],
    'os códigos de saída mudaram ao passar a entrada exportada',
  );
  const porCaso = new Map();
  for (const [destino, texto] of relato.fora) {
    porCaso.set(destino, (porCaso.get(destino) ?? '') + texto);
  }
  assert.match(porCaso.get('saida') ?? '', /^Uso: node tools\/release-close\/release-close\.js/m);
  assert.match(porCaso.get('erro') ?? '', /--yes/);
  assert.match(porCaso.get('saida') ?? '', /^mutations: 0$/m);
  assert.match(porCaso.get('saida') ?? '', /Passos ordenados/);
  // A recusa por pipe precisa do motivo da fechadura de terminal no fluxo de
  // erro e não pode ter aberto prompt em lugar nenhum.
  assert.match(porCaso.get('erro') ?? '', /terminal interativo/);
  assert.doesNotMatch(porCaso.get('saida') ?? '', /Confirmar o apply/);
});

it('sem verbo a CLI imprime o uso na saída e devolve zero', () => {
  const resultado = rodarCli([]);
  assert.equal(resultado.status, 0, `status ${resultado.status}: ${resultado.stderr}`);
  assert.match(resultado.stdout, /^Uso: node tools\/release-close\/release-close\.js/m);
  assert.equal(resultado.stderr, '');
});

it('verbo desconhecido devolve dois com o uso no fluxo de erro', () => {
  const resultado = rodarCli(['verbo-desconhecido']);
  assert.equal(resultado.status, 2, `status ${resultado.status}: ${resultado.stderr}`);
  assert.match(resultado.stderr, /Verbo desconhecido: verbo-desconhecido/);
  assert.match(resultado.stderr, /^Uso: node tools\/release-close\/release-close\.js/m);
  assert.equal(resultado.stdout, '');
});

it('verify no baseline congelado devolve zero e não escreve no fluxo de erro', () => {
  const resultado = rodarCli(['verify']);
  assert.equal(resultado.status, 0, `status ${resultado.status}: ${resultado.stderr}`);
  assert.match(resultado.stdout, /^Elegibilidade de tag v0\.1\.1: ELEGÍVEL$/m);
  assert.equal(resultado.stderr, '');
});

it('a fonte não termina o processo, não escreve nos fluxos do processo e só roda o verbo como entrada', () => {
  const fonte = fonteDoModulo();
  assert.doesNotMatch(
    fonte,
    /\bprocess\.exit\s*\(/,
    'release-close.js chama process.exit: um importador seria terminado',
  );
  assert.doesNotMatch(
    fonte,
    /process\.stdout\.write|process\.stderr\.write/,
    'release-close.js escreve direto no fluxo global do processo em vez do sink injetado',
  );
  assert.match(fonte, /if \(ehScriptDeEntrada\(\)\)/, 'a invocação da CLI não está atrás da guarda de entrada');
  assert.match(fonte, /process\.exitCode = /, 'a saída da entrada não é atribuída a process.exitCode');
  assert.doesNotMatch(fonte, /^const .* = await /m, 'há uma invocação de CLI no nível de topo do módulo');
  assert.doesNotMatch(fonte, /^await /m, 'há um await no nível de topo do módulo fora da guarda');

  // Todo acesso a process.stdout / process.stderr tem de estar na função que
  // resolve os fluxos padrão. Qualquer outro ponto de uso é um renderizador
  // alcançando o global, que é exatamente o que a tarefa proíbe.
  const donos = new Set();
  for (const achado of fonte.matchAll(/process\.(stdout|stderr)/g)) {
    donos.add(funcaoQueContem(fonte, achado.index));
  }
  assert.deepEqual(
    [...donos],
    ['fluxosPadrao'],
    `acesso a process.stdout/process.stderr fora da resolução dos fluxos padrão, em: ${[...donos].join(', ')}`,
  );
  assert.ok(
    ocorrencias(fonte, 'process.argv') <= 2,
    'release-close.js lê process.argv mais de duas vezes: importador e entrada não podem compartilhar a leitura',
  );
});

// ===========================================================================
// grupo 2 — tarefa 2: construtor de evidência de produção, cinco leituras,
//           CI congelada e contagem medida de mutações
// ===========================================================================

// O módulo da CLI é importado por dentro de cada prova, nunca no topo do
// arquivo. Depois da tarefa 1 isso é seguro e é o modo como um consumidor a
// jusante usaria o módulo; além disso mantém a propriedade de que uma
// regressão na segurança da importação não derruba o runner inteiro e vira
// descoberta zero — que é RED inválido, não RED.
async function modulo() {
  return import('./release-close.js');
}

// A ordem fixa das cinco leituras declaradas: ref, objeto da tag, cabeça do
// branch, release e milestones. A asserção da suíte de elegibilidade depende
// das três primeiras continuarem nesta ordem e por primeiro.
const ORDEM_DAS_LEITURAS = [
  'getTagRef',
  'getTagObject',
  'getBranchHead',
  'getReleaseByTag',
  'listMilestones',
];

// Snapshot no formato do cliente para um estado: as três leituras de tag e de
// main são o baseline imutável e só as cargas de release e milestone variam
// por estado. Nenhum SHA, identificador de execução ou texto é digitado à mão —
// tudo vem dos fixtures congelados (D-08).
function snapshotDoEstado(nome) {
  const base = fixture('reference');
  const estado = fixture(nome);
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

function referencia() {
  return snapshotDoEstado('missing');
}

function referenciaCom(alteracoes) {
  return { ...referencia(), ...alteracoes };
}

function envelope(registros) {
  return registros.length === 0
    ? { ok: false, status: 404, data: null }
    : { ok: true, status: 200, data: registros };
}

function ids(detalhes) {
  return detalhes.map((registro) => registro.id);
}

function numeros(detalhes) {
  return detalhes.map((registro) => registro.number);
}

// Duas milestones que NOMEIAM a versão pedida. Nenhum fixture congelado traz
// duas de uma vez, e digitar um número à mão seria valor que o repositório não
// possui (D-08). A segunda é derivada da primeira mudando só o identificador, o
// que é exatamente a mutação que a partição de alvo precisa enxergar.
function duasMilestonesDoAlvo() {
  const [unica] = fixture('complete').milestones;
  return [unica, { ...unica, number: unica.number + 1 }];
}

async function decidirSobre(snapshot, mod) {
  const client = (await import('./fake-client.js')).makeFakeClient(snapshot);
  const decisao = await mod.decide({
    client,
    version: snapshot.version,
    expectedSha: snapshot.expectedSha,
    ci: snapshot.ci,
  });
  return { client, decisao };
}

function planoDo(mod, snapshot, decisao) {
  return mod.buildClosePlan({
    version: snapshot.version,
    expectedSha: snapshot.expectedSha,
    snapshot,
    eligibility: decisao.eligibility,
    classificacao: decisao.classification,
    mutations: decisao.mutations,
  });
}

// --- construtor de evidência de produção ------------------------------------

it('o construtor de evidência de produção é exportado e monta as cinco chaves com a fonte nomeada de cada valor', async () => {
  const mod = await moduloCom(['buildCloseEvidence']);
  const base = referencia();
  const evidencia = mod.buildCloseEvidence({
    version: base.version,
    expectedSha: base.expectedSha,
    ci: base.ci,
    release: base.release,
    milestones: base.milestones,
  });
  assert.deepEqual(Object.keys(evidencia).sort(), [
    'ci',
    'closeMarkers',
    'milestones',
    'releases',
    'target',
  ]);
  assert.deepEqual(evidencia.target, { version: base.version, expectedSha: base.expectedSha });
  assert.deepEqual(evidencia.ci, base.ci, 'o bloco ci não atravessou byte a byte');
  assert.deepEqual(evidencia.releases, [], 'a release ausente virou registro');
  assert.deepEqual(evidencia.milestones, []);
  assert.deepEqual(evidencia.closeMarkers, []);
});

it('o construtor de evidência retém os dois registros de release e os dois números de milestone', async () => {
  const mod = await moduloCom(['buildCloseEvidence']);
  const base = referencia();
  const releases = fixture('duplicate').releases;
  const [alvo, segunda] = duasMilestonesDoAlvo();
  const evidencia = mod.buildCloseEvidence({
    version: base.version,
    expectedSha: base.expectedSha,
    ci: base.ci,
    release: envelope(releases),
    milestones: envelope([alvo, segunda]),
  });
  assert.deepEqual(
    evidencia.releases.map((registro) => registro.id),
    [9001, 9002],
    'registros de release colapsados num só',
  );
  assert.deepEqual(
    evidencia.milestones.map((registro) => registro.number),
    [alvo.number, segunda.number],
    'a lista de milestones foi colapsada no primeiro registro',
  );
});

it('o construtor de evidência nunca inventa um bloco ci ausente', async () => {
  const mod = await moduloCom(['buildCloseEvidence', 'decide']);
  const base = referencia();
  const evidencia = mod.buildCloseEvidence({
    version: base.version,
    expectedSha: base.expectedSha,
    ci: undefined,
    release: base.release,
    milestones: base.milestones,
  });
  assert.equal(
    evidencia.ci,
    undefined,
    'o construtor de evidência inventou um bloco ci padrão: um estado verde não é valor que a ferramenta construa',
  );
  // E o caminho de decisão leva a recusa até o fim: a violação de contrato do
  // classificador aparece como entrada inválida, nunca como execução verde.
  const snapshot = referenciaCom({ ci: undefined });
  await assert.rejects(
    () => decidirSobre(snapshot, mod),
    (erro) =>
      erro instanceof TypeError && /bloco ci ausente/.test(erro.message),
    'a ausência de ci não surfaceou como a recusa de entrada inválida existente',
  );
});

// --- cinco leituras na ordem fixa -------------------------------------------

it('a decisão de produção executa as cinco leituras declaradas na ordem fixa, com sequência de um a cinco', async () => {
  const mod = await moduloCom(['decide']);
  const base = referencia();
  const { client, decisao } = await decidirSobre(base, mod);
  assert.deepEqual(
    client.calls.map((chamada) => chamada.method),
    ORDEM_DAS_LEITURAS,
    'a decisão de produção não percorreu as cinco leituras declaradas na ordem fixa',
  );
  assert.deepEqual(
    client.calls.map((chamada) => chamada.seq),
    [1, 2, 3, 4, 5],
  );
  assert.equal(client.mutations, 0, 'a leitura observa mutação onde não há escrita');
  assert.equal(decisao.eligibility.code, 'ELIGIBLE');
  assert.equal(decisao.classification.code, 'MISSING');
  assert.equal(decisao.classification.writeAction, null);
  assert.equal(decisao.eligibility.writeAction, null);
});

it('o caminho de produção classifica a duplicata com os dois identificadores retidos', async () => {
  const mod = await moduloCom(['decide']);
  const { decisao } = await decidirSobre(snapshotDoEstado('duplicate'), mod);
  assert.equal(decisao.classification.code, 'DUPLICATE');
  assert.deepEqual(ids(decisao.classification.releases), [9001, 9002]);
  assert.equal(decisao.classification.writeAction, null);
});

it('o caminho de produção classifica o conflito com os dois identificadores retidos', async () => {
  const mod = await moduloCom(['decide']);
  const { decisao } = await decidirSobre(snapshotDoEstado('conflicting'), mod);
  assert.equal(decisao.classification.code, 'CONFLICTING');
  assert.deepEqual(ids(decisao.classification.releases), [9001, 9003]);
  assert.equal(decisao.classification.writeAction, null);
});

it('o escopo de alvo nomeia só os registros do alvo e retém os alheios', async () => {
  const mod = await moduloCom(['decide']);
  // Release PUBLICADA do alvo ao lado de releases de outras versões. Um
  // rascunho cairia no ramo de PARTIAL por rascunho, cujo motivo nomeia a tag e
  // não a versão pedida — e o caso que a tarefa descreve é o de registros de
  // outras versões convivendo com o registro do alvo.
  const alvo = fixture('complete').releases[0];
  const alheios = fixture('unrelated').releases;
  const { decisao } = await decidirSobre(
    referenciaCom({ release: envelope([alvo, ...alheios]) }),
    mod,
  );
  assert.equal(decisao.classification.code, 'PARTIAL');
  assert.deepEqual(ids(decisao.classification.releases), [alvo.id]);
  assert.deepEqual(ids(decisao.classification.unrelatedReleases), alheios.map((r) => r.id));
  assert.match(decisao.classification.reason, /versão pedida/);
  for (const alheio of alheios) {
    assert.doesNotMatch(
      decisao.classification.reason,
      new RegExp(alheio.tagName.replace(/\./g, '\\.')),
      `o motivo nomeia o registro alheio ${alheio.tagName}`,
    );
  }
});

it('o escopo de alvo retém os dois números de milestone que nomeiam a versão pedida', async () => {
  const mod = await moduloCom(['decide']);
  const [alvo, segunda] = duasMilestonesDoAlvo();
  const { decisao } = await decidirSobre(
    referenciaCom({ milestones: envelope([alvo, segunda]) }),
    mod,
  );
  assert.deepEqual(
    numeros(decisao.classification.milestones),
    [alvo.number, segunda.number],
    'uma das milestones do alvo foi descartada',
  );
  assert.deepEqual(decisao.classification.unrelatedMilestones, []);
});

// --- CI congelada, nunca sintetizada ----------------------------------------

it('a CI congelada atravessa o classificador sem ser reconstruída e sem bloquear o baseline', async () => {
  const mod = await moduloCom(['decide']);
  const base = referencia();
  const { decisao } = await decidirSobre(base, mod);
  assert.deepEqual(decisao.ci, base.ci, 'o bloco ci não é o bloco congelado do snapshot');
  assert.deepEqual(decisao.evidence.ci, fixture('reference').ci);
  assert.notEqual(decisao.classification.code, 'FAILED');
  assert.equal(decisao.classification.ciCode, null);
});

it('uma conclusão cancelada na evidência congelada bloqueia com a família nomeada e libera zero', async () => {
  const mod = await moduloCom(['decide', 'buildClosePlan']);
  const base = referencia();
  const ci = structuredClone(base.ci);
  ci.records[0].conclusion = 'cancelled';
  const snapshot = referenciaCom({ ci });
  const { decisao } = await decidirSobre(snapshot, mod);
  assert.equal(decisao.classification.code, 'FAILED');
  assert.equal(decisao.classification.ciCode, 'CI-CANCELLED');
  const plano = planoDo(mod, snapshot, decisao);
  assert.equal(plano.applyLiberado, false, 'uma CI cancelada liberou o apply');
  // A família é nomeada pelo campo `ciCode` da decisão, atravessado no plano. O
  // texto PT-BR do bloqueio (`estado FAILED: …`) é a redação que o plano 09-03
  // fixou e não é alterada aqui; a família em EN estável é o `ciCode`.
  assert.equal(plano.classificacao.ciCode, 'CI-CANCELLED');
  assert.match(plano.bloqueio, /^estado FAILED: /);
  assert.match(plano.bloqueio, /concluiu como cancelled/);
});

it('o no-op concluído aparece como o par exato MISSING e COMPLETE_NOOP e ainda assim libera apply', async () => {
  const mod = await moduloCom(['decide', 'buildClosePlan']);
  const snapshot = snapshotDoEstado('complete');
  const { decisao } = await decidirSobre(snapshot, mod);
  assert.equal(decisao.classification.code, 'MISSING');
  assert.equal(decisao.classification.outcome, 'COMPLETE_NOOP');
  const plano = planoDo(mod, snapshot, decisao);
  assert.equal(plano.classificacao.code, 'MISSING');
  assert.equal(plano.classificacao.outcome, 'COMPLETE_NOOP');
  // MISSING não é um dos códigos bloqueantes: `applyLiberado` significa tag
  // elegível sem estado bloqueante, e o alvo JÁ está fechado. Esse nome não é
  // re-derivado em nenhum outro lugar da fase.
  assert.equal(plano.applyLiberado, true);
  assert.equal(plano.bloqueio, null);
});

// --- contagem medida de mutações --------------------------------------------

it('a contagem relatada é a contagem medida do cliente e nunca um literal', async () => {
  const mod = await moduloCom(['decide', 'buildClosePlan']);
  const base = referencia();
  const { client, decisao } = await decidirSobre(base, mod);
  assert.equal(decisao.mutations, client.mutations, 'a decisão relativisticamente zero em vez de medir');
  const plano = planoDo(mod, base, decisao);
  assert.equal(plano.mutations, client.mutations, 'o plano carrega um literal em vez da medição');
  assert.match(mod.renderPlanText(plano), /^mutations: 0$/m);

  const json = JSON.parse(rodarCli(['plan', '--json']).stdout);
  assert.equal(typeof json.mutations, 'number', 'o plano json não carrega a contagem medida');
  assert.equal(json.mutations, 0);
  assert.deepEqual(json.target, { version: base.version, expectedSha: base.expectedSha });
  assert.deepEqual(json.evidencia.ci, fixture('reference').ci);
  assert.ok(Array.isArray(json.classificacao.releases), 'a lista de identificadores retidos não chegou ao JSON');
  assert.ok(Array.isArray(json.classificacao.milestones));
  assert.ok(Array.isArray(json.classificacao.unrelatedReleases));
  assert.ok(Array.isArray(json.classificacao.unrelatedMilestones));

  const fonte = fonteDoModulo();
  const implementacao = fonte.slice(fonte.indexOf('function usageError'));
  assert.doesNotMatch(
    implementacao,
    /mutations:\s*0\b/,
    'a implementação ainda escreve um literal de contagem de mutações',
  );
  assert.doesNotMatch(implementacao, /mutations\s*=\s*0\b/, 'a implementação ainda fixa a contagem em zero');
});

it('uma contagem medida diferente de zero recusa a execução com o motivo do invariante compartilhado', async () => {
  const mod = await moduloCom(['decide']);
  const { makeArmedFakeClient } = await import('./fake-client.js');
  const base = referencia();
  const client = makeArmedFakeClient(base);
  // A armadilha REGISTRA e nunca age: o que se prova é a recusa da medição, não
  // uma escrita remota.
  client.trap('criarReleaseRemota', ['v0.1.1']);
  assert.equal(client.mutations, 1, 'a armadilha armada não produziu contagem medida');

  // Família do efeito escapado: contagem válida e diferente de zero.
  await assert.rejects(
    () =>
      mod.decide({
        client,
        version: base.version,
        expectedSha: base.expectedSha,
        ci: base.ci,
      }),
    (erro) =>
      erro instanceof Error &&
      /contador de mutações medido = 1/.test(erro.message) &&
      /Nenhuma decisão prossegue/.test(erro.message) &&
      /criarReleaseRemota/.test(erro.message),
    'a contagem medida diferente de zero não recusou com o motivo do invariante compartilhado',
  );

  // Família da medição corrompida: nunca reportada como escape, porque as duas
  // pedem ações opostas do operador. A asserção é sobre a FAMÍLIA da recusa, não
  // sobre a redação: um registro que existe mas não traz contador e um registro
  // que não existe são o mesmo defeito de leitura, e as duas palavras do
  // invariante ("ausente" e "inválida") descrevem essa família.
  const semMedicao = Object.freeze({
    getTagRef: () => {},
    getTagObject: () => {},
    getBranchHead: () => {},
    getReleaseByTag: () => {},
    listMilestones: () => {},
  });
  await assert.rejects(
    () =>
      mod.decide({
        client: semMedicao,
        version: base.version,
        expectedSha: base.expectedSha,
        ci: base.ci,
      }),
    (erro) =>
      erro instanceof Error &&
      /Medição de mutações (ausente|inválida)/.test(erro.message) &&
      !/Efeito remoto escapou/.test(erro.message),
    'a medição ausente não recusou como medição corrompida, ou foi reportada como escape',
  );
});

it('o invariante compartilhado roda na decisão, antes de qualquer renderização', async () => {
  const mod = await moduloCom(['decide']);
  const fonte = fonteDoModulo();
  // O invariante compartilhado é chamado por um INVOLUCRO de módulo (a
  // medição), e é essa função que a decisão precisa chamar. A ligação é
  // resolvida estruturalmente — quem envolve a chamada a `assertNoMutation` —
  // em vez de por nome literal, para que a prova não dependa de como a medição
  // foi batizada e continue valendo quando o plano 09-08 reformatar o módulo.
  const chamadorDoInvariante = funcaoQueContem(fonte, fonte.indexOf('assertNoMutation('));
  assert.notEqual(
    chamadorDoInvariante,
    '<fora de função>',
    'o invariante compartilhado é chamado no nível de topo do módulo, e não dentro da medição',
  );
  const corpoDaDecisao = fatiarFuncao(fonte, 'decide');
  assert.match(
    corpoDaDecisao,
    new RegExp(`\\b${chamadorDoInvariante}\\(`),
    `a decisão de produção não chama ${chamadorDoInvariante}, que é quem valida a contagem medida`,
  );
  assert.doesNotMatch(
    corpoDaDecisao,
    /renderJson\(|renderPlanText\(|renderVerify/,
    'a decisão de produção renderiza: o invariante precisa vir antes de qualquer render',
  );
  for (const verbo of ['runVerify', 'runPlan', 'runApply']) {
    const corpo = fatiarFuncao(fonte, verbo);
    const posDecisao = corpo.indexOf('await decide(');
    const posPrimeiroRender = ['renderJson(', 'renderPlanText(', 'renderVerifyText(', 'renderVerifyJson(']
      .map((chamada) => corpo.indexOf(chamada))
      .filter((posicao) => posicao >= 0)
      .sort((a, b) => a - b)[0];
    assert.ok(posDecisao >= 0, `${verbo} não roda a decisão de produção`);
    assert.ok(
      posDecisao < posPrimeiroRender,
      `${verbo} renderiza antes de a decisão de produção medir a contagem de mutações`,
    );
  }
});

it('nenhuma fonte não-teste do tool island sintetiza um estado verde de CI', () => {
  const fontes = listarFontesNaoTeste(TOOL_DIR.pathname);
  for (const arquivo of fontes) {
    const texto = semComentarios(readFileSync(arquivo, 'utf8'));
    assert.doesNotMatch(
      texto,
      /state:\s*['"]success['"]|conclusion:\s*['"]success['"]|checks:\s*\{/,
      `${arquivo} sintetiza um estado verde de CI a partir de identificadores de execução`,
    );
  }
});

