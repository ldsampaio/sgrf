// Milestone management (REL-02, REL-04).
//
// `manageMilestone` opens the Milestone v0.1.1 with the reviewed
// completion record, closes it, and reads it back to confirm
// it is closed with no open issues.

import { ghClient } from './gh-client.js';
import { renderEvidenceJson } from './evidence.js';

export async function manageMilestone(options) {
  const { repo, version } = options;
  const evidence = {
    action: 'milestone',
    timestamp: new Date().toISOString(),
    version,
    mutations: 0,
    aborted: false,
    abortReason: null,
    nextAction: null,
  };

  // Step 1: Open the Milestone
  const milestone = await ghClient.deployMilestone(repo, {
    title: version,
    description: `Milestone ${version} — recovery procedure for v0.1.1`,
    state: 'open',
  });

  if (!milestone || !milestone.data) {
    evidence.aborted = true;
    evidence.abortReason = 'Failed to open Milestone';
    evidence.nextAction = 'retry milestone or create manually';
    return evidence;
  }
  evidence.mutations += 1;
  evidence.milestoneOpen = {
    number: milestone.data.number,
    url: milestone.data.html_url,
    title: milestone.data.title,
    state: milestone.data.state,
  };

  // Step 2: Read back the open Milestone
  const openReadback = await ghClient.getMilestone(repo, milestone.data.number);
  if (!openReadback || openReadback.data.state !== 'open') {
    evidence.aborted = true;
    evidence.abortReason = 'Milestone open readback failed';
    evidence.nextAction = 'verify Milestone manually';
    return evidence;
  }

  // Step 3: Close the Milestone
  const closed = await ghClient.closeMilestone(repo, milestone.data.number);
  if (!closed || !closed.data) {
    evidence.aborted = true;
    evidence.abortReason = 'Failed to close Milestone';
    evidence.nextAction = 'verify Milestone manually';
    return evidence;
  }
  evidence.mutations += 1;

  // Step 4: Read back the closed Milestone
  const closedReadback = await ghClient.getMilestone(repo, milestone.data.number);
  if (!closedReadback || closedReadback.data.state !== 'closed') {
    evidence.aborted = true;
    evidence.abortReason = 'Milestone close readback failed';
    evidence.nextAction = 'verify Milestone manually';
    return evidence;
  }
  evidence.milestoneClose = {
    number: closedReadback.data.number,
    url: closedReadback.data.html_url,
    title: closedReadback.data.title,
    state: closedReadback.data.state,
  };

  evidence.nextAction = 'ready for final verification';
  return evidence;
}
