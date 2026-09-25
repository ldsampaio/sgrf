---
phase: 09-release-close-contract-fixtures
plan: "08"
subsystem: infra
tags: [node-test, esm, release-close, safe-04, apply-gate, reviewed-content, canonical-digest, sink-character-count, output-terminal-lock, eight-lock-order, end-of-input, mutation-probe]

# Dependency graph
requires:
  - phase: 09-release-close-contract-fixtures
    provides: "strict annotated-tag peel and the PERMISSION/UNAVAILABLE/MALFORMED/TRANSPORT vocabulary (09-04); five-key snapshot contract, positive CI allowlist and target-scoped classification over the frozen fixtures (09-05); exact read-only capability surface, the shared zero-mutation invariant and the programmable fake's measured counter (09-06); the import-safe entrypoint, the five-read production seam decide, the exported evidence builder buildCloseEvidence and the measured mutation count (09-07)"
provides:
  - "apply-gate.js exporting the fixed eight-lock order APPLY_LOCKS = plan, flag, tty, output, sink, content, prompt, answer, with the original five untouched and the three new ones between tty and prompt"
  - "An output-terminal lock (lock four) and a real-sink lock (lock five), so a live input terminal with a redirected output no longer confirms and a swallowed plan is no longer silent"
  - "The single canonicalReviewedDigest function, the only serializer of reviewed content in the repository, with each field as a name+length+value triple so no separator can be forged"
  - "A reviewed-content lock (lock six) that validates the Release notes and the Milestone completion record and recomputes the digest at prompt time, refusing when it no longer matches"
  - "One declared render position: nothing is written and no prompt is opened until every lock through content has passed; after that the ordered plan is written first, the reviewed content second, and the prompt last"
  - "An immutable reviewed content object on the plan, built byte for byte from named fixture fields, with the digest computed twice and the plan refused when the two disagree"
  - "An output-terminal boolean read from the OUTPUT stream and a sink adapter that reports a character count instead of a boolean"
  - "An ask factory that settles exactly once on answer, on close and on stream error, so end-of-input refuses instead of leaving the process alive"
  - "fixtures/reviewed.json, a client-shaped frozen scenario that is the only named source of the reviewed Release notes and Milestone completion record in the repository"
  - "A SAFE-04 suite that runs entirely on the production seam, asserts exact per-scenario codes and outcomes, and carries every refusal family in one table"
affects: [09-09 reconciliation seam, phase-10 live gh client, phase-11 executor binding, phase-12 runbook, phase-13 operator procedure]

# Actuals (#2632) — pairs with the plan's `estimate` to calibrate future estimates.
# Same estimateTokens scale (chars/4 over the realized diff), never a harness token count.
actuals:
  tokens: 26176
  tasks: 3
  commits: 5

# Tech tracking
tech-stack:
  added: []
  patterns:
    - eight-lock-order-as-an-exported-list-compared-not-restated
    - one-declared-render-position-that-every-case-agrees-with
    - canonical-digest-as-the-only-serializer-recomputed-at-the-moment-of-use
    - injected-sink-reports-characters-not-a-boolean
    - refusal-family-consolidated-into-one-table-with-its-write-observable
    - terminal-families-attributed-to-the-lock-that-actually-fires
    - single-settled-prompt-on-answer-close-and-stream-error
    - expected-values-derived-from-documented-precedence-not-observed-output
    - source-guards-that-read-code-not-prose

key-files:
  created:
    - tools/release-close/fixtures/reviewed.json
  modified:
    - tools/release-close/apply-gate.js
    - tools/release-close/release-close.js
    - tools/release-close/safe04.test.js
    - .planning/WINDOWS.md

key-decisions:
  - "The three new locks go BETWEEN tty and prompt, not before tty. That single placement is what keeps every pre-existing refusal reporting the lock it reports today: a missing flag still refuses on flag, a pipe still refuses on tty, and a missing plan still refuses on plan, with no new input anywhere. Reordering the pair would have changed what a shipped case returns."
  - "A fully piped invocation refuses on tty (lock three) and the output lock (lock four) is UNREACHABLE from it, so it is asserted as its own top-level row that additionally requires the output-lock phrase to be ABSENT from stderr. Writing that case as an output-lock assertion would have failed for the wrong reason and hidden the real ordering — the plan names this trap in three separate places and the suite now pins the negative too."
  - "The render position is declared once: after the content lock, before the prompt, as the first act after the content lock. The consequence the whole plan rests on is that the zero-character sink refusal becomes the single refusal whose write-observable is sink CALLS rather than zero calls, so it is kept as its own row in the consolidated table and can never be merged with a pre-render refusal."
  - "canonicalReviewedDigest is the only serializer in the repository, and it serializes each field as a name+length+value triple. The length is checked against the value so that moving text from one field into the next cannot forge a separator boundary, and the field order is fixed so the serialization is deterministic."
  - "The gate recomputes the digest at prompt time and refuses on a mismatch, and the plan builder computes it a second time and refuses to emit a plan when the two disagree. Both halves exist because a digest that can drift is not a binding, and a non-deterministic one must fail before the operator reads anything rather than at the prompt."
  - "The reviewed text is owned by a fixture field and never by template prose. A digest over invented text would bind the operator's approval to nothing, which is worse than no digest, so fixtures/reviewed.json is the only named source of the Release notes and the Milestone completion record and the suite asserts the two strings byte for byte."
  - "fixtures/reviewed.json is client-shaped with both envelopes intact and no flat releases or closeMarkers key, so it can never be mistaken for classifier input. It is asserted to carry the same key set as the reference baseline."
  - "outputIsTTY is read from the OUTPUT stream, never the input stream. Reading stdin twice would re-open exactly the bypass the lock exists to close, and the suite proves it with a two-sided differential through the real CLI entry: flipping only the output boolean moves the refusal from the output family to the content family."
  - "The prompt settles exactly once, under a flag, on three outcomes: the answer, the interface closing with no answer, and a stream error. Restoring the close listener is not a second settlement because the flag makes the second dispatch a no-op — and removing it is precisely defect T-09-08-04, which the 18-mutation probe catches by hang."
  - "The end-of-input and stream-error paths refuse with DIFFERENT PT-BR reasons and the suite pins the difference. Both settle without an answer, but they are different causes and they call for different operator actions, so a test that only asserted 'a refusal happened' would have lost the distinction."

