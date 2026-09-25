#!/usr/bin/env node
// release-close: ferramenta do operador (verify / plan / apply).
//
// Invocação: node tools/release-close/release-close.js <verify|plan|apply> ...
// Zero dependências, ESM. `verify` e `plan` servem o fixture de referência via
// fake-client e são somente-leitura: ambos carregam o contador `mutations`.
// `apply` renderiza o plano ordenado (previsão da ordem de recuperação da
// Fase 11), entrega o texto ao portão de dupla trava (apply-gate.js) e falha
// fechado — nenhum caminho de escrita remota existe nesta fase.
//
// A ferramenta nunca abre subprocesso, nunca lê variáveis de ambiente de
// credencial e nunca registra cabeçalhos — a saída limita-se aos campos da
// decisão, ao plano ordenado e ao contador mutations.
//
// Importar este módulo é seguro e sem efeito colateral: a CLI só roda no caso
// de script de entrada, e nesse caso o código de saída é atribuído a
// `process.exitCode` em vez de terminar o processo. Um `process.exit`
// truncaria a saída em buffer nos caminhos com pipe que a suíte SAFE-04
// exercita, além de matar qualquer importador (WR-04).

import { readFileSync, realpathSync } from 'node:fs';
import { createInterface } from 'node:readline';
import { pathToFileURL } from 'node:url';
import { checkTagEligibility } from './eligibility.js';
import { classifySnapshot } from './classify.js';
import { makeFakeClient } from './fake-client.js';
import { confirmApply } from './apply-gate.js';

const USAGE = `Uso: node tools/release-close/release-close.js <verify|plan|apply> [opções]

Verbos:
  verify            verifica a elegibilidade da tag sobre o fixture de referência
  plan              mostra o plano ordenado de fechamento (somente leitura, mutations: 0)
  apply             mostra o mesmo plano e exige --yes + terminal interativo + "sim"

Opções:
  --help            mostra esta ajuda
  --json            saída em JSON (verify/plan: decisão + mutations; plan: passos; apply: plano antes do texto humano)
  --yes             confirmação explícita exigida pelo apply (nunca substitui o prompt)
  --repo <o/r>      repositório alvo (opaco nesta fase)
  --version <v>     versão da tag (padrão: v0.1.1 do fixture)
  --sha <sha>       SHA esperado (padrão: expectedSha do fixture)

Códigos de saída: 0 elegível/plano liberado/ajuda, 1 inelegível/recusa/entrada
inválida, 2 erro de uso. Nenhum verbo escreve no remoto nesta fase.
`;

// Estados que impedem qualquer passo de escrita: o plano aparece, o apply
// recusa antes de qualquer prompt.
const BLOCKING_CODES = ['FAILED', 'CONCURRENT', 'CONFLICTING', 'DUPLICATE'];

// Marcadores de destino de cada passo (D-15): o que será criado, o que será
// adotado e o que é apenas leitura de confirmação.
const MARKERS = { create: 'criar', adopt: 'adotar', read: 'ler' };
const MARKER_VERBS = { criar: 'Criar', adotar: 'Adotar', ler: 'Reler' };

