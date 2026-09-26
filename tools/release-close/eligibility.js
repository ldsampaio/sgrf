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
// Ausência nunca é inferida de uma falha (T-09-04-02). Somente o status 404
// prova que o recurso não existe; cada uma das demais famílias recebe código
// próprio, para que o operador distinga credencial de disponibilidade:
//   - 401/403 -> PERMISSION   (a credencial não alcança o recurso);
//   - 409/422/429/5xx e status
//     desconhecido -> UNAVAILABLE (estado remoto indeterminado);
//   - envelope ok true com `data` fora de formato ou `status` não numérico ->
//     MALFORMED (a resposta não é interpretável);
//   - leitura que lança (tempo esgotado, resposta perdida) -> TRANSPORT (a
//     leitura não completou e o estado remoto é desconhecido).
// Nenhuma dessas famílias pode virar elegibilidade, e nenhuma implementa
// retry/backoff: retry e releitura por identidade natural pertencem à costura
// de reconciliação da Fase 11.
//
// Todo retorno tem o formato { eligible, code, reason, writeAction }:
//   - eligible: boolean.
//   - code: código estável em EN (MISSING, PERMISSION, UNAVAILABLE, MALFORMED,
//     TRANSPORT, LIGHTWEIGHT, TAG-IDENTITY, SAFE-02, ELIGIBLE).
//   - reason: mensagem humana em PT-BR, nomeando o SHA, o status e a prova que
//     falhou — nunca valor de ambiente, cabeçalho ou rastro de execução.
//   - writeAction: sempre null (este contrato nunca autoriza escrita).
//
// Divergências de domínio e falhas de leitura retornam dados (fail-closed por
// dados, D-11): nenhuma falha de transporte escapa como rejeição.
// `throw` (sempre TypeError, mensagem em PT-BR) é reservado a entradas
// inválidas do chamador.

const FULL_SHA = /^[0-9a-f]{40}$/;
const VERSION = /^v\d+\.\d+\.\d+$/;
const REF_PREFIX = 'refs/tags/';

// Nomes PT-BR de cada leitura, usados no motivo humano dos códigos de falha.
const LEITURAS = {
  getTagRef: 'a referência da tag',
  getTagObject: 'o objeto da tag',
  getBranchHead: 'a cabeça do branch main',
};

// Famílias de status. A separação entre PERMISSION e UNAVAILABLE é
// intencional: um problema de credencial e um estado remoto indeterminado
// exigem ações diferentes do operador e não podem virar o mesmo código.
const STATUS_PERMISSAO = new Set([401, 403]);
const STATUS_INDETERMINADO = new Set([409, 422, 429]);

function invalid(message) {
  return new TypeError(message);
}

function isRecord(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function ineligible(code, reason) {
  return { eligible: false, code, reason, writeAction: null };
}

// Envelope sem `ok: true`. Um ramo por família de status; nenhum ramo senão o
// 404 pode devolver o código de ausência.
function envelopeNaoOk(status, leitura) {
  if (status === 404) {
    return ineligible(
      'MISSING',
      `Leitura de ${leitura} respondeu 404: o recurso não existe no remoto.`,
    );
  }
  if (STATUS_PERMISSAO.has(status)) {
    return ineligible(
      'PERMISSION',
      `Leitura de ${leitura} respondeu ${status}: a credencial do operador não tem permissão no recurso do repositório sendo lido.`,
    );
  }
  if (STATUS_INDETERMINADO.has(status) || (typeof status === 'number' && status >= 500)) {
    return ineligible(
      'UNAVAILABLE',
      `Leitura de ${leitura} respondeu ${status}: o estado remoto está indeterminado.`,
    );
  }
  return ineligible(
    'UNAVAILABLE',
    `Leitura de ${leitura} respondeu ${String(status)}: família de status desconhecida, estado remoto indeterminado.`,
  );
}

// Uma leitura, já normalizada. Devolve `{ decision }` quando a leitura falhou ou
// a resposta é malformada, e `{ envelope }` quando há envelope interpretável.
// A leitura que lança é capturada: a falha vira TRANSPORT e nunca rejeição.
async function readEnvelope(client, method, args) {
  const leitura = LEITURAS[method];
  let envelope;
  try {
    envelope = await client[method](...args);
  } catch {
    return {
      decision: ineligible(
        'TRANSPORT',
        `Leitura de ${leitura} não completou: a resposta não chegou e o estado remoto é desconhecido.`,
      ),
    };
  }
  if (!isRecord(envelope)) {
    return {
      decision: ineligible(
        'MALFORMED',
        `Leitura de ${leitura} não devolveu envelope: esperado um registro com ok, status e data.`,
      ),
    };
  }
  if (envelope.ok !== true) {
    return { decision: envelopeNaoOk(envelope.status, leitura) };
  }
  if (!Number.isFinite(envelope.status)) {
    return {
      decision: ineligible(
        'MALFORMED',
        `Leitura de ${leitura} tem status ausente ou não numérico: envelope malformado.`,
      ),
    };
  }
  if (!isRecord(envelope.data)) {
    return {
      decision: ineligible(
        'MALFORMED',
        `Leitura de ${leitura} tem data fora de formato: envelope malformado.`,
      ),
    };
  }
  return { envelope };
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

  // Salto 1: resolve refs/tags/<version>.
  const refRead = await readEnvelope(client, 'getTagRef', [version]);
  if (refRead.decision) return refRead.decision;
  const ref = refRead.envelope;

  const refObject = ref.data.object;
  if (!isRecord(refObject) || typeof refObject.sha !== 'string' || typeof refObject.type !== 'string') {
    return ineligible(
      'MALFORMED',
      `Referência da tag ${version} em formato inesperado: esperado data.object com sha e type.`,
    );
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
  const tagRead = await readEnvelope(client, 'getTagObject', [refObject.sha]);
  if (tagRead.decision) return tagRead.decision;
  const tagData = tagRead.envelope.data;

  if (
    typeof tagData.sha !== 'string' ||
    !isRecord(tagData.object) ||
    typeof tagData.object.sha !== 'string' ||
    typeof tagData.object.type !== 'string'
  ) {
    return ineligible(
      'MALFORMED',
      `Objeto da tag ${version} em formato inesperado: esperado data.sha e data.object com sha e type.`,
    );
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
  const headRead = await readEnvelope(client, 'getBranchHead', ['main']);
  if (headRead.decision) return headRead.decision;
  const headSha = headRead.envelope.data.sha;
  if (typeof headSha !== 'string') {
    return ineligible(
      'MALFORMED',
      'Cabeça remota do branch main em formato inesperado: esperado data.sha.',
    );
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
