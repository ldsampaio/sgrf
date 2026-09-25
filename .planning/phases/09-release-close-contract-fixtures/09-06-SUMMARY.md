---
phase: 09-release-close-contract-fixtures
plan: "06"
subsystem: infra
tags: [node-test, esm, release-close, safe-04, safe-02, exact-capability-surface, mutation-accounting, canary, fail-closed]

# Dependency graph
requires:
  - phase: 09-release-close-contract-fixtures
    provides: "strict annotated-tag peel and the PERMISSION/UNAVAILABLE/MALFORMED/TRANSPORT vocabulary (09-04); five-key snapshot contract, positive CI allowlist and target-scoped classification over the frozen fixtures (09-05)"
provides:
  - "Exact capability surface in client.js: assertClientShape confirms the five declared reads and then enumerates own enumerable members, refusing any callable outside READ_METHODS with a PT-BR reason that names the capability and declares the surface read-only"
  - "assertNoMutation, the shared zero-mutation invariant: returns the count only when it is exactly zero, otherwise refuses naming the observed capability and the count, with a single parameter and no reset, forgiveness or subtraction path"
  - "Two distinct refusal families — a corrupt measurement never reports itself as an escaped side effect, because the two demand opposite operator actions"
  - "Programmable fake whose mutation count is a measurement: the tally and the effect record live in an unexposed closure, one recording function is the only path a side effect must pass through, and the client is frozen after the shape is asserted"
  - "makeArmedFakeClient, the named test seam that arms the recorder as a non-enumerable frozen member, so arming it does not widen the public surface"
  - "The legacy `writes` member preserved as a read-only array-shaped accessor whose length is the measured count, keeping the four out-of-scope fake.writes.length assertions literally true"
  - "Forbidden-write canary: a scoped child test really performs the escape the boundary exists to prevent, and the parent requires that escape to exit non-zero"
  - "A documented contract boundary, pinned by tests: inherited and non-enumerable members are not capabilities, and the extra-member rejection does not descend into nested objects"
affects: [09-07 counter propagation, 09-08 reviewed-content helper deletion, 09-09 reconciliation seam, phase-10 live gh client, phase-11 reconciliation, phase-12 runbook, phase-13 live recovery]

# Actuals (#2632) — pairs with the plan's `estimate` to calibrate future estimates.
actuals:
  tokens: 9949
  tasks: 3
  commits: 5

# Tech tracking
tech-stack:
  added: []
  patterns:
    - exact-capability-surface-over-required-methods
    - measure-at-the-side-effect-boundary-not-at-the-renderer
    - closure-owned-tally-with-read-only-accessors
    - single-parameter-invariant-with-no-forgiveness-path
    - distinct-refusal-families-for-distinct-operator-actions
    - frozen-instance-as-a-capability-guard
    - canary-as-child-process-so-an-escape-darkens-one-run
    - canary-child-runs-with-the-parent-test-context-stripped
    - regression-guards-for-what-a-rewrite-must-not-change

key-files:
  created:
    - tools/release-close/canary.test.js
  modified:
    - tools/release-close/client.js
    - tools/release-close/fake-client.js

key-decisions:
  - "The extra-member rejection judges own ENUMERABLE, TOP-LEVEL callables only. The plan locks this twice (own enumerable members; inherited and non-enumerable members are not capabilities) and separately forbids the check from descending into nested objects, because descending is indistinguishable from the legitimate bookkeeping the fake exposes — its call log and effect record are arrays and objects. The two routes this leaves open are covered elsewhere and named in code: the frozen instance makes direct attachment a TypeError, and the canary child proves the spread route is caught. Both boundaries are pinned by tests so a future change has to be deliberate."
  - "A non-callable member that holds a callable one level deeper is bookkeeping, not capability, under this contract. The layer that covers that route is not the shape check: it is assertNoMutation, which refuses by MEASURED COUNT at the side-effect boundary regardless of how the call arrived. The canary demonstrates exactly this — the escaped copy is accepted by the shape check and the invariant still refuses."
  - "The trap recorder is non-enumerable and frozen, and is exposed only by makeArmedFakeClient. A non-enumerable callable is outside the exact-surface check by the declared contract, and the cost of that is bounded by what the seam can do: it records, it never acts, so no route through it exists to perform a remote write."
  - "The client is frozen only after assertClientShape has run. Freezing first would make the shape check itself throw on a frozen property, which is the trap the plan warns about."
  - "Two refusal families, distinguished by content and asserted separately: a valid non-zero count is the escaped-effect family, and a missing, negative, fractional or non-numeric measurement is the corrupted-measurement family that must never be reported as an escape. A probe that only asserted TypeError could not tell them apart, which is why the family is what the probes assert."
  - "The canary child is spawned with NODE_TEST_CONTEXT and NODE_TEST_WORKER_ID removed. Inheriting them made the grandchild's own runner believe it was a test child, so the child's failures never reached its exit code and it exited zero no matter what the boundary did — a permanent false green, the worst failure mode a canary can have. It was found by running the canary, not by reading it."
  - "The canary child is spawned on the real fake with the real forbidden capability rather than on a mock, so the escape exercises the actual frozen object, the actual trap and the actual invariant. Its first assertion is that the escaped copy still reports zero, which is what keeps the escape real instead of decorative: it reproduces the CR-04 defect verbatim before the invariant refuses it."
  - "The temporary canary spec is written into the OS temporary directory with a `.mjs` extension and a PID-plus-counter name, so it is unambiguously ESM regardless of the nearest package.json and needs no clock (D-08 stays intact)."

