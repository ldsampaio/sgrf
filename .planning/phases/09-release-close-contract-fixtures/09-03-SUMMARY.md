---
phase: 09-release-close-contract-fixtures
plan: "03"
subsystem: infra
tags: [node-test, esm, cli, tty-double-lock, apply-gate, ordered-plan, secret-hygiene, api-coverage, safe-04, ops-01]

# Dependency graph
requires:
  - 09-01 tracer (CLI skeleton, exit contract 0/1/2, verify path with mutations 0, client seam)
  - 09-02 contract (six-state classifySnapshot, seven fixtures, scripted fake with write trap, throwing gh stub, static forbidden-surface scan)
provides:
  - confirmApply double-lock gate (flag -> terminal -> digitação sim) with plan-visible-before-prompt enforced inside the gate
  - Eight-step ordered close plan with criar/adotar/ler markers against frozen SHAs, tag object and green run IDs
  - Wired plan and apply verbs (plan read-only, apply fail-closed with no live write path) plus --json on both
  - SAFE-04 proof suite: zero writes over all seven fixtures, all three refusals, confirm-only-with-all-locks, secret hygiene
  - Executable codification of flagged assumption E (idempotency) and assumption F (no cross-process apply lock)
  - No-external-API declaration in COVERAGE.md naming the fake, the throwing stub and Phase 10
affects: [phase-10 gh-client wiring, phase-11 reconciliation, phase-12 runbook evidence, phase-13 live apply procedure]

# Actuals (#2632) — pairs with the plan's `estimate` to calibrate future estimates.
actuals:
  tokens: 9987
  tasks: 3
  commits: 3

commits: 3
plan_head_before: cd527ed3555ce05a2a1e5f62b24e09fb9da5d2e1

# Tech tracking
tech-stack:
  added: []
  patterns: [lock-ordered-gate, plan-render-then-prompt, fail-closed-after-confirmation, sink-injected-visibility-proof]

key-files:
  created:
    - tools/release-close/apply-gate.js
    - tools/release-close/safe04.test.js
    - .planning/phases/09-release-close-contract-fixtures/COVERAGE.md
  modified:
    - tools/release-close/release-close.js

key-decisions:
  - "The gate owns the write: confirmApply takes the rendered planText and an optional write sink and emits the plan before any lock check, so plan-visible-before-prompt is executable rather than a code-order claim"
  - "apply refuses on blocking classifications (FAILED, CONCURRENT, CONFLICTING, DUPLICATE) right after displaying the plan, before any prompt, and plan exits 1 in those states so a script cannot read plan exit 0 as apply-ready"
  - "apply --json emits the same plan structure as plan --json before the human text; the gate verdict itself stays PT-BR text on stderr so an unattended consumer cannot parse its way to an apply decision"
  - "The emitted mutations value is the fake's own write counter, not a literal, so zero writes implies zero mutations executably"
  - "Per-fixture zero-write proof normalizes state fixtures into the client read shape (tag/main reads are the same immutable baseline in every state; only release/milestone reads vary)"

patterns-established:
  - "Lock-ordered gate: a fixed sequence of independent locks (plan, flag, tty, prompt, answer), each returning { confirmed:false, lock, reason } in PT-BR; the missing lock is named, never a generic failure"
  - "Injected sink as ordering proof: write(plan) then await ask() gives the test an event log proving visibility precedes the question, in both the confirm and the refuse path"
  - "Fail-closed after successful confirmation: once both locks pass, a phase with no write path says so explicitly and exits non-zero instead of pretending to act"

patterns-not-yet-exercised:
  - "The adoption (adotar) branch of the plan renderer has no fixture that reaches it: the CLI is bound to the reference fixture where the release and milestone are both absent. Phase 11 drives adoption over the state fixtures."

requirements-completed: [SAFE-04, OPS-01]

