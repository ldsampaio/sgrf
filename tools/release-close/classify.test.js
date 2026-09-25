// Prova da expansão: classificador de seis estados sobre fixtures
// versionados mais sequências roteirizadas do fake (OPS-02).
//
// Roda com: node --test tools/release-close/ (zero dependências, sem rede,
// sem banco). Nomes em PT-BR seguindo a convenção de backend/tests/.

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { classifySnapshot } from './classify.js';
import { makeFakeClient } from './fake-client.js';

const fixture = (name) =>
  JSON.parse(readFileSync(new URL(`./fixtures/${name}.json`, import.meta.url), 'utf8'));

const EXPECTED = {
  missing: 'MISSING',
  partial: 'PARTIAL',
  duplicate: 'DUPLICATE',
  conflicting: 'CONFLICTING',
  failed: 'FAILED',
  concurrent: 'CONCURRENT',
};

describe('classificação de snapshot em seis estados (OPS-02)', () => {
  for (const [name, code] of Object.entries(EXPECTED)) {
    it(`classifica o fixture ${name} como ${code} com motivo PT-BR e sem ação de escrita`, () => {
      const decisao = classifySnapshot(fixture(name));
      assert.equal(decisao.code, code);
      assert.equal(decisao.eligible, false);
      assert.equal(decisao.writeAction, null);
      assert.equal(typeof decisao.reason, 'string');
      assert.ok(decisao.reason.length > 0);
    });
  }

  it('não importa o módulo de elegibilidade (contrato independente, D-09)', () => {
    const fonte = readFileSync(new URL('./classify.js', import.meta.url), 'utf8');
    assert.ok(!/from\s+['"]\.\/eligibility\.js['"]/.test(fonte));
    assert.ok(!/require\(\s*['"]\.\/eligibility(\.js)?['"]\s*\)/.test(fonte));
    assert.ok(!/import\s+.*eligibility/.test(fonte));
  });

  it('sequência roteirizada 409 depois 429 depois dado é observável no log de chamadas', async () => {
    const snap = fixture('reference');
    const fake = makeFakeClient(snap, { getTagRef: ['status-409', 'status-429'] });
    const primeira = await fake.getTagRef('v0.1.1');
    const segunda = await fake.getTagRef('v0.1.1');
    const terceira = await fake.getTagRef('v0.1.1');
    assert.equal(primeira.status, 409);
    assert.equal(primeira.ok, false);
    assert.equal(segunda.status, 429);
    assert.equal(terceira.ok, true);
    assert.deepEqual(
      fake.calls.map((c) => [c.seq, c.method]),
      [[1, 'getTagRef'], [2, 'getTagRef'], [3, 'getTagRef']],
    );
  });

  it('leituras seguem a ordem ref, tag-object, main, release, milestones no log', async () => {
    const fake = makeFakeClient(fixture('reference'));
    await fake.getTagRef('v0.1.1');
    await fake.getTagObject('0a68d6f0c55e7be07d13a0bbc4ed36d4af772630');
    await fake.getBranchHead('main');
    await fake.getReleaseByTag('v0.1.1');
    await fake.listMilestones();
    assert.deepEqual(
      fake.calls.map((c) => c.method),
      ['getTagRef', 'getTagObject', 'getBranchHead', 'getReleaseByTag', 'listMilestones'],
    );
    assert.deepEqual(fake.calls.map((c) => c.seq), [1, 2, 3, 4, 5]);
  });

  it('fixture failed carrega FAILED com motivo PT-BR e sem ação de escrita', () => {
    const decisao = classifySnapshot(fixture('failed'));
    assert.equal(decisao.code, 'FAILED');
    assert.equal(decisao.writeAction, null);
    assert.ok(decisao.reason.length > 0);
  });

  it('rejeita snapshot com formato inválido com TypeError', () => {
    for (const invalido of [null, undefined, 'v0.1.1', 42, ['missing']]) {
      assert.throws(() => classifySnapshot(invalido), TypeError);
    }
  });

  it('classifica o estado concorrente de forma determinística em duas leituras', () => {
    const snap = fixture('concurrent');
    const primeira = classifySnapshot(snap);
    const segunda = classifySnapshot(JSON.parse(JSON.stringify(snap)));
    assert.equal(primeira.code, 'CONCURRENT');
    assert.deepEqual(segunda, primeira);
  });

  it('nenhum objeto de decisão carrega ação de escrita nos sete fixtures', () => {
    for (const name of [...Object.keys(EXPECTED), 'reference']) {
      const decisao = classifySnapshot(fixture(name));
      assert.equal(decisao.writeAction, null, `fixture ${name} com writeAction não-nulo`);
    }
  });
});