patterns-established:
  - "A lock is a name in an exported list, and the suite compares against the list instead of restating it. A test that retyped the order would pass on a reordered gate."
  - "A refusal family is identified by its write-observable, not only by its name: zero sink calls, or sink calls carrying zero characters, or sink calls carrying characters and a prompt. Those three are different families and the table keeps them apart."
  - "Two terminal families, two locks. Name which one fires, and assert the other one's phrase is absent, so the two can never be quietly merged."
  - "Nothing is written before the visibility and content locks have passed. The render is not a lock, which is why the list still has exactly the eight entries the plan names."
  - "The object the operator approves and the digest the gate recomputes are the same object, so a later executor binds its write to bytes the operator actually read."
  - "Expectation values come from documented precedence, never from observed output, and the ABSENCE of a field is asserted rather than implied."
  - "A source guard states explicitly that the property it reads has no observable consequence from outside, so a reader knows it is a tripwire and not a behaviour."

requirements-completed: [SAFE-04, OPS-01]

coverage:
  - id: D1
    description: "Apply refuses on the output-terminal lock when the input terminal is live and the output stream is not, with nothing written and nothing asked; a fully piped invocation refuses on the earlier tty lock with the terminal-interativo reason and an empty stdout, and the two families are never conflated"
    requirement: "SAFE-04"
    verification:
      - kind: unit
        ref: "tools/release-close/safe04.test.js#recusa com terminal de entrada vivo e saída ausente, sem escrever e sem perguntar"
        status: pass
      - kind: unit
        ref: "tools/release-close/safe04.test.js#a CLI recusa na fechadura de saída com terminal de entrada vivo e saída redirecionada"
        status: pass
      - kind: unit
        ref: "tools/release-close/safe04.test.js#a invocação totalmente em pipe recusa na fechadura de tty, com stdout vazio"
        status: pass
      - kind: unit
        ref: "tools/release-close/safe04.test.js#a CLI com pipe não renderiza nada e recusa na fechadura de terminal de entrada"
        status: pass
      - kind: other
        ref: "OS-level probe: real pty on stdin + stdout redirected to a file -> exit 1, 0 bytes written to the file, no prompt, output-lock reason; and `apply --yes </dev/null` -> exit 1, 0 bytes on stdout, tty-lock reason"
        status: pass
    human_judgment: false
  - id: D2
    description: "The exported lock order is exactly eight entries with the original five untouched, the three new ones between tty and prompt, and the flag, tty and no-plan refusals still reporting the lock they report today"
    requirement: "SAFE-04"
    verification:
      - kind: unit
        ref: "tools/release-close/safe04.test.js#as três fechaduras novas ficam entre a de terminal e a de pergunta, e as cinco antigas guardam a ordem"
        status: pass
      - kind: unit
        ref: "tools/release-close/safe04.test.js#a suíte não reescreve a ordem das fechaduras como cópia literal fora da asserção de posição"
        status: pass
      - kind: unit
        ref: "tools/release-close/safe04.test.js#recusa sem a flag --yes e nomeia a fechadura ausente"
        status: pass
      - kind: unit
        ref: "tools/release-close/safe04.test.js#recusa com entrada não interativa mesmo com a flag --yes"
        status: pass
      - kind: unit
        ref: "tools/release-close/safe04.test.js#recusa quando nenhum plano foi renderizado para revisão"
        status: pass
    human_judgment: false
  - id: D3
    description: "Nothing is written and no prompt is opened until every lock from plan through content has passed; a refusal on any of them, and a missing or non-function sink, observe zero sink calls, while the zero-character sink is the single refusal observed with sink calls whose reported character total is zero and no prompt"
    requirement: "SAFE-04"
    verification:
      - kind: unit
        ref: "tools/release-close/safe04.test.js#a matriz de recusas nomeia a fechadura certa e o observável de escrita de cada família"
        status: pass
      - kind: unit
        ref: "tools/release-close/safe04.test.js#não mostra plano algum para um apply que já ia recusar"
        status: pass
      - kind: unit
        ref: "tools/release-close/safe04.test.js#recusa com sink ausente ou que não é função, antes de qualquer renderização"
        status: pass
      - kind: unit
        ref: "tools/release-close/safe04.test.js#recusa com sink que relata zero caracteres depois do render e antes da pergunta"
        status: pass
      - kind: unit
        ref: "tools/release-close/safe04.test.js#recusa com sink que não relata contagem de caracteres"
        status: pass
    human_judgment: false
  - id: D4
    description: "Once every lock has passed the ordered plan is written first and the reviewed content second, both through the sink and both before the prompt, and the eight ordered step ids are present in what the sink received"
    requirement: "SAFE-04"
    verification:
      - kind: unit
        ref: "tools/release-close/safe04.test.js#grava o plano antes de qualquer pergunta"
        status: pass
      - kind: unit
        ref: "tools/release-close/safe04.test.js#mostra o plano ordenado e o conteúdo revisado no terminal vivo, antes da pergunta"
        status: pass
      - kind: unit
        ref: "tools/release-close/safe04.test.js#o plano json lista os oito passos na ordem fixa da recuperação"
        status: pass
    human_judgment: false
  - id: D5
    description: "Absent, blank or incomplete reviewed content refuses on the content lock, and a digest that no longer matches the one recomputed at prompt time refuses on the same lock, both with nothing written and nothing asked"
    requirement: "SAFE-04"
    verification:
      - kind: unit
        ref: "tools/release-close/safe04.test.js#recusa sem conteúdo revisado, em branco, ou sem notas e sem registro de conclusão"
        status: pass
      - kind: unit
        ref: "tools/release-close/safe04.test.js#recusa quando o conteúdo revisado mudou entre a renderização e a confirmação"
        status: pass
      - kind: unit
        ref: "tools/release-close/safe04.test.js#o plano sem campos revisados não carrega objeto nem digest, e o texto diz isso em PT-BR"
        status: pass
    human_judgment: false
  - id: D6
    description: "The plan carries an immutable reviewed object whose Release notes and Milestone completion record are byte for byte the two named fixture fields, with the digest coming from the single exported serializer, computed twice, and the plan refused when the two computations disagree"
    requirement: "SAFE-04"
    verification:
      - kind: unit
        ref: "tools/release-close/safe04.test.js#o plano carrega as notas e o registro de conclusão do fixture revisado, com digest estável"
        status: pass
      - kind: unit
        ref: "tools/release-close/safe04.test.js#o construtor de plano computa o digest duas vezes e recusa quando elas discordam"
        status: pass
      - kind: unit
        ref: "tools/release-close/safe04.test.js#o texto do plano mostra o conteúdo revisado acima dos passos e do contador mutations"
        status: pass
    human_judgment: false
  - id: D7
    description: "The gate receives the output-terminal boolean from the output stream and a sink that reports a character count rather than a boolean, and the CLI performs no output write before the gate returns"
    requirement: "SAFE-04"
    verification:
      - kind: unit
        ref: "tools/release-close/safe04.test.js#a CLI recusa na fechadura de saída com terminal de entrada vivo e saída redirecionada"
        status: pass
      - kind: unit
        ref: "tools/release-close/safe04.test.js#a CLI entrega ao portão um sink que relata contagem de caracteres, e não um booleano"
        status: pass
    human_judgment: false
  - id: D8
    description: "End-of-input and stream errors each return a refusal with a single settled prompt and their own distinct PT-BR reason, and neither leaves the process alive"
    requirement: "SAFE-04"
    verification:
      - kind: unit
        ref: "tools/release-close/safe04.test.js#o prompt se liquida sozinho quando o terminal fecha logo depois de abrir"
        status: pass
      - kind: unit
        ref: "tools/release-close/safe04.test.js#o prompt se liquida sozinho quando o fluxo de entrada dá erro depois de abrir"
        status: pass
    human_judgment: false
  - id: D9
    description: "The SAFE-04 suite runs on the production seam: the local snapshot and evidence helpers that re-implemented normalization are gone, every decision comes from the exported decide seam, and the exact expectation table asserts every frozen scenario's exact eligibility code, exact classification code, exact outcome, the ABSENCE of outcome where there is none, and the full retained identifier lists"
    requirement: "SAFE-04"
    verification:
      - kind: unit
        ref: "tools/release-close/safe04.test.js#nenhum fixture registra escrita: verify e plan emitem mutations 0"
        status: pass
      - kind: unit
        ref: "tools/release-close/safe04.test.js#a suíte não define helper local de snapshot nem de evidência"
        status: pass
    human_judgment: false
  - id: D10
    description: "The completed scenario surfaces as the exact pair MISSING plus COMPLETE_NOOP, the reviewed scenario carries the fixture's own notes and completionRecord strings, and the reference baseline carries no reviewed object at all rather than an empty one"
    requirement: "OPS-01"
    verification:
      - kind: unit
        ref: "tools/release-close/safe04.test.js#nenhum fixture registra escrita: verify e plan emitem mutations 0"
        status: pass
      - kind: unit
        ref: "tools/release-close/safe04.test.js#o plano sem campos revisados não carrega objeto nem digest, e o texto diz isso em PT-BR"
        status: pass
    human_judgment: false
  - id: D11
    description: "Rendering the plan twice over the same frozen snapshot is byte-identical with an identical digest, and preflighting the confirmation twice returns the identical decision without moving the digest"
    requirement: "SAFE-04"
    verification:
      - kind: unit
        ref: "tools/release-close/safe04.test.js#dois planos sobre o mesmo snapshot congelado rendem texto e digest byte-idênticos"
        status: pass
      - kind: unit
        ref: "tools/release-close/safe04.test.js#o pré-flight da confirmação duas vezes devolve a decisão idêntica e não move o digest"
        status: pass
      - kind: unit
        ref: "tools/release-close/safe04.test.js#verificação seguida de plano sobre o mesmo fake: decisões idênticas, zero escritas (hipótese E)"
        status: pass
    human_judgment: false
  - id: D12
    description: "The credential scan still passes over the widened captured outputs, covering the piped apply invocations, the gate's rendered plan and the rendered reviewed content, and no non-test source reads a credential environment variable or names a credential form"
    requirement: "SAFE-04"
    verification:
      - kind: unit
        ref: "tools/release-close/safe04.test.js#as saídas capturadas de verify, plan e apply não carregam forma de credencial"
        status: pass
      - kind: unit
        ref: "tools/release-close/safe04.test.js#nenhuma fonte de implementação nomeia forma de credencial"
        status: pass
      - kind: unit
        ref: "tools/release-close/safe04.test.js#a ferramenta não lê variável de ambiente de credencial em lugar nenhum"
        status: pass
    human_judgment: false
  - id: D13
    description: "The operator surface is unchanged: the same verbs, the same PT-BR refusal reasons, the same exit codes, the same eight ordered recovery steps and their markers, and verify and plan still emit the measured mutation count"
    requirement: "OPS-01"
    verification:
      - kind: unit
        ref: "tools/release-close/safe04.test.js#a verificação em texto e em json carrega o contador mutations 0"
        status: pass
      - kind: unit
        ref: "tools/release-close/safe04.test.js#o plano em texto e em json carrega o contador mutations 0"
        status: pass
      - kind: unit
        ref: "tools/release-close/safe04.test.js#o plano marca criação e leitura passo a passo no baseline ausente"
        status: pass
      - kind: unit
        ref: "node tools/release-close/release-close.js plan; plan --json; verify -> exit 0"
        status: pass
    human_judgment: false
  - id: D14
    description: "The four PT-BR operator-facing messages this plan routes differently — the output-terminal refusal, the zero-character sink refusal, the end-of-input refusal and the stream-error refusal — read as a coherent set for an operator who did not write them"
    verification: []
    human_judgment: true
    rationale: "No test can assert that a set of PT-BR messages reads coherently, and turning prose into substring contracts would add a second contract the plan does not ask for. The suite pins what is mechanically checkable: each message names the lock that actually fired, the end-of-input reason is distinguishable from the stream-error reason, and the zero-character sink reason says the plan was swallowed rather than merely that something failed. A human should read the four once before the Phase 12 runbook quotes them, and confirm in particular that an operator who hit the output-lock refusal understands the plan was never shown to them."
  - id: D15
    description: "The guard this rewrite adds is load-bearing: an 18-mutation probe of apply-gate.js and release-close.js makes every mutated guard fail at least one scoped probe, and both sources are byte-identical afterwards"
    requirement: "SAFE-04"
    verification:
      - kind: other
        ref: "18-mutation probe (11 in apply-gate.js, 7 in release-close.js) -> 18/18 caught, M18 caught by hang; both sources restored byte-identical (sha256 verified); suite returns to 186/186"
        status: pass
    human_judgment: false

