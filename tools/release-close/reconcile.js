// Costura de reconciliação: o que uma leitura que falhou significa, e o que
// ler em seguida.
//
// É aqui que a resposta passa a viver em código de PRODUÇÃO. Antes do plano
// 09-09 a arapuca programável sabia produzir um tempo esgotado, uma resposta
// perdida, um 409, um 422, um 429 e um 5xx, e a única prova que existia chamava
// um método de leitura à mão: nenhum caminho de produção jamais teve de dizer
// o que uma leitura falhaída significava. A Fase 11 reusa esta forma para a
// escrita idempotente, e por isso o vocabulário de famílias, a regra da releitura
// única pela identidade natural e o nome do campo de recusa ficam FIXOS aqui,
// antes que exista qualquer escrita.
//
// O que esta costura é: a fronteira de ORQUESTRAÇÃO. Ela tem a sequência de
// leitura e o vocabulário de falha, e NÃO as regras de decisão. Por isso não
// importa `eligibility.js` nem `classify.js`: as duas camadas de decisão chegam
// como DADO, por `eligibility`, `classification` e pela dependência injetada
// `decide`. Injetar em vez de importar estático é o que mantém a fronteira de
// módulo e a prova de independência do classificador (09-05) de pé, e ainda
// permite decidir sobre o resultado de uma releitura em vez de sobre a tentativa
// que falhou.
//
// Por que as sete primeiras entradas são obrigatórias. Nenhuma das cinco
// leituras declaradas devolve evidência de CI, e nenhuma devolve a evidência
// normalizada de release e milestone — o bloco `ci` congelado e o construtor
// exportado de evidência são as únicas fontes. Uma costura que recebesse só o
// cliente, a versão e o SHA teria de inventar exatamente os fatos de CI e de
// release que esta fase existe para Emissionar de uma fonte nomeada, e por isso
// cada ausência é recusada com TypeError e mensagem em PT-BR que nomeia a
// entrada.
//
// Contrato observável, e ele é curto de propósito: falhou, releu uma vez pela
// MESMA identidade, e então decidiu ou recusou. Não há contagem de tentativas,
// backoff, sono nem limite de repetição: um laço de releitura ilimitado seria
// exatamente a negação de "releitura única pela identidade natural". A releitura
// nunca recebe o plano de falhas de novo, de modo que uma falha roteirizada não
// se roteiriza duas vezes — e o `decide` injetado é chamado SEM plano.
//
// Normalização por status, com os MESMOS nomes de código que o predicado de
// elegibilidade já usa, para que o operador não tenha de aprender dois
// vocabulários: 404 é ausência, 401/403 é recusa de permissão, 409/422/429 e
// qualquer 5xx são remoto indisponível de estado indeterminado, envelope fora
// de formato é malformado, e leitura que lança é transporte. Nenhuma delas
// pode virar elegibilidade, e nenhuma delas vira "o recurso não existe": o
// motivo em PT-BR diz sempre que o estado remoto é desconhecido e não ausente.
//
// O campo de recusa chama-se `writeProposed` e NÃO se chama `applyLiberado`.
// `applyLiberado` tem UM significado no repositório — tag elegível sem estado
// bloqueante, no objeto de plano montado pelos planos 09-05 e 09-07, onde um
// no-op concluído corretamente reporta verdadeiro. Dar ao mesmo nome um segundo
// significado aqui faria um único campo carregar duas leituras contraditórias, e
// o caso em que os dois legitimamente discordam — o no-op concluído — deixaria de
// ser distinguível de um defeito. Aqui `writeProposed: false` significa apenas
// que a costura não propõe escrita, e nunca que o alvo está bloqueado.
//
// Sem relógio, sem ambiente, sem rede, sem subprocesso e sem disco. O único
// módulo importado é o contrato do cliente, e dele vêm as cinco identidades de
// leitura, a forma exata do cliente e o invariante compartilhado de zero
// mutação.

import { READ_METHODS, assertClientShape, assertNoMutation } from './client.js';

// SHA completo em hexadecimal minúsculo: um valor abreviado nunca identifica um
// objeto, e a identidade natural da releitura do objeto da tag tem de ser a
// completa.
const SHA_COMPLETO = /^[0-9a-f]{40}$/;

