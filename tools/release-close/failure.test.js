// Suíte de famílias de falha: dirige a COSTURA DE RECONCILIAÇÃO DE PRODUÇÃO
// com as seis falhas roteirizadas que a arapuca programável sabe produzir e
// que, até o plano 09-09, nenhum caminho de produção consumia.
//
// Roda com: node --test tools/release-close/ (zero dependências, sem rede, sem
// banco, sem relógio). Nomes em PT-BR, como em backend/tests/.
//
// CONVENÇÃO OBRIGATÓRIA — nenhum `describe` neste arquivo, em nenhum momento.
// O node indenta subtestes aninhados na saída TAP, e `check tdd-red-evidence`
// só enxerga um teste-alvo no primeiro nível. Os grupos são delimitados por
// comentários de banner. A mesma restrição vale para canary.test.js,
// evidence.test.js e safe04.test.js.
//
// NENHUMA normalização de evidência é reimplementada aqui. `evidence` e `ci`
// vêm SEMPRE do construtor de produção exportado `buildCloseEvidence` e do
// bloco `ci` congelado do snapshot, e `eligibility` e `classification` vêm
// SEMPRE das decisões que o mesmo caminho de produção computes. Montar um
// contrato de classificação à mão nesta suíte seria exatamente o helper local
// que os planos 09-07 e 09-08 apagaram das outras, e que já deixou uma suíte
// verde exercitando um estado diferente do que alegava.
//
// Grupos de banner e a tarefa do plano 09-09 que possui cada um:
//
//   grupo 1 — tarefa 1: a costura que normaliza cada família e relê pela
//              identidade natural
//   grupo 2 — tarefa 2: a CLI decidindo ATRAVÉS da costura
//   grupo 3 — tarefa 3: as seis famílias, a recuperação, a dupla falha, a
//              prova de zero escrita cega, o no-op concluído e o determinismo

import { it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { makeFakeClient, makeArmedFakeClient } from './fake-client.js';
import { assertNoMutation } from './client.js';
import { reconciliar } from './reconcile.js';

// ---------------------------------------------------------------------------
// Auxiliares
// ---------------------------------------------------------------------------

function fixture(nome) {
  return JSON.parse(readFileSync(new URL(`./fixtures/${nome}.json`, import.meta.url), 'utf8'));
}

function fonteDoModulo(nome) {
  return readFileSync(new URL(`./${nome}`, import.meta.url), 'utf8');
}

function semComentarios(texto) {
  return texto.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:])\/\/.*$/gm, '$1');
}

// O módulo da CLI entra por `import` DINÂMICO e com guarda de tipo: importar
// por tipo prova que a decisão é uma função exportada em vez de falhar com
// "not a function", que seria uma falha de carga e não uma asserção.
let moduloDaCli = null;
async function cli() {
  if (moduloDaCli === null) {
    const mod = await import('./release-close.js');
    for (const nome of ['decide', 'buildCloseEvidence', 'buildClosePlan', 'renderPlanText']) {
      assert.equal(typeof mod[nome], 'function', `${nome} não é exportado por release-close.js`);
    }
    moduloDaCli = mod;
  }
  return moduloDaCli;
}

// A camada de decisão de PRODUÇÃO injetada na costura. Antes da tarefa 2 deste
// plano o seam exportado `decide` É a camada; depois, `decide` delega à costura
// e a camada injetada passa a ser `camadaDeDecisao`, para que uma releitura
// re-derive as mesmas três sem voltar a entrar na costura.
async function camadaDeDecisao() {
  const mod = await cli();
  return typeof mod.camadaDeDecisao === 'function' ? mod.camadaDeDecisao : mod.decide;
}

// Adaptador de ESTADO para o formato do cliente. Ele não normaliza nada: os
// envelopes das cinco leituras ficam intactos e a carga de `releases` é
// entregue INTEIRA, nunca o primeiro elemento — escolher o primeiro foi
// exatamente o defeito WR-03 que deixou duplicata e conflito passarem.
function clienteDeEstado(estado) {
  const releases = estado.releases ?? [];
  return {
    version: estado.version,
    expectedSha: estado.expectedSha,
    tagRef: {
      ok: true,
      status: 200,
      data: { ref: `refs/tags/${estado.version}`, object: { type: 'tag', sha: estado.tagSha } },
    },
    tagObject: {
      ok: true,
      status: 200,
      data: { sha: estado.tagSha, object: { type: 'commit', sha: estado.commitSha } },
    },
    branchHead: { ok: true, status: 200, data: { sha: estado.commitSha } },
    release:
      releases.length > 0
        ? { ok: true, status: 200, data: releases }
        : { ok: false, status: 404, data: null },
    milestones: { ok: true, status: 200, data: estado.milestones ?? [] },
    target: estado.target,
    ci: estado.ci,
    runs: estado.runs ?? [],
  };
}

// As três decisões e a evidência vêm do caminho de produção: a arapuca
// programável, a costura `decide` exportada, o construtor de evidência
// exportado e o classificador. Nada é montado à mão.
async function decisaoDeProducao(snapshot, failurePlan) {
  const mod = await cli();
  const client = makeFakeClient(snapshot, failurePlan);
  const decisao = await mod.decide({
    client,
    version: snapshot.version,
    expectedSha: snapshot.expectedSha,
    ci: snapshot.ci,
  });
  return { client, decisao };
}

// Chamada da costura com a assinatura COMPLETA de oito entradas obrigatórias e
// o plano de falhas opcional. Nenhum caso deste arquivo pode chamar a costura
// com um conjunto mais curto: uma costura que aceitasse só o cliente, a versão
// e o SHA não alcançaria decisão nenhuma, porque nenhuma das cinco leituras
// devolve evidência de CI e nenhuma devolve a evidência normalizada de release
// e milestone.
async function chamarCostura({ client, decisao, failurePlan, decide, versao, sha, ci }) {
  return reconciliar({
    client,
    version: versao ?? decisao.version,
    expectedSha: sha ?? decisao.expectedSha,
    ci: ci ?? decisao.ci,
    evidence: decisao.evidence,
    eligibility: decisao.eligibility,
    classification: decisao.classification,
    decide: decide ?? (await camadaDeDecisao()),
    failurePlan,
  });
}