# Metrics
duration: 43 min
completed: 2026-09-25
status: complete
commits: 5
plan_head_before: 8daef729d56612a129085afb7b88b7507b0b9878
---

# Phase 09 Plan 08: Output-Terminal Lock, Reviewed Content Bound by a Canonical Digest, and a Production-Seam SAFE-04 Suite Summary

**An apply that previously confirmed with its output redirected to a file now refuses on a live-output-terminal lock, and the operator's approval is bound to immutable Release and Milestone content through a single canonical digest that is recomputed at the moment of confirmation and rendered — plan first, reviewed content second — before the prompt ever opens**

## Performance

- **Duration:** 43 min
- **Started:** 2026-09-25T17:44:02Z
- **Completed:** 2026-09-25T18:27:15Z
- **Tasks:** 3
- **Files modified:** 4 (1 created, 3 modified)

## Accomplishments

- **CR-01 is dead, and the bypass it closed is now provable from outside the process.** With a live input terminal and stdout redirected to a file, the operator could answer the confirmation word without ever having seen the plan, and the gate reported that confirmation happened "after the plan". The gate now takes an explicit `outputIsTTY` boolean and refuses on it as lock four, before writing anything and before asking anything. The reproduction is now an operating-system-level fact rather than a test claim: a real pty on stdin with stdout pointed at a file exits 1, writes **0 bytes** to that file, never opens the prompt, and names the output lock. The plan carried no Release notes, no Milestone completion record and no digest, so the gate could have been reused by Phase 11 binding an operator's approval to no content at all; it now cannot.
- **The two terminal families are attributed to the lock that actually fires, and the suite proves the negative.** A fully piped invocation — the child process the suite spawns — has a non-terminal input stream, so it fails on `tty` (lock three) and can never reach `output` (lock four). That case is a top-level row of its own that asserts the `terminal interativo` reason, an empty stdout, and — the part that matters — that the **output**-lock phrase is *absent* from stderr. Without that negative assertion a future edit could quietly re-attribute a pipe refusal to the output lock and the suite would still be green.
- **The render position is declared once and the refusal families are told apart by their write-observable.** Nothing is written and no prompt is opened until every lock from `plan` through `content` has passed. The consequence is a clean split: nine refusal families observe **zero sink calls**, and exactly one — a sink that reports zero characters across the render — observes **sink calls whose reported total is zero**, with no prompt. That one is kept as its own row in the consolidated table, because merging it with a pre-render refusal would erase the distinction the threat register names. The pre-lock `write(planText)` that used to sit ahead of the flag lock is gone, and the case that used to assert "the plan was written even when the run was going to refuse" now asserts an **empty event list** with lock `flag` — the assertion that an operator is never shown a plan for an apply the gate was always going to refuse.
- **The operator's approval is bound to content, and the content has one named source.** `canonicalReviewedDigest` is the only serializer of reviewed content in the repository; each of its five fields is emitted as a `name` + `length` + `value` triple, so text cannot be shifted from one field into the next to forge a separator boundary. The gate recomputes it at prompt time and refuses on a mismatch, and the plan builder computes it a second time and refuses to emit a plan when the two disagree — so a non-deterministic digest fails before the operator reads anything rather than at the prompt. The two PT-BR strings the digest covers come from named fields of `fixtures/reviewed.json` and nowhere else; the suite asserts them byte for byte, and a snapshot without those fields produces no reviewed object and therefore refuses.
- **A prompt that used to leave the process alive now settles exactly once.** End-of-input and stream errors are refusals, not empty words, because the operator confirmed nothing and saying they typed the wrong thing would be a lie. Each settles under a single flag across three outcomes — answer, close, stream error — so a late answer after a close cannot settle twice or open a second prompt, and the interface is always closed. The two causes carry different PT-BR reasons and the suite pins the difference, because they call for different operator actions.
- **The SAFE-04 suite now exercises the seam it was claiming to exercise.** The local snapshot and evidence helpers that re-implemented normalization are deleted, along with the `releases[0]` / `milestones[0]` collapse that let the duplicate and conflicting fixtures pass while the suite ran against a different state than the one it named. Every decision now comes from the `decide` seam exported by 09-07. The old assertion that a classification code was merely a string is replaced by an exact expectation table: every frozen scenario asserts its exact eligibility code, its exact classification code, its exact `outcome` **and the absence of `outcome` where there is none**, plus the full retained identifier lists. The completed scenario is pinned as the exact pair `MISSING` + `COMPLETE_NOOP` — the same literal 09-05 fixed and 09-07 proved reachable — and the reference baseline is asserted to carry no reviewed object at all, not an empty one.