// Ordem fixa de recuperação: rascunho, releitura, publicação, releitura,
// abertura da milestone, releitura, fechamento, releitura final (D-15).
const CLOSE_STEP_SPECS = [
  {
    ordem: 1,
    id: 'release-rascunho',
    alvo: 'release',
    modo: 'escrita',
    assunto: (ctx) => `o rascunho da Release ${ctx.version} no commit ${ctx.commitSha}`,
  },
  {
    ordem: 2,
    id: 'release-rascunho-readback',
    alvo: 'release',
    modo: 'leitura',
    assunto: (ctx) => `o rascunho da Release ${ctx.version} (id, tag e alvo)`,
  },
  {
    ordem: 3,
    id: 'release-publicar',
    alvo: 'release',
    modo: 'escrita',
    assunto: (ctx) => `a publicação da Release ${ctx.version}`,
  },
  {
    ordem: 4,
    id: 'release-publicada-readback',
    alvo: 'release',
    modo: 'leitura',
    assunto: (ctx) => `a Release ${ctx.version} já publicada`,
  },
  {
    ordem: 5,
    id: 'milestone-abrir',
    alvo: 'milestone',
    modo: 'escrita',
    assunto: (ctx) => `a Milestone ${ctx.version}`,
  },
  {
    ordem: 6,
    id: 'milestone-readback',
    alvo: 'milestone',
    modo: 'leitura',
    assunto: (ctx) => `a Milestone ${ctx.version} aberta`,
  },
  {
    ordem: 7,
    id: 'milestone-fechar',
    alvo: 'milestone',
    modo: 'escrita',
    assunto: (ctx) => `o fechamento da Milestone ${ctx.version}`,
  },
  {
    ordem: 8,
    id: 'milestone-readback-final',
    alvo: 'milestone',
    modo: 'leitura',
    assunto: (ctx) => `a Milestone ${ctx.version} fechada junto da Release ${ctx.version} publicada`,
  },
];

// ÚNICO ponto do módulo que alcança os fluxos globais do processo, e ele é
// resolvido na CHAMADA, nunca capturado na importação. Um chamador que injeta
// os seus sinks vê toda a saída nos sinks e os fluxos reais ficam intocados;
// um renderizador que escrevesse direto no global burlaria essa separação, e a
// varredura estática de evidence.test.js confere que não existe tal ponto.
function fluxosPadrao() {
  return { stdin: process.stdin, stdout: process.stdout, stderr: process.stderr };
}

function usageError(message, err) {
  err.write(`${message}\n${USAGE}`);
  return 2;
}

function parseArgs(argv) {
  const args = { verb: null, help: false, json: false, yes: false, repo: null, version: null, sha: null };
  const positionals = [];
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (token === '--help') {
      args.help = true;
    } else if (token === '--json') {
      args.json = true;
    } else if (token === '--yes') {
      args.yes = true;
    } else if (token === '--repo' || token === '--version' || token === '--sha') {
      const value = argv[i + 1];
      if (value === undefined || value.startsWith('--')) {
        return { error: `Opção ${token} exige um valor.` };
      }
      i += 1;
      if (token === '--repo') args.repo = value;
      else if (token === '--version') args.version = value;
      else args.sha = value;
    } else if (token.startsWith('--')) {
      return { error: `Opção desconhecida: ${token}.` };
    } else {
      positionals.push(token);
    }
  }
  if (positionals.length > 1) {
    return { error: `Verbo inválido: esperado um de verify, plan ou apply.` };
  }
  if (positionals.length === 1) {
    args.verb = positionals[0];
  }
  return { args };
}

function loadReferenceFixture() {
  const url = new URL('./fixtures/reference.json', import.meta.url);
  return JSON.parse(readFileSync(url, 'utf8'));
}

// Evidência plana de classificação no contrato de cinco chaves, derivada do
// fixture de referência: o cliente fake entrega envelopes, a classificação
// consome campos.
//
// Este é o ÚNICO lugar do módulo onde a tradução de envelope para lista é
// permitida: `snapshot.release` e `snapshot.milestones` são envelopes `ok` que
// o cliente serve, e o classificador lê listas. O bloco `ci` é copiado
// atravessado — nenhuma evidência de CI é reconstruída aqui, e o literal
// `checks: { state: 'success' }` que existia aqui (o vetor de falsificação que
// esta fase fecha) foi removido: um estado verde de CI não é um valor que a
// ferramenta possa inventar a partir de identificadores de execução.
export function evidenceFromSnapshot(snapshot, target) {
  if (!target || typeof target !== 'object') {
    throw new TypeError('Entrada inválida: o alvo resolvido é obrigatório para montar a evidência.');
  }
  const release = snapshot.release && snapshot.release.ok ? snapshot.release.data : null;
  const milestones = snapshot.milestones && snapshot.milestones.ok ? snapshot.milestones.data : [];
  return {
    target: { version: target.version, expectedSha: target.expectedSha },
    ci: snapshot.ci,
    releases: release ? [release] : [],
    milestones: Array.isArray(milestones) ? [...milestones] : [],
    closeMarkers: [],
  };
}

