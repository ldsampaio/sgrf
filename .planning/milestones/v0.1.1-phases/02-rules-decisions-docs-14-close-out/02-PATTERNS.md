# Phase 02: Rules Decisions (docs/14 close-out) - Pattern Map

**Mapped:** 2026-09-23
**Files analyzed:** 2 (docs-only phase — no src/ changes)
**Analogs found:** 2 / 2

> Docs-only phase per `02-CONTEXT.md` domain section + D-12. Code files
> (`votingService.js`, `requestController.js`, `financeController.js`,
> `votingController.js`) are READ-ONLY evidence for Phase 6 — cited for
> verbatim vocabulary only, not edited. The "patterns" below are doc patterns:
> RN-xxx voice, terse table style, prescriptive rule wording, date+rationale
> record format. All analog paths verified git-tracked via `git ls-files`.

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `docs/03-regras-de-negocio.md` (append RN-009…RN-013) | config (doc-as-code-contract) | transform (D-decisions → prescriptive rule text) | `docs/03-regras-de-negocio.md` itself (RN-001…RN-008) | exact (self-extension) |
| `docs/14-decisoes-em-aberto.md` (close 4 rows) | config (decision log) | transform (D-decisions → closed rows with date+rationale) | `docs/14-decisoes-em-aberto.md` itself (terse 2-col table) | exact (self-extension) |

Consistency-check surface (read-only, default no edit per D-12 / RESEARCH.md A2–A3):

| File | Role | Use in this phase |
|------|------|-------------------|
| `docs/06-permissoes.md` | config | Permission matrix — verify D-05/D-11 agree; no Cancel row exists so consistent by absence |
| `docs/07-fluxos.md` | config | Voting-flow diagram — verify D-01/D-11 branches don't contradict; default no edit |

## Pattern Assignments

### `docs/03-regras-de-negocio.md` (config, transform)

**Analog:** `docs/03-regras-de-negocio.md` (self — RN-001…RN-008, lines 1-86)

**Section-header pattern** (lines 3, 15, 21, 32 — every rule follows it):
```markdown
## RN-001 — Domínio de e-mail
```
```markdown
## RN-007 — Prazo de votação
```
Format: `## RN-00x — <short Portuguese name>`, sequential numbering, em-dash
separator. New rules continue at RN-009 (file ends at RN-008, line 78;
numbering itself is the agent's discretion per RESEARCH.md Open Question 2 —
recommended: append, preserving stable RN-001…RN-008 references used by code
comments, e.g. RN-005 cited in `requestController.js:68`).

**Terse prescriptive voice** (lines 5-13, RN-001):
```markdown
Somente endereços terminados exatamente em:

```
@utfpr.edu.br
```

serão aceitos.

A validação deve ser feita no backend. A validação no frontend é apenas auxiliar.
```
Rules state what the code MUST do (backend-enforced, exact strings), short
declarative sentences, fenced code blocks for verbatim constants.

**Field-list pattern** (lines 34-44, RN-004 — template for status×role matrix / amount-range rules):
```markdown
O limite deve possuir histórico:

```
limite
vigência inicial
vigência final
criado por
data de criação
alterado por
data de alteração
```

Uma alteração de limite não deve modificar decisões já realizadas.
```
Use fenced blocks for enumerations (D-05 status×role matrix, D-08 cancellable
set) and closing normative sentence ("não deve…", "NÃO…", "somente…").

**Recommendation-with-default pattern** (lines 50-52, RN-005; lines 28-30, RN-003):
```markdown
O sistema deve impedir aprovação quando o saldo disponível for inferior ao valor aprovado, salvo se uma configuração explícita permitir saldo negativo.

Recomendação inicial: não permitir saldo disponível negativo.
```
```markdown
A recomendação é usar inteiro em centavos internamente.
```
Normative MUST sentence first, "Recomendação inicial:" second. New RNs follow
the same shape: prescriptive rule (D-01…D-11 transcribed verbatim) + decision
stamp `(Decidido em 2026-09-23, D-0x…D-0y.)` per D-12.

**Example new-RN shape to copy** (from RESEARCH.md Pattern 1 — planner adapts wording, keeps voice):
```markdown
## RN-009 — Arbitragem de aprovação parcial

Quando a apuração resultar `PARCIAL`, a solicitação NÃO conclui com valor —
move para `AGUARDANDO_ARBITRAGEM` e o `CHEFE_DEPARTAMENTO` arbitra o valor
final em `(0, requestedAmountCents]`, com justificativa obrigatória auditada
(`decidedBy` = chefe). (Decidido em 2026-09-23, D-01…D-04.)
```

