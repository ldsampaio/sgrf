---
phase: 02-rules-decisions-docs-14-close-out
plan: "03"
subsystem: docs
tags: [docs, business-rules, quorum, vista, extraordinary-meeting, RN-011, RN-012, RN-013]

# Dependency graph
requires:
  - phase: 02-rules-decisions-docs-14-close-out Wave 1 (02-01, 02-02)
    provides: RN-009 arbitration plus RN-010 cancellation blocks that RN-011..RN-013 append after
provides:
  - "RN-011 quorum-absence, RN-012 vista, RN-013 extraordinary-meeting rules in docs/03"
  - "Closed docs/14 quorum rows (OVERRIDDEN) plus vista row (REJECTED) with date plus rationale"
  - "Whole-commit D-01..D-12 traceability mapping plus recorded D-13 REQUIREMENTS follow-up"
  - "PR #7 landed with backend plus frontend CI green (Phase 1 PR-flow learning applied)"
affects: [phase-6-voting-implementation, phase-7-batch-jobs]

# Actuals (#2632) — pairs with the plan's `estimate` to calibrate future estimates.
actuals:
  tokens: 1200
  tasks: 2
  commits: 2

# Tech tracking
tech-stack:
  added: []
  patterns: [prescriptive-RN-voice, decision-stamp, deviation-marker-close-in-place, pr-flow-landing]

key-files:
  created: []
  modified: [docs/03-regras-de-negocio.md, docs/14-decisoes-em-aberto.md]

key-decisions:
  - "Task 2 verification-only, no edit: all Task 1 content already satisfied every acceptance criterion on first read-through (same pattern as 02-02 Task 2)"
  - "STALE ROADMAP criterion 4 recorded inside the docs/14 quorum closing itself, not as a separate edit — keeps the diff at exactly two files per D-12"

patterns-established:
  - "Deviation marker close-in-place: keep the stale recommendation text, append OVERRIDDEN/REJECTED plus date plus rationale — Phase 6 can see what was overruled"
  - "PR-flow landing for docs commits on protected main (Phase 1 learning): branch, push, PR, CI green, merge"

requirements-completed: [VOT-03, VOT-04]

coverage:
  - id: D1
    description: "RN-011/RN-012/RN-013 quorum plus vista rules in docs/03 with closed docs/14 rows carrying OVERRIDDEN/REJECTED markers"
    requirement: "VOT-03"
    verification:
      - kind: other
        ref: "grep -n 'OVERRIDDEN|REJECTED|SUSPENSO_REUNIAO_ORDINARIA' docs/03-regras-de-negocio.md docs/14-decisoes-em-aberto.md"
        status: pass
    human_judgment: true
    rationale: "Docs-as-contract prose requires a reviewer read-through: each D-09..D-11 must trace to a sentence and status strings must match code verbatim — grep proves presence, not correctness of transcription"
  - id: D2
    description: "Whole-commit verification: D-01..D-12 traceability, two-file scope, PR #7 with backend plus frontend CI green"
    requirement: "VOT-04"
    verification:
      - kind: other
        ref: "gh pr checks 7 (backend pass, frontend pass); gh api branch protection contexts backend,frontend"
        status: pass
    human_judgment: true
    rationale: "Traceability mapping is a reviewer judgment over prose; CI green is machine-verified but scope-cleanliness needs the read-through recorded below"

# Metrics
duration: 8min
completed: 2026-09-23
status: complete
---

# Phase 02 Plan 03: Quorum Plus Vista Slice Summary

**RN-011 (no quorum, tally decides), RN-012 (1 vista per conselheiro, stacking extensions), RN-013 (extraordinary meeting via SUSPENSO_REUNIAO_ORDINARIA, admin/chefe-only entry) plus OVERRIDDEN/REJECTED docs/14 closings — landed via PR #7 with backend plus frontend CI green**

## Performance

- **Duration:** ~8 min
- **Started:** 2026-09-23T21:05Z (approx)
- **Completed:** 2026-09-23T21:13Z (approx)
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments

