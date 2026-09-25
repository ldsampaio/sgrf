# Roadmap: SGRF

## Overview

Milestone v0.1.2 recovers the missing GitHub publication for v0.1.1 and establishes a fail-closed release-close path for future milestones. Work proceeds in five dependency-ordered phases: deterministic contracts and fixtures, authoritative read-only preflight, guarded idempotent reconciliation, CI/race rehearsal and operator documentation, then the final operator-confirmed live recovery. All 18 v1 requirements map to exactly one phase. No live GitHub mutation is authorized until Phase 13. The existing annotated `v0.1.1` tag remains immutable, and the milestone changes no application, database, Docker, frontend, or CI test/build command.

## Milestones

- ✅ **v0.1.1** — Phases 1–8 completed
- 🚧 **v0.1.2 GitHub Release Reliability** — Phases 9–13 in progress

## Phases

**Phase Numbering:**

- Integer phases (9, 10, 11): Planned milestone work
- Decimal phases (9.1, 9.2): Urgent insertions (marked with INSERTED)

Phase numbering continues from the completed v0.1.1 milestone. Decimal phases appear between their surrounding integers in numeric order.

- [ ] **Phase 9: Release-Close Contract & Fixtures** - Define the Node 22 operator contract and prove pure ref, CI, and reconciliation decisions with deterministic tests
- [ ] **Phase 10: Read-Only Exact-SHA Preflight** - Prove repository, tag, main, target-SHA CI, Release, and Milestone state without mutations
- [ ] **Phase 11: Guarded Idempotent Reconciliation** - Rehearse ordered apply, adoption, retry, conflict, and concurrency behavior without touching the live repository
- [ ] **Phase 12: CI Race Rehearsal & Operator Runbook** - Prove bounded CI settlement and immediate safety fences, and document the complete recovery procedure
- [ ] **Phase 13: v0.1.1 Live Release & Milestone Recovery** - After explicit operator approval, publish and verify the missing v0.1.1 GitHub Release and Milestone

## Phase Details

### Phase 9: Release-Close Contract & Fixtures
**Goal**: Operators and the implementer share one deterministic, fail-closed release-close contract before any remote client or mutation can exist.
**Depends on**: Nothing (first phase in v0.1.2)
**Requirements**: OPS-01, OPS-02, SAFE-02, SAFE-04
**Success Criteria** (what must be TRUE):
  1. A checked-in Node 22 ESM tool supports `verify`, `plan`, and `apply` through the existing `gh` authentication surface, with no added npm package, workspace, or hosted publisher.
  2. Fixture-backed command runs prove that `verify` and `plan` perform no mutations, while `apply` refuses to proceed without reviewed Release/Milestone content, a displayed plan, and explicit operator confirmation.
  3. Deterministic `node:test` fixtures and mocked API scenarios classify missing, partial, duplicate, conflicting, failed, and concurrent states, and the tool exposes no ref-write or destructive tag path.
  4. The pure eligibility contract accepts an existing annotated tag only when its peeled commit equals both the full expected SHA and the observed remote `main`; any mismatch is reported without a write action.
**Plans**: TBD

### Phase 10: Read-Only Exact-SHA Preflight
**Goal**: An operator can establish the authoritative GitHub state for a pinned repository, version, and full target SHA without changing any remote object.
**Depends on**: Phase 9
**Requirements**: REL-01, SAFE-01, SAFE-03
**Success Criteria** (what must be TRUE):
  1. Running `verify` for a specified repository, version, and full SHA reports an explicit result for tag, `main`, CI, Release, and Milestone, includes `mutations: 0`, and distinguishes absent objects from permission failures.
  2. Invalid versions, repositories, tags, abbreviated or mismatched SHAs, credentials, and insufficient endpoint permissions are rejected before any mutation-capable path can run.
  3. The tool selects successful canonical `backend` and `frontend` checks for both the protected-`main` push run and the version-tag push run at the exact same full target SHA; pending, skipped, failed, contradictory, wrong-run, or wrong-SHA evidence cannot qualify.
  4. The live v0.1.1 baseline reports tag object `0a68d6f0c55e7be07d13a0bbc4ed36d4af772630`, peeled/main/expected commit `10c62ac85fd3ab275b8926c89f5f34ba4116e2cf`, green runs `36095855139` and `36095872529`, and missing Release/Milestone, while the historical red backend run on another SHA is ignored.
**Plans**: TBD

