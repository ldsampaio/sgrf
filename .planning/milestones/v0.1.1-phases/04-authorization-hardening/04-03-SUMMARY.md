---
phase: 04-authorization-hardening
plan: 03
subsystem: auth
tags: [express, rbac, row-level-authz, supertest, vitest, prisma-mock, rn-010]

# Dependency graph
requires:
  - phase: 04-authorization-hardening
    provides: ["RN-010 cancel matrix + row-guards in controllers (04-02)", "Frozen PERMISSIONS map + requirePermission (04-01)", "require.cache Prisma-mock seam (04-01)"]
provides:
  - "Full supertest allow+deny matrix (fixed routes x 5 roles, 49 matrix tests)"
  - "Hardened router-stack coverage test with negative control (undeclared fails closed)"
  - "Full backend suite green: 85/85 (32 pre-existing + 53 authz), zero CI change"
affects: [Phase 6 VOT-04/06-04 compensating REVERSE, future route additions (coverage gate), finance-integration real-DB authz coverage]

# Actuals (#2632) — pairs with the plan's `estimate` to calibrate future estimates.
actuals:
  tokens: 6600
  tasks: 2
  commits: 2

# Tech tracking
tech-stack:
  added: []
  patterns: [in-memory where-matcher for scopeWhere HTTP tests, it.each role sweeps, negative-control coverage test]

key-files:
  created: []
  modified: [backend/tests/authz/matrix.test.js, backend/tests/authz/route-coverage.test.js, backend/tests/authz/helpers.js, backend/tests/authz/mockDbState.js]

key-decisions:
  - "mockDbState extended with missing models (viewRequest, fundBalance, departmentSettings, emailQueue, creates/updates) — mock-only-Prisma-singleton seam preserved"
  - "List draft-invisibility proven at HTTP level via in-memory where-matcher, not by asserting mock args"
  - "Coverage negative control uses a synthetic untagged router through the same untaggedRoutes function"

patterns-established:
  - "Deny cases pin the D-08 split: 403 wrong role on visible scope, 404 outside scope"
  - "Allow cases guard against over-deny: conselheiro under-vote read, owner self-read, admin force-reset"

requirements-completed: [SEC-01]

# Coverage metadata (#1602)
coverage:
  - id: D1
    description: "Supertest allow+deny matrix covering fixed routes x all 5 roles passes (ALLOW intact, deny asserts 403/404 split)"
    requirement: "SEC-01"
    verification:
      - kind: integration
        ref: "backend/tests/authz/matrix.test.js (49 tests: cancel RN-010 x roles, message remove, list scoping, listVotes, transactions, force-reset, reports voting)"
        status: pass
    human_judgment: false
  - id: D2
    description: "Router-stack coverage test proves every route declares a permission and an untagged route fails the assertion"
    requirement: "SEC-01"
    verification:
      - kind: integration
        ref: "backend/tests/authz/route-coverage.test.js (4 tests: full tag assertion + non-empty guard + negative/positive controls)"
        status: pass
    human_judgment: false
  - id: D3
    description: "Full backend suite green with all pre-existing tests passing and no CI change"
    requirement: "SEC-01"
    verification:
      - kind: integration
        ref: "cd backend && npx vitest run (6 files, 85 tests, all passing; 32 pre-existing >= 17)"
        status: pass
    human_judgment: false

# Metrics
duration: 12min
completed: 2026-09-24
status: complete
---

# Phase 04 Plan 03: Authorization Regression Gate Summary

**Full supertest allow+deny matrix (cancel RN-010, message remove, list/listVotes scoping, transactions, force-reset, reports voting across all 5 roles) plus router-stack coverage test with negative control — full suite 85/85 green, zero CI change**

## Performance

- **Duration:** ~12 min
- **Started:** 2026-09-24T15:50:00Z
- **Completed:** 2026-09-24T16:02:00Z
- **Tasks:** 2
- **Files modified:** 4 (0 created)

## Accomplishments