// As cinco entradas obrigatórias, mais a camada de decisão injetada. São
// nomeadas aqui para que a recusa de cada ausência seja escrita a partir de uma
// lista, e não repetida oito vezes com o risco de duas delas divergirem.
const ENTRADAS_OBRIGATORIAS = [
  { nome: 'client', presente: (v) => v !== null && typeof v === 'object' },
  { nome: 'version', presente: (v) => typeof v === 'string' && v.length > 0 },
  { nome: 'expectedSha', presente: (v) => typeof v === 'string' && v.length > 0 },
  { nome: 'ci', presente: (v) => v !== null && typeof v === 'object' && !Array.isArray(v) },
  { nome: 'evidence', presente: (v) => v !== null && typeof v === 'object' && !Array.isArray(v) },
  { nome: 'eligibility', presente: (v) => v !== null && typeof v === 'object' && !Array.isArray(v) },
  { nome: 'classification', presente: (v) => v !== null && typeof v === 'object' && !Array.isArray(v) },
  { nome: 'decide', presente: (v) => typeof v === 'function' },
];

// Nome humano de cada leitura, usado nos motivos PT-BR junto do nome do método
// — o operador recebe os dois, e o método é o que casa com o log de chamadas.
const LEITURAS = {
  getTagRef: 'a referência da tag',
  getTagObject: 'o objeto da tag',
  getBranchHead: 'a cabeça do branch main',
  getReleaseByTag: 'a Release da versão pedida',
  listMilestones: 'a lista de Milestones',
};

// Branch principal: o nome é parte da identidade natural da leitura, e um nome
// diferente seria uma releitura de outro objeto.
const BRANCH = 'main';

// As mesmas separação de famílias do predicado de elegibilidade. Recusa de
// credencial e estado remoto indeterminado pedem ações opostas do operador e
// não podem virar o mesmo código.
const STATUS_PERMISSAO = new Set([401, 403]);
const STATUS_INDETERMINADO = new Set([409, 422, 429]);

function isRecord(valor) {
  return valor !== null && typeof valor === 'object' && !Array.isArray(valor);
}

function nomeDaLeitura(leitura) {
  return `${leitura} (${LEITURAS[leitura] ?? 'leitura declarada'})`;
}

function familiaTransporte(leitura) {
  return {
    code: 'TRANSPORT',
    reason: `Falha de transporte na leitura de ${nomeDaLeitura(leitura)}: a leitura não completou e o estado remoto é desconhecido, não ausente.`,
  };
}

function familiaMalformada(leitura) {
  return {
    code: 'MALFORMED',
    reason: `Leitura de ${nomeDaLeitura(leitura)} devolveu resposta fora de formato: o estado remoto é desconhecido, não ausente.`,
  };
}

// Um ramo por família de status. Só o 404 devolve ausência — e ele a devolve
// como ausência PROVADA, porque é o único status que a prova.
function familiaDeEnvelope(status, leitura) {
  if (status === 404) {
    return {
      code: 'MISSING',
      reason: `Leitura de ${nomeDaLeitura(leitura)} respondeu 404: o recurso não existe no remoto.`,
    };
  }
  if (STATUS_PERMISSAO.has(status)) {
    return {
      code: 'PERMISSION',
      reason: `Leitura de ${nomeDaLeitura(leitura)} respondeu ${status}: a credencial do operador não alcança o recurso, e o estado remoto é desconhecido, não ausente.`,
    };
  }
  if (STATUS_INDETERMINADO.has(status) || (typeof status === 'number' && status >= 500)) {
    return {
      code: 'UNAVAILABLE',
      reason: `Leitura de ${nomeDaLeitura(leitura)} respondeu ${status}: o estado remoto está indeterminado, e é desconhecido, não ausente.`,
    };
  }
  return {
    code: 'UNAVAILABLE',
    reason: `Leitura de ${nomeDaLeitura(leitura)} respondeu ${String(status)}: família de status desconhecida, e o estado remoto é indeterminado e não ausente.`,
  };
}

