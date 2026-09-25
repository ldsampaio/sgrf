// Interface do cliente de leitura do release-close (somente leitura).
//
// O contrato puro (eligibility.js) nunca fala com a rede: ele recebe um
// objeto `client` com exatamente estes cinco métodos assíncronos de leitura.
// A Fase 9 serve snapshots via fake-client.js; a Fase 10 troca o fake por um
// cliente real sobre o `gh` sem tocar a lógica pura.
//
// Cada método retorna um envelope normalizado { ok, status, data }:
//   - ok: boolean — true quando o objeto existe no remoto.
//   - status: número — código de estado análogo a HTTP (200 existente, 404 ausente).
//   - data: objeto com os campos abaixo, ou null quando ausente.
//
// Métodos (somente leitura — nenhum método de escrita existe nesta interface):
//   - getTagRef(version)       -> { ref, object: { type: 'tag'|'commit', sha } }
//   - getTagObject(tagSha)     -> { sha, object: { type, sha } } (segundo salto do peel)
//   - getBranchHead(branch)    -> { sha } (cabeça remota do branch)
//   - getReleaseByTag(version) -> release ou null (404 == ausente, sem erro)
//   - listMilestones()         -> lista de { number, title, state }
//
// Nenhum segredo é lido, registrado ou transmitido por esta interface.

export const READ_METHODS = [
  'getTagRef',
  'getTagObject',
  'getBranchHead',
  'getReleaseByTag',
  'listMilestones',
];

export function assertClientShape(client) {
  if (!client || typeof client !== 'object') {
    throw new TypeError('Cliente inválido: esperado um objeto com os cinco métodos de leitura.');
  }
  for (const method of READ_METHODS) {
    if (typeof client[method] !== 'function') {
      throw new TypeError(`Cliente inválido: método de leitura ausente: ${method}.`);
    }
  }
  return true;
}
