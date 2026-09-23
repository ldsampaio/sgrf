# Phase 2: Rules Decisions (docs/14 close-out) - Context

**Gathered:** 2026-09-23
**Status:** Ready for planning

<domain>
## Phase Boundary

Phase 2 writes docs only — no src/ changes. One commit updates `docs/03-regras-de-negocio.md` + `docs/14-decisoes-em-aberto.md`, closing the partial-approval aggregation rule, the cancellation-after-approval rule, **and** (user decision) the quorum + vista items instead of deferring them to v2. Each closed item gets date + rationale; `docs/03` states the rule the code must follow. Implementation lands in Phase 6 (VOT-03/VOT-04); nothing gets re-guessed in code.

</domain>

<decisions>
## Implementation Decisions

### Partial-approval aggregation (VOT-03 input)
- **D-01:** A `PARCIAL` tally outcome does NOT conclude with an amount — the request moves to a new status `AGUARDANDO_ARBITRAGEM` and the `CHEFE_DEPARTAMENTO` arbitrates the final amount.
- **D-02:** The arbitrated amount is any value in `(0, requestedAmountCents]` — not clamped to the min–max of voted partials, not restricted to a voted value.
- **D-03:** Arbitration requires mandatory justification + audit (`decidedBy` = chefe, justification recorded and audited like partial votes require `comment` today).
- **D-04:** Status constant name is `AGUARDANDO_ARBITRAGEM` (follows the existing `SCREAMING_SNAKE` Portuguese pattern, e.g. `AGUARDANDO_DESEMPATE`). Replaces "first partial vote wins" (`votingService.js:84`).

### Cancellation-after-approval (VOT-04 input)
- **D-05:** Role split by status — dono (requester) may cancel only in `RASCUNHO` and `EM_VOTACAO`; `ADMINISTRADOR` may cancel in any non-terminal status; `CHEFE_DEPARTAMENTO` may cancel in any status before `CONCLUIDO`.
- **D-06:** Justification is mandatory for EVERY cancellation (missing = 400); the text goes to the `REVERSE` transaction metadata + `AuditEvent` (`request_cancelled` / `provision_reversed`).
- **D-07:** Reversal rule — cancelling an approved/provisioned request writes an audited compensating `REVERSE` `FinancialTransaction` (reuse the `reverseProvision` pattern); `CONCLUIDO` (spent) can NEVER be cancelled.
- **D-08:** Cancellable statuses: all non-terminal except `CANCELADO` itself; `INDEFERIDO` is cancellable by admin (cleanup). Terminal `CONCLUIDO`/`CANCELADO` are immutable.

