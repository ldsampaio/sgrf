#!/usr/bin/env node
// release-close: ferramenta do operador (verify / plan / apply).
//
// Invocação: node tools/release-close/release-close.js <verify|plan|apply> ...
// Zero dependências, ESM. `verify` e `plan` servem o fixture de referência via
// fake-client e são somente-leitura: ambos carregam a contagem de mutações
// MEDIDA na fronteira de escrita e validada pelo invariante compartilhado de
// zero mutação, nunca um literal. `apply` renderiza o plano ordenado (previsão
// da ordem de recuperação da Fase 11), entrega o texto ao portão de dupla
// trava (apply-gate.js) e falha fechado — nenhum caminho de escrita remota
// existe nesta fase.
//
// A ferramenta nunca abre subprocesso, nunca lê variáveis de ambiente de
// credencial e nunca registra cabeçalhos — a saída limita-se aos campos da
// decisão, ao plano ordenado e ao contador mutations.
//
// Importar este módulo é seguro e sem efeito colateral: a CLI só roda no caso
// de script de entrada, e nesse caso o código de saída é atribuído a
// `process.exitCode` em vez de terminar o processo. Um `process.exit`
// truncaria a saída em buffer nos caminhos com pipe que a suíte SAFE-04
// exercita, além de matar qualquer importador (WR-04).

import { readFileSync, realpathSync } from 'node:fs';
import { createInterface } from 'node:readline';
import { pathToFileURL } from 'node:url';
import { checkTagEligibility } from './eligibility.js';
import { classifySnapshot } from './classify.js';
import { makeFakeClient } from './fake-client.js';
import { ghClient } from './gh-client.js';
import { assertNoMutation } from './client.js';
import { confirmApply, canonicalReviewedDigest } from './apply-gate.js';
import { reconciliar } from './reconcile.js';

// A serialização do conteúdo revisado é reexportada, e não reimplementada aqui.
// Um consumidor a jusante (a reconciliação da Fase 11, a procedimento do
// operador da Fase 13) que importasse só este módulo precisa poder RECALCULAR o
// digest que o portão recalcula, e precisa ser a mesma função — duas cópias
// divergiriam em silêncio.
export { canonicalReviewedDigest, renderReviewedText } from './apply-gate.js';

const USAGE = `Uso: node tools/release-close/release-close.js <verify|plan|apply> [opções]

Verbos:
  verify            verifica o estado do remoto: tag, main, CI, Release, Milestone
  plan              mostra o plano ordenado de fechamento (somente leitura, mutations: 0)
  apply             mostra o mesmo plano e exige --yes + terminal interativo + "sim"

Opções:
  --help            mostra esta ajuda
  --json            saída em JSON (verify/plan: decisão + mutations; plan: passos; apply: plano antes do texto humano)
  --yes             confirmação explícita exigida pelo apply (nunca substitui o prompt)
  --fixture         ativa o cliente fake (sem rede; para testes)
  --repo <o/r>      repositório alvo (opaco nesta fase)
  --version <v>     versão da tag (padrão: v0.1.1 do fixture)
  --sha <sha>       SHA esperado (padrão: expectedSha do fixture)

Códigos de saída: 0 elegível/plano liberado/ajuda, 1 inelegível/recusa/entrada
inválida, 2 erro de uso. Nenhum verbo escreve no remoto nesta fase.
`;

// Estados que impedem qualquer passo de escrita: o plano aparece, o apply
// recusa antes de qualquer prompt.
const BLOCKING_CODES = ['FAILED', 'CONCURRENT', 'CONFLICTING', 'DUPLICATE'];

// Marcadores de destino de cada passo (D-15): o que será criado, o que será
// adotado e o que é apenas leitura de confirmação.
const MARKERS = { create: 'criar', adopt: 'adotar', read: 'ler' };
const MARKER_VERBS = { criar: 'Criar', adotar: 'Adotar', ler: 'Reler' };

// Ordem fixa de recuperação: rascunho, releitura, publicação, releitura,
// abertura da milestone, releitura, fechamento, releitura final (D-15).
const CLOSE_STEP_SPECS = [
  {
    ordem: 1,
    id: 'release-rascunho',
    alvo: 'release',
    modo: 'escrita',
    assunto: (ctx) => `o rascunho da Release ${ctx.version} no commit ${ctx.commitSha}`,
  },
  {
    ordem: 2,
    id: 'release-rascunho-readback',
    alvo: 'release',
    modo: 'leitura',
    assunto: (ctx) => `o rascunho da Release ${ctx.version} (id, tag e alvo)`,
  },
  {
    ordem: 3,
    id: 'release-publicar',
    alvo: 'release',
    modo: 'escrita',
    assunto: (ctx) => `a publicação da Release ${ctx.version}`,
  },
  {
    ordem: 4,
    id: 'release-publicada-readback',
    alvo: 'release',
    modo: 'leitura',
    assunto: (ctx) => `a Release ${ctx.version} já publicada`,
  },
  {
    ordem: 5,
    id: 'milestone-abrir',
    alvo: 'milestone',
    modo: 'escrita',
    assunto: (ctx) => `a Milestone ${ctx.version}`,
  },
  {
    ordem: 6,
    id: 'milestone-readback',
    alvo: 'milestone',
    modo: 'leitura',
    assunto: (ctx) => `a Milestone ${ctx.version} aberta`,
  },
  {
    ordem: 7,
    id: 'milestone-fechar',
    alvo: 'milestone',
    modo: 'escrita',
    assunto: (ctx) => `o fechamento da Milestone ${ctx.version}`,
  },
  {
    ordem: 8,
    id: 'milestone-readback-final',
    alvo: 'milestone',
    modo: 'leitura',
    assunto: (ctx) => `a Milestone ${ctx.version} fechada junto da Release ${ctx.version} publicada`,
  },
];

// ÚNICO ponto do módulo que alcança os fluxos globais do processo, e ele é
// resolvido na CHAMADA, nunca capturado na importação. Um chamador que injeta
// os seus sinks vê toda a saída nos sinks e os fluxos reais ficam intocados;
// um renderizador que escrevesse direto no global burlaria essa separação, e a
// varredura estática de evidence.test.js confere que não existe tal ponto.
function fluxosPadrao() {
  return { stdin: process.stdin, stdout: process.stdout, stderr: process.stderr };
}

