---
phase: 09-release-close-contract-fixtures
plan: "07"
subsystem: infra
tags: [node-test, esm, release-close, safe-04, safe-02, import-safety, injected-streams, five-read-seam, measured-mutations, fail-closed]

# Dependency graph
requires:
  - phase: 09-release-close-contract-fixtures
    provides: "strict annotated-tag peel and the PERMISSION/UNAVAILABLE/MALFORMED/TRANSPORT vocabulary (09-04); five-key snapshot contract, positive CI allowlist and target-scoped classification over the frozen fixtures (09-05); exact read-only capability surface, the shared zero-mutation invariant and the programmable fake's measured counter (09-06)"
provides:
  - "An import-safe CLI entrypoint: the verb runs only in the entry-script case, the return value is assigned to process.exitCode instead of terminating, and the exported entry takes its streams by argument so an importing process sees no output and survives (WR-04)"
  - "fluxosPadrao as the single place that reaches the process stream globals, resolved at call time, so no renderer writes to them directly"
  - "decide, the exported production decision seam, taking { snapshot, client, version, expectedSha, ci } and walking all five declared reads in the fixed order: three eligibility reads through checkTagEligibility, then getReleaseByTag and listMilestones"
  - "buildCloseEvidence, the exported production evidence builder, emitting exactly the five-key contract with a named source per value and never constructing, defaulting or inferring a ci block"
  - "The literal mutations: 0 removed from the plan object and all three renderers; the reported number is the client's measured count, validated by the shared invariant inside the decision before any render, with no fallback that renders zero"
  - "RecusaDoInvariante, an error class that keeps a mutation refusal out of the invalid-input bucket, so an escaped side effect and a corrupted measurement keep the two distinct operator actions 09-06 established"
  - "A production-adapter suite that drives the real seam over all eight frozen scenarios, all eleven CI blocking families, target scoping, idempotency, instance isolation and the widened import surface"
  - "A refreshed no-live-integration declaration that also names the two taxonomy states the production path cannot reach before the reconciliation seam supplies them"
affects: [09-08 reviewed-content gate wiring, 09-09 reconciliation seam, phase-10 live gh client, phase-11 reconciliation, phase-12 runbook, phase-13 live recovery]

# Actuals (#2632) — pairs with the plan's `estimate` to calibrate future estimates.
actuals:
  tokens: 16498
  tasks: 3
  commits: 5

# Tech tracking
tech-stack:
  added: []
  patterns:
    - entry-script-detection-over-module-url
    - assign-the-exit-code-never-terminate
    - inject-streams-defaulting-lazily-at-call-time
    - one-production-seam-that-walks-every-declared-read
    - name-the-source-of-every-value-the-builder-emits
    - measure-then-render-the-invariance-upstream-of-any-renderer
    - refusal-class-per-operator-action
    - expected-values-derived-from-documented-precedence-not-observed-output
    - source-guards-that-read-code-not-prose

key-files:
  created:
    - tools/release-close/evidence.test.js
  modified:
    - tools/release-close/release-close.js
    - .planning/phases/09-release-close-contract-fixtures/COVERAGE.md

key-decisions:
  - "The three eligibility reads are NOT re-read after checkTagEligibility. Re-reading them to capture the envelopes would have inflated the call log to seven calls and destroyed the very proof this plan exists to produce: that the production path walks the five declared reads. The five-key evidence contract has no place for tag identities, so there is nothing to capture; the two reads that the contract DOES need are performed explicitly and unconditionally."
  - "tagSha and commitSha keep coming from the snapshot's tag envelopes, deliberately. reference.json is a client-shaped snapshot, so those are the same bytes the client served and the three eligibility reads already proved byte for byte. They are plan-display fields, never classification evidence. The alternative — smuggling the envelopes out through a recording proxy — would have defeated assertClientShape, which is the point of that check."
  - "The mutation refusal gets its own error class instead of a message-prefix branch. Routing it through the existing TypeError handler would have labelled an escaped side effect as invalid input, which is precisely the family conflation 09-06's second deviation removed. Branching on the message text would have re-implemented the family's classification; a class that carries the invariant's PT-BR reason across untouched keeps one implementation of that classification."
  - "closeMarkers stays the empty list and failedRunIds has no source at all, so CONCURRENT and FAILED-by-explicit-red-run are unreachable through the production path in this phase. That is asserted with its exact reachable value rather than left implied, and recorded in COVERAGE.md as a handoff to 09-09 and to the Phase 11 marker vocabulary. Adding a read for either would be a new client capability and an architectural change, which is out of scope for this plan's files."
  - "The two static scans read code, not prose. The green-CI guard strips comments first, because the comment documenting the removal of the synthesized green state names that literal in full and a raw text scan was accusing its own documentation. The invariant-ordering guard resolves the wrapper structurally — whoever encloses the call to assertNoMutation — so it survives 09-08 reformatting the module."
  - "Expected classification values are derived from the classifier's documented precedence, never read from observed output. A case whose expectation came from the implementation is a tautology, and a tautology cannot catch a regression; the CONCURRENT and FAILED scenarios are the sharpest case, since their asserted value is deliberately not the state's own name."
  - "Every probe that calls into release-close.js goes through a typeof assertion on the exports first, and every import-safety probe runs in a child process. Without the typeof guard a missing export surfaces as 'not a function', which is a probe crash rather than a failure describing the missing behavior; without the child process an import regression would take the whole runner down, which is zero-test discovery and therefore INVALID_RED."

