---
phase: 09-release-close-contract-fixtures
plan: "04"
subsystem: infra
tags: [node-test, esm, release-close, safe-02, tag-peel, status-normalization, idempotency]

# Dependency graph
requires:
  - phase: 09-release-close-contract-fixtures
    provides: "checkTagEligibility pure contract with injectable client seam (09-01) and the programmable fake client plus scripted failure outcomes (09-01)"
provides:
  - "Strict two-hop annotated-tag identity in eligibility.js: exact ref name, full 40-hex tag-object SHA, tag-object identity equality with the ref, and second hop typed commit"
  - "New stable EN code vocabulary PERMISSION, UNAVAILABLE, MALFORMED and TRANSPORT with PT-BR reasons; only status 404 may report absence"
  - "readEnvelope wrapper: a throwing read normalizes to TRANSPORT and never escapes as a rejected promise (D-11 preserved)"
  - "Exact-code matrix of nineteen named eligibility families plus byte-stable repeat-verify and per-client isolation proofs"
affects: [09-05 classifier and frozen fixtures, 09-07 production decision path, phase-10 live preflight, phase-11 reconciliation, phase-12 runbook]

# Actuals (#2632) — pairs with the plan's `estimate` to calibrate future estimates.
actuals:
  tokens: 8510
  tasks: 3
  commits: 5

# Tech tracking
tech-stack:
  added: []
  patterns:
    - prove-identity-before-equality
    - one-code-per-failure-family
    - status-branch-per-family
    - transport-normalized-in-the-pure-predicate
    - named-case-matrix-with-exact-codes

key-files:
  created: []
  modified:
    - tools/release-close/eligibility.js
    - tools/release-close/eligibility.test.js

key-decisions:
  - "Identity-before-equality: the four identity proofs (ref name, 40-hex shape, tag-object identity, second-hop type) all close before any peeled === headSha or peeled === expectedSha comparison"
  - "The ref-name proof runs before the LIGHTWEIGHT branch, so a lightweight ref answering a different version reports TAG-IDENTITY rather than LIGHTWEIGHT"
  - "Abbreviated SHA at either hop is TAG-IDENTITY (a value/format failure), while an absent or wrongly typed field is MALFORMED (a structural failure); MISSING is reserved for 404"
  - "PERMISSION stays separate from UNAVAILABLE because Phase 10 must tell a credential problem apart from an availability problem"
  - "Unknown status families fail closed into UNAVAILABLE, never into the absence code"
  - "readEnvelope owns the try/catch for all three reads, so D-11 holds: every read outcome returns data and only invalid caller input throws"
  - "No retry, backoff or sleep was added; that contract belongs to the Phase 11 reconciliation seam (09-09)"
  - "New probes live in top-level it() calls, not nested describes, because node indents nested TAP subtests and the RED-evidence gate only recognizes a column-0 not ok line"
  - "Negative cases mutate a deep clone of the frozen reference fixture instead of re-typing the baseline SHAs, keeping the fixture the single source of truth (D-08)"

patterns-established:
  - "Identity proof set: a remote-shaped two-hop object is trusted only after ref name, SHA shape, cross-hop identity and second-hop type all check out"
  - "Absence requires positive proof: only HTTP 404 maps to MISSING; every other non-ok envelope names its own family"
  - "Normalized read wrapper: reads return { decision } or { envelope }, and a thrown read becomes a TRANSPORT decision instead of a rejection"
  - "Named-case matrix: eligibility families are a table of { nome, codigo, montar, roteiro } driven over deep clones, with the exact code as the asserted contract"

requirements-completed: [SAFE-02, OPS-01]