## Task Commits

Each task followed the RED → GREEN procedure; task 3 is a test-only consolidation and is documented under Deviations.

1. **Task 1: the eight-lock apply gate with an output-terminal lock, a real-sink lock, a reviewed-content lock bound to a canonical digest, the render moved to after the content lock, and every SAFE-04 case that move changes migrated in the same task** - `c8b3be2` (test RED) then `228d8b9` (feat GREEN), plus the new frozen fixture `fixtures/reviewed.json`
2. **Task 2: the reviewed content carried in the plan, the output-terminal wiring, a character-counting sink and a prompt that settles on end-of-input, with the SAFE-04 cases that wiring invalidates** - `8e80fe0` (test RED) then `3196434` (feat GREEN)
3. **Task 3: the SAFE-04 suite on the production seam with exact per-scenario codes, one consolidated refusal table and the no-drift proofs** - `b5cddec` (test; proven load-bearing by an 18-mutation probe, 18/18 caught)

**Plan metadata:** this commit.

## Files Created/Modified

- `tools/release-close/apply-gate.js` — the exported eight-lock `APPLY_LOCKS`, the `output` / `sink` / `content` locks, the single exported `canonicalReviewedDigest`, `renderReviewedText`, the one declared render position between the content lock and the prompt lock, and the digest echoed in the returned decision
- `tools/release-close/release-close.js` — the plan builder attaching the immutable reviewed object and the digest and refusing a non-deterministic one, the reviewed block rendered above the ordered steps, the apply path reading `outputIsTTY` from the output stream and passing a character-counting sink, and the ask factory settling once on answer, close and stream error
- `tools/release-close/safe04.test.js` — 47 probes: the exact per-scenario expectation table on the production seam, one consolidated refusal table, the fully-piped CLI row, the plan-then-reviewed render order, the end-of-input and stream-error cases, the no-drift proofs, four source guards and the widened credential scan
- `tools/release-close/fixtures/reviewed.json` — the frozen client-shaped scenario that owns the reviewed Release notes and Milestone completion record; both envelopes intact, no flat `releases` or `closeMarkers` key, same key set as the reference baseline
- `.planning/WINDOWS.md` — one new open `deviation` entry describing why task 3 produced no RED commit

