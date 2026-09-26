---
phase: 09-release-close-contract-fixtures
plan: "09"
subsystem: infra
tags: [node-test, esm, release-close, reconcile-seam, failure-families, natural-identity-reread, transport, unavailable, permission, malformed, write-proposed, no-blind-write, determinism, mutation-probe]

# Dependency graph
requires:
  - phase: 09-release-close-contract-fixtures
    provides: "strict annotated-tag peel and the PERMISSION/UNAVAILABLE/MALFORMED/TRANSPORT vocabulary (09-04); five-key snapshot contract, positive CI allowlist, target-scoped classification and eight scenario fixtures (09-05); the exact read-only client surface, the shared zero-mutation invariant and the programmable fake's measured counter and trap (09-06); the import-safe entrypoint, the five-read production seam decide, the exported evidence builder buildCloseEvidence and the measured mutation count (09-07); the eight-lock apply gate, the reviewed-content digest and the production-seam SAFE-04 suite (09-08)"
provides:
  - "tools/release-close/reconcile.js — the reconciliation seam: one exported function taking exactly client, version, expectedSha, ci, evidence, eligibility, classification, decide and failurePlan, importing neither eligibility.js nor classify.js, and importing nothing but the client contract"
  - "A failure-family vocabulary with the same code names the eligibility predicate already uses: 404 alone is MISSING, 401/403 is PERMISSION, 409/422/429 and any 5xx is UNAVAILABLE, an off-shape envelope is MALFORMED, and a thrown read is TRANSPORT — every PT-BR reason naming the read, the family, and that the remote state is unknown rather than absent"
  - "The single-natural-identity re-read: the tag ref by the requested version, the tag object by its full 40-hex SHA (resolved through the first hop, which is itself logged), the branch head by its branch name, the release by the requested version and the milestone list whole — with the observed attempt sequence exposed so a re-read against a different identity is visible"
  - "writeProposed, a no-write field that deliberately does NOT reuse the plan-level applyLiberado name, so the completed no-op can honestly report applyLiberado true on the plan and writeProposed false at the seam"
  - "The CLI's decision path delegated to the seam, with the production layer exported as camadaDeDecisao so a re-read re-derives the same three fields without re-entering the seam"
  - "A seam refusal that blocks the plan with its own PT-BR reason, which is what makes 'a failure family leaves applyLiberado false' true by rule rather than by the accident of an eligibility that also went false"
  - "failure.test.js — 28 top-level probes driving all six scripted families plus PERMISSION, MISSING, the recovery, the double failure, the armed-trap refusal, the completed no-op and the determinism boundary through production code"
  - "An executable proof of the 09-07 contract gap: the concurrent fixture's two in-progress close markers do not reach the production evidence, so CONCURRENT stays unreachable through the production path"
affects: [phase-10 live gh client, phase-11 idempotent reconciliation, phase-12 runbook, phase-13 operator procedure, 09-VERIFICATION re-run]

# Actuals (#2632) — pairs with the plan's `estimate` to calibrate future estimates.
# Same estimateTokens scale (chars/4 over the realized diff), never a harness token count.
actuals:
  tokens: 20113
  tasks: 3
  commits: 6

# Tech tracking
tech-stack:
  added: []
  patterns:
    - failure-family-vocabulary-reused-rather-than-reinvented
    - one-natural-identity-re-read-and-the-attempt-sequence-exposed
    - a-decision-layer-exported-by-name-so-an-injected-re-read-cannot-recurse
    - a-distinct-no-write-field-name-so-one-name-carries-one-meaning
    - a-refusal-blocks-the-plan-by-rule-not-by-accident
    - the-classification-arrives-as-data-so-the-module-boundary-survives
    - mutation-probe-with-vacuous-mutations-reported-not-counted

key-files:
  created:
    - tools/release-close/reconcile.js
    - tools/release-close/failure.test.js
  modified:
    - tools/release-close/release-close.js
    - .planning/phases/09-release-close-contract-fixtures/COVERAGE.md
    - .planning/WINDOWS.md

key-decisions:
  - "The seam performs its OWN first attempt, and that attempt IS the re-read of the identity whose failure produced the decisions it was handed. That ordering is what makes the fake's per-method queue express the plan's two required cases without a second mechanism: a one-entry plan is failure-then-success (recovery through the injected layer) and a two-entry plan is failure-then-failure (refusal with the second failure's family). The failed attempt's decisions arrive as `evidence`/`eligibility`/`classification`; the seam never fabricates a family — it observes what the client actually did."
  - "The seam's no-write field is `writeProposed` and the plan object's is `applyLiberado`, and neither is derived from the other. The completed no-op is the case that forces this: it reports applyLiberado true on the plan and writeProposed false at the seam, and a reader who believed the two were the same number would have to call one of them a bug."
  - "The seam validates eight of its nine inputs and treats only the failure plan as optional. The two that are easiest to skip — `evidence` and `decide` — are validated because a decision reached from an evidence set the repository does not hold is precisely the failure this phase exists to prevent, and a TypeError naming the missing input is cheaper than a synthesized CI fact."
  - "`getTagObject` is the one read whose natural identity is not derivable from what the caller hands the seam: it is the tag-object SHA, and that only exists after the first hop. The seam therefore performs the hop and logs it. Hiding the hop would make a re-read against a different identity indistinguishable from a correct one, which is the exact property T-09-09-02 exists to make visible."
  - "A seam refusal blocks the plan, as a rule of its own beside the blocking-code rule. The plan asserts 'a failure family leaves applyLiberado false', and in the six reachable families that happens anyway because the eligibility also went false — which means the assertion would pass without the rule. Blocking an indeterminate read is correct on its own terms (an unknown state is not a clean state), and the suite now carries a case where eligibility SURVIVES the refusal so the rule is load-bearing rather than decorative."
  - "The reconciliation block is surfaced as DATA on the decision and on the plan, and the rendered operator text is left byte-identical. No failure family can reach the CLI — the failure plan is a programmatic parameter and there is no flag, no environment variable and no usage-text entry for it — so a conditional render branch would be a text path nothing can reach, and 09-08 just froze that text. `verify`'s family-aware exit code is kept for Phase 10/11 and carries a source guard that says out loud that it is a tripwire."
  - "The 09-07 contract gap is reported as still OPEN, in this SUMMARY and in COVERAGE.md, with the executable proof rather than a prose claim. Routing the scripted families through the seam does not close it: those families are the read vocabulary (TRANSPORT/UNAVAILABLE) and the two unreachable states are the close-marker vocabulary. The seam is CONCURRENT-transport-safe and CONCURRENT-unreachable, and only a sixth declared read or a Phase 11 marker source can change the second half."