**What each new RN must contain (traceability D→sentence):**
- RN-009 arbitration (D-01…D-04): `PARCIAL` → `AGUARDANDO_ARBITRAGEM` (never
  concludes with amount), range `(0, requestedAmountCents]`, mandatory
  justification + audit (`decidedBy` = chefe). Must NOT specify
  skip/nudge/escalate for JOB-02 (deferred — RESEARCH.md Anti-Pattern 4).
- RN-010 cancellation (D-05…D-08): full status×role matrix — dono →
  `RASCUNHO`/`EM_VOTACAO` only; `ADMINISTRADOR` → any non-terminal (explicitly
  including `INDEFERIDO` cleanup); `CHEFE_DEPARTAMENTO` → any status before
  `CONCLUIDO`; `CONCLUIDO`/`CANCELADO` immutable. Mandatory justification
  (missing = 400) → `REVERSE` metadata + `AuditEvent`; compensating `REVERSE`
  `FinancialTransaction` on approved/provisioned cancel.
- RN-011 quorum-absence (D-09): no minimum quorum, `tally()` of cast valid
  votes decides, no "sem quórum" status.
- RN-012 vista (D-10): 1 vista per conselheiro per request, stacking deadline
  extensions.
- RN-013 extraordinary meeting (D-11): conselheiros may request interruption;
  chefe pauta em reunião extraordinária via existing `SUSPENSO_REUNIAO_ORDINARIA`
  flow; only `ADMINISTRADOR`/`CHEFE_DEPARTAMENTO` enter the manual deliberation
  result via `collegiateDecision`. No new status string.

---

### `docs/14-decisoes-em-aberto.md` (config, transform)

**Analog:** `docs/14-decisoes-em-aberto.md` (self — terse 2-column table, lines 1-20)

**Preamble pattern** (lines 1-3):
```markdown
# Decisões em aberto

Estas questões devem ser resolvidas antes da implantação em produção. Para não bloquear o desenvolvimento, os valores recomendados abaixo podem ser usados na primeira versão.
```

**Row pattern** (lines 5-20 — entire file is one table, pipe-voice, lowercase terse cells):
```markdown
| Tema | Recomendação inicial |
|------|---------------------|
| Quórum do conselho | maioria dos conselheiros elegíveis |
| Ausência de quórum | status "sem quórum" e ação manual |
| Pedido de vista | máximo de um por solicitação |
| Cancelamento após aprovação | permitido apenas por admin ou chefe, com justificativa |
```
Closing a row = keep the row, append decision + date + rationale in place.
Per D-12 every closed item carries date + rationale. Per D-09/D-10 the quorum
and vista rows must carry explicit OVERRIDE/REJECT markers — restating the
stale recommendation as the decision is the #1 pitfall (RESEARCH.md Pitfall 1,
Pitfall 2).

