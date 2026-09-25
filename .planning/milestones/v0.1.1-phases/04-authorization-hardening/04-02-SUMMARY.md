---
phase: 04-authorization-hardening
plan: 02
subsystem: auth
tags: [express, rbac, row-level-authz, rn-010, supertest, vitest, prisma-mock]

# Dependency graph
requires:
  - phase: 04-authorization-hardening
    provides: ["Frozen PERMISSIONS map + requirePermission", "canViewRequest/scopeWhere shared helper", "Wave 0 authz test scaffolding (require.cache mockDbState pattern)"]
provides:
  - "RN-010 cancel matrix enforced in requestController.cancel (justification 400, audit, Phase 6 REVERSE seam)"
  - "Message remove author-or-leader guard + deliberation list parent view-scope"
  - "listVotes view-scope with full vote detail (D-01/D-02)"
  - "reports.scopeFilter unified onto shared scopeWhere + voting report view-scope filter"
  - "Force-password-reset canManageUsers target guard + distinct audit action"
affects: [04-03 supertest matrix, Phase 6 VOT-04/06-04 compensating REVERSE]

# Actuals (#2632) — pairs with the plan's `estimate` to calibrate future estimates.
actuals:
  tokens: 3052
  tasks: 3
  commits: 3

# Tech tracking
tech-stack:
  added: []
  patterns: [rn-010 status-by-role routing, check-order fetch-then-404-then-400-then-403, path-based audit-action split]

key-files:
  created: []
  modified: [backend/src/controllers/requestController.js, backend/src/controllers/deliberationController.js, backend/src/controllers/votingController.js, backend/src/controllers/userController.js, backend/src/routes/reports.routes.js]

key-decisions:
  - "Cancel approved-branch delegates reversal to a marked Phase 6 seam comment — no FinancialTransaction writes in this phase"
  - "reports.scopeFilter delegates to shared scopeWhere, keeping only the temporal (from/to) slice local — no divergent draft rule"
  - "Force-reset vs invite audit split via req.path check inside the shared handler (no users.routes.js change)"

patterns-established:
  - "Row-guard order: fetch -> canViewRequest 404 -> immutability/state 400 -> justification 400 -> role/ownership 403 (suspension 423 keeps precedence where present)"
  - "View-scope is the only gate on votes and amounts — no tally-only or amount-redaction layers"

requirements-completed: [SEC-01]

# Coverage metadata (#1602)
coverage:
  - id: D1
    description: "RN-010 cancel matrix enforced with justification 400 + request_cancelled audit + Phase 6 seam on the approved branch"
    requirement: "SEC-01"
    verification:
      - kind: integration
        ref: "backend/tests/authz (13 tests green; full matrix expansion deferred to 04-03)"
        status: pass
    human_judgment: false
  - id: D2
    description: "remove/listVotes/reports follow view scope; deliberation post role rule lives in the map; settings view open locked with mutations untouched; force-reset target-guarded"
    requirement: "SEC-01"
    verification:
      - kind: integration
        ref: "backend/tests/authz (13 tests green) + full suite 45/45 green; git diff on settingsController.js empty"
        status: pass
    human_judgment: false

# Metrics
duration: 12min
completed: 2026-09-24
status: complete
---

# Phase 04 Plan 02: Row-Level Ownership & Scoping Summary

**RN-010 cancel matrix with audited justification and Phase 6 REVERSE seam, message remove author-or-leader guard, listVotes/reports view-scope, shared scopeWhere everywhere, force-reset chefe→admin block — full suite 45/45 green**

## Performance

- **Duration:** ~12 min
- **Started:** 2026-09-24T15:49:00Z
- **Completed:** 2026-09-24T16:01:00Z
- **Tasks:** 3
- **Files modified:** 5 (0 created)

## Accomplishments