function resolveMarker(spec, ctx) {
  if (spec.modo === 'leitura') return MARKERS.read;
  if (spec.alvo === 'release') return ctx.releasePresente ? MARKERS.adopt : MARKERS.create;
  return ctx.milestonePresente ? MARKERS.adopt : MARKERS.create;
}

// Monta o plano ordenado: o que seria criado, o que seria adotado, em que
// ordem e contra quais SHAs/IDs congelados (D-15).
export function buildClosePlan({ version, expectedSha, snapshot, eligibility, classificacao, mutations }) {
  const evidence = evidenceFromSnapshot(snapshot, { version, expectedSha });
  const tagSha =
    (snapshot.tagRef && snapshot.tagRef.data && snapshot.tagRef.data.object
      ? snapshot.tagRef.data.object.sha
      : null) ?? 'desconhecido';
  const commitSha =
    (snapshot.tagObject && snapshot.tagObject.data && snapshot.tagObject.data.object
      ? snapshot.tagObject.data.object.sha
      : null) ?? expectedSha;
  const ctx = {
    version,
    tagSha,
    commitSha,
    releasePresente: evidence.releases.length > 0,
    milestonePresente: evidence.milestones.length > 0,
  };
  const steps = CLOSE_STEP_SPECS.map((spec) => {
    const marcador = resolveMarker(spec, ctx);
    return {
      ordem: spec.ordem,
      id: spec.id,
      alvo: spec.alvo,
      modo: spec.modo,
      marcador,
      assunto: spec.assunto(ctx),
    };
  });
  const bloqueado = BLOCKING_CODES.includes(classificacao.code);
  return {
    verb: 'plan',
    version,
    expectedSha,
    tagSha,
    commitSha,
    runs: snapshot.runs ?? [],
    releasePresente: ctx.releasePresente,
    milestonePresente: ctx.milestonePresente,
    elegibilidade: eligibility,
    classificacao,
    applyLiberado: eligibility.eligible === true && bloqueado === false,
    bloqueio: bloqueado
      ? `estado ${classificacao.code}: ${classificacao.reason}`
      : null,
    steps,
    mutations,
  };
}

export function renderPlanText(plan) {
  const linhas = [];
  linhas.push(`Plano de fechamento — versão ${plan.version} (Fase 9: previsão, sem escrita)`);
  linhas.push(`  tag anotada:    ${plan.tagSha}`);
  linhas.push(`  commit alvo:    ${plan.commitSha}`);
  linhas.push(`  SHA esperado:   ${plan.expectedSha}`);
  linhas.push(`  execuções:      ${plan.runs.length > 0 ? plan.runs.join(', ') : 'nenhuma'}`);
  linhas.push(`  elegibilidade:  ${plan.elegibilidade.code} — ${plan.elegibilidade.reason}`);
  linhas.push(`  classificação:  ${plan.classificacao.code} — ${plan.classificacao.reason}`);
  linhas.push(`  release atual:  ${plan.releasePresente ? 'presente (adotada)' : 'ausente (criada)'}`);
  linhas.push(`  milestone atual: ${plan.milestonePresente ? 'presente (adotada)' : 'ausente (criada)'}`);
  if (plan.bloqueio) {
    linhas.push(`  BLOQUEADO:      ${plan.bloqueio}`);
  }
  linhas.push('Passos ordenados (a ordem de recuperação da Fase 11):');
  for (const step of plan.steps) {
    linhas.push(
      `  ${step.ordem}. [${step.marcador}] ${step.id} — ${MARKER_VERBS[step.marcador]} ${step.assunto}.`,
    );
  }
  linhas.push(`mutations: ${plan.mutations}`);
  return `${linhas.join('\n')}\n`;
}

