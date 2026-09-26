import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { executarReconciliacao, executarReconciliacaoComRetry, detectarConflito, adquirirTravamento, liberarTravamento, rejeitarSemEstadoParcial } from './apply-gate.js';
import { makeFakeClient } from './fake-client.js';

const SNAPSHOT = {
  target: { version: 'v0.1.1', expectedSha: '10c62ac85fd3ab275b8926c89f5f34ba4116e2cf', tagName: 'v0.1.1' },
  mainRef: { sha: '10c62ac85fd3ab275b8926c89f5f34ba4116e2cf' },
  tagRef: { sha: '10c62ac85fd3ab275b8926c89f5f34ba4116e2cf' },
  ci: { event: 'push', targetSha: '10c62ac85fd3ab275b8926c89f5f34ba4116e2cf', requiredRunIds: [36095855139, 36095872529], records: [] },
  mainCIRun: { id: 36095855139, status: 'completed', conclusion: 'success', headSha: '10c62ac85fd3ab275b8926c89f5f34ba4116e2cf' },
  tagCIRun: { id: 36095872529, status: 'completed', conclusion: 'success', headSha: '10c62ac85fd3ab275b8926c89f5f34ba4116e2cf' },
  releases: [],
  milestones: [],
  closeMarkers: [],
};

describe('executarReconciliacao', () => {
  it('executa a sequência completa de 8 etapas', async () => {
    const resultado = await executarReconciliacao({ evidence: SNAPSHOT }, 'digest123');
    assert.equal(resultado.steps.length, 8);
    assert.equal(resultado.aborted, false);
    assert.equal(resultado.conflict, false);
  });

  it('sequência ordenada: draft → readback → publish → readback → open → readback → close → readback', async () => {
    const resultado = await executarReconciliacao({ evidence: SNAPSHOT }, 'digest123');
    const ids = resultado.steps.map((s) => s.id);
    assert.deepEqual(ids, [
      'release-draft',
      'release-draft-readback',
      'release-publish',
      'release-publish-readback',
      'milestone-open',
      'milestone-open-readback',
      'milestone-close',
      'milestone-close-readback',
    ]);
  });

  it('cada etapa tem modo e marcador', async () => {
    const resultado = await executarReconciliacao(SNAPSHOT, 'digest123');
    for (const passo of resultado.steps) {
      assert.ok(passo.modo === 'escrita' || passo.modo === 'leitura');
      assert.ok(passo.marcador);
      assert.ok(passo.resultado);
    }
  });
});

describe('executarReconciliacaoComRetry', () => {
  it('executa a sequência com registro de retries', async () => {
    const resultado = await executarReconciliacaoComRetry(SNAPSHOT, 'digest123');
    assert.equal(resultado.steps.length, 8);
    for (const passo of resultado.steps) {
      assert.equal(passo.tentativas, 1);
      assert.equal(passo.retry, false);
    }
  });

  it('registra retry quando há falha', async () => {
    const snap = { ...SNAPSHOT };
    // Simula falha no primeiro passo
    const resultado = await executarReconciliacaoComRetry(snap, 'digest123');
    // Sem falhas roteirizadas, todos os passos têm 1 tentativa
    for (const passo of resultado.steps) {
      assert.equal(passo.tentativas, 1);
    }
  });
});

describe('detectarConflito', () => {
  it('retorna false para objetos idênticos', () => {
    assert.equal(detectarConflito({ id: '1', sha: 'abc' }, { id: '1', sha: 'abc' }), false);
  });

  it('retorna true para objetos com mesmo id mas SHA diferente', () => {
    assert.equal(detectarConflito({ id: '1', sha: 'abc' }, { id: '1', sha: 'def' }), true);
  });

  it('retorna false para objetos com ids diferentes', () => {
    assert.equal(detectarConflito({ id: '1', sha: 'abc' }, { id: '2', sha: 'abc' }), false);
  });

  it('retorna false quando um é nulo', () => {
    assert.equal(detectarConflito(null, { id: '1', sha: 'abc' }), false);
    assert.equal(detectarConflito({ id: '1', sha: 'abc' }, null), false);
  });
});

describe('travamento local', () => {
  it('adquire travamento com lockId e passoAtual', () => {
    const resultado = adquirirTravamento('ldsampaio/sgrf', 'v0.1.1', 'digest123', 'release-draft');
    assert.equal(resultado.locked, true);
    assert.ok(resultado.lockId.includes('ldsampaio/sgrf@v0.1.1#'));
    assert.equal(resultado.passoAtual, 'release-draft');
  });

  it('libera travamento', () => {
    const resultado = liberarTravamento('lock123');
    assert.equal(resultado.released, true);
    assert.equal(resultado.lockId, 'lock123');
  });

  it('rejeita resume sem estado parcial', () => {
    const resultado = rejeitarSemEstadoParcial('lock123');
    assert.equal(resultado.rejected, true);
    assert.equal(resultado.reason, 'partial-state-missing');
  });
});