patterns-established:
  - "An import must have no side effect: the entry script is detected by comparing the module URL against the resolved entry path, and the guard is the only place the verb ever runs."
  - "Assign process.exitCode instead of terminating, because process.exit truncates buffered output on the piped paths the SAFE-04 suite exercises — import safety and output integrity are the same fix."
  - "One seam, all the reads. When a pure contract's evidence is assembled outside it, the defect is invisible; the seam that reads is the seam that must be tested."
  - "Name the source of every value a builder emits. A value with no named source is a value the tool can eventually invent."
  - "Measure at the boundary and validate upstream of every renderer, so a non-zero count refuses the run instead of being printed."
  - "The refusal family is an operator interface, and it must survive the trip through the caller's error handling."

requirements-completed: [OPS-01, OPS-02, SAFE-02, SAFE-04]

coverage:
  - id: D1
    description: "Importing the CLI module in another process prints nothing, terminates nothing and leaves the importing process alive, with the exported helpers reachable"
    requirement: "OPS-01"
    verification:
      - kind: unit
        ref: "tools/release-close/evidence.test.js#importar o módulo não imprime nada, não termina o processo e devolve os helpers"
        status: pass
      - kind: unit
        ref: "tools/release-close/evidence.test.js#a importação da CLI expõe a superfície alargada sem imprimir nada"
        status: pass
    human_judgment: false
  - id: D2
    description: "The exported entry writes help, verify, plan, apply and both refusals into injected sinks while the real process streams stay untouched, and the exit codes are unchanged (0,0,0,0,0,1,1,2,2)"
    requirement: "OPS-01"
    verification:
      - kind: unit
        ref: "tools/release-close/evidence.test.js#a entrada exportada escreve tudo nos sinks injetados e não toca os fluxos do processo"
        status: pass
    human_judgment: false
  - id: D3
    description: "Running the module as a script keeps the operator surface byte-for-byte: no verb returns zero with usage on stdout, an unknown verb returns two with usage on stderr, and verify on the frozen baseline returns zero with nothing on stderr"
    requirement: "OPS-01"
    verification:
      - kind: unit
        ref: "tools/release-close/evidence.test.js#sem verbo a CLI imprime o uso na saída e devolve zero"
        status: pass
      - kind: unit
        ref: "tools/release-close/evidence.test.js#verbo desconhecido devolve dois com o uso no fluxo de erro"
        status: pass
      - kind: unit
        ref: "tools/release-close/evidence.test.js#verify no baseline congelado devolve zero e não escreve no fluxo de erro"
        status: pass
      - kind: unit
        ref: "tools/release-close/safe04.test.js#a CLI recusa com pipe mesmo com a flag --yes e não pergunta nada (untouched file, still green)"
        status: pass
    human_judgment: false
  - id: D4
    description: "Source-level: no process.exit, no direct write to the process stream globals, the CLI invocation behind the entry guard, the exit code assigned rather than thrown, and every access to process.stdout/process.stderr confined to fluxosPadrao"
    requirement: "SAFE-04"
    verification:
      - kind: unit
        ref: "tools/release-close/evidence.test.js#a fonte não termina o processo, não escreve nos fluxos do processo e só roda o verbo como entrada"
        status: pass
    human_judgment: false
  - id: D5
    description: "buildCloseEvidence is exported and emits exactly the five-key contract, with target from the resolved version and SHA, ci copied through byte for byte, releases normalized without collapsing, milestones retained whole, and closeMarkers the empty list"
    requirement: "OPS-02"
    verification:
      - kind: unit
        ref: "tools/release-close/evidence.test.js#o construtor de evidência de produção é exportado e monta as cinco chaves com a fonte nomeada de cada valor"
        status: pass
      - kind: unit
        ref: "tools/release-close/evidence.test.js#o construtor de evidência retém os dois registros de release e os dois números de milestone"
        status: pass
    human_judgment: false
  - id: D6
    description: "The production decision runs all five declared reads in the fixed order with sequence numbers one through five, and no read is bypassed"
    requirement: "SAFE-02"
    verification:
      - kind: unit
        ref: "tools/release-close/evidence.test.js#a decisão de produção executa as cinco leituras declaradas na ordem fixa, com sequência de um a cinco"
        status: pass
      - kind: unit
        ref: "tools/release-close/evidence.test.js#os oito cenários congelados atravessam a costura de produção com valores exatos e cinco leituras ordenadas"
        status: pass
    human_judgment: false
  - id: D7
    description: "The duplicate and conflicting states reach their exact codes through the production seam with both release identifiers retained, and every matching Milestone number survives"
    requirement: "OPS-02"
    verification:
      - kind: unit
        ref: "tools/release-close/evidence.test.js#o caminho de produção classifica a duplicata com os dois identificadores retidos"
        status: pass
      - kind: unit
        ref: "tools/release-close/evidence.test.js#o caminho de produção classifica o conflito com os dois identificadores retidos"
        status: pass
      - kind: unit
        ref: "tools/release-close/evidence.test.js#o escopo de alvo retém os dois números de milestone que nomeiam a versão pedida"
        status: pass
    human_judgment: false
  - id: D8
    description: "Target scoping happens in production: the decision reason names only the target records and the retained-unrelated field lists the others"
    requirement: "SAFE-02"
    verification:
      - kind: unit
        ref: "tools/release-close/evidence.test.js#o escopo de alvo nomeia só os registros do alvo e retém os alheios"
        status: pass
    human_judgment: false
  - id: D9
    description: "CI evidence is the frozen block copied through: it does not block the baseline, a cancelled conclusion blocks with CI-CANCELLED and applyLiberado false, a missing block refuses as invalid input, and no non-test source synthesizes a green state"
    requirement: "SAFE-04"
    verification:
      - kind: unit
        ref: "tools/release-close/evidence.test.js#a CI congelada atravessa o classificador sem ser reconstruída e sem bloquear o baseline"
        status: pass
      - kind: unit
        ref: "tools/release-close/evidence.test.js#o construtor de evidência nunca inventa um bloco ci ausente"
        status: pass
      - kind: unit
        ref: "tools/release-close/evidence.test.js#nenhuma fonte não-teste do tool island sintetiza um estado verde de CI"
        status: pass
      - kind: unit
        ref: "tools/release-close/evidence.test.js#cada família de CI bloqueada força o apply liberado a falso e nomeia a sua família (11 families)"
        status: pass
      - kind: unit
        ref: "tools/release-close/evidence.test.js#cada família de CI bloqueada libera zero release e a evidência de release continua inteira (11 families)"
        status: pass
    human_judgment: false
  - id: D10
    description: "The completed no-op surfaces as the exact pair MISSING plus COMPLETE_NOOP, and reports applyLiberado true because MISSING is not a blocking code — one name, one meaning, never re-derived"
    requirement: "OPS-02"
    verification:
      - kind: unit
        ref: "tools/release-close/evidence.test.js#o no-op concluído aparece como o par exato MISSING e COMPLETE_NOOP e ainda assim libera apply"
        status: pass
      - kind: unit
        ref: "tools/release-close/evidence.test.js#o cenário de conclusão completa chega como o par exato MISSING e COMPLETE_NOOP"
        status: pass
    human_judgment: false
  - id: D11
    description: "The reported mutation count is the client's measured count and never a literal: no implementation source carries a literal, and plan --json carries the target, the frozen ci block, the retained identifier lists and the measured count"
    requirement: "SAFE-04"
    verification:
      - kind: unit
        ref: "tools/release-close/evidence.test.js#a contagem relatada é a contagem medida do cliente e nunca um literal"
        status: pass
    human_judgment: false
  - id: D12
    description: "A non-zero measured count refuses the run with the shared invariant's PT-BR reason, a missing measurement refuses as the corrupted-measurement family rather than as an escape, and the invariant runs inside the decision before any renderer is reached"
    requirement: "SAFE-04"
    verification:
      - kind: unit
        ref: "tools/release-close/evidence.test.js#uma contagem medida diferente de zero recusa a execução com o motivo do invariante compartilhado"
        status: pass
      - kind: unit
        ref: "tools/release-close/evidence.test.js#o invariante compartilhado roda na decisão, antes de qualquer renderização"
        status: pass
    human_judgment: false
  - id: D13
    description: "Two decision runs over the same frozen snapshot render byte-identical plan text and JSON with the measured count zero both times, and two clients share neither call log nor counter"
    requirement: "OPS-01"
    verification:
      - kind: unit
        ref: "tools/release-close/evidence.test.js#a decisão é idempotente: duas execuções sobre o mesmo snapshot congelado rendem payloads byte-idênticos"
        status: pass
      - kind: unit
        ref: "tools/release-close/evidence.test.js#dois clientes são isolados: o segundo não registra chamada nem contagem depois da decisão no primeiro"
        status: pass
    human_judgment: false
  - id: D14
    description: "The two taxonomy states the production path cannot reach are asserted with their exact reachable value and named in the coverage declaration, so the boundary is recorded rather than assumed"
    requirement: "OPS-02"
    verification:
      - kind: unit
        ref: "tools/release-close/evidence.test.js#os dois estados que a costura de produção ainda não alcança estão declarados, não implícitos"
        status: pass
    human_judgment: false
  - id: D15
    description: "The guards this plan adds are load-bearing: a 14-mutation probe of release-close.js makes every mutated guard fail at least one scoped probe, and the source is byte-identical afterwards"
    requirement: "SAFE-04"
    verification:
      - kind: other
        ref: "14-mutation probe over release-close.js -> 14/14 caught; release-close.js byte-identical afterwards (sha256 verified); suite returns to 164/164"
        status: pass
    human_judgment: false
  - id: D16
    description: "The four operator-facing messages this plan routes differently — the zero-mutation refusal family, the invalid-input prefix, the CI-blocked plan text and the completed-no-op pair — read as a coherent set for an operator who did not write them"
    verification: []
    human_judgment: true
    rationale: "No test can assert that a set of PT-BR messages reads coherently, and turning prose into substring contracts would add a second contract the plan does not ask for. The suite pins what is mechanically checkable: each message carries the capability, the count or the state it names, and the mutation refusal is never routed through the invalid-input prefix. A human should read the four once before the Phase 12 runbook quotes them, and confirm in particular that an operator reading the mutation refusal can tell a corrupted measurement from an escaped side effect, since those two call for opposite actions."

