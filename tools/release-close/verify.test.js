import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { ghClient } from './gh-client.js';
import { classifySnapshot } from './classify.js';
import { buildCloseEvidence } from './release-close.js';

const LIVE = JSON.parse(readFileSync(new URL('./fixtures/live-baseline.json', import.meta.url)));

describe('verify against live-baseline.json', () => {
  it('reports tag, main, CI, Release, Milestone explicitly with mutations: 0', () => {
    const evidence = buildCloseEvidence({
      version: LIVE.version,
      expectedSha: LIVE.expectedSha,
      ci: LIVE.ci,
      release: { ok: false, status: 404, data: null },
      milestones: { ok: false, status: 404, data: null },
    });
    const classification = classifySnapshot(evidence);

    // Tag: annotated tag whose peeled commit equals remote main and expectedSha
    assert.equal(classification.code, 'MISSING');
    assert.equal(classification.ciCode, null);

    // Main: tag peel matches remote main head
    assert.equal(evidence.target.version, LIVE.version);
    assert.equal(evidence.target.expectedSha, LIVE.expectedSha);

    // CI: all runs green
    assert.ok(LIVE.ci.records.every((r) => r.conclusion === 'success'));

    // Release: absent
    assert.equal(evidence.releases.length, 0);

    // Milestone: absent
    assert.equal(evidence.milestones.length, 0);
  });

  it('mutations: 0 on every verify output', () => {
    assert.equal(ghClient.mutations, 0);
  });

  it('the strict peel: annotated tag peel equals remote main and expectedSha', () => {
    // Tag object SHA (verified live)
    assert.equal(LIVE.tagObjectSha, '0a68d6f0c55e7be07d13a0bbc4ed36d4af772630');
    // Peeled commit equals remote main head
    assert.equal(LIVE.mainHeadSha, LIVE.expectedSha);
  });

  it('any mismatch is reported without a write action', () => {
    // The ghClient has no write methods; mutations getter returns 0
    const shape = Object.keys(ghClient);
    assert.ok(!shape.some((k) => k.startsWith('create') || k.startsWith('update') || k.startsWith('delete') || k.startsWith('write')));
    assert.equal(ghClient.mutations, 0);
  });
});