coverage:
  - id: D1
    description: "Strict two-hop annotated-tag identity: exact requested ref name, full 40-hex tag-object SHA, tag-object identity equal to the ref, and second hop typed commit"
    requirement: "SAFE-02"
    verification:
      - kind: unit
        ref: "tools/release-close/eligibility.test.js#identidade estrita: rejeita peel em tree com TAG-IDENTITY"
        status: pass
      - kind: unit
        ref: "tools/release-close/eligibility.test.js#identidade estrita: rejeita peel em blob com TAG-IDENTITY"
        status: pass
      - kind: unit
        ref: "tools/release-close/eligibility.test.js#identidade estrita: rejeita tag que aponta para outra tag com TAG-IDENTITY"
        status: pass
      - kind: unit
        ref: "tools/release-close/eligibility.test.js#identidade estrita: rejeita ref de outra versão com TAG-IDENTITY"
        status: pass
      - kind: unit
        ref: "tools/release-close/eligibility.test.js#identidade estrita: rejeita identidade do objeto da tag divergente com TAG-IDENTITY"
        status: pass
      - kind: unit
        ref: "tools/release-close/eligibility.test.js#identidade estrita: rejeita SHA do objeto da tag abreviado com TAG-IDENTITY"
        status: pass
      - kind: unit
        ref: "tools/release-close/eligibility.test.js#identidade estrita: rejeita commit peeled abreviado com TAG-IDENTITY"
        status: pass
      - kind: unit
        ref: "tools/release-close/eligibility.test.js#identidade estrita: chama o segundo salto com o SHA exato do objeto da tag"
        status: pass
    human_judgment: false
  - id: D2
    description: "Failure families normalize distinctly and are never read as absence: 404 MISSING, 401/403 PERMISSION, 409/422/429/5xx UNAVAILABLE, bad shape MALFORMED, thrown read TRANSPORT, always eligible false and writeAction null"
    requirement: "SAFE-02"
    verification:
      - kind: unit
        ref: "tools/release-close/eligibility.test.js#normalização: 404 no primeiro salto é a única ausência"
        status: pass
      - kind: unit
        ref: "tools/release-close/eligibility.test.js#normalização: 401 vira PERMISSION e não ausência"
        status: pass
      - kind: unit
        ref: "tools/release-close/eligibility.test.js#normalização: 403 vira PERMISSION e não ausência"
        status: pass
      - kind: unit
        ref: "tools/release-close/eligibility.test.js#normalização: 409 roteirizado vira UNAVAILABLE"
        status: pass
      - kind: unit
        ref: "tools/release-close/eligibility.test.js#normalização: 422 roteirizado vira UNAVAILABLE"
        status: pass
      - kind: unit
        ref: "tools/release-close/eligibility.test.js#normalização: 429 roteirizado vira UNAVAILABLE"
        status: pass
      - kind: unit
        ref: "tools/release-close/eligibility.test.js#normalização: 5xx roteirizado vira UNAVAILABLE"
        status: pass
      - kind: unit
        ref: "tools/release-close/eligibility.test.js#normalização: envelope ok sem data.object é MALFORMED"
        status: pass
      - kind: unit
        ref: "tools/release-close/eligibility.test.js#normalização: data.object de tipo errado no segundo salto é MALFORMED"
        status: pass
      - kind: unit
        ref: "tools/release-close/eligibility.test.js#normalização: status não numérico é MALFORMED"
        status: pass
      - kind: unit
        ref: "tools/release-close/eligibility.test.js#normalização: getTagRef com tempo esgotado devolve TRANSPORT"
        status: pass
      - kind: unit
        ref: "tools/release-close/eligibility.test.js#normalização: getBranchHead com resposta perdida devolve TRANSPORT"
        status: pass
      - kind: unit
        ref: "tools/release-close/eligibility.test.js#normalização: nenhuma família de falha escapa como rejeição"
        status: pass
    human_judgment: false
  - id: D3
    description: "Exact-code matrix of nineteen named eligibility families, each asserting the exact EN code plus writeAction null and a non-empty PT-BR reason, with no family writing remotely"
    requirement: "SAFE-02"
    verification:
      - kind: unit
        ref: "tools/release-close/eligibility.test.js#matriz de códigos exatos: as dezenove famílias devolvem o contrato declarado"
        status: pass
      - kind: unit
        ref: "tools/release-close/eligibility.test.js#matriz de códigos exatos: o vocabulário de EN é o declarado no contrato"
        status: pass
    human_judgment: false
  - id: D4
    description: "Repeating the CLI verify path over the same frozen input yields byte-identical JSON payloads that both carry the measured zero mutation field (OPS-01 idempotency)"
    requirement: "OPS-01"
    verification:
      - kind: integration
        ref: "tools/release-close/eligibility.test.js#dupla execução do verify é segura: saída idêntica e zero escritas (OPS-01 idempotência)"
        status: pass
    human_judgment: false
  - id: D5
    description: "Two independently constructed fake clients keep separate call logs and separate mutation counters: the untouched second client has an empty log, empty writes and a zero counter (OPS-01 single-process isolation, not a Phase 11 REC-05 locking guarantee)"
    requirement: "OPS-01"
    verification:
      - kind: unit
        ref: "tools/release-close/eligibility.test.js#clientes fake independentes têm logs isolados (OPS-01 concorrência single-process)"
        status: pass
    human_judgment: false
  - id: D6
    description: "The caller contract did not change shape: release-close.js still calls checkTagEligibility(client, { version, expectedSha }) and the CLI emits the code the pure predicate returned, verified end to end (verify --json exits 0 with ELIGIBLE on the frozen baseline, non-zero with SAFE-02 on a divergent --sha)"
    requirement: "SAFE-02"
    verification:
      - kind: integration
        ref: "tools/release-close/eligibility.test.js#CLI concorda com o predicado: verify --json sai zero com ELIGIBLE e não zero com SAFE-02"
        status: pass
      - kind: other
        ref: "git diff --name-only c13c4165..HEAD -> only tools/release-close/eligibility.js and tools/release-close/eligibility.test.js"
        status: pass
    human_judgment: false
  - id: D7
    description: "The PT-BR reason strings an operator will read on every refusal read clearly and name the failing proof without leaking environment, header or trace material"
    requirement: "SAFE-02"
    verification: []
    human_judgment: true
    rationale: "No test can assert the quality of operator-facing prose. The suite only checks that each reason is non-empty and carries a light PT-BR marker, deliberately so (the plan forbids turning the reason into a second substring contract). A human should read the nine reasons once before the Phase 12 runbook quotes them."