patterns-established:
  - "Exact surface over required methods: presence checks are not contracts. Enumerate what a caller can reach and refuse the rest by name."
  - "Measurement lives at the boundary, not at the renderer. A counter nobody produces is a convention; a counter a trap produces is evidence."
  - "Closure-owned state with read-only accessors: an unexposed tally cannot be rewritten after the fact, and a frozen instance cannot be widened."
  - "A single-parameter invariant has no forgiveness path by construction; the closed module export list makes a reset function impossible to add unnoticed."
  - "Refusal families are an operator interface. Which family fired determines what the operator does next, so the distinction is a contract, not a wording preference."
  - "A canary proves a guard by making the guard fail: spawn the violation in a child process and require a non-zero exit, because an in-process violation would keep the whole suite red and hide a real regression behind a permanently expected failure."

requirements-completed: [SAFE-04, SAFE-02]

coverage:
  - id: D1
    description: "Exact capability surface: the five declared reads plus non-callable bookkeeping is accepted, and any extra own callable is rejected with a PT-BR reason naming the capability and declaring the surface read-only"
    requirement: "SAFE-04"
    verification:
      - kind: unit
        ref: "tools/release-close/canary.test.js#superfície exata: rejeita capacidade extra chamável nomeando-a"
        status: pass
      - kind: unit
        ref: "tools/release-close/canary.test.js#superfície exata: rejeita capacidade extra com nome que nenhuma varredura adivinharia"
        status: pass
      - kind: unit
        ref: "tools/release-close/canary.test.js#superfície exata: rejeita cada leitura ausente nomeando-a"
        status: pass
      - kind: unit
        ref: "tools/release-close/canary.test.js#superfície exata: rejeita leitura cujo valor não é função"
        status: pass
      - kind: unit
        ref: "tools/release-close/canary.test.js#superfície exata: rejeita entrada que não é objeto"
        status: pass
    human_judgment: false
  - id: D2
    description: "READ_METHODS still lists exactly the five original names in the original order, and the fail-closed gh stub is still accepted by the exact check and still throws naming Phase 10"
    requirement: "SAFE-02"
    verification:
      - kind: unit
        ref: "tools/release-close/canary.test.js#contrato: READ_METHODS mantém os cinco nomes na ordem original"
        status: pass
      - kind: unit
        ref: "tools/release-close/canary.test.js#costura gh: o rascunho continua aceito e continua falhando fechado na Fase 10"
        status: pass
    human_judgment: false
  - id: D3
    description: "The documented surface boundary is pinned rather than left implicit: inherited and non-enumerable members are not capabilities, and the rejection does not descend into nested objects"
    requirement: "SAFE-04"
    verification:
      - kind: unit
        ref: "tools/release-close/canary.test.js#superfície exata: membros herdados e não enumeráveis não são capacidades"
        status: pass
      - kind: unit
        ref: "tools/release-close/canary.test.js#superfície exata: a recusa não desce para objeto aninhado, por contrato"
        status: pass
    human_judgment: false
  - id: D4
    description: "The shared invariant accepts a measured count of exactly zero and returns it, and refuses every non-zero count"
    requirement: "SAFE-04"
    verification:
      - kind: unit
        ref: "tools/release-close/canary.test.js#invariante: aceita contagem zero e devolve zero"
        status: pass
      - kind: unit
        ref: "tools/release-close/canary.test.js#invariante: recusa contagem um nomeando a capacidade e a contagem"
        status: pass
      - kind: unit
        ref: "tools/release-close/canary.test.js#invariante: recusa toda contagem diferente de zero sem caminho de perdão"
        status: pass
    human_judgment: false
  - id: D5
    description: "A missing, negative, fractional or non-numeric measurement is refused as a corrupted measurement, never reported as an escaped side effect"
    requirement: "SAFE-04"
    verification:
      - kind: unit
        ref: "tools/release-close/canary.test.js#invariante: recusa medição ausente, negativa, fracionária ou não numérica"
        status: pass
    human_judgment: false
  - id: D6
    description: "There is no reset, forgiveness or tolerance path: the invariant takes a single parameter and the module export list is closed to exactly three symbols"
    requirement: "SAFE-04"
    verification:
      - kind: unit
        ref: "tools/release-close/canary.test.js#invariante: o módulo expõe o invariante compartilhado com um único parâmetro"
        status: pass
      - kind: unit
        ref: "tools/release-close/canary.test.js#invariante: a superfície do módulo é fechada, sem reset nem tolerância"
        status: pass
    human_judgment: false
  - id: D7
    description: "The fake measures side effects through its own trap: an armed trap records the capability and its arguments, increments the closure tally, and the invariant then refuses the measured count"
    requirement: "SAFE-04"
    verification:
      - kind: unit
        ref: "tools/release-close/canary.test.js#arapuca: a armadilha registra o efeito e incrementa a contagem medida"
        status: pass
      - kind: unit
        ref: "tools/release-close/canary.test.js#arapuca: o invariante compartilhado recusa a contagem de uma armadilha armada"
        status: pass
    human_judgment: false
  - id: D8
    description: "The count cannot be edited from outside: the exposed effect record is a frozen copy, pushing to it is a TypeError, and the measurement does not move"
    requirement: "SAFE-04"
    verification:
      - kind: unit
        ref: "tools/release-close/canary.test.js#arapuca: a contagem medida vem do fecho, não de um array público editável"
        status: pass
    human_judgment: false
  - id: D9
    description: "The returned client is frozen after the shape is asserted, so attaching a capability, defining one by descriptor, assigning the count and assigning the record are all TypeError, and no capability survives"
    requirement: "SAFE-04"
    verification:
      - kind: unit
        ref: "tools/release-close/canary.test.js#arapuca: o cliente é congelado e recusa anexar capacidade diretamente"
        status: pass
    human_judgment: false
  - id: D10
    description: "The trap is a named test seam, not a production capability: the production fake exposes none, and arming it does not change the public surface the exact check reads"
    requirement: "SAFE-04"
    verification:
      - kind: unit
        ref: "tools/release-close/canary.test.js#arapuca: a arapuca de produção não expõe a armadilha"
        status: pass
      - kind: unit
        ref: "tools/release-close/canary.test.js#arapuca: armar a armadilha não muda a superfície pública do cliente"
        status: pass
    human_judgment: false
  - id: D11
    description: "The legacy writes member survives as a read-only array-shaped accessor: it returns a frozen array whose length is the measured count, an empty frozen array with nothing observed, and the four out-of-scope fake.writes.length call sites in eligibility.test.js and safe04.test.js stay literally true with no edit to either file"
    requirement: "SAFE-04"
    verification:
      - kind: unit
        ref: "tools/release-close/canary.test.js#arapuca: writes é um acessor somente leitura cuja forma os pontos fora deste plano já esperam"
        status: pass
      - kind: unit
        ref: "tools/release-close/canary.test.js#arapuca: os pontos de leitura de writes.length fora do escopo continuam no lugar"
        status: pass
      - kind: unit
        ref: "tools/release-close/eligibility.test.js#aceita tag anotada quando peel == main == SHA esperado (asserts fake.writes.length === 0, untouched file)"
        status: pass
      - kind: unit
        ref: "tools/release-close/safe04.test.js#nenhum fixture registra escrita: verify e plan emitem mutations 0 (asserts fake.writes.length === 0, untouched file)"
        status: pass
    human_judgment: false
  - id: D12
    description: "What task 2 was forbidden to change still holds: the six scripted outcomes in order, sequence numbers from one, the fixed read ordering, the drained-queue fallback to the snapshot, and the failure-plan TypeErrors"
    requirement: "SAFE-02"
    verification:
      - kind: unit
        ref: "tools/release-close/canary.test.js#arapuca: o vocabulário roteirizado segue com os seis desfechos, na ordem"
        status: pass
      - kind: unit
        ref: "tools/release-close/canary.test.js#arapuca: a numeração de sequência começa em um e sobe de um em um"
        status: pass
      - kind: unit
        ref: "tools/release-close/canary.test.js#arapuca: a ordem das leituras é ref, objeto da tag, cabeça, release, milestones"
        status: pass
      - kind: unit
        ref: "tools/release-close/canary.test.js#arapuca: o roteiro é consumido em ordem e a fila esgotada volta ao snapshot"
        status: pass
      - kind: unit
        ref: "tools/release-close/canary.test.js#arapuca: o plano de falhas continua sendo recusado com TypeError"
        status: pass
    human_judgment: false
  - id: D13
    description: "A deliberately injected forbidden write is structurally rejected, a trapped side effect is measured and refused, and an escaped write makes a scoped child test run exit non-zero with a message naming the detected side effect, leaving no temporary file behind and nothing written into the tool directory"
    requirement: "SAFE-04"
    verification:
      - kind: unit
        ref: "tools/release-close/canary.test.js#canary: o escape real escurece uma execução escopada e nomeia o efeito detectado"
        status: pass
    human_judgment: false
  - id: D14
    description: "The canary's own hygiene: the temporary spec lives in the OS temporary directory outside the tool directory with an unambiguous ESM extension, and no production source under tools/release-close/ names the forbidden capability"
    requirement: "SAFE-04"
    verification:
      - kind: unit
        ref: "tools/release-close/canary.test.js#canary: a especificação temporária vive fora do diretório do tool"
        status: pass
      - kind: unit
        ref: "tools/release-close/canary.test.js#canary: nenhuma fonte de produção nomeia a capacidade proibida"
        status: pass
    human_judgment: false
  - id: D15
    description: "The canary child process cannot be left pending: a failure to terminate fails the parent test rather than hanging the suite, and the temporary spec is removed in a finally path"
    requirement: "SAFE-04"
    verification:
      - kind: unit
        ref: "tools/release-close/canary.test.js#canary: o escape real escurece uma execução escopada e nomeia o efeito detectado (asserts error undefined, signal null, bounded timeout, and existsSync false afterwards)"
        status: pass
    human_judgment: false
  - id: D16
    description: "The fifteen guards this plan adds are load-bearing: a 15-mutation probe of client.js, fake-client.js and the canary child setup makes every mutated guard fail at least one probe, and the sources are byte-identical afterwards"
    verification:
      - kind: other
        ref: "15-mutation probe over client.js, fake-client.js and canary.test.js -> 15/15 caught; client.js and fake-client.js byte-identical afterwards; suite returns to 135/135"
        status: pass
    human_judgment: false
  - id: D17
    description: "The two refusal messages an operator reads for the zero-mutation boundary are legible and name the offending capability, the count and the contract violated, without leaking environment, header or trace material"
    verification: []
    human_judgment: true
    rationale: "No test can assert the quality of operator-facing prose, and turning the message into a substring contract would be a second contract the plan does not ask for. The suite checks only that each message carries the capability name, the count and the read-only declaration. A human should read the two messages once before the Phase 12 runbook quotes them and confirm that an operator who did not write them understands that a corrupt measurement and an escaped side effect call for different actions."

