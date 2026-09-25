---
phase: 09-release-close-contract-fixtures
plan: "05"
subsystem: infra
tags: [node-test, esm, release-close, safe-02, ops-02, ci-allowlist, target-scoping, fail-closed, fixtures]

# Dependency graph
requires:
  - phase: 09-release-close-contract-fixtures
    provides: "pure six-state classifier plus six versioned fixtures (09-02), programmable fake client (09-01), strict peel predicate and the PERMISSION/UNAVAILABLE/MALFORMED/TRANSPORT vocabulary (09-04)"
provides:
  - "Five-key snapshot contract in classify.js: required target and ci blocks plus the releases, milestones and closeMarkers lists; a missing or malformed one is a TypeError with a PT-BR message, never a lenient default"
  - "Positive CI allowlist replacing failure-only detection: exactly one backend and one frontend record per required run, at the exact full target SHA, completed plus success"
  - "Eleven blocking ciCode families (CI-MALFORMED, CI-MISSING, CI-WRONG-RUN, CI-WRONG-SHA, CI-PENDING, CI-CANCELLED, CI-TIMED-OUT, CI-ACTION-REQUIRED, CI-NEUTRAL, CI-UNKNOWN, CI-CONTRADICTORY) with deterministic evaluation order"
  - "Declared two-shape fixture contract: flat classifier evidence versus client-shaped snapshot, told apart by the single literal Array.isArray(snapshot.milestones)"
  - "Target-scoped classification: partition on version identity, compare targetSha inside the partition, validate expectedSha afterwards as the reported targetShaValidates field"
  - "Full evidence retention: every partitioned Release and Milestone identifier survives in the decision; unrelated records are reported under clearly named fields"
  - "Completed no-op as the exact non-blocking pair code MISSING plus outcome COMPLETE_NOOP, with writeAction null"
  - "Two new frozen fixtures complete.json and unrelated.json, and the canonical ci block with exactly one owner in the repository (fixtures/reference.json)"
affects: [09-07 production evidence builder, 09-08 reviewed-content fixture and helper deletion, 09-09 reconciliation seam, phase-10 preflight, phase-11 reconciliation, phase-12 runbook]

# Actuals (#2632) — pairs with the plan's `estimate` to calibrate future estimates.
actuals:
  tokens: 61500
  tasks: 3
  commits: 5

# Tech tracking
tech-stack:
  added: []
  patterns:
    - required-contract-throws-never-defaults
    - positive-allowlist-with-named-failure-families
    - partition-then-compare-then-validate
    - validation-as-a-reported-field-not-a-filter
    - two-shapes-one-discriminator-literal
    - retained-unrelated-evidence-under-named-fields
    - completed-condition-as-a-separate-outcome-field

key-files:
  created:
    - tools/release-close/fixtures/complete.json
    - tools/release-close/fixtures/unrelated.json
  modified:
    - tools/release-close/classify.js
    - tools/release-close/classify.test.js
    - tools/release-close/release-close.js
    - tools/release-close/safe04.test.js
    - tools/release-close/fixtures/reference.json
    - tools/release-close/fixtures/missing.json
    - tools/release-close/fixtures/partial.json
    - tools/release-close/fixtures/duplicate.json
    - tools/release-close/fixtures/conflicting.json
    - tools/release-close/fixtures/failed.json
    - tools/release-close/fixtures/concurrent.json

key-decisions:
  - "A conclusion outside success but outside the five named diagnostic conclusions is CI-UNKNOWN, not a seventh family; the plan locked the vocabulary at eleven, and an explicitly declared red run (failedRunIds) reports FAILED with ciCode null rather than borrowing a family that does not describe what was seen"
  - "The CI evaluation order keeps contradictory last, as specified, by judging only unique (runId, job) slots in the conclusion/status stage; a duplicated slot is judged by its contradiction, which is what makes CI-CONTRADICTORY reachable at all under that order"
  - "ci.targetSha must equal target.expectedSha, and every record's headSha must equal ci.targetSha: both live in the wrong-SHA stage, and together they make a --sha override fail closed as CI-WRONG-SHA instead of being ignored"
  - "targetShaValidates is a boolean read as 'every partitioned record validates', so an empty partition validates vacuously; the no-op keeps its own exactly-one-record guard, so the vacuity can never produce a no-op"
  - "Milestone partition membership is byte identity on title or label, not a substring search: a milestone that merely contains the version is reported as unrelated rather than adopted, which is the fail-closed direction"
  - "closeMarkers carry no version identity, so the concurrency rule keeps counting all in_progress markers rather than a version partition; concurrent.json depends on it"
  - "The retained evidence travels on every decision, including CI-blocked ones, because the partition is well-defined independently of CI and dropping the evidence on a blocked path would be the very loss this plan fixes"
  - "New probes are top-level it() calls; nested TAP subtests are indented and the RED gate only reads column-0 not ok lines, a constraint inherited from 09-04 and documented in the test file header"
  - "The negative CI families clone the frozen ci object in fixtures/missing.json, so no SHA or run identifier is retyped in the test and the fixture is the single source of CI evidence"

