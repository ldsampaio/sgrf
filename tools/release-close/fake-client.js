// Cliente fake programável: serve snapshots em memória e registra chamadas.
//
// Uso: const fake = makeFakeClient(snapshot); -> client com os cinco métodos
// de leitura da interface client.js, cada um resolvendo a partir do snapshot.
//
// Registro de chamadas: cada leitura anexa { seq, method, args } a `calls`,
// permitindo asserções de ordenação (ref -> tag-object -> branch head).
// Prova de zero-escrita: `writes` permanece vazio — nenhum caminho de escrita
// existe neste módulo, e a suíte falha se qualquer chamada de escrita for
// registrada.

import { assertClientShape } from './client.js';

export function makeFakeClient(snapshot) {
  if (!snapshot || typeof snapshot !== 'object') {
    throw new TypeError('Snapshot inválido: esperado um objeto com os dados do cenário.');
  }
  const calls = [];
  const writes = [];
  let seq = 0;

  const record = (method, args) => {
    seq += 1;
    calls.push({ seq, method, args });
  };

  const client = {
    calls,
    writes,
    get mutations() {
      return writes.length;
    },
    async getTagRef(version) {
      record('getTagRef', [version]);
      return snapshot.tagRef;
    },
    async getTagObject(tagSha) {
      record('getTagObject', [tagSha]);
      return snapshot.tagObject;
    },
    async getBranchHead(branch = 'main') {
      record('getBranchHead', [branch]);
      return snapshot.branchHead;
    },
    async getReleaseByTag(version) {
      record('getReleaseByTag', [version]);
      return snapshot.release;
    },
    async listMilestones() {
      record('listMilestones', []);
      return snapshot.milestones;
    },
  };

  assertClientShape(client);
  return client;
}