function renderJson(payload, out) {
  out.write(`${JSON.stringify(payload)}\n`);
}

function renderVerifyText(version, decision, mutations, out) {
  const estado = decision.eligible ? 'ELEGÍVEL' : 'INELEGÍVEL';
  out.write(
    `Elegibilidade de tag ${version}: ${estado}\n` +
      `Motivo: ${decision.reason}\n` +
      `Código: ${decision.code}\n` +
      `mutations: ${mutations}\n`,
  );
}

function renderVerifyJson(decision, mutations, out) {
  out.write(`${JSON.stringify({ ...decision, mutations })}\n`);
}

// Decisão compartilhada por verify, plan e apply: elegibilidade da tag +
// classificação do estado de fechamento, sempre sobre o fixture congelado.
async function decide(snapshot, { version, sha }) {
  const resolvedVersion = version ?? snapshot.version;
  const resolvedSha = sha ?? snapshot.expectedSha;
  const target = { version: resolvedVersion, expectedSha: resolvedSha };
  const client = makeFakeClient(snapshot);
  const eligibility = await checkTagEligibility(client, {
    version: resolvedVersion,
    expectedSha: resolvedSha,
  });
  // O alvo resolvido entra no contrato: um override de `--version` ou `--sha`
  // flui para a classificação em vez de ser ignorado. Um override que deixa de
  // bater com o `ci.targetSha` congelado classifica como FAILED com a família
  // CI-WRONG-SHA, que é a resposta fail-closed correta.
  const classificacao = classifySnapshot(evidenceFromSnapshot(snapshot, target));
  return { resolvedVersion, resolvedSha, eligibility, classificacao, mutations: 0 };
}

async function runVerify({ json, version, sha }, io) {
  const snapshot = loadReferenceFixture();
  let decision;
  try {
    decision = await decide(snapshot, { version, sha });
  } catch (err) {
    if (err instanceof TypeError) {
      io.stderr.write(`Entrada inválida: ${err.message}\n`);
      return 1;
    }
    throw err;
  }
  if (json) renderVerifyJson(decision.eligibility, decision.mutations, io.stdout);
  else renderVerifyText(decision.resolvedVersion, decision.eligibility, decision.mutations, io.stdout);
  return decision.eligibility.eligible ? 0 : 1;
}

async function runPlan({ json, version, sha }, io) {
  const snapshot = loadReferenceFixture();
  let plan;
  try {
    const decision = await decide(snapshot, { version, sha });
    plan = buildClosePlan({
      version: decision.resolvedVersion,
      expectedSha: decision.resolvedSha,
      snapshot,
      eligibility: decision.eligibility,
      classificacao: decision.classificacao,
      mutations: decision.mutations,
    });
  } catch (err) {
    if (err instanceof TypeError) {
      io.stderr.write(`Entrada inválida: ${err.message}\n`);
      return 1;
    }
    throw err;
  }
  if (json) renderJson(plan, io.stdout);
  else io.stdout.write(renderPlanText(plan));
  return plan.applyLiberado ? 0 : 1;
}

// Prompt de confirmação sobre o terminal vivo. Só é construído quando a
// fechadura de TTY já passou no portão; com pipe, a recusa acontece antes.
function makeAsk(stdin, output) {
  return () =>
    new Promise((resolve) => {
      const rl = createInterface({ input: stdin, output });
      rl.question('Confirmar o apply? (sim/nao) ', (answer) => {
        rl.close();
        resolve(answer);
      });
    });
}