# Metrics
duration: 7 min
completed: 2026-09-25
status: complete
commits: 5
plan_head_before: c13c416501cd736b8d70e488708014a7e9c768e7
---

# Phase 09 Plan 04: Strict Annotated-Tag Peel and Failure Normalization Summary

**A two-hop annotated-tag identity predicate that refuses tree/blob/tag peels, foreign refs, mismatched tag-object identities and abbreviated SHAs, plus a failure vocabulary where only 404 proves absence**

## Performance

- **Duration:** 7 min
- **Started:** 2026-09-25T16:43:14Z
- **Completed:** 2026-09-25T16:50:38Z
- **Tasks:** 3
- **Files modified:** 2

## Accomplishments

- The strict peel gap from `09-VERIFICATION.md` gap 1 is closed executably: `eligibility.js` now proves four identities before it compares anything, and the frozen reference baseline still reaches `ELIGIBLE` end to end through the CLI.
- The overlapping advisory WR-01 is closed: permission denial, indeterminate availability, malformed shape and transport failure each report their own stable EN code with a PT-BR reason, so a refusal can no longer be read as absence.
- The overlapping OPS-01 idempotency and concurrency assumptions are closed as executable proofs: repeated `verify` is byte-stable and mutation-free, and two independent fake clients provably share no state.
- The exact-code matrix of nineteen named families plus a three-mutation probe establish that the new assertions are load-bearing, not vacuous.

## Task Commits

Each task followed the RED -> GREEN procedure; task 3 is a test-only consolidation and is documented under Deviations.

1. **Task 1 (tracer): strict two-hop identity** - `851997b` (test RED, 7 intentional failures) then `d386622` (feat GREEN)
2. **Task 2: failure-family normalization** - `2313f1a` (test RED, 12 intentional failures) then `d3082d8` (feat GREEN)
3. **Task 3: exact-code matrix, repeat stability, client isolation** - `81ccb3b` (test)

**Plan metadata:** this commit.

_No REFACTOR commit: the GREEN implementations were written in one cohesive pass with the identity proofs, the status branches and `readEnvelope` already factored; no cleanup remained that was not churn on a costly-to-reverse contract._

## Tracer Feedback Gate

Task 1 is `type="tracer"`. Mode resolution: no `gate="blocking-human"`, auto mode inactive (`auto_advance: false`, `_auto_chain_active: false`), interactive with `human_verify_mode: end-of-phase`, and the tracer `<verify>` carries only `<automated>`. The gate therefore re-ran `node --test tools/release-close/eligibility.test.js` (21/21 pass, exit 0) and continued: **⚡ Tracer verified end-to-end — expanding**, with no checkpoint.

## Files Created/Modified

- `tools/release-close/eligibility.js` - the four identity proofs before any equality branch, the per-family status branches, and the `readEnvelope` wrapper that normalizes a thrown read into `TRANSPORT`
- `tools/release-close/eligibility.test.js` - nine identity probes, twelve normalization probes, the twelve-family no-rejection sweep, the nineteen-row exact-code matrix, the strengthened repeat-run and client-isolation proofs, and the CLI end-to-end assertion

## Decisions Made