function usageError(message, err) {
  err.write(`${message}\n${USAGE}`);
  return 2;
}

function parseArgs(argv) {
  const args = { verb: null, help: false, json: false, yes: false, fixture: false, repo: null, version: null, sha: null };
  const positionals = [];
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (token === '--help') {
      args.help = true;
    } else if (token === '--json') {
      args.json = true;
    } else if (token === '--yes') {
      args.yes = true;
    } else if (token === '--fixture') {
      args.fixture = true;
    } else if (token === '--repo' || token === '--version' || token === '--sha') {
      const value = argv[i + 1];
      if (value === undefined || value.startsWith('--')) {
        return { error: `Opção ${token} exige um valor.` };
      }
      i += 1;
      if (token === '--repo') args.repo = value;
      else if (token === '--version') args.version = value;
      else args.sha = value;
    } else if (token.startsWith('--')) {
      return { error: `Opção desconhecida: ${token}.` };
    } else {
      positionals.push(token);
    }
  }
  if (positionals.length > 1) {
    return { error: `Verbo inválido: esperado um de verify, plan ou apply.` };
  }
  if (positionals.length === 1) {
    args.verb = positionals[0];
  }
  return { args };
}

function loadReferenceFixture() {
  const url = new URL('./fixtures/reference.json', import.meta.url);
  return JSON.parse(readFileSync(url, 'utf8'));
}

// Evidência de PRODUÇÃO no contrato de cinco chaves que o classificador exige.
// Cada valor tem a fonte nomeada, e nenhuma delas é "um valor que a ferramenta
// possa inventar":
//
//   target     — a versão pedida e o SHA esperado já resolvidos pela CLI;
//   ci         — cópia byte a byte do bloco ci CONGELADO do snapshot. Nenhuma
//                das cinco leituras declaradas devolve CI, e o bloco congelado
//                de fixtures/reference.json é a única fonte de CI do
//                repositório (09-05 task 1). O construtor nunca constrói,
//                nunca infere e nunca inventa um padrão: sem bloco, `ci` fica
//                ausente e a violação de contrato do classificador aparece
//                como recusa de entrada inválida — nunca como execução verde.
//   releases   — o payload `data` da resposta de getReleaseByTag. Um registro
//                vira lista de um elemento; um array é retido INTEIRO, para
//                que uma carga de duplicata ou de conflito sobreviva. Nunca se
//                seleciona o primeiro elemento e nunca se descarta um
//                registro: os que não casam com o alvo não são apagados, são
//                partcionados pelo classificador em `unrelatedReleases`.
//   milestones — o array `data` da resposta de listMilestones, retido por
//                completo, com o mesmo motivo.
//   closeMarkers — lista vazia. O vocabulário de marcadores pertence à
//                reconciliação da Fase 11, e nenhuma das cinco leituras o
//                devolve.
//
// A tradução de envelope para lista acontece AQUI e em mais lugar nenhum:
// `snapshot.release` e `snapshot.milestones` são envelopes `ok` que o cliente
// serve, e o classificador lê listas.
export function buildCloseEvidence({ version, expectedSha, ci, release, milestones }) {
  if (typeof version !== 'string' || version.length === 0) {
    throw new TypeError('Entrada inválida: a versão pedida é obrigatória para montar a evidência.');
  }
  if (typeof expectedSha !== 'string' || expectedSha.length === 0) {
    throw new TypeError('Entrada inválida: o SHA esperado é obrigatório para montar a evidência.');
  }
  return {
    target: { version, expectedSha },
    ci,
    releases: normalizarLista(release, 'getReleaseByTag'),
    milestones: normalizarLista(milestones, 'listMilestones'),
    closeMarkers: [],
  };
}

// Envelope `{ ok, status, data }` -> lista de evidência. Ausente (404) vira
// lista vazia; `data` que já é lista é copiado inteiro; `data` que é um único
// registro vira lista de um elemento.
//
// O 404 é a ÚNICA entrada que produz lista vazia, e ele chega aqui por uma
// porta só: `lerEvidencia` já recusou todo envelope que não seja `ok` com um
// status diferente de 404. A guarda abaixo é a segunda barreira, e ela existe
// para que uma chamada direta a `buildCloseEvidence` — que é exportado — não
// reintroduza o fail-OPEN que a fase 09 tem de não ter: um envelope que não se
// prova `ok` não pode virar ausência silenciosa.
function normalizarLista(envelope, metodo) {
  // Ausência de envelope é ausência de REGISTRO, não prova de ausência remota:
  // uma leitura que não devolveu envelope não chegou a dizer nada sobre o
  // remoto. O 404 é a única ausência que um envelope pode provar.
  if (envelope === undefined || envelope === null) {
    throw new RecusaDeLeitura(
      `Leitura de ${metodo ?? 'de evidência'} não devolveu envelope: esperado um registro com ok, status e data.`,
    );
  }
  if (envelope.ok !== true) {
    if (envelope.status === 404) return [];
    throw new RecusaDeLeitura(
      `Leitura de ${metodo ?? 'de evidência'} respondeu ${String(envelope.status)}: o estado remoto está indeterminado, e só o 404 prova ausência.`,
    );
  }
  const data = envelope.data;
  if (Array.isArray(data)) return [...data];
  if (data === null || data === undefined) return [];
  return [data];
}

