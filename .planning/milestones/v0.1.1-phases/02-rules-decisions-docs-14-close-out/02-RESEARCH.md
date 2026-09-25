# Phase 2: Rules Decisions (docs/14 close-out) - Research

**Researched:** 2026-09-23
**Domain:** Business-rule documentation (docs-first decision gate, no code)
**Confidence:** HIGH

## Summary

Phase 2 is a docs-only decision gate: four business rules (partial-approval arbitration, cancellation-after-approval, quorum-absence, vista/interruption) are locked by user decisions D-01…D-13 in `02-CONTEXT.md` and must be recorded prescriptively in `docs/03-regras-de-negocio.md` plus closed with date + rationale in `docs/14-decisoes-em-aberto.md`, in a single docs commit. No `src/` changes occur; implementation lands in Phase 6 (plans 06-03/06-04 consume D-01…D-08).

The key structural finding: this phase's scope was expanded by user decision beyond the ROADMAP text. ROADMAP success criterion #4 says quorum/vista are "explicitly deferred to v2" — that criterion is STALE. D-09/D-10/D-11 decide quorum + vista NOW, plan 02-03 covers 4 rules not 2, and the REQUIREMENTS.md v2 trigger line ("Remaining docs/14 decisions: quorum…") is partially satisfied and must be updated when REQUIREMENTS is touched (D-13). The planner must record this deviation, not silently drop the line.

