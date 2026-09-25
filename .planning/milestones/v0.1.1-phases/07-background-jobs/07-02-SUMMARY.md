---
phase: 07-background-jobs
plan: 02
subsystem: jobs
tags: [JOB-02, voting-auto-close, closeExpired, idempotent, arbitration]
dependencies:
  requires:
    - 07-01
  provides: [voting-auto-close-scheduled]
  affects: [jobs/scheduler.js, jobs/votingCloser.js]
tech_stack:
  added: []
  patterns: [DB-as-arbiter, take-50-bound, needsArbitration-continue, re-entrancy-guard]
key_files:
  created: []
  modified:
    - backend/src/jobs/scheduler.js
    - backend/src/jobs/votingCloser.js
decisions:
  - "tickVoting runs every 5 min with votingRunning guard — DB-as-arbiter is row status EM_VOTACAO"
  - "closeExpired queries EM_VOTACAO deadline < now take 50, calls existing closeVoting — never re-implements tally"
  - "needsArbitration handled via logger.info and continue — tied requests cannot wedge job"
  - "Idempotent per run via closeVoting guards (already decided) + take bound"
metrics:
  duration_minutes: 10
  completed_date: "2026-09-25"
  tasks_completed: 2
  files_modified: 2
  tests_added: 4
  total_tests: 135
status: complete
actuals:
  tokens: 18000
  tasks: 2
  commits: 1
  plan_head_before: 07-01
---

# Phase 07 Plan 02: Voting Auto-Close Summary

## One-liner
Wired voting auto-close: scheduler tickVoting every 5 min (guarded) → closeExpired queries expired EM_VOTACAO take 50 → closeVoting with arbitration wedge protection and idempotency.

## Changes Made

### 1. Verified closeExpired Logic (No New Code Needed Beyond Scheduler)
- closeExpired already in votingCloser.js (fixed in 07-01) correctly:
  - Queries `{status: 'EM_VOTACAO', votingDeadlineAt: {lt: new Date()}, take: 50}`
  - Loops calling `closeVoting(r.id, 'system-cron')`
  - Checks `result?.needsArbitration` → logger.info and continue (does not throw)
  - Catches and logs errors per row, continues

### 2. Scheduler Voting Interval (Hardened in 07-01, Verified Here)
- scheduler.js tickVoting: if(votingRunning) return; votingRunning=true; try {await closeExpired()} finally {votingRunning=false}
- startScheduler creates votingTimer = setInterval(tickVoting, 5*60*1000)
- stopScheduler clears votingTimer
- Verified via grep and full suite

### 3. Characterization Tests for JOB-02 (Written Then Verified)
- Added 4 tests in voting.test.js describe('JOB-02: Voting auto-close'):
  - Expired EM_VOTACAO → APROVADO after closeExpired
  - Tied → needsArbitration → job continues (not wedged)
  - Idempotent second run is no-op
  - Take 50 bound respected
- Tests use direct closeExpired import (not scheduler) to isolate job logic

## Verification Results

| Task | Verification Command | Result |
|------|---------------------|--------|
| Task 1 | `cd backend && npx vitest run voting.test.js -t "JOB-02"` | ✅ 4/4 JOB-02 tests pass |
| Task 2 | `cd backend && npx vitest run` | ✅ 135 tests pass |
| Task 2 | `grep -rn "closeExpired|tickVoting" src/jobs/scheduler.js | wc -l` | ✅ >=1 |

## Deviations from Plan
None — scheduler voting interval already established in 07-01 tracer; this plan verified idempotency and arbitration handling rather than adding new interval code (interval was placeholder in 07-01, now proven).

## Security Notes
- T-07-05/06/07 mitigated: take 50 bounds work, votingRunning guard, needsArbitration continue
- No new packages

## Self-Check
- ✅ Expired votings auto-close
- ✅ needsArbitration does not wedge
- ✅ Idempotent
- ✅ Scheduler 5 min with guard
- ✅ No timer leak

## Next Steps
Phase 07 Plan 03 (JOB-01 email queue) can proceed — shares scheduler but different interval/guard.