// Uma leitura de evidência, guardada. Devolve o envelope INTEIRO, nunca uma
// lista: a tradução é de `normalizarLista`, e uma lista construída aqui
// perderia o status que distingue ausência de falha.
//
// Um throw é TRANSPORT — a leitura não completou e o estado remoto é
// desconhecido. Um envelope sem `ok` segue a mesma tabela que
// `readEnvelope` aplica às três leituras de elegibilidade: 404 é ausência
// provada, 401/403 é PERMISSION, e todo o resto é UNAVAILABLE. Em nenhum caso
// o retorno é uma lista vazia que o classificador leria como "não existe".
//
// Um envelope que nem é registro é MALFORMED, e este é um VEREDITO, não uma
// recusa: é a mesma distinção que `readEnvelope` faz para as três leituras de
// elegibilidade, que devolvem MALFORMED como decisão em vez de lançar. Devolver
// o envelope intacto deixa `normalizarLista` recusar com a família certa, e
// mantém a medição do invariante como a última linha — a recusa de medição
// corrompida continua alcançável, porque ela vem depois das leituras.
async function lerEvidencia(client, metodo, ...args) {
  let envelope;
  try {
    envelope = await client[metodo](...args);
  } catch {
    throw new RecusaDeLeitura(
      `Falha de transporte na leitura de ${metodo}: a leitura não completou e o estado remoto é desconhecido, não ausente.`,
    );
  }
  // Um envelope que não é registro NÃO recusa aqui: `readEnvelope` devolve
  // MALFORMED como veredito para as três leituras de elegibilidade, e este é o
  // mesmo caso. Ele segue intacto para `normalizarLista`, que o rejeita como
  // envelope fora de formato. Assim a medição do invariante — que vem depois
  // das leituras — continua sendo alcançável, como a suíte exige.
  if (envelope === null || typeof envelope !== 'object' || Array.isArray(envelope)) {
    return envelope;
  }
  if (envelope.ok === true) return envelope;
  if (envelope.status === 404) return envelope;
  if (envelope.status === 401 || envelope.status === 403) {
    throw new RecusaDeLeitura(
      `Leitura de ${metodo} respondeu ${envelope.status}: a credencial do operador não alcança o recurso, e o estado remoto é desconhecido, não ausente.`,
    );
  }
  // Todo status que não prova ausência segue como envelope para a tradução
  // recusar: 5xx, 429, status desconhecido e ausente numérico caem aqui.
  return envelope;
}

// Recusa do invariante compartilhado de zero mutação (09-06). É uma classe
// própria, e não um TypeError, porque a recusa NÃO é entrada inválida: são duas
// famílias que o próprio invariante nomeia no texto (efeito remoto escapou
// versus medição corrompida) e que pedem ações opostas do operador. Envolver o
// motivo preserva o texto do invariante atravessado intacto, sem reimplementar
// a classificação de família aqui e sem rotular um escape como entrada inválida.
class RecusaDoInvariante extends Error {
  constructor(motivo) {
    super(motivo);
    this.name = 'RecusaDoInvariante';
  }
}

// Recusa de INTEGRIDADE do conteúdo revisado, e uma terceira família: nem
// entrada inválida (a entrada é válida) nem escape remoto (nada foi escrito).
// São duas execuções da mesma serialização que discordaram, o que significa que
// o digest não é estável — e um digest instável nunca pode chegar ao operador,
// porque a aprovação dele não vincularia a nada. Classe própria para que a
// recusa sobreviva ao tratamento de erro da CLI com o seu texto intacto e
// continue distinguível das outras duas famílias.
class RecusaDeIntegridade extends Error {
  constructor(motivo) {
    super(motivo);
    this.name = 'RecusaDeIntegridade';
  }
}

// Recusa de LEITURA de evidência, e uma quarta família. As duas leituras de
// release e milestone são o único ponto onde uma falha de transporte ou um
// envelope fora de formato alcançavam o operador de duas formas ruins, e as
// duas são o mesmo defeito: a leitura não foi guardada.
//
// A catch (a leitura lança) chegava como crash, porque um Error genérico não é
// nenhuma das três classes que `tratarRecusa` reconhece. A não-catch era pior:
// `normalizarLista` converte QUALQUER envelope que não seja `ok` em lista
// vazia, então um 5xx ou um 429 viravam "nenhuma release existe" — a
// classificação MISSING e `applyLiberado: true`, com um plano byte a byte
// idêntico ao do caso honesto. Isso é fail-OPEN: a ferramenta respondia que o
// fechamento não existia quando na verdade não conseguira perguntar.
//
// Só 404 prova ausência. As duas leituras seguem a mesma regra que
// `readEnvelope` já aplica às três de elegibilidade, e por isso a ausência
// provada continua sendo lista vazia — agora por motivo, e não por descarte.
class RecusaDeLeitura extends Error {
  constructor(motivo) {
    super(motivo);
    this.name = 'RecusaDeLeitura';
  }
}

// A MEDIÇÃO do cliente, validada. O valor relatado ao operador é o que o
// invariante devolve, e o invariante devolve alguma coisa apenas quando a
// contagem é exatamente zero. Não existe caminho de fallback que renderize zero
// quando a medição falta: medição ausente ou corrompida é falha do contrato de
// leitura e recusa como tal.
function medirMutacoes(client) {
  try {
    return assertNoMutation(client);
  } catch (err) {
    throw new RecusaDoInvariante(err.message);
  }
}