# Metrics
duration: 13 min
completed: 2026-09-25
status: complete
commits: 5
plan_head_before: 6224dc0a2780d4bbc76e659fe49f2b7e6af972f3
---

# Phase 09 Plan 07: Import-Safe Entrypoint, Five-Read Production Decision and Measured Mutation Count Summary

**The CLI now imports without a side effect, its production decision walks all five declared reads through the injected client with target-scoped evidence and the frozen CI block copied through, and the mutation count an operator reads is a measurement that a non-zero value refuses — closing the production half of VERIFICATION gaps 2 and 3 and the propagation half of gap 4**

## Performance

- **Duration:** 13 min
- **Started:** 2026-09-25T17:29:30Z
- **Completed:** 2026-09-25T17:42:38Z
- **Tasks:** 3
- **Files modified:** 3 (1 created, 2 modified)

## Accomplishments

- **WR-04 is dead, and closing it stopped truncating piped output as a side effect.** `decide` used to run at import time and call `process.exit`, so `await import('…/release-close.js')` printed help and killed the importer before the importing statement could continue — the exported plan helpers were untestable and unusable downstream. The verb now runs only when the module's own URL matches the resolved entry path, and the return value is assigned to `process.exitCode`. The same change removes the truncation that `process.exit` caused on the piped paths the SAFE-04 suite exercises, which is why the two halves of the fix are one fix. The exported entry takes its streams by argument, so a caller that injects its own sinks sees every byte in the sinks and the real process streams stay empty; the operator surface is byte-for-byte unchanged, same verbs, same usage text, same PT-BR refusal reasons, same destinations, same nine exit codes across the probes.
- **VERIFICATION gap 2 and 3's production half is closed.** The production path called only the three tag/main reads, set `releases` to a single-element array regardless of the payload, and let a synthesized green CI state stand in for real evidence. `decide` is now the single production seam and walks all five declared reads in the fixed order — three eligibility reads through `checkTagEligibility`, then `getReleaseByTag` and `listMilestones` — and hands the responses it actually got to the exported `buildCloseEvidence`, which names the source of every value it emits. A duplicate payload arrives as an array and survives whole; a Milestone list is retained in full; records outside the target are partitioned by the classifier into `unrelatedReleases` rather than dropped; and the completed no-op surfaces as the exact pair `MISSING` plus `COMPLETE_NOOP` with `applyLiberado` true, whose single meaning is recorded in the code next to the note that Phase 11's seam reports a differently named field.
- **VERIFICATION gap 4's propagation half is closed, and the counter is no longer tautological.** The literal `mutations: 0` is gone from the plan object and all three renderers. The reported number is the client's measured count, validated by 09-06's shared invariant inside the decision — upstream of every renderer — so a non-zero measurement refuses the run instead of being printed, and a missing or corrupted measurement refuses as well because there is no fallback left to render zero. The refusal travels as its own error class, which keeps an escaped side effect out of the invalid-input bucket; that distinction is the one 09-06's second deviation established, and routing both through the same handler would have undone it.
- **All eleven CI blocking families are proven through the real seam, each derived from the frozen block.** The suite clones the canonical `ci` block once and mutates the clone per family, asserting the exact `ciCode`, `applyLiberado` false, and that release evidence is retained even while CI blocks. A snapshot with no `ci` block at all refuses as invalid input rather than defaulting green, and a source scan confirms no non-test source synthesizes a green state.
- **Two production blind spots are now written down instead of assumed.** `closeMarkers` and `failedRunIds` are not fields of the five-key evidence and no declared read returns either, so `CONCURRENT` and `FAILED`-by-explicit-red-run are unreachable through the production path in this phase. The suite asserts the exact value the path *does* produce and COVERAGE.md names the handoff to 09-09 and the Phase 11 marker vocabulary. Flagging this rather than adding a sixth read was deliberate: a new client method is a capability change, and one that would have had to pass 09-06's exact-surface check.
- **The canary's argument is settled by measurement, not by shape.** 09-06 left two bounded threat flags — a non-enumerable callable and a nested-capability holder — that the exact-surface check cannot see, and argued they are caught by the measured count instead. That argument now has the production path behind it: the number the operator reads is the count the boundary produced, so a bypass that the shape check misses is still a number that moves and still a refusal.