## Decisions Made

- **The three new locks sit between `tty` and `prompt`.** That placement is what preserves every pre-existing refusal: a missing flag still refuses on `flag`, a pipe still refuses on `tty`, and a missing plan still refuses on `plan`, with no new input anywhere. Placing them before `tty` would have changed what a shipped case returns.
- **A fully piped refusal is asserted on `tty`, and the `output` lock is proven through the injected seam instead.** The child process the suite spawns has a piped input stream, so lock four is unreachable from it. The plan names this in three places; the suite goes further and asserts the output-lock phrase is *absent* from that case's stderr, so the two families cannot be merged later.
- **The render position is declared once, and the whole plan follows from it.** After the content lock, before the prompt, as the first act after the content lock. The render is not itself a lock, which is why `APPLY_LOCKS` still has exactly the eight entries the plan names.
- **The zero-character sink refusal is kept as a distinct family, not a variant of the pre-render refusals.** It is the only refusal whose write-observable is sink *calls* rather than zero calls, and the table holds that difference rather than averaging it away.
- **The digest is one function, computed twice, recomputed at the prompt.** One exported serializer means the plan builder and the gate cannot compute two different digests over the same content. Computing it twice in the builder means a non-deterministic digest refuses before the operator reads anything. Recomputing it at the prompt is what makes the mismatch detectable at all.
- **Reviewed text is owned by a fixture field, never by template prose.** A digest over invented text binds the operator's approval to nothing, which is strictly worse than no digest.
- **`outputIsTTY` is read from the output stream.** Reading stdin twice would re-open the exact bypass the lock exists to close. The suite proves the read with a two-sided differential through the real CLI entry: flipping only the output boolean moves the refusal from the output family to the content family.
- **The end-of-input and stream-error reasons differ, and the difference is pinned.** Both settle without an answer, but they are different causes with different operator actions.
- **The CLI's counting-sink adapter is pinned by a source guard, and the guard says why.** `runApply` always serves the reference baseline, which has no Release notes and no Milestone completion record, so the content lock refuses and the render never happens on that path; every `confirmApply` call injects its own `write`. No behavioural probe can therefore observe what the CLI's own adapter hands the gate. The guard states that limitation in the file rather than leaving a silent hole. (See deviation 2.)
- **`clientSnapshotFor` stays, and it is not the helper the plan asked to delete.** It adapts a flat state fixture into the client shape the production seam consumes. It does not normalize: the release payload is retained whole, never its first element, which is precisely the WR-03 defect that let the duplicate and conflicting fixtures pass. The suite's own guard forbids `function …snapshot(`, and a fixture-shape adapter that were also a normalizer would have tripped it.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] A half-applied edit in `makeAsk` deleted the end-of-input settlement and hung the entire suite**
- **Found during:** Task 3, first run of the resumed executor
- **Issue:** The `rl.once('close', () => liquidar(motivoDeFim))` listener had been deleted and replaced by a bare comment reading "fechamento não liquida: o processo ficaria vivo". That listener is what settles the prompt when the input stream *ends* with no answer; without it the promise never resolves and the process stays alive until an external timeout. The symptom was that `node --test` ran 127+ assertions and then never exited, timing out at 120s with `Interrupted while running: safe04.test.js`. This is the exact regression threat T-09-08-04 forbids ("prompt left pending on end-of-input") and the exact thing task 3's own `<fails_when>` names ("an end-of-input apply leaves the run pending"). The comment's claim was also backwards: not closing *is* what leaves the process alive, and the `liquidar` idempotence flag is precisely what makes restoring the listener safe.
- **Fix:** Restored the `rl.once('close', …)` line together with its original two-line comment. The surviving `aoErro` / `aoErroDoFluxo` listeners above it are correct and unrelated — the comment block describing them ("Os dois ouvintes ficam…") is about those two, not about `close`, and they were left untouched. Because `liquidar` no-ops on the second dispatch, restoring the listener does not double-settle: `close` fires both when the line is read and when the stream ends with no answer, and the flag makes the second a no-op.
- **Files modified:** `tools/release-close/release-close.js`
- **Verification:** The repair restores the file **byte-identical** to the task-2 GREEN commit `3196434` — `git diff` against it is empty, which is the strongest available proof that the intended code was recovered rather than rewritten. The suite then exits 0 on its own: 186 tests, 186 pass, deterministic across three consecutive runs.
- **Note:** The file carries no diff of its own in task 3's commit, precisely because the repair returned it to its committed state. The 18-mutation probe closes the loop from the other side: mutation M18 removes this exact listener and is caught, by hang.
- **Committed in:** not a separate commit — the repair restored `release-close.js` to its already-committed task-2 content, so the fix ships as part of the state `3196434` always described.

