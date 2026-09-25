# Phase 06 CONTEXT: Decisions Clear Enough for Downstream Agents

**Phase:** Voting & Money State Machine  
**Date:** 2026-09-24  
**Status:** Context captured — ready for planning

---

## Goals (from ROADMAP.md)

The Phase 6 goal is to ensure that every voting decision reaches a terminal status and the annual cap cannot be bypassed.

### Success Criteria

1. A tied vote always resolves to a terminal status — including when the chefe already voted in the normal phase
2. `CONCLUIDO` requests count toward `annualTotalCents`: cycling a request through spend → re-approve cannot slip under the auto-approval cap
3. Partial approvals follow the Phase 2 aggregation rule — first partial vote wins is gone with tests encoding the rule
4. Cancelling an approved request requires ADMINISTRADOR/CHEFE_DEPARTAMENTO + justification and writes an audited compensating reversal
5. The state-machine test count grows — fixes are covered by characterization-then-flip tests

---

## Domain

The domain is the **voting/deliberation status machine plus financial ledger invariants**:

- Six interlinked statuses: `RASCUNHO`, `EM_VOTACAO`, `AGUARDANDO_DESEMPATE`, `SUSPENSO_REUNIAO_ORDINARIA`, approval variants, `CONCLUIDO`
- Financial balance writes at five sites: `submit`, `markSpent`, `closeVoting`, `collegiateDecision`, `patchBalance`
- Annual cap enforcement and partial-approval aggregation logic

---

## Canonical Refs (MANDATORY — full relative paths)

These documents lock requirements and must be read before any implementation:

```markdown
- docs/03-regras-de-negocio.md
  - RN-004: Limite de aprovação (limit history requirements)
  - RN-009: Arbitragem de aprovação parcial (partial aggregation rule, substituting first-partial-wins)
  - RN-010: Cancelamento após aprovação (cancellation roles + justification requirement + REVERSE transaction)

- docs/06-permissoes.md
  - Permission matrix for all documented endpoints including cancel, message remove, getOne/list scoping, listVotes, settings transactions

- docs/14-decisoes-em-aberto.md
  - Previous decisions on quorum (overridden to no quorum), vista limit per conselheiro vs per solicitation
  - Partial-approval aggregation: "first partial vote wins" is explicitly REJECTED in favor of jefe arbitration

- backend/tests/voting.test.js
  - Existing tally() tests (5 cases) — must be extended with closeVoting/tie-break tests before implementation

- .planning/ROADMAP.md
  - Phase 6 requirements: VOT-01, VOT-02, VOT-03, VOT-04

- .planning/codebase/CONCERNS.md
  - Known bugs: tie-break dead-end (AGUARDANDO_DESEMPATE gets stuck), annual limit bypass via mark-spent, partial-wins behavior
```

---

## Codebase Context (Reusable Assets & Patterns)

### Fragile Areas (from CONCERNS.md)

**Voting/deliberation state machine**: Six interlinked statuses with transitions spread across `castVote`, `closeVoting`, `suspend`/`unsuspend`, `collegiateDecision`. Grepping for `status ===` guards is mandatory before any change.

**Financial balance invariants**: Copy-pasted transaction blocks exist independently in 5 files. Concurrency test will cover the race condition fix.

### Existing Tests

- `backend/tests/voting.test.js`: 17 total tests (helpers, calcAmount, tally). Must be extended for:
  - Tie-break convergence tests
  - CONCLUIDO annual accounting tests
  - Partial-approval aggregation tests
  - Cancellation-after-approval tests
  - TOCTOU race prevention tests

### Transaction Patterns

Current pattern at write sites (needs wrapping):

```javascript
await $transaction(async (tx) => {
  const balance = await tx.fundBalance.findUnique({ where: { id } })
  if (!balance.availableCents || balance.availableCents < amount) {
    throw new Error('Insufficient funds')
  }
  // ... write operations
})
```

---

## Decisions Captured

### Implementation Decisions

#### VOT-01: Tie-break Mechanism for AGUARDANDO_DESEMPATE

**Decision**: Chefe only votes when there is a tie; otherwise the chefe does not vote.

**Implications**:
- `changeMyVote` endpoint must guard on `status === AGUARDANDO_DESEMPATE`
- Eligibility check: `voterID === CHEFE_DEPARTAMENTO && status === AGUARDANDO_DESEMPATE`
- Prevents the jefe from double-voting (once normally once in tiebreak)
- Fixes the known bug where AGUARDANDO_DESEMPATE gets stuck if chefe already voted

**Files to modify**:
- `backend/src/controllers/votingController.js` — `changeMyVote` handler condition
- `backend/src/services/votingService.js` — eligibility logic for tiebreak phase

---

#### VOT-02: Annual-Limit Accounting (CONCLUIDO Counts Toward Cap)

**Decision**: Add `CONCLUIDO` to the annual sum so requests stay 'active' until actually spent.

