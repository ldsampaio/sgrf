# Phase 2: Rules Decisions (docs/14 close-out) - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-09-23
**Phase:** 2-Rules Decisions (docs/14 close-out)
**Areas discussed:** Partial-approval rule, Cancellation rule, Deferral + docs record (quorum/vista decided now)

---

## Partial-approval rule

| Option | Description | Selected |
|--------|-------------|----------|
| Median of partial amounts | Robust, deterministic, works with auto-close job. Ex: [8000, 5000, 6000] → 6000. | |
| Majority amount (moda) | Most-voted amount wins; needs tie-break sub-rule when amounts differ. | |
| Chefe decides amount | Chefe picks final amount after PARCIAL outcome; adds manual step to auto-close. | ✓ |

**User's choice:** Chefe decides amount
**Notes:** Mechanism: new pending status (not chefe-vote-wins, not manual-only). Limit: any value up to requested. Record: justification + audit mandatory (decidedBy = chefe).

| Option (mechanism) | Description | Selected |
|--------|-------------|----------|
| Chefe vote wins + median fallback | Chefe's partial vote binds; median fallback if chefe didn't vote partial. | |
| New pending status | PARCIAL → pending status, concludes only on chefe arbitration. | ✓ |
| Manual only, no auto fallback | Job never concludes partial alone. | |

| Option (limit) | Description | Selected |
|--------|-------------|----------|
| Any value up to requested | Chefe arbitrates any value ≤ requested; simple, unbound from votes. | ✓ |
| Clamped to voted range | Final value within min–max of partials. | |
| Must pick a voted value | Chefe picks one of the voted values. | |

| Option (record) | Description | Selected |
|--------|-------------|----------|
| Justification + audit | Value + motive recorded, audited; official decision (decidedBy = chefe). | ✓ |
| Value only | Just the value, no mandatory motive. | |

---

## Cancellation rule

| Option | Description | Selected |
|--------|-------------|----------|
| Split by approval | Before approval: owner or admin/chefe. After: admin/chefe only + justification + audited reversal. | ✓ |
| Admin/chefe always | Any cancellation, any status, only admin/chefe + justification. | |

**User's choice:** Split by approval, refined freeform: "o dono pode cancelar somente durante rascunho e em_votacao, o admin a qualquer momento, o chefe antes de concluido"
**Notes:** Reversal: reverse-unless-spent (CONCLUIDO never cancels). Justification mandatory + audited in every cancellation. Cancellable: all non-terminal statuses per the role split.

| Option (CONCLUIDO) | Description | Selected |
|--------|-------------|----------|
| Reverse unless spent | Cancel APROVADO/APROVADO_PARCIALMENTE with REVERSE; CONCLUIDO never cancels. | ✓ |
| Even when spent | CONCLUIDO also cancellable, with full reversal after spend. | |

| Option (justification) | Description | Selected |
|--------|-------------|----------|
| Mandatory + audited | No justification = 400; text in REVERSE metadata + AuditEvent. | ✓ |
| Only post-approval | Ordinary cancellation exempt. | |

---

## Deferral + docs record (quorum/vista decided now)

| Option | Description | Selected |
|--------|-------------|----------|
| Defer with triggers | Quorum, "sem quórum", vista-limit and rest go to v2 with explicit trigger. | |
| Decide now | Decide quorum/vista now, with the 2 rules. | ✓ |

**User's choice:** Decide now — expands plan 02-03 to 4 rules; REQUIREMENTS v2 trigger line to update at plan time.
**Notes:** Quorum: no minimum ("No quorum, tally decides") — overrides docs/14 recommendation; no "sem quórum" status. Vista: 1 per conselheiro (keep @@unique stacking) + new rule: conselheiros may request interruption → chefe pauta em reunião extraordinária → SUSPENSO → only admin/chefe enter the manual deliberation result. Partial pending status named AGUARDANDO_ARBITRAGEM (vs reusing AGUARDANDO_DESEMPATE).

| Option (quorum) | Description | Selected |
|--------|-------------|----------|
| Majority + manual | Closes without eligible majority; "sem quórum" status + manual action (docs/14 recommendation). | |
| No quorum, tally decides | Closes with whoever voted; no minimum. | ✓ |

| Option (vista) | Description | Selected |
|--------|-------------|----------|
| One per request | Max 1 vista per request, any conselheiro; 2nd denied (docs/14 recommendation). | |
| Keep code behavior | 1 per conselheiro, N vistas stacking extensions. | ✓ (plus extraordinary-meeting rule, freeform) |

| Option (pending status name) | Description | Selected |
|--------|-------------|----------|
| AGUARDANDO_ARBITRAGEM | Follows SCREAMING_SNAKE PT pattern. | ✓ |
| Reuse desempate | Reuse AGUARDANDO_DESEMPATE for partial too. | |

---

## the agent's Discretion

Exact Portuguese wording of docs/03 + docs/14 edits; RN placement; arbitration entry-point shape (Phase 6 planner's call).

## Deferred Ideas

- AGUARDANDO_ARBITRAGEM × JOB-02 auto-close interaction — flagged for Phase 6/7 planning.
- Untouched docs/14 rows (limite, saldo, dólar, aluno/auxílio, exclusão, senha, anexos, e-mails falhos) — out of scope; e-mails falhos consumed by Phase 7.