patterns-established:
  - "Contract validation on entry: a required input is either present and well shaped or a TypeError; there is no third reading of an absent block"
  - "Allowlist evaluator: name the success condition exhaustively, and give every non-success path its own stable family code in a fixed evaluation order"
  - "Scope-then-compare-then-validate: membership is decided by natural identity alone, comparison happens inside the partition, and expected-value validation is a reported field consulted after the decision"
  - "Retention over collapse: a decision carries every partitioned record with its stable identifier, and carries the ignored set too under a clearly named field"
  - "Separate outcome channel: a condition that is not a new state lives in its own field, so the six state codes stay closed"

requirements-completed: [OPS-02, SAFE-02]

coverage:
  - id: D1
    description: "Five-key snapshot contract: a missing or malformed target or ci block is a TypeError with a PT-BR message and never a lenient default, and the three evidence lists must be arrays"
    requirement: "SAFE-02"
    verification:
      - kind: unit
        ref: "tools/release-close/classify.test.js#snapshot sem bloco target é violação de contrato (TypeError)"
        status: pass
      - kind: unit
        ref: "tools/release-close/classify.test.js#snapshot sem bloco ci é violação de contrato (TypeError)"
        status: pass
      - kind: unit
        ref: "tools/release-close/classify.test.js#snapshot em formato de cliente é rejeitado pelo classificador (TypeError)"
        status: pass
      - kind: unit
        ref: "tools/release-close/classify.test.js#rejeita snapshot com formato inválido com TypeError"
        status: pass
    human_judgment: false
  - id: D2
    description: "Positive CI allowlist: only one backend and one frontend record per required run, at the exact full target SHA, completed plus success, leaves CI unblocking; the canonical green block is proven not to block"
    requirement: "SAFE-02"
    verification:
      - kind: unit
        ref: "tools/release-close/classify.test.js#bloco CI canônico verde não bloqueia a classificação"
        status: pass
      - kind: unit
        ref: "tools/release-close/classify.test.js#o bloco CI congelado cobre os dois jobs nas duas execuções no SHA alvo exato"
        status: pass
    human_judgment: false
  - id: D3
    description: "Eleven blocking CI families each report code FAILED with their own exact EN ciCode, eligible false, writeAction null and a PT-BR reason, over eighteen matrix rows"
    requirement: "SAFE-02"
    verification:
      - kind: unit
        ref: "tools/release-close/classify.test.js#matriz de famílias de CI: toda evidência fora da allowlist bloqueia com o código exato"
        status: pass
      - kind: unit
        ref: "tools/release-close/classify.test.js#toda família de CI negativa força o bloqueio e nenhum estado novo entra pelo caminho da CI"
        status: pass
    human_judgment: false
  - id: D4
    description: "Target scoping: membership is the requested version partition alone, targetSha is compared inside it, and expectedSha is validated afterwards as the reported targetShaValidates field rather than applied as a prefilter"
    requirement: "SAFE-02"
    verification:
      - kind: unit
        ref: "tools/release-close/classify.test.js#duas releases idênticas da versão pedida são DUPLICATE com os dois identificadores retidos"
        status: pass
      - kind: unit
        ref: "tools/release-close/classify.test.js#duas releases da versão pedida com alvos diferentes são CONFLICTING com os dois identificadores retidos"
        status: pass
      - kind: unit
        ref: "tools/release-close/classify.test.js#o fixture conflicting congelado reporta CONFLICTING em vez de filtrar o registro divergente"
        status: pass
      - kind: unit
        ref: "tools/release-close/classify.test.js#release única da versão pedida com SHA divergente fica na partição com targetShaValidates falso"
        status: pass
      - kind: unit
        ref: "tools/release-close/classify.test.js#duas releases de duas outras versões ficam fora da decisão do alvo e do motivo"
        status: pass
      - kind: unit
        ref: "tools/release-close/classify.test.js#uma release de outra versão não decide o alvo quando existe uma release da versão pedida"
        status: pass
    human_judgment: false
  - id: D5
    description: "Milestone evidence is partitioned by the same version identity, every partitioned number and state is retained, and a milestone of another version is excluded from the target decision"
    requirement: "OPS-02"
    verification:
      - kind: unit
        ref: "tools/release-close/classify.test.js#duas milestones da versão pedida são ambas retidas e o alvo continua em aberto"
        status: pass
      - kind: unit
        ref: "tools/release-close/classify.test.js#uma milestone de outra versão fica fora da decisão do alvo"
        status: pass
    human_judgment: false
  - id: D6
    description: "Completed target reports the exact non-blocking pair code MISSING plus outcome COMPLETE_NOOP with writeAction null, and a draft release or an open milestone with open issues reports PARTIAL with the outcome absent"
    requirement: "OPS-02"
    verification:
      - kind: unit
        ref: "tools/release-close/classify.test.js#release publicada com milestone fechada sem issue aberta é MISSING com outcome COMPLETE_NOOP"
        status: pass
      - kind: unit
        ref: "tools/release-close/classify.test.js#o alvo concluído e o alvo sem nada se distinguem só pelo campo outcome"
        status: pass
      - kind: unit
        ref: "tools/release-close/classify.test.js#release de rascunho para a versão pedida é PARTIAL sem outcome"
        status: pass
      - kind: unit
        ref: "tools/release-close/classify.test.js#milestone aberta com issue aberta é PARTIAL sem outcome"
        status: pass
    human_judgment: false
  - id: D7
    description: "Every flat evidence fixture maps to an exact expected decision surface, and the client-shaped reference.json is proven rejected rather than misread"
    requirement: "OPS-02"
    verification:
      - kind: unit
        ref: "tools/release-close/classify.test.js#matriz por fixture de evidência plana: cada linha carrega a decisão exata declarada"
        status: pass
      - kind: unit
        ref: "tools/release-close/classify.test.js#nenhum objeto de decisão carrega ação de escrita nos seis fixtures de evidência plana"
        status: pass
    human_judgment: false
  - id: D8
    description: "Production pass-through keeps the CLI honest on the frozen baseline: ci is copied through unchanged, the resolved target flows in from both call sites, a --sha override fails closed as CI-WRONG-SHA, and verify and plan still exit zero with applyLiberado true"
    requirement: "SAFE-02"
    verification:
      - kind: integration
        ref: "node tools/release-close/release-close.js verify --json -> exit 0, code ELIGIBLE"
        status: pass
      - kind: integration
        ref: "node tools/release-close/release-close.js plan --json -> exit 0, applyLiberado true, bloqueio null"
        status: pass
      - kind: integration
        ref: "node tools/release-close/release-close.js plan --json --sha <40-hex> -> exit 1, applyLiberado false, classificacao.ciCode CI-WRONG-SHA"
        status: pass
      - kind: integration
        ref: "tools/release-close/safe04.test.js#o plano carrega os SHAs e as execuções congeladas do baseline"
        status: pass
    human_judgment: false
  - id: D9
    description: "Repeat classification of the same frozen evidence is byte-identical and write-free, and two decisions from different evidence share no mutable state (OPS-02 determinism inside one process, not a Phase 11 REC-05 locking guarantee)"
    requirement: "OPS-02"
    verification:
      - kind: unit
        ref: "tools/release-close/classify.test.js#a classificação repetida do fixture concorrente é byte-idêntica e não propõe escrita"
        status: pass
      - kind: unit
        ref: "tools/release-close/classify.test.js#decisões de evidências diferentes no mesmo processo não compartilham estado"
        status: pass
      - kind: unit
        ref: "tools/release-close/classify.test.js#classifica o estado concorrente de forma determinística em duas leituras"
        status: pass
    human_judgment: false
  - id: D10
    description: "The frozen fixtures are canonical rather than convenient: nine files parse as JSON, the eight flat ones carry the target block, the canonical ci block and the three evidence lists, and the client-shaped reference.json keeps both envelopes and gains no releases or closeMarkers key"
    requirement: "OPS-02"
    verification:
      - kind: other
        ref: "node -e over tools/release-close/fixtures/*.json -> 9 files parse, 8 flat carry 5/5 contract keys, reference.json has neither releases nor closeMarkers and keeps both envelopes"
        status: pass
      - kind: unit
        ref: "tools/release-close/nowrite.test.js#nenhum fixture versionado contém formato de credencial"
        status: pass
    human_judgment: false
  - id: D11
    description: "The PT-BR reasons an operator reads for the eleven CI families, the six states and the completed no-op are clear and name the failing proof without leaking environment, header or trace material"
    verification: []
    human_judgment: true
    rationale: "No test can assert the quality of operator-facing prose, and the plan forbids turning the reason into a second substring contract. The suite checks only that every reason is non-empty. A human should read the family reasons once before the Phase 12 runbook quotes them, and should confirm that the missing-targetSha and explicit-red-run wordings are legible to an operator who did not write them."