coverage:
  - id: D1
    description: "Double-locked apply gate plus the eight-step ordered plan, printed before any prompt"
    requirement: "SAFE-04"
    verification:
      - kind: unit
        ref: "node tools/release-close/release-close.js apply --yes < /dev/null; echo piped_exit=$? — piped_exit=1 with PT-BR terminal-interativo refusal"
        status: pass
      - kind: unit
        ref: "tools/release-close/safe04.test.js#verifica flag, depois terminal, depois resposta, nessa ordem"
        status: pass
      - kind: unit
        ref: "tools/release-close/safe04.test.js#grava o plano antes de qualquer pergunta"
        status: pass
      - kind: unit
        ref: "manual pty run: printf 'sim\\n' | script -qec 'node tools/release-close/release-close.js apply --yes' — plan shown, prompt asked, confirmation accepted, then fail-closed naming Fase 11"
        status: pass
    human_judgment: false
  - id: D2
    description: "Mutations-zero proof for verify and plan over every fixture, in text and json"
    requirement: "OPS-01"
    verification:
      - kind: unit
        ref: "tools/release-close/safe04.test.js#nenhum fixture registra escrita: verify e plan emitem mutations 0"
        status: pass
      - kind: unit
        ref: "tools/release-close/safe04.test.js#a verificação em texto e em json carrega o contador mutations 0"
        status: pass
      - kind: unit
        ref: "tools/release-close/safe04.test.js#o plano em texto e em json carrega o contador mutations 0"
        status: pass
    human_judgment: false
  - id: D3
    description: "Secret-hygiene proof plus executable codification of flagged assumptions E and F"
    requirement: "SAFE-04"
    verification:
      - kind: unit
        ref: "tools/release-close/safe04.test.js#as saídas capturadas de verify, plan e apply não carregam forma de credencial"
        status: pass
      - kind: unit
        ref: "tools/release-close/safe04.test.js#verificação seguida de plano sobre o mesmo fake: decisões idênticas, zero escritas (hipótese E)"
        status: pass
      - kind: unit
        ref: "tools/release-close/safe04.test.js#avaliações sequenciais do portão não compartilham estado (hipótese F)"
        status: pass
    human_judgment: false
  - id: D4
    description: "No-external-API coverage declaration plus the final gate sweep (tool suite, backend vitest, frontend build, confined change surface)"
    requirement: "OPS-01"
    verification:
      - kind: unit
        ref: "gsd-tools check api-coverage.verify-pre .planning/phases/09-release-close-contract-fixtures — block:false, none_declared:true"
        status: pass
      - kind: unit
        ref: "node --test tools/release-close/ — 57 tests, 57 pass, 0 fail"
        status: pass
      - kind: unit
        ref: "cd backend && npx vitest run — 6 files, 131 tests passed"
        status: pass
      - kind: unit
        ref: "cd frontend && npm run build — 107 modules transformed, built in 562ms"
        status: pass
    human_judgment: false

# Metrics
duration: 6min
completed: 2026-09-25
status: complete
---

# Phase 09 Plan 03: Double-Locked Apply, Ordered Plan, and SAFE-04 Proof Summary

**Apply that renders the whole eight-step recovery order before it asks anything, then refuses unless `--yes`, a live terminal, and a typed `sim` are all present — with mutations-zero proven over all seven fixtures, credential-shaped output proven absent, and no external API integration declared: 57/57 green under `node --test`.**

## Performance

- **Duration:** 6 min
- **Started:** 2026-09-25T14:41:14Z
- **Completed:** 2026-09-25T14:47:00Z
- **Tasks:** 3
- **Files modified:** 4 (2 created, 2 created/extended — 3 tool sources plus 1 phase artifact)

## Accomplishments

- `apply-gate.js` exports `confirmApply({ yesFlag, isTTY, planText, ask, write })`: locks checked in the fixed order plan → flag → tty → prompt → answer, every refusal naming the missing lock in PT-BR, the plan written before any lock check, and no module state between evaluations
- The eight-step plan (rascunho, releitura, publicação, releitura, abertura da milestone, releitura, fechamento, releitura final) renders with `criar`/`adotar`/`ler` markers against the frozen tag object `0a68d6f0…`, commit `10c62ac…` and green runs `36095855139`/`36095872529`; the order is asserted verbatim by test (T-09-09)
- `plan` and `apply` verbs wired: `plan` is read-only and non-prompting with `mutations: 0` in both text and json, `apply` shows the same plan and then fails closed — after a fully accepted double confirmation it still exits non-zero, naming Phase 11 as the milestone that reconciles
- All four lock combinations verified end to end, including a real pty run: piped `--yes` refuses on the terminal lock, piped without `--yes` refuses on the flag lock without opening a prompt, `sim` confirms and then fails closed, `nao` refuses on the answer lock
- SAFE-04 suite: 25 new cases (57 total) covering zero writes over all seven fixtures, `mutations: 0` in text and json, json parseability, the three refusals, confirm-only-with-all-locks, plan-before-prompt as an event log, assumption E (verify-then-plan identical, empty writes) and assumption F (stateless sequential gate evaluations)
- Secret hygiene proven by scanning every non-test source plus eleven captured outputs (verify/plan/apply in text, json and refusal form, plus all four gate verdicts) for the token variable names, the authorization-header shape and the verbose-trace flag — spelled only inside the test file, and the tool reads no environment variable at all
- `COVERAGE.md` declares no external API integration, naming the in-memory fake and the throwing `gh-client` stub as the only two implementations of the read interface, with live `gh api` calls placed in Phase 10; `check api-coverage.verify-pre` passes with `none_declared: true`

