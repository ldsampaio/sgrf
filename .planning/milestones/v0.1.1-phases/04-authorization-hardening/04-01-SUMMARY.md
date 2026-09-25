---
phase: 04-authorization-hardening
plan: 01
subsystem: auth
tags: [express, permissions, rbac, supertest, vitest, prisma-mock]

# Dependency graph
requires:
  - phase: 02-domain-rules
    provides: [RN-010 cancel matrix constraining future cancel guards]
provides:
  - "Frozen PERMISSIONS map + requirePermission(action) deny-by-default middleware"
  - "Shared visibility helper canViewRequest/scopeWhere (D-03/D-04)"
  - "All 5 route files wired with permission actions + router-stack coverage test"
  - "Wave 0 authz test scaffolding (helpers, mockDbState, matrix skeleton) green"
  - "docs/06 ALUNO override (D-03) + recorded reports-scope decision"
affects: [04-02 ownership fixes, 04-03 supertest matrix, reports.scopeFilter unification, listVotes view-scope]

# Actuals (#2632) — pairs with the plan's `estimate` to calibrate future estimates.
actuals:
  tokens: 7823
  tasks: 3
  commits: 3

# Tech tracking
tech-stack:
  added: []
  patterns: [deny-by-default permission map, router-stack coverage test, require.cache Prisma-mock seeding for CJS chains]

key-files:
  created: [backend/src/middlewares/permissions.js, backend/src/middlewares/visibility.js, backend/tests/authz/helpers.js, backend/tests/authz/mockDbState.js, backend/tests/authz/route-coverage.test.js, backend/tests/authz/matrix.test.js]
  modified: [backend/src/routes/requests.routes.js, backend/src/routes/messages.routes.js, backend/src/routes/settings.routes.js, backend/src/routes/reports.routes.js, backend/src/routes/users.routes.js, backend/src/controllers/requestController.js, docs/06-permissoes.md]

key-decisions:
  - "Prisma mocked via require.cache seeding, not vi.mock (CJS require chain bypasses the vitest mock registry)"
  - "users PATCH routes get broad map actions with canManageUsers retained as target gate"
  - "Reports scope unified widen: PROFESSOR/ALUNO see own + all non-drafts (D-03 parity generalizes)"

patterns-established:
  - "requirePermission(action) mirrors requireRole closure shape; unknown action fails closed 403; frame tagged fn._permissionAction for coverage detection"
  - "Check order: authenticate -> map gate 403 -> fetch -> visibility 404 -> ownership 403"
  - "Mock only the Prisma singleton; sign real JWTs per role; never stub authJwt"

requirements-completed: [SEC-01]

# Coverage metadata (#1602)
coverage:
  - id: D1
    description: "requirePermission + canViewRequest enforced end to end on GET /api/requests/:id (role-then-visibility ordering, 404 out-of-scope, amounts unredacted)"
    requirement: "SEC-01"
    verification:
      - kind: integration
        ref: "backend/tests/authz/matrix.test.js (12 tests: owner draft 200, cross-user draft 404, PROFESSOR/ALUNO non-draft 200, admin draft 200, 401 unauthenticated, history alias, fail-closed unit cases)"
        status: pass
    human_judgment: false
  - id: D2
    description: "Every route in requests/messages/settings/reports/users declares a permission action (undeclared fails closed)"
    requirement: "SEC-01"
    verification:
      - kind: integration
        ref: "backend/tests/authz/route-coverage.test.js (router-stack walk asserts _permissionAction tag per route)"
        status: pass
    human_judgment: false
  - id: D3
    description: "docs/06 shows Sim for ALUNO on voting-visualization row with D-03 override noted, and Gerar relatorios row matches recorded widen decision"
    requirement: "SEC-01"
    verification:
      - kind: other
        ref: "grep -v '^#' docs/06-permissoes.md | grep -c 'Sim | Sim | Sim | Sim | Sim' (=3) && grep -c 'D-03' docs/06-permissoes.md (=2)"
        status: pass
    human_judgment: false