# Metrics
duration: 21 min
completed: 2026-09-25
status: complete
commits: 5
plan_head_before: 113608d073a982b756032371af96bec1bd5cd9f9
---

# Phase 09 Plan 05: Fail-Closed CI Allowlist and Target-Scoped Classification Summary

**A five-key snapshot contract that throws instead of defaulting, a positive backend/frontend CI allowlist with eleven named blocking families, and target-scoped Release/Milestone classification that reports a finished target as MISSING plus COMPLETE_NOOP**

## Performance

- **Duration:** 21 min
- **Started:** 2026-09-25T16:56:58Z
- **Completed:** 2026-09-25T17:17:30Z
- **Tasks:** 3
- **Files modified:** 13

## Accomplishments

- **VERIFICATION gap 2 (pure half) closed.** `classify.js` no longer treats anything that is not literally `failure` as non-red. It now requires a `target` block, a `ci` block and three evidence lists, and it unblocks CI only on exactly one `backend` and one `frontend` record per required run, at the exact full 40-hex target SHA, `completed` plus `success`. Eleven blocking families each carry their own stable EN `ciCode` with a PT-BR reason, and the evaluation order is fixed so the same evidence always yields the same family.
- **The spoofing vector is deleted, not deprecated.** The literal `checks: { state: 'success' }` object that the CLI synthesized from bare run identifiers is gone from every fixture and from the production evidence helper, and no fallback input survives: an absent or unrecognized CI block is a thrown contract violation, never a default green. A `--sha` override now flows into the contract and correctly classifies as `FAILED` with family `CI-WRONG-SHA`.
- **VERIFICATION gap 3 (pure half) and advisory WR-06/WR-07 closed.** Membership in the target decision is now the requested-version partition alone, so unrelated repository history can no longer block a target, and a same-version record whose target SHA diverges stays in the decision as a reported conflict instead of being filtered out of it. A finished target reports the exact non-blocking pair `MISSING` + `COMPLETE_NOOP` instead of the ambiguous `PARTIAL` a recovery tool would have read as work to do.
- **The two declared fixture shapes are separated by one literal.** `Array.isArray(snapshot.milestones)` is the same discriminator everywhere; `reference.json` stays client-shaped for life with both its `release` and `milestones` envelopes untouched, and it is now the repository's single owner of canonical CI evidence for plans 09-07 and 09-08 to copy through rather than reconstruct.
- **The new assertions are proven load-bearing.** A six-mutation probe against `classify.js` shows the whole task-3 matrix is not vacuous, and it caught a real hole: the `ci.targetSha`-versus-target guard was masked by the per-record comparison, and the matrix row that isolates it was rewritten.

