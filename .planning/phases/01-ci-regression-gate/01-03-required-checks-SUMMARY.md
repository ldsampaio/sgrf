---
phase: 01-ci-regression-gate
plan: "03"
subsystem: infra
tags: [github-actions, branch-protection, required-checks, regression-gate, docs]

# Dependency graph
requires:
  - phase: 01-02-red-proof
    provides: "Red-proof evidence (backend failure run 35913880897 + green revert run 35914010303) satisfying the prove-then-enforce precondition"
provides:
  - "Branch protection active on main: required contexts [backend, frontend], strict false, enforce_admins true, reviews/restrictions null — verified by API readback"
  - "AGENTS.md regression-gate note (Portuguese voice, exact commands, strict revisit, enforce_admins, GH006 recovery) live on main via PR #1"
affects: [all-later-fixes, phase-2-docs]

# Actuals (#2632) — pairs with the plan's `estimate` to calibrate future estimates.
actuals:
  tokens: 440
  tasks: 2
  commits: 2

# Tech tracking
tech-stack:
  added: []
  patterns: [prove-then-enforce, pr-landing-under-protection]

key-files:
  created: []
  modified: [AGENTS.md]

key-decisions:
  - "Protection PUT via JSON --input (gh -f sends strings; enforce_admins=true as a form field 422s)"
  - "Docs commit landed via PR #1 merge, not direct push — direct push to protected main is declined before CI can run on the SHA"
  - "No temporary rule disable used (D-11 third option untouched); the gate stayed enforced throughout"

patterns-established:
  - "Under required checks, land via PR: push branch, green CI, merge — direct pushes to main are declined by design"

requirements-completed: [CI-01]

# Coverage metadata (#1602)
coverage:
  - id: D1
    description: "Branch protection on main requires backend + frontend checks (strict false, enforce_admins true, no reviews/restrictions)"
    requirement: "CI-01"
    verification:
      - kind: other
        ref: "gh api repos/ldsampaio/sgrf/branches/main/protection readback (contexts, strict, enforce_admins, reviews, restrictions)"
        status: pass
      - kind: other
        ref: "direct push to main declined with '2 of 2 required status checks are expected' (gate blocks unverified push)"
        status: pass
    human_judgment: false
  - id: D2
    description: "AGENTS.md records CI as the regression gate with exact commands, strict revisit note, enforce_admins, and GH006 recovery"
    requirement: "CI-01"
    verification:
      - kind: other
        ref: "grep acceptance criteria (exact command strings, enforce_admins>=1, GH006>=1, strict+revisit, old claim gone, diff AGENTS.md only)"
        status: pass
      - kind: unit
        ref: "cd backend && npx vitest run — Tests 17 passed (17)"
        status: pass
      - kind: other
        ref: "PR #1 merged with green CI; post-merge main run 35914504197 success"
        status: pass
    human_judgment: false

# Metrics
duration: 4min
completed: 2026-09-23
status: complete
---

# Phase 1 Plan 03: Required-Checks Summary

**Branch protection enforced on main (backend + frontend required, strict false, admins enforced) and CI recorded as the regression gate in AGENTS.md — landed via PR #1 after the gate itself declined the direct push**

## Performance

- **Duration:** 4 min
- **Started:** 2026-09-23T20:11:15Z
- **Completed:** 2026-09-23T20:14:44Z
- **Tasks:** 2
- **Files modified:** 1

## Accomplishments
- Branch protection PUT on `main` with the exact locked payload; verified by fresh API readback (not the PUT response)
- Direct-push rejection observed live (`protected branch hook declined — 2 of 2 required status checks are expected`): the gate blocks unverified pushes including admin pushes
- AGENTS.md updated: stale no-CI claim replaced, regression-gate note added (exact commands, `strict:false` + revisit, `enforce_admins:true`, GH006 recovery)
- Docs change landed on `main` via PR #1 (merge commit `fadff3a`) with green CI on both the PR and the post-merge main run
- Local vitest still `Tests 17 passed (17)` after the docs edit; no `.vue`/CSS/`src` file touched

## Task Commits

Task 1 made no file edit (repo-settings change, verified by readback — nothing to commit):