- Matrix grew 12 → 49 tests: cancel RN-010 (owner RASCUNHO/EM_VOTACAO allow, cross-user 403 vs draft-outsider 404, justification 400, immutable 400, leader-approved allow vs owner-approved 403, admin INDEFERIDO allow, 5-role sweep), message remove (author 200, non-author 403, ALUNO 403, CHEFE 200, missing 404, list view-scope 200/404)
- List draft-invisibility proven at HTTP level via in-memory where-matcher (owner sees own draft + open, ALUNO sees only open, ADMIN sees all); listVotes view-scope with full vote detail; transactions open to all 5 roles with PATCH financial leaders-only; force-reset chefe→admin 403 with admin flow intact; reports voting scoped by canViewRequest
- Coverage test hardened: full 5-router tag assertion + per-router non-empty guard + negative control (synthetic untagged route detected) + positive control
- Full `cd backend && npx vitest run`: 6 files, 85 tests, all passing (32 pre-existing ≥ 17 required; 53 authz)

## Task Commits

Each task was committed atomically:

1. **Task 1: Complete allow+deny matrix for fixed routes x 5 roles** - `5dc5a52` (test)
2. **Task 2: Finalize router coverage test + full suite green** - `3867acc` (test)

## Files Created/Modified

- `backend/tests/authz/matrix.test.js` - 37 new cases across 7 describes (cancel, messages, list, listVotes, settings, force-reset, reports voting)
- `backend/tests/authz/route-coverage.test.js` - Negative/positive controls + non-empty guard
- `backend/tests/authz/helpers.js` - makeVote + makeMessage fixtures
- `backend/tests/authz/mockDbState.js` - Missing models: user.create/update, vote.create, viewRequest, deliberationMessage.create, financialTransaction.create, fundBalance, departmentSettings, emailQueue

## Decisions Made

- Extended mockDbState (not a new seam): the require.cache singleton pattern from 04-01 is preserved; only missing model fns were added so cancel/votes/reports/force-reset paths resolve without a DB
- List scoping asserted on response bodies via an in-memory where-matcher honoring scopeWhere shapes (OR/requesterId/status.not) rather than asserting mock call args — proves the HTTP-visible behavior
- it.each used for the mechanical 5-role transactions sweep and the financial-edit deny sweep; bespoke its kept where the assertion differs per case (cancel sweep needs per-role setup)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] mockDbState lacked models the matrix paths touch**
- **Found during:** Task 1 (new describes need viewRequest, fundBalance, departmentSettings, emailQueue, and create/update fns)
- **Issue:** Plan listed only helpers.js + matrix.test.js, but the mock singleton had no `viewRequest`, `fundBalance`, `departmentSettings`, `emailQueue`, or create/update fns — reports voting, settings PATCH, and force-reset 200 paths would throw TypeError on undefined mocks
- **Fix:** Added the missing `vi.fn()` model namespaces to the singleton; auth chain untouched (real JWTs, real app factory)
- **Files modified:** backend/tests/authz/mockDbState.js
- **Verification:** 49/49 matrix tests pass; no DB connection opened
- **Committed in:** 5dc5a52 (part of task commit)

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** Test-harness mechanics only; no production-code change, no scope creep.

## Issues Encountered

- None — all new cases passed on first full run except none; the sweep test was cleaned up before running (removed a leftover dead variable) and the suite went green immediately.

## Threat Flags

None — no new network endpoints, auth paths, file access, or schema changes. T-04-01 (undeclared routes) mitigated by the hardened coverage test with negative control; T-04-02 (IDOR 404) pinned per-route in the matrix; T-04-06 (over-deny) guarded by explicit allow cases.

## Known Stubs

None — no placeholder values, TODOs, or unwired components introduced.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Phase 04 regression gate stands alone: any future route without requirePermission fails `route-coverage.test.js`; any guard regression fails `matrix.test.js` — both run under bare `npx vitest run` with zero CI change
- Watch for Phase 6: cancel approved-branch still carries the compensating REVERSE seam (no financial writes in this phase)
- Residual: mock-only coverage proves the permission layer, not query correctness (accepted per 04-01 threat flag; real-DB authz coverage deferred to finance-integration context)

## Self-Check: PASSED

- All 4 modified files verified present on disk
- Both task commits verified in `git log` (5dc5a52, 3867acc)
- `cd backend && npx vitest run` → 6 files, 85 tests, all passing (32 pre-existing ≥ 17)

---
*Phase: 04-authorization-hardening*
*Completed: 2026-09-24*