# Metrics
duration: 12 min
completed: 2026-09-25
status: complete
commits: 5
plan_head_before: efb504cd4c80fe92f873ccdfaf0d9613d3a3f6f4
---

# Phase 09 Plan 06: Exact Client Surface, Measured Mutations and a Forbidden-Write Canary Summary

**The read-only capability surface is now exact, the fake's mutation count is a closure-owned measurement that cannot be edited from outside, and a deliberately injected forbidden write provably turns a scoped test run red instead of leaving the suite green**

## Performance

- **Duration:** 12 min
- **Started:** 2026-09-25T17:09:07Z
- **Completed:** 2026-09-25T17:21:31Z
- **Tasks:** 3
- **Files modified:** 3 (1 created, 2 modified)

## Accomplishments

- **VERIFICATION gap 4 is closed at the boundary it names, and advisory CR-04 with it.** `assertClientShape` was a required-methods check, so any callable could sit next to the five reads. It now enumerates own enumerable members and refuses any callable outside `READ_METHODS`, naming the capability in a PT-BR reason that declares the surface read-only. The refusal is structural, not a denylist: `apagar`, `refletir`, `encaminharPara` and `mutacaoRemota` all fall to the same branch, and so would any name no text scan would guess.
- **Zero mutation is now a measurement with a decision attached.** The old `writes` array had no producer and every renderer emitted a literal `0`. The tally and the effect record now live in a closure the module never exposes, one recording function is the only path a side effect must pass through, and `assertNoMutation` turns the measured count into a condition: zero returns, anything else refuses. A missing, negative, fractional or non-numeric measurement is a contract failure, never a pass, and there is no reset, forgiveness or subtraction path by construction — one parameter, and a module export list closed to three symbols.
- **The reproduced defect is now demonstrably dead.** Running the escape end to end: attaching a capability to the returned client is a `TypeError`; spreading the client to bypass the freeze and adding a forbidden write is rejected by the exact surface check by name; and even for a route the shape check cannot see, the escaped copy still reports zero while the measured record refuses with the capability named and the count stated. The canary child performs that escape on purpose, in a scoped process, and the parent requires the non-zero exit.
- **Two files this plan does not own stayed green without being touched.** `eligibility.test.js` and `safe04.test.js` read `fake.writes.length` at five sites. The legacy member survives as a read-only accessor returning a frozen array whose length is the measured tally, so all five assertions stay literally true, and a probe asserts those call sites are still in place so a future migration has to be explicit.
- **The canary caught a real defect in itself, on its first run.** The child process was inheriting `NODE_TEST_CONTEXT` from the parent, which made its own runner believe it was a test child — so its failures never reached its exit code and it exited zero no matter what the boundary did. A permanent false green in the one file whose job is to never be falsely green. The child now runs with the parent's test-runner context stripped, and a mutation that restores the inheritance makes the probe fail.