1. **Task 1: Enable branch protection with exact locked payload, verify by readback** — settings-only, no commit (readback outputs below)
2. **Task 2: Record CI as the regression gate in AGENTS.md** - `c19dfbf` (docs) + `fadff3a` (merge PR #1)

**Plan metadata:** committed with STATE.md/ROADMAP.md update (see closing commit)

## Files Created/Modified
- `AGENTS.md` - Testes/verificação line now points at `.github/workflows/ci.yml` (jobs required on main); new `Gate de regressão (CI obrigatório)` section with commands, contexts, strict/enforce_admins record, GH006 recovery

## Decisions Made
- Protection PUT sent as JSON via `gh api --input` — the RESEARCH `-f enforce_admins=true` form-field shape 422s (`"true" is not a boolean`); JSON body is the working form.
- Docs commit landed via PR #1 instead of direct push: with required checks active, GitHub declines the direct push before CI can run on the pushed SHA, so the plan's "push re-verifies the gate" step is impossible by design — PR landing is the D-11 recovery path (`open a PR with the fix`).
- No temporary rule disable: the gate stayed enforced for the whole plan; only the docs commit went through, and only after green CI.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Protection PUT payload sent as JSON instead of form fields**
- **Found during:** Task 1 (protection PUT)
- **Issue:** RESEARCH Code Examples shape (`-f enforce_admins=true`) returns HTTP 422 — form fields serialize as strings, and the API requires a real boolean / explicit nulls
- **Fix:** Resent the identical locked payload as a JSON body via `gh api --input -` (`required_status_checks` {strict false, contexts [backend frontend]}, `enforce_admins` true, reviews/restrictions null)
- **Files modified:** none (repo setting)
- **Verification:** PUT returned the protection object; all five readbacks below confirm
- **Committed in:** n/a (no file change)

**2. [Rule 3 - Blocking] Docs commit landed via PR #1 after direct push declined**
- **Found during:** Task 2 (push of `c19dfbf` to origin main)
- **Issue:** Push rejected — `protected branch hook declined: 2 of 2 required status checks are expected`. Required checks gate the pushed SHA, so a direct push can never satisfy them (CI only runs after the push lands)
- **Fix:** Created branch `pr/gate-docs` at `c19dfbf`, pushed the branch, opened PR #1, waited for green CI (push run 35914394436 + pull_request run 35914399069, both success), merged via `gh pr merge --merge` (`fadff3a`), fast-forwarded local main, deleted the branch. (One self-inflicted detour: an initial `git reset --hard origin/main` on the new branch orphaned `c19dfbf`; recovered immediately via the known hash — no data loss, history intact.)
- **Files modified:** AGENTS.md (unchanged content, new landing path)
- **Verification:** PR checks `backend: SUCCESS, frontend: SUCCESS`; post-merge main run 35914504197 `completed success`; readback still exact
- **Committed in:** `c19dfbf` + `fadff3a`

---

**Total deviations:** 2 auto-fixed (both blocking)
**Impact on plan:** Both required to complete the plan under the now-active gate; no scope creep — payload and note content match the locked decisions exactly.

## Issues Encountered
- Direct push to protected main is declined before CI runs (documented above as deviation 2, resolved via the plan's own D-11 PR path). This also confirms T-01-06 mitigation live: admin pushes are blocked when checks haven't passed.

## Protection Readback (Task 1 acceptance evidence, fresh GET)

```
== contexts ==
["backend","frontend"]
== strict ==
false
== enforce_admins ==
{"enabled":true,"url":"https://api.github.com/repos/ldsampaio/sgrf/branches/main/protection/enforce_admins"}
== strict+admins ==
false true
== reviews + restrictions ==
{"restrictions":null,"reviews":null}
== contexts joined ==
backend,frontend
```

(`required_pull_request_reviews` / `restrictions` are absent from the protection object = null; `keys` confirms only status-checks + enforce_admins enforcement present.)

## Red/Green Evidence (this plan)

```
completed  success  Merge pull request #1 …  CI  main  push  35914504197  20s  2026-09-23T20:13:31Z
completed  success  docs(01-03) …  CI  pr/gate-docs  pull_request  35914399069  15s
PR #1 checks: backend: COMPLETED SUCCESS / frontend: COMPLETED SUCCESS (x2 workflows)
```

Run URLs:
- PR: https://github.com/ldsampaio/sgrf/pull/1
- Post-merge main: https://github.com/ldsampaio/sgrf/actions/runs/35914504197

## Threat Flags

None — no new surface beyond the plan's threat model. Verified: no package installs (T-01-SC accept); T-01-06 mitigated live (admin direct push declined); T-01-07 mitigated (note records strict false + enforce_admins true with rationale); T-01-08 mitigated (GH006 recovery path documented in AGENTS.md and exercised — PR landing used).

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Phase 1 complete: workflow live (01-01), red-proofed (01-02), required on main + recorded (01-03). Every later fix in the milestone ships under the gate.
- Follow-on workflow change: direct pushes to `main` are now declined — all future work lands via PR (or a green-SHA push, which only CI-merge flows produce). The orchestrator should plan Phase 2+ execution accordingly.
- No blockers.

---
*Phase: 01-ci-regression-gate*
*Completed: 2026-09-23*

## Self-Check: PASSED
- FOUND: AGENTS.md (gate note present, old claim absent)
- FOUND: c19dfbf (git log --oneline --all | grep -q c19dfbf)
- FOUND: fadff3a (merge commit, local main == origin/main)
- Acceptance re-verified: readback exact; grep criteria pass; vitest 17/17; post-merge main CI success