// CAMADA de decisão de produção: a costuradora única da fase. Monta o cliente
// uma vez, percorre as cinco leituras declaradas e entrega ao classificador a
// evidência que elas produziram.
//
// A ordem é fixa e é a mesma que o log de chamadas da suíte de elegibilidade
// exige: as três leituras de tag e main primeiro, em ordem, e só então as duas
// de release e milestone. As três primeiras são feitas por
// `checkTagEligibility`, que é quem as consome — relê-las aqui para capturá-las
// inflaria o log para sete chamadas e apagaria a prova de que a decisão
// production exercita a costura real. As duas últimas são feitas aqui, sempre,
// mesmo quando a elegibilidade já short-circuitou, porque a evidência de
// release e milestone é o que o classificador precisa.
//
// `version`, `expectedSha` e `ci` chegam resolvidos ou saem do snapshot. `client`
// chega injetado ou é construído a partir do snapshot. `ci` nunca é derivado de
// outro valor: o que não foi fornecido e não está no snapshot fica ausente.
//
// Esta função é a dependência INJETADA na costura de reconciliação, e é
// exportada com nome próprio para que uma releitura possa re-derivar as mesmas
// três decisões sem voltar a entrar na costura. Ela não conhece a costura: o
// ciclo seria infinito.
export async function camadaDeDecisao({ snapshot, client, version, expectedSha, ci }) {
  const entrada = { snapshot, client, version, expectedSha, ci };
  if (
    (entrada.client === undefined || entrada.client === null) &&
    (entrada.snapshot === undefined || entrada.snapshot === null)
  ) {
    throw new TypeError('Entrada inválida: a decisão exige um cliente injetado ou um snapshot para construí-lo.');
  }
  const resolvedVersion = version ?? snapshot?.version;
  const resolvedSha = expectedSha ?? snapshot?.expectedSha;
  const resolvedCi = ci ?? snapshot?.ci;
  const resolvedClient = client ?? makeFakeClient(snapshot);

  // As três leituras de elegibilidade, na ordem fixa, através do cliente.
  const eligibility = await checkTagEligibility(resolvedClient, {
    version: resolvedVersion,
    expectedSha: resolvedSha,
  });

  // As duas leituras de evidência, na mesma ordem fixa. Elas correm
  // incondicionalmente: mesmo com a elegibilidade já decidida, a evidência de
  // release e milestone é obrigatória para classificar.
  //
  // As duas são guardadas com a mesma regra que `checkTagEligibility` aplica às
  // três de elegibilidade, e pelo mesmo motivo: são leituras remotas, e uma
  // leitura remota que falha não prova nada sobre o remoto. Um throw vira
  // recusa de família TRANSPORT, e um envelope que não é `ok` só vira lista
  // vazia quando o status é 404 — que é o único status que prova ausência.
  // Qualquer outro status recusa, nomeando a leitura e a família, em vez de
  // virar "não existe" e liberar o apply com um estado remoto desconhecido.
  const release = await lerEvidencia(resolvedClient, 'getReleaseByTag', resolvedVersion);
  const milestones = await lerEvidencia(resolvedClient, 'listMilestones');

  // O alvo resolvido entra no contrato: um override de `--version` ou `--sha`
  // flui para a classificação em vez de ser ignorado. Um override que deixa de
  // bater com o `ci.targetSha` congelado classifica como FAILED com a família
  // CI-WRONG-SHA, que é a resposta fail-closed correta.
  // A medição roda ANTES da construção da evidência, e continua antes de
  // qualquer renderização. A ordem importa: um cliente que não é medível é um
  // cliente corrompido, e essa é a família correta para recusá-lo — não a de
  // uma leitura malformada. Medindo depois, a tradução da evidência recusaria
  // primeiro um `undefined` de leitura e a recusa de medição ficaria
  // inalcançável.
  const mutations = medirMutacoes(resolvedClient);

  const evidence = buildCloseEvidence({
    version: resolvedVersion,
    expectedSha: resolvedSha,
    ci: resolvedCi,
    release,
    milestones,
  });
  const classification = classifySnapshot(evidence);

  return {
    version: resolvedVersion,
    expectedSha: resolvedSha,
    target: evidence.target,
    ci: resolvedCi,
    evidence,
    eligibility,
    classification,
    mutations,
    client: resolvedClient,
  };
}

// A decisão EXPORTADA: a camada de produção mais a costura de reconciliação.
//
// É aqui que as duas coisas ficam ligadas. A camada devolve as três decisões e a
// evidência que ela OBSERVOU — com a contagem medida já validada — e a costura
// recebe essas três como DADO, mais a camada injetada, e decide sobre a
// releitura quando alguma delas falhou. A costura não importa nem
// `eligibility.js` nem `classify.js`, e a CLI não passa a decisión para ela:
// as decisões são valores que a CLI já detém, e é por isso que a fronteira de
// módulo e a prova de independência do classificador continuam de pé.
//
// Cada uma das nove entradas da costura é nomeada aqui porque a costura não
// pode sourcingar nenhuma delas por si:
//
//   client       o cliente que a camada acabou de construir e usar
//   version      o valor já resolvido pela camada
//   expectedSha  o valor já resolvido pela camada
//   ci           cópia byte a byte do bloco ci que a camada recebeu — o
//               construtor exportado de evidência já o copiou para a própria
//               saída, e nenhuma das cinco leituras devolve CI
//   evidence     o objeto de cinco chaves que o construtor exportado devolveu,
//               passado adiante SEM reconstruir: reconstruir aqui devolveria um
//               objeto diferente, e a costura decidiria sobre uma evidência que
//               o classificador nunca viu
//   eligibility  a decisão da camada
//   classification a decisão da camada
//   decide       a própria camada de produção, injetada — NÃO a função
//               delegadora, para que a releitura rode as leituras, o construtor
//               e as duas decisões puras e PARE ali
//   failurePlan  só quando um chamador programático passou um; ausente por
//               omissão, e inalcançável pela linha de comando
//
// `failurePlan` é parâmetro PROGRAMÁTICO e não tem contraparte na linha de
// comando: o analisador de opções não tem chave para ele e o texto de uso não
// o menciona. Uma falha roteirizada é um artefato de teste, e um teste que
// precisa de uma opção nova na CLI está pedindo uma backdoor de produção.
export async function decide({ snapshot, client, version, expectedSha, ci, failurePlan }) {
  const base = await camadaDeDecisao({ snapshot, client, version, expectedSha, ci });
  // A medição é feita aqui, na função que a CLI chama, e não só dentro da
  // camada: o valor que o operador lê é o que a fronteira mediu, e a costura
  // mede de novo por conta própria depois das suas releituras.
  const mutations = medirMutacoes(base.client);
  const reconciliation = await reconciliar({
    client: base.client,
    version: base.version,
    expectedSha: base.expectedSha,
    ci: base.ci,
    evidence: base.evidence,
    eligibility: base.eligibility,
    classification: base.classification,
    decide: camadaDeDecisao,
    failurePlan,
  });
  return { ...base, mutations, reconciliation };
}

function resolveMarker(spec, ctx) {
  if (spec.modo === 'leitura') return MARKERS.read;
  if (spec.alvo === 'release') return ctx.releasePresente ? MARKERS.adopt : MARKERS.create;
  return ctx.milestonePresente ? MARKERS.adopt : MARKERS.create;
}

