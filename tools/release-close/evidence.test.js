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
import { readFileSync } from 'node:fs';
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