## Task Commits

Each task followed the RED → GREEN procedure; task 3 is a test-only adapter suite and is documented under Deviations.

1. **Task 1: import-safe CLI entrypoint with injected output streams and an exit code instead of process termination** - `c2f3fef` (test RED, 3 assertion failures, 3 regression guards green) then `13b380a` (feat GREEN)
2. **Task 2: five-read production decision path with scoped evidence, real CI evidence, and a measured mutation count** - `671c4a7` (test RED, 14 assertion failures, 7 probes green) then `ec8bd42` (feat GREEN, with the refreshed coverage declaration)
3. **Task 3: production-adapter suite proving the five reads, target scoping, CI blocking, and measured idempotency** - `0039354` (test; proven load-bearing by a 14-mutation probe)

**Plan metadata:** this commit.

_No REFACTOR commit: both GREEN implementations were written in one cohesive pass, with the evidence builder, the seam, the measurement wrapper and the refusal class already factored; the mutation probe then showed nothing to clean up that was not churn on a costly-to-reverse contract._

## Files Created/Modified

- `tools/release-close/release-close.js` — the entry-script guard and the exported `runReleaseClose` with injected streams, `fluxosPadrao` as the single process-stream touch point, the exported `buildCloseEvidence` production builder, the exported `decide` five-read seam, the measured mutation count wired into the plan object and all three renderers, and the `RecusaDoInvariante` refusal class
- `tools/release-close/evidence.test.js` — 29 top-level probes: the entrypoint group, the production-decision group, and the production-adapter group covering the eight frozen scenarios, the eleven CI families, target scoping, idempotency, instance isolation and import safety
- `.planning/phases/09-release-close-contract-fixtures/COVERAGE.md` — the no-live-integration boundary restated against the widened path, plus an explicit section on the two states the production path cannot yet reach

## Decisions Made