- `requestController.cancel` enforces the RN-010 matrix verbatim (docs/14:16): fetch → canViewRequest 404 → CONCLUIDO/CANCELADO immutable 400 → justification 400 → approved-branch leaders-only with Phase 6 (VOT-04/06-04) compensating REVERSE seam comment → ordinary branch owner(RASCUNHO/EM_VOTACAO) or leaders else 403, audited `request_cancelled` with justification on both paths
- `requestController.list` replaces the ALUNO-only branch with shared `scopeWhere` (D-03/D-04); `getOne` 404 guard already in place from 04-01, untouched
- `deliberationController.remove` inserts author-or-leader 403 (D-07, no time window) between exists check and suspension guard so 423 keeps precedence; `list` gains parent canViewRequest 404; `post` inline ALUNO exclusion removed (covered by `messages:post` map action)
- `votingController.listVotes` gains parent lookup + canViewRequest 404 and returns full enriched vote detail when visible (D-01/D-02, no tally redaction); eligibility logic in voting service untouched
- `reports.scopeFilter` delegates to shared `scopeWhere` (only the from/to temporal slice stays local); `/voting` report filters votes/vistas to canViewRequest-visible requests (drafts excluded for outsiders); `/:id/history` alias unchanged (`requests:get`, no new audit-read surface per D-09)
- Settings verify-and-lock: transactions view confirmed open (no gate on route or controller, `settings:transactions:view` all-roles already wired in 04-01) — zero diff to settingsController.js/settings.routes.js; PATCH mutation leaders-only arrays untouched
- `userController.resendInvite` gains target 404 + `canManageUsers` 403 (chefe→admin blocked per D-11) with distinct `password_reset_forced` vs `invite_resent` audit via path check; temp-password/enqueue/hash flow unchanged

## Task Commits

Each task was committed atomically:

1. **Task 1: Cancel RN-010 matrix + getOne/list visibility** - `ff9717a` (feat)
2. **Task 2: Message remove guard + listVotes view-scope + reports scopeFilter reuse** - `e735b04` (feat)
3. **Task 3: Settings verify-and-lock + force-password-reset target guard** - `01ae101` (feat)

## Files Created/Modified

- `backend/src/controllers/requestController.js` - cancel RN-010 matrix + Phase 6 seam + audited justification; list via scopeWhere
- `backend/src/controllers/deliberationController.js` - remove author-or-leader guard; list parent view-scope; post map-only roles
- `backend/src/controllers/votingController.js` - listVotes parent lookup + view-scope 404, full detail
- `backend/src/controllers/userController.js` - resendInvite canManageUsers target guard + distinct audit action
- `backend/src/routes/reports.routes.js` - scopeFilter delegates to scopeWhere; voting report view-scope filter

## Decisions Made

- Approved-cancel branch carries the Phase 6 (VOT-04/06-04) compensating REVERSE seam comment — no FinancialTransaction writes in this phase (per plan notes and Pitfall 2)
- `reports.scopeFilter` replaced-by-delegation (not deletion): keeps the function as a thin wrapper adding only the temporal slice, so `/requests`, `/dashboard`, `/dashboard-pdf` call sites are untouched
- Force-reset/invite audit split via `req.path.includes('force-password-reset')` inside the shared handler (executor's discretion) — avoids touching users.routes.js, which the plan did not list

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

- A stray `cd backend` in the verify chain failed (already inside backend/) — re-ran the full suite from the correct cwd; 45/45 green. No code impact.

## Threat Flags

| Flag | File | Description |
|------|------|-------------|
| threat_flag: justification-opaque-audit | backend/src/controllers/requestController.js | Cancel justification stored as opaque string in audit afterData via fail-open audit; no CSV/export sink touched here (T-04-05 accepted) |

T-04-02 (IDOR 404 via canViewRequest/scopeWhere), T-04-03 (cancel/remove 403 routing), T-04-04 (force-reset canManageUsers target check) all mitigated in this plan; full deny-matrix proof deferred to 04-03.

## Known Stubs

None — no placeholder values, TODOs, or unwired components introduced. (The Phase 6 REVERSE seam comment is a marked extension point, not a stub: cancel is fully functional with audited status change on both paths.)

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Ready for 04-03 (full supertest matrix): all row-guards are in place behind already-wired map actions; mockDbState singleton + require.cache pattern covers the new Prisma paths (`resourceRequest.update`, `vote.findMany`, `deliberationMessage.*`, `viewRequest`, `user.update`) — 04-03 expands fixtures and cases, no guard changes expected
- Watch for 04-03: cancel now returns `{ ok, request }` (was `{ ok }`) — matrix tests should assert the new shape
- Watch for Phase 6: the `// Phase 6 (VOT-04/06-04)` seam comment in cancel marks where the compensating REVERSE lands

## Self-Check: PASSED

- All 5 modified source files verified present on disk
- All 3 task commits verified in `git log` (ff9717a, e735b04, 01ae101)
- `cd backend && npx vitest run tests/authz` → 2 files, 13 tests, all passing
- `cd backend && npx vitest run` → 6 files, 45 tests, all passing
- `git diff` on settingsController.js + settings.routes.js empty (mutations untouched)

---
*Phase: 04-authorization-hardening*
*Completed: 2026-09-24*