## Task Commits

Each task followed the RED -> GREEN procedure; task 3 is a test-only consolidation and is documented under Deviations.

1. **Task 1: canonical snapshot contract plus the CI success allowlist** - `be19ced` (test RED, 5 intentional failures) then `137e777` (feat GREEN)
2. **Task 2: target-scoped evidence with full retention and the completed no-op** - `9d1c528` (test RED, 10 intentional failures) then `4cb0745` (feat GREEN)
3. **Task 3: exact-code matrix, CI-family coverage and determinism proof** - `76cbf6d` (test)

**Plan metadata:** this commit.

_No REFACTOR commit: both GREEN implementations were written in one cohesive pass with the contract validation, the allowlist evaluator and the partition already factored; no cleanup remained that was not churn on a costly-to-reverse contract._

## Files Created/Modified

- `tools/release-close/classify.js` - the five-key contract validation, the CI allowlist evaluator with the eleven families, the version partition with full retention, and the `MISSING` + `COMPLETE_NOOP` completed no-op
- `tools/release-close/classify.test.js` - 23 top-level contract probes (CI family matrix, TypeError contract probes, target-scoping behaviors, exact-code fixture table, determinism and isolation proofs) plus the untouched 13-row nested suite
- `tools/release-close/release-close.js` - the exported evidence pass-through that copies `ci` through, emits the full lists, and takes the resolved target from both call sites
- `tools/release-close/safe04.test.js` - the two local helpers migrated to the five-key contract, with the shape discriminator reduced to `Array.isArray(snapshot.milestones)`
- `tools/release-close/fixtures/reference.json` - extended with the canonical `ci` and `target` blocks; both client-shaped envelopes untouched, no `releases` or `closeMarkers` key added
- `tools/release-close/fixtures/{missing,partial,duplicate,conflicting,failed,concurrent}.json` - the frozen six-state group migrated to the canonical contract as flat evidence; `failed.json` gains `failedRunIds` as the explicit red trigger with an unblocking `ci` block
- `tools/release-close/fixtures/complete.json` - the frozen finished-target scenario (new)
- `tools/release-close/fixtures/unrelated.json` - the frozen unrelated-history scenario (new)

## Decisions Made