// A assinatura exportada, lida do CÓDIGO e não da prosa: uma guarda que
// reescrevesse a lista de nomes passaria a aprovar uma assinatura encurtada.
function nomesDaAssinatura(texto) {
  const inicio = texto.search(/^export\s+async\s+function\s+reconciliar\s*\(/m);
  assert.ok(inicio >= 0, 'reconciliar não está declarado como função assíncrona exportada');
  const abre = texto.indexOf('(', inicio);
  let profundidade = 0;
  let fecha = -1;
  for (let i = abre; i < texto.length; i += 1) {
    if (texto[i] === '(') profundidade += 1;
    else if (texto[i] === ')') {
      profundidade -= 1;
      if (profundidade === 0) {
        fecha = i;
        break;
      }
    }
  }
  const lista = texto.slice(abre + 1, fecha);
  const abreChaves = lista.indexOf('{');
  const interno = lista.slice(abreChaves + 1, lista.lastIndexOf('}'));
  return interno
    .split(',')
    .map((nome) => nome.trim())
    .filter((nome) => nome.length > 0);
}

// Corta o corpo de uma declaração de função a partir do texto-fonte inteiro.
// A chave inicial é a que abre depois de fecharem todos os parênteses da lista
// de parâmetros — e não a primeira chave qualquer: numa assinatura
// desestruturada (`{ client, version }`) a primeira chave é a da
// desestruturação, e um contador que começa nela devolve a assinatura e nada
// mais. Uma guarda que inspeciona um fragmento é pior do que nenhuma guarda,
// porque relata uma aprovação sem ter olhado.
function corpoDaFuncao(texto, expressao) {
  const inicio = texto.search(expressao);
  assert.ok(inicio >= 0, `declaração não encontrada: ${String(expressao)}`);
  return fatiar(texto, inicio);
}

function fatiar(texto, inicio) {
  let profundidade = 0;
  let chave = -1;
  for (let i = texto.indexOf('(', inicio); i < texto.length; i += 1) {
    if (texto[i] === '(') profundidade += 1;
    else if (texto[i] === ')') {
      profundidade -= 1;
      if (profundidade === 0) {
        chave = texto.indexOf('{', i);
        break;
      }
    }
  }
  assert.ok(chave >= 0, 'a declaração não tem corpo');
  profundidade = 0;
  for (let i = chave; i < texto.length; i += 1) {
    if (texto[i] === '{') profundidade += 1;
    else if (texto[i] === '}') {
      profundidade -= 1;
      if (profundidade === 0) return texto.slice(inicio, i + 1);
    }
  }
  return texto.slice(inicio);
}

// Nenhum objeto devolvido pela costura pode carregar `applyLiberado` em
// qualquer nível: esse nome tem UM significado no repositório — tag elegível
// sem estado bloqueante, no objeto de plano — e a costura tem o seu próprio
// campo, `writeProposed`.
function semApplyLiberado(objeto, caminho = 'decisao') {
  if (objeto === null || typeof objeto !== 'object') return;
  assert.ok(!Object.prototype.hasOwnProperty.call(objeto, 'applyLiberado'), `${caminho} carrega o campo applyLiberado`);
  for (const [chave, valor] of Object.entries(objeto)) {
    semApplyLiberado(valor, `${caminho}.${chave}`);
  }
}

// ===========================================================================
// grupo 1 — tarefa 1: a costura que normaliza cada família e relê pela
// identidade natural
// ===========================================================================

it('a costura declara exatamente as oito entradas obrigatórias e o plano de falhas opcional', () => {
  const fonte = fonteDoModulo('reconcile.js');
  assert.deepEqual(nomesDaAssinatura(fonte), [
    'client',
    'version',
    'expectedSha',
    'ci',
    'evidence',
    'eligibility',
    'classification',
    'decide',
    'failurePlan',
  ]);
});

it('a costura não importa relógio, ambiente, rede, subprocesso, disco, elegibilidade nem classificador', () => {
  const codigo = semComentarios(fonteDoModulo('reconcile.js'));
  const importacoes = [...codigo.matchAll(/^import\s+(?:[\s\S]*?)\s+from\s+'([^']+)'/gm)].map((achado) => achado[1]);
  assert.deepEqual(importacoes, ['./client.js']);
  assert.doesNotMatch(codigo, /node:(fs|child_process|net|http|https|os|tls|dns|worker_threads)/);
  assert.doesNotMatch(codigo, /\bprocess\.env\b/);
  assert.doesNotMatch(codigo, /Date\.now|new Date|setTimeout|setInterval|Math\.random/);
  assert.doesNotMatch(codigo, /eligibility\.js|classify\.js/);
});

it('sem plano de falhas, a costura devolve as três decisões fornecidas e a sequência de leituras vazia', async () => {
  const { client, decisao } = await decisaoDeProducao(fixture('reference'));
  const custura = await chamarCostura({ client, decisao });
  assert.deepEqual(custura.evidence, decisao.evidence);
  assert.deepEqual(custura.eligibility, decisao.eligibility);
  assert.deepEqual(custura.classification, decisao.classification);
  assert.deepEqual(custura.reads, []);
  assert.equal(custura.family, null);
  assert.equal(custura.reason, null);
  assert.equal(custura.recovered, false);
  assert.equal(custura.writeAction, null);
  assert.equal(custura.writeProposed, false);
  assert.equal(custura.mutations, 0);
  semApplyLiberado(custura);
});

it('cada entrada obrigatória ausente ou não função é recusada com TypeError em PT-BR nomeando a entrada', async () => {
  const { client, decisao } = await decisaoDeProducao(fixture('reference'));
  const completo = {
    client,
    version: decisao.version,
    expectedSha: decisao.expectedSha,
    ci: decisao.ci,
    evidence: decisao.evidence,
    eligibility: decisao.eligibility,
    classification: decisao.classification,
    decide: await camadaDeDecisao(),
  };
  for (const nome of [
    'client',
    'version',
    'expectedSha',
    'ci',
    'evidence',
    'eligibility',
    'classification',
    'decide',
  ]) {
    const semEntrada = { ...completo };
    delete semEntrada[nome];
    await assert.rejects(
      () => reconciliar(semEntrada),
      (erro) =>
        erro instanceof TypeError &&
        erro.message.includes(nome) &&
        /[A-Za-zÀ-ÿ]/.test(erro.message),
      `a entrada ausente ${nome} não foi recusada com TypeError em PT-BR nomeando a entrada`,
    );
    await assert.rejects(
      () => reconciliar({ ...completo, [nome]: 42 }),
      (erro) => erro instanceof TypeError && erro.message.includes(nome),
      `a entrada inválida ${nome} não foi recusada com TypeError em PT-BR nomeando a entrada`,
    );
  }
});

it('um plano de falhas que nomeia uma leitura inexistente é recusado com TypeError em PT-BR', async () => {
  const { client, decisao } = await decisaoDeProducao(fixture('reference'));
  await assert.rejects(
    () => chamarCostura({ client, decisao, failurePlan: { escreverRelease: ['timeout'] } }),
    (erro) =>
      erro instanceof TypeError &&
      erro.message.includes('escreverRelease') &&
      erro.message.includes('getTagRef'),
    'o plano de falhas com uma leitura fora da interface não foi recusado nomeando a leitura',
  );
});

const FAMILIAS_ROTEIRIZADAS = [
  { desfecho: 'timeout', codigo: 'TRANSPORT' },
  { desfecho: 'lost-response', codigo: 'TRANSPORT' },
  { desfecho: 'status-409', codigo: 'UNAVAILABLE' },
  { desfecho: 'status-422', codigo: 'UNAVAILABLE' },
  { desfecho: 'status-429', codigo: 'UNAVAILABLE' },
  { desfecho: 'status-5xx', codigo: 'UNAVAILABLE' },
];

it('cada família roteirizada que relê com sucesso devolve as decisões da camada injetada, não as da tentativa falha', async () => {
  for (const { desfecho, codigo } of FAMILIAS_ROTEIRIZADAS) {
    const base = fixture('reference');
    // A primeira entrada da fila é consumida pela releitura da costura, que
    // falha; a segunda é a releitura pela MESMA identidade, que responde.
    const { client, decisao } = await decisaoDeProducao(base, { getTagRef: [desfecho, desfecho] });
    const custura = await chamarCostura({ client, decisao, failurePlan: { getTagRef: [desfecho, desfecho] } });
    assert.equal(custura.reads.length, 2, `${desfecho}: a costura não tentou uma releitura`);
    assert.equal(custura.reads[0].leitura, 'getTagRef');
    assert.equal(custura.reads[0].identidade, base.version);
    assert.equal(custura.reads[0].desfecho, 'falhou');
    assert.equal(custura.reads[1].leitura, 'getTagRef');
    assert.equal(custura.reads[1].identidade, base.version);
    assert.equal(custura.reads[1].desfecho, 'respondeu');
    assert.equal(custura.family, null, `${desfecho}: a releitura bem-sucedida recusou em vez de recuperar`);
    assert.equal(custura.reason, null);
    assert.equal(custura.recovered, true, `${desfecho}: a recuperação não foi marcada`);
    assert.equal(custura.writeAction, null);
    assert.equal(custura.writeProposed, false);
    void codigo;
  }
});

it('a releitura bem-sucedida chama a camada injetada sem plano de falhas e sem-classificação-echo', async () => {
  const base = fixture('reference');
  const { client, decisao } = await decisaoDeProducao(base, { getTagRef: ['timeout', 'timeout'] });
  const mod = await cli();
  const decide = await camadaDeDecisao();
  const chamadas = [];
  const comEspiao = async (argumentos) => {
    chamadas.push(argumentos);
    return decide(argumentos);
  };
  const custura = await chamarCostura({ client, decisao, decide: comEspiao, failurePlan: { getTagRef: ['timeout', 'timeout'] } });
  assert.equal(chamadas.length, 1, 'a releitura bem-sucedida não chamou a camada injetada');
  assert.deepEqual(Object.keys(chamadas[0]).sort(), ['ci', 'client', 'expectedSha', 'version']);
  assert.ok(!Object.prototype.hasOwnProperty.call(chamadas[0], 'failurePlan'), 'a camada injetada recebeu o plano de falhas');
  // E o bloco ci que a costura recebeu é o MESMO objeto que a decisão carrega,
  // byte a byte com o congelado do snapshot: um bloco reescrito aqui seria a
  // evidência de CI que a releitura usaria, e ela não seria a do repositório.
  assert.strictEqual(chamadas[0].ci, decisao.ci);
  assert.deepEqual(chamadas[0].ci, base.ci);
  // E o que voltou NÃO é a tentativa falha: a elegibilidade da tentativa falha
  // era TRANSPORT, e a devolvida vem da releitura bem-sucedida.
  assert.equal(decisao.eligibility.code, 'TRANSPORT');
  assert.equal(custura.eligibility.code, 'ELIGIBLE');
  assert.notDeepEqual(
    custura.eligibility,
    decisao.eligibility,
    'a costura devolveu a elegibilidade da tentativa que falhou em vez da releitura',
  );
  const releitura = await mod.decide({ client: makeFakeClient(base), version: base.version, expectedSha: base.expectedSha, ci: base.ci });
  assert.equal(releitura.eligibility.code, 'ELIGIBLE');
  assert.deepEqual(custura.evidence, releitura.evidence);
  assert.deepEqual(custura.classification, releitura.classification);
  // A evidência de conteúdo igual não prova nada sobre provenance: a prova é de
  // IDENTIDADE de objeto — o que voltou é o objeto que a camada injetada
  // produziu, e não o da tentativa que falhou.
  assert.notStrictEqual(custura.evidence, decisao.evidence);
  assert.notStrictEqual(custura.classification, decisao.classification);
  void mod;
});

it('uma releitura que falha de novo recusa com a família da segunda falha e não propõe escrita', async () => {
  for (const { desfecho, codigo } of FAMILIAS_ROTEIRIZADAS) {
    const base = fixture('reference');
    const { client, decisao } = await decisaoDeProducao(base, { getTagRef: [desfecho, desfecho, desfecho] });
    const custura = await chamarCostura({ client, decisao, failurePlan: { getTagRef: [desfecho, desfecho, desfecho] } });
    assert.equal(custura.family, codigo, `${desfecho}: a recusa não carregou o código da segunda falha`);
    assert.equal(typeof custura.reason, 'string');
    assert.ok(custura.reason.length > 0, `${desfecho}: a recusa veio sem motivo PT-BR`);
    assert.equal(custura.recovered, false);
    assert.equal(custura.writeAction, null);
    assert.equal(custura.writeProposed, false);
    assert.equal(custura.reads.length, 2);
    semApplyLiberado(custura);
  }
});

it('a recusa nomeia a leitura, a família e que o estado remoto é desconhecido e não ausente', async () => {
  const base = fixture('reference');
  for (const { desfecho } of FAMILIAS_ROTEIRIZADAS) {
    const { client, decisao } = await decisaoDeProducao(base, { getTagRef: [desfecho, desfecho, desfecho] });
    const custura = await chamarCostura({ client, decisao, failurePlan: { getTagRef: [desfecho, desfecho, desfecho] } });
    assert.match(custura.reason, /getTagRef/, `${desfecho}: o motivo não nomeia a leitura`);
    assert.match(custura.reason, /desconhecido/, `${desfecho}: o motivo não diz que o estado remoto é desconhecido`);
    assert.match(custura.reason, /não ausente/, `${desfecho}: o motivo não distingue desconhecido de ausente`);
  }
});

it('cada uma das cinco leituras relê pela sua identidade natural, e o log do cliente confirma a ordem', async () => {
  const base = fixture('reference');
  const casos = [
    { leitura: 'getTagRef', identidade: base.version },
    { leitura: 'getTagObject', identidade: base.tagRef.data.object.sha },
    { leitura: 'getBranchHead', identidade: 'main' },
    { leitura: 'getReleaseByTag', identidade: base.version },
    { leitura: 'listMilestones', identidade: 'todas' },
  ];
  for (const { leitura, identidade } of casos) {
    // A decisão de base vem de um cliente LIMPO, e a arapuca roteirizada é a
    // que a costura relê. Isso é uma consequência de produção, não uma
    // convenção: `getReleaseByTag` e `listMilestones` são lidas pela camada de
    // decisão SEM captura, então um tempo esgotado nelas escapa como rejeição
    // antes de a costura existir. Ver a nota deameaça no SUMMARY.
    const { decisao } = await decisaoDeProducao(base);
    const client = makeFakeClient(base, { [leitura]: ['timeout', 'timeout'] });
    const custura = await chamarCostura({ client, decisao, failurePlan: { [leitura]: ['timeout', 'timeout'] } });
    const daCostura = custura.reads.filter((tentativa) => tentativa.leitura === leitura);
    assert.equal(daCostura.length, 2, `${leitura}: a costura não relêu a leitura que falhou`);
    assert.equal(daCostura[0].identidade, identidade, `${leitura}: a identidade natural não é a esperada`);
    assert.equal(daCostura[1].identidade, identidade, `${leitura}: a releitura usou outra identidade`);
    // O log do cliente confirma a ORDEM independentemente da sequência que a
    // costura relata: uma sequência autoconsistente e errada não passaria.
    const doCliente = client.calls.filter((chamada) => chamada.method === leitura);
    const ultimasDuas = doCliente.slice(-2);
    assert.equal(ultimasDuas.length, 2, `${leitura}: o log do cliente não mostra a tentativa e a releitura`);
    assert.deepEqual(ultimasDuas[0].args, ultimasDuas[1].args, `${leitura}: a releitura usou outra identidade no cliente`);
    assert.deepEqual(ultimasDuas[0].args, leitura === 'listMilestones' ? [] : [identidade]);
  }
});

it('o no-op concluído chega como MISSING e COMPLETE_NOOP e a costura não propõe escrita nenhuma', async () => {
  const mod = await cli();
  const snapshot = clienteDeEstado(fixture('complete'));
  const { client, decisao } = await decisaoDeProducao(snapshot);
  assert.equal(decisao.classification.code, 'MISSING');
  assert.equal(decisao.classification.outcome, 'COMPLETE_NOOP');

  const custura = await chamarCostura({ client, decisao });
  assert.equal(custura.classification.code, 'MISSING');
  assert.equal(custura.classification.outcome, 'COMPLETE_NOOP');
  assert.equal(custura.writeAction, null);
  assert.equal(custura.writeProposed, false);
  semApplyLiberado(custura);

  // E o par que prova que os DOIS nomes carregam UM significado cada: o plano
  // diz applyLiberado verdadeiro (MISSING não é um código bloqueante) e a
  // costura diz writeProposed falso, e nenhum dos dois é derivado do outro.
  const plano = mod.buildClosePlan({
    version: decisao.version,
    expectedSha: decisao.expectedSha,
    snapshot,
    eligibility: decisao.eligibility,
    classificacao: decisao.classification,
    evidence: decisao.evidence,
    mutations: decisao.mutations,
  });
  assert.equal(plano.applyLiberado, true, 'o no-op concluído deixou de liberar o plano no nível do plano');
  assert.equal(custura.writeProposed, false);
});

// ===========================================================================
// grupo 2 — tarefa 2: a CLI decidindo ATRAVÉS da costura
// ===========================================================================

const OITO_ENTRADAS = [
  'client',
  'version',
  'expectedSha',
  'ci',
  'evidence',
  'eligibility',
  'classification',
  'decide',
  'failurePlan',
];

it('a decisão exportada delega à costura com as nove entradas e não reconstrói nada', () => {
  const fonte = fonteDoModulo('release-close.js');
  const corpo = corpoDaFuncao(fonte, /^export async function decide\(/m);
  assert.match(corpo, /reconciliar\(\{/, 'a decisão exportada não delega à costura de reconciliação');
  const chamada = corpo.slice(corpo.indexOf('reconciliar({'));
  const bloco = chamada.slice(0, chamada.indexOf('});') + 2);
  for (const nome of OITO_ENTRADAS) {
    // O nome da chave, com ou sem dois pontos: a forma abreviada (`failurePlan,`)
    // é uma entrada passada tanto quanto a forma explícita (`failurePlan: valor`).
    assert.match(bloco, new RegExp(`\\b${nome}\\b`), `a delegação não passa ${nome} para a costura`);
  }
  // `evidence` e `ci` chegam COPIADOS do construtor exportado, nunca
  // reconstruídos: um construtor chamado de novo aqui devolveria um objeto
  // diferente, e a costura decidiria sobre uma evidência que o classificador
  // nunca viu.
  assert.doesNotMatch(corpo, /buildCloseEvidence\(/, 'a decisão delegadora reconstrói a evidência');
  assert.doesNotMatch(corpo, /classifySnapshot\(|checkTagEligibility\(/, 'a decisão delegadora recalcula as decisões puras');
  // E `decide` injetada NÃO é a própria função delegadora: uma auto-referência
  // faria a releitura voltar a entrar na costura, sem fim.
  const injetada = bloco.match(/decide:\s*([A-Za-z0-9_$]+)/);
  assert.ok(injetada, 'a delegação não nomeia a camada injetada');
  assert.notEqual(injetada[1], 'decide', 'a camada injetada é a própria delegadora, e a releitura entraria na costura de novo');
});

it('a camada de decisão injetada é exportada e para antes da costura', async () => {
  const mod = await cli();
  assert.equal(typeof mod.camadaDeDecisao, 'function', 'camadaDeDecisao não é exportado por release-close.js');
  const base = fixture('reference');
  const camada = await mod.camadaDeDecisao({
    client: makeFakeClient(base),
    version: base.version,
    expectedSha: base.expectedSha,
    ci: base.ci,
  });
  assert.equal(camada.eligibility.code, 'ELIGIBLE');
  assert.equal(camada.classification.code, 'MISSING');
  assert.ok(!Object.prototype.hasOwnProperty.call(camada, 'reconciliation'), 'a camada injetada já carrega o bloco de reconciliação');
});

it('a decisão exportada carrega o bloco de reconciliação com as mesmas três decisões que ela decidiu', async () => {
  const { decisao } = await decisaoDeProducao(fixture('reference'));
  assert.ok(Object.prototype.hasOwnProperty.call(decisao, 'reconciliation'), 'a decisão não carrega o bloco de reconciliação');
  // Identidade de objeto, e não igualdade profunda: é o que prova que a
  // costura recebeu a evidência e as duas decisões da camada, e não cópias.
  assert.strictEqual(decisao.reconciliation.evidence, decisao.evidence);
  assert.strictEqual(decisao.reconciliation.eligibility, decisao.eligibility);
  assert.strictEqual(decisao.reconciliation.classification, decisao.classification);
  assert.deepEqual(decisao.reconciliation.reads, []);
  assert.equal(decisao.reconciliation.family, null);
  assert.equal(decisao.reconciliation.recovered, false);
  assert.equal(decisao.reconciliation.writeProposed, false);
  assert.equal(decisao.reconciliation.mutations, decisao.mutations);
  semApplyLiberado(decisao.reconciliation);
});

it('uma família roteirizada que chega à decisão da CLI recusa, libera nada e não escreve', async () => {
  const mod = await cli();
  const base = fixture('reference');
  for (const { desfecho, codigo } of FAMILIAS_ROTEIRIZADAS) {
    const client = makeFakeClient(base, { getTagRef: [desfecho, desfecho, desfecho] });
    const decisao = await mod.decide({
      client,
      version: base.version,
      expectedSha: base.expectedSha,
      ci: base.ci,
      failurePlan: { getTagRef: [desfecho, desfecho, desfecho] },
    });
    assert.equal(decisao.reconciliation.family, codigo, `${desfecho}: a CLI não recusa com o código da família`);
    assert.equal(typeof decisao.reconciliation.reason, 'string');
    assert.ok(decisao.reconciliation.reason.length > 0);
    assert.equal(decisao.eligibility.eligible, false, `${desfecho}: a elegibilidade ficou verdadeira com uma leitura que falhou`);
    assert.equal(decisao.reconciliation.writeProposed, false);
    assert.equal(decisao.reconciliation.writeAction, null);
    assert.equal(decisao.mutations, 0);
    const plano = mod.buildClosePlan({
      version: decisao.version,
      expectedSha: decisao.expectedSha,
      snapshot: base,
      eligibility: decisao.eligibility,
      classificacao: decisao.classification,
      evidence: decisao.evidence,
      mutations: decisao.mutations,
      reconciliation: decisao.reconciliation,
    });
    // `applyLiberado` falso vem do ESTADO, e `writeProposed` falso vem da
    // costura: um plano bloqueado NÃO é a razão pela qual a costura não propõe
    // escrita, e a costura não propõe escrita TAMBÉM num plano liberado — é o
    // par do no-op concluído que prova que os dois nomes são independentes.
    assert.equal(plano.applyLiberado, false, `${desfecho}: o apply foi liberado com uma família de falha`);
    assert.equal(plano.reconciliation.writeProposed, false);
    assert.match(plano.bloqueio, new RegExp(codigo), `${desfecho}: o bloqueio do plano não nomeia a família`);
    assert.match(plano.bloqueio, /desconhecido, não ausente/);
  }
});

it('a CLI não tem opção de injeção de falha, o texto de uso não a menciona e opção desconhecida devolve dois', async () => {
  const fonte = fonteDoModulo('release-close.js');
  const uso = fatiarTexto(fonte, /^const USAGE = /m);
  const analisador = corpoDaFuncao(fonte, /^function parseArgs\(/m);
  for (const [nome, trecho] of [
    ['analisador de opções', analisador],
    ['texto de uso', uso],
  ]) {
    assert.doesNotMatch(
      trecho,
      /failur|falha|inject|injet|falh|--falh|roteiriz/i,
      `o ${nome} da CLI nomeia a injeção de falhas, e ela tem de ser inalcançável pela linha de comando`,
    );
  }
  // E a superfície real: uma opção desconhecida continua sendo recusa de uso
  // com código 2, e o texto de uso continua sendo o mesmo.
  const mod = await cli();
  const escrito = [];
  const fluxo = { write: (texto) => escrito.push(texto) };
  const codigo = await mod.runReleaseClose(['verify', '--falhar'], { stdout: fluxo, stderr: fluxo, stdin: {} });
  assert.equal(codigo, 2, `uma opção desconhecida devolveu ${codigo} em vez de 2`);
  const recusa = escrito.join('');
  assert.match(recusa, /Opção desconhecida: --falhar\./);
  assert.match(recusa, /Uso: node tools\/release-close\/release-close\.js <verify\|plan\|apply> \[opções\]/);
  // E a injeção EXISTE — como parâmetro programático da decisão exportada, e
  // só lá. Uma asserção de que ela não existe em lugar nenhum passaria também
  // com a funcionalidade ausente; o que se prova é a assimetria: presente na
  // assinatura programática, ausente do analisador e do texto de uso.
  assert.match(
    corpoDaFuncao(fonte, /^export async function decide\(/m),
    /failurePlan/,
    'a decisão exportada não aceita o plano de falhas como parâmetro programático',
  );
});

it('o baseline congelado continua o mesmo e só ganha o bloco de reconciliação', async () => {
  const mod = await cli();
  const base = fixture('reference');
  const { decisao } = await decisaoDeProducao(base);
  assert.equal(decisao.reconciliation.family, null, 'o baseline congelado chegou com família de falha');
  assert.deepEqual(decisao.reconciliation.reads, []);
  assert.equal(decisao.mutations, 0);
  const plano = mod.buildClosePlan({
    version: decisao.version,
    expectedSha: decisao.expectedSha,
    snapshot: base,
    eligibility: decisao.eligibility,
    classificacao: decisao.classification,
    evidence: decisao.evidence,
    mutations: decisao.mutations,
    reconciliation: decisao.reconciliation,
  });
  assert.equal(plano.applyLiberado, true);
  assert.equal(plano.bloqueio, null);
  assert.equal(plano.reconciliation.family, null);
  assert.equal(plano.reconciliation.writeProposed, false);
  assert.equal(plano.steps.length, 8);
  assert.equal(plano.mutations, 0);
  // O texto do operador não ganhou linha nenhuma: a reconciliação é uma
  // superfície de DADOS, e nada nela ocorre no baseline congelado — o texto
  // que o plano 09-08 congelou continua byte a byte o mesmo.
  const texto = mod.renderPlanText(plano);
  assert.doesNotMatch(texto, /reconcilia|fam[ií]lia|releitura/i);
  assert.match(texto, /^mutations: 0$/m);
});

// Bloco de texto de uma declaração por atribuição, contando chaves a partir do
// primeiro `{` depois do `=`.
function fatiarTexto(texto, expressao) {
  const inicio = texto.search(expressao);
  assert.ok(inicio >= 0, `declaração não encontrada: ${String(expressao)}`);
  const chave = texto.indexOf('{', inicio);
  let profundidade = 0;
  for (let i = chave; i < texto.length; i += 1) {
    if (texto[i] === '{') profundidade += 1;
    else if (texto[i] === '}') {
      profundidade -= 1;
      if (profundidade === 0) return texto.slice(inicio, i + 1);
    }
  }
  return texto.slice(inicio);
}

// ===========================================================================
// grupo 3 — tarefa 3: as seis famílias, a recuperação, a dupla falha, a prova
// de zero escrita cega, o no-op concluído e o determinismo
// ===========================================================================

// A forma da decisão devolvida pela costura, nomeada uma vez. Um campo a mais
// seria uma superfície nova: a lista é o que diz que nenhuma delas é capaz de
// carregar uma ação de escrita, porque não há lugar onde uma ação caberia.
const CHAVES_DA_DECISAO = [
  'evidence',
  'eligibility',
  'classification',
  'reads',
  'mutations',
  'family',
  'reason',
  'recovered',
  'writeAction',
  'writeProposed',
];

// Clona o que a costura recebe. Só o que é DADO é clonado: o cliente é a
// arapuca viva, com seus métodos e sua fila, e cloná-la produziria um objeto
// sem nenhuma das duas coisas.
function clonarEntradas(decisao) {
  return {
    version: decisao.version,
    expectedSha: decisao.expectedSha,
    ci: structuredClone(decisao.ci),
    evidence: structuredClone(decisao.evidence),
    eligibility: structuredClone(decisao.eligibility),
    classification: structuredClone(decisao.classification),
  };
}

it('cada uma das seis famílias recusa pelo seam da CLI com o código exato e sem nenhuma escrita', async () => {
  const mod = await cli();
  const base = fixture('reference');
  for (const { desfecho, codigo } of FAMILIAS_ROTEIRIZADAS) {
    const client = makeFakeClient(base, { getTagRef: [desfecho, desfecho, desfecho] });
    const decisao = await mod.decide({
      client,
      version: base.version,
      expectedSha: base.expectedSha,
      ci: base.ci,
      failurePlan: { getTagRef: [desfecho, desfecho, desfecho] },
    });
    const r = decisao.reconciliation;
    assert.equal(r.family, codigo, `${desfecho}: código da família`);
    assert.equal(r.recovered, false, `${desfecho}: a recusa veio marcada como recuperação`);
    assert.equal(decisao.eligibility.eligible, false, `${desfecho}: elegibilidade verdadeira`);
    assert.equal(decisao.eligibility.writeAction, null, `${desfecho}: a elegibilidade carrega ação de escrita`);
    assert.equal(decisao.classification.writeAction, null, `${desfecho}: a classificação carrega ação de escrita`);
    assert.ok(typeof r.reason === 'string' && r.reason.length > 0, `${desfecho}: motivo PT-BR vazio`);
    assert.equal(r.writeAction, null, `${desfecho}: writeAction`);
    assert.equal(r.writeProposed, false, `${desfecho}: writeProposed`);
    assert.deepEqual(Object.keys(r), CHAVES_DA_DECISAO, `${desfecho}: a decisão carrega um campo além da forma declarada`);
    semApplyLiberado(decisao);
    // Nenhuma entrada da sequência observada carrega uma carga que pudesse ser
    // uma ação: só o método, a identidade, o número e o desfecho.
    for (const tentativa of r.reads) {
      assert.deepEqual(
        Object.keys(tentativa).filter((chave) => chave !== 'familia'),
        ['leitura', 'identidade', 'tentativa', 'desfecho'],
        `${desfecho}: a entrada da sequência carrega campos a mais`,
      );
    }
    // E o log do cliente concorda com a sequência que a costura relata: a
    // tentativa que falhou e a releitura são a MESMA leitura com a MESMA
    // identidade, e uma sequência autoconsistente e errada não passaria.
    const doCliente = client.calls.filter((chamada) => chamada.method === 'getTagRef');
    assert.equal(doCliente.length, 3, `${desfecho}: o cliente não viu a tentativa e a releitura`);
    assert.deepEqual(doCliente[1].args, [base.version]);
    assert.deepEqual(doCliente[2].args, [base.version]);
    assert.equal(r.reads.length, 2);
    assert.equal(r.reads[0].identidade, r.reads[1].identidade);
  }
});

it('as seis famílias recuperam: a decisão devolvida é a da camada injetada, chamada sem plano de falhas', async () => {
  const base = fixture('reference');
  for (const { desfecho } of FAMILIAS_ROTEIRIZADAS) {
    const { decisao } = await decisaoDeProducao(base);
    const client = makeFakeClient(base, { getTagRef: [desfecho] });
    const camada = await camadaDeDecisao();
    const chamadas = [];
    const comEspiao = async (argumentos) => {
      chamadas.push(argumentos);
      return camada(argumentos);
    };
    const custura = await chamarCostura({ client, decisao, decide: comEspiao, failurePlan: { getTagRef: [desfecho] } });
    assert.equal(custura.recovered, true, `${desfecho}: a releitura bem-sucedida não foi marcada como recuperação`);
    assert.equal(custura.family, null, `${desfecho}: a recuperação carrega família`);
    assert.equal(chamadas.length, 1, `${desfecho}: a camada injetada não foi chamada uma vez`);
    assert.ok(!Object.prototype.hasOwnProperty.call(chamadas[0], 'failurePlan'), `${desfecho}: a releitura levou o plano de falhas de novo`);
    assert.deepEqual(Object.keys(chamadas[0]).sort(), ['ci', 'client', 'expectedSha', 'version'], `${desfecho}: a camada injetada recebeu um argumento a mais`);
    // O que voltou é o OBJETO que a camada injetada produziu — identidade, não
    // igualdade: duas evidências de conteúdo igual não provariam provenance.
    assert.notStrictEqual(custura.evidence, decisao.evidence, `${desfecho}: a costura devolveu a evidência da tentativa que falhou`);
    assert.notStrictEqual(custura.classification, decisao.classification, `${desfecho}: a costura devolveu a classificação da tentativa que falhou`);
    assert.equal(custura.writeAction, null);
    assert.equal(custura.writeProposed, false);
    // Duas tentativas, e só duas: a que falhou e a releitura que respondeu. A
    // releitura bem-sucedida é o ÚNICO caminho de recuperação — não há uma
    // terceira tentativa escondida atrás de um contador de retentativas.
    assert.equal(custura.reads.length, 2, `${desfecho}: a recuperação não foi uma releitura única`);
    assert.equal(custura.reads[0].desfecho, 'falhou');
    assert.equal(custura.reads[1].desfecho, 'respondeu');
  }
});

it('as seis duplas falhas recusam com a família da segunda e a contagem medida continua zero', async () => {
  const mod = await cli();
  const base = fixture('reference');
  for (const { desfecho, codigo } of FAMILIAS_ROTEIRIZADAS) {
    const client = makeFakeClient(base, { getTagRef: [desfecho, desfecho, desfecho] });
    const decisao = await mod.decide({
      client,
      version: base.version,
      expectedSha: base.expectedSha,
      ci: base.ci,
      failurePlan: { getTagRef: [desfecho, desfecho, desfecho] },
    });
    assert.equal(decisao.reconciliation.family, codigo, `${desfecho}: a dupla falha não recuou com a família da segunda`);
    assert.equal(decisao.reconciliation.recovered, false);
    assert.equal(decisao.reconciliation.writeProposed, false);
    assert.equal(decisao.mutations, 0, `${desfecho}: a execução que falhou levou uma escrita`);
    assert.equal(client.mutations, 0, `${desfecho}: a arapuca mediu uma escrita`);
    assert.equal(assertNoMutation(client), 0, `${desfecho}: o invariante compartilhado recusou uma contagem zero`);
    semApplyLiberado(decisao.reconciliation);
  }
});

it('a arapuca armada mede zero numa execução que falha, e armada de fato o invariante recusa sem ser a família que disfarça', async () => {
  const base = fixture('reference');
  const { decisao } = await decisaoDeProducao(base);

  // Primeira execução: falha roteirizada, arapuca armada, nada aconteceu. A
  // contagem medida é zero e o invariante aceita.
  const limpa = makeArmedFakeClient(base, { getTagRef: ['timeout', 'timeout'] });
  const custura = await chamarCostura({ client: limpa, decisao, failurePlan: { getTagRef: ['timeout', 'timeout'] } });
  assert.equal(limpa.mutations, 0, 'a arapuca armada mediu escrita numa execução só de leitura');
  assert.equal(assertNoMutation(limpa), 0);

  // Segunda execução: a armadilha é armada de fato. O efeito REGISTRA e nunca
  // age — o que se prova é que a recusa é a do invariante, e não a da família de
  // falha. Uma execução que falha não pode esconder um efeito colateral atrás
  // do próprio erro: o erro da família é o que o operador leria, e ele diria
  // "o remoto está indeterminado" em vez de "algo foi escrito".
  const armada = makeArmedFakeClient(base, { getTagRef: ['timeout', 'timeout'] });
  armada.trap('criarReleaseRemota', ['v0.1.1']);
  assert.equal(armada.mutations, 1, 'a armadilha armada não produziu contagem medida');
  await assert.rejects(
    () => chamarCostura({ client: armada, decisao, failurePlan: { getTagRef: ['timeout', 'timeout'] } }),
    (erro) =>
      erro instanceof Error &&
      /contador de mutações medido = 1/.test(erro.message) &&
      /Nenhuma decisão prossegue/.test(erro.message) &&
      /criarReleaseRemota/.test(erro.message) &&
      !/Falha de transporte/.test(erro.message),
    'a execução que falha com efeito colateral recuou com a família de falha em vez da recusa do invariante',
  );
  // E pela MESMA porta na CLI, para que a recusa chegue ao operador como recusa
  // de invariante e não como motivo de família.
  const mod = await cli();
  const pelaCli = makeArmedFakeClient(base, { getTagRef: ['timeout', 'timeout', 'timeout'] });
  pelaCli.trap('publicarReleaseRemota', ['v0.1.1']);
  await assert.rejects(
    () =>
      mod.decide({
        client: pelaCli,
        version: base.version,
        expectedSha: base.expectedSha,
        ci: base.ci,
        failurePlan: { getTagRef: ['timeout', 'timeout', 'timeout'] },
      }),
    (erro) =>
      erro instanceof Error &&
      /contador de mutações medido = 1/.test(erro.message) &&
      /publicarReleaseRemota/.test(erro.message) &&
      !/Falha de transporte/.test(erro.message),
    'a CLI aceitou uma execução que falha com efeito colateral medido',
  );
});

it('a reconciliação repetida da mesma evidência é deepamente igual e não propõe escrita (OPS-02)', async () => {
  // LIMITE REGISTRADO, e ele é do tamanho desta prova: o determinismo medido
  // aqui é o determinismo DENTRO DE UM PROCESSO, sobre evidence congelada e
  // sem relógio. A arbitragem entre dois processos que fecham a mesma release
  // ao mesmo tempo é REC-05 da Fase 11, e esta suíte NUNCA pode ser citada
  // como garantia de bloqueio — ela não mede nada entre processos, e dizer o
  // contrário seria um relatório de garantia que ninguém mediu.
  const cenarios = [
    { rotulo: 'evidência concorrente congelada', montar: () => clienteDeEstado(fixture('concurrent')), plano: undefined },
    {
      rotulo: 'evidência de falha congelada',
      montar: () => fixture('reference'),
      plano: { getTagRef: ['timeout', 'timeout', 'timeout'] },
    },
  ];
  for (const { rotulo, montar, plano } of cenarios) {
    const { decisao: base } = await decisaoDeProducao(montar());
    const primeira = await chamarCostura({
      client: makeFakeClient(montar(), plano),
      decisao: base,
      failurePlan: plano,
    });
    // A segunda vez, a partir de um CLONE PROFUNDO das entradas: se a costura
    // mutasse o que recebeu, ou dependesse da identidade do objeto, a segunda
    // decisão sairia diferente — e uma reconciliação cuja segunda rodada
    // diverge da primeira não é idempotente.
    const segunda = await chamarCostura({
      client: makeFakeClient(montar(), plano),
      decisao: clonarEntradas(base),
      failurePlan: plano,
    });
    assert.deepEqual(segunda, primeira, `${rotulo}: a reconciliação repetida divergiu`);
    assert.deepEqual(segunda.reads, primeira.reads, `${rotulo}: a sequência de releitura divergiu entre as duas rodadas`);
    assert.equal(primeira.writeProposed, false, `${rotulo}: a primeira rodada propôs escrita`);
    assert.equal(segunda.writeProposed, false, `${rotulo}: a segunda rodada propôs escrita`);
    assert.equal(primeira.writeAction, null);
    assert.equal(segunda.writeAction, null);
    semApplyLiberado(segunda);
  }
});

it('a lista de marcadores do fixture concorrente não chega à evidência de produção, e a costura não a inventa', async () => {
  const mod = await cli();
  const estado = fixture('concurrent');
  assert.equal(estado.closeMarkers.length, 2, 'o fixture concorrente deixou de declarar dois marcadores em andamento');
  const snapshot = clienteDeEstado(estado);
  const { decisao } = await decisaoDeProducao(snapshot);
  // O caminho de produção classifica MISSING, e não CONCURRENT: o construtor
  // exportado de evidência não recebe `closeMarkers` e o produz vazio, e
  // nenhuma das cinco leituras devolve um marcador. A costura não inventa um —
  // ela recebe a classificação como DADO e a repassa intacta.
  assert.deepEqual(decisao.evidence.closeMarkers, [], 'a evidência de produção recebeu marcadores que o cliente não devolveu');
  assert.equal(decisao.classification.code, 'MISSING');
  assert.notEqual(decisao.classification.code, 'CONCURRENT');
  const custura = await chamarCostura({ client: makeFakeClient(snapshot), decisao });
  assert.equal(custura.classification.code, 'MISSING');
  assert.equal(custura.family, null, 'a ausência de marcadores virou família de falha de leitura');
  assert.equal(custura.writeProposed, false);
  // E a suíte não contorna isso chamando o classificador com uma evidência
  // montada à mão: ela reporta o que o caminho de produção produz.
  const fonte = fonteDoModulo('failure.test.js');
  assert.doesNotMatch(
    fonte,
    /from '\.\/classify\.js'/,
    'a suíte importa o classificador para produzir uma decisão que a produção deveria ter computado',
  );
  void mod;
});

it('um 404 é ausência e é a única família que prova ausência', async () => {
  // O 404 não é uma das seis falhas roteirizadas — a arapuca programável não
  // tem desfecho para ele. Ele vem do ESTADO congelado: a referência da tag de
  // `fixtures/missing.json` responde 404 no caminho do cliente, e é esse
  // envelope que a costura normaliza. Nenhuma outra família pode virar
  // ausência, e é por isso que a prova usa um envelope real em vez de um
  // literal montado aqui.
  const mod = await cli();
  const snapshot = clienteDeEstado(fixture('missing'));
  assert.equal(snapshot.release.ok, false);
  assert.equal(snapshot.release.status, 404);
  const { decisao } = await decisaoDeProducao(snapshot);
  const client = makeFakeClient(snapshot, { getReleaseByTag: [] });
  const custura = await chamarCostura({ client, decisao, failurePlan: { getReleaseByTag: [] } });
  assert.equal(custura.family, 'MISSING', 'o 404 não normalizou para a família de ausência');
  assert.match(custura.reason, /não existe no remoto/);
  assert.equal(custura.reason.includes('não ausente'), false, 'a ausência PROVADA foi descrita como estado desconhecido');
  assert.equal(custura.recovered, false);
  assert.equal(custura.writeProposed, false);
  const plano = mod.buildClosePlan({
    version: decisao.version,
    expectedSha: decisao.expectedSha,
    snapshot,
    eligibility: decisao.eligibility,
    classificacao: decisao.classification,
    evidence: decisao.evidence,
    mutations: decisao.mutations,
    reconciliation: custura,
  });
  assert.equal(plano.applyLiberado, false);
  assert.match(plano.bloqueio, /reconciliação recusada \(MISSING\)/);
});

it('uma recusa da costura bloqueia o plano mesmo quando a elegibilidade sobreviveu', async () => {
  const mod = await cli();
  const base = fixture('reference');
  // A elegibilidade sobrevive porque a TENTATIVA que a produziu rodou sobre um
  // cliente limpo: a recusa vem de uma releitura que falhou depois, sobre outro
  // cliente. Sem este caso, a regra de bloqueio da costura pareceria funcionar
  // apenas porque a elegibilidade também ficou falsa — e uma leitura
  // indeterminada que não bloqueia o apply é o defeito inteiro que o bloqueio
  // existe para impedir.
  const { decisao } = await decisaoDeProducao(base);
  assert.equal(decisao.eligibility.eligible, true, 'o baseline de referência não é elegível');
  const client = makeFakeClient(base, { listMilestones: ['timeout', 'timeout'] });
  const custura = await chamarCostura({ client, decisao, failurePlan: { listMilestones: ['timeout', 'timeout'] } });
  assert.equal(custura.family, 'TRANSPORT');
  assert.equal(decisao.eligibility.eligible, true, 'a elegibilidade não deveria mudar: a costura não a recalcula');
  const plano = mod.buildClosePlan({
    version: decisao.version,
    expectedSha: decisao.expectedSha,
    snapshot: base,
    eligibility: decisao.eligibility,
    classificacao: decisao.classification,
    evidence: decisao.evidence,
    mutations: decisao.mutations,
    reconciliation: custura,
  });
  assert.equal(plano.applyLiberado, false, 'uma leitura indeterminada liberou o apply com a elegibilidade intacta');
  assert.match(plano.bloqueio, /^reconciliação recusada \(TRANSPORT\): /);
  // E o par continua independente: `writeProposed` é falso, e o plano é
  // bloqueado; o no-op concluído é o caso oposto, com `applyLiberado` verdadeiro
  // e `writeProposed` falso. Nenhum dos dois é derivado do outro.
  assert.equal(custura.writeProposed, false);
  assert.equal(custura.writeAction, null);
  semApplyLiberado(custura);
});

it('uma recusa de permissão é a família própria, e não uma indisponibilidade', async () => {
  // Nenhum fixture congelado carrega um envelope 401/403 — a arapuca
  // programável não tem desfecho para ele e os oito cenários são todos
  // ausentes, parciais, duplicados, conflitantes, vermelhos ou concorrentes. O
  // ESTADO é declarado aqui, e só ele: o envelope da leitura é trocado, e
  // nenhuma normalização é reimplementada. A distinção entre credencial e
  // disponibilidade é justamente a que o operador precisa, e uma família sem
  // prova seria uma família afirmada.
  const base = fixture('reference');
  const snapshot = {
    ...base,
    tagRef: { ok: false, status: 403, data: null },
  };
  const { decisao } = await decisaoDeProducao(snapshot);
  assert.equal(decisao.eligibility.code, 'PERMISSION', 'a elegibilidade de produção não nomeou a recusa de permissão');
  const client = makeFakeClient(snapshot);
  const custura = await chamarCostura({ client, decisao, failurePlan: { getTagRef: [] } });
  assert.equal(custura.family, 'PERMISSION', 'a costura colapsou a recusa de permissão em outra família');
  assert.match(custura.reason, /não alcança o recurso/);
  assert.match(custura.reason, /desconhecido, não ausente/);
  assert.equal(custura.recovered, false);
  assert.equal(custura.writeProposed, false);
});

it('com estado bloqueante E recusa, o bloqueio relatado é a recusa da leitura', async () => {
  const mod = await cli();
  // DUPLICATE é um código bloqueante; a recusa da releitura também bloqueia. As
  // duas coisas são verdade ao mesmo tempo, e o operador precisa da que muda a
  // ação dele: um estado INDETERMINADO pede releitura, um estado conhecido
  // duplicado pede decisão humana sobre qual release fechar.
  const snapshot = clienteDeEstado(fixture('duplicate'));
  const { decisao } = await decisaoDeProducao(snapshot);
  assert.equal(decisao.classification.code, 'DUPLICATE');
  const client = makeFakeClient(snapshot, { getBranchHead: ['timeout', 'timeout'] });
  const custura = await chamarCostura({ client, decisao, failurePlan: { getBranchHead: ['timeout', 'timeout'] } });
  assert.equal(custura.family, 'TRANSPORT');
  const plano = mod.buildClosePlan({
    version: decisao.version,
    expectedSha: decisao.expectedSha,
    snapshot,
    eligibility: decisao.eligibility,
    classificacao: decisao.classification,
    evidence: decisao.evidence,
    mutations: decisao.mutations,
    reconciliation: custura,
  });
  assert.equal(plano.applyLiberado, false);
  assert.match(plano.bloqueio, /^reconciliação recusada \(TRANSPORT\): /);
  assert.doesNotMatch(plano.bloqueio, /^estado DUPLICATE/);
});

it('o código de saída de verify leva a recusa da costura em conta, e isso é lido do código', () => {
  // LIMITE DECLARADO: nenhuma família de falha pode ALCANÇAR `runVerify` nesta
  // fase — a CLI nunca passa um plano de falhas, e sem plano a costura não
  // executa leitura nenhuma. A regra está lá para a Fase 10/11, quando uma
  // leitura real puder falhar, e por isso ela é uma guarda de FONTE: não há
  // caminho de comportamento que a observe hoje, e uma guarda que afirma o
  // contrário passaria sem olhar nada. A afirmação é explícita sobre isso.
  const fonte = fonteDoModulo('release-close.js');
  const corpo = corpoDaFuncao(fonte, /^async function runVerify\(/m);
  assert.match(corpo, /reconciliation/, 'a verificação não lê o bloco de reconciliação');
  assert.match(
    corpo,
    /eligibility\.eligible\s*&&\s*!recusou\s*\?\s*0\s*:\s*1/,
    'o código de saída de verify ignora a recusa da costura',
  );
  const recusa = /const recusou = decision\.reconciliation !== null && decision\.reconciliation\.family !== null;/.test(corpo);
  assert.ok(recusa, 'a verificação não tem a condição de recusa que o seu código de saída usa');
  // E a mesma condição no texto não aparece: verify não ganhou linha nenhuma.
  assert.doesNotMatch(
    corpo,
    /renderVerifyText\([^)]*reconciliation|renderVerifyJson\([^)]*reconciliation/,
    'a saída de verify ganhou o bloco de reconciliação, e a forma observada mudou',
  );
});
