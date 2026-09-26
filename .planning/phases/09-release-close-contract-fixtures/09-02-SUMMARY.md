---
phase: 09-release-close-contract-fixtures
plan: "02"
subsystem: infra
tags: [node-test, esm, release-close, fixtures, classify, safe-02, ops-02]

# Dependency graph
requires:
  - 09-01 tracer (client seam, fake client, eligibility shape family, reference fixture)
provides:
  - Pure six-state classifySnapshot (MISSING/PARTIAL/DUPLICATE/CONFLICTING/FAILED/CONCURRENT) with PT-BR reasons and null writeAction
  - Six versioned JSON fixtures with frozen canonical values
  - Scripted fake-client failure plans with seq call log
  - Throwing gh-client seam stub naming Phase 10
  - Executable no-ref-write static proof (nowrite.test.js)
affects: [09-03 plan/apply display, phase-10 gh-client, phase-11 reconciliation]

# Actuals (#2632) — pairs with the plan's `estimate` to calibrate future estimates.
actuals:
  tokens: 5839
  tasks: 3
  commits: 3

# Tech tracking
tech-stack:
  added: []
  patterns: [pure-snapshot-classifier, scripted-failure-plan, fail-closed-stub, static-forbidden-surface-test]

key-files:
  created:
    - tools/release-close/classify.js
    - tools/release-close/fixtures/missing.json
    - tools/release-close/fixtures/partial.json
    - tools/release-close/fixtures/duplicate.json
    - tools/release-close/fixtures/conflicting.json
    - tools/release-close/fixtures/failed.json
    - tools/release-close/fixtures/concurrent.json
    - tools/release-close/gh-client.js
    - tools/release-close/classify.test.js
    - tools/release-close/nowrite.test.js
  modified:
    - tools/release-close/fake-client.js

key-decisions:
  - "Classification precedence FAILED > CONCURRENT > CONFLICTING > DUPLICATE > PARTIAL > MISSING makes classifySnapshot total over every valid-shape snapshot"
  - "Scripted outcomes limited to timeout, lost-response, status-409/422/429/5xx; unknown plan keys or outcomes throw TypeError"
  - "Forbidden surface pinned as camelCase routines plus whole-word HTTP verbs plus ref paths plus secret tokens, so calls.push and token argv parsing never false-positive"

patterns-established:
  - "Pure snapshot classifier: evidence object in, { eligible:false, code, reason, writeAction:null } out; throw is TypeError-only for non-record snapshots"
  - "Scripted failure plan: per-method outcome queues consumed in order, every call logged with seq, snapshot data resumes on exhaustion"
  - "Static forbidden-surface test: non-test sources scanned for write routines/paths/method verbs/secrets; fixtures scanned for credential shapes"

requirements-completed: [OPS-02, SAFE-02]