- **The three eligibility reads are not re-read.** Capturing their envelopes to feed the builder would have inflated the call log to seven calls and destroyed the proof this plan exists to produce. The five-key contract has no place for tag identities, so there is nothing to capture; the two reads the contract does need are performed explicitly and unconditionally, even when eligibility short-circuited.
- **`tagSha` and `commitSha` keep coming from the snapshot's tag envelopes, deliberately.** `reference.json` is a client-shaped snapshot, so those are the same bytes the client served and the eligibility reads already proved. They are plan-display fields, never classification evidence. The alternative — smuggling envelopes out through a recording proxy — would have defeated `assertClientShape`, which is the entire point of that check.
- **The mutation refusal gets its own error class rather than a message-prefix branch.** Routing it through the existing `TypeError` handler would have labelled an escaped side effect as invalid input, which is the family conflation 09-06 removed. Branching on message text would have re-implemented the family's classification. A class carrying the invariant's PT-BR reason across untouched keeps one implementation of that classification, in `client.js`, which this plan does not own.
- **`closeMarkers` stays the empty list and `failedRunIds` has no source at all.** Two taxonomy states are therefore unreachable through the production path in this phase. That is asserted with its exact reachable value and recorded in COVERAGE.md as a handoff, rather than papered over with a sixth read.
- **The two static scans read code, not prose.** The green-CI guard strips comments, because the comment documenting the removal names the removed literal in full. The invariant-ordering guard resolves the wrapper structurally — whoever encloses the call to `assertNoMutation` — so it survives 09-08 reformatting the module.
- **Expected classification values come from the documented precedence, never from observed output.** The `CONCURRENT` and `FAILED` scenarios are the sharpest case: their asserted value is deliberately *not* the state's own name, and it would move if the evidence boundary moved.
- **Every probe asserts the export's type before calling it, and every import-safety probe runs in a child process.** A missing export otherwise surfaces as "not a function", which is a probe crash rather than a description of the missing behavior; an import regression in-process would take the runner down, which is zero-test discovery and therefore `INVALID_RED` rather than RED.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] The green-CI source scan was accusing its own documentation**
- **Found during:** Task 2, GREEN (first full run of the new group)
- **Issue:** The scan looked for `state: 'success'`, `conclusion: 'success'` and `checks: {` in every non-test source. The only match was a *comment* in `release-close.js` explaining that the synthesized green literal had been removed and naming it in full. A guard that fires on the prose describing a fix is a guard that is wrong in both directions: it produced a false alarm now, and it would mask a real regression the day someone deletes the comment.
- **Fix:** Added `semComentarios()`, which strips block and line comments before the scan, so the value is forbidden in code and the documentation is free to mention it. The guard is strictly stronger for the property that matters: the value cannot exist anywhere in the implementation.
- **Files modified:** `tools/release-close/evidence.test.js`
- **Verification:** the scan passes; mutating the CI source to synthesize a green state is caught (probe 7 of the 14-mutation run → 15 failures).
- **Committed in:** `671c4a7`

**2. [Rule 1 - Bug] `fatiarFuncao` returned only the signature, so two structural guards were reading nothing**
- **Found during:** Task 2, GREEN
- **Issue:** The brace counter started at the first `{` after the declaration, which for `export async function decide({ snapshot, client, … })` is the *destructuring* brace of the parameter list. The counter closed on the matching `}` of that destructuring and returned a slice of roughly 70 characters — the signature and nothing else. Both the "the decision calls the invariant" guard and the "each verb runner decides before it renders" guard were therefore matching against a fragment, and the first one failed for a reason that had nothing to do with the code under test. A guard that inspects a fragment is worse than no guard, because it reports a pass.
- **Fix:** The counter now tracks parenthesis depth to the end of the parameter list and starts at the brace that opens the *body*. Both guards became real, and both then failed for real reasons: the first until the implementation existed, the second passing only after the runners were rewired.
- **Files modified:** `tools/release-close/evidence.test.js`
- **Verification:** the two guards now fail when the decision stops calling the measurement and when a runner renders before deciding (probes 8 and 9 of the 14-mutation run).
- **Committed in:** `ec8bd42`

**3. [Rule 1 - Bug] Six GREEN-phase failures were wrong test expectations, and two of them encoded the wrong contract**
- **Found during:** Task 2, GREEN
- **Issue:** The first GREEN run left six probes red. All six were the test's expectations, not the implementation, and two were worth more than a fix: (a) one asserted that the CI-blocked `bloqueio` text contained the literal `CI-CANCELLED`, but that string is 09-03's pinned PT-BR wording and the family's stable EN name is carried by `classificacao.ciCode` — changing the operator text to satisfy a test would have silently rewritten a decision 09-03 locked; (b) one expected the corrupted-measurement refusal to use the word "ausente" when the invariant says "inválida" for a record that exists without a counter. Both would have been "fixed" by editing the wrong side.
- **Fix:** The family assertion moved to `classificacao.ciCode` plus the pinned `estado FAILED: ` prefix, which is a stronger claim about the family than the substring it replaced. The measurement probe now asserts the *family* (a corrupted measurement, never reported as an escape) rather than one of the invariant's two synonymous wordings. The remaining four were fixture-selection errors — a draft release landing in a PARTIAL-draft branch, and two destructurings of a one-element array — corrected by choosing the state the plan describes and by deriving the second Milestone from the first instead of typing a number the repository does not hold.
- **Files modified:** `tools/release-close/evidence.test.js`
- **Verification:** 164/164 green; probes 2, 3, 4 and 10 of the 14-mutation run confirm the retention and read-path guards are load-bearing.
- **Committed in:** `ec8bd42`

### Procedure Deviations

