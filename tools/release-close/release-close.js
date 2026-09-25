#!/usr/bin/env node
// release-close: ferramenta do operador (verify / plan / apply).
//
// Invocação: node tools/release-close/release-close.js <verify|plan|apply> ...
// Zero dependências, ESM. `verify` e `plan` servem o fixture de referência via
// fake-client e são somente-leitura: ambos carregam `mutations: 0`. `apply`
// renderiza o plano ordenado (previsão da ordem de recuperação da Fase 11),
// entrega o texto ao portão de dupla trava (apply-gate.js) e falha fechado —
// nenhum caminho de escrita remota existe nesta fase.
//
// A ferramenta nunca abre subprocesso, nunca lê variáveis de ambiente de
// credencial e nunca registra cabeçalhos — a saída limita-se aos campos da
// decisão, ao plano ordenado e ao contador mutations.

import { readFileSync } from 'node:fs';
import { createInterface } from 'node:readline';
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

function usageError(message) {
  process.stderr.write(`${message}\n${USAGE}`);
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

// Evidência plana de classificação derivada do fixture de referência: o
// cliente fake entrega envelopes, a classificação consome campos.
function evidenceFromSnapshot(snapshot) {
  const release = snapshot.release && snapshot.release.ok ? snapshot.release.data : null;
  const milestones = snapshot.milestones && snapshot.milestones.ok ? snapshot.milestones.data : [];
  return {
    release,
    // O fixture de referência descreve um único objeto de release; a lista
    // `releases` (duplicatas/conflitos) pertence aos fixtures de estado.
    releases: [],
    milestone: Array.isArray(milestones) && milestones.length > 0 ? milestones[0] : null,
    checks: { state: 'success', runs: snapshot.runs ?? [] },
    closeMarkers: [],
    eligibility: null,
  };
}

function resolveMarker(spec, ctx) {
  if (spec.modo === 'leitura') return MARKERS.read;
  if (spec.alvo === 'release') return ctx.releasePresente ? MARKERS.adopt : MARKERS.create;
  return ctx.milestonePresente ? MARKERS.adopt : MARKERS.create;
}

// Monta o plano ordenado: o que seria criado, o que seria adotado, em que
// ordem e contra quais SHAs/IDs congelados (D-15).
export function buildClosePlan({ version, expectedSha, snapshot, eligibility, classificacao }) {
  const evidence = evidenceFromSnapshot(snapshot);
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
    releasePresente: evidence.release !== null,
    milestonePresente: evidence.milestone !== null,
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
    mutations: 0,
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
  linhas.push('mutations: 0');
  return `${linhas.join('\n')}\n`;
}

function renderJson(payload) {
  process.stdout.write(`${JSON.stringify(payload)}\n`);
}

function renderVerifyText(version, decision) {
  const estado = decision.eligible ? 'ELEGÍVEL' : 'INELEGÍVEL';
  process.stdout.write(
    `Elegibilidade de tag ${version}: ${estado}\n` +
      `Motivo: ${decision.reason}\n` +
      `Código: ${decision.code}\n` +
      `mutations: 0\n`,
  );
}

function renderVerifyJson(decision) {
  process.stdout.write(`${JSON.stringify({ ...decision, mutations: 0 })}\n`);
}

// Decisão compartilhada por verify, plan e apply: elegibilidade da tag +
// classificação do estado de fechamento, sempre sobre o fixture congelado.
async function decide(snapshot, { version, sha }) {
  const resolvedVersion = version ?? snapshot.version;
  const resolvedSha = sha ?? snapshot.expectedSha;
  const client = makeFakeClient(snapshot);
  const eligibility = await checkTagEligibility(client, {
    version: resolvedVersion,
    expectedSha: resolvedSha,
  });
  const classificacao = classifySnapshot(evidenceFromSnapshot(snapshot));
  return { resolvedVersion, resolvedSha, eligibility, classificacao };
}

async function runVerify({ json, version, sha }) {
  const snapshot = loadReferenceFixture();
  let decision;
  try {
    decision = await decide(snapshot, { version, sha });
  } catch (err) {
    if (err instanceof TypeError) {
      process.stderr.write(`Entrada inválida: ${err.message}\n`);
      return 1;
    }
    throw err;
  }
  if (json) renderVerifyJson(decision.eligibility);
  else renderVerifyText(decision.resolvedVersion, decision.eligibility);
  return decision.eligibility.eligible ? 0 : 1;
}

async function runPlan({ json, version, sha }) {
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
    });
  } catch (err) {
    if (err instanceof TypeError) {
      process.stderr.write(`Entrada inválida: ${err.message}\n`);
      return 1;
    }
    throw err;
  }
  if (json) renderJson(plan);
  else process.stdout.write(renderPlanText(plan));
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
    });
  } catch (err) {
    if (err instanceof TypeError) {
      process.stderr.write(`Entrada inválida: ${err.message}\n`);
      return 1;
    }
    throw err;
  }

  // A estrutura vai primeiro quando pedida; o texto humano vai sempre em
  // seguida, antes de qualquer pergunta.
  if (json) renderJson(plan);
  const planText = renderPlanText(plan);

  if (!plan.applyLiberado) {
    process.stdout.write(planText);
    process.stderr.write(
      `apply recusa: ${plan.bloqueio ?? `tag inelegível (${plan.elegibilidade.code})`}. Nenhuma mutação executada (mutations: 0).\n`,
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
    process.stderr.write(`${gate.reason} Nenhuma mutação executada (mutations: 0).\n`);
    return 1;
  }

  // Confirmação dupla aceita, mas a Fase 9 não possui caminho de escrita: o
  // apply falha fechado até a reconciliação idempotente da Fase 11.
  process.stderr.write(
    `${gate.reason} Ainda assim a Fase 9 não executa escrita remota: reconciliação chega na Fase 11. Nenhuma mutação executada (mutations: 0).\n`,
  );
  return 1;
}

async function main(argv, io) {
  const parsed = parseArgs(argv);
  if (parsed.error) {
    return usageError(parsed.error);
  }
  const { verb, help, json, version, sha } = parsed.args;

  if (help || verb === null) {
    process.stdout.write(USAGE);
    return 0;
  }

  if (verb === 'verify') {
    return runVerify({ json, version, sha });
  }
  if (verb === 'plan') {
    return runPlan({ json, version, sha });
  }
  if (verb === 'apply') {
    return runApply({ json, yes: parsed.args.yes, version, sha }, io);
  }
  return usageError(`Verbo desconhecido: ${verb} (use verify, plan ou apply).`);
}

const code = await main(process.argv.slice(2), { stdin: process.stdin, stdout: process.stdout });
process.exit(code);
