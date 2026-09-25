# Requirements: SGRF — GitHub Release Reliability

**Defined:** 2026-09-25
**Core Value:** Requests are decided correctly and funds cannot leak — the right people approve the right amounts, every state change is authorized and auditable, and the ledger always balances.

## v1 Requirements

Requirements for milestone v0.1.2. Each requirement maps to exactly one roadmap phase.

### Release Recovery

- [ ] **REL-01**: Operator can run a read-only `verify` for a specified repository, version, and full target SHA, receiving an explicit result for tag, main, CI, Release, and Milestone with `mutations: 0`
- [ ] **REL-02**: Operator can publish a factual GitHub Release `v0.1.1` from the existing annotated tag after reviewing its notes, without creating, moving, deleting, or replacing the tag
- [ ] **REL-03**: Operator can create and close the exact-title GitHub Milestone `v0.1.1` only after the Release is published, including the milestone completion record and no open issues
- [ ] **REL-04**: Operator can declare v0.1.1 recovered only after fresh remote readback confirms the preserved tag, target commit, target-SHA CI, published Release, and closed Milestone with stable IDs and URLs

### Release Safety

- [ ] **SAFE-01**: Tool rejects an invalid version, repository, tag, full SHA, credential, or insufficient endpoint permission before any remote mutation
- [x] **SAFE-02**: Tool requires an existing annotated tag whose peeled commit equals both remote `main` and the supplied full target SHA, and contains no ref-write path for tags
- [ ] **SAFE-03**: Tool requires the canonical `backend` and `frontend` checks from the existing CI workflow to have succeeded on the exact target SHA for both the protected-`main` push run and version-tag push run
- [ ] **SAFE-04**: `verify` and `plan` perform no mutations, while `apply` requires reviewed Release/Milestone content, a displayed plan, and explicit operator confirmation
- [ ] **SAFE-05**: Tool waits within a bounded window for late CI and revalidates refs and CI immediately before mutations; pending, contradictory, wrong-SHA, failed, or newly divergent evidence aborts the operation

### Idempotency & Recovery

- [ ] **REC-01**: Tool reconciles a matching published Release, matching draft Release, or open/closed Milestone instead of blindly creating another object
- [ ] **REC-02**: Tool performs recovery in recoverable order — Release draft → readback → publish → readback → Milestone open → readback → close → final readback
- [ ] **REC-03**: After timeout, lost response, `409`, `422`, `429`, or server failure, tool re-reads the natural GitHub identity before deciding whether to adopt, retry, or report a partial state
- [ ] **REC-04**: Duplicate or materially conflicting remote objects block publication with an actionable conflict and are never overwritten or deleted
- [ ] **REC-05**: A local repository/version lock prevents concurrent invocations on one workstation, while a pinned historical `resume` mode requires recorded prior partial-state evidence and cannot become an arbitrary old-commit publish bypass

### Tool & Evidence

- [x] **OPS-01**: Operator can run the checked-in Node 22 ESM release-close tool with `verify`, `plan`, and `apply` modes, using existing `gh` authentication and adding no npm package or hosted service
- [ ] **OPS-02**: Tool’s pure reconciliation logic is covered by deterministic `node:test` fixtures and mocked API scenarios for missing, partial, duplicate, conflicting, failed, and concurrent states
- [ ] **OPS-03**: Tool emits structured, secret-free evidence containing action results, timestamps, SHAs, run/job/check IDs, Release ID/URL, Milestone number/URL, and any partial-state next action
- [ ] **OPS-04**: Operator runbook documents authentication, permissions, preflight, reviewed plan, apply confirmation, safe rerun, partial-state recovery, conflict resolution, rollback boundaries, and the live v0.1.1 procedure

## v2 Requirements

Deferred to future work. Tracked but not in this roadmap.

### Future Release Hardening

- Thin `workflow_dispatch` wrapper that calls the same local reconciler contract without duplicating publication logic
- GitHub Immutable Releases, tag rulesets, attestations, release assets, and generated release notes
- Distributed locking or an external coordination service when more than one operator host becomes real
- Automatic publication triggers, automatic tag creation, and automatic SemVer inference
- General historical publication for versions lacking recorded prior partial-state evidence

## Out of Scope

Explicitly excluded. Documented to prevent scope creep.

| Feature | Reason |
|---------|--------|
| Recreate, move, delete, or force-update the valid `v0.1.1` tag | The annotated tag already peels to the verified release merge commit; mutation adds risk without repairing publication |
| Overwrite or delete conflicting Release/Milestone objects | Published and closed objects are historical; fail-closed conflict review protects remote truth |
| Hosted or automatic publisher | v0.1.2 requires one explicit operator surface; a future wrapper may call the same reconciler but must not become a second implementation |
| Immutable Releases, attestations, assets, or generated notes | Not required to recover v0.1.1 or prevent the observed partial-publication failure |
| Arbitrary old-commit or historical publication | Historical resume is constrained to recorded prior partial-state evidence and is not a general publish bypass |
| Application behavior, API, database, Vue, Docker, or CI command changes | This milestone repairs and safeguards release operations without changing the production application or its regression commands |
| Deployment automation | Publishing a GitHub Release is not deployment; no automatic application deployment is introduced |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| REL-01 | Phase 10 | Pending |
| REL-02 | Phase 13 | Pending |
| REL-03 | Phase 13 | Pending |
| REL-04 | Phase 13 | Pending |
| SAFE-01 | Phase 10 | Pending |
| SAFE-02 | Phase 9 | Complete |
| SAFE-03 | Phase 10 | Pending |
| SAFE-04 | Phase 9 | Pending |
| SAFE-05 | Phase 12 | Pending |
| REC-01 | Phase 11 | Pending |
| REC-02 | Phase 11 | Pending |
| REC-03 | Phase 11 | Pending |
| REC-04 | Phase 11 | Pending |
| REC-05 | Phase 11 | Pending |
| OPS-01 | Phase 9 | Complete |
| OPS-02 | Phase 9 | Pending |
| OPS-03 | Phase 12 | Pending |
| OPS-04 | Phase 12 | Pending |

**Coverage:**

- v1 requirements: 18 total
- Mapped to phases: 18
- Unmapped: 0 ✓
- Duplicate mappings: 0 ✓

---

*Requirements defined: 2026-09-25*
*Last updated: 2026-09-25 after v0.1.2 roadmap creation*