## Task Commits

Each task was committed atomically:

1. **Task 1: Double-locked apply gate plus ordered plan display** - `65be870` (feat)
2. **Task 2: SAFE-04 proof suite plus secret-hygiene static test** - `3c56d13` (test)
3. **Task 3: Coverage declaration plus final gate sweep** - `bcd8663` (docs)

**Plan metadata:** `docs(09-03): complete double-locked apply plan` — SUMMARY, STATE, ROADMAP and REQUIREMENTS, committed after this file was written. The `commits: 3` above is the measured `git rev-list --count cd527ed..HEAD` at write time, i.e. the three task commits; the span reads 4 once this metadata commit lands (its own hash cannot be quoted here, since it is the commit that carries this file).

## Files Created/Modified

- `tools/release-close/apply-gate.js` - Portão de dupla trava: `confirmApply`, `APPLY_LOCKS`, `CONFIRMATION_WORD`; escreve o plano antes de qualquer pergunta e devolve `{ confirmed, lock, reason }`
- `tools/release-close/release-close.js` - `plan` e `apply` ligados; `buildClosePlan` / `renderPlanText` exportados; oito passos ordenados com marcadores; prompt por `node:readline`; `--json` em plan e apply
- `tools/release-close/safe04.test.js` - 25 casos node:test em PT-BR: zero mutação, fechaduras do apply, ordem do plano, higiene de segredo, hipóteses E e F
- `.planning/phases/09-release-close-contract-fixtures/COVERAGE.md` - Declaração de ausência de integração de API externa, com a evidência apontada por nome de teste

## Decisions Made

- **The gate, not the CLI, writes the plan.** The CLI renders (builds) the plan text and hands it to `confirmApply`, which emits it through an injected `write` before evaluating any lock. This keeps the plan's `key_links` ("the apply path calls the gate only after rendering the plan") while turning "plan always visible before the prompt" into something a test can observe through an event log, in both the confirm and the refuse path
- **`apply` refuses on blocking classifications.** FAILED, CONCURRENT, CONFLICTING and DUPLICATE render the plan and then refuse before any prompt. Rationale: a plan whose steps could never be executed safely must not be confirmable, and a state that needs operator arbitration (two concurrent close markers) must not be reachable by typing `sim`
- **`plan` exits 0 only when apply could actually proceed** (eligible tag and non-blocking state), 1 otherwise, inside the 0/1/2 contract fixed in 09-01. A script branching on `plan` therefore cannot read "plan rendered" as "apply is safe"
- **`apply --json` prints the plan structure before the human text; the gate verdict stays PT-BR text on stderr.** An unattended consumer can inspect what would be attempted but cannot parse its way to a decision, which is the spirit of D-14
- **The emitted `mutations` is the fake's write counter, not a literal zero.** The per-fixture proof becomes a genuine implication (no writes → zero mutations) instead of a tautology
- **Per-fixture coverage normalizes state fixtures into the client read shape.** The tag and main reads are the same immutable v0.1.1 baseline in every state, so only the release and milestone reads vary; the CLI itself stays bound to the reference fixture

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Correctness] `apply` gained a fail-closed refusal on blocking classifications**
- **Found during:** Task 1
- **Issue:** The plan specified the double lock as the only gate on apply. Over the `failed`, `concurrent`, `duplicate` and `conflicting` states a full double confirmation would have reached the "confirmed" branch on a plan whose steps must never execute — FAILED means red checks, CONCURRENT means two operators are already closing, CONFLICTING/DUPLICATE mean the target is ambiguous
- **Fix:** `BLOCKING_CODES` short-circuits after the plan is displayed and before any prompt, naming the state and its reason; `plan` reports `applyLiberado: false` and exits 1 in the same states
- **Files modified:** tools/release-close/release-close.js
- **Verification:** piped `apply` on the reference fixture still reaches the lock refusals (MISSING is not blocking); `plan --json` on the reference reports `applyLiberado: true`, `bloqueio: null`
- **Committed in:** 65be870

