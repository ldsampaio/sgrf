// Cliente fake programável: serve snapshots em memória e registra chamadas.
//
// Uso: const fake = makeFakeClient(snapshot, failurePlan?) -> client com os
// cinco métodos de leitura da interface client.js, cada um resolvendo a
// partir do snapshot.
//
// Plano de falhas roteirizado (opcional, D-07): objeto com chaves entre os
// cinco nomes de leitura; cada valor é a lista ordenada de desfechos a
// servir nas chamadas sucessivas daquele método, consumidos em ordem:
//   - 'timeout'        -> lança erro de tempo esgotado (PT-BR)
//   - 'lost-response'  -> lança erro de resposta perdida (PT-BR)
//   - 'status-409'     -> { ok: false, status: 409, data: null }
//   - 'status-422'     -> { ok: false, status: 422, data: null }
//   - 'status-429'     -> { ok: false, status: 429, data: null }
//   - 'status-5xx'     -> { ok: false, status: 500, data: null }
// Esgotado o roteiro do método, as chamadas voltam aos dados do snapshot.
//
// Registro de chamadas: cada leitura anexa { seq, method, args } a `calls`
// (inclusive as roteirizadas), permitindo asserções de ordenação
// (ref -> tag-object -> branch head -> release -> milestones).
// Prova de zero-escrita: `writes` permanece vazio — nenhum caminho de
// alteração remota existe neste módulo, e a suíte falha se qualquer
// chamada fora da leitura for registrada.

import { READ_METHODS, assertClientShape } from './client.js';

const SCRIPTED_OUTCOMES = [
  'timeout',
  'lost-response',
  'status-409',
  'status-422',
  'status-429',
  'status-5xx',
];

const SCRIPTED_STATUS = {
  'status-409': 409,
  'status-422': 422,
  'status-429': 429,
  'status-5xx': 500,
};

function invalid(message) {
  return new TypeError(message);
}

function normalizePlan(failurePlan) {
  if (failurePlan === undefined || failurePlan === null) return {};
  if (typeof failurePlan !== 'object' || Array.isArray(failurePlan)) {
    throw invalid('Plano de falhas inválido: esperado um objeto com chaves entre os métodos de leitura.');
  }
  const queues = {};
  for (const [method, outcomes] of Object.entries(failurePlan)) {
    if (!READ_METHODS.includes(method)) {
      throw invalid(`Plano de falhas inválido: método desconhecido: ${method}.`);
    }
    if (!Array.isArray(outcomes)) {
      throw invalid(`Plano de falhas inválido: ${method} exige uma lista ordenada de desfechos.`);
    }
    for (const outcome of outcomes) {
      if (!SCRIPTED_OUTCOMES.includes(outcome)) {
        throw invalid(`Plano de falhas inválido: desfecho desconhecido em ${method}: ${outcome}.`);
      }
    }
    queues[method] = [...outcomes];
  }
  return queues;
}

export function makeFakeClient(snapshot, failurePlan) {
  if (!snapshot || typeof snapshot !== 'object') {
    throw new TypeError('Snapshot inválido: esperado um objeto com os dados do cenário.');
  }
  const queues = normalizePlan(failurePlan);
  const calls = [];
  const writes = [];
  let seq = 0;

  const record = (method, args) => {
    seq += 1;
    calls.push({ seq, method, args });
  };

  const nextScripted = (method) => {
    const queue = queues[method];
    if (!queue || queue.length === 0) return null;
    return queue.shift();
  };

  const serve = (method, args, fallback) => {
    record(method, args);
    const scripted = nextScripted(method);
    if (scripted === null) return fallback();
    if (scripted === 'timeout') {
      throw new Error(`Tempo esgotado na leitura ${method} (cenário roteirizado).`);
    }
    if (scripted === 'lost-response') {
      throw new Error(`Resposta perdida na leitura ${method} (cenário roteirizado).`);
    }
    return { ok: false, status: SCRIPTED_STATUS[scripted], data: null };
  };

  const client = {
    calls,
    writes,
    get mutations() {
      return writes.length;
    },
    async getTagRef(version) {
      return serve('getTagRef', [version], () => snapshot.tagRef);
    },
    async getTagObject(tagSha) {
      return serve('getTagObject', [tagSha], () => snapshot.tagObject);
    },
    async getBranchHead(branch = 'main') {
      return serve('getBranchHead', [branch], () => snapshot.branchHead);
    },
    async getReleaseByTag(version) {
      return serve('getReleaseByTag', [version], () => snapshot.release);
    },
    async listMilestones() {
      return serve('listMilestones', [], () => snapshot.milestones);
    },
  };

  assertClientShape(client);
  return client;
}

export const SCRIPTED_FAILURE_OUTCOMES = SCRIPTED_OUTCOMES;