**4. [Rule 2 - Missing Critical] Task 3 produced no RED commit and was proven load-bearing by a 14-mutation probe**
- **Found during:** Task 3
- **Issue:** Task 3 declares `tdd="true"` and its own action states it "change no production source in this task". TDD's fail-fast rule 1 fired and the investigation the rule requires confirmed why: every behavior the adapter suite asserts — the five ordered reads, the scoped evidence, the frozen CI block, the exact no-op pair, the measured count, the refusal, the idempotency, the isolation — was implemented by this same plan's task 1 and task 2 RED/GREEN cycles. A probe confirmed it directly by driving the shipped seam: five reads in order, the five-key evidence, the measured count, `writeAction` null on both decisions, the ci block intact. No intentional RED was producible without fabricating a failure or editing production code the plan forbids touching.
- **Fix:** Ran the investigation, then replaced the ceremonial red with a stronger artifact. Fourteen mutations of `release-close.js` were probed: dropping the second evidence read, returning only the first release record, collapsing the Milestone list to its first element, skipping the release read entirely, swapping the two evidence reads' order, synthesizing a green ci block when the snapshot carries none, replacing the frozen ci block with a constructed one, pinning the mutation count to zero, removing the invariant's validation, using snapshot data instead of the reads' actual returns, not using the reads' actual returns, writing to the process stream instead of the injected sink, calling `process.exit` instead of assigning the exit code, and running the CLI at module top level. All fourteen were caught; `release-close.js` was restored byte-identical (sha256 verified) and the suite returned to 164/164.
- **Files modified:** `tools/release-close/evidence.test.js` (commit `0039354`); the temporary mutations were reverted and never committed.
- **Verification:** 14/14 caught, `git diff --exit-code tools/release-close/release-close.js` clean after the probe.
- **Recorded in:** `.planning/WINDOWS.md` as open `deviation` entry 4, so the ship gate can see it.

**5. [TDD ordering note] Tasks 1 and 2 carry their behavior probes in task 3's file**
- **Found during:** Tasks 1 and 2
- **Issue:** The plan declares exactly three `files_modified` — `release-close.js` (tasks 1 and 2), `evidence.test.js` (task 3) and `COVERAGE.md` (task 2) — and requires tasks 1 and 2 to carry their behavior probes. No fourth file is in scope.
- **Fix:** `evidence.test.js` is created by task 1's RED commit, extended by task 2's, and completed by task 3. The file header states which task owns each of the three banner groups, so the ownership is written down rather than inferred. The consequence on the commit log is the same one deviation 4 describes.

**6. [Placement note] Every probe is a top-level `it()`, with no `describe` anywhere in the file**
- **Found during:** Tasks 1, 2 and 3
- **Issue:** The nesting constraint inherited from 09-04, 09-05 and 09-06 applies: node indents nested TAP subtests, so `check tdd-red-evidence` cannot see a target test inside a `describe`. A 29-probe file organized by group reads as if it should nest.
- **Fix:** The groups are delimited by banner comments instead of `describe` blocks, and the file header states the convention as mandatory with the reason, so a later plan adding a probe inherits it rather than rediscovering it. Both RED evidence records in this plan verify the consequence: the target tests appear at the top level of the TAP output and both returned `RED_EVIDENCE_OK`.

**7. [Rule 1 - Bug] A deterministic `ReferenceError` on a correct lexical binding, worked around and recorded**
- **Found during:** Task 3, first full run
- **Issue:** A probe using `for (const simbolo of […])` with a template-literal assertion message failed deterministically in the full-file run and never in isolation, with `ReferenceError: symbolo is not defined` at the exact position of a binding that a hexdump of the file confirmed was correctly declared one line above. Renaming the variable and concatenating the message instead of interpolating it made it pass, 164/164 across three consecutive runs. A minimal reproduction — 29 top-level tests, an async callback, a for-of with a template literal — did **not** reproduce the symptom, so the cause is not established. It is recorded rather than dismissed, because the same file is read by the verifier.
- **Fix:** The loop variable was renamed and the message concatenated, with a PT-BR note in the file explaining that the two forms assert identically, that the symptom was deterministic and isolated-only-when-unfiltered, and that interpolation is neither proven nor exonerated as the cause. Nothing about the assertion's strength changed.
- **Files modified:** `tools/release-close/evidence.test.js`
- **Verification:** 164/164 green across three consecutive full runs; the guard that raised it still asserts all three symbols are reachable by an importer.
- **Committed in:** `0039354`

---

**Total deviations:** 7 (3 bugs, 1 missing-critical procedure, 1 TDD ordering note, 1 placement note, 1 bug worked around without an established cause)
**Impact on plan:** Deviations 2 and 3 were the substantive ones: one shipped two structural guards that were inspecting a fragment and would have reported passes without looking, the other stopped the temptation to rewrite 09-03's pinned refusal wording to satisfy a test. Deviation 1 turned a false-alarming guard into a strictly stronger one. Deviations 4, 5 and 6 changed no production behavior and cost no scope; the cost is that the commit log shows no RED for task 3, which is recorded in `.planning/WINDOWS.md`. Deviation 7 is unexplained and flagged rather than closed.

## Issues Encountered