// Identidade natural de cada leitura, resolvida a partir do que o chamador já
// carrega. `getTagObject` não aparece aqui: a identidade dela é o SHA do objeto
// da tag, e esse SHA só existe depois do primeiro salto — a exceção é tratada
// pelo chamador, que faz o salto e o registra na sequência observada.
function identidadeDireta(leitura, version) {
  if (leitura === 'getTagRef') return { argumentos: [version], identidade: version };
  if (leitura === 'getBranchHead') return { argumentos: [BRANCH], identidade: BRANCH };
  if (leitura === 'getReleaseByTag') return { argumentos: [version], identidade: version };
  if (leitura === 'listMilestones') return { argumentos: [], identidade: 'todas' };
  return null;
}

// A leitura nomeada primeiro pelo plano de falhas, ou null quando não há plano.
// O plano é um PONTEIRO declarado, nunca uma fonte de família: a família vem do
// que o cliente realmente fez, observada nesta chamada. Um plano que nomeia uma
// leitura fora da interface é recusado pelo nome — ele declararia uma capacidad
// que o contrato de somente leitura não tem.
function leituraAlvo(failurePlan) {
  if (failurePlan === undefined || failurePlan === null) return null;
  if (!isRecord(failurePlan)) {
    throw new TypeError(
      'Plano de falhas inválido: esperado um objeto com chaves entre as cinco leituras declaradas.',
    );
  }
  const nomes = Object.keys(failurePlan);
  if (nomes.length === 0) return null;
  const primeiro = nomes[0];
  if (!READ_METHODS.includes(primeiro)) {
    throw new TypeError(
      `Plano de falhas inválido: leitura desconhecida: ${primeiro}. As cinco leituras declaradas são ${READ_METHODS.join(', ')}.`,
    );
  }
  return primeiro;
}

// Uma tentativa. A leitura que lança é CAPTURADA e vira a família de transporte
// em vez de escapar como rejeição — é a diferença entre uma falha que o
// operador vê e um processo que morre. Cada tentativa vira uma entrada na
// sequência observada, com o método, a identidade usada e o desfecho, para que
// uma releitura por outra identidade seja VISÍVEL e não apenas plausível.
async function tentar(client, leitura, argumentos, identidade, leituras, extrair) {
  const tentativa = leituras.length + 1;
  const registrar = (desfecho, familia) => {
    const entrada = { leitura, identidade, tentativa, desfecho };
    if (familia !== undefined) entrada.familia = familia;
    leituras.push(entrada);
  };
  let envelope;
  try {
    envelope = await client[leitura](...argumentos);
  } catch {
    const falha = familiaTransporte(leitura);
    registrar('falhou', falha.code);
    return { falha };
  }
  if (!isRecord(envelope)) {
    const falha = familiaMalformada(leitura);
    registrar('falhou', falha.code);
    return { falha };
  }
  if (envelope.ok !== true) {
    const falha = familiaDeEnvelope(envelope.status, leitura);
    registrar('falhou', falha.code);
    return { falha };
  }
  if (extrair !== undefined) {
    const extraido = extrair(envelope, leitura);
    if (extraido.falha) {
      registrar('falhou', extraido.falha.code);
      return extraido;
    }
    registrar('respondeu');
    return { valor: extraido.valor };
  }
  registrar('respondeu');
  return { envelope };
}

// A decisão devolvida tem sempre a mesma forma, qualquer que seja o desfecho:
// as três decisões sobre as quais ela decidiu, a sequência de leituras
// observada, a contagem MEDIDA de mutações, a família e o motivo da recusa (nulos
// quando nada falhou) e os dois campos de recusa de escrita. `applyLiberado` não
// aparece: ele pertence ao objeto de plano, e a regra dos códigos bloqueantes
// está lá — não aqui.
function montar({ client, evidence, eligibility, classification, leituras, family, reason, recovered }) {
  return {
    evidence,
    eligibility,
    classification,
    reads: leituras,
    mutations: assertNoMutation(client),
    family,
    reason,
    recovered,
    writeAction: null,
    writeProposed: false,
  };
}

