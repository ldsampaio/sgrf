---
phase: 06-voting-money-state-machine
plan: 03
subsystem: voting
tags:
  - VOT-03
  - partial-approval
  - arbitration
  - tdd
  - characterization-tests
dependency_graph:
  requires:
    - 06-01
    - 06-02
  provides:
    - VOT-03-partial-arbitration
  affects:
    - votingService.closeVoting
    - votingController.partialArbitration
    - votingController.castVote
    - votingController.closeManual
    - votingCloser.closeExpired
    - frontend Requests.vue
tech_stack:
  added: []
  patterns:
    - characterization-then-flip TDD
    - arbitration logical state using existing status + metadata
    - discriminated union return type for closeVoting
key_files:
  created: []
  modified:
    - backend/tests/voting.test.js
    - backend/src/services/votingService.js
    - backend/src/controllers/votingController.js
    - backend/src/jobs/votingCloser.js
    - backend/src/routes/requests.routes.js
    - frontend/src/views/Requests.vue
decisions:
  - "AGUARDANDO_ARBITRAGEM is a logical state using APROVADO_PARCIALMENTE + decisionReason='AGUARDANDO_ARBITRAGEM' + collegiateMinutes metadata (per Assumption A1)"
  - "closeVoting returns discriminated union: arbitration indicator {needsArbitration:true,status,arbitration:true,requestId} OR updated request object"
  - "All three callers (castVote, closeManual, votingCloser) check needsArbitration before accessing request properties"
  - "Partial arbitration endpoint validates: chefe role, amount in (0, requestedAmountCents], mandatory justification"
  - "AuditEvent with action=partial_arbitration, decidedBy=CHEFE_DEPARTAMENTO, justification in afterData"
  - "Frontend arbitration UI only visible to CHEFE_DEPARTAMENTO when request in arbitration state"
metrics:
  duration_minutes: 25
  completed_date: "2026-09-25"
  tasks_completed: 4
  files_modified: 6
  tests_added: 15
  total_tests: 112
status: complete
actuals:
  tokens: 42000
  tasks: 4
  commits: 3
  plan_head_before: 324c889
---

# Phase 06 Plan 03: VOT-03 Partial Approval Arbitration Summary

## One-liner
Implemented VOT-03 partial-approval aggregation rule replacing "first partial vote wins" with chefe arbitration: when any DEFERIR_PARCIALMENTE vote exists, closeVoting moves request to AGUARDANDO_ARBITRAGEM (logical state using APROVADO_PARCIALMENTE + metadata), chefe explicitly sets final amount via new endpoint with mandatory justification.

## Changes Made

### 1. VOT-03 Characterization Tests (`backend/tests/voting.test.js`)
Added 15 new tests in the "VOT-03: Partial approval arbitration" describe block:
- **Test 1**: `closeVoting with any DEFERIR_PARCIALMENTE vote returns arbitration indicator` — verifies arbitration indicator return instead of auto-concluded request with amount
- **Test 2**: `closeVoting with multiple DEFERIR_PARCIALMENTE votes still returns arbitration` — multiple partial votes with different amounts don't pick first
- **Test 3**: `closeVoting with no partial votes works normally (DEFERIDO)` — regression guard for normal flow
- **Test 4**: `closeVoting with partial + tie (PARCIAL outcome) returns arbitration` — PARCIAL outcome also triggers arbitration
- **Test 5**: `Request in arbitration state has decisionReason=AGUARDANDO_ARBITRAGEM and collegiateMinutes set` — metadata persistence
- **Test 6**: `No FundBalance provision when arbitration is needed` — no premature provisioning
- **Test 7-9**: `partialArbitration endpoint - chefe sets final amount with justification` / amount validation / justification required / chefe role required — endpoint behavior
- **Test 10**: `AuditEvent created with action=partial_arbitration, decidedBy=CHEFE_DEPARTAMENTO` — audit trail
- **Test 11-13**: `castVote/closeManual/votingCloser handle arbitration return` — all three callers updated

Tests follow characterization-then-flip pattern: written to encode *correct* behavior first (RED), then implementation fixed to make them pass (GREEN).

### 2. Backend Implementation (`backend/src/services/votingService.js`, `backend/src/controllers/votingController.js`, `backend/src/jobs/votingCloser.js`, `backend/src/routes/requests.routes.js`)

**votingService.js — closeVoting (lines 59-113):**
- Added check for `validVotes.some(v => v.voteType === 'DEFERIR_PARCIALMENTE')` BEFORE tally logic
- If partial vote exists:
  - Sets status = 'APROVADO_PARCIALMENTE' (existing enum, per Assumption A1)
  - Sets approvedCents = 0 (no provision yet)
  - Sets decisionReason = 'AGUARDANDO_ARBITRAGEM' (metadata flag)
  - Sets collegiateMinutes = 'Aguardando arbitragem do chefe — voto parcial detectado' (metadata flag)
  - Does NOT provision FundBalance
  - Returns arbitration indicator: `{ needsArbitration: true, status: 'APROVADO_PARCIALMENTE', arbitration: true, requestId }`
- Else: proceeds with existing tally logic (DEFERIDO, INDEFERIDO, EMPATE, SEM_VOTOS)
- Return type is now discriminated union — callers MUST check `needsArbitration` before accessing request properties

