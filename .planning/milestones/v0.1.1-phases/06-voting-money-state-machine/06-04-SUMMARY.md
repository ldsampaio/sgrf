---
phase: 06-voting-money-state-machine
plan: 04
subsystem: api
tags: [cancellation, financial-reversal, audit, voting, state-machine]

# Dependency graph
requires:
  - phase: 06-01
    provides: "VOT-01 tie-break convergence; chefe can change vote in AGUARDANDO_DESEMPATE"
  - phase: 06-02
    provides: "VOT-02 annual cap accounting with CONCLUIDO status inclusion"
  - phase: 06-03
    provides: "VOT-03 partial approval arbitration flow; APROVADO_PARCIALMENTE status with AGUARDANDO_ARBITRAGEM logical state"
provides:
  - VOT-04-cancellation-after-approval
  - Cancellation reversal with REVERSE FinancialTransaction
  - Frontend justification modal for cancel flow
affects:
  - requestController.cancel handler
  - financeController.reverseProvision pattern
  - frontend Requests.vue cancel UI

# Actuals
actuals:
  tokens: 15500
  tasks: 3
  commits: 3

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Inline compensating REVERSE transaction in same $transaction as status change"
    - "Mandatory justification stored in FinancialTransaction.metadata and AuditEvent.afterData"
    - "Frontend conditional modal with role-aware warning for approved requests"

key-files:
  created: []
  modified:
    - backend/tests/voting.test.js
    - backend/src/controllers/requestController.js
    - frontend/src/views/Requests.vue

key-decisions:
  - "Cancellation of approved requests (APROVADO, APROVADO_AUTOMATICAMENTE, APROVADO_PARCIALMENTE) requires ADMINISTRADOR or CHEFE_DEPARTAMENTO role + mandatory justification"
  - "REVERSE FinancialTransaction created inline with metadata.justification, decidedBy, action='cancellation_reversal'"
  - "AuditEvent request_cancelled includes justification verbatim in afterData"
  - "FundBalance provisionedCents decremented / availableCents incremented atomically in same transaction"
  - "Non-approved requests (RASCUNHO, EM_VOTACAO, SUBMETIDO) use Phase 4 ownership rules — owner can cancel without financial reversal"
  - "Frontend shows warning banner for approved requests explaining admin/chefe requirement and financial reversal"

patterns-established:
  - "Characterization-then-flip TDD for state machine fixes: write correct behavior tests first (RED), then implement (GREEN)"
  - "Cancellation reversal reuses financeController.reverseProvision pattern but inline for atomicity with audit"
  - "Conditional UI for cancel: simple confirm for drafts, required justification modal for approved requests"

requirements-completed:
  - VOT-04

coverage:
  - id: D1
    description: "Cancel approved request as ADMIN with justification succeeds, writes REVERSE transaction, restores FundBalance, audits justification"
    requirement: VOT-04
    verification:
      - kind: integration
        ref: "backend/tests/voting.test.js#Admin can cancel approved request with justification - succeeds, writes REVERSE transaction, restores FundBalance, audits justification"
        status: pass
    human_judgment: false
  - id: D2
    description: "Cancel approved request as CHEFE_DEPARTAMENTO with justification succeeds, same as admin"
    requirement: VOT-04
    verification:
      - kind: integration
        ref: "backend/tests/voting.test.js#Chefe can cancel approved request with justification - succeeds, same as admin"
        status: pass
    human_judgment: false
  - id: D3
    description: "CONSELHEIRO cannot cancel approved request - returns 403"
    requirement: VOT-04
    verification:
      - kind: integration
        ref: "backend/tests/voting.test.js#Conselheiro cannot cancel approved request - returns 403"
        status: pass
    human_judgment: false
  - id: D4
    description: "Requester (owner) cannot cancel approved request - returns 403 (Phase 4 ownership + VOT-04 role requirement)"
    requirement: VOT-04
    verification:
      - kind: integration
        ref: "backend/tests/voting.test.js#Requester (owner) cannot cancel approved request - returns 403"
        status: pass
    human_judgment: false
  - id: D5
    description: "Cancel approved request without justification returns 400"
    requirement: VOT-04
    verification:
      - kind: integration
        ref: "backend/tests/voting.test.js#Cancel approved request without justification - returns 400"
        status: pass
    human_judgment: false
  - id: D6
    description: "Cancel approved request with empty/whitespace justification returns 400"
    requirement: VOT-04
    verification:
      - kind: integration
        ref: "backend/tests/voting.test.js#Cancel approved request with empty/whitespace justification - returns 400"
        status: pass
    human_judgment: false
  - id: D7
    description: "Cancel non-approved request (RASCUNHO) as owner succeeds, no reversal needed"
    requirement: VOT-04
    verification:
      - kind: integration
        ref: "backend/tests/voting.test.js#Cancel non-approved request (RASCUNHO) as owner - succeeds, no reversal needed"
        status: pass
    human_judgment: false
  - id: D8
    description: "Cancel non-approved request (SUBMETIDO) as owner succeeds, no reversal needed"
    requirement: VOT-04
    verification:
      - kind: integration
        ref: "backend/tests/voting.test.js#Cancel non-approved request (SUBMETIDO) as owner - succeeds, no reversal needed"
        status: pass
    human_judgment: false
  - id: D9
    description: "REVERSE FinancialTransaction has metadata.justification; AuditEvent afterData.justification matches"
    requirement: VOT-04
    verification:
      - kind: integration
        ref: "backend/tests/voting.test.js#REVERSE FinancialTransaction has metadata.justification; AuditEvent afterData.justification matches"
        status: pass
    human_judgment: false
  - id: D10
    description: "Frontend cancel modal with justification textarea for approved requests; build passes"
    requirement: VOT-04
    verification:
      - kind: automated_ui
        ref: "cd frontend && npm run build"
        status: pass
    human_judgment: false
  - id: D11
    description: "Frontend shows warning banner for approved requests explaining admin/chefe requirement"
    requirement: VOT-04
    verification:
      - kind: automated_ui
        ref: "cd frontend && npm run build (grep for 'cancelJustification' in Requests.vue)"
        status: pass
    human_judgment: false