### Phase 11: Guarded Idempotent Reconciliation
**Goal**: The apply path can recover from partial, ambiguous, conflicting, and concurrent states in a deterministic order before it is allowed near the live repository.
**Depends on**: Phase 10
**Requirements**: REC-01, REC-02, REC-03, REC-04, REC-05
**Success Criteria** (what must be TRUE):
  1. Rehearsal adopts a matching published Release, matching owned draft Release, or open/closed Milestone; it creates only a genuinely missing object and always identifies objects by their natural GitHub keys and stable IDs.
  2. A fresh recovery sequence is observably ordered as Release draft → readback → publish → readback → Milestone open → readback → close → final readback, with a fresh snapshot reconstructed after every transition.
  3. After a timeout, lost response, `409`, `422`, `429`, or server failure, the tool re-reads GitHub before adopting, retrying, or reporting a partial state and never blindly repeats a write.
  4. Duplicate or materially conflicting Release/Milestone objects stop the rehearsal with an actionable conflict and are never overwritten or deleted.
  5. Concurrent invocations for one repository/version on the same workstation are blocked by a local lock, while historical `resume` rejects a target without recorded prior partial-state evidence; all rehearsal writes remain on fake clients or disposable fixtures rather than `ldsampaio/sgrf`.
**Plans**: TBD

### Phase 12: CI Race Rehearsal & Operator Runbook
**Goal**: The operator can trust the final mutation fence and follow one complete, auditable procedure for safe close, rerun, and recovery.
**Depends on**: Phase 11
**Requirements**: SAFE-05, OPS-03, OPS-04
**Success Criteria** (what must be TRUE):
  1. The tool waits only within a bounded window for the canonical target-SHA main and tag CI runs, and pending, contradictory, wrong-SHA, failed, or newly divergent evidence aborts without a remote write.
  2. Ref and CI evidence are revalidated immediately before each mutation; a delayed tag run resets the fence, while a simulated `main` advance or late failure prevents the next write.
  3. Structured output and optional evidence contain action results, timestamps, full SHAs, run/job/check IDs, Release ID/URL, Milestone number/URL, and a partial-state next action without exposing credentials or authorization headers.
  4. A checked-in operator runbook covers authentication, permissions, read-only preflight, reviewed plan, explicit apply confirmation, safe rerun, partial-state recovery, conflict resolution, rollback boundaries, and the live v0.1.1 procedure.
**Plans**: TBD

### Phase 13: v0.1.1 Live Release & Milestone Recovery
**Goal**: The missing v0.1.1 GitHub Release and exact-title GitHub Milestone exist as one verified, coherent publication after an explicit operator decision.
**Depends on**: Phase 12
**Requirements**: REL-02, REL-03, REL-04
**Success Criteria** (what must be TRUE):
  1. After a fresh zero-mutation verification, reviewed factual notes, displayed plan, and explicit operator confirmation, GitHub shows one published Release `v0.1.1` tied to the preserved annotated tag, with a stable Release ID/URL and no tag creation, movement, replacement, or deletion.
  2. Only after the Release is published and read back, GitHub shows one Milestone titled exactly `v0.1.1` with the reviewed completion record; it is read back by stable number, closed, read back again, and has no open issues.
  3. The recovery is declared complete only after fresh remote reads confirm the unchanged tag object and peeled commit, target `main` SHA, successful target-SHA `backend` and `frontend` checks for both required push runs, the published Release, and the closed Milestone with stable IDs and URLs.
**Plans**: TBD

## Milestone Constraints

- The annotated remote tag `v0.1.1` is immutable and must continue to peel to `10c62ac85fd3ab275b8926c89f5f34ba4116e2cf`.
- Remote `main`, tag, and supplied full target SHA must agree for a current close; the historical red run on another SHA is not a recovery blocker.
- No remote write is performed during roadmap creation or Phases 9–12; Phase 13 requires fresh preflight, reviewed content, and explicit human confirmation.
- The existing `.github/workflows/ci.yml` remains the regression authority; its `backend` and `frontend` commands and all application/database/Docker/frontend behavior remain unchanged.
- v2 release-policy items in `REQUIREMENTS.md` remain deferred and are not phases in this roadmap.

## Progress

**Execution Order:**
Phases execute in numeric order: 9 → 10 → 11 → 12 → 13

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 9. Release-Close Contract & Fixtures | v0.1.2 | 0/TBD | Not started | - |
| 10. Read-Only Exact-SHA Preflight | v0.1.2 | 0/TBD | Not started | - |
| 11. Guarded Idempotent Reconciliation | v0.1.2 | 0/TBD | Not started | - |
| 12. CI Race Rehearsal & Operator Runbook | v0.1.2 | 0/TBD | Not started | - |
| 13. v0.1.1 Live Release & Milestone Recovery | v0.1.2 | 0/TBD | Not started | - |