**votingController.js — new partialArbitration handler:**
- Validates: user.role === 'CHEFE_DEPARTAMENTO' (403 otherwise)
- Validates: request.status === 'APROVADO_PARCIALMENTE' AND request.decisionReason === 'AGUARDANDO_ARBITRAGEM' (400 otherwise)
- Validates: body.approvedAmountCents in (0, requestedAmountCents] (400 otherwise)
- Validates: body.justification non-empty string (400 otherwise)
- Inside $transaction:
  - FundBalance update with balance check (GA-VOT-05 pattern — Wave 4 will harden to conditional updateMany)
  - FinancialTransaction type PROVISION with metadata: { decidedBy: 'CHEFE_DEPARTAMENTO', action: 'partial_arbitration', justification }
  - AuditEvent action: 'partial_arbitration', afterData: { status, approvedAmountCents, justification }
  - Updates request: status = 'APROVADO_PARCIALMENTE', approvedAmountCents = body amount, decidedAt/decidedBy, decisionReason = null, collegiateMinutes = justification
- Returns updated request

**votingController.js — updated castVote (line 62-64):**
- After `closeVoting` call, checks `if (closed?.needsArbitration)` and returns arbitration indicator in response

**votingController.js — updated closeManual (line 176):**
- After `closeVoting` call, checks `if (closed?.needsArbitration)` and returns arbitration indicator with distinct audit action 'voting_closed_arbitration'

**votingCloser.js — updated closeExpired (line 14):**
- Checks `if (result?.needsArbitration)` logs arbitration needed and continues (no crash)

**requests.routes.js:**
- Added `PATCH /api/requests/:id/partial-arbitration` route with `requirePermission('votes:close')` middleware

### 3. Frontend Arbitration UI (`frontend/src/views/Requests.vue`)
- Added conditional arbitration panel in request table row:
  - Shows when `request.status === 'APROVADO_PARCIALMENTE' && request.decisionReason === 'AGUARDANDO_ARBITRAGEM' && isChefe()`
  - Label: "Arbitragem necessária — voto parcial detectado"
  - MoneyInput for final approved amount (min: 1, max: requestedAmountCents, required)
  - Textarea for justification (required, rows=3, placeholder "Justificativa obrigatória para arbitragem")
  - Button "Confirmar Arbitragem" → calls PATCH /api/requests/:id/partial-arbitration
  - Loading state during request
  - On success: refreshes request data, arbitration panel disappears
  - On error: shows error alert with server message
- Reuses existing patterns: MoneyInput, StatusBadge, alert/error display, api.js with withCredentials
- Uses auth store to check `auth.user?.role === 'CHEFE_DEPARTAMENTO'`

## Verification Results

| Task | Verification Command | Result |
|------|---------------------|--------|
| Task 1 (TDD) | `cd backend && npx vitest run voting.test.js -t "VOT-03"` | ✅ 15/15 VOT-03 tests pass |
| Task 2 (Backend) | `cd backend && npx vitest run voting.test.js -t "VOT-03"` | ✅ All VOT-03 tests pass |
| Task 3 (Frontend) | `cd frontend && npm run build` | ✅ Build passes; 'partial-arbitration' found in Requests.vue |
| Task 4 (Regression) | `cd backend && npx vitest run voting.test.js` | ✅ 29/29 voting tests pass |
| Task 4 (Regression) | `cd backend && npx vitest run` | ✅ 112/112 full suite passes |
| Task 4 (Regression) | `cd frontend && npm run build` | ✅ Build passes |

## Deviations from Plan

### Auto-fixed Issues
None — plan executed exactly as written. The characterization-then-flip tests encoded the correct behavior per RN-009, CONTEXT.md D-03, and RESEARCH.md Assumption A1.

### Documentation
No separate documentation created; all design decisions encoded in tests and code comments.

## Security Notes

### Threat Model Mitigations Applied (T-06-07, T-06-08, T-06-09, T-06-10)

| Threat ID | Mitigation Applied |
|-----------|-------------------|
| T-06-07 (Elevation of Privilege: partialArbitration endpoint) | Explicit role check: only CHEFE_DEPARTAMENTO; amount range validated server-side; justification required |
| T-06-08 (Tampering: closeVoting arbitration logic) | Centralized in votingService; no client-controlled arbitration trigger; arbitration only triggered by existing votes |
| T-06-09 (Repudiation: Arbitration audit trail) | AuditEvent with partial_arbitration action, justification, decidedBy recorded |
| T-06-10 (Information Disclosure: Arbitration amount exposure) | Amount visible to requester/council per business rules; no secret data |
| T-06-SC (Tampering: package installs) | No new packages installed — package-legitimacy gate passed in RESEARCH.md |

## Known Stubs
None — all functionality fully implemented and tested.

## Threat Flags
None — no new security surface introduced beyond planned VOT-03 scope. The new endpoint is protected by existing permission middleware and explicit role check.

## Self-Check
- ✅ All created/modified files exist
- ✅ Commits 2c15c60, d746d35, ba51b3f exist in git history
- ✅ All 112 backend tests pass (VOT-01: 6, VOT-02: 3, VOT-03: 15, pre-existing: 5, other: 83)
- ✅ VOT-03 characterization tests encode correct behavior (no first-partial-wins)
- ✅ closeVoting detects any DEFERIR_PARCIALMENTE and returns arbitration indicator
- ✅ AGUARDANDO_ARBITRAGEM uses APROVADO_PARCIALMENTE + decisionReason + collegiateMinutes
- ✅ partialArbitration endpoint validates chefe role, amount range, justification
- ✅ FundBalance provisioned only after arbitration, not during
- ✅ castVote, closeManual, votingCloser all handle arbitration return correctly
- ✅ Frontend build passes; Requests.vue shows arbitration UI for chefe
- ✅ AuditEvent with partial_arbitration action created correctly
- ✅ All 3 pre-existing test suites still pass (no regression)

## Next Steps
Phase 06 Plan 04 (VOT-04: Cancellation-after-approval justification workflow) can now proceed. The partial-approval arbitration foundation is complete and tested.