## Task Commits

Each task followed the RED -> GREEN procedure; task 3 is a test-only canary and is documented under Deviations.

1. **Task 1: exact read-only capability surface plus a shared zero-mutation invariant** - `9b85ad3` (test RED, 8 intentional failures) then `e56dcdf` (feat GREEN)
2. **Task 2: programmable fake with a real side-effect trap and an uneditable measured counter** - `e9d268b` (test RED, 7 intentional failures) then `cbfa0fd` (feat GREEN)
3. **Task 3: forbidden-write canary whose escape turns a scoped test run red** - `d54e9b5` (test; proven load-bearing by a 15-mutation probe)

**Plan metadata:** this commit.

_No REFACTOR commit: both GREEN implementations were written in one cohesive pass, with the surface check, the invariant, the closure, the trap and the freeze already factored; the mutation probe then showed nothing to clean up that was not churn on a costly-to-reverse contract._

## Files Created/Modified

- `tools/release-close/client.js` - the exact-surface `assertClientShape` over own enumerable callables, and the shared `assertNoMutation` invariant with its two refusal families
- `tools/release-close/fake-client.js` - the closure-owned tally and effect record, the single recording function, `makeArmedFakeClient` as the named trap seam, the frozen client, and the `writes` read-only array-shaped accessor
- `tools/release-close/canary.test.js` - the exact-surface group, the invariant group, the fake group, the regression guards, and the child-process forbidden-write canary