**Total deviations:** 1 auto-fix (Rule 2)
**Impact on plan:** Small, additive, and in the fail-closed direction the plan itself demands. No task was dropped and no plan artifact was replaced.

### Scoped interpretations

- **Zero writes "over every fixture"** is proven in-process over a normalized client snapshot for all seven fixtures (the CLI is bound to the reference fixture by design), while `mutations: 0` in text and json is proven at the CLI level. Both halves of the requirement are executable; they are not asserted by the same run.
- **The `confirmApply` signature carries an optional `write` sink** beyond the four inputs the plan names, and a `plan` pre-condition lock ahead of the flag. The sink is what makes the visibility invariant observable; the pre-condition is the plan's own prohibition "apply must never execute without a human-visible ordered plan".
- **The adoption (`adotar`) branch has no test coverage in this phase.** The reference fixture is the only snapshot the CLI reads and it has neither a release nor a milestone, so every marker renders as `criar` or `ler`. Recorded below and for Phase 11 rather than papered over with a synthetic fixture, since the CLI deliberately does not accept a fixture override in Phase 9.

## Issues Encountered

- Two self-inflicted test-authoring slips caught before commit: `typeof json.elegibilidade ?? json.code` parses as `typeof` (never nullish, so the assertion was vacuous), and a comparison that folded `mutations` into the plan's embedded eligibility object when the counter actually lives at the plan's top level. Both corrected in the same file; the suite then ran 57/57.
- The full pty confirmation path cannot be covered by `node --test` because `process.stdin.isTTY` cannot be faked from a test process. It was verified manually instead with `script -qec` over a local pty (four combinations, all correct) and that manual run is recorded in the coverage block as a `manual pty` reference rather than claimed as automated coverage.

## User Setup Required

None - no external service configuration required. Zero dependencies, no install step, no network, no database, no credential.

## Next Phase Readiness

- **Phase 10** can wire the real client behind the unchanged five-read interface: `apply-gate.js` is the reusable live-apply gate, `gh-client.js` is the single stub to replace, and `COVERAGE.md` records the absence of any live call as an explicit decision rather than an oversight
- **Phase 11** owns the adoption branch of the plan renderer and the reconciliation order the eight steps preview; `applyLiberado` / `bloqueio` are the fields its state fixtures will drive
- **Phase 12** inherits the evidence shape: text-default plus `--json`, `mutations` in both, and the zero-credential-output proof that keeps runbook captures safe to paste
- Watch items: the `adotar` marker path is unexercised until Phase 11; `apply` still has no write path by design, so the Phase 13 live procedure must still be gated on operator confirmation (D-14) and never on a script's `--yes`
- Collateral: backend `npx vitest run` 131/131 and frontend `npm run build` both green; `ci.yml`, `backend/` and `frontend/` untouched; change surface confined to `tools/release-close/` plus the phase directory

## Self-Check: PASSED

- All 4 files FOUND on disk (3 tool sources + `COVERAGE.md`)
- All 3 task commits FOUND (65be870, 3c56d13, bcd8663); `git rev-list --count cd527ed..HEAD` = 3
- `node --test tools/release-close/`: 57 tests, 57 pass, 0 fail, exit 0
- `node tools/release-close/release-close.js apply --yes < /dev/null`: exit 1 with a terminal-interativo refusal, eight plan steps on stdout
- `check api-coverage.verify-pre`: `block: false`, `none_declared: true`
- `cd backend && npx vitest run`: 6 files, 131 tests passed; `cd frontend && npm run build`: built
- `git status --short` outside the plan scope still shows only the pre-existing runtime-owned `.planning/config.json`, `.planning/milestone.lock` and `.planning/state.json`, left unstaged and unmodified
- No live GitHub mutation, no network call and no ref write was issued at any point

---
*Phase: 09-release-close-contract-fixtures*
*Completed: 2026-09-25*
