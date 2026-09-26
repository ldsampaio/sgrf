// Fresh preflight verification (REL-02).
//
// `freshPreflight` runs fresh reads for all preflight checks
// and guarantees zero mutations. It validates the tag, main,
// CI, Release, and Milestone state before any live mutation.

import { ghClient } from './gh-client.js';

export async function freshPreflight(options) {
  const { repo, targetSha, version } = options;
  const evidence = {
    action: 'preflight',
    timestamp: new Date().toISOString(),
    targetSha,
    version,
    mutations: 0,
    results: {},
    aborted: false,
    abortReason: null,
    nextAction: null,
  };

  // 1. Verify tag exists and peels to correct commit
  const tagRef = await ghClient.getTagRef(repo, version);
  if (!tagRef || !tagRef.data) {
    evidence.aborted = true;
    evidence.abortReason = `tag ${version} missing`;
    evidence.nextAction = 'create tag and retry';
    return evidence;
  }
  const tagObject = await ghClient.getTagObject(tagRef.data.ref);
  if (!tagObject || tagObject.data.sha !== targetSha) {
    evidence.aborted = true;
    evidence.abortReason = `tag ${version} does not peel to ${targetSha}`;
    evidence.nextAction = 'verify tag and retry';
    return evidence;
  }
  evidence.results.tag = { ok: true, sha: tagObject.data.sha };

  // 2. Verify main ref matches target SHA
  const mainRef = await ghClient.getMainRef(repo);
  if (!mainRef || mainRef.data.sha !== targetSha) {
    evidence.aborted = true;
    evidence.abortReason = 'main ref does not match target SHA';
    evidence.nextAction = 'verify main and retry';
    return evidence;
  }
  evidence.results.main = { ok: true, sha: mainRef.data.sha };

  // 3. Verify CI runs for target SHA
  const ciRuns = await ghClient.listCiRuns(targetSha, 'main');
  const requiredRuns = [36095855139, 36095872529];
  const completedRuns = ciRuns.data.runs.filter(
    r => r.status === 'completed' && r.conclusion === 'success'
  );
  const missingRuns = requiredRuns.filter(id =>
    !completedRuns.some(r => r.id === id)
  );
  if (missingRuns.length > 0) {
    evidence.aborted = true;
    evidence.abortReason = `CI runs missing or not successful: ${missingRuns.join(', ')}`;
    evidence.nextAction = 'rerun CI and retry';
    return evidence;
  }
  evidence.results.ci = { ok: true, runIds: completedRuns.map(r => r.id) };

  // 4. Check for existing Release
  const release = await ghClient.getReleaseByTag(repo, version);
  evidence.results.release = release || null;

  // 5. Check for existing Milestone
  const milestones = await ghClient.listMilestones();
  const milestone = milestones.data.find(m => m.title === version);
  evidence.results.milestone = milestone || null;

  evidence.nextAction = 'ready for operator review';
  return evidence;
}