- **A red conclusion outside the five named diagnostic conclusions is `CI-UNKNOWN`, and an explicitly declared red run is `FAILED` with `ciCode` null.** The plan locked the family vocabulary at eleven, and `conclusion: 'failure'` is not one of the named families. Rather than borrow a name that does not describe what was seen, the explicit red trigger lives in the state rules and claims no family; it still blocks, which is the part that matters for fail-closed behavior.
- **`CI-CONTRADICTORY` is reachable while staying last in the evaluation order.** The conclusion/status stage judges only unique `(runId, job)` slots; a slot with more than one record is judged by its contradiction, because the contradiction *is* the finding. Judging an arbitrary copy first would report a misleading family and make the eleventh family dead code.
- **`ci.targetSha` must equal `target.expectedSha`, and every record's `headSha` must equal `ci.targetSha`.** Both comparisons live in the wrong-SHA stage. Together they are what makes a `--sha` override fail closed instead of being ignored — verified end to end: `plan --json --sha <40-hex>` exits 1 with `applyLiberado false` and `ciCode CI-WRONG-SHA`.
- **`targetShaValidates` is a boolean read as "every partitioned record validates", so an empty partition validates vacuously.** The no-op keeps its own exactly-one-record guard, so the vacuity can never manufacture a finished target. A third state (`null`) would have been more expressive but would have made the field untotal for the exact-value assertions the plan requires.
- **Milestone membership is byte identity on `title` or `label`, not a substring search.** A milestone whose title merely contains the version is reported as unrelated rather than adopted, which is the fail-closed direction and keeps the rule symmetric with the release `tagName` identity.
- **`closeMarkers` are not version-partitioned.** They carry no version identity, so the concurrency rule keeps counting all in-progress markers; `concurrent.json` depends on it and inventing a partition key for them would have been a new, unplanned contract.
- **Retained evidence travels on every decision, including CI-blocked ones.** The partition is well-defined independently of CI, and dropping the evidence on a blocked path would be the very loss this plan exists to fix.
- **New probes are top-level `it()` calls.** Node indents nested TAP subtests and the RED gate only reads column-0 `not ok` lines, so a nested probe produces an invisible and therefore invalid RED. Inherited from 09-04 and documented in the test file header.
- **Negative CI families clone the frozen `ci` object in `fixtures/missing.json`.** No SHA or run identifier is retyped in the test, and the fixture stays the single source of CI evidence in the repository.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] `conclusion: 'failure'` had no family in a vocabulary the plan locked at eleven**
- **Found during:** Task 1 (CI allowlist evaluator)
- **Issue:** The plan enumerates ten conclusion/status families and does not include a red one, so the real `failure` conclusion a GitHub run actually produces had nowhere honest to land. Mapping it to `CI-UNKNOWN` would be semantically wrong; adding `CI-FAILURE` would have widened a locked vocabulary that plans 09-07, 09-08 and 09-09 assert literally.
- **Fix:** `failure` and every other conclusion outside the five named diagnostic ones and outside `success` map to `CI-UNKNOWN` (a conclusion outside the allowlist that the classifier has no specific diagnosis for), and the explicit red signal moved to a dedicated `failedRunIds` state trigger that reports `FAILED` with `ciCode: null` rather than borrowing a family.
- **Files modified:** `tools/release-close/classify.js`, `tools/release-close/fixtures/failed.json`
- **Verification:** matrix rows "conclusão fora da allowlist" (CI-UNKNOWN) and "fixture failed" (FAILED); the frozen six-state table still maps one to one.
- **Committed in:** `137e777`

**2. [Rule 1 - Bug] `CI-CONTRADICTORY` was unreachable under the evaluation order the plan specified**
- **Found during:** Task 1 (CI allowlist evaluator)
- **Issue:** The plan fixes the order as malformed, missing, wrong-run, wrong-SHA, per-family conclusion/status, then contradictory. Reaching the last stage requires every record to have passed the conclusion/status stage, which under a naive reading means every conclusion is already `success` — and two records of the same run and job with different conclusions cannot both be `success`. The eleventh family would have been dead code, and the "contradictory evidence blocks" truth would have been unprovable.
- **Fix:** The conclusion/status stage judges only unique `(runId, job)` slots; a slot carrying more than one record is reserved for the contradictory stage, which reports differing conclusions as `CI-CONTRADICTORY` and, when they agree, still judges the slot by family. The stated order is preserved and every family is reachable.
- **Files modified:** `tools/release-close/classify.js`
- **Verification:** matrix row "mesma execução e mesmo job com conclusões diferentes" returns exactly `CI-CONTRADICTORY`; a six-mutation probe confirms the guard is load-bearing.
- **Committed in:** `137e777`