## Decisions Made

- **The extra-member rejection judges own enumerable, top-level callables only.** The plan locks this twice and separately forbids descending into nested objects, because descending is indistinguishable from the bookkeeping the fake legitimately exposes — its call log and effect record are arrays and objects. The two routes this leaves open are covered elsewhere and named in the code: the frozen instance makes direct attachment a `TypeError`, and the canary child proves the spread route is caught. Both boundaries are pinned by tests so that changing them has to be deliberate.
- **A non-callable member holding a callable one level deeper is bookkeeping, not capability, under this contract.** The layer that covers that route is not the shape check but `assertNoMutation`, which refuses by measured count at the side-effect boundary regardless of how the call arrived. The canary shows exactly this: the escaped copy is accepted by the shape check and the invariant still refuses.
- **The trap is non-enumerable, frozen, and reachable only through `makeArmedFakeClient`.** A non-enumerable callable is outside the exact-surface check by the declared contract, and the cost of that is bounded by what the seam can do: it records, it never acts, so no route through it exists to perform a remote write.
- **The client is frozen only after the shape is asserted.** Freezing first would make `assertClientShape` itself throw on a frozen property, which is the trap the plan warns about.
- **Two refusal families, asserted separately, because they demand opposite operator actions.** A valid non-zero count is the escaped-effect family; a corrupt measurement is the corrupted-measurement family and must never be reported as an escape, since no write was observed and reporting otherwise sends the operator hunting for one that never happened. A probe that asserted only `TypeError` could not tell them apart — that is exactly the escaping probe the mutation probe found, and the fix is that the family, not the type, is what the probes assert.
- **The canary child is spawned with `NODE_TEST_CONTEXT` and `NODE_TEST_WORKER_ID` removed.** Inheriting them made the grandchild runner believe it was a test child, so the child's failures never reached its exit code. Found by running the canary, not by reading it.
- **The canary child runs on the real fake with the real forbidden capability, not on a mock.** Its first assertion is that the escaped copy still reports zero, which reproduces CR-04 verbatim and keeps the escape real; only then does the invariant refuse it.
- **The temporary spec uses a `.mjs` extension and a PID-plus-counter name** so it is unambiguously ESM regardless of the nearest `package.json`, with no clock involved (D-08 intact).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] The canary child inherited `NODE_TEST_CONTEXT` and exited zero regardless of the escape**
- **Found during:** Task 3 (first execution of the canary)
- **Issue:** Node publishes `NODE_TEST_CONTEXT=child-v8` and `NODE_TEST_WORKER_ID` into the environment of every test file, so that a `test()` called in a child process knows its context. The canary's `spawnSync` inherited both, and the grandchild's own runner then believed it was a test child rather than a root: its failures stopped reaching the exit code and it terminated with status 0 no matter what the boundary did. The parent assertion `assert.notEqual(resultado.status, 0)` therefore failed on the very first run — the canary was a permanent false green, which is the worst failure mode the file exists to prevent, and it would have shipped looking green.
- **Fix:** Added `ambienteDeProcessoLimpo()`, which removes both variables from the child's environment, and documented in the test why: the child must be a root process for a failing `it()` to reach its exit code. A mutation that restores the inheritance now makes the canary probe fail, so the fix is proven load-bearing.
- **Files modified:** `tools/release-close/canary.test.js`
- **Verification:** mutation "o processo filho do canary herda NODE_TEST_CONTEXT" -> 1 failure; the standalone reproduction of the inheritance returns status 0 with a spec that fails on purpose, and 1 with the context removed.
- **Committed in:** `d54e9b5`

**2. [Rule 1 - Bug] The measurement-validation probe was vacuous: both refusal paths throw `TypeError`**
- **Found during:** Task 3 (mutation probe)
- **Issue:** Mutation 3 of the probe — removing the non-negative-integer validation from `assertNoMutation` — changed no test outcome. The probe only asserted that an invalid measurement throws `TypeError`, and with the validation removed every invalid value still threw, just with the escape-family message instead of the measurement-family one. This is the same escaping-probe class 09-05 found when the `ci.targetSha` guard was masked by the per-record comparison: the probe could not distinguish two paths that share an outcome.
- **Fix:** Introduced two predicates, `escapou` and `medicaoCorrompida`, and made the probes assert the refusal FAMILY rather than the exception type. A corrupt measurement must be refused without claiming a side effect escaped, because the two demand opposite operator actions; a valid non-zero count must be refused as an escape. Re-probing the same mutation now fails 1 test, and the count-one and count-many probes were tightened at the same time.
- **Files modified:** `tools/release-close/canary.test.js`
- **Verification:** re-probe of mutation 3 -> 1 failure (`invariante: recusa medição ausente, negativa, fracionária ou não numérica`); the mutation probe is now 15/15 caught.
- **Committed in:** `d54e9b5`

