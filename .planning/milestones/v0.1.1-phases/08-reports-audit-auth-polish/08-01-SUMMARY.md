---
phase: 08-reports-audit-auth-polish
plan: 01
subsystem: reports
tags: [REP-01, audit, reports, fail-open]
dependencies:
  requires: []
  provides: [audit-before-stream]
  affects: [routes/reports.routes.js]
tech_stack:
  added: []
  patterns: [audit-before-stream, fail-open, entityId <report>-<format>]
key_files:
  created: []
  modified:
    - backend/src/routes/reports.routes.js
decisions:
  - "Audit report_exported before any format branch in all 7 report handlers, fail-open via .catch(logger.warn)"
  - "EntityId pattern <report>-<format> e.g. requests-csv, dashboard-json"
  - "Added logger import for warn on audit failure"
metrics:
  duration_minutes: 10
  completed_date: "2026-09-25"
  tasks_completed: 2
  files_modified: 1
  tests_added: 0
  total_tests: 131
status: complete
actuals:
  tokens: 18000
  tasks: 2
  commits: 1
  plan_head_before: 07-VERIFICATION
---

# Phase 08 Plan 01: Audit-Before-Stream Summary

## One-liner
Moved audit(report_exported) to top of every report handler (requests, financial, voting, accountability, integration, dashboard, dashboard-pdf) before any CSV/PDF/JSON branch, fail-open (catch and warn) so audit DB outage never blocks export.

## Changes Made
- Modified backend/src/routes/reports.routes.js: added logger import and audit call at top of each handler before scopeFilter/take or header/pipe
- Handlers: requests, financial, voting, accountability, integration, dashboard (GET), dashboard-pdf (POST) — all 7 now audit with entityId `${report}-${format}`
- PDF branches no longer audit after pipe — audit is before
- Fail-open: .catch(e => logger.warn(...)) ensures stream proceeds

## Verification Results
| Task | Verification Command | Result |
|------|---------------------|--------|
| Task 1 | grep -n report_exported src/routes/reports.routes.js | wc -l >=7 (now 7) | ✅ |
| Task 2 | npx vitest run | ✅ 131 tests (no regression) |

## Deviations
None — plan executed exactly as written.

## Self-Check
- ✅ Every handler audits before branch
- ✅ Fail-open
- ✅ EntityId includes format
- ✅ No new packages