# Metrics
duration: 25min
completed: 2026-09-24
status: complete
---

# Phase 04 Plan 01: Authorization Foundation Summary

**Deny-by-default PERMISSIONS map + requirePermission middleware, shared draft-visibility helper, all five route files wired, mock-Prisma supertest skeleton green (13 authz tests), docs/06 ALUNO override recorded**

## Performance

- **Duration:** ~25 min
- **Started:** 2026-09-24T15:30:00Z
- **Completed:** 2026-09-24T15:55:00Z
- **Tasks:** 3
- **Files modified:** 13 (6 created, 7 modified)

## Accomplishments

- Frozen `PERMISSIONS` map + `requirePermission(action)` (fail-closed 403 on undeclared action, 401 without user, `_permissionAction` frame tag) wired after `authJwt` on every route of the five phase files
- `canViewRequest`/`scopeWhere` encode D-03/D-04 in one place; `getOne` (+ `/:id/history` alias) returns 404 out-of-scope per D-08 with amounts unredacted per D-05
- Router-stack coverage test proves every route declares a permission; full backend suite 45/45 green with zero controller behavior change
- docs/06: ALUNO voting-visualization `Não`→`Sim` (D-03) and `Gerar relatórios`→`Não-rascunhos` (unify-widen) with rationale recorded

## Task Commits

Each task was committed atomically:

1. **Task 1: Tracer permission map + visibility + getOne + Wave 0 scaffolding** - `3b65c62` (feat)
2. **Task 2: Wire requirePermission across remaining routes** - `729db89` (feat)
3. **Task 3: docs/06 D-03 override + reports decision** - `6009d3c` (docs)

## Files Created/Modified

- `backend/src/middlewares/permissions.js` - Frozen PERMISSIONS map (29 actions) + requirePermission factory
- `backend/src/middlewares/visibility.js` - canViewRequest + scopeWhere (D-03/D-04, String() UUID coercion)
- `backend/src/routes/requests.routes.js` - All 17 routes wired (requests/votes/messages/finance actions)
- `backend/src/routes/messages.routes.js` - patch/remove wired (messages:edit/remove)
- `backend/src/routes/settings.routes.js` - view/financial/transactions/email stubs wired
- `backend/src/routes/reports.routes.js` - All 7 inline handlers wired (reports:* actions)
- `backend/src/routes/users.routes.js` - requireRole migrated to map actions; PATCHs broad + canManageUsers retained
- `backend/src/controllers/requestController.js` - getOne gains canViewRequest 404 (include files+transactions kept)
- `backend/tests/authz/helpers.js` - 5-role fixtures, draft/non-draft requests, real-JWT signer
- `backend/tests/authz/mockDbState.js` - Singleton mock-Prisma (see deviations)
- `backend/tests/authz/route-coverage.test.js` - Router-stack tag assertion over the 5 routers
- `backend/tests/authz/matrix.test.js` - 12-test getOne allow/deny skeleton + fail-closed unit cases
- `docs/06-permissoes.md` - D-03 override + unify-widen reports decision with rationale

## Decisions Made