patterns-established:
  - "A family name is reused, not reinvented: the seam's codes are the eligibility predicate's codes, so an operator learns one vocabulary."
  - "The attempt sequence is part of the return value, and the client call log is asserted against it independently — a self-consistent but wrong sequence cannot pass."
  - "The first hop that resolves an identity is logged like any other read, because an unlogged read is a read nobody can audit."
  - "A test-only task is proven load-bearing by a mutation probe, and a mutation that cannot change an outcome is reported as vacuous rather than counted as caught."
  - "A property with no observable consequence from outside states that limitation in the file, as 09-08's source guards do."

requirements-completed: [OPS-02, SAFE-02, SAFE-04]

coverage:
  - id: D1
    description: "A timeout, a lost response, a 409, a 422, a 429 and a 5xx each reach the production decision seam and each normalize to its own stable code with a PT-BR reason: TRANSPORT for the two throws, UNAVAILABLE for the four statuses"
    requirement: "SAFE-02"
    verification:
      - kind: unit
        ref: "tools/release-close/failure.test.js#cada uma das seis famílias recusa pelo seam da CLI com o código exato e sem nenhuma escrita"
        status: pass
      - kind: unit
        ref: "tools/release-close/failure.test.js#uma releitura que falha de novo recusa com a família da segunda falha e não propõe escrita"
        status: pass
      - kind: unit
        ref: "tools/release-close/failure.test.js#a recusa nomeia a leitura, a família e que o estado remoto é desconhecido e não ausente"
        status: pass
    human_judgment: false
  - id: D2
    description: "Only 404 maps to absence, a 401/403 refusal is its own PERMISSION family rather than an unavailability, and an off-shape envelope is MALFORMED — 404 taken from the frozen missing state, 403 declared in the suite because no fixture carries a permission envelope"
    requirement: "SAFE-02"
    verification:
      - kind: unit
        ref: "tools/release-close/failure.test.js#um 404 é ausência e é a única família que prova ausência"
        status: pass
      - kind: unit
        ref: "tools/release-close/failure.test.js#uma recusa de permissão é a família própria, e não uma indisponibilidade"
        status: pass
      - kind: unit
        ref: "tools/release-close/failure.test.js#a costura não importa relógio, ambiente, rede, subprocesso, disco, elegibilidade nem classificador"
        status: pass
    human_judgment: false
  - id: D3
    description: "After any failed read the seam re-reads the same identity once — the tag ref by version, the tag object by its full SHA, the branch head by name, the release by version, the milestone list whole — and the client call log confirms the ordering independently of the sequence the seam reports"
    requirement: "SAFE-02"
    verification:
      - kind: unit
        ref: "tools/release-close/failure.test.js#cada uma das cinco leituras relê pela sua identidade natural, e o log do cliente confirma a ordem"
        status: pass
      - kind: unit
        ref: "tools/release-close/failure.test.js#as seis duplas falhas recusam com a família da segunda e a contagem medida continua zero"
        status: pass
    human_judgment: false
  - id: D4
    description: "No failure family ever yields an eligible decision and none ever proposes a write: every return path carries writeAction null and writeProposed false, the decision shape is exactly the ten declared keys, and the observed read sequence carries no field capable of holding a write"
    requirement: "SAFE-04"
    verification:
      - kind: unit
        ref: "tools/release-close/failure.test.js#cada uma das seis famílias recusa pelo seam da CLI com o código exato e sem nenhuma escrita"
        status: pass
      - kind: unit
        ref: "tools/release-close/failure.test.js#sem plano de falhas, a costura devolve as três decisões fornecidas e a sequência de leituras vazia"
        status: pass
    human_judgment: false
  - id: D5
    description: "Every decision the seam returns is traceable to an evidence set the repository actually holds: the eight required inputs are validated with a PT-BR TypeError naming the missing one, the module imports nothing but the client contract, and a failure plan naming an undeclared read is refused by name"
    requirement: "SAFE-04"
    verification:
      - kind: unit
        ref: "tools/release-close/failure.test.js#cada entrada obrigatória ausente ou não função é recusada com TypeError em PT-BR nomeando a entrada"
        status: pass
      - kind: unit
        ref: "tools/release-close/failure.test.js#a costura declara exatamente as oito entradas obrigatórias e o plano de falhas opcional"
        status: pass
      - kind: unit
        ref: "tools/release-close/failure.test.js#um plano de falhas que nomeia uma leitura inexistente é recusado com TypeError em PT-BR"
        status: pass
      - kind: unit
        ref: "tools/release-close/failure.test.js#a decisão exportada carrega o bloco de reconciliação com as mesmas três decisões que ela decidiu"
        status: pass
    human_judgment: false
  - id: D6
    description: "A transport failure cannot escape the seam as an unhandled rejection: the thrown read is caught and returned as data, and the suite drives all four throwing and non-throwing families through both the seam and the exported CLI decision"
    requirement: "SAFE-02"
    verification:
      - kind: unit
        ref: "tools/release-close/failure.test.js#cada família roteirizada que relê com sucesso devolve as decisões da camada injetada, não as da tentativa falha"
        status: pass
      - kind: unit
        ref: "tools/release-close/failure.test.js#as seis famílias recuperam: a decisão devolvida é a da camada injetada, chamada sem plano de falhas"
        status: pass
    human_judgment: false
  - id: D7
    description: "The failure plan is injectable only for tests: it is a programmatic parameter of the exported decision, the option parser and the usage text carry no key for it, and an unknown option still refuses with exit code two and the unchanged usage text"
    requirement: "SAFE-04"
    verification:
      - kind: unit
        ref: "tools/release-close/failure.test.js#a CLI não tem opção de injeção de falha, o texto de uso não a menciona e opção desconhecida devolve dois"
        status: pass
      - kind: unit
        ref: "tools/release-close/failure.test.js#a decisão exportada delega à costura com as nove entradas e não reconstrói nada"
        status: pass
    human_judgment: false
  - id: D8
    description: "Repeated reconciliation of the same frozen concurrent and failure evidence is deterministic: the second round, taken from a deep clone, is deeply equal, both rounds propose no write and the observed read sequences match — with the cross-process boundary recorded in PT-BR and never to be cited as a locking guarantee"
    requirement: "OPS-02"
    verification:
      - kind: unit
        ref: "tools/release-close/failure.test.js#a reconciliação repetida da mesma evidência é deepamente igual e não propõe escrita (OPS-02)"
        status: pass
    human_judgment: false
  - id: D9
    description: "No blind write is possible: the measured count is zero per family, the shared invariant accepts it, the trap armed during a failing run makes the invariant refuse, and that refusal is the invariant's rather than the failure family's"
    requirement: "SAFE-04"
    verification:
      - kind: unit
        ref: "tools/release-close/failure.test.js#a arapuca armada mede zero numa execução que falha, e armada de fato o invariante recusa sem ser a família que disfarça"
        status: pass
      - kind: unit
        ref: "tools/release-close/failure.test.js#as seis duplas falhas recusam com a família da segunda e a contagem medida continua zero"
        status: pass
    human_judgment: false
  - id: D10
    description: "The completed no-op arrives as the exact pair MISSING plus COMPLETE_NOOP and proposes no write step under the distinct writeProposed field, while the plan-level applyLiberado for the same target is true — and a seam refusal blocks the plan even when eligibility survived"
    requirement: "SAFE-04"
    verification:
      - kind: unit
        ref: "tools/release-close/failure.test.js#o no-op concluído chega como MISSING e COMPLETE_NOOP e a costura não propõe escrita nenhuma"
        status: pass
      - kind: unit
        ref: "tools/release-close/failure.test.js#uma recusa da costura bloqueia o plano mesmo quando a elegibilidade sobreviveu"
        status: pass
      - kind: unit
        ref: "tools/release-close/failure.test.js#com estado bloqueante E recusa, o bloqueio relatado é a recusa da leitura"
        status: pass
    human_judgment: false
  - id: D11
    description: "The operator surface is unchanged: verify, plan and apply keep their exit codes and their rendered text, verify's JSON carries no reconciliation key, and the plan gains exactly one new key"
    requirement: "SAFE-04"
    verification:
      - kind: unit
        ref: "tools/release-close/failure.test.js#o baseline congelado continua o mesmo e só ganha o bloco de reconciliação"
        status: pass
      - kind: other
        ref: "CLI probes: verify --json / plan / plan --json / --help all exit 0; apply piped exits 1; verify --json prints exactly the eligibility fields plus mutations; plan --json key set is the pre-existing set plus reconciliation"
        status: pass
    human_judgment: false
  - id: D12
    description: "The load-bearing proof for this plan's test-only task: a 23-mutation probe of reconcile.js and release-close.js makes every mutation fail at least one scoped probe, with zero vacuous, and both sources byte-identical afterwards"
    requirement: "SAFE-04"
    verification:
      - kind: other
        ref: "23-mutation probe (14 in reconcile.js, 9 in release-close.js) -> 23/23 caught, 0 vacuous on the second pass (3 vacuous on the first, each closed by a new probe); both sources restored byte-identical (sha256 verified); suite returns to 214/214"
        status: pass
    human_judgment: false
  - id: D13
    description: "The 09-07 contract gap is proven executably rather than asserted in prose: the concurrent fixture's two in-progress close markers do not reach the production evidence, so the production path classifies MISSING and never CONCURRENT, and the seam repasses that classification without inventing a family"
    requirement: "SAFE-02"
    verification:
      - kind: unit
        ref: "tools/release-close/failure.test.js#a lista de marcadores do fixture concorrente não chega à evidência de produção, e a costura não a inventa"
        status: pass
    human_judgment: false
  - id: D14
    description: "The six PT-BR family reasons and the two blocking reasons read as a coherent set for an operator who did not write them: a transport failure, an indeterminate status and a permission refusal each say something the operator can act on differently, and the refusal reason says the state is unknown rather than absent"
    verification: []
    human_judgment: true
    rationale: "No test can assert that a set of PT-BR messages reads coherently, and turning prose into substring contracts would add a second contract the plan does not ask for. The suite pins what is mechanically checkable: each reason names the read method and the human name together, each non-404 reason says the remote state is unknown and not absent, the 404 reason does NOT say that (absence is proven there), and the permission reason names the credential. A human should read the six once before the Phase 12 runbook quotes them, and confirm in particular that an operator who hits a PERMISSION refusal understands the difference between 'your credential does not reach this' and 'the remote is having a bad day' is spelled out rather than implied."