// Monta o plano ordenado: o que seria criado, o que seria adotado, em que
// ordem e contra quais SHAs/IDs congelados (D-15).
//
// `evidence` e `mutations` chegam da decisão de produção: o plano não reconstrói
// a evidência (reconstruir foi exatamente o defeito que colapsava duplicata e
// conflito) e não fixa a contagem (o literal `0` foi removido — o número
// relatado é a medição do invariante compartilhado, que já recusou qualquer
// contagem diferente de zero antes de este ponto).
//
// `tagSha` e `commitSha` continuam vindo dos envelopes de tag do snapshot, e
// isso é deliberado: `reference.json` é o snapshot no formato do cliente, ou
// seja, são exatamente os mesmos bytes que o cliente serviu e que as três
// leituras de elegibilidade provaram byte a byte. São campos de exibição do
// plano, não evidência de classificação — o classificador nunca os vê.
// Conteúdo revisado: o objeto IMUTÁVEL cujas duas frases o operador aprova, e
// o digest canônico que as amarra (T-09-08-02, T-09-08-03).
//
// A fonte de cada frase é nomeada e é a evidência que a decisão REALMENTE
// observeu pelo cliente — nunca o snapshot cru, nunca prosa de template, nunca a
// lista de passos:
//   releaseNotes              — o campo `notes` do registro de Release do alvo;
//   milestoneCompletionRecord — o campo `completionRecord` do registro de
//                               Milestone que nomeia a versão pedida.
//
// Sem release do alvo, sem milestone do alvo, ou qualquer um dos dois textos
// ausente ou em branco, NÃO há objeto revisado e NÃO há digest: o portão recusa
// na fechadura de conteúdo, e o renderizador diz isso em PT-BR em vez de
// inventar texto. Um digest sobre texto inventado vincularia a aprovação do
// operador a nada.
// O texto que o operador aprova é selecionado pela MESMA partição que o
// classificador aplicou, e não por um `find` próprio.
//
// A versão anterior casava `tagName === version` e `title === version` sobre a
// evidência bruta, o que é uma regra MAIS FRACA que a decisão que ela alimenta:
// o classificador já tinha sobrevivido a essa verificação. Medido em duas
// variantes, ambas com release e milestone do alvo de modo que o objeto
// revisado existisse:
//   A) release do alvo com `targetSha` divergente — o motivo do classificador
//      diz que "a divergência impede tratar o alvo como concluído", e mesmo
//      assim as notas aprovadas eram as da release de OUTRO commit, com
//      `applyLiberado: true`.
//   B) duas milestones do alvo com a primeira `open` — o `find` pegava a
//      primeira, e o registro aprovado era o da milestone ABERTA.
//
// A correção usa a partição validada como FONTE DA IDENTIDADE, sem duplicar a
// regra nem reintroduzi-la: `classificacao.releases` e `classificacao.milestones`
// são os registros que o classificador validou, e cada um traz `id`/`number`.
// A identidade é casada de volta na evidência bruta — que é a única fonte do
// texto, já que o classificador não vê texto por desenho — e o texto é lido de
// lá.
//
// A seleção é pelo MENOR id e pelo MENOR number, que é a ordenação
// determinística que o classificador já aplicou ao reter a partição: dois
// registros do alvo não podem render duas aprovações diferentes para a mesma
// execução.
//
// Se a partição não validar o alvo, não há objeto revisado e o portão recusa na
// fechadura de conteúdo. Aprovação sobre texto que a decisão rejeitou vincularia
// o digest a nada.
function montarConteudoRevisado({ evidencia, classificacao, version, expectedSha, commitSha }) {
  // Sem classificação, ou com um alvo que a classificação não validou, não há
  // texto aprovável. `targetShaValidates` é a resposta do classificador à
  // pergunta "o registro do alvo é este commit?"; a partição do alvo é a
  // resposta à "existem registros desta versão?".
  if (classificacao === undefined || classificacao === null) return null;
  if (classificacao.targetShaValidates !== true) return null;

  const particaoReleases = Array.isArray(classificacao.releases) ? classificacao.releases : [];
  const particaoMilestones = Array.isArray(classificacao.milestones) ? classificacao.milestones : [];
  if (particaoReleases.length === 0 || particaoMilestones.length === 0) return null;

  const menor = (lista, chave) =>
    lista.reduce((a, b) => (b[chave] ?? Infinity) < (a[chave] ?? Infinity) ? b : a);

  const alvoRelease = menor(particaoReleases, 'id');
  const alvoMilestone = menor(particaoMilestones, 'number');

  // A identidade validada é casada de volta na evidência bruta — a única fonte
  // do texto. `tagName`/`title` continuam conferidos como segunda barreira: se
  // a identidade não bater, não há objeto revisado em vez de um texto trocado.
  const release = evidencia.releases.find(
    (registro) => registro.tagName === version
      && (alvoRelease.id === null || registro.id === alvoRelease.id),
  );
  const milestone = evidencia.milestones.find(
    (registro) => registro.title === version
      && (alvoMilestone.number === null || registro.number === alvoMilestone.number),
  );
  if (release === undefined || milestone === undefined) return null;

  // A milestone aprovada tem de estar CONCLUÍDA. O classificador conta uma
  // milestone como concluída por `state === 'closed' && openIssues === 0`
  // (classify.js:402); aprovar o texto de uma milestone aberta aprobaria um
  // registro de um estado que a decisão trata como parcial.
  if (milestone.state !== 'closed' || milestone.openIssues !== 0) return null;

  const releaseNotes = release.notes;
  const milestoneCompletionRecord = milestone.completionRecord;
  if (typeof releaseNotes !== 'string' || releaseNotes.trim().length === 0) return null;
  if (typeof milestoneCompletionRecord !== 'string' || milestoneCompletionRecord.trim().length === 0) {
    return null;
  }
  return Object.freeze({ version, expectedSha, commitSha, releaseNotes, milestoneCompletionRecord });
}