- Prisma mocked via `require.cache` seeding (not `vi.mock`) — see deviation 1; documented in both test files and mockDbState.js so 04-03 reuses the pattern
- `votes:cast` covers both castVote and changeMyVote (a PROFESSOR can hold no vote record since castVote enforces canVote — zero behavior change)
- `votes:suspend` (CHEFE-only) covers suspend/unsuspend/collegiateDecision, mirroring current inline chefe-only checks exactly
- `reports:financial` keeps its inline leaders-only check under the new route gate (defense in depth, zero behavior change)
- `settings:email:edit` (ADMIN-only) covers the two email stub routes per matrix "Configurar e-mail" row
- Reports scope: unify-widen (PROFESSOR/ALUNO `Não-rascunhos`), per RESEARCH.md recommendation — list and report coherent, voting report follows view-scope (D-02)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] vi.mock does not intercept the CJS require chain — seeded require.cache instead**
- **Found during:** Task 1 (Tracer — matrix tests returned 401 "Usuário inválido" with correct tokens)
- **Issue:** `vi.mock('../../src/config/db.js')` had no effect on controllers: instrumented `authJwt` showed `prisma.constructor.name` minified (real PrismaClient). The src CJS `require` chain loads natively and bypasses the vitest mock registry; additionally the mock factory evaluated twice (ESM vs CJS pipelines), yielding split instances.
- **Fix:** Created `tests/authz/mockDbState.js` singleton; each test file seeds `require.cache[dbPath]` with the singleton before dynamically importing the app/routers. Mock only the Prisma singleton; authJwt/JWT stay real.
- **Files modified:** backend/tests/authz/mockDbState.js, matrix.test.js, route-coverage.test.js
- **Verification:** 12/12 matrix tests pass with real-JWT allow/deny cases; no DB connection opened (works with dummy CI DATABASE_URL)
- **Committed in:** 3b65c62 (part of task commit)

**2. [Rule 3 - Blocking] ESM default-import of mocked CJS db module needs explicit `default` key**
- **Found during:** Task 1 (first matrix run: "No default export is defined on the mock")
- **Issue:** `import prisma from '../../src/config/db.js'` failed against the factory object.
- **Fix:** Superseded by deviation 1 — tests import the `mockDb` singleton directly; no ESM import of db.js remains.
- **Files modified:** same as above
- **Verification:** suite green
- **Committed in:** 3b65c62 (part of task commit)

---

**Total deviations:** 2 auto-fixed (2 blocking)
**Impact on plan:** Both were test-harness mechanics; no production-code scope creep. The require.cache pattern is the documented seam for 04-02/04-03 controller-guard tests.

## Issues Encountered

- Local port 5432 is OPEN and `backend/.env` holds real secrets, so the first failing runs were ambiguous (real DB vs mock). Instrumentation (`constructor.name`) proved the real client was in use, which directed the require.cache fix. No production code was harmed; the instrumentation was reverted (`git diff` on auth.js verified empty).
- Pino access logs make authz test output verbose (one JSON line per request) — cosmetic only, no action taken.

## Threat Flags

| Flag | File | Description |
|------|------|-------------|
| threat_flag: residual_inline_gates | backend/src/controllers/*.js | Inline role arrays (finance, voting, deliberation, settings PATCH) remain as defense-in-depth under the new route gates; 04-02 centralizes/removes them per guard table — no new surface introduced here |
| threat_flag: mock_only_coverage | backend/tests/authz/* | Matrix proves the permission layer, not query correctness (per RESEARCH.md A2); real-DB authz coverage deferred to later finance-integration context |

## Known Stubs

None — no placeholder values, TODOs, or unwired components introduced. (`/:id/history` reuses `getOne` deliberately per Pitfall 5; settings email stubs pre-existed and are now permission-gated.)

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Ready for 04-02 (ownership fixes): `canViewRequest`/`scopeWhere` importable from `middlewares/visibility.js`; cancel/remove/resendInvite/listVotes guards slot into controllers behind already-wired map actions; `// Phase 6: compensating REVERSE here` seam guidance in RESEARCH.md still applies to cancel
- Ready for 04-03 (full matrix): `helpers.js` + `mockDbState.js` + require.cache pattern expand to routes × 5 roles; coverage test already enforces no untagged routes
- Watch: `reports.scopeFilter` still carries the old PROF/ALUNO own-only copy — 04-02 unifies it with `scopeWhere` (dashboard + requests report); voting report needs `canViewRequest` filtering (drafts excluded unless owner/leaders)

## Self-Check: PASSED

- All 13 created/modified source files verified present on disk
- All 3 task commits verified in `git log` (3b65c62, 729db89, 6009d3c)
- `cd backend && npx vitest run` → 6 files, 45 tests, all passing
- docs/06 verify command → 3 all-Sim rows, 2 D-03 mentions

---
*Phase: 04-authorization-hardening*
*Completed: 2026-09-24*
