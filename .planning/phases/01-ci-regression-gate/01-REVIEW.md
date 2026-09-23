---
phase: 01-ci-regression-gate
reviewed: 2026-09-23T21:00:00Z
depth: standard
files_reviewed: 3
files_reviewed_list:
  - .github/workflows/ci.yml
  - AGENTS.md
  - backend/tests/unit.test.js
findings:
  critical: 0
  warning: 0
  info: 3
  total: 3
status: clean
---

# Phase 01: Code Review Report

**Reviewed:** 2026-09-23T21:00:00Z
**Depth:** standard
**Files Reviewed:** 3
**Status:** clean

## Summary

Reviewed the full Phase 1 scope: the created CI workflow (`.github/workflows/ci.yml`,
39 lines), the `AGENTS.md` regression-gate note, and the red-proof target
(`backend/tests/unit.test.js`, expected to end unchanged). Every verifiable claim in
the three plan SUMMARies was re-checked against live evidence instead of trusted:
`gh run view 35914504197` confirms `backend: success` + `frontend: success` on the
post-merge main SHA, `git diff 40a72a6~1 HEAD -- backend/tests/unit.test.js` is empty,
`grep WRONG` finds nothing, and `grep -c '${{ }}'` on the workflow returns 0.
No skills directories (`.claude/skills/`, `.agents/skills/`) exist, so no
project-specific skill rules applied beyond `AGENTS.md` itself.

No Critical or Warning findings. The workflow is minimal and correct, the docs note
is factually accurate (test suites `batch`/`unit`/`voting` exist, frontend
`npm test` exits 1 by design, job names match the enforced required contexts), and
the temporary break was fully reverted. Three Info-level robustness nits below.

## Info

### IN-01: CI jobs declare no `timeout-minutes`

**File:** `.github/workflows/ci.yml:7-24`
**Issue:** Neither the `backend` nor the `frontend` job sets `timeout-minutes`, so a
stuck runner (hung `npm ci`, wedged Vitest worker) burns the GitHub default 6-hour
timeout and delays the gate signal the whole phase was built to provide.
**Fix:** Add a tight budget to each job, e.g.
```yaml
jobs:
  backend:
    runs-on: ubuntu-latest
    timeout-minutes: 10
```

### IN-02: No `concurrency` cancellation for rapid pushes

**File:** `.github/workflows/ci.yml:3`
**Issue:** With `on: [push, pull_request]` and no `concurrency` group, rapid successive
pushes queue fully redundant runs. Superseded runs still consume minutes and can
report stale red/green out of order on a PR.
**Fix:**
```yaml
concurrency:
  group: ci-${{ github.ref }}
  cancel-in-progress: true
```
(Note: this introduces the workflow's first `${{ }}` interpolation — confined to the
`concurrency` key, not a `run:` step, so it adds no script-injection surface.)

### IN-03: CI pins Node 22 but no `engines` field anchors local dev

**File:** `.github/workflows/ci.yml:19,35` (context: `backend/package.json`, `frontend/package.json`)
**Issue:** The gate runs Node 22 while neither package declares an `engines` range and
the local toolchain here is Node v26. Version-specific behavior (e.g. Vitest/Vite
quirks) can therefore pass locally and fail at the gate, or vice versa — the exact
blind spot a regression gate should not have.
**Fix:** Declare the contract in both packages, e.g.
```json
"engines": { "node": "22" }
```
(or `"node": ">=22"` if the project formally supports newer), and optionally align
local dev via `.nvmrc`.

---

_Reviewed: 2026-09-23T21:00:00Z_
_Reviewer: the agent (gsd-code-reviewer)_
_Depth: standard_