- **Identity before equality.** The ref-name, SHA-shape, identity-match and second-hop-type proofs all close before `peeled !== headSha` and `peeled !== expectedSha` are evaluated, so a divergent commit can never be reached through an unproven peel.
- **Ref-name proof precedes the LIGHTWEIGHT branch.** A ref answering a different version reports `TAG-IDENTITY`, which is the more precise statement; the existing lightweight case (unchanged ref name) still reports `LIGHTWEIGHT`.
- **Value failures versus structural failures.** A present field with the wrong value (abbreviated SHA, wrong type string, mismatched identity) is `TAG-IDENTITY`; an absent or wrongly typed field is `MALFORMED`. `MISSING` is now reachable only through status 404.
- **`PERMISSION` is never merged into `UNAVAILABLE`.** Phase 10 must tell a credential problem apart from an availability problem, and the plan forbade the merge.
- **Unknown status families fail closed into `UNAVAILABLE`,** never into the absence code, so an unmodelled status cannot masquerade as "not there".
- **No retry, backoff or sleep.** The plan assigned that contract to the Phase 11 reconciliation seam (09-09); adding it here would have invented a second owner.
- **New probes are top-level `it()` calls.** Node indents nested TAP subtests, and the RED-evidence gate only recognizes a column-0 `not ok` line, so nesting them would have made the RED unverifiable. This is documented in the test file header.
- **Negative cases mutate a deep clone of the frozen fixture** instead of re-typing baseline SHAs, keeping `fixtures/reference.json` the single source of truth (D-08) and leaving the fixture untouched for the 09-05 owner.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] The absence code was reachable from every non-ok envelope, not only from a 404**
- **Found during:** Task 2
- **Issue:** `eligibility.js` collapsed any `!envelope.ok` into `MISSING`, so a 401, 403, 409, 422, 429 or 5xx — and any structurally broken response — was reported to the operator as "the tag does not exist". That is the advisory WR-01 the plan set out to close, and it is the exact failure mode that lets a permission problem look like a deletion.
- **Fix:** Introduced `envelopeNaoOk` with one branch per status family and `readEnvelope` for the structural checks, so each family reports its own stable code.
- **Files modified:** `tools/release-close/eligibility.js`
- **Verification:** twelve normalization probes plus the twelve-family no-rejection sweep; the full tool suite is 81/81.
- **Committed in:** `d3082d8` (part of task 2 GREEN)

### Procedure Deviations

**2. [Rule 2 - Missing Critical] Task 3 produced no RED commit, and was proven load-bearing by mutation instead**
- **Found during:** Task 3
- **Issue:** Task 3 declares `tdd="true"` but its own action states it "changes no production source". TDD's fail-fast rule 1 (an unexpected green means the feature already exists) fired, and the investigation confirmed why: all nineteen matrix behaviors were already implemented by this same plan's task 1 and task 2 RED/GREEN cycles. No intentional red was producible without either fabricating a failure or editing production code the plan forbids touching.
- **Fix:** Ran the investigation the fail-fast rule requires, then replaced the ceremonial red with a stronger artifact — a three-mutation probe. Removing the second-hop type check, removing the permission branch, and removing the tag-object identity comparison each made the new matrix fail (4, 4 and 2 failures respectively); `eligibility.js` was then restored byte-identical to its GREEN commit and the suite returned to 36/36.
- **Files modified:** `tools/release-close/eligibility.test.js` (commit `81ccb3b`); the temporary mutations were reverted and never committed.
- **Verification:** `git diff --exit-code tools/release-close/eligibility.js` clean after the probe; the mutation log is recorded in this SUMMARY.
- **Recorded in:** `.planning/WINDOWS.md` as an open `deviation` entry so the ship gate can see it.

**Impact on plan:** Deviation 1 was essential to correctness; deviation 2 changed no code and cost no scope, but it does mean the plan's TDD shape is not fully reflected in the commit log for task 3.

## Issues Encountered

- **Nested TAP indentation made the RED gate unsatisfiable.** The first task-1 RED attempt put the new probes inside a nested `describe`, which node indents by eight spaces; `check tdd-red-evidence` parses `^not ok N - <name>` and found only the suite line, which would have been an unrelated-failure verdict. Moving the probes to top-level `it()` calls produced genuine column-0 lines and `RED_EVIDENCE_OK` for both RED phases. Recorded in the test file header so the next plan does not rediscover it.
- **Choosing a reason assertion that is neither vacuous nor a second contract.** The plan requires a non-empty PT-BR reason on every matrix row but also forbids asserting on reason substrings. A strict diacritic-only check would have failed on two legitimate reasons ("Objeto da tag ... inesperado: esperado ..." and "diverge do SHA esperado ..."), which are correct PT-BR without diacritics. The suite therefore uses a deliberately loose marker regex and says so in a comment.

## TDD Gate Compliance

| Plan | RED | GREEN | REFACTOR | Status |
|------|-----|-------|----------|--------|
| 09-04 task 1 | `851997b` (RED_EVIDENCE_OK, target failed on an assertion) | `d386622` | none needed | Pass |
| 09-04 task 2 | `2313f1a` (RED_EVIDENCE_OK, 12 assertion failures) | `d3082d8` | none needed | Pass |
| 09-04 task 3 | none producible (test-only; see deviation 2) | `81ccb3b` (matrix proven by 3-mutation probe) | n/a | Deviation documented |

