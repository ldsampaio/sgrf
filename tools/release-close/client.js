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
//
// A superfície é EXATA (plano 09-06, T-09-06-01): os cinco métodos declarados
// e nada mais que o chamador possa invocar. Uma verificação de "métodos
// obrigatórios" tolerava qualquer capacidade extra — foi assim que uma escrita
// remota pôde rodar enquanto o contador de mutações continuava em zero.
//
// O invariante `assertNoMutation` é a outra metade do mesmo fechamento: ele
// transforma a contagem medida em uma condição de decisão, em vez de um valor
// renderizado.

export const READ_METHODS = [
  'getTagRef',
  'getTagObject',
  'getBranchHead',
  'getReleaseByTag',
  'listMilestones',
  'listCiRuns',
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
  // Superfície exata: qualquer chamável próprio que não seja uma das cinco
  // leituras declaradas é uma capacidade que o contrato alcança, e é recusada
  // pelo nome. Isto é estrutural, não uma lista de nomes proibidos — uma
  // capacidade com nome não óbvio, ou uma capacidade em forma de array, cai
  // aqui do mesmo modo.
  //
  // Membros não chamáveis (log de chamadas, contador, registro de efeitos)
  // continuam permitidos: são contabilidade, não capacidade. Membros herdados e
  // não enumeráveis ficam fora, porque não são o que o chamador lê no objeto
  // devolvido; as duas rotas que isso deixa de fora têm cobertura própria — o
  // cliente fake é congelado (anexar membro é TypeError) e o grupo canary barra
  // a cópia por espalhamento.
  for (const membro of Object.keys(client)) {
    if (typeof client[membro] === 'function' && !READ_METHODS.includes(membro)) {
      throw new TypeError(
        `Superfície de cliente inválida: capacidade extra "${membro}" não pertence aos cinco métodos de leitura; o cliente do release-close é somente leitura.`,
      );
    }
  }
  return true;
}

// Invariante compartilhado de zero mutação (plano 09-06, T-09-06-02).
//
// Recebe um registro MEDIDO — um contador de mutações inteiro não negativo e,
// opcionalmente, a lista de efeitos colaterais observados — e devolve a contagem
// quando ela é exatamente zero. Qualquer outra contagem recusa.
//
// Não existe caminho de reset, perdão ou subtração: a única comparação é contra
// zero, e o parâmetro é único, de modo que um chamador não consegue relaxar o
// critério. Uma medição ausente, negativa, fracionária ou não numérica é uma
// FALHA do contrato de leitura, não um passe: o invariante prefere recusar a
// aceitar um contador que ninguém produziu.
export function assertNoMutation(measured) {
  if (!measured || typeof measured !== 'object') {
    throw new TypeError(
      'Medição de mutações ausente: o invariante exige um registro com o contador medido.',
    );
  }
  const contagem = measured.mutations;
  if (typeof contagem !== 'number' || !Number.isInteger(contagem) || contagem < 0) {
    throw new TypeError(
      `Medição de mutações inválida: o contador precisa ser um inteiro não negativo, e veio ${String(contagem)}. Uma medição ausente ou corrompida é falha do contrato de leitura, não um passe.`,
    );
  }
  if (contagem === 0) return 0;
  const efeitos = Array.isArray(measured.writes) ? measured.writes : [];
  const primeiro = efeitos.find((efeito) => efeito && typeof efeito === 'object');
  const capacidade =
    primeiro && typeof primeiro.capability === 'string' && primeiro.capability.length > 0
      ? ` Capacidade observada: ${primeiro.capability}.`
      : '';
  throw new TypeError(
    `Efeito remoto escapou do contrato somente leitura: contador de mutações medido = ${contagem}.${capacidade} Nenhuma decisão prossegue com contagem diferente de zero.`,
  );
}