**Implications**:
- Update `annualTotalCents` calculation in `requestService.js` or wherever it's defined
- Current statuses: `SUBMETIDO | EM_VOTACAO | APROVADO | APROVADO_AUTOMATICAMENTE | APROVADO_PARCIALMENTE`
- New sum: same + `CONCLUIDO`
- Unit test must prove cycling through mark-spent cannot bypass the cap

**Files to modify**:
- `backend/src/services/requestService.js` — `annualTotalCents` getter/update logic
- `backend/tests/voting.test.js` — new test: cycle spent → submit new under cap should fail (if at limit)

---

#### VOT-03: Partial-Approval Aggregation Rule

**Decision**: When partial vote exists, the chefe edits the final value approved. This replaces "first partial vote wins" behavior and explicitly uses jefe arbitration.

**Implications**:
- `closeVoting` must NOT automatically conclude with the first partial vote's amount
- Instead: `validVotes.filter(v => v.voteType === DEFERIR_PARCIALMENTE).length > 0 || status === AGUARDANDO_ARBITRAGEM`
- Move to arbitration path when any partial vote exists, then wait for jefe explicit edit
- Jefe arbitrates in `(0, requestedAmountCents]` with mandatory justification
- Audit trail: `decidedBy = CHEFE_DEPARTAMENTO`, action = `partial_arbitration`

**Files to modify**:
- `backend/src/services/votingService.js` — `closeVoting` function
- Remove: `validVotes.find(v => v.voteType === DEFERIR_PARCIALMENTE)?.approvedAmountCents` (first-wins)
- Add: explicit arbitration flow with jefe edit endpoint

**New API**: Consider adding `PATCH /api/requests/:id/partial-arbitration` for jefe to set final value, or ensure existing edit route handles this case properly.

---

#### VOT-04: Cancellation-After-Approval Justification Workflow

**Decision**: Simple text field ("justificativa") for cancellation justification.

**Implications**:
- `cancelForm`: single `Textarea` or required `text` model field for justification
- Backend stores in `FinancialTransaction.metadata.justification` (plain string)
- AuditEvent `request_cancelled` includes the justification verbatim
- RN-010: mandatory justification → return 400 if empty

**Files to modify**:
- `backend/src/controllers/requestController.js` — cancel path validation
- `frontend/src/views/Requests.vue` — cancel form UI (add required textarea)
- Backend must enforce: cancellation of PROVISIONED/SPENT status requires ADMIN/CHEFE + justification

---

#### GA-VOT-05: Money-Path TOCTOU Race Guard

**Decision**: It should be impossible for the department to overspend. Use conditional update with balance check inside each transaction.

**Implications**:
- All 5 write sites must wrap in `$transaction` with `availableCents >= amount WHERE updated` pattern:
  
  ```javascript
  await $transaction(async (tx) => {
    const rowsUpdated = await tx.fundBalance.updateMany({
      where: { id },
      data: { availableCents: { decrement: amount } },
      include: { version: true } // for optimistic locking if needed
    })
    
    if (rowsUpdated === 0) {
      throw new Error('Insufficient balance')
    }
  })
  ```

- Consider using `UPDATE … SET availableCents = availableCents - $x WHERE ... AND availableCents >= $x` directly in SQL or Prisma conditional
- Move all balance reads into the transaction (never outside)
- Add concurrency test: spawn multiple simultaneous submissions, confirm only one succeeds per available balance

**Files to modify**:
- `backend/src/controllers/requestController.js` — `submit`, `markSpent`
- `backend/src/services/votingService.js` — `closeVoting`
- `backend/src/controllers/votingController.js` — `collegiateDecision`
- `backend/src/controllers/financeController.js` — all balance mutation controllers

---

## Deferred Ideas (Not in Scope)

None captured for this phase. All scope creep would belong to future phases:

- Feature requests (file uploads, RPA integration) → v2/milestone
- CSRF token addition → separate security phase if needed
- Balance service extraction → tech debt refactor (only where fix requires)
- Pagination/offset implementation → performance improvement, not bug fix

---

## Next Steps for Downstream Agent

After planning and implementation:

1. **Extend `backend/tests/voting.test.js`** with tests for:
   - VOT-01 tie-break convergence
   - VOT-02 annual accounting with CONCLUIDO inclusion  
   - VOT-03 partial-arbitration flow
   - VOT-04 cancellation justification validation
   - TOCTOU race prevention (simulate concurrent submissions)

2. **Modify state machine guards** in `backend/src/services/votingService.js` and `backend/src/controllers/votingController.js` to implement VOT-01

3. **Update annual calculation** in request service for VOT-02

4. **Implement arbitration flow** per VOT-03

5. **Add justification field** to cancel form and backend validation for VOT-04

6. **Refactor all 5 write sites** to use conditional balance updates per GA-VOT-05

7. **Verify** with manual protocol: simulate concurrent submissions, expired votings, tie scenarios

---

*Phase context captured: 2026-09-24 — ready for planning → implementation → test extension*