- **The production path cannot reach two of its own six states, and that is a real gap, not a test artifact.** `CONCURRENT` and `FAILED`-by-explicit-red-run are unreachable in Phase 9 because `closeMarkers` and `failedRunIds` have no source among the five declared reads. The suite asserts the reachable value with a message that says so, and COVERAGE.md records the handoff. Flagging it explicitly for the phase: closing it properly needs either a sixth declared read (a new client capability, which must pass 09-06's exact-surface check) or the 09-09 reconciliation seam, and this plan owned neither. Until one of those lands, a genuinely failed CI run is only blocked in production when the `ci` block says so — which is the real path, since `failedRunIds` was always a test-only field.
- **A source scan and the comment that documents a fix are in tension.** The first version of the green-CI guard accused the very comment written to explain the removal. Worth carrying forward: a value scan has to strip comments, or it will either fire on documentation or be quietly weakened to stop firing.
- **Two structural guards were reading a 70-character fragment.** Recorded because the failure mode is silent: they did not fail, they were *unable* to fail. A brace counter that starts at the wrong brace is the kind of helper that makes a suite look rigorous.
- **A `ReferenceError` on a correct binding, cause not established** (deviation 7). Recorded in the file and here rather than left as a shrug.

## TDD Gate Compliance

| Plan | RED | GREEN | REFACTOR | Status |
|------|-----|-------|----------|--------|
| 09-07 task 1 | `c2f3fef` (RED_EVIDENCE_OK, `target_test_failed`, 3 top-level assertion failures, 3 frozen regression guards still passing) | `13b380a` | none needed | Pass |
| 09-07 task 2 | `671c4a7` (RED_EVIDENCE_OK, `target_test_failed`, 14 top-level assertion failures, 7 frozen probes still passing) | `ec8bd42` | none needed | Pass |
| 09-07 task 3 | none producible (test-only; see deviation 4) | `0039354` (proven by a 14-mutation probe, 14/14 caught) | n/a | Deviation documented |

## Verification

- `node --test tools/release-close/evidence.test.js` → 29 tests, 29 pass, 0 fail, exit 0
- `node --test tools/release-close/` → 164 tests, 164 pass, 0 fail, exit 0, deterministic across three consecutive runs. Baseline before this plan was 135; the pre-existing 135 stayed green untouched and include the SAFE-04 CLI probes, the eligibility, classifier, gate, no-write and canary suites
- `node tools/release-close/release-close.js verify --json` → exit 0; `plan --json` → exit 0
- `plan --json` carries `target` (`{version, expectedSha}`), the five-key `evidencia` whose `ci` deep-equals the frozen block, the retained identifier lists (`classificacao.releases`, `.milestones`, `.unrelatedReleases`, `.unrelatedMilestones`), the eight ordered steps and the measured `mutations`
- Manual probe, the completed no-op through the production seam → `code=MISSING outcome=COMPLETE_NOOP applyLiberado=true mutations=0`, the exact pair plan 09-05 fixed
- Manual probe, operator surface → `verify` exits 0 with nothing on stderr; no verb exits 0 with usage on stdout; unknown verb exits 2 with usage on stderr and an empty stdout; `apply --yes` piped exits 1 with the `terminal interativo` reason and never opens a prompt
- `cd backend && npx vitest run` → 6 files, 131 tests, 131 pass (collateral)
- `cd frontend && npm run build` → built in 578ms, exit 0 (collateral)
- `git diff --name-only 6224dc0..HEAD` → exactly the three declared `files_modified`; `safe04.test.js`, `nowrite.test.js`, `canary.test.js`, `classify.js`, `classify.test.js`, `eligibility.js`, `eligibility.test.js`, `client.js`, `fake-client.js`, `apply-gate.js`, `gh-client.js` and every file under `fixtures/` confirmed untouched
- `tools/release-close/package.json` still declares no `dependencies` key; no runner, assertion library or dependency was added; no npm install ran in any task (T-09-07-SC)
- The secret-hygiene scan in `safe04.test.js` walked every captured output including the new plan JSON and stayed green; no non-test source reads `process.env`
- 14-mutation probe → 14/14 caught, `release-close.js` byte-identical afterwards (sha256), suite back to 164/164
- No `TODO`, `FIXME`, placeholder text, `test.skip`, `it.skip` or `describe.skip` in any changed file

## Known Stubs

None. This plan adds no placeholder value, no disconnected data source and no skipped test. The `mutations` counter in the rendered output is a measurement on the frozen baseline, which is necessarily zero there because the exact-surface check refuses every extra callable — that is the correct result, not a stub, and the canary in `canary.test.js` proves the measurement is load-bearing rather than vacuous. `WINDOWS.md` carries one new open `deviation` entry describing deviation 4, which is a process record about the commit log, not a stub in the code.

## Threat Flags

| Flag | File | Description |
|------|------|-------------|
| threat_flag: marker-and-red-run-states-unreachable-in-production | `tools/release-close/release-close.js` | The production evidence builder has no source for `closeMarkers` or `failedRunIds`, because neither is a field of the five-key contract and no declared read returns either. `CONCURRENT` and `FAILED`-by-explicit-red-run are therefore unreachable through the production path, and a snapshot whose *only* red signal is `failedRunIds` classifies as `MISSING` with `applyLiberado` true. The cost is bounded in Phase 9 — the CLI only ever runs the frozen reference fixture, where the `ci` block is the real signal, and the plan's `apply` still fails closed for want of any write path — but it is a genuine seam in the contract. Closed by 09-09's reconciliation seam, whose scripted failure families are exactly this vocabulary; if that plan does not supply it, it must be raised there rather than assumed. |
| threat_flag: ci-evidence-enters-only-from-the-snapshot | `tools/release-close/release-close.js` | `buildCloseEvidence` copies `ci` from the snapshot, and the CLI's only source is `fixtures/reference.json`. That is deliberate and the strongest available answer in this phase — no declared read returns CI, and the alternative was synthesis. But it means the CI evidence the decision sees is frozen at authoring time, not re-read. Phase 10 must replace the source, not the copy, or the decision will keep deciding on a month-old green. |
| threat_flag: tag-identities-still-sourced-from-the-snapshot | `tools/release-close/release-close.js` | `tagSha` and `commitSha` are read from the snapshot's tag envelopes rather than from the client's responses. They are display fields the classifier never sees, and the eligibility predicate already proved the same bytes byte-for-byte — but they are the two remaining values in the plan object whose source is not a client return. Recorded so a future plan does not read that symmetry as a licence to widen it. |
| threat_flag: no-observed-output-can-force-a-non-zero-count-in-production | `tools/release-close/release-close.js` | The CLI builds its own fake, whose trap is not armed and whose exact-surface check refuses every extra callable, so the count the operator reads is provably zero on any input the CLI can be given. That is the correct end state for a read-only tool, and it also means the refusal path is reachable only from an injected client — the suite exercises it there, in-process, and the escape-family message is pinned. Phase 11's write paths must route through the same trap or the measurement stops covering the real path. |
| threat_flag: source-guards-read-module-text | `tools/release-close/evidence.test.js` | The import-safety, stream-confinement, invariant-ordering and green-CI guards assert against the module's *text*, not its behavior. They are tripwires: a restructure that is behaviorally correct can still trip them, and a reformat that is behaviorally neutral can also trip them. The behavioral probes cover the same properties where a behavior exists to cover them; the text probes exist for the two that have no observable consequence from outside (a renderer reaching the global, and the invariant's position relative to the renderers). |

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- **09-08 has a stable seam to build on.** `buildClosePlan` takes the evidence and the measured count as arguments and no longer reconstructs either, so attaching the reviewed content and the canonical digest is an addition to the plan object rather than a repair of it. `runReleaseClose` already takes its streams by argument, which is the natural place for 09-08's character-counting output adapter — and note that the stream-confinement guard in `evidence.test.js` will fire on any new `process.stdout.write`, so 09-08 must either put its adapter inside `fluxosPadrao` or update the guard consciously rather than discovering it in CI.
- **09-09 can bind `decide` directly.** The seam already has the exact shape that plan expects to inject — `decide({ client, version, expectedSha, ci })` — and returns the three fields it needs: `evidence`, `eligibility` and `classification`, plus `mutations` and the client. No failure-plan parameter was added, because no caller needs it yet and 09-09 passes the re-read with no failure plan anyway.
- **The two field names carry one meaning each, and the distinction is now visible in a test.** `applyLiberado` true on the plan object and `writeProposed` false from the future seam are the pair the completed no-op produces; this plan's suite asserts the first, and the completed no-op is proven production-reachable rather than hypothetical.
- **The `ci` source is the thing to re-read first in Phase 10.** Not the copy, the source: the builder's contract is a byte-for-byte copy, and swapping in a live read is a change to where the value comes from, not to how it is handled.
- **A boundary worth re-reading before Phase 10 adds any callable:** the marker and `failedRunIds` gap above. Phase 10's live client is the first thing that could add a capability to the surface, which is the moment that gap stops being a Phase 9 bookkeeping matter.
- **Unchanged from before this plan:** Phase 9 still carries the remaining verification gap groups — human-visible reviewed-content apply gating, owned by 09-08, and production failure/re-read coverage, owned by 09-09 — and must not be closed until verification passes. Real cross-process arbitration (REC-05) stays in Phase 11 and is explicitly not claimed by the instance-isolation probe.
- One named human-judgment item remains for UAT (D16): reading the four operator-facing messages this plan routes differently once, before the Phase 12 runbook quotes them.

