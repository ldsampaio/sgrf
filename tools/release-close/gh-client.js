// gh-client.js: costura para o `gh` real, A SER LIGADA NA FASE 10.
//
// Rascunho proposital: cada um dos cinco métodos de leitura existe apenas
// para a costura compilar (passa em assertClientShape) e falha fechado,
// lançando um erro que nomeia a Fase 10 como o marco da ligação real.
// Nenhuma chamada de rede acontece aqui; nenhum caminho de alteração
// remota existe neste módulo — a capacidade futura recusada segue apenas
// como prosa neste comentário, sem nomes de rotina nem verbos de método.

import { assertClientShape } from './client.js';

function notWired(method) {
  throw new Error(
    `Leitura remota ${method} ainda não ligada: a ligação com o gh chega na Fase 10.`,
  );
}

export async function getTagRef(version) {
  void version;
  notWired('getTagRef');
}

export async function getTagObject(tagSha) {
  void tagSha;
  notWired('getTagObject');
}

export async function getBranchHead(branch = 'main') {
  void branch;
  notWired('getBranchHead');
}

export async function getReleaseByTag(version) {
  void version;
  notWired('getReleaseByTag');
}

export async function listMilestones() {
  notWired('listMilestones');
}

export const ghClient = {
  getTagRef,
  getTagObject,
  getBranchHead,
  getReleaseByTag,
  listMilestones,
};

assertClientShape(ghClient);