**3. [Rule 1 - Bug] The nested-capability probe asserted a contract the plan forbids**
- **Found during:** Task 1 (GREEN)
- **Issue:** A first draft of the exact-surface probe asserted that an array-shaped member such as `saida: ['v0.1.1']` is rejected as a capability. It is not, and it must not be: `typeof` an array is `'object'`, the plan permits non-callable own members precisely so the fake can expose its call log and its counter, and it forbids the rejection from descending into nested objects. The probe was wrong, not the implementation.
- **Fix:** Split the probe. One now covers differently named callables (`apagar`, `refletir`, `encaminharPara`, `mutacaoRemota`); the other pins the declared boundary as a deliberate fact — a non-callable member holding a callable deeper down is bookkeeping under this contract, and the layer that covers that route is the invariant's measured count, not the shape check.
- **Files modified:** `tools/release-close/canary.test.js`
- **Verification:** both probes pass; the plan's stated goal and its specified mechanism are now both recorded rather than one of them being quietly dropped.
- **Committed in:** `e56dcdf`

### Procedure Deviations

**4. [Rule 2 - Missing Critical] Task 3 produced no RED commit, and was proven load-bearing by a 15-mutation probe**
- **Found during:** Task 3
- **Issue:** Task 3 declares `tdd="true"` but its own action states it "adds nothing else to production source". TDD's fail-fast rule 1 fired and the investigation confirmed why: every behavior the canary asserts — the exact-surface rejection, the measured tally, the frozen instance, the shared invariant — was already implemented by this same plan's task 1 and task 2 RED/GREEN cycles. No intentional red was producible without fabricating a failure or editing production code the plan forbids touching. A second route was considered and rejected: a RED built on a non-enumerable callable would have required changing the shape check to enumerate all own property names, which the plan explicitly forbids.
- **Fix:** Ran the investigation the fail-fast rule requires, then replaced the ceremonial red with a stronger artifact. Fifteen mutations of `client.js`, `fake-client.js` and the canary child setup were probed — removing the extra-callable rejection, giving the invariant a one-mutation tolerance, removing the measurement validation, removing the freeze, returning the live effect record, exposing the trap in the production fake, making the trap non-counting, having the child inherit `NODE_TEST_CONTEXT`, making the shape check reject every callable, stopping the declared-reads loop at the first entry, returning `undefined` instead of zero, exporting a reset function, dropping the `rmSync` in `finally`, and writing the temporary spec inside the tool directory. All fifteen were caught, with one escaping on the first round (deviation 2) and one real defect found along the way (deviation 1). `client.js` and `fake-client.js` were restored byte-identical and the suite returned to 135/135.
- **Files modified:** `tools/release-close/canary.test.js` (commit `d54e9b5`); the temporary mutations were reverted and never committed.
- **Verification:** `git diff --exit-code tools/release-close/client.js tools/release-close/fake-client.js` clean after the probe.
- **Recorded in:** `.planning/WINDOWS.md` as an open `deviation` entry so the ship gate can see it.

**5. [TDD ordering note] The task-1 and task-2 RED commits carry the test groups for tasks 1, 2 and 3 in one file**
- **Found during:** Tasks 1 and 2
- **Issue:** The plan declares exactly three `files_modified` — `client.js`, `fake-client.js`, `canary.test.js` — and `canary.test.js` is task 3's file. The plan also requires tasks 1 and 2 to carry their behavior probes, and no fourth file is in scope. The tests for tasks 1 and 2 therefore live in `canary.test.js`, which task 3 then extends with the child-process group.
- **Fix:** None needed; the end state is what the plan asks for and the file header documents the three groups and which task owns each. The only consequence is on the commit log: task 3's commit is additive to a file that already exists, which is also the mechanical reason its RED was not producible (deviation 4).

**6. [Placement note] Every probe is a top-level `it()`, with no `describe` anywhere in the file**
- **Found during:** Tasks 1 and 2
- **Issue:** The nesting constraint inherited from 09-04 and 09-05 applies: node indents nested TAP subtests, so `check tdd-red-evidence` cannot see a target test inside a `describe`. A file organized by group reads as if it should nest.
- **Fix:** The groups are delimited by banner comments instead of `describe` blocks, and the file header states the convention as mandatory with the reason, so a later plan adding a probe inherits it rather than rediscovering it.

---

**Total deviations:** 6 auto-fixed (3 bugs, 1 missing-critical procedure, 2 TDD/placement notes)
**Impact on plan:** Deviations 1 and 2 were essential: one shipped a canary that could never fail, the other shipped an unproven guard with a probe that could not tell two refusal paths apart. Deviation 3 changed a test to match the locked contract rather than the reverse, and it is the reason the array-shaped and nested-capability boundaries are now documented instead of silently assumed. Deviations 4, 5 and 6 changed no production behavior and cost no scope; the cost is that the commit log shows no RED for task 3.

## Issues Encountered