# Metrics
duration: 17 min
completed: 2026-09-25
status: complete
commits: 6
plan_head_before: e455566a07d148b7c183f2b1166714dfd5402ace
---

# Phase 09 Plan 09: Reconciliation Seam, Natural-Identity Re-Read, and a Per-Family Failure Suite Summary

**Every scripted failure family now passes through a production seam that normalizes it to its own code with a PT-BR reason, re-reads the same identity once, and never proposes a write — with the ordering cross-checked against the client call log and a 23-mutation probe proving the assertions are load-bearing**

## Performance

- **Duration:** 17 min
- **Started:** 2026-09-25T18:33:38Z
- **Completed:** 2026-09-25T18:50:52Z
- **Tasks:** 3
- **Files modified:** 3 (2 created, 1 modified) plus `COVERAGE.md` and `WINDOWS.md`

## Accomplishments

- **The seam exists, and it is the shape Phase 11 reuses.** `tools/release-close/reconcile.js` exports exactly one function taking `client`, `version`, `expectedSha`, `ci`, `evidence`, `eligibility`, `classification`, `decide` and `failurePlan`. It imports the client contract and nothing else — no clock, no environment, no network, no subprocess, no disk, and **no static import of `eligibility.js` or `classify.js`**, because those two decision layers arrive as data and as an injected dependency. That is what keeps 09-05's classifier-independence proof intact while still letting the seam decide on a *re-read* result rather than on a failed attempt. The first eight inputs are validated with a PT-BR `TypeError` that names the missing one, because a decision reached from an evidence set the repository does not hold is exactly the failure this phase exists to prevent.