**3. [Rule 1 - Bug] The `ci.targetSha` guard was masked by the per-record comparison, leaving it unproved**
- **Found during:** Task 3 (mutation probe)
- **Issue:** The task-3 mutation that removed the `ci.targetSha !== expectedSha` check changed **no** test outcome: the original matrix row mutated `ci.targetSha` alone, leaving the records at the original commit, so the per-record comparison caught the same family anyway. The guard is load-bearing in production (a `--sha` override moves `expectedSha`, not the records) but nothing proved it.
- **Fix:** The matrix row now moves the whole block — `ci.targetSha` and every record `headSha` — to another commit, so only the target comparison can reject it. Re-probing the same mutation now fails 2 tests, and a second new probe (removing the wrong-run guard) fails 2 more.
- **Files modified:** `tools/release-close/classify.test.js`
- **Verification:** six-mutation probe, all six caught; `classify.js` byte-identical to its task-2 commit after the probe.
- **Committed in:** `76cbf6d`

### Procedure Deviations

**4. [Rule 2 - Missing Critical] Task 3 produced no RED commit, and was proven load-bearing by a six-mutation probe**
- **Found during:** Task 3
- **Issue:** Task 3 declares `tdd="true"` but its own action states it "changes no production source and no fixture". TDD's fail-fast rule 1 fired and the investigation confirmed why: every behavior it asserts was already implemented by this same plan's task-1 and task-2 RED/GREEN cycles. No intentional red was producible without fabricating a failure or editing production code the plan forbids touching.
- **Fix:** Ran the investigation the fail-fast rule requires, then replaced the ceremonial red with a stronger artifact. Six mutations of `classify.js` were probed: disabling the duplicate/conflict comparison, dropping the no-op milestone guard, dropping the `ci.targetSha` guard, dropping the wrong-run guard, restoring the original target-SHA membership filter, and relaxing milestone membership to a substring search. Failures: 6, 2, 0 (fixed by deviation 3), 2, 8, 1. `classify.js` was then restored byte-identical and the suite returned to 103/103.
- **Files modified:** `tools/release-close/classify.test.js` (commit `76cbf6d`); the temporary mutations were reverted and never committed.
- **Verification:** `git diff --exit-code tools/release-close/classify.js` clean after the probe.
- **Recorded in:** `.planning/WINDOWS.md` as an open `deviation` entry so the ship gate can see it.

**5. [TDD ordering note] The negative CI families in task 1's RED commit derived the canonical block instead of reading it from the fixture**
- **Found during:** Task 1 (RED)
- **Issue:** The plan asks for the negative cases to be built from "the canonical block taken from `fixtures/missing.json`", but at RED time that fixture does not yet carry a `ci` block — the block arrives with GREEN. Reading a key that does not exist would have made every matrix row crash on `undefined` instead of failing on an assertion, which is INVALID_RED under #3770.
- **Fix:** Task 1's RED built the canonical block from values the fixture already carried (`expectedSha` and `runs`), keeping the D-08 property of never retyping a frozen SHA or run identifier, and producing clean assertion failures. Task 3 repointed `blocoCanonic()` at the frozen `ci` object, so the repository now has exactly one construction of that block, and added a probe asserting the frozen block's shape. The end state matches the plan; only the RED-phase construction differed, and only because the data did not exist yet.
- **Files modified:** `tools/release-close/classify.test.js` (RED in `be19ced`, repointed in `76cbf6d`)

**6. [Placement note] The client-shape rejection probe lives at top level rather than inside the six-state describe**
- **Found during:** Task 1
- **Issue:** The plan says to put the `classifySnapshot(fixture('reference'))` TypeError case "in place of" the narrowed write-action loop, i.e. inside the nested describe. Nested probes are indented by node and invisible to the RED gate.
- **Fix:** The probe is a top-level `it()` immediately after the describe block, and the test comment states that `reference.json` is not a classifier input. The plan's intent — keep the reference baseline covered from `classify.test.js` by proving rejection, not classification — is satisfied, and the probe is now visible to the gate.

---

**Total deviations:** 6 auto-fixed (3 bugs, 1 missing-critical procedure, 2 TDD/placement notes)
**Impact on plan:** Deviations 1 and 2 were essential to correctness — without them the eleven-family vocabulary and the eleventh family would have been dishonest or dead. Deviation 3 was essential to the proof: without it a real production guard shipped unproved. Deviations 4, 5 and 6 changed no production behavior and cost no scope, but they do mean the commit log does not show a RED for task 3 and shows a different construction for the task-1 RED matrix.

## Issues Encountered

