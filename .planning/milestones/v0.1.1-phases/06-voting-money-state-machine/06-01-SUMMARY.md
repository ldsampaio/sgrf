---
phase: 06-voting-money-state-machine
plan: 01
subsystem: voting
tags: [VOT-01, tie-break, state-machine, characterization-tests]
dependencies:
  requires: []
  provides: [VOT-01-tie-break-convergence]
  affects: [votingController.changeMyVote, votingService.canVote, votingService.closeVoting]
tech_stack:
  added: []
  patterns: [characterization-then-flip, state-machine-guard-extension, conditional-closeVoting]
key_files:
  created: []
  modified:
    - backend/tests/voting.test.js
    - backend/src/controllers/votingController.js
decisions:
  - "Chefe can change vote during AGUARDANDO_DESEMPATE to break tie (VOT-01)"
  - "Only CHEFE_DEPARTAMENTO eligible in AGUARDANDO_DESEMPATE (prevents double-vote)"
  - "changeMyVote auto-closes voting after tie-break vote change"
  - "Existing canVote logic for AGUARDANDO_DESEMPATE was already correct"
  - "No other status guards need adjustment for VOT-01 (documented in code)"
metrics:
  duration_minutes: 15
  completed_date: "2026-09-25"
  tasks_completed: 3
  files_modified: 2
  tests_added: 6
  total_tests: 11
status: complete
actuals:
  tokens: 18000
  tasks: 3
  commits: 1
  plan_head_before: 10b76d86eeb0e70e688203cdb4fd793ef63702c7
---

# Phase 06 Plan 01: VOT-01 Tie-break Convergence Summary

## One-liner
JWT auth with refresh rotation using jose library - VOT-01 tie-break convergence: allow chefe to change vote during AGUARDANDO_DESEMPATE so tied requests always reach a terminal status (APROVADO or INDEFERIDO).

## Changes Made

### 1. VOT-01 Characterization Tests (`backend/tests/voting.test.js`)
Added 6 new tests in the "VOT-01: Tie-break convergence" and "VOT-01: changeMyVote guard extension" describe blocks:
- **allows chefe to change vote during AGUARDANDO_DESEMPATE** - verifies `canVote` returns ok for chefe in tie-break state
- **denies conselheiro from voting during AGUARDANDO_DESEMPATE** - verifies 403 for non-chefe roles
- **converges to INDEFERIDO after chefe changes vote to INDEFERIR in tie-break** - end-to-end flow from tie to terminal status
- **converges to APROVADO after chefe changes vote to DEFERIR in tie-break** - reverse scenario
- **prevents chefe from double-voting** - unique constraint on (requestId, voterId) blocks second vote
- **validates vote input for tie-break change** - ensures validateVoteInput works for all vote types

Tests follow characterization-then-flip pattern: written to encode *correct* behavior first, then implementation fixed to make them pass.

### 2. Controller Fix (`backend/src/controllers/votingController.js`)
**Modified `changeMyVote` function:**
- Extended status guard from `r.status !== 'EM_VOTACAO'` to allow `AGUARDANDO_DESEMPATE` for chefe
- Added eligibility check: `if (isTieBreak && req.user.role !== 'CHEFE_DEPARTAMENTO')` returns 403
- Deadline check skipped during tie-break (no votingDeadlineAt enforcement in AGUARDANDO_DESEMPATE)
- Vote update now sets `tieBreak: true` when in tie-break state
- Audit action changed to `'tiebreak_vote_change'` for tie-break modifications
- **Auto-closes voting immediately** after chefe tie-break vote change by calling `closeVoting(r.id, req.user.id)`
- Returns both updated vote and closed request in response

**Added grep audit documentation** as code comments near `changeMyVote` documenting all 10 `status ===` and 7 `status !==` guards related to voting states across the codebase, confirming no other guards need adjustment for VOT-01.

### 3. Service Layer (No Changes Needed)
`votingService.canVote` (lines 22-24) already had the correct check:
```javascript
if (request.status === 'AGUARDANDO_DESEMPATE' && user.role !== 'CHEFE_DEPARTAMENTO') {
  return { ok: false, code: 403, error: 'Aguardando desempate do chefe' };
}
```
`votingService.closeVoting` already handles `AGUARDANDO_DESEMPATE` status correctly (line 67).

## Verification Results

| Task | Verification Command | Result |
|------|---------------------|--------|
| Task 1 (Tracer) | `cd backend && npx vitest run voting.test.js -t "VOT-01"` | ✅ 6/6 VOT-01 tests pass |
| Task 2 (Grep Audit) | `cd backend && grep -rn "status ==" src/ \| grep -E "..." \| wc -l` | ✅ 10 guards found, all documented |
| Task 3 (Regression) | `cd backend && npx vitest run voting.test.js` | ✅ 11/11 tests pass (5 original + 6 new) |
| Full Suite | `cd backend && npx vitest run` | ✅ 94/94 tests pass across 6 test files |

## Deviations from Plan

### Auto-fixed Issues
None - plan executed exactly as written. The existing `canVote` logic was already correct per D-01/D-02 decisions.

### Documentation
Added grep audit results as inline code comments in `votingController.js` near `changeMyVote` per Task 2 requirement. No separate document created.

## Security Notes

**Threat Model Mitigations Applied (T-06-01, T-06-02):**
- Explicit role check in `changeMyVote`: only `CHEFE_DEPARTAMENTO` can change vote in `AGUARDANDO_DESEMPATE` (403 for others)
- Centralized eligibility logic in `votingService.canVote` prevents voting in invalid states
- Audit trail: `tiebreak_vote_change` action distinct from normal `vote_changed`
- No new packages installed - package-legitimacy gate passed in RESEARCH.md

## Known Stubs
None - all functionality fully implemented and tested.

## Threat Flags
None - no new security surface introduced beyond planned VOT-01 scope.

## Self-Check
- ✅ All created/modified files exist
- ✅ Commit 3e59c9a exists in git history
- ✅ All 94 backend tests pass
- ✅ VOT-01 characterization tests encode correct behavior
- ✅ changeMyVote allows chefe in AGUARDANDO_DESEMPATE only
- ✅ canVote enforces chefe-only eligibility in AGUARDANDO_DESEMPATE
- ✅ No request can remain stuck in AGUARDANDO_DESEMPATE (auto-close on tie-break vote)
- ✅ All 5 pre-existing tests still pass (now 11 total)
- ✅ Grep audit documented in code comments

## Next Steps
Phase 06 Plan 02 (VOT-02: Annual cap accounting with CONCLUIDO) can proceed. The tie-break convergence foundation is complete and tested.