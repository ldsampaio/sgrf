---
phase: 07-background-jobs
plan: 01
subsystem: jobs
tags: [JOB-02, scheduler, votingCloser, tracer, server]
dependencies:
  requires: []
  provides: [scheduler-foundation, votingCloser-fixed]
  affects: [jobs/scheduler.js, jobs/votingCloser.js, server.js]
tech_stack:
  added: []
  patterns: [setInterval, boolean-guard, SIGTERM-cleanup, server-only-wiring]
key_files:
  created:
    - backend/src/jobs/scheduler.js
  modified:
    - backend/src/jobs/votingCloser.js
    - backend/src/server.js
decisions:
  - "Fixed votingCloser.js broken requires ./ → ../ (db, logger, votingService)"
  - "Created jobs/scheduler.js with plain setInterval, per-job boolean guards, clearInterval on SIGTERM"
  - "Scheduler wired ONLY from server.js; app.js never imports scheduler — zero timer leak"
  - "Scheduler does NOT auto-start on import; intervals only inside startScheduler()"
  - "Timers unref'd to allow process exit in tests that import scheduler directly"
metrics:
  duration_minutes: 12
  completed_date: "2026-09-25"
  tasks_completed: 3
  files_modified: 3
  tests_added: 0
  total_tests: 131
status: complete
actuals:
  tokens: 22000
  tasks: 3
  commits: 1
  plan_head_before: 07-CONTEXT
---

# Phase 07 Plan 01: Scheduler Foundation Summary

## One-liner
Fixed votingCloser.js broken imports and created the single-process scheduler harness (plain setInterval, per-job guards, SIGTERM cleanup) wired only from server.js — the tracer for both background jobs.

## Changes Made

### 1. Fixed votingCloser.js Broken Requires
- Changed `require('./config/db')` → `require('../config/db')`
- Changed `require('./config/logger')` → `require('../config/logger')`
- Changed `require('./services/votingService')` → `require('../services/votingService')`
- Verified existing {needsArbitration} handling (Phase 6) remains — logs and continues

### 2. Created jobs/scheduler.js
New file with:
- Module-scoped timers: `emailTimer, votingTimer` and guards `emailRunning, votingRunning`
- `tickEmail()` / `tickVoting()` with if(running) return guard and try/finally
- `startScheduler()` creates intervals (60s email, 300s voting), registers process.once('SIGTERM', stopScheduler), does warn-only transporter.verify if SMTP enabled, unrefs timers
- `stopScheduler()` clears both intervals, nulls timers, removes SIGTERM listener
- Exports: {startScheduler, stopScheduler, tickEmail, tickVoting}
- Zero new dependencies — plain setInterval per ARCHITECTURE.md Decision

### 3. Wired server.js (Only Place)
- Added `const { startScheduler } = require('./jobs/scheduler');` and `startScheduler()` inside listen callback
- Verified app.js has zero scheduler references (explicitly forbidden)

## Verification Results

| Task | Verification Command | Result |
|------|---------------------|--------|
| Task 1 | `cd backend && node -e "require('./src/jobs/votingCloser.js'); require('./src/jobs/scheduler.js'); console.log('imports ok')"` | ✅ imports ok (requires fixed, no auto-start) |
| Task 2 | `cd backend && npx vitest run` | ✅ 131 tests pass (zero open handles) |
| Task 2 | `grep -rn "scheduler" src/app.js | wc -l` | ✅ 0 |
| Task 3 | `cd backend && npx vitest run voting.test.js` | ✅ Phase 6 tests still green |

## Deviations from Plan
None — plan executed exactly as written. Placeholder verify inside scheduler is warn-only and will be hardened in 07-04 (adds getTransporter export if needed).

## Security Notes
- T-07-01/02/03/04 mitigated: boolean per-job guard, fixed requires, server.js-only wiring, SIGTERM cleanup
- No new packages

## Known Stubs
- tickEmail currently calls processQueue (real logic will be hardened with dual-signal in 07-03)
- tickVoting currently calls closeExpired (already handles arbitration)

## Threat Flags
None — no new security surface beyond planned scheduler harness.

## Self-Check
- ✅ votingCloser.js requires fixed
- ✅ scheduler.js exists with correct exports and no auto-start
- ✅ server.js wires scheduler, app.js clean
- ✅ npx vitest run passes, zero timer leak
- ✅ voting.test.js still passes

## Next Steps
Phase 07 Plan 02 (JOB-02 voting auto-close) can proceed — relies on this harness.