- **`conclusion: 'failure'` and the plan's locked vocabulary.** The plan enumerates ten conclusion/status families and none is the red one, while a real GitHub run produces exactly that conclusion. Resolved as deviation 1, with the reasoning stated in the code so the next reader does not re-open it.
- **`CI-CONTRADICTORY` could not fire under the plan's stated order.** Resolved as deviation 2, again with the reasoning in the code.
- **Two of my own test expectations were wrong in task 2's GREEN.** I asserted the retained unrelated tags in alphabetical order when the contract sorts by identifier, and I built the "milestone of another version" scenario on a closed target milestone, which legitimately earned the no-op. Both were test-side errors, fixed in the GREEN commit after confirming the corrected assertions still fail against the pre-task-2 behavior.
- **Nested TAP indentation** made the RED gate unsatisfiable for a nested probe. All 23 new probes are top-level `it()` calls, documented in the test file header so 09-07 and 09-08 inherit the convention.

## TDD Gate Compliance

| Plan | RED | GREEN | REFACTOR | Status |
|------|-----|-------|----------|--------|
| 09-05 task 1 | `be19ced` (RED_EVIDENCE_OK, 5 top-level assertion failures, 13 frozen rows still passing) | `137e777` | none needed | Pass |
| 09-05 task 2 | `9d1c528` (RED_EVIDENCE_OK, 10 assertion failures, WR-07 reproduced as CONFLICTING) | `4cb0745` | none needed | Pass |
| 09-05 task 3 | none producible (test-only; see deviation 4) | `76cbf6d` (matrix proven by a 6-mutation probe) | n/a | Deviation documented |

## Verification

- `node --test tools/release-close/classify.test.js` -> 35 tests, 35 pass, exit 0 (baseline before this plan was 12)
- `node --test "tools/release-close/*.test.js"` -> 103 tests, 103 pass, 0 fail (baseline before this plan was 81; no regression in the eligibility, gate, no-write or SAFE-04 suites)
- `node tools/release-close/release-close.js verify --json` -> exit 0 with `code: ELIGIBLE` on the frozen baseline
- `node tools/release-close/release-close.js plan --json` -> exit 0 with `applyLiberado: true`, `bloqueio: null`, eight steps all marked `criar`/`ler`
- `node tools/release-close/release-close.js plan --json --sha <40-hex>` -> exit 1 with `applyLiberado: false` and `classificacao.ciCode: CI-WRONG-SHA` (the override flows into the contract instead of being ignored)
- All nine fixture files parse as JSON; the eight flat ones carry the `target` block, the canonical four-record `ci` block and the three evidence lists; `reference.json` keeps both envelopes and carries neither `releases` nor `closeMarkers`
- `git diff --name-only 113608d..HEAD` -> exactly the thirteen declared `files_modified`; `.github/workflows/ci.yml`, `backend/`, `frontend/`, `package.json` and `tools/release-close/package.json` all confirmed untouched
- `tools/release-close/package.json` still declares no `dependencies` key; `classify.js` still imports no eligibility module; no `process.env` read, no network, no subprocess and no remote-write path added
- No stub markers (`TODO`, `FIXME`, placeholder text) and no skipped or todo tests in any changed file

## Known Stubs

None. This plan adds no placeholder value, no disconnected data source and no skipped test. `WINDOWS.md` carries one open `deviation` entry describing deviation 4, which is a process record about the commit log, not a stub in the code.

## Threat Flags