**2. [Rule 2 - Missing Critical] The CLI's character-counting sink adapter was uncovered, and one mutation escaped the first probe pass**
- **Found during:** Task 3, the 18-mutation probe
- **Issue:** Seventeen of eighteen mutations were caught, but M17 — changing the apply path's sink from the counting adapter back to a boolean-returning `write` — produced **zero** failing probes. The reason is a real property of the production surface, not a test oversight: `runApply` always serves `fixtures/reference.json`, which carries no Release notes and no Milestone completion record, so the content lock refuses and **the render never happens on any path the CLI can currently be given**; and every `confirmApply` call in the suite injects its own `write`, bypassing the adapter entirely. So the adapter that task 2 introduced — and that the whole sink lock depends on — had no assertion behind it at all.
- **Fix:** Added a source guard that reads the module text and states its own limitation: the adapter must write to the stream and return `recebido.length`, must not return `write`'s value or a boolean literal, the apply path must hand the gate `sinkQueContaCaracteres(io.stdout)` rather than a raw `write`, and `outputIsTTY` must come from `io.stdout` and not `io.stdin`. It reuses a `fatiarFuncao` slicer that starts the brace counter at the **body** brace rather than the first brace after the declaration, because a counter that starts at a destructured parameter's brace returns the signature and nothing else — 09-07's second deviation recorded that exact helper bug, and reusing the corrected shape avoids reintroducing it.
- **Files modified:** `tools/release-close/safe04.test.js`
- **Verification:** M17 is now caught by the new guard, M16 is caught by both the new guard and the existing two-sided differential, and the full probe re-runs 18/18 with both sources restored byte-identical. The suite is 186/186, deterministic across three runs.
- **Committed in:** `b5cddec`

### Procedure Deviations

**3. [Rule 2 - Missing Critical] Task 3 produced no RED commit and was proven load-bearing by an 18-mutation probe**
- **Found during:** Task 3
- **Issue:** Task 3 declares `tdd="true"` and its own action states it "changes no production source and no fixture". TDD's fail-fast rule 1 fired and the investigation it requires confirmed why: every behaviour the rewritten suite asserts — the eight locks and their order, the render position, the reviewed-content and digest refusals, the sink families, the settled prompt, the exact per-scenario codes, the no-drift proofs — was implemented by this same plan's task 1 and task 2 RED/GREEN cycles. No intentional RED was producible without fabricating a failure or editing production source the plan forbids touching.
- **Fix:** Ran the investigation, then replaced the ceremonial red with a stronger artifact. Eighteen mutations were probed: eleven in `apply-gate.js` (remove the output lock; move `output` before `tty` in the exported order; return the render to before the content lock; invert the render order; drop the second render; weaken the total check to accept zero characters; trust the supplied digest instead of recomputing; remove the reviewed-content completeness check; let the plan lock accept a blank plan; remove the sink type lock; stop echoing the digest in the success decision) and seven in `release-close.js` (reviewed notes from template prose instead of the observed record; move the reviewed block below the ordered steps and the counter; compute the digest once; drop the digest from the rendered text; read the output-terminal boolean from the input stream; return a boolean from the sink adapter; remove the `rl.once('close')` prompt listener). **18/18 caught**; both sources restored byte-identical (sha256 verified) and the suite returned to 186/186. M18 is caught *by hang*, which is the honest signature of defect T-09-08-04 and independently confirms deviation 1.
- **Vacuous mutations rejected before running**, per the class learned in 09-05 and 09-06: returning `reviewedDigest: reviewedDigest` in the success decision is vacuous because the suite always supplies the correct digest, so the two values always coincide; changing `yesFlag !== true` to `!yesFlag` is vacuous because no probe passes a truthy non-`true`; and reordering `content` before `sink` is vacuous because with valid content both orders refuse on the same lock with the same name. A probe that cannot change an outcome proves nothing, and recording three of them as "caught" would have inflated the number.
- **Files modified:** `tools/release-close/safe04.test.js` (commit `b5cddec`); the temporary mutations were reverted and never committed.
- **Verification:** 18/18 caught, `git diff --exit-code` clean on both sources after the probe.
- **Recorded in:** `.planning/WINDOWS.md` as open `deviation` entry 5, so the ship gate can see it.

**4. [Rule 1 - Bug, worked around] A probe assertion message switched from a template literal to concatenation as a precaution**
- **Found during:** Task 3, the source guard for the plan builder's double digest computation
- **Issue:** 09-07 recorded a deterministic `ReferenceError` on a `for (const simbolo of …)` binding declared correctly one line above, in a full-file run but never in isolation, with no minimal reproduction and no established cause. The new guard used the same shape — a count interpolated into a `for`-free but template-literal assertion message. Since that symptom is unexplained rather than exonerated, and since the two message forms assert identically, the interpolation was removed rather than risk a repeat of a failure whose cause is unknown.
- **Fix:** The assertion message is concatenated instead. Nothing about the assertion's strength changed; the guard still requires exactly two calls to the serializer and still fails when the count differs.
- **Files modified:** `tools/release-close/safe04.test.js`
- **Verification:** 186/186 green across three consecutive full runs.
- **Committed in:** `b5cddec`