async function runApply({ json, yes, version, sha }, io) {
  const snapshot = loadReferenceFixture();
  let plan;
  try {
    const decision = await decide(snapshot, { version, sha });
    plan = buildClosePlan({
      version: decision.resolvedVersion,
      expectedSha: decision.resolvedSha,
      snapshot,
      eligibility: decision.eligibility,
      classificacao: decision.classificacao,
      mutations: decision.mutations,
    });
  } catch (err) {
    if (err instanceof TypeError) {
      io.stderr.write(`Entrada inválida: ${err.message}\n`);
      return 1;
    }
    throw err;
  }

  // A estrutura vai primeiro quando pedida; o texto humano vai sempre em
  // seguida, antes de qualquer pergunta.
  if (json) renderJson(plan, io.stdout);
  const planText = renderPlanText(plan);

  if (!plan.applyLiberado) {
    io.stdout.write(planText);
    io.stderr.write(
      `apply recusa: ${plan.bloqueio ?? `tag inelegível (${plan.elegibilidade.code})`}. Nenhuma mutação executada (mutations: ${plan.mutations}).\n`,
    );
    return 1;
  }

  const gate = await confirmApply({
    yesFlag: yes,
    isTTY: io.stdin.isTTY === true,
    planText,
    ask: makeAsk(io.stdin, io.stdout),
    write: (texto) => io.stdout.write(texto),
  });

  if (!gate.confirmed) {
    io.stderr.write(`${gate.reason} Nenhuma mutação executada (mutations: ${plan.mutations}).\n`);
    return 1;
  }

  // Confirmação dupla aceita, mas a Fase 9 não possui caminho de escrita: o
  // apply falha fechado até a reconciliação idempotente da Fase 11.
  io.stderr.write(
    `${gate.reason} Ainda assim a Fase 9 não executa escrita remota: reconciliação chega na Fase 11. Nenhuma mutação executada (mutations: ${plan.mutations}).\n`,
  );
  return 1;
}

// Entrada exportada do CLI (o `main` de WR-04). Recebe os fluxos por argumento
// e devolve o código de saída em vez de terminar o processo, de modo que um
// teste ou um módulo a jusante possa dirigir um verbo e inspecionar o que foi
// escrito. Executada como script, os fluxos caem nos do processo e o operador
// vê exatamente o texto, o destino e o código de sempre.
export async function runReleaseClose(argv, io = {}) {
  if (!io || typeof io !== 'object') {
    throw new TypeError('Entrada inválida: esperado um objeto de fluxos com stdin, stdout e stderr.');
  }
  if (!Array.isArray(argv)) {
    throw new TypeError('Entrada inválida: esperado argv como lista de argumentos.');
  }
  const padrao = fluxosPadrao();
  const fluxos = {
    stdin: io.stdin ?? padrao.stdin,
    stdout: io.stdout ?? padrao.stdout,
    stderr: io.stderr ?? padrao.stderr,
  };
  const parsed = parseArgs(argv);
  if (parsed.error) {
    return usageError(parsed.error, fluxos.stderr);
  }
  const { verb, help, json, version, sha } = parsed.args;

  if (help || verb === null) {
    fluxos.stdout.write(USAGE);
    return 0;
  }

  if (verb === 'verify') {
    return runVerify({ json, version, sha }, fluxos);
  }
  if (verb === 'plan') {
    return runPlan({ json, version, sha }, fluxos);
  }
  if (verb === 'apply') {
    return runApply({ json, yes: parsed.args.yes, version, sha }, fluxos);
  }
  return usageError(`Verbo desconhecido: ${verb} (use verify, plan ou apply).`, fluxos.stderr);
}

// Só o caso de script de entrada executa um verbo: a URL do módulo é comparada
// com o caminho de entrada resolvido, e a comparação happen apenas aí — a
// importação de um módulo alheio nunca executa a CLI. Symlink e caminho
// relativo são normalizados por realpath, que é a mesma forma que o import.meta
// carrega.
function ehScriptDeEntrada() {
  const entrada = process.argv[1];
  if (typeof entrada !== 'string' || entrada === '') return false;
  try {
    return pathToFileURL(realpathSync(entrada)).href === import.meta.url;
  } catch {
    return false;
  }
}

// O código é atribuído, não terminado: um `process.exit` aqui truncaria a
// saída em buffer nos caminhos com pipe e mataria qualquer importador.
if (ehScriptDeEntrada()) {
  process.exitCode = await runReleaseClose(process.argv.slice(2));
}
