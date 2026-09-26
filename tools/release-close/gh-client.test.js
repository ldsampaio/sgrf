import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { ghClient } from './gh-client.js';
import { classifySnapshot } from './classify.js';
import { buildCloseEvidence } from './release-close.js';

const LIVE = JSON.parse(readFileSync(new URL('./fixtures/live-baseline.json', import.meta.url)));

describe('live-baseline.json fixture shape', () => {
  it('matches the assertClientShape contract for ghClient', () => {
    const shape = Object.keys(ghClient).sort();
    assert.deepEqual(shape, ['getBranchHead', 'getMainCIRun', 'getMainRef', 'getReleaseByTag', 'getTagCIRun', 'getTagObject', 'getTagRef', 'listCiRuns', 'listMilestones', 'mutations'].sort());
  });

  it('has a mutations getter that returns 0', () => {
    assert.equal(ghClient.mutations, 0);
  });

  it('encodes the canonical live baseline verbatim', () => {
    assert.equal(LIVE.version, 'v0.1.1');
    assert.equal(LIVE.expectedSha, '10c62ac85fd3ab275b8926c89f5f34ba4116e2cf');
    assert.equal(LIVE.tagObjectSha, '0a68d6f0c55e7be07d13a0bbc4ed36d4af772630');
    assert.equal(LIVE.mainHeadSha, '10c62ac85fd3ab275b8926c89f5f34ba4116e2cf');
  });

  it('records the green CI runs, not the historical red run', () => {
    assert.equal(LIVE.ci.requiredRunIds.length, 2);
    for (const rec of LIVE.ci.records) {
      assert.equal(rec.status, 'completed');
      assert.equal(rec.conclusion, 'success');
    }
  });

  it('names release and milestone as absent, never hides them', () => {
    assert.deepEqual(LIVE.releases, []);
    assert.deepEqual(LIVE.milestones, []);
  });
});

describe('live-baseline.json classifier contract', () => {
  it('classifySnapshot returns ELIGIBLE for the live baseline', () => {
    const evidence = buildCloseEvidence({
      version: LIVE.version,
      expectedSha: LIVE.expectedSha,
      ci: LIVE.ci,
      release: { ok: true, status: 404, data: null },
      milestones: { ok: true, status: 404, data: null },
    });
    const classification = classifySnapshot(evidence);
    assert.equal(classification.code, 'MISSING');
    assert.equal(classification.eligible, false);
  });
});