**5. [Guard override] Commits landed on `main` with the repository's protected-branch classification**
- **Found during:** Task 3 commit
- **Issue:** `main` is a protected branch in this repository, and the pre-commit guard can classify a commit there as disallowed. The standard executor contract refuses to commit on a protected branch.
- **Fix:** Committed anyway, under an explicit dispatch instruction. `.planning/config.json` sets `git.branching_strategy: "none"`, the orchestrator dispatched this executor onto `main` as sole writer, and plans 09-01 through 09-07 all committed the same way. No hook **failed** — this is a classification the guard can be asked to allow, not a broken check, and `--no-verify` was not used at any point.
- **Files modified:** none
- **Verification:** all five commits are present on `main` and the suite is green at each one.

---

**Total deviations:** 5 (2 bugs, 2 procedure deviations, 1 guard override; of the 2 bugs, one is the repaired half-applied edit and one is a real coverage gap the probe exposed)
**Impact on plan:** Deviation 1 was a genuine hang in the suite and the plan's own named `<fails_when>`; it is closed and the repair is byte-identical to the intended state. Deviation 2 is the substantive one: it found a production guarantee with no assertion behind it, and closed the gap with a guard that documents its own reach. Deviations 3 and 4 changed no production behaviour and cost no scope; the cost is that the commit log shows no RED for task 3, which is recorded in `.planning/WINDOWS.md`. Deviation 5 is an override, not a fix, and is recorded so it is not mistaken for one.

## Issues Encountered

- **The CLI cannot currently reach its own render.** `runApply` always serves `fixtures/reference.json`, and that baseline has no Release notes and no Milestone completion record, so the content lock refuses before the render. The reviewed-content gate is therefore proven through the injected `confirmApply` seam, not through a real end-to-end apply. This is fail-closed and therefore safe — the CLI refuses — but it means the "operator reads the reviewed content on a live terminal before the prompt" flow is not yet reachable in production. It becomes reachable when a later phase serves a baseline that carries reviewed content. Flagged rather than papered over, and it is the reason deviation 2's guard had to be a source guard.
- **A probe that cannot change an outcome is a probe that proves nothing.** Three of the eighteen candidate mutations were rejected before running because the broader escape or throw family already covered the mutated value. The count is reported as 18 of 18 rather than 21 of 21, and the rejected three are named in deviation 3.
- **The unexplained `ReferenceError` from 09-07 is still unexplained.** Worked around rather than diagnosed (deviation 4), because the same shape could otherwise resurface in a new probe and cost a confusing debugging cycle.

## TDD Gate Compliance

| Plan | RED | GREEN | REFACTOR | Status |
|------|-----|-------|----------|--------|
| 09-08 task 1 | `c8b3be2` (target test failed on the planned output/sink/content locks) | `228d8b9` | none needed | Pass |
| 09-08 task 2 | `8e80fe0` (target test failed on the reviewed content in the plan and the settled prompt) | `3196434` | none needed | Pass |
| 09-08 task 3 | none producible (test-only; see deviation 3) | `b5cddec` (proven by an 18-mutation probe, 18/18 caught) | n/a | Deviation documented |

## Verification

- `node --test tools/release-close/safe04.test.js` → 47 tests, 47 pass, 0 fail, exit 0
- `node --test tools/release-close/` → 186 tests, 186 pass, 0 fail, exit 0, deterministic across three consecutive runs. The baseline before this plan was 164; the 164 stayed green untouched and include the eligibility, classifier, canary, evidence and no-write suites
- `node tools/release-close/release-close.js plan`, `plan --json` and `verify` → all exit 0 on the frozen baseline
- **Manual probe, fully piped** — `apply --yes </dev/null` → exit 1, **0 bytes** on stdout, the `terminal interativo` reason on stderr, no prompt
- **Manual probe, live input terminal with a redirected output (the CR-01 reproduction)** — a real pty on stdin with stdout pointed at a file, driven through `pty.openpty` and `subprocess` → exit 1, **0 bytes** written to the file, the prompt never opened, and the output-lock reason `o plano não foi mostrado em um terminal vivo` on stderr
- **Manual probe, the differential that proves where the boolean is read** — through the real CLI entry with both terminals live, the refusal is the **content** family (`não há notas de Release nem registro de conclusão`); with only the output non-TTY, it is the **output** family. Two different refusals from one boolean is the evidence that it is read from the output stream
- **Manual probe, end-of-input** — not reachable through the CLI, because the content lock refuses first on the reference baseline. Covered at the `makeAsk` seam with a controlled `PassThrough` that ends immediately after the prompt opens: one refusal, exactly one settled prompt, no hang
- `git diff --name-only 8daef72..HEAD` → exactly the four declared `files_modified` plus `.planning/WINDOWS.md`; `classify.js`, `classify.test.js`, `client.js`, `fake-client.js`, `eligibility.js`, `nowrite.test.js`, `canary.test.js`, `evidence.test.js` and every other file under `fixtures/` confirmed untouched
- `tools/release-close/package.json` still declares no `dependencies` key; no runner, assertion library or dependency was added; no npm install ran in any task (T-09-08-SC)
- 18-mutation probe → 18/18 caught, `apply-gate.js` and `release-close.js` byte-identical afterwards (sha256), suite back to 186/186
- `fixtures/reviewed.json` verified client-shaped: both envelopes intact as envelopes, no `releases` key, no `closeMarkers` key, the `target` block present, the canonical `ci` block with four records, non-blank `notes` and `completionRecord`, milestone `state: closed` with `openIssues: 0`, and the **same key set** as the reference baseline
- No `TODO`, `FIXME`, placeholder text, `test.skip`, `it.skip` or `describe.skip` in any changed file
- `cd backend && npx vitest run` → 6 files, 131 tests, 131 pass (collateral)
- `cd frontend && npm run build` → built in 607ms, exit 0 (collateral)

