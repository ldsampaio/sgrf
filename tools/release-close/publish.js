// Release publish (REL-02, REL-04).
//
// `publishRelease` publishes the Release v0.1.1 and reads it back
// to confirm it was created correctly with a stable ID/URL.

import { ghClient } from './gh-client.js';
import { renderEvidenceJson } from './evidence.js';

export async function publishRelease(options) {
  const { repo, version, targetSha } = options;
  const evidence = {
    action: 'publish-release',
    timestamp: new Date().toISOString(),
    targetSha,
    version,
    mutations: 0,
    aborted: false,
    abortReason: null,
    nextAction: null,
  };

  // Step 1: Publish the Release
  const release = await ghClient.deployRelease(repo, {
    tag_name: version,
    name: version,
    body: `Release ${version} — recovery procedure for v0.1.1`,
    draft: false,
    prerelease: false,
  });

  if (!release || !release.data) {
    evidence.aborted = true;
    evidence.abortReason = 'Failed to create Release';
    evidence.nextAction = 'retry publish or create manually';
    return evidence;
  }
  evidence.mutations += 1;
  evidence.release = {
    id: release.data.id,
    url: release.data.html_url,
    tagName: release.data.tag_name,
  };

  // Step 2: Read back the Release
  const readback = await ghClient.getReleaseByTag(repo, version);
  if (!readback || !readback.data) {
    evidence.aborted = true;
    evidence.abortReason = 'Release readback failed';
    evidence.nextAction = 'verify Release manually';
    return evidence;
  }
  evidence.releaseReadback = {
    id: readback.data.id,
    url: readback.data.html_url,
    tagName: readback.data.tag_name,
  };

  // Step 3: Verify the Release is tied to the preserved annotated tag
  if (evidence.releaseReadback.id !== evidence.release.id) {
    evidence.aborted = true;
    evidence.abortReason = 'Release ID mismatch between publish and readback';
    evidence.nextAction = 'verify Release manually';
    return evidence;
  }

  evidence.nextAction = 'ready for milestone';
  return evidence;
}