# Metrics
duration: 35min
completed: 2026-09-25
status: complete
---

# Phase 06 Plan 04: VOT-04 Cancellation After Approval Summary

**Implemented VOT-04 cancellation-after-approval per RN-010: cancelling an approved/provisioned request requires ADMINISTRADOR/CHEFE_DEPARTAMENTO + mandatory justification, writes audited compensating REVERSE financial transaction that restores FundBalance, with full audit trail in both FinancialTransaction.metadata and AuditEvent.afterData.**

## Performance

- **Duration:** 35 min
- **Started:** 2026-09-25T00:52:00Z
- **Completed:** 2026-09-25T01:27:06Z
- **Tasks:** 3
- **Files modified:** 3

## Accomplishments

- **Backend characterization tests (11 tests)** encode correct VOT-04 behavior: admin/chefe can cancel approved requests with justification, non-admin/chefe get 403, missing/empty justification returns 400, ordinary cancel (RASCUNHO/SUBMETIDO) by owner succeeds without financial reversal
- **requestController.cancel implementation** with inline reversal logic: validates justification, enforces admin/chefe role for approved statuses, creates REVERSE FinancialTransaction with metadata.justification, restores FundBalance (availableCents++, provisionedCents--), creates AuditEvent with justification in afterData — all in single atomic transaction
- **Frontend cancel modal** with conditional justification textarea: shows warning for approved requests explaining admin/chefe requirement and financial reversal, disables confirm until justification non-empty, sends justification to API

## Task Commits

Each task was committed atomically:

1. **Task 1: VOT-04 Characterization tests** - `42835fc` (test)
2. **Task 2: Implement cancellation reversal in requestController** - `d7d817f` (feat)
3. **Task 3: Frontend cancel form with justification textarea** - `28b732f` (feat)

## Files Created/Modified

- `backend/tests/voting.test.js` - Extended with 11 VOT-04 characterization tests in "VOT-04: Cancellation after approval" describe block
- `backend/src/controllers/requestController.js` - Modified cancel function with inline reversal logic for approved statuses
- `frontend/src/views/Requests.vue` - Added cancel button for non-terminal requests, modal with justification textarea and role-aware warning for approved requests

## Decisions Made

- **Inline reversal in same transaction**: Rather than calling financeController.reverseProvision separately, the reversal logic is inlined in requestController.cancel to keep FundBalance reversal, REVERSE transaction creation, AuditEvent, and status update atomic.
- **Mandatory justification for ALL cancellations**: Per RN-010, justification is required even for non-approved requests (RASCUNHO, EM_VOTACAO, SUBMETIDO) — the backend validates this upfront before any role/status checks.
- **Approved statuses require admin/chefe + reversal**: APROVADO, APROVADO_AUTOMATICAMENTE, APROVADO_PARCIALMENTE all trigger the VOT-04 reversal path. CONCLUIDO/CANCELADO are already immutable per RN-010.
- **Non-approved statuses use Phase 4 ownership**: RASCUNHO, EM_VOTACAO, SUBMETIDO can be cancelled by owner (requester) per Phase 4 permission map — ADMIN/CHEFE can also cancel these without reversal.
- **Frontend UX**: Warning banner only shown for approved statuses; justification always required; confirm button disabled until non-empty.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] Fixed AuditEvent beforeData/afterData JSON string requirement**
- **Found during:** Task 2 (backend implementation)
- **Issue:** AuditEvent model defines beforeData/afterData as String fields (JSON), but implementation passed objects directly causing Prisma validation error
- **Fix:** Added JSON.stringify() to beforeData and afterData in tx.auditEvent.create()
- **Files modified:** backend/src/controllers/requestController.js
- **Verification:** All 11 VOT-04 tests pass, full backend suite (123 tests) passes
- **Committed in:** d7d817f (Task 2 commit)

**2. [Rule 3 - Blocking] Fixed test mock request missing req.get() for user-agent**
- **Found during:** Task 1 test execution (RED phase verification)
- **Issue:** Controller uses req.get('user-agent') for auditEvent.userAgent, but test mock didn't provide get() method
- **Fix:** Added get() method to createMockReq helper in tests
- **Files modified:** backend/tests/voting.test.js
- **Verification:** All 11 VOT-04 tests pass
- **Committed in:** 42835fc (Task 1 commit)

---

**Total deviations:** 2 auto-fixed (1 missing critical, 1 blocking)
**Impact on plan:** Both auto-fixes essential for correctness. No scope creep.

## Issues Encountered

- Test database cleanup: VOT-04 test suite uses upsert for users and cleans by title prefix to avoid foreign key conflicts from prior test runs
- Prisma AuditEvent model expects String for beforeData/afterData — required JSON.stringify in controller
- Frontend needed no new components — extended existing Requests.vue with modal pattern consistent with arbitration panel

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- VOT-04 complete: cancellation after approval with justification, financial reversal, and audit trail fully implemented and tested
- All VOT-01 through VOT-04 tests pass (123 total backend tests)
- Frontend build passes
- Ready for Phase 06 Plan 05 (GA-VOT-05: TOCTOU race guard for all 5 balance-mutation sites)

---

*Phase: 06-voting-money-state-machine*
*Completed: 2026-09-25*