## Known Stubs

None. This plan adds no placeholder value, no disconnected data source and no skipped test. The `mutations` counter in the rendered output remains a measurement on the frozen baseline and is necessarily zero there, which is the correct result rather than a stub. `WINDOWS.md` carries one new open `deviation` entry (deviation 3), which is a process record about the commit log, not a stub in the code.

## Threat Flags

| Flag | File | Description |
|------|------|-------------|
| threat_flag: the-cli-cannot-reach-its-own-render | `tools/release-close/release-close.js` | `runApply` always serves `fixtures/reference.json`, and that baseline has no Release notes and no Milestone completion record, so the content lock refuses and the render never happens on any path the CLI can currently be given. The reviewed-content gate and the character-counting sink adapter are therefore proven through the injected `confirmApply` seam, and the adapter additionally through a source guard (deviation 2). This is fail-closed and safe — the CLI refuses rather than confirms — but the operator-visible flow of reading reviewed content on a live terminal before the prompt is not yet reachable in production. It becomes reachable when a later phase serves a baseline that carries reviewed content; until then the sink adapter's counting behaviour has structural rather than behavioural proof. |
| threat_flag: a-digest-binds-approval-to-frozen-fixture-text | `tools/release-close/release-close.js` | The Release notes and Milestone completion record the operator approves are the two named fields of `fixtures/reviewed.json`, frozen at authoring time. The digest faithfully proves the operator saw *those bytes* and that they did not change between rendering and confirmation — it does not prove they describe the real v0.1.1 release on GitHub. That is the same seam 09-07 flagged for the CI block, and the same answer applies: in Phase 9 the only source is a frozen fixture and the alternative was synthesis. Phase 10/11 must replace the *source*, not the digest scheme, or the approval will keep binding to a month-old text. |
| threat_flag: source-guards-read-module-text | `tools/release-close/safe04.test.js` | Four guards assert against module *text* rather than behaviour: no local snapshot/evidence helper, no literal copy of the lock order, the plan builder's double digest computation, and the CLI's character-counting sink. They are tripwires — a behaviourally correct restructure can trip them and a behaviourally neutral reformat can too. Each states its own limitation in the file. The first two are tripwires by nature; the third and fourth guard properties with no observable consequence from outside, and the fourth is only a source guard because of the flag above. |
| threat_flag: reviewed-digest-is-preparation-never-a-write-path | `tools/release-close/apply-gate.js` | The reviewed digest exists so a later executor can bind a write to the object the operator approved. Nothing here writes remotely, and the confirmation still fails closed for want of any write path. The prohibition on remote writes before Phase 13 holds; this artifact is preparation, and Phase 13 is the first place it may be consumed. |

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- **09-09 can build on a gate with a real content lock.** `confirmApply` is a pure injected function with no cross-call state, so the reconciliation seam can drive it directly with the same three inputs every probe in this plan uses. The seam it needs — `decide({ snapshot, client, version, expectedSha, ci })` — is unchanged by this plan.
- **Phase 11 has a digest to bind a write to, and a name for it.** `plano.reviewed` plus `plano.reviewedDigest` are what an executor should compare against before any remote write, and `canonicalReviewedDigest` is the single function that produces the value. The eight-lock order is exported as `APPLY_LOCKS` and the runbook should quote that list rather than a restatement of it.
- **The one thing a later phase must unblock is the CLI's own render path.** Serving a baseline that carries reviewed content is what turns the reviewed-content flow and the counting sink adapter from injected-seam proofs into end-to-end ones. That is the single highest-value change available to Phase 10 or 11, and it is recorded above rather than left for someone to rediscover.
- **Two source guards will fire on a restructure and that is expected.** The four module-text guards in `safe04.test.js` read code, not behaviour. A Phase 10 rewrite of the apply path that keeps the same behaviour but renames `sinkQueContaCaracteres` or reorders the two digest computations inside `buildClosePlan` will trip them. The intended response is to read the guard, confirm the property still holds, and update the guard — not to weaken it until it stops firing.
- **Unchanged from before this plan:** Phase 9 still carries the production failure/re-read coverage owned by 09-09, and real cross-process arbitration (REC-05) stays in Phase 11 and is explicitly not claimed — the SAFE-04 boundary block in the suite says so in PT-BR where a reader will find it.
- One named human-judgment item remains for UAT (D14): reading the four operator-facing messages this plan routes differently once, before the Phase 12 runbook quotes them.

## Self-Check: PASSED

- Key files confirmed on disk: all four changed paths, including the created `fixtures/reviewed.json`; `git status --short tools/release-close/` is clean
- All five task commits confirmed present: `c8b3be2`, `228d8b9`, `8e80fe0`, `3196434`, `b5cddec`
- `git rev-list --count 8daef72..HEAD` → 5, matching the frontmatter `commits`, measured from the persisted plan-head ledger rather than narrated
- Every task-3 `<acceptance_criteria>` item was re-checked mechanically before the commit: 27 of 27 criteria pass, including the exact per-scenario codes and outcome, the reviewed and reference-baseline reviewed-content handling, the retained identifier lists, the one consolidated refusal table with its distinct zero-character row, the fully-piped row asserting `tty` and the *absence* of the output phrase, the plan-then-reviewed-then-prompt event order, the empty event list on every pre-render refusal, the single settled prompt on both end-of-input and stream error, the no-drift proofs, and the four source guards
- `node --test tools/release-close/` exits 0 (not a timeout) with 186 tests and 186 passes, against a pre-plan baseline of 164, deterministic across three consecutive runs
- Collateral project gates green: backend 131/131, frontend build exit 0
- No stub, skipped test or unrun `<verify>` remains open in this plan's files
