// Cliente fake programável: serve snapshots em memória e MEDE o efeito
// colateral na fronteira de escrita.
//
// Uso: const fake = makeFakeClient(snapshot, failurePlan?) -> cliente com os
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
//
// Prova de zero-escrita (plano 09-06, T-09-06-02): a contagem é uma MEDIÇÃO.
// O talão e a lista de efeitos vivem num fecho que este módulo nunca expõe;
// `mutations` devolve o talão e `writes` devolve uma cópia congelada do
// registro, de modo que nenhum chamador reescreve a evidência depois do fato.
// A armadilha `trap` é a única função por onde um efeito colateral deve pasar —
// ela REGISTRA e nunca age: a arapuca não executa nenhuma escrita remota, ela
// mede o que um escape faria e recusa contá-lo como limpo.
//
// Compatibilidade: `writes` continua sendo o nome público e continua sendo um
// array observável, com `length` igual à contagem medida. Quatro pontos de
// leitura em eligibility.test.js e safe04.test.js — arquivos que este plano não
// possui — dependem exatamente dessa forma e continuam literalmente verdadeiros.

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

function buildFakeClient(snapshot, failurePlan, { trapVisivel }) {
  if (!snapshot || typeof snapshot !== 'object') {
    throw new TypeError('Snapshot inválido: esperado um objeto com os dados do cenário.');
  }
  const queues = normalizePlan(failurePlan);
  const calls = [];
  // Talão e registro vivem neste fecho e nunca saem dele: o cliente expõe apenas
  // acessores de leitura, e nenhum deles devolve a lista viva.
  const efeitos = [];
  let taloes = 0;
  let seq = 0;

  // A única função por onde um efeito colateral deve passar. Conta, nomeia e
  // registra — não executa nada, não fala com a rede, não toca o disco.
  const registrarEfeito = (capability, args = []) => {
    taloes += 1;
    efeitos.push(
      Object.freeze({
        seq: taloes,
        capability,
        args: Object.freeze([...args]),
      }),
    );
    return taloes;
  };

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
    get mutations() {
      return taloes;
    },
    // Acessor de compatibilidade somente leitura: devolve uma cópia congelada
    // do registro, cujo `length` é a contagem medida. Com nenhum efeito
    // observado é um array vazio congelado, e a forma observável é idêntica à do
    // antigo array público — inclusive para leitura por índice, iteração e
    // comparação profunda contra `[]`.
    get writes() {
      return Object.freeze([...efeitos]);
    },
    async getTagRef(version) {
      return serve('getTagRef', [version], () => snapshot.tagRef);
    },
    async getMainRef() {
      return serve('getMainRef', [], () => snapshot.mainRef);
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
    async listCiRuns(expectedSha, branch = 'main') {
      return serve('listCiRuns', [expectedSha, branch], () => snapshot.ciRuns || { runs: [], failedRunIds: [] });
    },
    async getMainCIRun(repo, expectedSha) {
      return serve('getMainCIRun', [repo, expectedSha], () => snapshot.mainCIRun);
    },
    async getTagCIRun(repo, expectedSha) {
      return serve('getTagCIRun', [repo, expectedSha], () => snapshot.tagCIRun);
    },
  };

  if (trapVisivel) {
    // Costura de teste, deliberadamente fora da superfície pública: não
    // enumerável, portanto não é uma capacidade da superfície para o verificador
    // de forma, e congelada junto com o resto do cliente. Ela REGISTRA, nunca
    // age — nenhum método desta arapuca executa efeito remoto.
    Object.defineProperty(client, 'trap', {
      value: registrarEfeito,
      enumerable: false,
      writable: false,
      configurable: false,
    });
  }

  // A forma é afirmada ANTES do congelamento: congelar primeiro faria a própria
  // verificação de forma lançar ao tocar a propriedade.
  assertClientShape(client);
  return Object.freeze(client);
}

export function makeFakeClient(snapshot, failurePlan) {
  return buildFakeClient(snapshot, failurePlan, { trapVisivel: false });
}

// Fábrica de costura de teste: devolve um cliente cuja armadilha está armada e
// cuja contagem medida pode ser observada. Production nunca chama isto; existe
// para que o grupo canary registre um efeito colateral real e prove que um
// escape não sai limpo.
export function makeArmedFakeClient(snapshot, failurePlan) {
  return buildFakeClient(snapshot, failurePlan, { trapVisivel: true });
}

export const SCRIPTED_FAILURE_OUTCOMES = SCRIPTED_OUTCOMES;
