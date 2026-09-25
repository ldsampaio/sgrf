// canary.test.js: a fronteira de zero mutação é medida, não afirmada.
//
// Roda com: node --test tools/release-close/ (zero dependências, sem rede, sem
// banco, sem relógio). Nomes em PT-BR, como em backend/tests/.
//
// Grupo A (tarefa 1 do plano 09-06): a superfície de cliente é EXATA — os cinco
// leituras declaradas e nada mais que possa ser chamado — e o invariante
// compartilhado de zero mutação recusa toda contagem diferente de zero.
//
// Grupo B (tarefa 2): a arapuca programável mede o efeito na fronteira de
// efeito colateral, com contador no fecho e cliente congelado.
//
// Grupo canary (tarefa 3): um processo filho executa de propósito o escape que
// a fronteira existe para impedir, e o processo pai exige que esse escape
// termine em status não zero.
//
// Este arquivo é o ÚNICO lugar do tool island que nomeia a capacidade proibida
// que o grupo canary injeta: nenhuma fonte de produção a nomeia, e a varredura
// estática de nowrite.test.js continua sendo o check complementar, não
// substituído por aqui.
//
// CONVENÇÃO OBRIGATÓRIA: toda sonda deste arquivo é um `it` de TOPO, fora de
// qualquer `describe`. O node recua as linhas `not ok` de subtestes aninhados e
// o verificador de evidência RED (gsd check tdd-red-evidence) só reconhece o
// teste-alvo quando `not ok N - <nome>` sai na coluna 0 do TAP. Herdada de 09-04
// e 09-05.