coverage:
  - id: D1
    description: "Pure six-state classifier plus six fixtures (expansion core)"
    requirement: "OPS-02"
    verification:
      - kind: unit
        ref: "tools/release-close/classify.test.js#classifica o fixture missing como MISSING com motivo PT-BR e sem ação de escrita"
        status: pass
      - kind: unit
        ref: "tools/release-close/classify.test.js#não importa o módulo de elegibilidade (contrato independente, D-09)"
        status: pass
    human_judgment: false
  - id: D2
    description: "Scripted fake sequences plus throwing gh stub"
    requirement: "OPS-02"
    verification:
      - kind: unit
        ref: "tools/release-close/classify.test.js#sequência roteirizada 409 depois 429 depois dado é observável no log de chamadas"
        status: pass
      - kind: unit
        ref: "tools/release-close/nowrite.test.js#o rascunho gh falha fechado em todos os métodos nomeando a Fase 10"
        status: pass
    human_judgment: false
  - id: D3
    description: "Six-state proof suite plus no-ref-write static test"
    requirement: "SAFE-02"
    verification:
      - kind: unit
        ref: "node --test "tools/release-close/*.test.js" — 32 tests, 32 pass, 0 fail"
        status: pass
      - kind: unit
        ref: "tools/release-close/nowrite.test.js#nenhuma fonte carrega verbo de método de escrita"
        status: pass
    human_judgment: false

# Metrics
duration: 15min
completed: 2026-09-25
status: complete
---

# Phase 09 Plan 02: Six-State Contract, Fixtures, and No-Write Proof Summary

**Deterministic six-state snapshot classifier with PT-BR reasons, six frozen fixtures, scripted fake failure sequences with ordered call logs, fail-closed gh seam stub, and an executable static proof that no ref-write path exists — 32/32 green under node --test.**

## Performance

- **Duration:** 15 min
- **Started:** 2026-09-25T14:35:00Z
- **Completed:** 2026-09-25T14:50:00Z
- **Tasks:** 3
- **Files modified:** 11 (10 created, 1 extended)

## Accomplishments

- Pure `classifySnapshot`: total precedence FAILED > CONCURRENT > CONFLICTING > DUPLICATE > PARTIAL > MISSING over plain evidence objects, `{ eligible:false, code, reason PT-BR, writeAction:null }` on every path, TypeError only for non-record snapshots, zero imports from the eligibility module
- Six fixtures frozen verbatim on the canonical tag object `0a68d6f…`, commit `10c62ac…`, runs `36095855139/36095872529`, and one shared `frozenAt` timestamp — each mapping one-to-one to its code
- Fake extended with optional per-method scripted plans (`timeout`, `lost-response`, `status-409/422/429/5xx`), order-consumed with seq call logging and snapshot fallback on exhaustion; writes trap and five-read surface preserved
- `gh-client.js` seam: same five method names, shape-checked at load, every call throws naming Phase 10; no write-verb or write-method token in either file
- Proof suite: 20 new node:test cases (PT-BR) covering six mappings, 409→429→data observability, full five-read ordering, TypeError, deterministic concurrent double-classification (assumption C), all-null writeAction across all seven fixtures (assumption D), plus the static forbidden-surface scan

## Task Commits

Each task was committed atomically:

1. **Task 1: Pure six-state classifier plus six fixtures** - `fe73f31` (feat)
2. **Task 2: Scripted fake sequences plus throwing gh stub** - `e9f8b5d` (feat)
3. **Task 3: Six-state proof suite plus no-ref-write static test** - `e749886` (test)

## Files Created/Modified

- `tools/release-close/classify.js` - Pure six-state classifier, eligibility-import-free
- `tools/release-close/fixtures/missing.json` - Absent release and milestone over eligible baseline
- `tools/release-close/fixtures/partial.json` - Owned draft release present
- `tools/release-close/fixtures/duplicate.json` - Two same-tag identical releases
- `tools/release-close/fixtures/conflicting.json` - Two same-tag materially different releases
- `tools/release-close/fixtures/failed.json` - Red checks evidence
- `tools/release-close/fixtures/concurrent.json` - Two in-flight close markers
- `tools/release-close/fake-client.js` - Extended with scripted failure plans (modified)
- `tools/release-close/gh-client.js` - Fail-closed stub naming Phase 10
- `tools/release-close/classify.test.js` - 13-case OPS-02 proof suite
- `tools/release-close/nowrite.test.js` - 7-case SAFE-02 static proof

## Decisions Made

- Classification precedence FAILED > CONCURRENT > CONFLICTING > DUPLICATE > PARTIAL > MISSING makes the function total: any valid-shape snapshot lands on exactly one code, with MISSING reserved for absent release and milestone
- Scripted plan vocabulary fixed to six outcomes; unknown methods or outcomes throw TypeError at plan-build time so typos fail fast instead of silently serving data
- Forbidden-surface list uses specific camelCase routines, whole-word HTTP verbs, ref paths, and secret tokens — bare `push`/`token` deliberately excluded because `calls.push` and argv `token` parsing are legitimate pre-existing code

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Correctness] Reworded classify.js header comments to avoid the literal filename**
- **Found during:** Task 1
- **Issue:** Header comments referenced the eligibility module by filename, which would trip a naive `grep eligibility.js` no-import check even though no import statement existed
- **Fix:** Reworded to "o módulo de elegibilidade"; the required `eligibility` evidence-field name remains (plan-mandated)
- **Files modified:** tools/release-close/classify.js
- **Commit:** fe73f31

None other - plan executed otherwise exactly as written.

## Issues Encountered

None. The scoped `node --test "tools/release-close/*.test.js"` run stays green (32/32) and never sweeps the backend vitest suites; backend and frontend trees are untouched; `ci.yml` untouched.

## User Setup Required

None - no external service configuration required. Zero dependencies, no network, no database.

## Next Phase Readiness

- Ready for 09-03 (plan display plus apply double-lock): the six states, scripted fake, writes trap, and forbidden-surface scan are the exact inputs its write-trap asserts and display logic consume
- Watch item: `gh-client.js` is a deliberate throwing stub (plan-sanctioned, test-covered) — Phase 10 wires the real gh-backed client against the unchanged five-read shape

## Self-Check: PASSED

- All 11 created/modified files FOUND on disk
- All 3 task commits FOUND (fe73f31, e9f8b5d, e749886)
- `node --test "tools/release-close/*.test.js"`: 32 pass, 0 fail
- Six fixtures map one-to-one to six codes with null writeAction; invalid shape throws TypeError
- 429-then-data script returns failure first and data second with ordered log entries
- backend/ and frontend/ trees untouched

---
*Phase: 09-release-close-contract-fixtures*
*Completed: 2026-09-25*
