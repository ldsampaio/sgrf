---
phase: 06-voting-money-state-machine
plan: 02
subsystem: backend
tags:
  - voting
  - annual-cap
  - financial-ledger
  - tdd
dependency_graph:
  requires:
    - 06-01
  provides:
    - VOT-02: CONCLUIDO included in annualTotalCents
  affects:
    - requestService.annualTotalCents
    - requestController.submit auto-approval check
tech_stack:
  added: []
  patterns:
    - characterization-then-flip TDD
    - Prisma conditional query
key_files:
  created: []
  modified:
    - backend/tests/voting.test.js
    - backend/src/services/requestService.js
decisions:
  - "Added CONCLUIDO to annualTotalCents status.in array to prevent cap bypass"
  - "Characterization-then-flip tests written first (RED), then fix applied (GREEN)"
  - "Default auto-approval limit is 100000 cents (1000 BRL) from departmentSettings"
metrics:
  duration_seconds: 420
  completed_date: "2026-09-24"
  tasks_completed: 2
  files_changed: 2
  tests_added: 3
  tests_passing: 97
status: complete
actuals:
  tokens: 18000
  tasks: 2
  commits: 2
  plan_head_before: "c68fb89"
---

# Phase 06 Plan 02: VOT-02 Annual Cap Accounting Summary

**One-liner:** Added CONCLUIDO to annualTotalCents statuses array to prevent annual cap bypass via mark-spent cycling, with characterization-then-flip tests proving the fix.

## Changes Made

### 1. VOT-02 Characterization Tests (backend/tests/voting.test.js)
Added 3 tests in a new `describe('VOT-02: Annual cap accounting (CONCLUIDO counts toward cap)')` block:
- **Test 1**: `annualTotalCents includes CONCLUIDO status in sum` — Creates requests in all 6 active statuses including CONCLUIDO, verifies sum includes all (600000 cents)
- **Test 2**: `Cycling spent → submit fails at cap` — Requester at limit with CONCLUIDO requests cannot auto-approve new requests
- **Test 3**: `Below limit still auto-approves correctly` — Requester below limit with CONCLUIDO requests can still auto-approve within remaining quota

Tests were written first (RED phase), confirming the bug: CONCLUIDO was excluded from the sum.

### 2. Fix annualTotalCents (backend/src/services/requestService.js)
Modified the Prisma query in `annualTotalCents` function (line 9) to add `'CONCLUIDO'` to the `status.in` array:
```javascript
// Before:
status: { in: ['SUBMETIDO', 'EM_VOTACAO', 'APROVADO', 'APROVADO_AUTOMATICAMENTE', 'APROVADO_PARCIALMENTE'] }
// After:
status: { in: ['SUBMETIDO', 'EM_VOTACAO', 'APROVADO', 'APROVADO_AUTOMATICAMENTE', 'APROVADO_PARCIALMENTE', 'CONCLUIDO'] }
```

This ensures spent requests continue counting toward the requester's annual cap, closing the bypass loophole.

## Verification Results

| Test | Status |
|------|--------|
| VOT-02: annualTotalCents includes CONCLUIDO status in sum | ✅ PASS |
| VOT-02: Cycling spent → submit fails at cap | ✅ PASS |
| VOT-02: Below limit still auto-approves correctly | ✅ PASS |
| All pre-existing VOT-01 tests | ✅ PASS (11 tests) |
| Full backend test suite | ✅ PASS (97 tests) |

## Deviation from Plan

**None** — Plan executed exactly as written.

## Threat Model Compliance

| Threat ID | Mitigation Applied |
|-----------|-------------------|
| T-06-04 (Tampering: annualTotalCents) | CONCLUIDO added to status.in array; query is server-only, no user input |
| T-06-05 (Elevation of Privilege: auto-approval) | Limit check uses corrected annualTotalCents; requester cannot influence status list |
| T-06-06 (Repudiation: audit trail) | Existing audit on request create covers this; no new action needed |
| T-06-SC (Tampering: package installs) | No new packages installed |

## Security Flags

None — no new attack surface introduced. The change only expands an existing server-side query's status filter.

## Known Stubs

None — all functionality fully implemented and tested.

## Commits

| Hash | Message |
|------|---------|
| 59a71d9 | test(06-02): add VOT-02 characterization tests for annual cap accounting |
| 038e4a9 | fix(06-02): add CONCLUIDO to annualTotalCents statuses array |

## Next Steps

Phase 06 Plan 03 (VOT-03: Partial-approval aggregation) can now proceed. The annual cap accounting fix is complete and verified.