import { it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as contrato from './client.js';
import * as arapuca from './fake-client.js';

// Cliente mínimo que satisfaz a superfície: exatamente as cinco leituras.
const LEITURAS = () => ({
  getTagRef: async () => null,
  getTagObject: async () => null,
  getBranchHead: async () => null,
  getReleaseByTag: async () => null,
  listMilestones: async () => null,
});

// ── Grupo A.1: a superfície declarada ───────────────────────────────────────

it('contrato: READ_METHODS mantém os cinco nomes na ordem original', () => {
  assert.deepEqual(contrato.READ_METHODS, [
    'getTagRef',
    'getTagObject',
    'getBranchHead',
    'getReleaseByTag',
    'listMilestones',
  ]);
  assert.equal(contrato.READ_METHODS.length, 5, 'a superfície declarada tem exatamente cinco leituras');
});

it('superfície exata: aceita os cinco métodos com contabilidade não chamável', () => {
  // A contabilidade não chamável (log de chamadas, contador, registro) é
  // permitida: ela é contabilidade, não capacidade.
  const client = { ...LEITURAS(), calls: [], mutations: 0, writes: [] };
  assert.equal(contrato.assertClientShape(client), true);
});

it('superfície exata: rejeita capacidade extra chamável nomeando-a', () => {
  const client = { ...LEITURAS(), createRelease: async () => null };
  assert.throws(
    () => contrato.assertClientShape(client),
    (erro) => {
      assert.ok(erro instanceof TypeError, `a recusa precisa ser TypeError: ${erro}`);
      assert.match(erro.message, /createRelease/, 'a recusa não nomeia a capacidade extra');
      assert.match(erro.message, /somente leitura/, 'a recusa não declara a superfície somente leitura');
      return true;
    },
  );
});

it('superfície exata: rejeita capacidade extra com nome que nenhuma varredura adivinharia', () => {
  // A recusa é estrutural, não uma lista de nomes: qualquer chamável próprio de
  // topo cai, incluindo nomes que a varredura estática de texto nunca cita.
  for (const nome of ['apagar', 'refletir', 'encaminharPara', 'mutacaoRemota']) {
    const client = { ...LEITURAS(), [nome]: async () => null };
    assert.throws(
      () => contrato.assertClientShape(client),
      (erro) => erro instanceof TypeError && erro.message.includes(nome),
      `capacidade "${nome}" não foi recusada`,
    );
  }
});

it('superfície exata: a recusa não desce para objeto aninhado, por contrato', () => {
  // Fronteira explícita do contrato: a verificação trata dos membros próprios
  // ENUMERÁVEIS e de TOPO do objeto devolvido, e não desce para dentro deles —
  // descer seria indiscernível da contabilidade legítima que o fake expõe (o
  // log de chamadas e o registro de efeitos são arrays e objetos), e o contrato
  // proíbe a recusa de inspecionar objetos aninhados. Um membro não chamável
  // que carrega um chamável mais fundo é, portanto, CONTABILIDADE nesta
  // superfície, não capacidade.
  //
  // A camada que cobre essa rota não é a verificação de forma: é o invariante
  // de zero mutação, que recusa pela CONTAGEM MEDIDA na fronteira de efeito
  // colateral, venha a chamada de onde vier. E é o grupo canary (tarefa 3) que
  // prova, num processo filho, que uma rota de escape é barrada.
  const aninhado = { ...LEITURAS(), rotas: { createRelease: async () => null } };
  assert.equal(contrato.assertClientShape(aninhado), true);

  const emArray = { ...LEITURAS(), metodos: [async () => null] };
  assert.equal(contrato.assertClientShape(emArray), true);
});

it('superfície exata: rejeita cada leitura ausente nomeando-a', () => {
  for (const ausente of contrato.READ_METHODS) {
    const client = LEITURAS();
    delete client[ausente];
    assert.throws(
      () => contrato.assertClientShape(client),
      (erro) => erro instanceof TypeError && erro.message.includes(ausente),
      `leitura ausente não nomeada: ${ausente}`,
    );
  }
});

it('superfície exata: rejeita leitura cujo valor não é função', () => {
  for (const torta of contrato.READ_METHODS) {
    const client = LEITURAS();
    client[torta] = 'v0.1.1';
    assert.throws(
      () => contrato.assertClientShape(client),
      TypeError,
      `leitura não função foi aceita: ${torta}`,
    );
  }
});

it('superfície exata: rejeita entrada que não é objeto', () => {
  for (const entrada of [null, undefined, 'cliente', 42, true, () => null]) {
    assert.throws(
      () => contrato.assertClientShape(entrada),
      TypeError,
      `entrada não objeto foi aceita: ${String(entrada)}`,
    );
  }
});

it('superfície exata: membros herdados e não enumeráveis não são capacidades', () => {
  // Fronteira declarada pelo contrato: a verificação trata do que o chamador
  // LÊ no objeto devolvido, isto é, dos membros próprios enumeráveis. As duas
  // rotas que essa fronteira deixa de fora têm cobertura própria: anexar um
  // membro diretamente é TypeError porque o cliente é congelado (grupo B), e
  // espalhar as propriedades para um objeto novo é barrado pelo grupo canary
  // (tarefa 3). Fica fixado aqui para que qualquer mudança seja deliberada.
  const herdado = Object.create({ createRelease: async () => null });
  Object.assign(herdado, LEITURAS());
  assert.equal(contrato.assertClientShape(herdado), true);

  const naoEnumeravel = LEITURAS();
  Object.defineProperty(naoEnumeravel, 'createRelease', {
    value: async () => null,
    enumerable: false,
  });
  assert.equal(contrato.assertClientShape(naoEnumeravel), true);
});

it('costura gh: o rascunho continua aceito e continua falhando fechado na Fase 10', async () => {
  const { ghClient } = await import('./gh-client.js');
  assert.equal(contrato.assertClientShape(ghClient), true);
  for (const metodo of contrato.READ_METHODS) {
    await assert.rejects(
      () => ghClient[metodo]('v0.1.1'),
      (erro) => erro instanceof Error && erro.message.includes('Fase 10'),
      `método ${metodo} não falha nomeando a Fase 10`,
    );
  }
});

// ── Grupo A.2: o invariante compartilhado de zero mutação ────────────────────

// No RED o invariante ainda não existe: o namespace é importado inteiro para
// que cada sonda falhe na asserção que o exige, e não em um crash de import
// (INVALID_RED sob #3770).
function invarianteCompartilhado() {
  assert.equal(
    typeof contrato.assertNoMutation,
    'function',
    'client.js ainda não expõe o invariante compartilhado de zero mutação',
  );
  return contrato.assertNoMutation;
}

// Rotulo legivel para a mensagem de asercao. O nome e ASCII de proposito:
// um parametro e seu uso com grafia quase identica falha em ReferenceError,
// e essa falha e um crash de sonda, nao uma asercao.
const descrever = (registro) => {
  const chaves = Object.keys(registro);
  if (chaves.length === 0) return 'sem chaves';
  return chaves.map((chave) => chave + '=' + String(registro[chave])).join(',');
};

it('invariante: o módulo expõe o invariante compartilhado com um único parâmetro', () => {
  const invariante = invarianteCompartilhado();
  assert.equal(
    invariante.length,
    1,
    'o invariante aceita um segundo parâmetro de tolerância, o que abriria um caminho de perdão',
  );
});

it('invariante: aceita contagem zero e devolve zero', () => {
  const invariante = invarianteCompartilhado();
  assert.equal(invariante({ mutations: 0 }), 0);
  assert.equal(invariante({ mutations: 0, writes: [] }), 0);
});

it('invariante: recusa contagem um nomeando a capacidade e a contagem', () => {
  const invariante = invarianteCompartilhado();
  assert.throws(
    () =>
      invariante({
        mutations: 1,
        writes: [{ capability: 'createRelease', args: ['v0.1.1'] }],
      }),
    (erro) => {
      assert.ok(erro instanceof TypeError, `a recusa precisa ser TypeError: ${erro}`);
      assert.match(erro.message, /createRelease/, 'a recusa não nomeia a capacidade observada');
      assert.match(erro.message, /somente leitura/, 'a recusa não declara o contrato violado');
      assert.match(erro.message, /\b1\b/, 'a recusa não declara a contagem');
      return true;
    },
  );
});

it('invariante: recusa toda contagem diferente de zero sem caminho de perdão', () => {
  const invariante = invarianteCompartilhado();
  for (const contagem of [1, 2, 7, 1000, Number.MAX_SAFE_INTEGER]) {
    assert.throws(
      () => invariante({ mutations: contagem }),
      TypeError,
      `contagem ${contagem} saiu como limpa`,
    );
  }
  // Sem nome de capacidade disponível, a recusa ainda nomeia a contagem.
  assert.throws(
    () => invariante({ mutations: 3 }),
    (erro) => erro instanceof TypeError && erro.message.includes('3'),
  );
});

it('invariante: recusa medição ausente, negativa, fracionária ou não numérica', () => {
  const invariante = invarianteCompartilhado();
  const invalidas = [
    { mutations: -1 },
    { mutations: 1.5 },
    { mutations: '0' },
    { mutations: null },
    { mutations: Number.NaN },
    { mutations: Number.POSITIVE_INFINITY },
    { mutations: 0n },
    {},
  ];
  for (const medicao of invalidas) {
    assert.throws(
      () => invariante(medicao),
      TypeError,
      `medição inválida aceita: { ${descrever(medicao)} }`,
    );
  }
  for (const entrada of [null, undefined, 'zero', 0, [0]]) {
    assert.throws(
      () => invariante(entrada),
      TypeError,
      `entrada não registro aceita: ${String(entrada)}`,
    );
  }
});

it('invariante: a superfície do módulo é fechada, sem reset nem tolerância', () => {
  // Se um dia alguém acrescentar um `zerarMutacoes` ou um `aceitar(count)` ao
  // módulo, esta lista quebra — que é o ponto: não pode existir saída lateral
  // que torne a contagem editável depois do fato.
  assert.deepEqual(Object.keys(contrato).sort(), [
    'READ_METHODS',
    'assertClientShape',
    'assertNoMutation',
  ]);
});

// ── Grupo B: a arapuca programável mede de verdade ──────────────────────────
//
// No RED a fábrica de arapuca armada ainda não existe: o módulo é importado
// inteiro e um helper afirma a existência da fábrica ANTES de chamá-la, de modo
// que cada sonda falha em asserção e não em crash de import (INVALID_RED).

const referencia = () =>
  JSON.parse(readFileSync(new URL('./fixtures/reference.json', import.meta.url), 'utf8'));

function arapucaDeProducao(snapshot = referencia(), failurePlan) {
  return arapuca.makeFakeClient(snapshot, failurePlan);
}

function arapucaArmada(snapshot = referencia(), failurePlan) {
  assert.equal(
    typeof arapuca.makeArmedFakeClient,
    'function',
    'fake-client.js ainda não expõe a fábrica que arma a arapuca',
  );
  return arapuca.makeArmedFakeClient(snapshot, failurePlan);
}

it('arapuca: a contagem medida vem do fecho, não de um array público editável', () => {
  const fake = arapucaDeProducao();
  assert.equal(fake.mutations, 0);
  assert.equal(fake.writes.length, 0);
  // O registro exposto é uma cópia congelada do talão do fecho: empurrar nele é
  // TypeError e não move a contagem, que é a medição e não o comprimento de nada
  // que o chamador possa editar.
  assert.throws(
    () => fake.writes.push({ capability: 'empurro', args: [] }),
    TypeError,
    'o registro de efeitos exposto aceitou escrita',
  );
  assert.equal(fake.mutations, 0, 'empurrar no registro exposto alterou a contagem medida');
  assert.equal(fake.writes.length, 0);
});

it('arapuca: a armadilha registra o efeito e incrementa a contagem medida', () => {
  const fake = arapucaArmada();
  assert.equal(fake.mutations, 0, 'a arapuca armada já nasceu com contagem diferente de zero');
  fake.trap('createRelease', ['v0.1.1']);
  assert.equal(fake.mutations, 1, 'a armadilha não mediu o efeito');
  assert.equal(fake.writes.length, 1, 'o efeito não foi registrado');
  assert.equal(fake.writes[0].capability, 'createRelease');
  assert.deepEqual(fake.writes[0].args, ['v0.1.1']);
  fake.trap('updateRef', ['refs/tags/v0.1.1']);
  assert.equal(fake.mutations, 2, 'a contagem medida não acumulou o segundo efeito');
  assert.equal(fake.writes.length, 2, 'o comprimento do registro divergiu da contagem');
  assert.equal(fake.mutations, fake.writes.length);
});

it('arapuca: o invariante compartilhado recusa a contagem de uma armadilha armada', () => {
  const invariante = invarianteCompartilhado();
  const fake = arapucaArmada();
  assert.equal(invariante(fake), 0);
  fake.trap('createRelease', ['v0.1.1']);
  assert.throws(
    () => invariante(fake),
    (erro) => {
      assert.ok(erro instanceof TypeError, `a recusa precisa ser TypeError: ${erro}`);
      assert.match(erro.message, /createRelease/, 'a recusa não nomeia a capacidade observada');
      assert.match(erro.message, /\b1\b/, 'a recusa não declara a contagem');
      return true;
    },
  );
});

it('arapuca: o cliente é congelado e recusa anexar capacidade diretamente', () => {
  const fake = arapucaDeProducao();
  assert.equal(Object.isFrozen(fake), true, 'a arapuca não está congelada');
  assert.throws(
    () => {
      fake.createRelease = async () => null;
    },
    TypeError,
    'atribuir uma capacidade não disparou TypeError',
  );
  assert.throws(
    () => Object.defineProperty(fake, 'createRelease', { value: async () => null }),
    TypeError,
    'definir uma capacidade por descriptor não disparou TypeError',
  );
  assert.equal('createRelease' in fake, false, 'a capacidade sobreviveu ao congelamento');
  assert.throws(
    () => {
      fake.mutations = 99;
    },
    TypeError,
    'atribuir a contagem medida não disparou TypeError',
  );
  assert.equal(fake.mutations, 0, 'a contagem medida foi atribuída de fora');
  assert.throws(
    () => {
      fake.writes = [];
    },
    TypeError,
    'atribuir o registro de efeitos não disparou TypeError',
  );
});

it('arapuca: a arapuca de produção não expõe a armadilha', () => {
  const fake = arapucaDeProducao();
  assert.equal(fake.trap, undefined, 'a arapuca de produção expôs a armadilha');
  assert.equal(typeof arapucaArmada().trap, 'function', 'a arapuca armada não expôs a armadilha');
});

it('arapuca: armar a armadilha não muda a superfície pública do cliente', () => {
  const producao = arapucaDeProducao();
  const armada = arapucaArmada();
  assert.deepEqual(
    Object.keys(producao).sort(),
    Object.keys(armada).sort(),
    'a armadilha mudou a superfície pública da arapuca',
  );
  // A forma exata aceita as duas: a armadilha não é uma capacidade da
  // superfície, é uma costura de teste fora do que o chamador lê.
  assert.equal(contrato.assertClientShape(producao), true);
  assert.equal(contrato.assertClientShape(armada), true);
});

it('arapuca: writes é um acessor somente leitura cuja forma os pontos fora deste plano já esperam', async () => {
  // Costura de compatibilidade com eligibility.test.js e safe04.test.js, dois
  // arquivos que este plano não possui e não pode editar. A forma observável
  // fica congelada e nomeada: devolve um array, comprimento igual à contagem do
  // fecho, e array vazio congelado quando nada foi observado — então
  // `fake.writes.length === 0`, leitura por índice, iteração e comparação
  // profunda contra `[]` continuam exatamente como estão.
  const fake = arapucaDeProducao();
  assert.ok(Array.isArray(fake.writes), 'o acessor writes não devolveu um array');
  assert.equal(Object.isFrozen(fake.writes), true, 'o array devolvido não está congelado');
  assert.equal(fake.writes.length, fake.mutations);
  assert.equal(fake.writes.length, 0);
  assert.equal(fake.writes[0], undefined);
  assert.deepEqual(fake.writes, []);
  assert.deepEqual([...fake.writes], []);

  // Uma leitura real pela superfície não move a contagem.
  await fake.getTagRef('v0.1.1');
  await fake.getBranchHead('main');
  assert.equal(fake.mutations, 0, 'uma leitura produziu mutação');
  assert.equal(fake.writes.length, 0, 'uma leitura encheu o registro de efeitos');
});

it('arapuca: os pontos de leitura de writes.length fora do escopo continuam no lugar', () => {
  // Se um desses pontos mudar, a costura de compatibilidade deixa de ser
  // necessária e a migração passa a ser explícita — com os dois arquivos
  // adicionados ao escopo do plano que a fizer, nunca silenciosamente.
  for (const nome of ['eligibility.test.js', 'safe04.test.js']) {
    const texto = readFileSync(new URL(`./${nome}`, import.meta.url), 'utf8');
    assert.match(texto, /writes\.length/, `${nome} deixou de ler writes.length`);
  }
});

// ── Grupo B.2: o que a tarefa 2 proíbe mudar ─────────────────────────────────
//
// Estas sondas são verdes ANTES da tarefa 2 e devem continuar verdes depois: a
// tarefa 2 muda o que o contador significa, não o que as leituras fazem. O
// contrato de plano roteirizado (D-07) é consumido pelo plano 09-09 e não pode
// se mover.

it('arapuca: o vocabulário roteirizado segue com os seis desfechos, na ordem', () => {
  assert.deepEqual(arapuca.SCRIPTED_FAILURE_OUTCOMES, [
    'timeout',
    'lost-response',
    'status-409',
    'status-422',
    'status-429',
    'status-5xx',
  ]);
});

it('arapuca: a numeração de sequência começa em um e sobe de um em um', async () => {
  const fake = arapucaDeProducao();
  for (const metodo of contrato.READ_METHODS) {
    await fake[metodo]('v0.1.1');
  }
  assert.deepEqual(
    fake.calls.map((c) => c.seq),
    [1, 2, 3, 4, 5],
  );
  assert.equal(fake.calls[0].method, 'getTagRef');
  assert.equal(fake.calls[4].method, 'listMilestones');
});

it('arapuca: a ordem das leituras é ref, objeto da tag, cabeça, release, milestones', async () => {
  const fake = arapucaDeProducao();
  for (const metodo of contrato.READ_METHODS) {
    await fake[metodo]('v0.1.1');
  }
  assert.deepEqual(
    fake.calls.map((c) => c.method),
    ['getTagRef', 'getTagObject', 'getBranchHead', 'getReleaseByTag', 'listMilestones'],
  );
});

it('arapuca: o roteiro é consumido em ordem e a fila esgotada volta ao snapshot', async () => {
  const fake = arapucaDeProducao(referencia(), { getTagRef: ['status-409', 'timeout'] });

  const primeira = await fake.getTagRef('v0.1.1');
  assert.equal(primeira.ok, false);
  assert.equal(primeira.status, 409);
  assert.equal(primeira.data, null);

  await assert.rejects(
    () => fake.getTagRef('v0.1.1'),
    (erro) => erro instanceof Error && erro.message.includes('Tempo esgotado'),
  );

  // Terceira chamada: a fila deste método acabou, então o snapshot responde.
  const terceira = await fake.getTagRef('v0.1.1');
  assert.equal(terceira.ok, true);
  assert.equal(terceira.data.object.type, 'tag');
  assert.deepEqual(
    fake.calls.map((c) => c.method),
    ['getTagRef', 'getTagRef', 'getTagRef'],
  );
  assert.equal(fake.mutations, 0, 'o roteiro roteirizado produziu mutação');
});

it('arapuca: o plano de falhas continua sendo recusado com TypeError', () => {
  const invalidos = [
    { getTagRef: 'timeout' },
    { getReleaseByTag: ['desfecho-desconhecido'] },
    { metodoInexistente: ['timeout'] },
  ];
  for (const plano of invalidos) {
    assert.throws(
      () => arapuca.makeFakeClient(referencia(), plano),
      TypeError,
      `plano de falhas inválido foi aceito: ${JSON.stringify(plano)}`,
    );
  }
  assert.throws(() => arapuca.makeFakeClient(null), TypeError);
});