**Required closed-row content:**
- Quórum row: no minimum quorum, `tally()` of cast valid votes decides, no
  "sem quórum" status introduced — prior recommendation ("maioria dos
  conselheiros elegíveis" + "sem quórum → ação manual") OVERRIDDEN per D-09
  with rationale + date 2026-09-23.
- Vista row: 1 per conselheiro, stacking extensions, `@@unique` kept — doc's
  "máximo de um por solicitação" REJECTED with why + date. Warning: the word
  "solicitação" (singular cap) must not survive as the rule.
- Cancellation row: status×role matrix + mandatory justification + REVERSE
  (D-05…D-08) + date.
- Partial-approval row: implicit before (was code-only "first partial wins") —
  add/close row: `PARCIAL` → `AGUARDANDO_ARBITRAGEM`, chefe arbitrates
  (D-01…D-04) + date.
- Untouched rows (limite, saldo insuficiente, taxa de dólar, aluno/auxílio,
  exclusão de usuário, senha temporária, anexos, e-mails falhos) stay as-is —
  out of scope (CONTEXT.md Deferred).

---

## Shared Patterns

### Prescriptive RN voice (docs/03 = code contract)
**Source:** `docs/03-regras-de-negocio.md` lines 1-86
**Apply to:** Every new RN-009…RN-013
- State what code MUST do: verbatim status names, role lists, amount ranges,
  mandatory fields. Never discussion prose.
- Short declarative sentences; fenced blocks for constants/enumerations;
  "Recomendação inicial:" only where a default is needed.
- End each new RN with decision stamp `(Decidido em 2026-09-23, D-0x…)` (D-12).

### Terse table style (docs/14)
**Source:** `docs/14-decisoes-em-aberto.md` lines 5-20
**Apply to:** All 4 closed rows
- Keep the 2-column pipe table; lowercase terse cells; close rows in place
  with decision + date + rationale appended.
- Deviations from prior recommendations noted EXPLICITLY (D-09 OVERRIDDEN,
  D-10 REJECTED) — never silently replace.

### Verbatim code vocabulary (the anti-typo contract)
**Sources (read-only evidence, all git-tracked):**
- Status constants — `SCREAMING_SNAKE` Portuguese: `AGUARDANDO_DESEMPATE`
  (`backend/src/services/votingService.js:12,22,64`); new
  `AGUARDANDO_ARBITRAGEM` follows D-04. Suspension reuses existing
  `SUSPENSO_REUNIAO_ORDINARIA` — no new `SUSPENSO_*` string (D-11).
- Role vocabulary — `ADMINISTRADOR|CHEFE_DEPARTAMENTO|CONSELHEIRO|PROFESSOR|ALUNO`
  (`backend/prisma/schema.prisma:18`, comment `// Role: … (enum nativo no Postgres)`).
  Must match exactly or Phase 4's permission map inherits a typo (RESEARCH.md Security Domain, V2/V4).
- Money — integer cents (`requestedAmountCents`, `approvedAmountCents`);
  D-02 range `(0, requestedAmountCents]`.
- Blessed behaviors to cite, not change: `tally()` header
  `// Maioria simples dos válidos, sem quórum. Abstenção ignora.`
  (`backend/src/services/votingService.js:28-29`); first-partial-wins replaced —
  `validVotes.find((v) => v.voteType === 'DEFERIR_PARCIALMENTE')`
  (`backend/src/services/votingService.js:81-85`); zero-check cancel hole —
  `await prisma.resourceRequest.update({ where: { id: r.id }, data: { status: 'CANCELADO' } })`
  (`backend/src/controllers/requestController.js:112-120`); vista 409
  `'Você já usou sua vista nesta solicitação (máx 1 por conselheiro)'`
  (`backend/src/controllers/votingController.js:118`) + `@@unique([requestId, requestedBy])`
  (`backend/prisma/schema.prisma:179`); suspend guard chefe-only + `EM_VOTACAO`-only
  (`backend/src/controllers/votingController.js:138-144`); `collegiateDecision`
  chefe-only + `result DEFERIDO|INDEFERIDO|PARCIAL` + mandatory `ataText`
  (`backend/src/controllers/votingController.js:177-185`) — note D-11 locks
  admin+chefe entry (code currently chefe-only; Phase 6 reconciles);
  `reverseProvision` admin/chefe guard + `REVERSE` transaction + justification
  metadata (`backend/src/controllers/financeController.js:47-66`).

### Consistency-check pattern (docs/06 + docs/07, read-only)
**Sources:** `docs/06-permissoes.md` lines 1-20; `docs/07-fluxos.md` lines 22-38
- `docs/06` matrix (`| Ação | Admin | Chefe | Conselheiro | Professor | Aluno |`
  with `Sim`/`Não`/`Parcial` cells + trailing `> Observação:` note) has NO
  Cancel row — D-05/D-11 consistent by absence; default no edit (RESEARCH.md A2).
- `docs/07` voting branch (`├── Parcial → Provisiona valor parcial`,
  `Pedido de vista? → Adiciona 24h`) is coarse enough to absorb
  arbitration/suspension without contradiction; D-01 inserts
  `AGUARDANDO_ARBITRAGEM` between "Parcial" and provisioning, D-11 inserts the
  `SUSPENSO` branch — check, default no edit (D-12 scope discipline, RESEARCH.md A3).

### One-docs-commit shape
**Source:** CONTEXT.md D-12 + RESEARCH.md Architecture Patterns
- Single commit touching ONLY `docs/03-regras-de-negocio.md` +
  `docs/14-decisoes-em-aberto.md` (`git diff --stat` verification; any
  `backend/`/`frontend/` file in the diff violates the phase boundary).
- Land via PR flow (Phase 1 learning — direct pushes to protected main are
  declined before CI runs); markdown-only diff keeps CI green.
- No `npm install`, no lint/typecheck commands (none configured per AGENTS.md).
- Never commit `backend/.env`, `*.db*`, `backend/uploads/*`.
- D-13 follow-up (no doc edit in this phase): plan 02-03 covers 4 rules not 2;
  REQUIREMENTS.md v2 trigger line "Remaining docs/14 decisions: quorum…"
  updated when REQUIREMENTS is touched, not silently dropped. ROADMAP Phase 2
  criterion #4 ("deferred to v2") is STALE — record the deviation, never emit
  "defer quorum/vista" plan text.

## No Analog Found

None — both edit targets extend their own existing files (exact self-matches),
and all code-vocabulary citations are verified in tracked source.

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| — | — | — | — |

## Metadata

**Analog search scope:** `docs/` (03, 14, 06, 07 — all read in full, ≤86 lines each);
code evidence via RESEARCH.md verified citations (re-verified tracked, not re-read).
**Files scanned:** 4 docs + 5 tracked code-evidence files (trace check only).
**Pattern extraction date:** 2026-09-23