export function buildClosePlan({
  version,
  expectedSha,
  snapshot,
  eligibility,
  classificacao,
  evidence,
  mutations,
  reconciliation,
}) {
  // A evidência de produção é a que a camada entregou. O caminho de reconstrução
  // a partir do snapshot existe para quem monta um plano sem decisão, e ele
  // precisa fornecer as DUAS leituras de evidência do próprio snapshot: sem
  // elas, `buildCloseEvidence` receberia `undefined` e recusaria — que é o
  // comportamento certo para uma leitura que não devolveu envelope, e não o
  // certo para um snapshot que tem os dois envelopes à mão.
  const evidencia = evidence ?? buildCloseEvidence({
    version,
    expectedSha,
    ci: snapshot.ci,
    release: snapshot.release,
    milestones: snapshot.milestones,
  });
  const tagSha =
    (snapshot.tagRef && snapshot.tagRef.data && snapshot.tagRef.data.object
      ? snapshot.tagRef.data.object.sha
      : null) ?? 'desconhecido';
  const commitSha =
    (snapshot.tagObject && snapshot.tagObject.data && snapshot.tagObject.data.object
      ? snapshot.tagObject.data.object.sha
      : null) ?? expectedSha;
  const ctx = {
    version,
    tagSha,
    commitSha,
    releasePresente: evidencia.releases.length > 0,
    milestonePresente: evidencia.milestones.length > 0,
  };
  const steps = CLOSE_STEP_SPECS.map((spec) => {
    const marcador = resolveMarker(spec, ctx);
    return {
      ordem: spec.ordem,
      id: spec.id,
      alvo: spec.alvo,
      modo: spec.modo,
      marcador,
      assunto: spec.assunto(ctx),
    };
  });
  // `applyLiberado` tem UM significado em toda a fase: tag elegível sem estado
  // bloqueante. MISSING não é um dos códigos bloqueantes, então um alvo já
  // fechado reporta applyLiberado true aqui — e a reconciliação da Fase 11
  // relata um campo de nome diferente (`writeProposed`), nunca derivado deste.
  const bloqueado = BLOCKING_CODES.includes(classificacao.code);
  // Uma RECUSA da costura bloqueia o plano, e por um motivo que não é o
  // estado: uma releitura que falhou de novo deixou o estado remoto
  // INDETERMINADO, e um estado indeterminado não é um estado limpo — liberá-lo
  // seria tratar "não sei" como "sei que está bem". É a regra que faz a
  // afirmação do plano se sustentar por conta própria, e não por acidente de
  // uma elegibilidade que também ficou falsa. Nenhum dos dois nomes de campo é
  // derivado do outro: `writeProposed` continua falso aqui E num plano liberado.
  const recusou = reconciliation !== null && reconciliation !== undefined && reconciliation.family !== null;
  const bloqueioPorEstado = bloqueado ? `estado ${classificacao.code}: ${classificacao.reason}` : null;
  const bloqueioPorRecusa = recusou
    ? `reconciliação recusada (${reconciliation.family}): ${reconciliation.reason}`
    : null;

  // O digest vem da ÚNICA função exportada de serialização, nunca de uma
  // segunda implementação local: um digest reimplementado aqui poderia divergir
  // do que o portão recalcula no momento da pergunta, e a divergência seria
  // silenciosa. É calculado DUAS vezes e as duas comparações têm de concordar —
  // um digest não determinístico recusaria aqui, e não depois, no portão, onde o
  // operador já teria lido um conteúdo que não corresponde a nada.
  const reviewed = montarConteudoRevisado({ evidencia, classificacao, version, expectedSha, commitSha });
  let reviewedDigest = null;
  if (reviewed !== null) {
    reviewedDigest = canonicalReviewedDigest(reviewed);
    const segunda = canonicalReviewedDigest(reviewed);
    if (segunda !== reviewedDigest) {
      throw new RecusaDeIntegridade(
        'Recusa: o digest do conteúdo revisado não é estável entre duas execuções; nenhum plano foi emitido.',
      );
    }
  }

  return {
    verb: 'plan',
    version,
    expectedSha,
    target: evidencia.target,
    tagSha,
    commitSha,
    runs: snapshot.runs ?? [],
    releasePresente: ctx.releasePresente,
    milestonePresente: ctx.milestonePresente,
    elegibilidade: eligibility,
    classificacao,
    evidencia,
    reviewed,
    reviewedDigest,
    reconciliation: reconciliation ?? null,
    applyLiberado: eligibility.eligible === true && bloqueado === false && recusou === false,
    bloqueio: bloqueioPorRecusa ?? bloqueioPorEstado,
    steps,
    mutations,
  };
}

export function renderPlanText(plan) {
  const linhas = [];
  linhas.push(`Plano de fechamento — versão ${plan.version} (Fase 9: previsão, sem escrita)`);
  linhas.push(`  tag anotada:    ${plan.tagSha}`);
  linhas.push(`  commit alvo:    ${plan.commitSha}`);
  linhas.push(`  SHA esperado:   ${plan.expectedSha}`);
  linhas.push(`  execuções:      ${plan.runs.length > 0 ? plan.runs.join(', ') : 'nenhuma'}`);
  linhas.push(`  elegibilidade:  ${plan.elegibilidade.code} — ${plan.elegibilidade.reason}`);
  linhas.push(`  classificação:  ${plan.classificacao.code} — ${plan.classificacao.reason}`);
  linhas.push(`  release atual:  ${plan.releasePresente ? 'presente (adotada)' : 'ausente (criada)'}`);
  linhas.push(`  milestone atual: ${plan.milestonePresente ? 'presente (adotada)' : 'ausente (criada)'}`);
  if (plan.bloqueio) {
    linhas.push(`  BLOQUEADO:      ${plan.bloqueio}`);
  }
  // O conteúdo revisado vem ANTES dos passos ordenados e do contador de
  // mutações, para que o conteúdo preceda a pergunta também na ordem visível e
  // não só na ordem dos bytes. O texto vem do fixture congelado; a ausência é
  // dita, nunca preenchida.
  if (plan.reviewed === null || plan.reviewed === undefined) {
    linhas.push('Conteúdo revisado: não há conteúdo revisado para este alvo (sem notas de Release e sem registro de conclusão de Milestone).');
  } else {
    linhas.push('Conteúdo revisado (Release e Milestone, texto congelado):');
    linhas.push(`  notas da Release:        ${plan.reviewed.releaseNotes}`);
    linhas.push(`  registro de conclusão:   ${plan.reviewed.milestoneCompletionRecord}`);
    linhas.push(`  digest do conteúdo:     ${plan.reviewedDigest}`);
  }
  linhas.push('Passos ordenados (a ordem de recuperação da Fase 11):');
  for (const step of plan.steps) {
    linhas.push(
      `  ${step.ordem}. [${step.marcador}] ${step.id} — ${MARKER_VERBS[step.marcador]} ${step.assunto}.`,
    );
  }
  linhas.push(`mutations: ${plan.mutations}`);
  return `${linhas.join('\n')}\n`;
}

function renderJson(payload, out) {
  out.write(`${JSON.stringify(payload)}\n`);
}

function renderVerifyText(decision, out) {
  const { eligibility, classification, evidence, mutations, version } = decision;
  const estado = eligibility.eligible ? 'ELEGÍVEL' : 'INELEGÍVEL';
  const mainOk = eligibility.eligible;
  out.write(
    `Tag ${version}: ${estado} (${eligibility.code})\n` +
      `Motivo: ${eligibility.reason}\n` +
      `Main: ${mainOk ? 'OK' : 'DIVERGENT'}\n` +
      `CI: ${classification.code === 'FAILED' ? 'BLOQUEADO' : 'OK'} (${classification.ciCode || 'success'})\n` +
      `Release: ${evidence.releases.length > 0 ? 'presente' : 'ausente'}\n` +
      `Milestone: ${evidence.milestones.length > 0 ? 'presente' : 'ausente'}\n` +
      `mutations: ${mutations}\n`,
  );
}

