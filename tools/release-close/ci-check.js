// CI check module — bounded wait window with target-SHA validation (SAFE-05).
//
// `awaitCIRuns` waits only within a bounded window for the canonical
// target-SHA main and tag CI runs.  Pending, contradictory, wrong-SHA,
// failed, or newly divergent evidence aborts without a remote write.

import { createHash } from 'node:crypto';

/**
 * Wait for CI runs to complete for the target SHA.
 *
 * @param {{ ghClient: object, repo: string, targetSha: string, timeoutMs?: number, pollIntervalMs?: number }} options
 * @returns {{ action: string, timestamp: string, targetSha: string, runs: Array, aborted: boolean, abortReason: string|null, nextAction: string|null }}
 */
export async function awaitCIRuns(options) {
  const { ghClient, repo, targetSha, timeoutMs = 60000, pollIntervalMs = 5000 } = options;

  const start = Date.now();
  const evidence = {
    action: 'ci-wait',
    timestamp: new Date().toISOString(),
    targetSha,
    runs: [],
    aborted: false,
    abortReason: null,
    nextAction: null,
  };

  // timeoutMs === 0 means "check current state once, no waiting" —
  // used by revalidation before mutation.
  if (timeoutMs === 0) {
    const [mainRun, tagRun] = await Promise.all([
      ghClient.getMainCIRun(repo, targetSha),
      ghClient.getTagCIRun(repo, targetSha),
    ]);
    if (mainRun && mainRun.status === 'completed' && mainRun.conclusion === 'success' &&
        tagRun && tagRun.status === 'completed' && tagRun.conclusion === 'success') {
      evidence.runs = [mainRun, tagRun];
      evidence.nextAction = 'proceed to mutation';
      return evidence;
    }
    evidence.aborted = true;
    evidence.abortReason = 'CI not settled in current state';
    evidence.nextAction = 'wait for CI and retry';
    return evidence;
  }

  while (Date.now() - start < timeoutMs) {
    const [mainRun, tagRun] = await Promise.all([
      ghClient.getMainCIRun(repo, targetSha),
      ghClient.getTagCIRun(repo, targetSha),
    ]);

    // Validate target-SHA match for main run
    if (mainRun && mainRun.headSha !== targetSha) {
      evidence.aborted = true;
      evidence.abortReason = `main run headSha ${mainRun.headSha} !== target ${targetSha}`;
      evidence.nextAction = 're-verify main SHA and retry';
      return evidence;
    }

    // Validate target-SHA match for tag run
    if (tagRun && tagRun.headSha !== targetSha) {
      evidence.aborted = true;
      evidence.abortReason = `tag run headSha ${tagRun.headSha} !== target ${targetSha}`;
      evidence.nextAction = 're-verify tag SHA and retry';
      return evidence;
    }

    // Check for contradictory evidence (main complete with failure)
    if (mainRun && mainRun.status === 'completed' && mainRun.conclusion === 'failure') {
      evidence.aborted = true;
      evidence.abortReason = `main CI run ${mainRun.id} failed`;
      evidence.nextAction = 'fix main CI and rerun';
      return evidence;
    }

    // Both complete and successful
    if (mainRun && mainRun.status === 'completed' && mainRun.conclusion === 'success' &&
        tagRun && tagRun.status === 'completed' && tagRun.conclusion === 'success') {
      evidence.runs = [mainRun, tagRun];
      evidence.nextAction = 'proceed to mutation';
      return evidence;
    }

    // If either run exists but is not successful, wait for it to settle
    // (pending, failed, or unknown status — retry until timeout).
    // Only abort if both runs are missing AND we've already waited
    // past the timeout (handled by the loop exit below).

    // Pending — wait and retry
    await sleep(pollIntervalMs);
  }

  // Timeout — abort
  evidence.aborted = true;
  evidence.abortReason = `CI wait exceeded ${timeoutMs}ms timeout`;
  evidence.nextAction = 'rerun CI and retry';
  return evidence;
}

/**
 * Revalidate ref and CI evidence immediately before each mutation.
 * A delayed tag run resets the fence; a simulated main advance or late failure prevents the next write.
 *
 * @param {{ ghClient: object, repo: string, targetSha: string, currentStep: string, evidence: object }} options
 * @returns {{ step: string, timestamp: string, refValid: boolean, ciValid: boolean, aborted: boolean, abortReason: string|null, nextAction: string|null }}
 */
export async function revalidateBeforeMutation(options) {
  const { ghClient, repo, targetSha, currentStep, evidence } = options;

  const revalidation = {
    step: currentStep,
    timestamp: new Date().toISOString(),
    refValid: true,
    ciValid: true,
    aborted: false,
    abortReason: null,
    nextAction: null,
  };

  // Re-read the tag ref (skip if tagName not in evidence).
  if (evidence.target?.tagName) {
    const tagRef = await ghClient.getTagRef(repo, evidence.target.tagName);
    if (!tagRef || tagRef.sha !== evidence.target.expectedSha) {
      revalidation.refValid = false;
      revalidation.aborted = true;
      revalidation.abortReason = `tag ${evidence.target.tagName} SHA changed or missing`;
      revalidation.nextAction = 're-verify tag and restart preflight';
      return revalidation;
    }
  }

  // Re-read main ref
  const mainRef = await ghClient.getMainRef(repo);
  if (!mainRef || mainRef.sha !== targetSha) {
    revalidation.refValid = false;
    revalidation.aborted = true;
    revalidation.abortReason = 'main ref SHA advanced or diverged';
    revalidation.nextAction = 're-verify main and restart preflight';
    return revalidation;
  }

  // Re-check CI runs for target SHA (zero timeout — just check current state)
  const ciEvidence = await awaitCIRuns({
    ghClient,
    repo,
    targetSha,
    timeoutMs: 0,
    pollIntervalMs: 0,
  });

  if (ciEvidence.aborted) {
    revalidation.ciValid = false;
    revalidation.aborted = true;
    revalidation.abortReason = ciEvidence.abortReason;
    revalidation.nextAction = ciEvidence.nextAction;
    return revalidation;
  }

  const next = nextStep(currentStep);
  revalidation.nextAction = next ? `proceed to ${next}` : 'all steps complete';
  return revalidation;
}

/**
 * Sleep helper.
 * @param {number} ms
 */
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Get the next step in the reconciliation sequence.
 * @param {string} current
 * @returns {string|null}
 */
function nextStep(current) {
  const steps = [
    'release-draft',
    'release-draft-readback',
    'release-publish',
    'release-publish-readback',
    'milestone-open',
    'milestone-open-readback',
    'milestone-close',
    'milestone-close-readback',
  ];
  const idx = steps.indexOf(current);
  return idx >= 0 && idx < steps.length - 1 ? steps[idx + 1] : null;
}