- **`NODE_TEST_CONTEXT` made the canary's own child incapable of failing.** Found by running the canary, not by reading it, and the parent assertion is what surfaced it. This is worth remembering beyond this plan: any test that spawns `node --test` from inside a `node --test` run must strip the parent's test-runner context, or the grandchild reports success unconditionally. Resolved as deviation 1.
- **The measurement-validation guard was unproven.** Removing it changed nothing observable, because the escape-family throw covers every invalid value too. The guard is load-bearing for the refusal the operator reads, not for whether a refusal happens at all. Resolved as deviation 2.
- **The plan's goal and its specified mechanism disagree about array-shaped capabilities.** The action text says a "differently named or array-shaped write capability cannot slip through", while the mechanism it then specifies rejects only callables, and separately forbids descending. An array is not a callable, so under the specified mechanism an array-shaped capability is bookkeeping. I followed the mechanism — it is stated twice and is the only reading under which the fake can expose its call log — and recorded the boundary with tests and a threat flag rather than quietly widening the check. Flagging it for the planner in case the intent was a deeper check.
- **A test-side helper had a parameter and a body that differed by a letter transposition** (`medicao` against `mediacao`), which renders near-identically and failed as a `ReferenceError` — a probe crash, not an assertion. Rewritten with a non-confusable ASCII name and a comment explaining why, so the next plan does not repeat it.

## TDD Gate Compliance

| Plan | RED | GREEN | REFACTOR | Status |
|------|-----|-------|----------|--------|
| 09-06 task 1 | `9b85ad3` (RED_EVIDENCE_OK, `target_test_failed`, 8 top-level assertion failures, 7 frozen probes still passing) | `e56dcdf` | none needed | Pass |
| 09-06 task 2 | `e9d268b` (RED_EVIDENCE_OK, `target_test_failed`, 7 top-level assertion failures, 22 frozen probes still passing) | `cbfa0fd` | none needed | Pass |
| 09-06 task 3 | none producible (test-only; see deviation 4) | `d54e9b5` (canary proven by a 15-mutation probe) | n/a | Deviation documented |

## Verification

- `node --test tools/release-close/canary.test.js` -> 32 tests, 32 pass, 0 fail, exit 0
- `node --test tools/release-close/` -> 135 tests, 135 pass, 0 fail, exit 0 (baseline before this plan was 103; the four out-of-scope `fake.writes.length` assertions in `eligibility.test.js` and `safe04.test.js` are among the 32 that stayed green untouched, and the classifier, gate, no-write and SAFE-04 suites show no regression)
- Manual probe, attaching an extra callable to the frozen client -> `TypeError: Cannot add property createRelease, object is not extensible`
- Manual probe, spreading the client to bypass the freeze -> `TypeError: Superfície de cliente inválida: capacidade extra "createRelease" não pertence aos cinco métodos de leitura`; the measured count is 1, the escaped copy still reports 0, and `assertNoMutation` refuses naming the capability and the count
- `git diff --name-only efb504c..HEAD` -> exactly the three declared `files_modified`; `eligibility.test.js`, `safe04.test.js`, `classify.js`, `classify.test.js`, `release-close.js`, `gh-client.js`, `nowrite.test.js` and every file under `fixtures/` confirmed untouched
- `tools/release-close/package.json` still declares no `dependencies` key; no runner, assertion library or dependency was added; no npm install ran in any task (T-09-06-SC)
- The forbidden capability name appears only in `canary.test.js`; a probe scans every non-test source under `tools/release-close/` and fails if any names it
- `nowrite.test.js` untouched and still green: the static scan remains the complementary check and is not replaced by the canary
- The canary child runs with a bounded 60s timeout, a `rmSync` in a `finally` path, and parent assertions that a spawn error or a signal fails the parent rather than hanging the suite; after a clean run no `release-close-canary-*.mjs` remains in the temporary directory, and the tool tree is byte-identical before and after (path and size, recursively)
- No `TODO`, `FIXME`, placeholder text, `test.skip` or `test.todo` in any changed file
- 15-mutation probe: 15/15 caught, `client.js` and `fake-client.js` byte-identical afterwards, suite back to 135/135

## Known Stubs

None. This plan adds no placeholder value, no disconnected data source and no skipped test. `WINDOWS.md` carries one new open `deviation` entry describing deviation 4, which is a process record about the commit log, not a stub in the code.

## Threat Flags

