// Prova do tracer: elegibilidade de tag sobre o fixture de referência.
//
// Roda com: node --test tools/release-close/ (zero dependências, sem rede,
// sem banco). Nomes em PT-BR seguindo a convenção de backend/tests/.

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { checkTagEligibility } from './eligibility.js';
import { makeFakeClient } from './fake-client.js';

const fixture = (name) =>
  JSON.parse(readFileSync(new URL(`./fixtures/${name}.json`, import.meta.url), 'utf8'));

const clone = (obj) => JSON.parse(JSON.stringify(obj));

describe('elegibilidade de tag (SAFE-02)', () => {
  it('aceita tag anotada quando peel == main == SHA esperado', async () => {
    const snap = fixture('reference');
    const fake = makeFakeClient(snap);
    const decisao = await checkTagEligibility(fake, {
      version: 'v0.1.1',
      expectedSha: snap.expectedSha,
    });
    assert.equal(decisao.eligible, true);
    assert.equal(decisao.code, 'ELIGIBLE');
    assert.equal(decisao.writeAction, null);
    assert.equal(fake.writes.length, 0);
  });

  it('rejeita tag leve de salto único como inelegível', async () => {
    const snap = clone(fixture('reference'));
    snap.tagRef.data.object = { type: 'commit', sha: snap.expectedSha };
    const decisao = await checkTagEligibility(makeFakeClient(snap), {
      version: 'v0.1.1',
      expectedSha: snap.expectedSha,
    });
    assert.equal(decisao.eligible, false);
    assert.equal(decisao.code, 'LIGHTWEIGHT');
    assert.equal(decisao.writeAction, null);
  });

  it('rejeita cabeça da main divergente', async () => {
    const snap = clone(fixture('reference'));
    snap.branchHead.data.sha = 'b'.repeat(40);
    const decisao = await checkTagEligibility(makeFakeClient(snap), {
      version: 'v0.1.1',
      expectedSha: snap.expectedSha,
    });
    assert.equal(decisao.eligible, false);
    assert.equal(decisao.code, 'SAFE-02');
    assert.equal(decisao.writeAction, null);
  });

  it('rejeita SHA esperado divergente', async () => {
    const snap = fixture('reference');
    const decisao = await checkTagEligibility(makeFakeClient(snap), {
      version: 'v0.1.1',
      expectedSha: 'c'.repeat(40),
    });
    assert.equal(decisao.eligible, false);
    assert.equal(decisao.code, 'SAFE-02');
    assert.equal(decisao.writeAction, null);
  });

  it('rejeita tag ausente no remoto', async () => {
    const snap = clone(fixture('reference'));
    snap.tagRef = { ok: false, status: 404, data: null };
    const decisao = await checkTagEligibility(makeFakeClient(snap), {
      version: 'v0.1.1',
      expectedSha: snap.expectedSha,
    });
    assert.equal(decisao.eligible, false);
    assert.equal(decisao.code, 'MISSING');
    assert.equal(decisao.writeAction, null);
  });

  it('lança TypeError em SHA abreviado', async () => {
    const snap = fixture('reference');
    await assert.rejects(
      () =>
        checkTagEligibility(makeFakeClient(snap), {
          version: 'v0.1.1',
          expectedSha: '10c62ac',
        }),
      TypeError,
    );
  });

  it('lança TypeError em versão malformada', async () => {
    const snap = fixture('reference');
    await assert.rejects(
      () =>
        checkTagEligibility(makeFakeClient(snap), {
          version: '0.1.1',
          expectedSha: snap.expectedSha,
        }),
      TypeError,
    );
  });

  it('trata valores com metacaracteres como strings opacas (T-09-01)', async () => {
    const snap = fixture('reference');
    // Nenhum sink de subprocesso existe: estes valores só podem virar
    // TypeError de validação, nunca execução.
    await assert.rejects(
      () =>
        checkTagEligibility(makeFakeClient(snap), {
          version: 'v0.1.1; rm -rf /',
          expectedSha: snap.expectedSha,
        }),
      TypeError,
    );
    await assert.rejects(
      () =>
        checkTagEligibility(makeFakeClient(snap), {
          version: 'v0.1.1',
          expectedSha: '$(id)',
        }),
      TypeError,
    );
  });

  it('prova escrita zero: writes vazio e writeAction null em todo caminho', async () => {
    const snap = fixture('reference');
    const fake = makeFakeClient(snap);
    const decisoes = [
      await checkTagEligibility(fake, { version: 'v0.1.1', expectedSha: snap.expectedSha }),
      await checkTagEligibility(fake, { version: 'v0.1.1', expectedSha: 'd'.repeat(40) }),
    ];
    for (const decisao of decisoes) {
      assert.equal(decisao.writeAction, null);
    }
    assert.equal(fake.writes.length, 0);
    assert.equal(fake.mutations, 0);
  });

  it('ordena leituras: ref antes do objeto da tag antes da cabeça', async () => {
    const snap = fixture('reference');
    const fake = makeFakeClient(snap);
    await checkTagEligibility(fake, { version: 'v0.1.1', expectedSha: snap.expectedSha });
    const ordem = fake.calls.map((c) => c.method);
    assert.deepEqual(ordem.slice(0, 3), ['getTagRef', 'getTagObject', 'getBranchHead']);
    assert.deepEqual(
      fake.calls.map((c) => c.seq),
      [1, 2, 3],
    );
  });

  it('dupla execução do verify é segura: saída idêntica e zero escritas (OPS-01 idempotência)', () => {
    const cli = new URL('./release-close.js', import.meta.url);
    const primeira = execFileSync(process.execPath, [cli.pathname, 'verify', '--json'], {
      encoding: 'utf8',
    });
    const segunda = execFileSync(process.execPath, [cli.pathname, 'verify', '--json'], {
      encoding: 'utf8',
    });
    assert.equal(primeira, segunda);
    assert.equal(JSON.parse(primeira).mutations, 0);
  });

  it('clientes fake independentes têm logs isolados (OPS-01 concorrência single-process)', async () => {
    const snap = fixture('reference');
    const primeiro = makeFakeClient(snap);
    const segundo = makeFakeClient(snap);
    await checkTagEligibility(primeiro, { version: 'v0.1.1', expectedSha: snap.expectedSha });
    assert.equal(primeiro.calls.length, 3);
    assert.equal(segundo.calls.length, 0);
  });
});