- **Every family has its own code, and only 404 is absence.** A thrown read is `TRANSPORT` and never escapes as a rejected promise; 409, 422, 429 and any 5xx are `UNAVAILABLE`; 401/403 is `PERMISSION`; an off-shape envelope is `MALFORMED`; and 404 alone proves absence — and its reason says so, while every other reason says the remote state is *unknown and not absent*. The plan's six scripted outcomes are driven through both the exported CLI decision and the seam itself, each asserted on its **exact** code, a non-empty PT-BR reason, `eligible` false, `writeAction` null and `writeProposed false`, plus a check that no returned object anywhere in the tree carries a field named `applyLiberado`.

- **The re-read is by natural identity, and that is provable from two directions.** Each attempt is logged with its read method and its identity argument, and the suite asserts the seam's own sequence **against the client call log independently** — a self-consistent but wrong sequence cannot pass. The five identities are: the tag ref by the requested version, the tag object by its full 40-hex SHA, the branch head by its branch name, the release by the requested version, the milestone list whole. `getTagObject` is the interesting one: its identity is only knowable after the first hop, so the seam performs the hop and **logs it** — an unlogged read is a read nobody can audit, and hiding it would make a re-read against the wrong object indistinguishable from a correct one.

- **Recovery and double failure are two ends of one contract, and neither loops.** A successful re-read re-derives the three decisions through the injected layer, called with **no** failure plan — the suite spies on it and asserts the argument set is exactly `client`, `version`, `expectedSha`, `ci`, and proves by *object identity* that what came back is the injected layer's output rather than the failed attempt's. A re-read that fails again refuses with the **second** failure's family. There is no retry count, no backoff, no sleeping and no attempt limit: the observable contract is exactly "fail, re-read once by identity, decide or refuse", and a mutation that removes the failure branch is caught by 13 probes.

- **`writeProposed` and `applyLiberado` carry one meaning each, and the completed no-op is what proves it.** The plan's `applyLiberado` means eligible tag with no blocking state, so the completed no-op correctly reports it **true**; the seam's `writeProposed: false` means only that no write is proposed. The suite pins the exact pair — `MISSING` + `COMPLETE_NOOP` arriving from `fixtures/complete.json`, `writeProposed` false, plan-level `applyLiberado` true — and a source guard rejects any return field named `applyLiberado` at any depth. A reader who believed the two numbers were the same would have to call one of them a bug.

- **A refusal blocks the plan by rule, and the rule is load-bearing.** "A failure family leaves `applyLiberado` false" holds in the six reachable families only because the eligibility also went false — the assertion would pass without any rule at all. So the plan now blocks on a seam refusal as a rule of its own, and the suite carries the case that makes it observable: a decision whose **eligibility survived** a failed re-read, where `applyLiberado` must still be false. An indeterminate state is not a clean state, and releasing it would be treating "I don't know" as "I know it's fine". With a blocking state *and* a refusal, the reported `bloqueio` is the refusal, because that is the one that changes the operator's next action.

- **A failing run cannot hide a side effect behind its own error.** The measured count is asserted zero per family; the armed trap makes the shared invariant refuse, and the suite asserts the refusal is the *invariant's* — `contador de mutações medido = 1`, naming the observed capability, and explicitly **not** the family's PT-BR text. That is the real hazard: the family reason says "the remote state is unknown" and would read to an operator as "nothing happened", which is the one thing a measured effect must never be allowed to say. The same is proven through the CLI entry.

