// Elegibilidade de tag (SAFE-02): função pura sobre o cliente injetado.
//
// Regra: a tag precisa ser anotada (peel em dois saltos) e o commit resultante
// precisa ser estritamente igual à cabeça remota do branch E ao SHA esperado
// (comparação de strings exatas, SHA completo de 40 hex — abreviações rejeitadas).
//
// Os dois saltos provam IDENTIDADE, não apenas igualdade de duas strings. Quatro
// provas fecham antes de qualquer comparação de igualdade (T-09-04-01):
//   1. a referência lida é exatamente `refs/tags/<versão pedida>`;
//   2. o SHA do objeto da tag é um SHA completo de 40 hex minúsculos;
//   3. o objeto devolvido no segundo salto é o mesmo objeto que a ref nomeia
//      (identidade byte a byte, sem comparação por prefixo);
//   4. o segundo salto aponta para um commit — peel em tag, tree ou blob nunca
//      prova o commit da tag anotada.
//
// Todo retorno tem o formato { eligible, code, reason, writeAction }:
//   - eligible: boolean.
//   - code: código estável em EN (MISSING, LIGHTWEIGHT, TAG-IDENTITY, SAFE-02,
//     ELIGIBLE).
//   - reason: mensagem humana em PT-BR, nomeando o SHA, o status e a prova que
//     falhou — nunca valor de ambiente, cabeçalho ou rastro de execução.
//   - writeAction: sempre null (este contrato nunca autoriza escrita).
//
// Divergências de domínio retornam dados (fail-closed por dados, sem try/catch).
// `throw` (sempre TypeError, mensagem em PT-BR) é reservado a entradas inválidas.

const FULL_SHA = /^[0-9a-f]{40}$/;
const VERSION = /^v\d+\.\d+\.\d+$/;
const REF_PREFIX = 'refs/tags/';

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

  // Prova 1 de 4: a ref lida é exatamente a ref pedida. Sem esta prova uma tag
  // de outra versão seria lida como se fosse a versão solicitada.
  const refEsperada = `${REF_PREFIX}${version}`;
  if (ref.data.ref !== refEsperada) {
    return ineligible(
      'TAG-IDENTITY',
      `Identidade da tag recusada: a referência lida (${ref.data.ref}) não é a referência pedida (${refEsperada}).`,
    );
  }

  // Tag leve (single-hop, type commit) não é aceita pela SAFE-02.
  if (refObject.type !== 'tag') {
    return ineligible(
      'LIGHTWEIGHT',
      `Tag ${version} é leve (aponta direto para commit); esperada tag anotada.`,
    );
  }

  // Prova 2 de 4: abreviação de SHA não prova identidade. Só 40 hex minúsculos
  // identificam o objeto da tag.
  if (!FULL_SHA.test(refObject.sha)) {
    return ineligible(
      'TAG-IDENTITY',
      `Identidade da tag recusada: o SHA do objeto da tag (${refObject.sha}) não é um SHA completo de 40 caracteres hexadecimais minúsculos.`,
    );
  }

  // Salto 2: peel do objeto tag até o commit.
  const tagObject = await client.getTagObject(refObject.sha);
  if (!tagObject || !tagObject.ok) {
    return ineligible('MISSING', `Objeto da tag ${version} ausente no remoto.`);
  }
  const tagData = tagObject.data;
  if (
    !tagData ||
    typeof tagData.sha !== 'string' ||
    !tagData.object ||
    typeof tagData.object.sha !== 'string' ||
    typeof tagData.object.type !== 'string'
  ) {
    return ineligible('MISSING', `Objeto da tag ${version} sem commit válido.`);
  }

  // Prova 3 de 4: o objeto devolvido é exatamente o objeto que a ref nomeia.
  if (tagData.sha !== refObject.sha) {
    return ineligible(
      'TAG-IDENTITY',
      `Identidade da tag recusada: o objeto lido (${tagData.sha}) não é o objeto nomeado pela referência (${refObject.sha}).`,
    );
  }

  // Prova 4 de 4: o segundo salto precisa ser um commit. Peel em tag, tree ou
  // blob não é o commit da tag anotada e nunca é elegível.
  if (tagData.object.type !== 'commit') {
    return ineligible(
      'TAG-IDENTITY',
      `Identidade da tag recusada: o segundo salto da tag ${version} aponta para ${tagData.object.type} e não para commit.`,
    );
  }

  const peeled = tagData.object.sha;
  if (!FULL_SHA.test(peeled)) {
    return ineligible(
      'TAG-IDENTITY',
      `Identidade da tag recusada: o commit peeled (${peeled}) não é um SHA completo de 40 caracteres hexadecimais minúsculos.`,
    );
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