function renderVerifyJson(decision, out) {
  const { eligibility, classification, evidence, mutations, version } = decision;
  out.write(
    `${JSON.stringify({
      version,
      tag: { eligible: eligibility.eligible, code: eligibility.code, reason: eligibility.reason, writeAction: eligibility.writeAction },
      main: { ok: eligibility.eligible },
      ci: { code: classification.code, ciCode: classification.ciCode },
      release: { present: evidence.releases.length > 0, count: evidence.releases.length },
      milestone: { present: evidence.milestones.length > 0, count: evidence.milestones.length },
      mutations,
    })}\n`,
  );
}

// Recusa de entrada inválida: a violação de contrato do classificador (bloco ci
// ausente, alvo malformado) e a validação do chamador são a MESMA recusa de
// uso — a CLI escreve o motivo PT-BR e devolve 1. A recusa do invariante de
// mutação e a recusa de integridade do conteúdo revisado são outras coisas e
// têm os seus próprios textos, atravessados intactos, porque cada uma pede uma
// ação diferente do operador.
function tratarRecusa(err, stderr) {
  if (err instanceof RecusaDoInvariante || err instanceof RecusaDeIntegridade || err instanceof RecusaDeLeitura) {
    stderr.write(`${err.message}\n`);
    return 1;
  }
  if (err instanceof TypeError) {
    stderr.write(`Entrada inválida: ${err.message}\n`);
    return 1;
  }
  throw err;
}

async function runVerify({ json, version, sha, fixture }, io) {
  // Validação de entrada antes de qualquer leitura remota (SAFE-01).
  if (!version || !/^v\d+\.\d+\.\d+$/.test(version)) {
    io.stderr.write(`Entrada inválida: --version deve ser vX.Y.Z (ex: v0.1.1).\n`);
    return 1;
  }
  if (!sha || !/^[0-9a-f]{40}$/.test(sha)) {
    io.stderr.write(`Entrada inválida: --sha deve ser um SHA completo de 40 hex minúsculos.\n`);
    return 1;
  }

  const snapshot = loadReferenceFixture();
  const client = fixture ? makeFakeClient(snapshot) : ghClient;
  let decision;
  try {
    decision = await decide({ snapshot, client, version, expectedSha: sha });
  } catch (err) {
    return tratarRecusa(err, io.stderr);
  }
  if (json) renderVerifyJson(decision, io.stdout);
  else renderVerifyText(decision, io.stdout);
  // Uma família de falha da costura sai com código diferente de zero mesmo que a
  // elegibilidade tenha sobrevivido: a costura rodou sobre o mesmo cliente, e
  // uma releitura que voltou a falhar é o estado mais indeterminado que existe.
  const recusou = decision.reconciliation !== null && decision.reconciliation.family !== null;
  return decision.eligibility.eligible && !recusou ? 0 : 1;
}

async function runPlan({ json, version, sha }, io) {
  const snapshot = loadReferenceFixture();
  let plan;
  try {
    const decision = await decide({ snapshot, version, expectedSha: sha });
    plan = buildClosePlan({
      version: decision.version,
      expectedSha: decision.expectedSha,
      snapshot,
      eligibility: decision.eligibility,
      classificacao: decision.classification,
      evidence: decision.evidence,
      mutations: decision.mutations,
      reconciliation: decision.reconciliation,
    });
  } catch (err) {
    return tratarRecusa(err, io.stderr);
  }
  if (json) renderJson(plan, io.stdout);
  else io.stdout.write(renderPlanText(plan));
  return plan.applyLiberado ? 0 : 1;
}

// Adaptador de destino de saída que RELATA a contagem de caracteres.
// `write` de um fluxo real devolve um booleano de "aceitou o pedaço", e um
// booleano é indistinguível de um plano engolido — que é exatamente o que a
// fechadura de sink precisa distinguir. O adaptador faz a escrita e devolve
// quantos caracteres recebeu, para que o portão possa recusar depois do render
// quando nada chegou a lugar nenhum. Nenhum fluxo do processo é alcançado aqui:
// o fluxo chega por argumento, e a guarda estática de evidence.test.js — que
// proíbe a expressão de fluxo global em qualquer ponto fora de `fluxosPadrao` —
// é a que confere essa separação.
function sinkQueContaCaracteres(fluxo) {
  return (texto) => {
    const recebido = typeof texto === 'string' ? texto : '';
    fluxo.write(recebido);
    return recebido.length;
  };
}

// Prompt de confirmação sobre o terminal vivo. Só é construído quando as
// fechaduras de terminal já passaram no portão; com pipe, a recusa acontece
// antes e esta fábrica nunca roda.
//
// ASSENTA UMA ÚNICA VEZ (T-09-08-04, WR-05). Antes, a promessa só se resolvia
// pelo retorno da linha digitada: um EOF ou Ctrl-D logo depois de a pergunta
// abrir deixava o processo vivo até um tempo EXTERNO estourar. Agora ela
// assenta em três desfechos — resposta, fechamento da interface e erro do
// fluxo — sob uma única bandeira, de modo que uma resposta tardia depois de um
// fechamento não assenta de novo nem abre uma segunda pergunta. A interface é
// fechada em todos os caminhos, e o fim de entrada e o erro de fluxo viram
// recusa com motivo PT-BR, e não uma "palavra" vazia: o operador não
// confirmou nada, e dizer que ele digitou algo errado seria mentira.
export function makeAsk(stdin, output) {
  return () =>
    new Promise((resolve) => {
      const rl = createInterface({ input: stdin, output });
      let assentado = false;
      const liquidar = (valor) => {
        if (assentado) return;
        assentado = true;
        stdin.removeListener('error', aoErroDoFluxo);
        rl.removeListener('error', aoErro);
        rl.close();
        resolve(valor);
      };
      const motivoDeFluxo = {
        motivoRecusa:
          'Apply recusa: o fluxo de entrada falhou depois de a pergunta abrir; a confirmação não foi recebida.',
      };
      const motivoDeFim = {
        motivoRecusa:
          'Apply recusa: o terminal foi fechado antes de a confirmação ser digitada; a confirmação não foi recebida.',
      };
      // O readline REEMITE o erro do fluxo como erro da PRÓPRIA interface — o
      // erro chega em `rl`, não em `stdin` — e nesse caminho ele não emite
      // `close`. Os dois ouvintes ficam: o da interface é o que dispara, e o do
      // fluxo cobre o caso em que a interface não está dirigindo a leitura.
      const aoErro = () => liquidar(motivoDeFluxo);
      const aoErroDoFluxo = () => liquidar(motivoDeFluxo);
      stdin.on('error', aoErroDoFluxo);
      rl.on('error', aoErro);
      rl.question('Confirmar o apply? (sim/nao) ', (resposta) => liquidar(resposta));
      // `close` dispara quando a linha é lida e quando o fluxo TERMINA sem
      // resposta; a bandeira faz o segundo disparo ser um no-op.
      rl.once('close', () => liquidar(motivoDeFim));
    });
}