| Flag | File | Description |
|------|------|-------------|
| threat_flag: conclusion-taxonomy-exhaustiveness | `tools/release-close/classify.js` | `familiaDoRegistro` maps the five named diagnostic conclusions and treats every other non-`success` conclusion as `CI-UNKNOWN`, including the real `failure`. That is fail-closed, but a conclusion the GitHub API adds upstream will land in `CI-UNKNOWN` rather than in its own family. Phase 10's live client should re-confirm the conclusion taxonomy against the real `gh` output and add a family only if a distinct operator action becomes necessary. |
| threat_flag: milestone-membership-is-byte-identity | `tools/release-close/classify.js` | A milestone qualifies only when `title` or `label` is byte-identical to the requested version. A real milestone titled "Release v0.1.1" is therefore reported as unrelated and its target stays MISSING rather than being adopted — safe, but it is a conservative reading that Phase 10 or 11 may need to widen with an explicit, tested rule. |
| threat_flag: vacuous-targetShaValidates | `tools/release-close/classify.js` | `targetShaValidates` is true for an empty partition (every element of the empty set satisfies the property). The completed no-op has its own exactly-one-record guard, so the vacuity cannot manufacture a finished target, but a consumer reading `targetShaValidates` on its own would read a vacuous true. |
| threat_flag: retained-evidence-on-blocked-decisions | `tools/release-close/classify.js` | Every decision, including a CI-blocked one, carries the partitioned and unrelated evidence. Those records hold only public identifiers, tag names and target SHAs (T-09-05-05), but the surface is larger than a CI refusal strictly needs and Phase 12's runbook should be explicit about what it may print. |

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- **OPS-02 and SAFE-02 both have their pure half closed executably.** The remaining gap-2 and gap-3 items (routing all five client reads through the production path and retaining normalized arrays) are exactly what plan 09-07's exported five-read evidence builder does, and this plan left the exported `evidenceFromSnapshot` symbol in place for it to replace in situ.
- **The canonical CI evidence has exactly one owner.** `tools/release-close/fixtures/reference.json` is the only place in the repository that declares it, and 09-07 and 09-08 copy that block through rather than reconstructing one. Neither may add `releases` or `closeMarkers` to it, and neither may convert its two envelopes into lists.
- **The six-state table from 09-02 is still provable from the suite**, one row per state, and the two new fixtures extend it rather than replace it. The eight-row exact-code table in `classify.test.js` is the map a later plan should extend instead of rebuilding.
- **The completed condition is spelled as a literal pair** — `code: 'MISSING'` plus `outcome: 'COMPLETE_NOOP'` — and `MISSING` stays a non-blocking member of the six locked codes, so `applyLiberado` remains true for a finished target and its eight plan steps stay adopt-or-read. Plans 09-07 task 3, 09-08 task 3 and 09-09 task 3 assert that same literal pair.
- **The shape discriminator to reuse verbatim is `Array.isArray(snapshot.milestones)`.** 09-07 and 09-08 must not key it on `target` or `ci`: `reference.json` carries both and is client-shaped, so that keying would misroute the baseline.
- **The safe04 local helpers are still temporary.** `evidenciaDe` and `evidenceFromSnapshot` in `safe04.test.js` collapse duplicate and conflict arrays; plan 09-08 task 3 deletes both in favor of the production builder. Until then the six SAFE-04 rows assert only that a code is a string, and the `reference` row is the only one carrying an exact code.
- **Unchanged from before this plan:** Phase 9 still carries the other verification gap groups (measured mutation accounting, human-visible reviewed-content apply gating, and production failure/re-read coverage) and must not be closed until verification passes. Real cross-process arbitration (REC-05) stays in Phase 11; the determinism test states that boundary in PT-BR so the suite is never cited as a locking guarantee.
- One named human-judgment item remains for UAT: reading the family reasons and the two ambiguous wordings (missing target SHA, explicit red run) once before the Phase 12 runbook quotes them (D11).

## Self-Check: PASSED

- Key files confirmed on disk: all thirteen changed paths, including the two new fixtures
- All five task commits confirmed present: `be19ced`, `137e777`, `9d1c528`, `4cb0745`, `76cbf6d`
- Every `<acceptance_criteria>` of all three tasks re-run and passing. Task 1 source (no `checks` fallback, TypeError on missing target/ci, client shape rejected because `milestones` is an envelope, job allowlist exactly backend+frontend, each family mapping to one EN `ciCode`, eleven families exported); task 1 behavior (eighteen matrix rows at their exact codes, the green block unblocking with `ciCode null`, both missing-block cases throwing, the reference baseline normalizing to `MISSING` with `writeAction null` while the plan still reports `applyLiberado true`); task 1 fixture (six state fixtures carry target/ci/three lists and still return their own state code, `reference.json` keeps both envelopes and gains no `releases` or `closeMarkers` and holds four records covering both jobs on both required runs at the exact target SHA); task 1 CLI (verify and plan exit zero with `applyLiberado true`); task 2 source (target block read, partition from `tagName` identity alone with no `expectedSha` term in the membership test, `targetSha` compared inside the partition, `targetShaValidates` reported separately, no first-element selection, exactly six state codes); task 2 behavior (all eleven cases by exact value, `conflicting.json` returning `CONFLICTING` with both ids retained, the divergent record staying in the partition with `targetShaValidates false` and the divergence in the reason, the completed case returning `MISSING` plus the exact `COMPLETE_NOOP` literal with `writeAction null`, draft and open milestone returning `PARTIAL` with the outcome absent); task 2 fixture (`complete.json` and `unrelated.json` valid JSON on the five-key contract with the canonical ci block, plan JSON still `applyLiberado true`); task 3 (eight flat evidence rows with exact codes, `complete.json` as `MISSING` plus `COMPLETE_NOOP`, `unrelated.json` as `MISSING` with the outcome absent and the unrelated records retained, eleven CI family rows with exact `ciCode`, the client-shaped reference row throwing a TypeError, deeply-equal repeat classification of `concurrent.json`, no shared mutable state between two decisions, `package.json` without a `dependencies` key, `classify.js` without an eligibility import)

---
*Phase: 09-release-close-contract-fixtures*
*Completed: 2026-09-25*
