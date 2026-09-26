---
phase: 09-release-close-contract-fixtures
plan: "01"
subsystem: infra
tags: [node-test, esm, cli, release-close, fixtures, safe-02]

# Dependency graph
requires: []
provides:
  - Zero-dependency ESM tool island at tools/release-close/ (package manifest, client seam, fake client, pure eligibility, CLI entry, reference fixture, proof suite)
  - checkTagEligibility(client, { version, expectedSha }) pure contract with two-hop peel and strict SHA equality
  - verify CLI path with text-default plus --json output carrying mutations: 0
affects: [09-02 fake expansion, 09-03 plan/apply path, phase-10 gh-client, phase-11 reconciliation]

# Actuals (#2632) — pairs with the plan's `estimate` to calibrate future estimates.
actuals:
  tokens: 5228
  tasks: 3
  commits: 3

# Tech tracking
tech-stack:
  added: []
  patterns: [injected-async-client-seam, return-data-not-throw, mutations-counter, node-test-pt-br-names]

key-files:
  created:
    - tools/release-close/package.json
    - tools/release-close/client.js
    - tools/release-close/fake-client.js
    - tools/release-close/eligibility.js
    - tools/release-close/release-close.js
    - tools/release-close/fixtures/reference.json
    - tools/release-close/eligibility.test.js
  modified: []

key-decisions:
  - "Eligibility codes: MISSING (absent/unexpected shape), LIGHTWEIGHT (single-hop commit ref), SAFE-02 (main-head or expected-SHA divergence), ELIGIBLE (peel == main == expected)"
  - "CLI exit codes: 0 eligible/help, 1 ineligible/refusal/invalid-input, 2 usage error"
  - "Double-run idempotency and log-isolation probes use real CLI spawn (execFileSync) and two independent fakes respectively"

patterns-established:
  - "Injected async client seam: pure functions take a client object returning { ok, status, data }; fakes serve snapshots, Phase 10 swaps in gh without touching pure logic"
  - "Return-data-not-throw: domain mismatches return { eligible, code, reason, writeAction: null }; throw is TypeError-only for invalid inputs"
  - "Executable no-mutation proof: every verify output carries mutations: 0; fake exposes empty writes array plus mutations getter"

requirements-completed: [OPS-01, SAFE-02]