async function runApply({ json, yes, version, sha }, io) {
  const snapshot = loadReferenceFixture();
  let plan;
  try {
    const decision = await decide({ snapshot, version, expectedSha: sha });
    plan = buildClosePlan({
      version: decision.version,
      expectedSha: decision.expectedSha,
      snapshot,
      eligibility: decision.eligibility,
      classificacao: decision.classification,
      evidence: decision.evidence,
      mutations: decision.mutations,
      reconciliation: decision.reconciliation,
    });
  } catch (err) {
    return tratarRecusa(err, io.stderr);
  }

  // A estrutura em json SÓ é emitida depois que o portão devolveu, nunca
  // antes: ela carrega o conteúdo revisado e o digest, e escrevê-la antes das
  // fechaduras de terminal e de conteúdo colocaria o texto que o operador
  // deveria ler num destino que ninguém revisou. A ordem interna da saída do
  // apply se mantém — estrutura em json primeiro, texto humano do portão no
  // fluxo de erro —, e a máquina continua sem poder se análise sozinha até uma
  // decisão.
  const planText = renderPlanText(plan);

  if (!plan.applyLiberado) {
    io.stdout.write(planText);
    io.stderr.write(
      `apply recusa: ${plan.bloqueio ?? `tag inelegível (${plan.elegibilidade.code})`}. Nenhuma mutação executada (mutations: ${plan.mutations}).\n`,
    );
    return 1;
  }

  const gate = await confirmApply({
    yesFlag: yes,
    isTTY: io.stdin.isTTY === true,
    // O booleano de terminal de SAÍDA vem do fluxo de SAÍDA, nunca do de
    // entrada: é justamente a combinação "entrada viva, saída redirecionada"
    // que o portão precisa recusar, e ler a entrada duas vezes reabriria o
    // desvio que a fechadura de saída existe para fechar.
    outputIsTTY: io.stdout.isTTY === true,
    planText,
    reviewed: plan.reviewed,
    reviewedDigest: plan.reviewedDigest,
    ask: makeAsk(io.stdin, io.stdout),
    // O portão é quem dita a ordem do render: ele não escreve nada antes da
    // fechadura de conteúdo e escreve o plano e o conteúdo revisado logo depois
    // dela. A CLI não escreve o plano por conta própria em nenhum caminho deste
    // bloco.
    write: sinkQueContaCaracteres(io.stdout),
  });

  if (json) renderJson(plan, io.stdout);

  if (!gate.confirmed) {
    io.stderr.write(`${gate.reason} Nenhuma mutação executada (mutations: ${plan.mutations}).\n`);
    return 1;
  }

  // Confirmação dupla aceita, mas a Fase 9 não possui caminho de escrita: o
  // apply falha fechado até a reconciliação idempotente da Fase 11.
  io.stderr.write(
    `${gate.reason} Ainda assim a Fase 9 não executa escrita remota: reconciliação chega na Fase 11. Nenhuma mutação executada (mutations: ${plan.mutations}).\n`,
  );
  return 1;
}

// Entrada exportada do CLI (o `main` de WR-04). Recebe os fluxos por argumento
// e devolve o código de saída em vez de terminar o processo, de modo que um
// teste ou um módulo a jusante possa dirigir um verbo e inspecionar o que foi
// escrito. Executada como script, os fluxos caem nos do processo e o operador
// vê exatamente o texto, o destino e o código de sempre.
export async function runReleaseClose(argv, io = {}) {
  if (!io || typeof io !== 'object') {
    throw new TypeError('Entrada inválida: esperado um objeto de fluxos com stdin, stdout e stderr.');
  }
  if (!Array.isArray(argv)) {
    throw new TypeError('Entrada inválida: esperado argv como lista de argumentos.');
  }
  const padrao = fluxosPadrao();
  const fluxos = {
    stdin: io.stdin ?? padrao.stdin,
    stdout: io.stdout ?? padrao.stdout,
    stderr: io.stderr ?? padrao.stderr,
  };
  const parsed = parseArgs(argv);
  if (parsed.error) {
    return usageError(parsed.error, fluxos.stderr);
  }
  const { verb, help, json, version, sha } = parsed.args;

  if (help || verb === null) {
    fluxos.stdout.write(USAGE);
    return 0;
  }

  if (verb === 'verify') {
    return runVerify({ json, version, sha }, fluxos);
  }
  if (verb === 'plan') {
    return runPlan({ json, version, sha }, fluxos);
  }
  if (verb === 'apply') {
    return runApply({ json, yes: parsed.args.yes, version, sha }, fluxos);
  }
  return usageError(`Verbo desconhecido: ${verb} (use verify, plan ou apply).`, fluxos.stderr);
}

// Só o caso de script de entrada executa um verbo: a URL do módulo é comparada
// com o caminho de entrada resolvido, e a comparação happen apenas aí — a
// importação de um módulo alheio nunca executa a CLI. Symlink e caminho
// relativo são normalizados por realpath, que é a mesma forma que o import.meta
// carrega.
function ehScriptDeEntrada() {
  const entrada = process.argv[1];
  if (typeof entrada !== 'string' || entrada === '') return false;
  try {
    return pathToFileURL(realpathSync(entrada)).href === import.meta.url;
  } catch {
    return false;
  }
}

// O código é atribuído, não terminado: um `process.exit` aqui truncaria a
// saída em buffer nos caminhos com pipe e mataria qualquer importador.
if (ehScriptDeEntrada()) {
  process.exitCode = await runReleaseClose(process.argv.slice(2));
}