export async function reconciliar({ client, version, expectedSha, ci, evidence, eligibility, classification, decide, failurePlan }) {
  const recebidas = { client, version, expectedSha, ci, evidence, eligibility, classification, decide };
  for (const regra of ENTRADAS_OBRIGATORIAS) {
    if (!regra.presente(recebidas[regra.nome])) {
      throw new TypeError(
        `Entrada inválida: a costura de reconciliação exige a entrada ${regra.nome}, e ela está ausente ou fora de formato. Uma decisão não pode sair de um conjunto de evidência que o repositório não detém.`,
      );
    }
  }
  // A forma exata do cliente é a mesma do contrato: um cliente com uma
  // capacidade a mais alcançaria a costura, e é recusado pelo nome.
  assertClientShape(client);

  const leituras = [];
  const alvo = leituraAlvo(failurePlan);
  if (alvo === null) {
    return montar({ client, evidence, eligibility, classification, leituras, family: null, reason: null, recovered: false });
  }

  let leitura = alvo;
  let argumentos = identidadeDireta(alvo, version);
  let identidade = argumentos === null ? null : argumentos.identidade;
  if (argumentos === null) {
    // `getTagObject` só tem identidade natural depois do primeiro salto: o SHA
    // do objeto da tag. O salto é a releitura pela identidade natural DELE, e
    // entra na sequência observada — em silêncio ele tornaria a sequência
    // incompleta, e uma releitura de outra identidade pareceria a mesma coisa.
    const salto = await tentar(client, 'getTagRef', [version], version, leituras, extrairShaDaTag);
    if (salto.falha) {
      const releitura = await tentar(client, 'getTagRef', [version], version, leituras);
      if (releitura.falha) {
        return montar({ client, evidence, eligibility, classification, leituras, family: releitura.falha.code, reason: releitura.falha.reason, recovered: false });
      }
      return montar({ client, evidence, eligibility, classification, leituras, family: null, reason: null, recovered: true });
    }
    leitura = alvo;
    argumentos = { argumentos: [salto.valor], identidade: salto.valor };
    identidade = salto.valor;
  }

  const primeira = await tentar(client, leitura, argumentos.argumentos, identidade, leituras);
  if (primeira.falha) {
    // A releitura é da MESMA identidade: a tag pela versão pedida, o objeto da
    // tag pelo SHA completo, a cabeça pelo nome do branch, a release pela versão
    // e a lista de milestones inteira. Uma identidade vizinha reconciliaria
    // contra outro objeto e o erro não apareceria em lugar nenhum.
    const releitura = await tentar(client, leitura, argumentos.argumentos, identidade, leituras);
    if (releitura.falha) {
      // Falhou de novo: a costura RECUSA, com a família da SEGUNDA falha. Ela
      // não devolve a tentativa que falhou como se fosse uma decisão.
      return montar({ client, evidence, eligibility, classification, leituras, family: releitura.falha.code, reason: releitura.falha.reason, recovered: false });
    }
    // Respondeu: a decisão passa a vir da releitura, e não da tentativa que
    // falhou. O `decide` injetado é chamado SEM plano de falhas — é a mesma
    // camada de decisão de produção, re-derivando as mesmas três sobre as
    // leituras que agora responderam.
    const rederivado = await decide({ client, version, expectedSha, ci });
    return montar({ client, evidence: rederivado.evidence, eligibility: rederivado.eligibility, classification: rederivado.classification, leituras, family: null, reason: null, recovered: true });
  }

  return montar({ client, evidence, eligibility, classification, leituras, family: null, reason: null, recovered: false });
}

// O salto do objeto da tag só vale se trouxer o SHA completo de 40 hex. Um
// envelope `ok` sem ele é resposta malformada, e a releitura do objeto da tag
// por um prefixo reconciliaria contra um objeto que ela não provou ser.
function extrairShaDaTag(envelope) {
  const objeto = isRecord(envelope.data) ? envelope.data.object : null;
  if (!isRecord(objeto) || typeof objeto.sha !== 'string' || !SHA_COMPLETO.test(objeto.sha)) {
    return {
      falha: {
        code: 'MALFORMED',
        reason: `Leitura de ${nomeDaLeitura('getTagRef')} respondeu ok sem o SHA completo de 40 caracteres hexadecimais que identifica o objeto da tag: o estado remoto é desconhecido, não ausente.`,
      },
    };
  }
  return { valor: objeto.sha };
}