### Quorum + vista (decided now, NOT deferred)
- **D-09:** No minimum quorum — the tally of cast valid votes decides (`tally()` as-is). This OVERRIDES the `docs/14` recommendation ("maioria dos conselheiros elegíveis" + "sem quórum → ação manual"); record the deviation + rationale in `docs/14`. No "sem quórum" status is introduced.
- **D-10:** Vista stays 1 per conselheiro — keep the current `@@unique([requestId, requestedBy])` behavior with stacking deadline extensions (doc's "máximo de um por solicitação" is REJECTED; record why).
- **D-11:** Interruption → extraordinary meeting — conselheiros may request interrupting the vote; the chefe pauta the request in a reunião extraordinária (`SUSPENSO` — existing `SUSPENSO_REUNIAO_ORDINARIA` flow); only `ADMINISTRADOR`/`CHEFE_DEPARTAMENTO` may enter the manual deliberation result afterwards (existing `collegiateDecision` path).

### Docs record format
- **D-12:** One docs commit updates `docs/03` + `docs/14`; every closed item carries date + rationale. `docs/03` states each rule prescriptively (the code contract); `docs/14` marks the item closed with the decision + deviations from prior recommendations noted explicitly (D-09, D-10).
- **D-13:** Roadmap/REQUIREMENTS follow-up (no doc edit in this phase beyond docs/03+docs/14): plan 02-03 covers 4 rules (not 2); `REQUIREMENTS.md` v2 trigger line "Remaining docs/14 decisions: quorum …" is now satisfied for quorum/vista — planner/executor must update that line when touching REQUIREMENTS, not silently drop it.

### the agent's Discretion
- Exact Portuguese wording of the `docs/03`/`docs/14` edits (keep the repo's existing terse table + RN-xxx voice); where in `docs/03` the new RNs live (new RN numbers vs extending existing sections); the arbitration entry-point shape (vote-type vs dedicated endpoint — Phase 6 planner's call, this phase only locks the rule, not the API).

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase scope + requirements
- `.planning/ROADMAP.md` Phase 2 section — goal, 4 success criteria, 3 plan descriptions (02-01 partial, 02-02 cancellation, 02-03 docs commit + defer)
- `.planning/REQUIREMENTS.md` VOT-03, VOT-04 — what Phase 6 will implement from these decisions; v2 "Remaining docs/14 decisions" trigger line (partially satisfied by D-09/D-10/D-11)
- `.planning/STATE.md` Decisions log — ordering locked (P2 decisions → P6 implementation)

### Decided docs (edit targets)
- `docs/14-decisoes-em-aberto.md` — the open-decisions table; partial-approval row (implicit — "first partial wins" was code-only), cancellation row ("permitido apenas por admin ou chefe, com justificativa"), quorum/vista rows (recommendations OVERRIDDEN by D-09/D-10, rationale required)
- `docs/03-regras-de-negocio.md` — business rules file that must state the decided rules prescriptively (RN-001…RN-008 today; new RNs for partial arbitration, cancellation, quorum-absence, vista, extraordinary meeting)
- `docs/06-permissoes.md` — permission matrix; cancellation roles (D-05) and manual deliberation entry (D-11) must be consistent with it
- `docs/07-fluxos.md` — flows; extraordinary-meeting interruption (D-11) and `AGUARDANDO_ARBITRAGEM` (D-01) touch the voting flow

### Code evidence (for Phase 6 implementers — read-only in this phase)
- `backend/src/services/votingService.js` `closeVoting` lines 81-85 — "first partial vote wins" (`validVotes.find(...)`), the behavior D-01/D-04 replaces; `tally()` lines 29-49 — quorum-less majority, kept per D-09
- `backend/src/controllers/requestController.js` `cancel` lines 112-120 — zero-check cancel, the hole D-05/D-06/D-08 closes
- `backend/src/controllers/financeController.js` `reverseProvision` — admin/chefe-only REVERSE pattern D-07 reuses
- `backend/src/controllers/votingController.js` (`suspend`/`collegiateDecision`) — manual deliberation path D-11 reuses

### Codebase maps
- `.planning/codebase/CONCERNS.md` — "PARCIAL takes first partial vote's amount" (§126), "Anyone can cancel any request" (§69), vista doc-vs-`@@unique` conflict (§284)
- `.planning/codebase/ARCHITECTURE.md` — status-machine vocabulary (`RASCUNHO → … → CONCLUIDO / CANCELADO`)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `reverseProvision` (`backend/src/controllers/financeController.js`) — admin/chefe guard + `REVERSE` `FinancialTransaction` + zeroed amount; the template for cancellation-with-reversal (D-07)
- `audit()` helper — already called on `cancel` (`request_cancelled`); extend with justification payload (D-03, D-06)
- `tally()` (`backend/src/services/votingService.js:29-49`) — kept unchanged (D-09); `PARCIAL` outcome branch is the hook point for `AGUARDANDO_ARBITRAGEM` (D-01)
- `suspend` / `collegiateDecision` (`backend/src/controllers/votingController.js`) — existing extraordinary-meeting machinery D-11 formalizes

### Established Patterns
- `SCREAMING_SNAKE` Portuguese status constants — new `AGUARDANDO_ARBITRAGEM` follows `AGUARDANDO_DESEMPATE` precedent (D-04)
- Money in integer cents; provision/decrement via `tx.fundBalance` + append-only `FinancialTransaction` — arbitration amount (D-02) flows through the same path in Phase 6
- Partial votes already require `comment` + positive `approvedAmountCents` (`validateVoteInput`) — justification-mandatory arbitration (D-03) extends the same norm to the chefe

### Integration Points
- Phase 6 plans 06-03 (partial rule in `closeVoting`) and 06-04 (cancellation + reversal) consume D-01…D-08 directly; 06-01 (tie-break) is unaffected by `AGUARDANDO_ARBITRAGEM` (distinct status, distinct trigger)
- `JOB-02` auto-close (Phase 7) must handle `AGUARDANDO_ARBITRAGEM` deliberately: the status waits for the chefe — planner must decide whether the job skips, nudges, or escalates it (NOT decided here; flagged, not dropped)

</code>

<specifics>
## Specific Ideas

- User verbatim (cancellation split): "o dono pode cancelar somente durante rascunho e em_votacao, o admin a qualquer momento, o chefe antes de concluido"
- User verbatim (vista + extraordinary meeting): "1 vista por conselheiro (acumula as prorrogações) e a possibilidade dos conselheiros solicitarem a interrupção da votação e que o chefe paute o pedido em reunião extraordinária do conselho. Neste caso entra em suspenção e somente o admin ou chefe conseguem fazer o lançamento manual do resultado da deliberação do conselho após a reunião."
- Partial example discussed: partial votes `[8000, 5000, 6000]` no longer resolve to any of these automatically — chefe arbitrates any value ≤ requested with justification.

</specifics>

<deferred>
## Deferred Ideas

- `AGUARDANDO_ARBITRAGEM` vs `JOB-02` auto-close interaction (skip/nudge/escalate) — flagged for Phase 6/7 planning, not decided here.
- Untouched `docs/14` rows (limite, saldo insuficiente, taxa de dólar, aluno/auxílio, exclusão de usuário, senha temporária, anexos, e-mails falhos) — out of Phase 2 scope; e-mails falhos already have a standing decision consumed by Phase 7 (JOB-01). No new deferrals invented in discussion.

</deferred>

---

*Phase: 2-Rules Decisions (docs/14 close-out)*
*Context gathered: 2026-09-23*