**Primary recommendation:** Write the two doc edits exactly as locked (new RNs for arbitration/cancellation/quorum/vista + closed docs/14 rows with deviations noted), keep the repo's terse RN-xxx table voice, verify consistency against docs/06 + docs/07, and land it as one docs commit before any Phase 6 work.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-01:** A `PARCIAL` tally outcome does NOT conclude with an amount — the request moves to a new status `AGUARDANDO_ARBITRAGEM` and the `CHEFE_DEPARTAMENTO` arbitrates the final amount.
- **D-02:** The arbitrated amount is any value in `(0, requestedAmountCents]` — not clamped to the min–max of voted partials, not restricted to a voted value.
- **D-03:** Arbitration requires mandatory justification + audit (`decidedBy` = chefe, justification recorded and audited like partial votes require `comment` today).
- **D-04:** Status constant name is `AGUARDANDO_ARBITRAGEM` (follows the existing `SCREAMING_SNAKE` Portuguese pattern, e.g. `AGUARDANDO_DESEMPATE`). Replaces "first partial vote wins" (`votingService.js:84`).
- **D-05:** Role split by status — dono (requester) may cancel only in `RASCUNHO` and `EM_VOTACAO`; `ADMINISTRADOR` may cancel in any non-terminal status; `CHEFE_DEPARTAMENTO` may cancel in any status before `CONCLUIDO`.
- **D-06:** Justification is mandatory for EVERY cancellation (missing = 400); the text goes to the `REVERSE` transaction metadata + `AuditEvent` (`request_cancelled` / `provision_reversed`).
- **D-07:** Reversal rule — cancelling an approved/provisioned request writes an audited compensating `REVERSE` `FinancialTransaction` (reuse the `reverseProvision` pattern); `CONCLUIDO` (spent) can NEVER be cancelled.
- **D-08:** Cancellable statuses: all non-terminal except `CANCELADO` itself; `INDEFERIDO` is cancellable by admin (cleanup). Terminal `CONCLUIDO`/`CANCELADO` are immutable.
- **D-09:** No minimum quorum — the tally of cast valid votes decides (`tally()` as-is). This OVERRIDES the `docs/14` recommendation ("maioria dos conselheiros elegíveis" + "sem quórum → ação manual"); record the deviation + rationale in `docs/14`. No "sem quórum" status is introduced.
- **D-10:** Vista stays 1 per conselheiro — keep the current `@@unique([requestId, requestedBy])` behavior with stacking deadline extensions (doc's "máximo de um por solicitação" is REJECTED; record why).
- **D-11:** Interruption → extraordinary meeting — conselheiros may request interrupting the vote; the chefe pauta the request in a reunião extraordinária (`SUSPENSO` — existing `SUSPENSO_REUNIAO_ORDINARIA` flow); only `ADMINISTRADOR`/`CHEFE_DEPARTAMENTO` may enter the manual deliberation result afterwards (existing `collegiateDecision` path).
- **D-12:** One docs commit updates `docs/03` + `docs/14`; every closed item carries date + rationale. `docs/03` states each rule prescriptively (the code contract); `docs/14` marks the item closed with the decision + deviations from prior recommendations noted explicitly (D-09, D-10).
- **D-13:** Roadmap/REQUIREMENTS follow-up (no doc edit in this phase beyond docs/03+docs/14): plan 02-03 covers 4 rules (not 2); `REQUIREMENTS.md` v2 trigger line "Remaining docs/14 decisions: quorum …" is now satisfied for quorum/vista — planner/executor must update that line when touching REQUIREMENTS, not silently drop it.

### the agent's Discretion
- Exact Portuguese wording of the `docs/03`/`docs/14` edits (keep the repo's existing terse table + RN-xxx voice); where in `docs/03` the new RNs live (new RN numbers vs extending existing sections); the arbitration entry-point shape (vote-type vs dedicated endpoint — Phase 6 planner's call, this phase only locks the rule, not the API).

### Deferred Ideas (OUT OF SCOPE)
- `AGUARDANDO_ARBITRAGEM` vs `JOB-02` auto-close interaction (skip/nudge/escalate) — flagged for Phase 6/7 planning, not decided here.
- Untouched `docs/14` rows (limite, saldo insuficiente, taxa de dólar, aluno/auxílio, exclusão de usuário, senha temporária, anexos, e-mails falhos) — out of Phase 2 scope; e-mails falhos already have a standing decision consumed by Phase 7 (JOB-01). No new deferrals invented in discussion.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| (none — decision gate) | Phase 2 carries no requirement ID directly; it is the decision gate for VOT-03/VOT-04 | D-01…D-04 lock the VOT-03 aggregation rule Phase 6 plan 06-03 implements; D-05…D-08 lock the VOT-04 cancellation rule Phase 6 plan 06-04 implements; D-09…D-11 close the quorum/vista rows the REQUIREMENTS v2 trigger line references |
</phase_requirements>

## Project Constraints (from AGENTS.md)

- Docs-first: domain rules live in `docs/` (`03-regras-de-negocio.md`, `06-permissoes.md`, `07-fluxos.md`, `08-api.md`) + `backend/openapi.yaml` — consult before changing request logic. This phase IS the docs change.
- No invented lint/typecheck commands; sem lint/typecheck configurados. Phase verification is CI (`backend` vitest + `frontend` build), which this docs-only phase must not break (markdown-only diff cannot break it, but the commit still runs CI on push).
- Money in integer cents; IDs are UUID strings; no raw SQL — relevant as vocabulary the new RNs must use (D-02 amount range is in cents).
- Never commit: `backend/.env`, `*.db*`, `backend/uploads/*` — docs commit touches only `docs/03-regras-de-negocio.md` + `docs/14-decisoes-em-aberto.md`.
- CI gate: pushes to `main` require `backend`+`frontend` checks; per STATE.md Phase 1 learning, land via PR flow (direct pushes to protected main are declined before CI runs).

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Business-rule documentation (docs/03 + docs/14 edits) | Database / Storage (docs as code contract) | — | Markdown files are the code contract Phase 6 implements; no runtime tier involved |
| Rule consistency check (docs/06, docs/07) | API / Backend (doc coherence) | — | Permission matrix + flows must agree with the new RNs so Phase 4/6 transcription is unambiguous |

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| (none — docs-only phase) | — | No dependencies installed or changed | Markdown edits only; no registry verification needed |

**Installation:** none — `npm install` MUST NOT appear in any Phase 2 plan.

## Architecture Patterns

### System Architecture Diagram

```
02-CONTEXT.md (D-01…D-13, locked)
     ↓ transcribe (prescriptive voice)
docs/03-regras-de-negocio.md  ←→  docs/14-decisoes-em-aberto.md (closed + date + rationale + deviations)
     ↓ consistency check (read-only)
docs/06-permissoes.md + docs/07-fluxos.md (must agree; edited only if they contradict — default: no edit)
     ↓ one docs commit (PR flow per Phase 1 learning)
main (CI backend+frontend runs green on markdown-only diff)
     ↓ consumed downstream (read-only in this phase)
Phase 6 (06-03 partial, 06-04 cancellation) + REQUIREMENTS v2-line update (D-13)
```

### Recommended Project Structure

No new files. Edit targets only:
```
docs/
├── 03-regras-de-negocio.md   # ADD new RNs (arbitration, cancellation, quorum-absence, vista, extraordinary meeting)
└── 14-decisoes-em-aberto.md  # CLOSE 4 rows (partial, cancellation, quorum, vista) with date + rationale + deviations
```

### Pattern 1: Prescriptive RN voice (docs/03 = code contract)
**What:** `docs/03` states each rule as what the code MUST do (status names, role lists, amount ranges, mandatory fields), not as discussion. `docs/14` records the decision + date + rationale + explicit deviations from prior recommendations (D-09 overrides "maioria dos conselheiros elegíveis"; D-10 rejects "máximo de um por solicitação"). [VERIFIED: docs/03-regras-de-negocio.md:1-86] — current file holds `RN-001` through `RN-008` in terse `## RN-00x — <name>` sections; new rules continue the numbering (`RN-009`…).
**When to use:** Every closed item in this phase.
**Example:**
```markdown
## RN-009 — Arbitragem de aprovação parcial

Quando a apuração resultar `PARCIAL`, a solicitação NÃO conclui com valor —
move para `AGUARDANDO_ARBITRAGEM` e o `CHEFE_DEPARTAMENTO` arbitra o valor
final em `(0, requestedAmountCents]`, com justificativa obrigatória auditada
(`decidedBy` = chefe). (Decidido em 2026-09-23, D-01…D-04.)
```

### Anti-Patterns to Avoid
- **Editing src/ in this phase:** Any `backend/` or `frontend/` change violates the phase boundary (D-12: one docs commit). Code evidence files are read-only.
- **Silently dropping the REQUIREMENTS v2 line:** D-13 forbids it — the "Remaining docs/14 decisions: quorum…" line must be updated when REQUIREMENTS is touched, noting quorum/vista are now decided.
- **Restating a docs/14 recommendation as the decision:** D-09 and D-10 OVERRIDE/REJECT the doc's prior recommendations — the docs/14 rows must say so explicitly, or a Phase 6 implementer will follow the stale recommendation.
- **Inventing the AGUARDANDO_ARBITRAGEM ↔ JOB-02 interaction:** Deferred to Phase 6/7 planning — the RN must not specify skip/nudge/escalate.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| New doc format / ADR template | Custom decision-record structure | Existing `## RN-00x` sections + docs/14 table rows | Consistency lets Phase 6 grep `status ===` guards and RN numbers directly |
| New status vocabulary | Invented status names | `SCREAMING_SNAKE` Portuguese constants already in code (`AGUARDANDO_DESEMPATE`, `SUSPENSO_REUNIAO_ORDINARIA`) [VERIFIED: backend/src/services/votingService.js:12,22,64] | D-04 mandates the pattern; Phase 6 greps every `status ===` guard |

**Key insight:** The docs are a compiler input for Phase 6 — exact status strings (`AGUARDANDO_ARBITRAGEM`), role strings (`ADMINISTRADOR|CHEFE_DEPARTAMENTO|CONSELHEIRO|PROFESSOR|ALUNO` [VERIFIED: backend/prisma/schema.prisma:18] — verbatim: `// Role: ADMINISTRADOR|CHEFE_DEPARTAMENTO|CONSELHEIRO|PROFESSOR|ALUNO (enum nativo no Postgres)`), and amount semantics (integer cents) must match code verbatim or the transcription step introduces bugs.

## Common Pitfalls

### Pitfall 1: Quorum row closed without recording the override
**What goes wrong:** docs/14 keeps "Quórum do conselho | maioria dos conselheiros elegíveis" as if still recommended; Phase 6 implements a quorum check that D-09 forbids.
**Why it happens:** The docs/14 table is terse; it's tempting to just add "decidido" without striking the old recommendation.
**How to avoid:** The quorum + "Ausência de quórum" rows must state: no minimum quorum, `tally()` of cast valid votes decides, no "sem quórum" status introduced, prior recommendation overridden per D-09 with rationale. Code evidence: `tally()` header comment reads `// Maioria simples dos válidos, sem quórum. Abstenção ignora.` [VERIFIED: backend/src/services/votingService.js:28-29] — the doc must bless this behavior, not contradict it.
**Warning signs:** Any surviving sentence in docs/14 suggesting a quorum threshold or a "sem quórum" manual path.

### Pitfall 2: Vista row contradicts the schema unique constraint
**What goes wrong:** docs/14 "máximo de um por solicitação" survives alongside D-10's "1 per conselheiro", and Phase 6 "fixes" the schema to match the doc, breaking stacking extensions.
**Why it happens:** The doc recommendation and the code already disagree (CONCERNS.md §284 flags this); closing the row without explicit rejection preserves the ambiguity.
**How to avoid:** State the rejection verbatim: 1 vista per conselheiro per request, stacking deadline extensions, enforced by `@@unique([requestId, requestedBy]) // máx 1 vista por conselheiro por solicitação` [VERIFIED: backend/prisma/schema.prisma:179] plus the 409 handler `'Você já usou sua vista nesta solicitação (máx 1 por conselheiro)'` [VERIFIED: backend/src/controllers/votingController.js:118]. Doc's "máximo de um por solicitação" REJECTED with why.
**Warning signs:** The word "solicitação" (singular cap) anywhere in the closed vista row.

### Pitfall 3: Cancellation rule omits the INDEFERIDO-cleanup or CONCLUIDO-immutability edge
**What goes wrong:** Phase 6 implementer guesses whether admin can cancel `INDEFERIDO` or anyone can cancel `CONCLUIDO`.
**Why it happens:** D-05/D-08 split these edges across two decisions; easy to transcribe only the headline roles.
**How to avoid:** The RN must enumerate: dono → `RASCUNHO`, `EM_VOTACAO` only; admin → any non-terminal (explicitly including `INDEFERIDO` cleanup); chefe → any status before `CONCLUIDO`; `CONCLUIDO`/`CANCELADO` immutable. Current hole for contrast: `cancel` today does zero checks — `await prisma.resourceRequest.update({ where: { id: r.id }, data: { status: 'CANCELADO' } })` [VERIFIED: backend/src/controllers/requestController.js:112-120] with no role/status/justification guard.
**Warning signs:** An RN that says "admin/chefe can cancel" without the status matrix.

### Pitfall 4: Extraordinary-meeting rule invents a new status or widens the deliberation-entry roles
**What goes wrong:** RN names a new `SUSPENSO_*` status or lets conselheiros enter the manual result, contradicting D-11.
**Why it happens:** "Reunião extraordinária" sounds like a new flow state.
**How to avoid:** Reuse verbatim: existing `SUSPENSO_REUNIAO_ORDINARIA` flow (only chefe suspends: `if (req.user.role !== 'CHEFE_DEPARTAMENTO') return res.status(403)...` and `if (r.status !== 'EM_VOTACAO') return res.status(400)...` [VERIFIED: backend/src/controllers/votingController.js:138-144]); manual result entry via `collegiateDecision` which enforces `if (req.user.role !== 'CHEFE_DEPARTAMENTO') return res.status(403).json({ error: 'Só o chefe' })` [VERIFIED: backend/src/controllers/votingController.js:177-179] — note D-11 allows `ADMINISTRADOR` too (code currently chefe-only; the RN locks admin+chefe, Phase 6 reconciles). Result vocabulary `result DEFERIDO|INDEFERIDO|PARCIAL` [VERIFIED: backend/src/controllers/votingController.js:184] and mandatory `ataText` (`if (!ataText) return res.status(400)...` [VERIFIED: backend/src/controllers/votingController.js:185]).
**Warning signs:** Any status string in the RN other than the existing `SUSPENSO_REUNIAO_ORDINARIA`.

### Pitfall 5: ROADMAP criterion #4 treated as still true
**What goes wrong:** Plan 02-03 "marks quorum/vista-limit as deferred to v2" per the stale ROADMAP text, directly contradicting D-09…D-11.
**Why it happens:** Planner reads ROADMAP success criteria without the CONTEXT.md override.
**How to avoid:** D-13 + CONTEXT domain section are authoritative over ROADMAP #4: plan 02-03 covers 4 rules, records the deviation (ROADMAP text predates the expansion decision). Flag a ROADMAP follow-up edit (outside this phase's docs commit, which touches only docs/03+docs/14).
**Warning signs:** Any plan text containing "defer quorum" or "defer vista".

## Code Examples

Read-only evidence (what Phase 6 will change; this phase only cites):

### First-partial-wins (replaced by D-01/D-04)
```js
// Source: backend/src/services/votingService.js:81-85
} else if (t.outcome === 'PARCIAL') {
  status = 'APROVADO_PARCIALMENTE';
  // valor = menor valor parcial votado? usa o do voto parcial majoritário (primeiro)
  const p = validVotes.find((v) => v.voteType === 'DEFERIR_PARCIALMENTE');
  approvedCents = p ? p.approvedAmountCents : 0;
```

### reverseProvision template (reused by D-07)
```js
// Source: backend/src/controllers/financeController.js:47-66
// admin/chefe-only guard, REVERSE FinancialTransaction with justification metadata,
// status → CANCELADO. D-07 extends this shape to cancellation-after-approval.
if (!['ADMINISTRADOR', 'CHEFE_DEPARTAMENTO'].includes(req.user.role)) {
  return res.status(403).json({ error: 'Só admin/chefe' });
}
// ...
data: { requestId: r.id, type: 'REVERSE', amountCents: r.approvedAmountCents,
  fromState: 'PROVISIONADO', toState: 'DISPONIVEL',
  performedBy: req.user.id, metadata: JSON.stringify({ justification: req.body?.justification || '' }) },
```

### Voting flow touched by D-01/D-11 (docs/07 consistency)
```text
# Source: docs/07-fluxos.md:22-38 — "Abre votação por 24h … Apura resultado
# ├── Deferido → Provisiona valor / ├── Parcial → Provisiona valor parcial / └── Indeferido"
# D-01 inserts AGUARDANDO_ARBITRAGEM between "Parcial" and provisioning;
# D-11 inserts the SUSPENSO extraordinary-meeting branch. docs/07 SHOULD be
# checked for contradiction; edit only if it contradicts (default: no edit).
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| "First partial vote wins" (`validVotes.find(...)`) | `PARCIAL` → `AGUARDANDO_ARBITRAGEM`, chefe arbitrates `(0, requested]` | Decided 2026-09-23 (D-01…D-04), implemented Phase 6 | Partial example `[8000, 5000, 6000]` no longer auto-resolves; any value ≤ requested with justification |
| Zero-check cancel (anyone, any status) | Status×role matrix + mandatory justification + REVERSE | Decided 2026-09-23 (D-05…D-08), implemented Phase 6 | Closes the cancel hole; `CONCLUIDO` immutable |
| docs/14 "maioria dos conselheiros elegíveis" + "sem quórum" manual path | No quorum; `tally()` as-is | Overridden 2026-09-23 (D-09) | No quorum check in Phase 6; no new status |
| docs/14 "máximo de um por solicitação" (vista) | 1 vista per conselheiro, stacking extensions (`@@unique`) | Rejected 2026-09-23 (D-10) | Schema stays; doc corrected |

**Deprecated/outdated:**
- ROADMAP Phase 2 success criterion #4 ("quorum, vista-limit conflict explicitly deferred to v2") — STALE, overridden by CONTEXT.md domain section + D-09…D-11 + D-13. Record deviation in plan 02-03; ROADMAP text edit is out-of-phase follow-up.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | docs/03 new RNs continue numbering at RN-009 (file ends at RN-008) [VERIFIED: docs/03-regras-de-negocio.md:1-86 shows RN-001…RN-008, no higher] — numbering itself is the agent's discretion, so this is a recommendation not a fact | Architecture Patterns | Low — any consistent numbering works; planner confirms |
| A2 | docs/06 needs no edit (its table has no Cancel row; D-05/D-11 are consistent by absence, Phase 4 transcribes the matrix) — discretion call | Pitfalls | Low — Phase 4 re-reads docs/06 anyway; contradiction would surface there |
| A3 | docs/07 needs no edit (flow diagram is coarse enough to absorb arbitration/suspension branches without contradiction) — discretion call | Code Examples | Low — Phase 6 planner re-checks; worst case a clarifying edit later |

**Note:** No `[ASSUMED]` claims requiring user confirmation — all D-decisions are locked in CONTEXT.md and all code/doc citations were read this session.

## Open Questions (RESOLVED)

1. **Does docs/07-fluxos.md get edited for the arbitration + suspension branches? — RESOLVED: default no-edit adopted.**
   - What we know: D-12 limits the commit to docs/03+docs/14; docs/07's diagram (`Parcial → Provisiona valor parcial`, `Pedido de vista? → Adiciona 24h`) is coarse and arguably still true at its abstraction level.
   - What's unclear: Whether the planner judges the diagram contradictory enough to need a branch note.
   - Recommendation: Default to no edit (D-12 scope discipline); planner makes the call under the agent's discretion and records the reason either way.
   - Resolution: planner adopted default-no-edit — implemented in plan 02-01 task 1 (docs/07 read-only consistency check with reason recorded).

2. **Where exactly do the new RNs live (append RN-009… vs extend existing sections)? — RESOLVED: append RN-009+ adopted.**
   - What we know: Explicitly the agent's discretion in CONTEXT.md.
   - What's unclear: Planner's structural choice.
   - Recommendation: Append new numbered RNs (arbitration, cancellation, quorum-absence, vista, extraordinary meeting) — preserves stable RN-001…RN-008 references used by code comments (e.g. RN-005 cited in requestController.js:68).
   - Resolution: planner adopted append-RN-009+ — implemented in all three plans (02-01 RN-009, 02-02 RN-010, 02-03 RN-011/RN-012/RN-013).

## Environment Availability

SKIPPED — docs-only phase: no external tools, services, runtimes, or CLIs beyond `git` + a text editor. No fallback analysis needed.

## Validation Architecture

`workflow.nyquist_validation` is `true` [VERIFIED: .planning/config.json:24] and `security_enforcement` is `true` (level 1) [VERIFIED: .planning/config.json:48-49], so these sections are included. This phase has no requirement IDs and no code — validation is document verification, not test execution.

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Backend vitest (`cd backend && npx vitest run`) + frontend build — CI regression gate only |
| Config file | none in this phase — markdown diff cannot break either job |
| Quick run command | `git diff --stat` (confirm only `docs/03-regras-de-negocio.md` + `docs/14-decisoes-em-aberto.md` changed) |
| Full suite command | N/A — no code changed; CI runs on the PR/push automatically |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| (gate for VOT-03/VOT-04) | 4 docs/14 rows closed with date + rationale; docs/03 states 4+ rules prescriptively | manual (read-through) | `grep -n "AGUARDANDO_ARBITRAGEM\|quórum\|vista\|extraordinária" docs/03-regras-de-negocio.md docs/14-decisoes-em-aberto.md` | ❌ Wave 0 (docs edits are the deliverable) |

### Sampling Rate
- **Per task commit:** `git diff --stat` — only the two doc files touched
- **Per wave merge:** N/A (single-commit phase)
- **Phase gate:** Reviewer read-through: each D-01…D-11 traceable to a doc sentence; D-09/D-10 deviations explicit; no `src/` in diff; then `/gsd-verify-work`

### Wave 0 Gaps
- None — no test infrastructure needed for a markdown-only commit. Characterization tests for the rules land in Phase 6 (06-03/06-04).

## Security Domain

Docs-only phase: no auth, session, crypto, or input-handling code changes. Included because `security_enforcement` is enabled.

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | No code — but D-05/D-11 role names must match the 5-role vocabulary exactly or Phase 4's permission map inherits a typo |
| V4 Access Control | indirectly | D-05 status×role matrix + D-11 admin/chefe-only deliberation entry are the future access-control spec — exact role strings required (see Key insight) |
| V5 Input Validation | indirectly | D-06 mandatory justification (missing = 400) and D-02 `(0, requestedAmountCents]` range are the future validation spec |
| V6 Cryptography | no | — |

### Known Threat Patterns for docs-as-contract

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Ambiguous rule text re-guessed in code (Phase 6 implements the wrong matrix) | Tampering (integrity of spec) | Prescriptive RNs with verbatim status/role strings + reviewer traceability D→sentence |
| Stale recommendation followed instead of decision (quorum/vista) | Tampering | Explicit OVERRIDE/REJECT markers with rationale in docs/14 (D-09, D-10) |

## Sources

### Primary (HIGH confidence)
- `02-CONTEXT.md` (D-01…D-13, domain/deferred sections) — read this session, authoritative user decisions
- `backend/src/services/votingService.js:1-113` — read this session (`tally()` 29-49, `closeVoting` 60-111, first-partial-wins 81-85)
- `backend/src/controllers/requestController.js:112-120` — read this session (zero-check cancel hole)
- `backend/src/controllers/votingController.js:94-122,138-154,177-222` — read this session (vista 409, suspend guard, collegiateDecision)
- `backend/src/controllers/financeController.js:47-69` — read this session (reverseProvision template)
- `backend/prisma/schema.prisma:18,64,179` — read this session (role vocabulary, status default, vista `@@unique`)
- `docs/03-regras-de-negocio.md`, `docs/14-decisoes-em-aberto.md`, `docs/06-permissoes.md`, `docs/07-fluxos.md` — read this session (edit targets + consistency surface)
- `.planning/REQUIREMENTS.md` (VOT-03/04, v2 trigger line 59), `.planning/ROADMAP.md` Phase 2 section (stale criterion #4), `.planning/STATE.md`, `.planning/config.json`, `AGENTS.md` — read this session

### Secondary (MEDIUM confidence)
- None — no external sources needed; all findings are in-repo.

### Tertiary (LOW confidence)
- None.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — no stack; docs-only is certain per CONTEXT.md domain section + D-12.
- Architecture: HIGH — all edit targets and code evidence read verbatim this session with line citations.
- Pitfalls: HIGH — each pitfall is grounded in a specific verified code/doc behavior, not in training knowledge.

**Research date:** 2026-09-23
**Valid until:** 30 days (stable domain docs + locked user decisions; code evidence pinned to lines that Phase 6 will change — re-verify line numbers at Phase 6 plan time)
