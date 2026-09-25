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
import * as contrato from './client.js';

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