## Self-Check: PASSED

- Key files confirmed on disk: all three changed paths, including the created `evidence.test.js`
- All five task commits confirmed present: `c2f3fef`, `13b380a`, `671c4a7`, `ec8bd42`, `0039354`
- `git rev-list --count 6224dc0..HEAD` → 5, matching the frontmatter `commits`, measured from the persisted plan-head ledger rather than narrated
- Every `<acceptance_criteria>` of all three tasks re-run and passing. Task 1 source (no `process.exit`, no `process.stdout.write`/`process.stderr.write`, `if (ehScriptDeEntrada())` present, `process.exitCode =` present, no top-level await, every `process.stdout`/`process.stderr` access owned by `fluxosPadrao`, at most two `process.argv` reads) and behavior (import probe reaches its final output with empty captured stdout and stderr; the nine injected-sink cases land entirely in the sinks with codes 0,0,0,0,0,1,1,2,2; no-verb returns 0 with usage on stdout and an empty stderr; unknown verb returns 2 with usage on stderr and an empty stdout; verify returns 0 with an empty stderr). Task 2 source (no green CI state in any non-test source after comment stripping, no `mutations: 0` or `mutations = 0` literal in the implementation, `buildCloseEvidence` exported, the invariant's wrapper called inside `decide`, no renderer inside `decide`, and each of the three verb runners deciding before its first render) and behavior (the nine cases: builder export and five keys, both release records and both Milestone numbers retained, no invented ci block plus the invalid-input refusal, five ordered reads with sequences 1–5, duplicate, conflicting, target scoping with the unrelated field, the two-target-Milestone retention, the frozen ci block crossing unchanged, the cancelled block forcing `applyLiberado` false, the exact no-op pair, the measured count, and the armed-trap refusal in both families). CLI: `plan --json` carries target, retained evidence, ci block and measured count. Task 3 (eight scenarios with exact eligibility and classification values and five ordered reads each, the exact no-op pair, the eleven CI families each forcing `applyLiberado` false while retaining release evidence, the missing-ci refusal, the measured count and the armed-trap refusal, byte-identical repeat rendering, instance isolation, import safety) and source (the task-3 commit touches only `evidence.test.js`)

---
*Phase: 09-release-close-contract-fixtures*
*Completed: 2026-09-25*