coverage:
  - id: D1
    description: "Package seam plus pure eligibility plus reference fixture (tracer core)"
    requirement: "SAFE-02"
    verification:
      - kind: unit
        ref: "tools/release-close/eligibility.test.js#aceita tag anotada quando peel == main == SHA esperado"
        status: pass
      - kind: unit
        ref: "tools/release-close/eligibility.test.js#rejeita SHA esperado divergente"
        status: pass
    human_judgment: false
  - id: D2
    description: "CLI skeleton with verify path, help, and plan/apply refusals"
    requirement: "OPS-01"
    verification:
      - kind: unit
        ref: "node tools/release-close/release-close.js verify --help documents verify/plan/apply with exit 0"
        status: pass
      - kind: unit
        ref: "node tools/release-close/release-close.js verify --json | grep -c mutations returns 1"
        status: pass
    human_judgment: false
  - id: D3
    description: "Tracer proof suite green with mutations: 0 on every verify output"
    requirement: "OPS-01"
    verification:
      - kind: unit
        ref: "node --test "tools/release-close/*.test.js" — 12 tests, 12 pass, 0 fail"
        status: pass
    human_judgment: false

# Metrics
duration: 12min
completed: 2026-09-25
status: complete
---

# Phase 09 Plan 01: Tracer Slice Summary

**Zero-dependency ESM release-close tracer: pure tag-eligibility contract with two-hop peel, injected fake-client seam, frozen v0.1.1 reference fixture, verify-only CLI with mutations: 0, and a 12-case node:test proof suite**

## Performance

- **Duration:** 12 min
- **Started:** 2026-09-25T14:21:15Z
- **Completed:** 2026-09-25T14:33:00Z
- **Tasks:** 3
- **Files modified:** 7

## Accomplishments

- Tracer core: package manifest (type module, zero deps/scripts), 5-read client interface with shape assertion, programmable fake client with call log plus empty writes trap, pure checkTagEligibility with strict two-hop peel and full-40-hex equality
- CLI skeleton: hand-rolled argv over verify/plan/apply, verify serves the reference fixture through the fake and prints PT-BR text plus mutations: 0 (or JSON with mutations field), plan/apply refuse as not-yet-wired naming plan 09-03
- Proof suite: 12 node:test cases in PT-BR covering happy path, lightweight/divergence/absence rejects, TypeError on invalid inputs, T-09-01 metachar probe, zero-write proof, read ordering, double-run idempotency, and fake log isolation — all green with no network and no database

## Task Commits

Each task was committed atomically:

1. **Task 1: Tracer: package seam plus pure eligibility plus reference fixture** - `f5493a9` (feat)
2. **Task 2: CLI skeleton with verify path and help** - `14a1a9b` (feat)
3. **Task 3: Tracer proof suite in node:test with PT-BR names** - `0bde390` (test)

## Files Created/Modified

- `tools/release-close/package.json` - ESM manifest: name release-close, private, type module, no deps/scripts keys
- `tools/release-close/client.js` - Five read-method interface docs (getTagRef, getTagObject, getBranchHead, getReleaseByTag, listMilestones) plus assertClientShape
- `tools/release-close/fake-client.js` - makeFakeClient(snapshot): snapshot reads, { seq, method, args } call log, empty writes array, mutations getter
- `tools/release-close/eligibility.js` - checkTagEligibility(client, { version, expectedSha }): vX.Y.Z plus 40-hex validation (TypeError PT-BR), two-hop peel, strict equality, { eligible, code, reason, writeAction: null } on every path
- `tools/release-close/release-close.js` - CLI entry: verify live, plan/apply refusals, PT-BR usage, exit 0/1/2 contract
- `tools/release-close/fixtures/reference.json` - Canonical v0.1.1 baseline verbatim: tag object 0a68d6f0c55e7be07d13a0bbc4ed36d4af772630, commit 10c62ac85fd3ab275b8926c89f5f34ba4116e2cf, release absent, milestones empty, frozen timestamp, runs 36095855139/36095872529
- `tools/release-close/eligibility.test.js` - 12-case node:test suite, PT-BR names

## Decisions Made

- Eligibility code vocabulary fixed as MISSING / LIGHTWEIGHT / SAFE-02 / ELIGIBLE (EN codes, PT-BR reasons), grounding the SAFE-02 divergence family the acceptance criteria require
- CLI exit contract 0/1/2 (eligible-or-help / ineligible-or-refusal-or-invalid-input / usage-error) so scripts and the later runbook can branch deterministically
- Double-run idempotency probe spawns the real CLI twice via execFileSync and compares stdout byte-for-byte, proving re-running verify is safe rather than only asserting pure-function purity

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None. The scoped `node --test "tools/release-close/*.test.js"` run stays green (12/12) and never sweeps the backend vitest suites; backend and frontend trees are untouched.

## User Setup Required

None - no external service configuration required. Zero dependencies, no network, no database.

## Next Phase Readiness

- Ready for 09-02 (fake expansion: scripted sequences over missing/partial/duplicate/conflicting/failed/concurrent states) and 09-03 (plan display plus apply double-lock) — both consume the client seam, fixture layout, and mutations proof established here
- Watch item: `gh-client.js` stays omitted per plan scope; Phase 10 wires the real gh-backed client against the unchanged `READ_METHODS` shape

## Self-Check: PASSED

- All 7 created files FOUND on disk
- All 3 task commits FOUND (f5493a9, 14a1a9b, 0bde390)
- `node --test "tools/release-close/*.test.js"`: 12 pass, 0 fail
- `verify --help` documents verify/plan/apply; `--bogus-flag` exits non-zero with usage on stderr
- No `require(`, `child_process`, token env reads, or verbose flags in tool sources
- backend/ and frontend/ trees untouched

---
*Phase: 09-release-close-contract-fixtures*
*Completed: 2026-09-25*
