---
phase: 01-ci-regression-gate
plan: "02"
subsystem: infra
tags: [github-actions, ci, vitest, red-proof, negative-test]

# Dependency graph
requires:
  - phase: 01-01-ci-workflow
    provides: ".github/workflows/ci.yml live and green on main (run 35913584646)"
provides:
  - "Red-proof evidence: backend check went red on a deliberate break (run 35913880897) and green after revert (run 35914010303)"
  - "unit.test.js byte-identical to pre-break; main green — plan 01-03 unblocked"
affects: [01-03-required-checks, all-later-fixes]

# Actuals (#2632) — pairs with the plan's `estimate` to calibrate future estimates.
actuals:
  tokens: 125
  tasks: 2
  commits: 2

# Tech tracking
tech-stack:
  added: []
  patterns: [prove-then-enforce-red-proof, revert-not-rewrite]

key-files:
  created: []
  modified: [backend/tests/unit.test.js]

key-decisions:
  - "Direct break-push-revert on main per D-06 (branching_strategy none) — no PR proof"
  - "Undo via git revert HEAD + push (D-08) — history preserved, no amend/force-push"

patterns-established:
  - "Red-proof: flip one assertion, watch the gate fail, revert — a gate that never went red is unproven"

requirements-completed: [CI-01]

# Coverage metadata (#1602)
coverage:
  - id: D1
    description: "Backend check turns red on a deliberately broken test (negative proof the gate is non-vacuous)"
    requirement: "CI-01"
    verification:
      - kind: other
        ref: "gh run view 35913880897 --json jobs (backend failure + frontend success)"
        status: pass
      - kind: unit
        ref: "cd backend && npx vitest run on break commit — Tests 1 failed | 16 passed (17)"
        status: pass
    human_judgment: false
  - id: D2
    description: "Revert restores main to green with unit.test.js byte-identical to pre-break"
    requirement: "CI-01"
    verification:
      - kind: other
        ref: "gh run view 35914010303 --json jobs (backend success + frontend success)"
        status: pass
      - kind: unit
        ref: "cd backend && npx vitest run — Tests 17 passed (17)"
        status: pass
      - kind: other
        ref: "git diff 40a72a6~1 HEAD -- backend/tests/unit.test.js (empty) + grep WRONG count 0"
        status: pass
    human_judgment: false

# Metrics
duration: 3min
completed: 2026-09-23
status: complete
---

# Phase 1 Plan 02: Red-Proof Summary

**Deliberate one-assertion break turned the backend check red (run 35913880897), then git revert restored green (run 35914010303) — the CI gate is proven non-vacuous**

## Performance

- **Duration:** 3 min
- **Started:** 2026-09-23T20:07:35Z
- **Completed:** 2026-09-23T20:10:24Z
- **Tasks:** 2
- **Files modified:** 1

## Accomplishments
- Broke `backend/tests/unit.test.js` line 8 (`toBe('WRONG')`), verified locally 1 failed / 16 passed, pushed to `origin main` as `40a72a6`
- CI run `35913880897` on the break commit: `backend: failure`, `frontend: success` — the gate catches regressions
- Reverted with `git revert HEAD` + push (`e6f1c36`), no amend, no force-push — history preserved
- CI run `35914010303` on the revert commit: `backend: success`, `frontend: success` — main green again
- `unit.test.js` byte-identical to pre-break (`git diff 40a72a6~1 HEAD` empty, no `WRONG` remains, local `Tests 17 passed (17)`)
- No `.vue`, stylesheet, or `src` file created or modified

## Task Commits

Each task was committed atomically:

1. **Task 1: Break line 8, push, confirm the backend check goes red** - `40a72a6` (ci)
2. **Task 2: Revert the break, push, confirm main is green** - `e6f1c36` (revert)

**Plan metadata:** committed with STATE.md/ROADMAP.md update (see closing commit)

## Files Created/Modified
- `backend/tests/unit.test.js` - Line 8 flipped to `toBe('WRONG')` then reverted; ends unchanged

## Decisions Made
- Direct break-push-revert on `main` per D-06 (`branching_strategy: none`) — no PR-based proof.
- Undo via `git revert HEAD` + plain push per D-08 — amend or force-push would rewrite main history.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## Red Evidence (CLI output, per D-09)

Break commit — red:

```
completed  failure  ci(01-02): deliberate break to prove the gate  CI  main  push  35913880897  22s  2026-09-23T20:07:49Z
backend: failure
frontend: success
```

Revert commit — green:

```
completed  success  Revert "ci(01-02): deliberate break to prove the gate"  CI  main  push  35914010303  18s  2026-09-23T20:09:03Z
backend: success
frontend: success
```

Run URLs:
- Red: https://github.com/ldsampaio/sgrf/actions/runs/35913880897
- Green: https://github.com/ldsampaio/sgrf/actions/runs/35914010303

## Threat Flags

None — no new surface beyond the plan's threat model. Verified: break touched line 8 only (T-01-02), revert pushed before any protection exists so no GH006 block (T-01-04), red run proves the backend job executes the real `npx vitest run` (T-01-05), no package installs (T-01-SC).

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Ready for 01-03 (branch protection): red-proof complete plus green run 35914010303 on main within 7 days — both prove-then-enforce preconditions hold.
- No blockers.

---
*Phase: 01-ci-regression-gate*
*Completed: 2026-09-23*

## Self-Check: PASSED
- FOUND: backend/tests/unit.test.js (line 8 restored to `toBe('a@utfpr.edu.br')`)
- FOUND: 40a72a6 (git log --oneline --all | grep -q 40a72a6)
- FOUND: e6f1c36 (git log --oneline --all | grep -q e6f1c36)
- Acceptance criteria re-verified: gh run list shows failure run 35913880897 (backend failure) + success run 35914010303 (both jobs success); local vitest 17/17; no WRONG in file; diff vs pre-break empty