- **The 09-07 contract gap is answered, and the answer is that it stays open.** 09-07 named this plan as a candidate fix for `closeMarkers` and `failedRunIds` having no source among the five declared reads. Routing the scripted families through the seam does **not** close it, and the reason is a vocabulary mismatch: the six scripted families are the *read* vocabulary (`TRANSPORT`, `UNAVAILABLE`), while the two unreachable states are the *close-marker* vocabulary. The seam receives the evidence and the two decisions as data and delegates re-derivation to an injected layer, so it has no way to produce a marker or to carry `failedRunIds` — a key that is not one of the five the evidence contract declares. `failure.test.js` now proves the gap executably instead of asserting it in prose: driving the production path over `fixtures/concurrent.json`, which declares two in-progress markers, yields `evidence.closeMarkers === []` and `classification.code === 'MISSING'`, never `CONCURRENT`, with the seam repassing that classification unchanged and inventing no family. The classification itself is fully covered — `CONCURRENT` and explicit-red `FAILED` are proven at the classifier — and only the *transport* of those states into the production evidence is missing. Closing it still needs a sixth declared read (out of this plan's declared files) or a Phase 11 marker source. Both this SUMMARY and `COVERAGE.md` say so explicitly.

## Task Commits

Each task followed the RED → GREEN procedure; task 3 is test-only and is documented under Deviations.

1. **Task 1: the reconciliation seam** - `ada6d9c` (test RED, `RED_EVIDENCE_OK` on 11 top-level probes) then `17a5e04` (feat GREEN)
2. **Task 2: the CLI decision delegated to the seam** - `f7a6b0a` (test RED, `RED_EVIDENCE_OK` on 6 new probes) then `43078ae` (feat GREEN)
3. **Task 3: the per-family suite** - `cc63e45` (test; proven load-bearing by a 23-mutation probe, 23/23 caught) and `2f7e12c` (the three probes that closed the first pass's vacuous families)

**Plan metadata:** the `docs(09-09)` commit carrying this SUMMARY, `COVERAGE.md` and `WINDOWS.md`.

## Files Created/Modified

- `tools/release-close/reconcile.js` — the seam: the nine-name signature, the eight-input validation, the failure-family vocabulary reused from the eligibility predicate, the single natural-identity re-read with its observable attempt sequence, the `getTagObject` identity hop, and the `writeAction`/`writeProposed` refusal pair. Imports `./client.js` and nothing else.
- `tools/release-close/release-close.js` — the production layer exported as `camadaDeDecisao`, the new delegating `decide` that measures and then hands all nine inputs to the seam, `buildClosePlan` taking and blocking on a reconciliation refusal, and `runVerify`'s family-aware exit code. The option parser, the usage text, the refusal wording, the exit codes, the eight ordered steps and the reviewed-content digest are untouched.
- `tools/release-close/failure.test.js` — 28 top-level probes in three banner groups: the seam's contract and vocabulary (task 1), the CLI delegation and the operator surface (task 2), the six families, the recovery, the double failure, the armed trap, 404, 403, the completed no-op, the eligibility-survives case, the determinism boundary and the gap proof (task 3). No local snapshot or evidence helper beyond a declared state adapter, and a source guard rejects importing the classifier.
- `.planning/phases/09-release-close-contract-fixtures/COVERAGE.md` — a new section answering the 09-07 flagged gap with the executable proof and the plain statement that it remains open, plus a note on where the failure families are and are not reachable from.
- `.planning/WINDOWS.md` — one new open `deviation` entry (id 6) describing why task 3 produced no RED commit.

## Decisions Made

- **The seam's first attempt is the re-read.** The decisions it is handed came from a failed attempt; the seam's own first call is the re-read of that identity. This makes the fake's per-method queue express the plan's two required cases with no second mechanism: one entry is failure-then-success, two is failure-then-failure, and the family always comes from what the client *actually did* rather than from the plan, which is only a pointer.
- **Eight of nine inputs are required.** `evidence` and `decide` are the two most tempting to make optional and the two whose absence would let a decision be reached from evidence nobody holds.
- **`getTagObject`'s identity hop is a logged read, not an implementation detail.** Hiding it would defeat the observability T-09-09-02 exists to provide.
- **A refusal blocks the plan as its own rule**, because the plan's stated outcome happens to hold for the wrong reason without it, and because an unknown state is not a clean state.
- **`writeProposed` is a different name from `applyLiberado` on purpose.** Two names, one meaning each, and the completed no-op is the case that proves neither is derived from the other.
- **The reconciliation is surfaced as data, not as rendered text.** No family can reach the CLI, so a conditional render branch would be unreachable text on a surface 09-08 just froze. `verify`'s family-aware exit is kept for Phase 10/11 and carries a source guard that says out loud it is a tripwire.
- **The gap stays open, and the proof is executable.** Reporting it plainly is cheaper than a quiet half-fix that a later phase mistakes for closure.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Three test-design defects in the task-1 GREEN, each caught by its own probe rather than by inspection**
- **Found during:** Task 1, first GREEN run
- **Issue:** Three assertions in `failure.test.js` were wrong about the seam rather than about the code. (a) The missing-input test passed a **string** as the "invalid" value for `version`, and a non-empty string is a valid version — so nothing was rejected. (b) The recovery test asserted `custura.eligibility` deep-equals `decisao.eligibility`, which is the opposite of what recovery means; the two differ by design. (c) The per-read identity test armed a single client for the base decision, and `getReleaseByTag` / `listMilestones` are the only two reads `camadaDeDecisao` does **not** guard, so a scripted timeout on them escaped as a rejection before the seam ever ran.
- **Fix:** (a) the invalid value became `42`, which is invalid for all eight. (b) the assertion became the identity/inequality pair it was meant to be, plus a fresh clean-client run to name the expected re-derived values. (c) the base decision now comes from a clean client and the armed fake is the one the seam re-reads — which also surfaced a real production property, recorded as a Threat Flag below.
- **Files modified:** `tools/release-close/failure.test.js`
- **Verification:** 11/11 green; the full tool suite went from 186 to 197 and stayed green.
- **Committed in:** `17a5e04`

**2. [Rule 1 - Bug] Four test-design defects in the task-2 GREEN, three of them about the guard's own brittleness**
- **Found during:** Task 2, GREEN
- **Issue:** (a) A delegation guard required `\bfailurePlan:` but the delegation uses the **shorthand** form `failurePlan,` — a guard that only accepts one syntax would have passed a delegation that dropped the entry entirely. (b) A guard asserted `reconciliation.ci` is the decision's `ci`, but the seam does not return a `ci` field (it is not on the declared return shape), so the guard was asserting a field the contract does not have. (c) A guard asserted the refusal text carries no occurrence of `falha` — while the refusal legitimately **echoes the unknown option name** the operator typed. (d) A recovery guard asserted the returned evidence *differs* from the failed attempt's, but both are built from the same frozen snapshot and are deeply equal; the property that matters is object provenance, not content.
- **Fix:** (a) the guard now matches the key name with or without a colon. (b) the `ci` provenance assertion moved to where it is actually observable — the spy's captured argument, asserted `strictEqual` to the decision's `ci` and `deepEqual` to the frozen snapshot block. (c) the usage-text guard stands, and the refusal-echo assertion was replaced with the asymmetry the test is really about: the plan exists as a programmatic parameter and is absent from the parser and the usage. (d) the content assertions became `notStrictEqual` on identity.
- **Files modified:** `tools/release-close/failure.test.js`
- **Verification:** 17/17 green; the full tool suite went to 203 and stayed green; the frozen baseline's `verify`/`plan`/`--help` all still exit 0 and `apply` piped still exits 1.
- **Committed in:** `43078ae`

**3. [Rule 2 - Missing Critical] The suite's first mutation probe left three real gaps open, and closing them needed three new probes**
- **Found during:** Task 3, the 23-mutation probe's first pass
- **Issue:** Seventeen of twenty mutations were caught; three were **vacuous** — they changed no outcome, so counting them would have inflated the number. Each was vacuous for a different and real reason. **M02** (the `PERMISSION` branch returning `UNAVAILABLE`) was vacuous because the PERMISSION family had **no test at all**: the six scripted outcomes contain no 401/403 and no frozen fixture carries a permission envelope, so a whole family of the vocabulary shipped unproven. **M18** (swapping the precedence of the two `bloqueio` reasons) was vacuous because in every tested refusal the classification was non-blocking, so the two candidates never competed; the precedence that decides what the operator reads when a state is *also* blocking was untested. **M20** (dropping `&& !recusou` from `runVerify`'s exit code) was vacuous because **no failure family can reach `runVerify` at all** — the CLI never passes a failure plan and the seam performs no read without one.
- **Fix:** Three probes. A 403 state declared in the suite (the envelope only; no normalization reimplemented, and the absence of such a fixture stated in the file). A `DUPLICATE`-plus-refusal case where both a blocking state and a refusal hold, so the reported precedence becomes observable. A source guard for `runVerify`'s exit code that says explicitly in its own comment that it is a tripwire, because no behavioural probe can observe it in this phase — the same treatment 09-08 gave its sink adapter. Three more mutations were added (branch removal, and the release-ref and tag-ref identities), bringing the probe to 23.
- **Files modified:** `tools/release-close/failure.test.js`
- **Verification:** re-run: **23/23 caught, 0 vacuous**; both sources restored byte-identical (sha256 verified, `git diff` clean); the full tool suite back to 214/214.
- **Committed in:** `2f7e12c`

### Procedure Deviations

**4. [Rule 1 - Bug, worked around] The task-1 RED commit carries a placeholder module**
- **Found during:** Task 1, RED
- **Issue:** `reconcile.js` did not exist, so a test importing it would have failed at module resolution. `check tdd-red-evidence` classifies a load failure as `INVALID_RED` — correctly, since nothing was verified. Committing only the test would have produced eleven "failures" that were really one import error.
- **Fix:** the RED commit carries a placeholder `reconcile.js` that exports the function with the planned name and returns nulls, so every probe fails on a **real assertion** about the planned behaviour. The GREEN commit replaces it in full. The placeholder's own header says what it is.
- **Files modified:** `tools/release-close/reconcile.js` (in the RED commit only)
- **Verification:** `check tdd-red-evidence` → `RED_EVIDENCE_OK`, reason `target_test_failed`, with the named target test in the failing list and 11/11 failing. Task 2's RED likewise → `RED_EVIDENCE_OK`.
- **Committed in:** `ada6d9c`

**5. [Rule 2 - Missing Critical] Task 3 produced no RED commit and was proven load-bearing by a mutation probe**
- **Found during:** Task 3
- **Issue:** Task 3 declares `tdd="true"`, changes no production source, and every behaviour it asserts was implemented by this same plan's task 1 and task 2 RED/GREEN cycles. TDD's fail-fast rule 1 fired and the investigation it requires confirmed why.
- **Fix:** replaced the ceremonial red with a 23-mutation probe of `reconcile.js` (14) and `release-close.js` (9): stop catching the transport throw; collapse `PERMISSION` into `UNAVAILABLE`; collapse absence into `UNAVAILABLE`; drop the re-read; return the failed attempt's decisions instead of re-deriving; pass the failure plan to the injected layer; flip `writeProposed` to true; add an `applyLiberado` field; drop the `classification` validation; drop the unknown-read check; read the branch head under the wrong name; mark every result recovered; re-read the tag object by the commit SHA; mislabel the milestone identity; self-inject the delegating function as the re-derivation layer; drop `evidence` on the way in; drop the refusal from the blocking rule; swap the two `bloqueio` reasons; drop `reconciliation` from the plan; drop `!recusou` from the verify exit; skip the failure branch entirely; re-read the release and the tag ref by the wrong identity. **23/23 caught, 0 vacuous**; both sources restored byte-identical (sha256).
- **Files modified:** `tools/release-close/failure.test.js` (the temporary mutations were reverted and never committed)
- **Recorded in:** `.planning/WINDOWS.md` as open `deviation` entry 6, so the ship gate can see it.

**6. [Rule 4 avoided — reported instead] The plan says "eight inputs" and enumerates nine**
- **Found during:** Task 1
- **Issue:** The plan's prose says "the same eight names" in four places and then lists nine (`client`, `version`, `expectedSha`, `ci`, `evidence`, `eligibility`, `classification`, `decide`, `failurePlan`), and its `fails_when` says "the first seven signature inputs". The enumeration is the authoritative one — it is repeated identically in the key_links, the task-1 action, the task-2 action and the artifacts table, and it is the only reading that satisfies "with no additional parameter and none omitted".
- **Fix:** implemented all nine, validated the first eight, and named the plan's count slip in the test that pins the signature, so the assertion is about the names and not about a number the plan got wrong. No production behaviour depended on the count.
- **Committed in:** `ada6d9c`, `17a5e04`

**7. [Guard override] Commits landed on `main` with the repository's protected-branch classification**
- **Found during:** the first task commit
- **Issue:** `main` is a protected branch and the pre-commit guard classifies a commit there as disallowed. The standard executor contract refuses to commit on a protected branch.
- **Fix:** committed under an explicit dispatch instruction. `.planning/config.json` sets `git.branching_strategy: "none"`, the orchestrator dispatched this executor onto `main` as sole writer, and plans 09-01 through 09-08 all committed the same way. **No hook failed** — this is a classification the guard can be asked to allow, not a broken check, and `--no-verify` was not used at any point.
- **Files modified:** none
- **Verification:** all six task commits are present on `main` and the suite is green at each one.

---

**Total deviations:** 7 (3 bugs in test design, 1 missing-critical coverage gap found by the probe, 2 procedure deviations, 1 guard override)
**Impact on plan:** Deviations 1–3 changed no production behaviour and cost no scope; deviation 3 is the substantive one, because it found a whole family of the vocabulary (`PERMISSION`) shipping with no test and found the refusal precedence unobserved. Deviation 4 explains a placeholder that exists only inside one commit and is gone in the next. Deviation 6 is a plan count slip resolved in favour of the plan's own enumeration. Deviation 7 is an override, not a fix, recorded so it is not mistaken for one.

## Issues Encountered

- **The six families are reachable only from a programmatic caller, never from the command line.** The failure plan is a parameter of the exported `decide`; `runVerify`, `runPlan` and `runApply` never pass one, and without a plan the seam performs no read at all. So `verify`'s family-aware exit code and every family assertion are proven through the exported decision and the exported seam, not through an operator invocation — and the plan's own "a failure family always produces a non-zero exit code" holds for the CLI only through `applyLiberado`, which is provably false on a refusal. Stated rather than counted as coverage of the operator surface. The mutation probe found the same thing independently as M20.
- **A transport throw from `getReleaseByTag` or `listMilestones` escaped `camadaDeDecisao` as an unhandled rejection — RESOLVED 2026-09-25.** *(As originally written by this plan:)* Those two reads are the only ones the layer does not guard — `checkTagEligibility` guards the other three — so a real timeout on the release or milestone read in Phase 10 would reach the operator as a crash rather than as the PT-BR refusal the phase's whole vocabulary promises. The plan scopes its six families to the first read, so its verification does not hit it. Reported as a Threat Flag rather than fixed, deferring the call to the plan that owns the evidence builder. **That deferral was the wrong call, and the question it deferred was answerable.** UAT confirmed the throw reaches the operator as a crash — and that a *second*, worse defect shared the same cause: `normalizarLista` turned any non-`ok` envelope into an empty list, so a 5xx or 429 read as "no release exists", giving `MISSING` with `applyLiberado: true` and a plan byte-identical to the honest case. That is fail-OPEN in a release preflight. The evidence builder is this phase's, and the rule it was violating ("only 404 proves absence") is the one this phase wrote. Both are fixed in `release-close.js`: `lerEvidencia` guards the throw as `RecusaDeLeitura` and returns the envelope intact, and `normalizarLista` produces an empty list only for 404. Suite 214/214.
- **A mutation probe that reports 21/21 is worth less than one that reports 18/18.** Three of this plan's twenty candidates changed nothing, and each pointed at a real hole rather than at a bad mutation. The count is reported as 23 of 23 after the holes were closed, with the three vacuous ones named in `WINDOWS.md`.

## TDD Gate Compliance

| Plan | RED | GREEN | REFACTOR | Status |
|------|-----|-------|----------|--------|
| 09-09 task 1 | `ada6d9c` (`RED_EVIDENCE_OK`; the named target test failed on its planned assertion across 11/11 probes) | `17a5e04` | none needed | Pass |
| 09-09 task 2 | `f7a6b0a` (`RED_EVIDENCE_OK`; 6 new probes red on the absent delegation) | `43078ae` | none needed | Pass |
| 09-09 task 3 | none producible (test-only; see deviation 5) | `cc63e45` + `2f7e12c` (proven by a 23-mutation probe, 23/23 caught, 0 vacuous) | n/a | Deviation documented |

## Verification

- `node --test tools/release-close/failure.test.js` → 28 tests, 28 pass, 0 fail, exit 0
- `node --test "tools/release-close/*.test.js"` → 214 tests, 214 pass, 0 fail, exit 0, deterministic across two consecutive runs. The baseline before this plan was 186; those 186 stayed green untouched and include the eligibility, classifier, canary, evidence, no-write and SAFE-04 suites
- `node tools/release-close/release-close.js verify --json`, `plan`, `plan --json`, `--help` → all exit 0 on the frozen baseline; `apply --yes </dev/null` → exit 1
- `verify --json` prints exactly the eligibility fields plus `mutations` and carries **no** `reconciliation` key; `plan --json` key set is the pre-existing set plus exactly one new key, `reconciliation`; `applyLiberado` true, `reconciliation.family` null, `mutations` 0
- **Mutation probe** → 23/23 caught, 0 vacuous, `reconcile.js` and `release-close.js` restored byte-identical (sha256 `77fc3e52…` and `28601b5e…` before and after), suite back to 214/214
- `git diff --name-only e455566a..HEAD` → exactly the three declared `files_modified`; `classify.js`, `classify.test.js`, `client.js`, `fake-client.js`, `eligibility.js`, `apply-gate.js`, `nowrite.test.js`, `canary.test.js`, `evidence.test.js`, `safe04.test.js` and every fixture confirmed untouched
- `tools/release-close/package.json` still declares no `dependencies` key; no runner, assertion library or dependency was added; no install step ran in any task (T-09-08-SC, T-09-09-SC)
- No `TODO`, `FIXME`, `test.skip`, `it.skip` or `describe.skip` in any changed file; the only placeholder text is the RED-phase module header, replaced in full by the GREEN commit
- `cd backend && npx vitest run` → 6 files, 131 tests, 131 pass (collateral)
- `cd frontend && npm run build` → built in 704ms, exit 0 (collateral)

## Known Stubs

None. This plan adds no placeholder value, no disconnected data source and no skipped test. The `mutations` counter in the rendered output remains a measurement on the frozen baseline and is necessarily zero there, which is the correct result rather than a stub. The 403 state in `failure.test.js` is a declared test state, not a stub: the suite says so in the file and only replaces an envelope, never a normalization. `WINDOWS.md` carries one new open `deviation` entry (entry 6), which is a process record about the commit log, not a stub in the code.

## Threat Flags

| Flag | File | Description |
|------|------|-------------|
| threat_flag: the-evidence-reads-are-unguarded | `tools/release-close/release-close.js` | `camadaDeDecisao` reads `getReleaseByTag` and `listMilestones` without a try/catch, unlike the three tag and branch reads that `checkTagEligibility` guards. A transport throw on either escapes as an unhandled rejection — on the CLI, a crash rather than the PT-BR refusal the phase's vocabulary promises, and it happens **before** the reconciliation seam ever runs, so the seam cannot catch it. This phase's verification does not hit it because the six scripted families are exercised on the first read. The fix is not obviously local: an indeterminate evidence read must either refuse the run (a typed family) or be reported as an empty list, and the second would turn "I could not read the release" into "there is no release", which is a fail-open the plan forbids. The decision belongs to whoever owns the evidence builder. |
| threat_flag: the-failure-families-never-reach-the-operator-surface | `tools/release-close/release-close.js` | The failure plan is a programmatic parameter of the exported `decide` and nothing on the command line can supply one, so `verify`, `plan` and `apply` always run the seam with no plan and an empty observed read sequence. Every family assertion in this plan is therefore proven through the exported decision and the exported seam, not through an operator invocation, and `verify`'s `!recusou` term is structurally unobservable until Phase 10 can produce a real family — which is why it carries a source guard declaring itself a tripwire. This is fail-closed and correct, but it means "a failing run tells the operator which read failed and what was re-read" is a Phase 10/11 capability, not a Phase 9 one. |
| threat_flag: a-403-state-is-declared-in-the-suite | `tools/release-close/failure.test.js` | The PERMISSION family is proven against an envelope declared in the test, because the programmable fake has no 401/403 outcome and none of the eight frozen scenarios carries a permission envelope. Only the envelope is replaced — no normalization is reimplemented, and the suite carries its own guard against importing the classifier. If Phase 10 adds a real 403, this state should be replaced by a frozen fixture, and the mutation probe's M02 will keep the family load-bearing in the meantime. |
| threat_flag: source-guards-read-module-text | `tools/release-close/failure.test.js` | Three guards assert against module *text* rather than behaviour: the delegating function's nine inputs and its non-rebuild of the evidence, the option parser and usage text carrying no failure-injection key, and `runVerify`'s family-aware exit. They are tripwires — a behaviourally correct restructure can trip them and a behaviourally neutral reformat can too. Each states its own limitation in the file, and the first exists because "which arguments did the caller pass" is genuinely invisible from outside. |
| threat_flag: the-close-marker-gap-is-still-open | `tools/release-close/reconcile.js` | `CONCURRENT` and `FAILED`-by-explicit-red-run remain unreachable through the production path: `buildCloseEvidence` hardcodes `closeMarkers: []` and has no `failedRunIds` key, and the seam receives the evidence as data and cannot source either. 09-09 is one of the two fixes 09-07 named and it is not this one. The gap is now proven executably (`failure.test.js` drives the concurrent fixture and shows `MISSING`, never `CONCURRENT`) rather than asserted in prose, and both this SUMMARY and `COVERAGE.md` say it is open. Closing it needs a sixth declared read — which must pass 09-06's exact-surface check — or a Phase 11 close-marker source. |
---
*Phase: 09-release-close-contract-fixtures*
*Completed: 2026-09-25*

## Self-Check: PASSED

- All 3 declared `files_modified` exist on disk: `tools/release-close/reconcile.js`, `tools/release-close/release-close.js`, `tools/release-close/failure.test.js`
- All 6 task commits present on `main`: `ada6d9c`, `17a5e04`, `f7a6b0a`, `43078ae`, `cc63e45`, `2f7e12c`
- Every task acceptance_criteria re-run: task 1 (9 source/behavior clauses) via `failure.test.js` grupo 1, task 2 (7 source clauses + 3 behavior clauses) via grupo 2 plus the live CLI probes, task 3 (14 clauses) via grupo 3 plus the 23-mutation probe
- Plan-level verification re-run end to end: `node --test tools/release-close/failure.test.js` 28/28; `node --test "tools/release-close/*.test.js"` 214/214 twice; `verify --json` / `plan` / `plan --json` / `--help` exit 0; `apply --yes </dev/null` exit 1; backend 131/131; frontend build exit 0
- `commits: 6` measured from the persisted ledger (`git rev-list --count e455566a..HEAD`), not narrated; the metadata commit is the seventh and is not counted there
