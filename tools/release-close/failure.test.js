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