- RN-011/RN-012/RN-013 appended to docs/03 AFTER RN-010 (append-only, RN-009/RN-010 untouched) in terse prescriptive voice with decision stamps (Decidido em 2026-09-23, D-09/D-10/D-11)
- docs/14 quorum plus ausencia-de-quorum rows closed in place with OVERRIDDEN marker, date 2026-09-23, rationale; vista row closed in place with REJECTED marker, date, rationale
- STALE ROADMAP Phase 2 success criterion 4 recorded inside the quorum closing — no defer-quorum/defer-vista text anywhere in docs/
- Whole-commit D-01..D-12 traceability verified (mapping below); untouched docs/14 rows byte-identical; diff exactly the two doc files; PR #7 merged with backend plus frontend checks green
- D-13 REQUIREMENTS follow-up recorded verbatim below (REQUIREMENTS.md NOT edited per D-12 scope discipline)

## Task Commits

Each task was committed atomically:

1. **Task 1: End-to-end quorum plus vista slice — RN-011/RN-012/RN-013 plus closed rows with deviation markers** - `2d2d614` (docs)
2. **Task 2: Whole-commit verification — D-01..D-12 traceability, two-file scope, CI green via PR** - verified, no edit required (all criteria passed on first read-through); landed via merge `92e8f95` (PR #7)

**Plan metadata:** committed below (docs: complete plan)

## Files Created/Modified

- `docs/03-regras-de-negocio.md` - Appended RN-011 (Ausência de quórum), RN-012 (Pedido de vista), RN-013 (Interrupção da votação e reunião extraordinária) after RN-010; reuses `SUSPENSO_REUNIAO_ORDINARIA` verbatim, no new SUSPENSO_ string
- `docs/14-decisoes-em-aberto.md` - Quorum plus ausencia-de-quorum rows closed in place (OVERRIDDEN, D-09); vista row closed in place (REJECTED, D-10); STALE criterion-4 note in the quorum closing

## Decisions Made

- Task 2 needed no edit: the Task 1 block already carried every required string on first verification (OVERRIDDEN ×2, REJECTED ×1, SUSPENSO_REUNIAO_ORDINARIA ×1, dates, rationales) — recorded as verified, not re-committed, same as 02-02 Task 2
- STALE ROADMAP note lives inside the quorum row closing rather than as a separate docs edit, preserving the exactly-two-file diff D-12 mandates

## D-01..D-12 Sentence Mapping (reviewer checklist)

| Decision | Doc sentence |
|----------|--------------|
| D-01 | RN-009: "Quando a apuração resultar `PARCIAL`, a solicitação NÃO conclui com valor — move para `AGUARDANDO_ARBITRAGEM`" (02-01) |
| D-02 | RN-009: "o `CHEFE_DEPARTAMENTO` arbitra o valor final em `(0, requestedAmountCents]`, em centavos inteiros" (02-01) |
| D-03 | RN-009: "com justificativa obrigatória registrada e auditada (`decidedBy` = chefe, como votos parciais exigem `comment`)" (02-01) |
| D-04 | RN-009: fenced `AGUARDANDO_ARBITRAGEM` constant plus "Esta regra substitui o comportamento anterior de primeiro-voto-parcial-vence em `backend/src/services/votingService.js:84`" (02-01) |
| D-05 | RN-010: status×role matrix ("dono: somente RASCUNHO e EM_VOTACAO; ADMINISTRADOR: qualquer não-terminal; CHEFE_DEPARTAMENTO: antes de CONCLUIDO") (02-02) |
| D-06 | RN-010: "O cancelamento exige justificativa em TODA solicitação; ausente, o backend responde 400" plus REVERSE metadata plus `request_cancelled`/`provision_reversed` (02-02) |
| D-07 | RN-010: "Cancelar solicitação aprovada ou provisionada grava `FinancialTransaction` compensatória auditada de tipo `REVERSE` (padrão `reverseProvision`)" (02-02) |
| D-08 | RN-010: "`INDEFERIDO` é cancelável pelo admin como limpeza; terminais `CONCLUIDO` e `CANCELADO` são imutáveis" (02-02) |
| D-09 | RN-011: "Não há quórum mínimo: decide a apuração dos votos válidos lançados (`tally()` inalterado…)" plus "Nenhum status "sem quórum" é introduzido" plus both docs/14 quorum rows with OVERRIDDEN 2026-09-23 marker |
| D-10 | RN-012: "Cada conselheiro tem direito a 1 vista por solicitação; as prorrogações de prazo acumulam-se" plus "`@@unique([requestId, requestedBy])`" plus docs/14 vista row with REJECTED 2026-09-23 marker |
| D-11 | RN-013: "o chefe pauta o pedido em reunião extraordinária… `SUSPENSO_REUNIAO_ORDINARIA`" plus "somente `ADMINISTRADOR` ou `CHEFE_DEPARTAMENTO` lançam manualmente o resultado… (via `collegiateDecision`)" |
| D-12 | Decision stamps `(Decidido em 2026-09-23, D-…)` on RN-009/RN-010/RN-011/RN-012/RN-013; date plus rationale on all four closed docs/14 rows; commit touches only docs/03 plus docs/14 |

## D-13 Pending Follow-up (RECORDED, not edited — D-12 limits this phase to docs/03 plus docs/14)

The `.planning/REQUIREMENTS.md` v2 trigger line (line 59) reads verbatim:

> Remaining `docs/14` decisions: quorum, "sem quóró" manual path, vista-limit doc-vs-`@@unique` conflict — trigger: before declaring the council workflow production-complete

That line is now satisfied for quorum/vista (decided 2026-09-23, D-09/D-10/D-11, this plan). Whoever next touches REQUIREMENTS.md must update the line to reflect that quorum/vista are decided — it must never be silently dropped.

## Explicit Assumption (NOT a decision — flagged for Phase 6/7)

The `AGUARDANDO_ARBITRAGEM` versus JOB-02 auto-close interaction stays UNDECIDED (skip / nudge / escalate). RN-009 and RN-011..RN-013 specify no auto-close behavior for the arbitration wait state; Phase 6/7 planning must decide deliberately. (Inherited from 02-CONTEXT.md deferred ideas, restated here per plan instruction.)

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None. PR flow worked first try: branch `gsd/phase-02-plan-03` → PR #7 → backend plus frontend checks green → merged as `92e8f95`. (Note: the D-11 chefe-only `collegiateDecision` code gap flagged in 02-02 stands — RN-013 locks admin plus chefe entry, Phase 6 reconciles the code. Not re-flagged as a new issue.)

## Threat Notes (T-02-05, T-02-06 mitigated)

- T-02-05: quorum/vista rows carry explicit OVERRIDDEN (D-09) / REJECTED (D-10) markers with rationale plus date — Phase 6 cannot follow the stale maioria-dos-conselheiros or maximo-de-um-por-solicitacao text.
- T-02-06: RN-013 locks ADMINISTRADOR plus CHEFE_DEPARTAMENTO entry via the existing collegiateDecision path with no widened roles and no new status string (only `SUSPENSO_REUNIAO_ORDINARIA` appears; verified no other SUSPENSO_ string in docs/).

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- All four Phase 2 rules (partial, cancellation, quorum, vista/interruption) are closed with date plus rationale; docs/03 states each rule prescriptively through RN-009..RN-013.
- Phase 6 consumes RN-011/RN-012/RN-013 directly (no quorum check; vista @@unique kept; suspension plus collegiateDecision path).
- Outstanding: D-13 REQUIREMENTS line update (recorded above) and the ROADMAP criterion-4 text edit (out-of-phase follow-up, orchestrator-owned).
- No backend/ or frontend/ file touched — phase boundary intact.

---
*Phase: 02-rules-decisions-docs-14-close-out*
*Completed: 2026-09-23*

## Self-Check: PASSED

- `grep -n 'OVERRIDDEN|REJECTED|SUSPENSO_REUNIAO_ORDINARIA'` hits docs/03 (RN-013) plus docs/14 (3 rows) — verified
- No new SUSPENSO_ string besides SUSPENSO_REUNIAO_ORDINARIA; no defer-quorum/defer-vista text in docs/ — verified
- `git diff --name-only main...2d2d614` shows exactly the two doc files; untouched docs/14 rows byte-identical (only 3 rows in the diff) — verified
- ci.yml pins present (checkout@v7, setup-node@v7, node 22); protection contexts `backend,frontend`; PR #7 checks backend plus frontend green — verified
- Commits `2d2d614` (task) and `92e8f95` (merge) exist on main — verified
