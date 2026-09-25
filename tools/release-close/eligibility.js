// Elegibilidade de tag (SAFE-02): função pura sobre o cliente injetado.
//
// Regra: a tag precisa ser anotada (peel em dois saltos) e o commit resultante
// precisa ser estritamente igual à cabeça remota do branch E ao SHA esperado
// (comparação de strings exatas, SHA completo de 40 hex — abreviações rejeitadas).
//
// Todo retorno tem o formato { eligible, code, reason, writeAction }:
//   - eligible: boolean.
//   - code: código estável em EN (MISSING, LIGHTWEIGHT, SAFE-02, ELIGIBLE).
//   - reason: mensagem humana em PT-BR.
//   - writeAction: sempre null (este contrato nunca autoriza escrita).
//
// Divergências de domínio retornam dados (fail-closed por dados, sem try/catch).
// `throw` (sempre TypeError, mensagem em PT-BR) é reservado a entradas inválidas.

const FULL_SHA = /^[0-9a-f]{40}$/;
const VERSION = /^v\d+\.\d+\.\d+$/;

function invalid(message) {
  return new TypeError(message);
}

function ineligible(code, reason) {
  return { eligible: false, code, reason, writeAction: null };
}

export async function checkTagEligibility(client, options) {
  if (!client || typeof client !== 'object') {
    throw invalid('Cliente inválido: esperado um objeto com os métodos de leitura.');
  }
  if (!options || typeof options !== 'object') {
    throw invalid('Opções inválidas: esperado um objeto com version e expectedSha.');
  }
  const { version, expectedSha } = options;
  if (typeof version !== 'string' || !VERSION.test(version)) {
    throw invalid('Versão inválida: esperado o formato vX.Y.Z (ex.: v0.1.1).');
  }
  if (typeof expectedSha !== 'string' || !FULL_SHA.test(expectedSha)) {
    throw invalid('SHA esperado inválido: esperado SHA completo de 40 caracteres hexadecimais minúsculos.');
  }

  // Salto 1: resolve refs/tags/<version>. 404 == tag ausente (sem erro).
  const ref = await client.getTagRef(version);
  if (!ref || !ref.ok) {
    return ineligible('MISSING', `Tag ${version} ausente no remoto.`);
  }
  const refObject = ref.data && ref.data.object;
  if (!refObject || typeof refObject.sha !== 'string' || typeof refObject.type !== 'string') {
    return ineligible('MISSING', `Referência da tag ${version} em formato inesperado.`);
  }

  // Tag leve (single-hop, type commit) não é aceita pela SAFE-02.
  if (refObject.type !== 'tag') {
    return ineligible(
      'LIGHTWEIGHT',
      `Tag ${version} é leve (aponta direto para commit); esperada tag anotada.`,
    );
  }

  // Salto 2: peel do objeto tag até o commit.
  const tagObject = await client.getTagObject(refObject.sha);
  if (!tagObject || !tagObject.ok) {
    return ineligible('MISSING', `Objeto da tag ${version} ausente no remoto.`);
  }
  const peeled = tagObject.data && tagObject.data.object && tagObject.data.object.sha;
  if (typeof peeled !== 'string' || !FULL_SHA.test(peeled)) {
    return ineligible('MISSING', `Objeto da tag ${version} sem commit válido.`);
  }

  // Cabeça remota do branch principal.
  const head = await client.getBranchHead('main');
  const headSha = head && head.data && head.data.sha;
  if (!head || !head.ok || typeof headSha !== 'string') {
    return ineligible('MISSING', 'Cabeça remota do branch main indisponível.');
  }
  if (peeled !== headSha) {
    return ineligible(
      'SAFE-02',
      `Commit da tag (${peeled}) diverge da cabeça remota da main (${headSha}).`,
    );
  }

  if (peeled !== expectedSha) {
    return ineligible(
      'SAFE-02',
      `Commit da tag (${peeled}) diverge do SHA esperado (${expectedSha}).`,
    );
  }

  return {
    eligible: true,
    code: 'ELIGIBLE',
    reason: `Tag ${version} anotada e elegível: ${peeled} confere com a main e o SHA esperado.`,
    writeAction: null,
  };
}