| Flag | File | Description |
|------|------|-------------|
| threat_flag: non-enumerable-callable-outside-the-surface-check | `tools/release-close/client.js` | The exact check enumerates own **enumerable** members, as the plan specifies twice, so a callable installed with `Object.defineProperty(obj, name, { value, enumerable: false })` is not treated as a capability. The cost is bounded by what the trap seam is: it records and never acts, so the one non-enumerable callable in the repository cannot perform a remote write. A future plan that needs a non-enumerable callable should say so deliberately, and the pinned probe makes any change visible. |
| threat_flag: nested-capability-holder-is-bookkeeping | `tools/release-close/client.js` | A non-callable own member that holds a callable one level deeper (an object or an array of functions) is accepted as bookkeeping, because descending is indistinguishable from the fake's legitimate call log and effect record and the plan forbids descending. Such a holder is not caught by the shape check. It IS caught by the measured count, which the canary demonstrates end to end, so the boundary is the invariant and not the shape — a consumer that enforces only the shape would be weaker than this one. |
| threat_flag: renderers-still-emit-a-literal-zero | `tools/release-close/release-close.js` | This plan supplies the measurement and the invariant; `release-close.js` still renders `mutations: 0` as a literal in `buildClosePlan`, `renderPlanText`, `renderVerifyText` and `renderVerifyJson`, and does not retain the client. Plan 09-07 owns removing the literal and asserting the reported value is the measured one (T-09-06-03). Until then the CLI's counter is still tautological, and the closed boundary in this plan is only reachable from the contracts, not from the rendered output. |
| threat_flag: canary-child-environment-must-stay-stripped | `tools/release-close/canary.test.js` | The canary is only meaningful while the child runs with `NODE_TEST_CONTEXT` and `NODE_TEST_WORKER_ID` removed. Reintroducing the inheritance makes the grandchild exit zero unconditionally and the canary a permanent false green. A mutation probe covers it, but it is an environmental property rather than a value the code can assert about itself, so it depends on the probe being re-run when the child setup changes. |
| threat_flag: unexposed-tally-has-no-production-producer-yet | `tools/release-close/fake-client.js` | The trap is the only path a side effect can take, and in Phase 9 nothing calls it: the exact-surface check rejects every extra callable, so no production path can route through the trap. The count is therefore necessarily zero in production, which is correct but means the measurement is currently exercised only by the canary and the armed seam. When Phase 10 wires the live `gh` client or Phase 11 adds reconciliation writes, the write path must be the trap and not a separate route, or the measurement stops covering the real path. |

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- **The zero-mutation claim has a boundary to attach to.** `assertNoMutation` and the closure-owned tally are the seam plan 09-07 needs: 09-07 task 2 keeps the fake, retains the client, and removes the literal `mutations: 0` from the three renderers and `buildClosePlan`, asserting the reported value is the measured one. `client.js` must export exactly the three symbols it exports now, or the closed-surface probe in `canary.test.js` breaks — a useful tripwire, not an obstacle.
- **The compatibility seam has an explicit migration rule.** `writes` is a read-only accessor returning a frozen array whose length is the tally, consumed at five call sites in `eligibility.test.js` and `safe04.test.js`. Those files are outside this plan's scope and stayed untouched. If a later plan replaces the accessor, it must migrate all five call sites explicitly and add both files to its own `files_modified`; the probe "os pontos de leitura de writes.length fora do escopo continuam no lugar" fails the moment a call site disappears, which is the intended tripwire.
- **The scripted-failure contract 09-09 depends on is unchanged and now guarded.** The six outcomes in order, sequence numbers from one, the fixed read ordering, the drained-queue fallback and the failure-plan TypeErrors all have explicit regression probes in this plan's file, so a 09-09 change to any of them fails here first.
- **The `reference.json` shape discriminator is untouched.** This plan reads the frozen fixture and rewrites none of them, so 09-05's ownership of the canonical CI block and the `Array.isArray(snapshot.milestones)` discriminator are unaffected.
- **Two boundaries are documented rather than closed, and both are named above as threat flags:** the non-enumerable callable and the nested-capability holder. Neither can perform a remote write in Phase 9, and the measured count catches both, but Phase 10's live client and Phase 11's writes should re-read the two flags before adding any callable to the surface.
- **Unchanged from before this plan:** Phase 9 still carries the other verification gap groups (human-visible reviewed-content apply gating and production failure/re-read coverage) and must not be closed until verification passes. Real cross-process arbitration (REC-05) stays in Phase 11.
- One named human-judgment item remains for UAT: reading the two zero-mutation refusal messages once before the Phase 12 runbook quotes them, and confirming an operator understands that a corrupt measurement and an escaped side effect call for different actions (D17).

## Self-Check: PASSED

- Key files confirmed on disk: all three changed paths, including the created `canary.test.js`
- All five task commits confirmed present: `9b85ad3`, `e56dcdf`, `e9d268b`, `cbfa0fd`, `d54e9b5`
- Every `<acceptance_criteria>` of all three tasks re-run and passing. Task 1 source (`assertClientShape` enumerates own members at line 60 and refuses extra callables by name at line 63; the invariant's only comparison is `contagem === 0` at line 93 with no reset, forgiveness or arithmetic anywhere in the module; `READ_METHODS` still the five original names in order); task 1 behavior (extra callable rejected by name with the read-only declaration, four differently named callables rejected, each missing read rejected by name, non-function read rejected, non-object input rejected, zero accepted and returned, count one refused naming capability and count, every non-zero count refused, invalid measurement refused as a corrupted measurement, closed export list, gh stub still accepted and still failing closed on Phase 10); task 2 source (tally and record in a closure, shape asserted at line 176 before `Object.freeze` at line 177, `writes` accessor returning a frozen copy at lines 141-143, module exports exactly the three expected symbols); task 2 behavior (armed trap increments and records capability and args, invariant refuses the measured count, exposed record frozen and immutable, frozen client rejects attachment, defineProperty, count assignment and record assignment, production fake exposes no trap, arming does not change the public surface, `writes` array shape and its length equal the tally, the five out-of-scope call sites still read zero with both files untouched, the six scripted outcomes and ordering and fallback and plan TypeErrors unchanged); task 3 test (the canary child exits non-zero with the side effect named, the temporary spec lives outside the tool directory and is removed in a finally path, no production source names the forbidden capability, a spawn error or signal fails the parent); task 3 source (no production file under `tools/release-close/` names the forbidden capability; the temporary path is outside the tool directory)

---
*Phase: 09-release-close-contract-fixtures*
*Completed: 2026-09-25*
