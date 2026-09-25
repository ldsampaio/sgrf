#!/usr/bin/env node
// release-close: ferramenta do operador (verify / plan / apply).
//
// Invocação: node tools/release-close/release-close.js <verify|plan|apply> ...
// Zero dependências, ESM. Nesta fase apenas `verify` executa (sobre o fixture
// de referência via fake-client); `plan` e `apply` recusam como ainda-não-ligados.
//
// A ferramenta nunca abre subprocesso, nunca lê variáveis de ambiente de token
// e nunca registra cabeçalhos — a saída limita-se aos campos da decisão mais
// o contador mutations.

import { readFileSync } from 'node:fs';
import { checkTagEligibility } from './eligibility.js';
import { makeFakeClient } from './fake-client.js';

const USAGE = `Uso: node tools/release-close/release-close.js <verify|plan|apply> [opções]

Verbos:
  verify            verifica elegibilidade da tag sobre o fixture de referência
  plan              ainda não ligado (previsto no plano 09-03)
  apply             ainda não ligado (previsto no plano 09-03)

Opções:
  --help            mostra esta ajuda
  --json            saída em JSON (decision + mutations)
  --yes             confirmação explícita (usada pelo apply futuro)
  --repo <o/r>      repositório alvo (opaco nesta fase)
  --version <v>     versão da tag (padrão: v0.1.1 do fixture)
  --sha <sha>       SHA esperado (padrão: expectedSha do fixture)
`;

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

function renderText(version, decision) {
  const estado = decision.eligible ? 'ELEGÍVEL' : 'INELEGÍVEL';
  process.stdout.write(
    `Elegibilidade de tag ${version}: ${estado}\n` +
      `Motivo: ${decision.reason}\n` +
      `Código: ${decision.code}\n` +
      `mutations: 0\n`,
  );
}

function renderJson(decision) {
  process.stdout.write(`${JSON.stringify({ ...decision, mutations: 0 })}\n`);
}

async function runVerify({ json, version, sha }) {
  const snapshot = loadReferenceFixture();
  const resolvedVersion = version ?? snapshot.version;
  const resolvedSha = sha ?? snapshot.expectedSha;
  const client = makeFakeClient(snapshot);
  let decision;
  try {
    decision = await checkTagEligibility(client, {
      version: resolvedVersion,
      expectedSha: resolvedSha,
    });
  } catch (err) {
    if (err instanceof TypeError) {
      process.stderr.write(`Entrada inválida: ${err.message}\n`);
      return 1;
    }
    throw err;
  }
  if (json) renderJson(decision);
  else renderText(resolvedVersion, decision);
  return decision.eligible ? 0 : 1;
}

async function main(argv) {
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
    process.stderr.write(
      'plan ainda não ligado nesta fase (previsto no plano 09-03); nenhuma mutação executada.\n',
    );
    return 1;
  }
  if (verb === 'apply') {
    process.stderr.write(
      'apply ainda não ligado nesta fase (previsto no plano 09-03); nenhuma mutação executada.\n',
    );
    return 1;
  }
  return usageError(`Verbo desconhecido: ${verb} (use verify, plan ou apply).`);
}

const code = await main(process.argv.slice(2));
process.exit(code);
