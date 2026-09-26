import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { awaitCIRuns, revalidateBeforeMutation } from './ci-check.js';
import { makeFakeClient } from './fake-client.js';

const BASE_SNAPSHOT = {
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

describe('awaitCIRuns', () => {
  it('returns evidence with action result and timestamp', async () => {
    const fake = makeFakeClient(BASE_SNAPSHOT);
    const result = await awaitCIRuns({
      ghClient: fake,
      repo: 'ldsampaio/sgrf',
      targetSha: '10c62ac85fd3ab275b8926c89f5f34ba4116e2cf',
      timeoutMs: 1000,
      pollIntervalMs: 100,
    });
    assert.equal(result.action, 'ci-wait');
    assert.ok(result.timestamp);
    assert.equal(result.targetSha, '10c62ac85fd3ab275b8926c89f5f34ba4116e2cf');
  });

  it('aborts on wrong-SHA main run', async () => {
    const snap = { ...BASE_SNAPSHOT, mainCIRun: { id: 1, status: 'completed', conclusion: 'success', headSha: 'wrongsha' } };
    const fake = makeFakeClient(snap);
    const result = await awaitCIRuns({
      ghClient: fake,
      repo: 'ldsampaio/sgrf',
      targetSha: '10c62ac85fd3ab275b8926c89f5f34ba4116e2cf',
      timeoutMs: 1000,
      pollIntervalMs: 100,
    });
    assert.equal(result.aborted, true);
    assert.ok(result.abortReason.includes('headSha'));
    assert.ok(result.nextAction);
  });

  it('aborts on CI timeout', async () => {
    const snap = { ...BASE_SNAPSHOT, mainCIRun: { id: 1, status: 'in_progress', conclusion: null, headSha: '10c62ac85fd3ab275b8926c89f5f34ba4116e2cf' }, tagCIRun: { id: 2, status: 'in_progress', conclusion: null, headSha: '10c62ac85fd3ab275b8926c89f5f34ba4116e2cf' } };
    const fake = makeFakeClient(snap);
    const result = await awaitCIRuns({
      ghClient: fake,
      repo: 'ldsampaio/sgrf',
      targetSha: '10c62ac85fd3ab275b8926c89f5f34ba4116e2cf',
      timeoutMs: 50,
      pollIntervalMs: 10,
    });
    assert.equal(result.aborted, true);
    assert.ok(result.abortReason.includes('timeout'));
  });

  it('returns success when both runs complete', async () => {
    const fake = makeFakeClient(BASE_SNAPSHOT);
    const result = await awaitCIRuns({
      ghClient: fake,
      repo: 'ldsampaio/sgrf',
      targetSha: '10c62ac85fd3ab275b8926c89f5f34ba4116e2cf',
      timeoutMs: 5000,
      pollIntervalMs: 100,
    });
    assert.equal(result.aborted, false);
    assert.ok(result.runs.length >= 0);
    assert.equal(result.nextAction, 'proceed to mutation');
  });
});

describe('revalidateBeforeMutation', () => {
  it('returns next step on successful revalidation', async () => {
    const fake = makeFakeClient(BASE_SNAPSHOT);
    const result = await revalidateBeforeMutation({
      ghClient: fake,
      repo: 'ldsampaio/sgrf',
      targetSha: '10c62ac85fd3ab275b8926c89f5f34ba4116e2cf',
      currentStep: 'release-draft',
      evidence: { target: { tagName: 'v0.1.1', expectedSha: '10c62ac85fd3ab275b8926c89f5f34ba4116e2cf' }, mainRef: { sha: '10c62ac85fd3ab275b8926c89f5f34ba4116e2cf' }, tagRef: { sha: '10c62ac85fd3ab275b8926c89f5f34ba4116e2cf' }, mainCIRun: { id: 1, status: 'completed', conclusion: 'success', headSha: '10c62ac85fd3ab275b8926c89f5f34ba4116e2cf' }, tagCIRun: { id: 2, status: 'completed', conclusion: 'success', headSha: '10c62ac85fd3ab275b8926c89f5f34ba4116e2cf' } },
    });
    assert.equal(result.aborted, false);
    assert.ok(result.nextAction);
  });

  it('aborts on tag SHA mismatch', async () => {
    const fake = makeFakeClient(BASE_SNAPSHOT);
    const result = await revalidateBeforeMutation({
      ghClient: fake,
      repo: 'ldsampaio/sgrf',
      targetSha: '10c62ac85fd3ab275b8926c89f5f34ba4116e2cf',
      currentStep: 'release-draft',
      evidence: { target: { tagName: 'v0.1.1', expectedSha: 'wrongsha' }, mainRef: { sha: '10c62ac85fd3ab275b8926c89f5f34ba4116e2cf' }, tagRef: { sha: '10c62ac85fd3ab275b8926c89f5f34ba4116e2cf' }, mainCIRun: { id: 1, status: 'completed', conclusion: 'success', headSha: '10c62ac85fd3ab275b8926c89f5f34ba4116e2cf' }, tagCIRun: { id: 2, status: 'completed', conclusion: 'success', headSha: '10c62ac85fd3ab275b8926c89f5f34ba4116e2cf' } },
    });
    assert.equal(result.aborted, true);
    assert.ok(result.abortReason.includes('tag'));
  });
});