## Verification

- `node --test tools/release-close/eligibility.test.js` -> 36 tests, 36 pass, exit 0
- `node --test "tools/release-close/*.test.js"` -> 81 tests, 81 pass, 0 fail (baseline before this plan was 57; no regression in the classifier, gate, no-write or SAFE-04 suites)
- `node tools/release-close/release-close.js verify --json` -> exit 0 with `code: ELIGIBLE` on the frozen baseline; exit 1 with `code: SAFE-02` under `--sha bbbb...`
- `git diff --name-only c13c4165..HEAD` -> only `tools/release-close/eligibility.js` and `tools/release-close/eligibility.test.js`; `.github/workflows/ci.yml`, `backend/`, `frontend/`, `package.json`, `fixtures/`, `classify.js`, `fake-client.js`, `release-close.js`, `apply-gate.js`, `client.js` and `gh-client.js` all confirmed untouched
- `tools/release-close/package.json` still declares no `dependencies` key (zero-dependency suite preserved)
- No stub markers (`TODO`, `FIXME`, placeholder text) in either file; no new network, subprocess, credential-env or remote-write surface

## Known Stubs

None. This plan adds no placeholder value, no disconnected data source and no skipped test; `WINDOWS.md` carries one open `deviation` entry describing deviation 2, which is a process record, not a stub in the code.

## Threat Flags

| Flag | File | Description |
|------|------|-------------|
| threat_flag: status-branch-exhaustiveness | `tools/release-close/eligibility.js` | The predicate now interprets remote status codes as a control-flow surface (404/401/403/409/422/429/5xx/unknown). A status added upstream without a matching branch falls into the fail-closed `UNAVAILABLE` arm, which is safe but is a decision the Phase 10 live client should re-confirm against the real `gh` error taxonomy. |
| threat_flag: read-wrapper-catches-typed-input-errors | `tools/release-close/eligibility.js` | `readEnvelope` catches every throw from a client read and reports `TRANSPORT`. A client that throws for a non-transport reason (for example a malformed request) would be reported as an indeterminate read rather than as invalid input. No write capability can be reached through that path, and `assertClientShape` still constrains the client surface, so the elevation risk is bounded — but the catch is deliberately broad on purpose. |

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- SAFE-02's strict peel is now an executable contract, so Phase 10 can wire the predicate to live reads without inheriting a permissive check.
- The EN code vocabulary published in the plan's artifact table is complete and locked in code: `MISSING`, `PERMISSION`, `UNAVAILABLE`, `MALFORMED`, `TRANSPORT`, `LIGHTWEIGHT`, `TAG-IDENTITY`, `SAFE-02`, `ELIGIBLE`. Phase 12's runbook can quote it, and the matrix test will fail loudly if a future family is added outside it.
- One named human-judgment item remains for UAT: reading the nine PT-BR reason strings once before the runbook quotes them (D7).
- Unchanged from before this plan: Phase 9 still carries the other five verification gap groups (exact CI evidence, target-scoped classification, measured mutation accounting, human-visible reviewed-content apply gating, and production retry/re-read coverage). Those belong to plans 09-05 through 09-07, and Phase 9 must not be closed until verification passes.
- Real workstation locking (REC-05) stays in Phase 11; the isolation test states that boundary in PT-BR so the suite is never cited as a locking guarantee.

## Self-Check: PASSED

- Key files confirmed on disk: `tools/release-close/eligibility.js`, `tools/release-close/eligibility.test.js`
- All five task commits confirmed present: `851997b`, `d386622`, `2313f1a`, `d3082d8`, `81ccb3b`
- Every `<acceptance_criteria>` of all three tasks re-run and passing: T1 source (ref compared, second-hop data.sha compared, commit type required before both equality branches, every refusal literal `writeAction: null`), T1 behavior (eleven cases at their exact codes), T1 CLI (`verify --json` exit 0 / `ELIGIBLE`, exit non-zero / `SAFE-02`); T2 source (one branch per status family, no non-404 branch returning the absence code), T2 behavior (eleven normalization cases at their exact codes), T2 test (decision object, never a rejected promise); T3 (nineteen exact codes, `writeAction` null and non-empty PT-BR reason on every row, byte-identical repeat payloads, untouched second client with empty log and zero counter, `package.json` without a `dependencies` key)

---
*Phase: 09-release-close-contract-fixtures*
*Completed: 2026-09-25*
