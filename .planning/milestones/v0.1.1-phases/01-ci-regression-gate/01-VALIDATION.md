---
phase: "1"
slug: "ci-regression-gate"
# status lifecycle: draft (seeded by plan-phase) → validated (set by validate-phase §6)
# audit-milestone §5.5 distinguishes NOT-VALIDATED (draft) from PARTIAL (validated + nyquist_compliant: false) (#2117)
status: draft
nyquist_compliant: false
wave_0_complete: false
created: "2026-09-23"
---

# Phase 1 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest 2.1.9 (backend only; frontend has no tests by design — AGENTS.md) |
| **Config file** | none — no `vitest.config.*` exists; vitest runs on defaults |
| **Quick run command** | `cd backend && npx vitest run` (~137 ms local: 3 files, 17 tests) |
| **Full suite command** | `cd backend && npx vitest run` (the quick run *is* the full suite) + build check `cd frontend && npm run build` |
| **Estimated runtime** | ~5 seconds (both commands combined) |

---

## Sampling Rate

- **After every task commit:** Run `cd backend && npx vitest run` + `cd frontend && npm run build` locally (both < 5 s total) — and after 01-01 lands, the push itself runs both in CI.
- **After every plan wave:** The CI run on the merge/push commit (both jobs green).
- **Before `/gsd-verify-work`:** Full suite must be green — CI green on `main` **plus** the red-proof evidence (run URL showing `backend: failure`) **plus** the protection API verification output.
- **Max feedback latency:** 5 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 01-01 | 01 | 1 | CI-01 | T-01-01 / — | workflow accepts no user input; no `${{ }}` interpolation of untrusted context; `permissions: contents: read`; first-party `actions/*` pinned `@v7` | CI | push workflow file → `gh run list --limit 1` shows 2 green jobs | ✅ | ⬜ pending |
| 01-02 | 02 | 2 | CI-01 | T-01-02 / — | checks run the two real commands only — no invented lint/typecheck, no always-green bypass | CI (negative proof) | break assertion → push → `gh run list` shows `backend: failure` → revert → green | ✅ uses existing `backend/tests/{batch,unit,voting}.test.js` | ⬜ pending |
| 01-03 | 03 | 3 | CI-01 | T-01-03 / — | gate enforced via branch protection; no secrets in CI (dummy `DATABASE_URL` only) | manual/API | `gh api .../protection --jq '.required_status_checks.contexts'` → `["backend","frontend"]` | ✅ | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] None for the backend — existing infrastructure covers all phase requirements (the phase's "tests" are the workflow runs themselves; the 17 existing tests are the payload).
- [ ] Frontend: intentionally no tests (AGENTS.md) — `npm run build` is the designated check; do not add a test framework in this phase.
- [ ] CI-01's verification is observational (gh run states), not a new test file — no framework install needed.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Two-job workflow triggers on push/PR with Node 22, per-package dirs, per-lockfile cache | CI-01 | CI observation — no local runner reproduces GitHub Actions triggers | push workflow file → `gh run list --limit 1` shows 2 green jobs |
| Check is *required* on the branch | CI-01 | Branch protection is a GitHub API/UI state, not local code | `gh api .../protection --jq '.required_status_checks.contexts'` → `["backend","frontend"]` |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 5s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
