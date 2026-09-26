// Review and confirmation (REL-03).
//
// `renderReviewNotes` produces reviewed factual notes from a
// fresh preflight. `renderPlan` generates the plan for operator
// review. `confirmOperatorReview` requires explicit "sim"
// confirmation before any mutation.

import { freshPreflight } from './verify.js';
import { renderEvidenceJson } from './evidence.js';

export async function renderReviewNotes(options) {
  const { repo, targetSha, version } = options;

  const preflight = await freshPreflight({ repo, targetSha, version });
  if (preflight.aborted) {
    return { reviewed: false, aborted: true, reason: preflight.abortReason, nextAction: preflight.nextAction };
  }

  const notes = {
    timestamp: new Date().toISOString(),
    targetSha,
    version,
    tag: preflight.results.tag,
    main: preflight.results.main,
    ci: preflight.results.ci,
    release: preflight.results.release,
    milestone: preflight.results.milestone,
    facts: [],
  };

  if (!preflight.results.release) {
    notes.facts.push(`Release ${version} does not exist — will be created.`);
  } else {
    notes.facts.push(`Release ${version} exists (ID: ${preflight.results.release.id}) — will be updated.`);
  }

  if (!preflight.results.milestone) {
    notes.facts.push(`Milestone "${version}" does not exist — will be created.`);
  } else if (preflight.results.milestone.state === 'open') {
    notes.facts.push(`Milestone "${version}" is open — will be closed.`);
  } else {
    notes.facts.push(`Milestone "${version}" is already closed.`);
  }

  notes.facts.push(`Tag ${version} peels to ${preflight.results.tag.sha} — immutable.`);
  notes.facts.push(`Main SHA is ${preflight.results.main.sha} — matches target.`);
  notes.facts.push(`CI runs ${preflight.results.ci.runIds.join(', ')} are successful.`);

  return { reviewed: true, aborted: false, notes, preflight };
}

export function renderPlan(reviewNotes) {
  const steps = [
    { step: 1, action: 'publish Release', detail: `Create Release ${reviewNotes.version} tied to tag ${reviewNotes.version}` },
    { step: 2, action: 'readback Release', detail: 'Verify Release exists with stable ID/URL' },
    { step: 3, action: 'open Milestone', detail: `Create Milestone "${reviewNotes.version}" with reviewed completion record` },
    { step: 4, action: 'close Milestone', detail: `Close Milestone "${reviewNotes.version}"` },
    { step: 5, action: 'final readback', detail: 'Confirm tag, main, CI, Release, Milestone all correct' },
  ];

  return {
    version: reviewNotes.version,
    targetSha: reviewNotes.targetSha,
    timestamp: reviewNotes.timestamp,
    steps,
    mutations: 3,
  };
}

export async function confirmOperatorReview(reviewNotes, plan, confirmationWord) {
  if (confirmationWord !== 'sim') {
    return { confirmed: false, reason: 'Operator did not confirm with "sim"' };
  }

  return {
    confirmed: true,
    timestamp: new Date().toISOString(),
    digest: reviewNotes.timestamp + '|' + plan.steps.map(s => s.action).join(','),
  };
}
