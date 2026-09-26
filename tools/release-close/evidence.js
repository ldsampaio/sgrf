// Renderização de evidência estruturada (OPS-03).
//
// `renderEvidenceJson` produz JSON canonico com action results,
// timestamps, full SHAs, run/job/check IDs, Release ID/URL,
// Milestone number/URL e partial-state next action — sem expor
// credenciais ou authorization headers.

export function renderEvidenceJson(evidence) {
  const sanitized = {
    action: evidence.action || null,
    timestamp: evidence.timestamp || null,
    targetSha: evidence.targetSha || null,
    aborted: evidence.aborted || false,
    abortReason: evidence.abortReason || null,
    nextAction: evidence.nextAction || null,
    runs: (evidence.runs || []).map((r) => ({
      id: r.id || null,
      status: r.status || null,
      conclusion: r.conclusion || null,
      headSha: r.headSha || null,
      url: r.url || null,
      jobs: (r.jobs || []).map((j) => ({
        id: j.id || null,
        name: j.name || null,
        status: j.status || null,
        conclusion: j.conclusion || null,
        url: j.url || null,
      })),
      checks: (r.checks || []).map((c) => ({
        id: c.id || null,
        name: c.name || null,
        status: c.status || null,
        conclusion: c.conclusion || null,
        url: c.url || null,
      })),
    })),
    release: evidence.release
      ? {
          id: evidence.release.id || null,
          url: evidence.release.url || null,
          tagName: evidence.release.tagName || null,
        }
      : null,
    milestone: evidence.milestone
      ? {
          number: evidence.milestone.number || null,
          url: evidence.milestone.url || null,
          title: evidence.milestone.title || null,
        }
      : null,
  };

  return JSON.stringify(sanitized, null, 2);
}
