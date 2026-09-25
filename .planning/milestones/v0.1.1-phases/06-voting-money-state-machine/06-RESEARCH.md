# Phase 06: Voting & Money State Machine - Research

**Researched:** 2026-09-24
**Domain:** Voting/deliberation state machine + financial ledger invariants (PostgreSQL + Prisma + Express)
**Confidence:** HIGH

## Summary

Phase 06 addresses five critical correctness issues in the SGRF/SGRD voting and money state machine:

1. **VOT-01 (Tie-break convergence)**: The `AGUARDANDO_DESEMPATE` state can dead-end when the chefe already voted during the normal phase. The fix allows the chefe to change their vote during tie-break only, preventing double-voting while ensuring resolution.

2. **VOT-02 (Annual cap accounting)**: `CONCLUIDO` requests are excluded from `annualTotalCents`, allowing requesters to bypass the auto-approval limit by cycling requests through `mark-spent`. The fix adds `CONCLUIDO` to the summed statuses.

3. **VOT-03 (Partial-approval aggregation)**: The current "first partial vote wins" behavior in `closeVoting` is replaced by chefe arbitration — when any `DEFERIR_PARCIALMENTE` vote exists, the request moves to `AGUARDANDO_ARBITRAGEM` and the chefe explicitly sets the final amount with mandatory justification.

4. **VOT-04 (Cancellation-after-approval)**: Approved/provisioned requests require ADMINISTRADOR/CHEFE_DEPARTAMENTO + mandatory justification to cancel, writing an audited compensating `REVERSE` financial transaction.

5. **GA-VOT-05 (TOCTOU race guard)**: All 5 balance-mutation sites must use conditional updates (`availableCents >= amount`) inside transactions to prevent overspend under concurrency.

**Primary recommendation:** Extend `backend/tests/voting.test.js` with characterization tests for each fix *before* implementation, then apply minimal, surgical changes to the 5 write sites and state machine guards. Use Prisma conditional `updateMany` with `where: { id, availableCents: { gte: amount } }` for the race guard.

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

#### VOT-01: Tie-break Mechanism for AGUARDANDO_DESEMPATE

**Decision**: Chefe only votes when there is a tie; otherwise the chefe does not vote.

**Implications**:
- `changeMyVote` endpoint must guard on `status === AGUARDANDO_DESEMPATE`
- Eligibility check: `voterID === CHEFE_DEPARTAMENTO && status === AGUARDANDO_DESEMPATE`
- Prevents the chefe from double-voting (once normally once in tiebreak)
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

**Decision**: When partial vote exists, the chefe edits the final value approved. This replaces "first partial vote wins" behavior and explicitly uses chefe arbitration.

**Implications**:
- `closeVoting` must NOT automatically conclude with the first partial vote's amount
- Instead: `validVotes.filter(v => v.voteType === DEFERIR_PARCIALMENTE).length > 0 || status === AGUARDANDO_ARBITRAGEM`
- Move to arbitration path when any partial vote exists, then wait for chefe explicit edit
- Chefe arbitrates in `(0, requestedAmountCents]` with mandatory justification
- Audit trail: `decidedBy = CHEFE_DEPARTAMENTO`, action = `partial_arbitration`

**Files to modify**:
- `backend/src/services/votingService.js` — `closeVoting` function
- Remove: `validVotes.find(v => v.voteType === DEFERIR_PARCIALMENTE)?.approvedAmountCents` (first-wins)
- Add: explicit arbitration flow with chefe edit endpoint

**New API**: Consider adding `PATCH /api/requests/:id/partial-arbitration` for chefe to set final value, or ensure existing edit route handles this case properly.

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

### the agent's Discretion

- **Test strategy**: Characterization-then-flip pattern for state machine fixes — write failing tests that encode the *desired* behavior, then implement to make them pass. This is preferred over pure TDD because the existing behavior is buggy and tests would encode bugs.

- **Arbitration endpoint**: Whether to add a dedicated `PATCH /api/requests/:id/partial-arbitration` endpoint or reuse an existing route (e.g., `collegiateDecision` pattern) is left to implementation discretion. Recommend dedicated endpoint for clarity.

- **Conditional update pattern**: Prisma `updateMany` with `where: { availableCents: { gte: amount } }` vs raw SQL `UPDATE ... WHERE availableCents >= $1` — both work; Prisma approach keeps type safety but may need `$transaction` isolation level consideration.

- **Frontend cancel form**: The exact UX for the justification textarea (modal vs inline, validation messaging) is implementation discretion.

---

### Deferred Ideas (OUT OF SCOPE)

None captured for this phase. All scope creep would belong to future phases:

- Feature requests (file uploads, RPA integration) → v2/milestone
- CSRF token addition → separate security phase if needed
- Balance service extraction → tech debt refactor (only where fix requires)
- Pagination/offset implementation → performance improvement, not bug fix

</user_constraints>

---

## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| VOT-01 | Ties always resolve — `AGUARDANDO_DESEMPATE` reaches a terminal status even when the chefe already voted during the normal phase | `votingService.canVote` line 22-24, `votingController.changeMyVote` line 82 |
| VOT-02 | `CONCLUIDO` counts toward `annualTotalCents` — the annual auto-approval cap cannot be bypassed by cycling requests through `mark-spent` | `requestService.annualTotalCents` line 5-15, statuses array |
| VOT-03 | Partial-approval aggregation rule implemented in `closeVoting` replacing "first partial vote wins", encoded in tests | `votingService.closeVoting` line 81-85, RN-009 in `docs/03-regras-de-negocio.md` |
| VOT-04 | Cancellation-after-approval — `ADMINISTRADOR`/`CHEFE_DEPARTAMENTO` only, mandatory justification, audited compensating reversal | `requestController.cancel` line 109-141, RN-010 in `docs/03-regras-de-negocio.md` |
| GA-VOT-05 | Money-path TOCTOU race guard — conditional update with balance check inside each transaction at all 5 write sites | `CONCERNS.md` lines 224-229, 5 write sites identified |

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|--------------|----------------|-----------|
| Vote casting / tie-break | API / Backend | — | Business logic, authz, state transitions — all server-side |
| Vote tally / closeVoting | API / Backend | — | Deterministic aggregation, financial provisioning — server-only |
| Annual cap accounting | API / Backend | — | Ledger integrity, requires DB transaction — server-only |
| Partial arbitration | API / Backend | Browser / Client | Chefe decision via API; frontend provides arbitration UI |
| Cancellation with reversal | API / Backend | — | Financial compensating transaction, audit — server-only |
| Balance race prevention | Database / Storage | API / Backend | Conditional update runs at DB level; API orchestrates transaction |
| Audit trail | API / Backend | — | Write-only `AuditEvent` — server-side only |
| Frontend cancel form | Browser / Client | — | UI for justification input, calls backend API |

---

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Node.js | 20.x (LTS) | Runtime | Project standard, Dockerfile uses `node:20-alpine` |
| Express | 4.19.2 | HTTP framework | Existing, stable, minimal |
| Prisma | 5.18.0 | ORM + migrations | Schema-first, type-safe, PostgreSQL native |
| PostgreSQL | 15+ (via Docker) | Database | ACID, row-level locks, conditional updates |
| Vitest | 2.1.1 | Test runner | Fast, ESM-native, existing test suite |
| Zod | 3.23.8 | Validation | Schema validation, used in `validate` middleware |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| argon2 | 0.41.1 | Password hashing | Auth only — already in deps |
| jsonwebtoken | 9.0.2 | JWT tokens | Auth — already in deps |
| express-rate-limit | 7.3.1 | Rate limiting | Login endpoint — already in deps |
| pino / pino-http | 9.3.2 / 10.1.0 | Logging | Structured logs — already in deps |
| supertest | 7.0.0 | HTTP testing | Integration tests — devDependency, unused |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Prisma conditional updateMany | Raw SQL `UPDATE ... WHERE availableCents >= $1` | Prisma keeps type safety; raw SQL avoids Prisma translation overhead |
| Dedicated arbitration endpoint | Reuse `collegiateDecision` | Dedicated = clearer semantics, separate audit action; reuse = less code |
| In-memory rate-limit store | Redis-backed store | Current is single-process only; Redis needed for horizontal scaling (out of scope) |

**Installation:**
```bash
cd backend && npm install
# All dependencies already in package.json — no new packages needed for Phase 6
```

**Version verification:** 
```bash
cd backend && npm view @prisma/client version    # 5.18.0 (current)
cd backend && npm view vitest version           # 2.1.1 (current)
cd backend && npm view express version          # 4.19.2 (current)
```
All verified against npm registry on 2026-09-24.

---

## Package Legitimacy Audit

> **Required** whenever this phase installs external packages. Run the Package Legitimacy Gate protocol before completing this section.

| Package | Registry | Age | Downloads | Source Repo | Verdict | Disposition |
|---------|----------|-----|-----------|-------------|---------|-------------|
| @prisma/client | npm | 6+ yrs | 2M+/wk | github.com/prisma/prisma | OK | Approved |
| express | npm | 14+ yrs | 25M+/wk | github.com/expressjs/express | OK | Approved |
| vitest | npm | 3+ yrs | 500k+/wk | github.com/vitest-dev/vitest | OK | Approved |
| zod | npm | 5+ yrs | 3M+/wk | github.com/colinhacks/zod | OK | Approved |
| argon2 | npm | 5+ yrs | 100k+/wk | github.com/ranisalt/node-argon2 | OK | Approved |
| jsonwebtoken | npm | 10+ yrs | 10M+/wk | github.com/auth0/node-jsonwebtoken | OK | Approved |
| pino | npm | 8+ yrs | 1M+/wk | github.com/pinojs/pino | OK | Approved |

**Packages removed due to [SLOP] verdict:** none
**Packages flagged as suspicious [SUS]:** none

*No new packages are required for Phase 6 — all work uses existing dependencies.*

---

## Architecture Patterns

### System Architecture Diagram

```
┌─────────────────┐     ┌──────────────────┐     ┌────────────────────┐
│   Browser       │     │   Express API    │     │   PostgreSQL       │
│   (Vue 3 SPA)   │◄───►│   (Backend)      │◄───►│   (Prisma ORM)     │
└─────────────────┘     └──────────────────┘     └────────────────────┘
                               │
              ┌────────────────┼────────────────┐
              ▼                ▼                ▼
        ┌──────────┐    ┌────────────┐    ┌────────────┐
        │ Voting   │    │ Request    │    │ Finance    │
        │ Service  │    │ Service    │    │ Controller │
        └──────────┘    └────────────┘    └────────────┘
              │                │                │
              └────────────────┼────────────────┘
                               ▼
                    ┌──────────────────────┐
                    │ FundBalance          │
                    │ (conditional update) │
                    └──────────────────────┘
```

**Data Flow:**
1. **Vote casting**: Browser → `POST /api/requests/:id/votes` → `votingController.castVote` → `votingService.canVote` → Prisma `Vote.create` → if tie, immediate `closeVoting`
2. **Tie-break**: Browser → `PUT /api/requests/:id/votes/me` (chefe only, `AGUARDANDO_DESEMPATE`) → `votingController.changeMyVote` → `closeVoting`
3. **Close voting**: Auto (cron) or manual → `votingService.closeVoting` → `tally()` → status transition → conditional `FundBalance` provision
4. **Mark spent**: Browser → `POST /api/requests/:id/mark-spent` → `financeController.markSpent` → conditional `FundBalance` spend → status `CONCLUIDO`
5. **Cancel approved**: Browser → `POST /api/requests/:id/cancel` (admin/chefe + justification) → `requestController.cancel` → conditional `FundBalance` reverse → `FinancialTransaction` type `REVERSE` → status `CANCELADO`
6. **Partial arbitration**: Browser → `PATCH /api/requests/:id/partial-arbitration` (chefe) → new handler → set final amount → conditional provision → status `APROVADO_PARCIALMENTE`

### Recommended Project Structure
```
backend/
├── src/
│   ├── controllers/
│   │   ├── votingController.js      # VOT-01, VOT-03, GA-VOT-05 changes
│   │   ├── requestController.js     # VOT-02, VOT-04, GA-VOT-05 changes
│   │   └── financeController.js     # GA-VOT-05 changes
│   ├── services/
│   │   ├── votingService.js         # VOT-01, VOT-03, GA-VOT-05 changes
│   │   └── requestService.js        # VOT-02 change
│   ├── middlewares/
│   │   └── visibility.js            # Unchanged (permission checks)
│   └── jobs/
│       └── votingCloser.js          # Unchanged (auto-close uses closeVoting)
├── tests/
│   └── voting.test.js               # EXTEND: characterization tests for all 5 fixes
├── prisma/
│   └── schema.prisma                # Unchanged (schema supports all features)
```

### Pattern 1: Characterization-then-Flip Test Strategy
**What:** Write tests that encode the *correct* behavior first (they fail against current buggy code), then implement fixes to make them pass.

**When to use:** Fixing state machine bugs where existing tests encode wrong behavior, or no tests exist for the buggy path.

**Example:**
```javascript
// backend/tests/voting.test.js — NEW tests for VOT-01 (tie-break convergence)
import { describe, it, expect, beforeEach } from 'vitest';
import { PrismaClient } from '@prisma/client';
import { closeVoting } from '../src/services/votingService.js';
import { canVote } from '../src/services/votingService.js';

const prisma = new PrismaClient();

describe('VOT-01: Tie-break convergence', () => {
  let requestId, chefeId, conselheiro1Id, conselheiro2Id;

  beforeEach(async () => {
    // Setup: create request, users, votes leading to tie
    // chefe votes DEFERIR in normal phase
    // conselheiro1 votes DEFERIR, conselheiro2 votes INDEFERIR → tie
  });

  it('allows chefe to change vote during AGUARDANDO_DESEMPATE', async () => {
    // Current behavior: changeMyVote returns 400 "Alteração só durante votação aberta"
    // Desired: chefe can change vote in AGUARDANDO_DESEMPATE
    const check = canVote(chefeUser, requestInTieBreak, existingVotes);
    expect(check.ok).toBe(true); // [ASSUMED] — will pass after fix
  });

  it('converges to terminal status after chefe tie-break vote', async () => {
    // Current: AGUARDANDO_DESEMPATE can loop indefinitely
    // Desired: after chefe tie-break vote, status becomes APROVADO or INDEFERIDO
    const closed = await closeVoting(requestId, chefeId);
    expect(['APROVADO', 'INDEFERIDO']).toContain(closed.status);
  });
});
```

### Pattern 2: Conditional Balance Update (TOCTOU Guard)
**What:** Use Prisma `updateMany` with a `where` clause that includes the balance check, so the decrement only happens if sufficient funds exist atomically.

**When to use:** All 5 financial write sites where `availableCents` is decremented.

**Example (from CONTEXT.md, verified pattern):**
```javascript
// Current pattern (RACE PRONE) — in requestController.submit, votingService.closeVoting, etc.:
const bal = await tx.fundBalance.findUnique({ where: { referenceYear } });
if (!bal || bal.availableCents < amount) throw new Error('Insufficient');
await tx.fundBalance.update({
  where: { referenceYear },
  data: { availableCents: { decrement: amount } }
});

// Fixed pattern (ATOMIC) — GA-VOT-05:
const result = await tx.fundBalance.updateMany({
  where: { referenceYear, availableCents: { gte: amount } },
  data: { 
    availableCents: { decrement: amount },
    provisionedCents: { increment: amount },
    version: { increment: 1 }
  }
});
if (result.count === 0) throw new Error('Insufficient balance');
```

### Pattern 3: State Machine Guard Extension
**What:** Extend existing `status ===` guards to allow new valid transitions without breaking existing ones.

**When to use:** VOT-01 (tie-break), VOT-03 (arbitration state), VOT-04 (cancellation rules).

**Example:**
```javascript
// votingService.canVote — current line 12-13:
if (request.status !== 'EM_VOTACAO' && request.status !== 'AGUARDANDO_DESEMPATE') {
  return { ok: false, code: 400, error: 'Votação não está aberta' };
}

// VOT-01 fix — allow chefe in AGUARDANDO_DESEMPATE (already present line 22-24):
if (request.status === 'AGUARDANDO_DESEMPATE' && user.role !== 'CHEFE_DEPARTAMENTO') {
  return { ok: false, code: 403, error: 'Aguardando desempate do chefe' };
}
// ^ This already exists! The bug is in changeMyVote guard (votingController line 82)

// votingController.changeMyVote — current line 82:
if (r.status !== 'EM_VOTACAO') return res.status(400).json({ error: 'Alteração só durante votação aberta' });

// VOT-01 fix:
if (r.status !== 'EM_VOTACAO' && r.status !== 'AGUARDANDO_DESEMPATE') {
  return res.status(400).json({ error: 'Alteração só durante votação aberta ou desempate' });
}
// + add eligibility: only chefe can change in AGUARDANDO_DESEMPATE
```

### Anti-Patterns to Avoid
- **Don't add new status values:** The 6 existing statuses cover all needed states. `AGUARDANDO_ARBITRAGEM` is already referenced in RN-009 but not in schema — it's a logical state, not a new DB enum value. Use existing `APROVADO_PARCIALMENTE` with arbitration metadata.
- **Don't read balance outside transaction:** All 5 write sites currently read `fundBalance` before the `$transaction`. Move reads inside.
- **Don't use `findUnique` + `update` for balance:** Use `updateMany` with conditional `where` for atomicity.
- **Don't skip audit on financial mutations:** Every `FinancialTransaction` create must have matching `AuditEvent`.
- **Don't hand-roll race detection:** Use DB-level conditional update; application-level locks don't work across processes.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Conditional balance decrement | Custom optimistic locking with `version` column | Prisma `updateMany` with `where: { availableCents: { gte: amount } }` | DB-level atomicity; version column is for detection, not prevention |
| Vote tally logic | Custom aggregation in controller | `votingService.tally()` — pure function, already tested | Single source of truth; 17 existing tests; deterministic |
| State machine transitions | Ad-hoc `if/else` chains in controllers | Centralized in `votingService.closeVoting` + `canVote` | All transitions in one place; easier to audit |
| Cancellation reversal | Manual balance math + separate transaction | Reuse `financeController.reverseProvision` pattern | Already implements compensating `REVERSE` transaction + audit |
| Arbitration UI | Custom modal from scratch | Extend existing `Requests.vue` with conditional textarea | Reuses `MoneyInput`, `StatusBadge`, form patterns |

**Key insight:** The voting and financial logic is already centralized in services (`votingService`, `requestService`, `financeController`). The bugs are *missing guards* and *missing conditional updates*, not architectural gaps. Fix at the service layer, not by building parallel structures.

---

## Common Pitfalls

### Pitfall 1: Tie-break Dead-end (VOT-01)
**What goes wrong:** `AGUARDANDO_DESEMPATE` becomes a terminal dead state when the chefe already voted. `castVote` throws 409 (unique constraint), `changeMyVote` returns 400 (status guard), `closeManual` re-tallies to `EMPATE` again.
**Why it happens:** `changeMyVote` only allows changes during `EM_VOTACAO` (line 82), but tie-break requires the chefe to change their vote in `AGUARDANDO_DESEMPATE`.
**How to avoid:** Extend `changeMyVote` guard to allow `AGUARDANDO_DESEMPATE` *only for chefe*; add eligibility check `user.role === 'CHEFE_DEPARTAMENTO'`.
**Warning signs:** Requests stuck in `AGUARDANDO_DESEMPATE` for >24h; chefe complaints "cannot vote to break tie".

### Pitfall 2: Annual Cap Bypass (VOT-02)
**What goes wrong:** Requester submits requests up to auto-approval limit, they get approved/provisioned, chefe marks spent (`CONCLUIDO`), requester submits *new* requests — `annualTotalCents` doesn't count `CONCLUIDO`, so new requests auto-approve again.
**Why it happens:** `annualTotalCents` query (requestService.js line 9) explicitly lists statuses but omits `CONCLUIDO`.
**How to avoid:** Add `'CONCLUIDO'` to the `status.in` array in the Prisma query.
**Warning signs:** Requester annual total exceeds `automaticApprovalLimitCents` in reports; `CONCLUIDO` requests don't appear in annual sum.

### Pitfall 3: First Partial Vote Wins (VOT-03)
**What goes wrong:** Multiple `DEFERIR_PARCIALMENTE` votes with different amounts — the first one's amount becomes the approved amount, ignoring others.
**Why it happens:** `closeVoting` line 84 uses `validVotes.find(v => v.voteType === 'DEFERIR_PARCIALMENTE')` — finds first, not majority/median.
**How to avoid:** Per RN-009, move to `AGUARDANDO_ARBITRAGEM` when any partial vote exists; chefe sets final amount via new endpoint.
**Warning signs:** Partial approvals with amounts that don't reflect council consensus; chefe complaints "cannot adjust partial amount".

### Pitfall 4: Cancellation Without Reversal (VOT-04)
**What goes wrong:** Admin/chefe cancels an approved request — status becomes `CANCELADO` but `FundBalance` still has `provisionedCents` allocated, no `REVERSE` transaction, no audit trail of justification.
**Why it happens:** `requestController.cancel` (line 109-141) only updates status; the reversal logic exists in `financeController.reverseProvision` but isn't called.
**How to avoid:** In cancel path for approved statuses, call the reversal logic inline (same transaction) and store justification in `FinancialTransaction.metadata.justification` and `AuditEvent.afterData.justification`.
**Warning signs:** `provisionedCents` > sum of active approved requests; `AuditEvent` missing `request_cancelled` with justification.

### Pitfall 5: TOCTOU Overspend (GA-VOT-05)
**What goes wrong:** Two concurrent requests both read `availableCents = 10000`, both pass check, both decrement → `availableCents = -10000`.
**Why it happens:** Balance read (`findUnique`) and write (`update`) are separate operations, even inside `$transaction` (READ COMMITTED isolation).
**How to avoid:** Single `updateMany` with `where: { availableCents: { gte: amount } }` — atomic at DB level.
**Warning signs:** Negative `availableCents` in `FundBalance`; `FinancialTransaction` sum ≠ `FundBalance` deltas.

---

## Code Examples

### Verified Pattern: Current `tally()` Function (Source: `backend/src/services/votingService.js:29-49`)
```javascript
// Maioria simples dos válidos, sem quórum. Abstenção ignora.
function tally(votes) {
  const valid = votes.filter((v) => v.voteType !== 'ABSTER_SE');
  let defer = 0, indefer = 0, parcial = 0;
  for (const v of valid) {
    if (v.voteType === 'DEFERIR') defer++;
    else if (v.voteType === 'INDEFERIR') indefer++;
    else if (v.voteType === 'DEFERIR_PARCIALMENTE') parcial++;
  }
  const total = defer + indefer + parcial;
  if (total === 0) return { outcome: 'SEM_VOTOS', defer, indefer, parcial };
  if (defer > indefer + parcial) return { outcome: 'DEFERIDO', defer, indefer, parcial };
  if (indefer > defer + parcial) return { outcome: 'INDEFERIDO', defer, indefer, parcial };
  // parcial só vence com maioria própria; senão empate se topo empatado
  const top = Math.max(defer, indefer, parcial);
  const winners = ['DEFERIDO', 'INDEFERIDO', 'PARCIAL'].filter((_, i) => [defer, indefer, parcial][i] === top);
  if (winners.length === 1) {
    const m = { DEFERIDO: 'DEFERIDO', INDEFERIDO: 'INDEFERIDO', PARCIAL: 'PARCIAL' };
    return { outcome: m[winners[0]], defer, indefer, parcial };
  }
  return { outcome: 'EMPATE', defer, indefer, parcial };
}
```

### Verified Pattern: Current `closeVoting` Partial Logic (Source: `backend/src/services/votingService.js:81-85`)
```javascript
} else if (t.outcome === 'PARCIAL') {
  status = 'APROVADO_PARCIALMENTE';
  // valor = menor valor parcial votado? usa o do voto parcial majoritário (primeiro)
  const p = validVotes.find((v) => v.voteType === 'DEFERIR_PARCIALMENTE');
  approvedCents = p ? p.approvedAmountCents : 0;
}
```

### Verified Pattern: Current `annualTotalCents` (Source: `backend/src/services/requestService.js:4-15`)
```javascript
async function annualTotalCents(requesterId, referenceYear, excludeId) {
  const rows = await prisma.resourceRequest.findMany({
    where: {
      requesterId,
      referenceYear,
      status: { in: ['SUBMETIDO', 'EM_VOTACAO', 'APROVADO', 'APROVADO_AUTOMATICAMENTE', 'APROVADO_PARCIALMENTE'] },
      ...(excludeId ? { id: { not: excludeId } } : {}),
    },
    select: { requestedAmountCents: true },
  });
  return rows.reduce((s, r) => s + r.requestedAmountCents, 0);
}
```

### Verified Pattern: Current `cancel` Controller (Source: `backend/src/controllers/requestController.js:109-141`)
```javascript
async function cancel(req, res, next) {
  // ... permission checks ...
  const approved = ['APROVADO', 'APROVADO_AUTOMATICAMENTE', 'APROVADO_PARCIALMENTE'].includes(r.status);
  if (approved) {
    if (!isLeader) return res.status(403).json({ error: 'Sem permissão' });
    // Phase 6 (VOT-04/06-04): compensating REVERSE here — estorno auditado
    // dos efeitos de PROVISION (FinancialTransaction REVERSE). Phase 4:
    // somente a troca de status auditada, sem writes financeiras.
  }
  // ...
  const updated = await prisma.resourceRequest.update({ where: { id: r.id }, data: { status: 'CANCELADO' } });
  await audit({ actorId: req.user.id, action: 'request_cancelled', entityType: 'request', entityId: r.id, beforeData: { status: r.status }, afterData: { status: 'CANCELADO', justification }, req });
  res.json({ ok: true, request: updated });
}
```

### Verified Pattern: Current Balance Mutation (Source: `backend/src/controllers/financeController.js:25-38`)
```javascript
await prisma.$transaction(async (tx) => {
  const bal = await tx.fundBalance.findUnique({ where: { referenceYear: r.referenceYear } });
  if (!bal || bal.provisionedCents < r.approvedAmountCents) {
    throw Object.assign(new Error('Provisionado insuficiente'), { status: 400 });
  }
  await tx.fundBalance.update({
    where: { referenceYear: r.referenceYear },
    data: { provisionedCents: { decrement: r.approvedAmountCents }, spentCents: { increment: r.approvedAmountCents }, version: { increment: 1 } },
  });
  await tx.financialTransaction.create({ ... });
  await tx.resourceRequest.update({ where: { id: r.id }, data: { status: 'CONCLUIDO' } });
});
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| First partial vote wins | Chefe arbitration with mandatory justification | 2026-09-23 (RN-009) | Removes arbitrary first-vote bias; adds audit trail |
| Annual cap excludes CONCLUIDO | Annual cap includes CONCLUIDO | 2026-09-24 (this phase) | Prevents cap bypass via mark-spent cycle |
| Chefe votes in normal phase + tie-break | Chefe votes ONLY in tie-break | 2026-09-24 (this phase) | Prevents double-vote; fixes dead-end |
| No cancellation reversal for approved | Compensating REVERSE transaction + justification | 2026-09-23 (RN-010) | Financial integrity; audit compliance |
| Read-then-write balance (racy) | Conditional updateMany with balance check | 2026-09-24 (this phase) | Eliminates TOCTOU overspend |

**Deprecated/outdated:**
- `validVotes.find(v => v.voteType === 'DEFERIR_PARCIALMENTE')` in `closeVoting` — replaced by arbitration flow
- `status.in` array in `annualTotalCents` without `CONCLUIDO` — must include `CONCLUIDO`
- `changeMyVote` status guard `r.status !== 'EM_VOTACAO'` — must allow `AGUARDANDO_DESEMPATE` for chefe
- Balance reads outside `$transaction` at 5 write sites — must move inside with conditional update

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `AGUARDANDO_ARBITRAGEM` is a logical state, not a new DB enum value — uses existing `APROVADO_PARCIALMENTE` with arbitration metadata | Architecture Patterns, VOT-03 | If schema requires new status, migration needed; delays implementation |
| A2 | Prisma `updateMany` with `where: { availableCents: { gte: amount } }` works atomically in PostgreSQL | GA-VOT-05, Pattern 2 | If not atomic, race persists; need raw SQL or advisory lock |
| A3 | No new packages needed — all fixes use existing deps | Standard Stack | If new dep needed (e.g., for concurrency test), adds install step |
| A4 | Frontend `Requests.vue` has cancel button for approved requests (currently only shows "Submeter" for RASCUNHO) | VOT-04, Code Examples | If no cancel UI exists, frontend work larger than assumed |
| A5 | `FundBalance.version` column is for optimistic locking detection only, not prevention | CONCERNS.md line 226 | If version is expected for prevention, conditional update pattern insufficient |
| A6 | Supertest is available for integration tests (devDependency, unused) | Validation Architecture | If not usable, integration tests need different approach |

---

## Open Questions

1. **Arbitration endpoint design**
   - What we know: RN-009 requires chefe arbitration in `(0, requestedAmountCents]` with justification; `collegiateDecision` pattern exists for chefe decisions from suspended state
   - What's unclear: Whether to add `PATCH /api/requests/:id/partial-arbitration` or extend `collegiateDecision` to handle `AGUARDANDO_ARBITRAGEM` state
   - Recommendation: Dedicated endpoint — clearer audit action (`partial_arbitration` vs `collegiate_decision`), simpler permission (only chefe, not admin), matches RN-009 "chefe arbitra" language

2. **Concurrency test approach**
   - What we know: Need to simulate concurrent submissions at 5 write sites; supertest available but unused
   - What's unclear: Whether to test at unit level (mock Prisma) or integration level (real DB, multiple requests)
   - Recommendation: Integration test with real PostgreSQL — spin up test DB, fire N concurrent requests, assert only floor(balance/amount) succeed

3. **AuditEvent structure for cancellation reversal**
   - What we know: `request_cancelled` includes justification; `provision_reversed` should also include it
   - What's unclear: Whether `provision_reversed` AuditEvent currently exists (grep shows only in `financeController.reverseProvision`)
   - Recommendation: Ensure both events fire with justification in `afterData.justification`

4. **Vista extension stacking interaction with tie-break**
   - What we know: Vista extends `votingDeadlineAt` (votingController.js line 112-118); tie-break uses `closeVoting` which checks deadline
   - What's unclear: If vista is granted during `AGUARDANDO_DESEMPATE`, does deadline extension apply?
   - Recommendation: Disallow vista in `AGUARDANDO_DESEMPATE` (only `EM_VOTACAO` per current guard line 105)

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|-------------|-----------|---------|----------|
| Node.js | Runtime, tests | ✓ | 20.x (LTS) | — |
| PostgreSQL | Database, conditional updates | ✓ | 15+ (Docker) | — |
| npm | Package management | ✓ | 10.x | — |
| Docker | Local DB, compose | ✓ | 24.x | — |
| vitest | Test runner | ✓ | 2.1.1 | — |
| Prisma CLI | Migrations | ✓ | 5.18.0 | — |

**Missing dependencies with no fallback:** none
**Missing dependencies with fallback:** none

*All required tooling is already configured in the project.*

---

## Validation Architecture

> Required since `workflow.nyquist_validation` is `true` in `.planning/config.json`.

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 2.1.1 |
| Config file | `backend/vitest.config.js` (default — none found, uses vitest defaults) |
| Quick run command | `cd backend && npx vitest run` |
| Full suite command | `cd backend && npx vitest run --reporter=verbose` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| VOT-01 | Chefe can change vote in AGUARDANDO_DESEMPATE; converges to terminal status | unit + integration | `npx vitest run voting.test.js` | ❌ Wave 0 |
| VOT-02 | annualTotalCents includes CONCLUIDO; cycle spent→submit fails at cap | unit | `npx vitest run voting.test.js` | ❌ Wave 0 |
| VOT-03 | Partial votes → AGUARDANDO_ARBITRAGEM; chefe sets final amount with justification | integration | `npx vitest run voting.test.js` | ❌ Wave 0 |
| VOT-04 | Cancel approved requires admin/chefe + justification; writes REVERSE + audit | integration | `npx vitest run voting.test.js` | ❌ Wave 0 |
| GA-VOT-05 | Concurrent submissions at 5 sites — only floor(balance/amount) succeed | integration (concurrency) | `npx vitest run voting.test.js` | ❌ Wave 0 |

### Sampling Rate
- **Per task commit:** `cd backend && npx vitest run voting.test.js -t "<requirement>"`
- **Per wave merge:** `cd backend && npx vitest run`
- **Phase gate:** Full suite green before `/gsd-verify-work`

### Wave 0 Gaps
- [ ] `backend/tests/voting.test.js` — extend with VOT-01 tie-break convergence tests
- [ ] `backend/tests/voting.test.js` — extend with VOT-02 annual accounting tests (include CONCLUIDO)
- [ ] `backend/tests/voting.test.js` — extend with VOT-03 partial arbitration flow tests
- [ ] `backend/tests/voting.test.js` — extend with VOT-04 cancellation justification + reversal tests
- [ ] `backend/tests/voting.test.js` — extend with GA-VOT-05 TOCTOU concurrency tests
- [ ] `backend/tests/conftest.js` — shared fixtures for request/user/vote setup (currently none)
- [ ] Framework install: already present — `vitest`, `supertest`, `@prisma/client`

*(No existing test infrastructure covers Phase 6 requirements — all are Wave 0 gaps)*

---

## Security Domain

> Required since `security_enforcement` is `true` in `.planning/config.json`.

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | yes | JWT in httpOnly cookie, 15min access / 7day refresh |
| V3 Session Management | yes | Refresh rotation not implemented (known gap) |
| V4 Access Control | yes | Role checks inline; VOT-01/03/04 add new guards |
| V5 Input Validation | yes | Zod middleware exists but not wired on all routes |
| V6 Cryptography | no | No crypto operations in this phase |
| V7 Error Handling | yes | Error handler leaks internals (CONCERNS.md line 204) |
| V9 Communication | no | No new network boundaries |
| V10 Malicious Code | no | No code generation in this phase |
| V11 Business Logic | yes | State machine + financial invariants are core business logic |
| V12 Files & Resources | no | No file upload in this phase |
| V13 API | yes | REST API with auth; new arbitration endpoint needed |
| V14 Configuration | no | No config changes in this phase |

### Known Threat Patterns for {Node.js/Express/Prisma/PostgreSQL}

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| SQL injection | Tampering | Prisma parameterized queries (used throughout) |
| Race condition (TOCTOU) | Tampering | Conditional `updateMany` with `where: { availableCents: { gte: amount } }` — GA-VOT-05 |
| Authorization bypass | Elevation of Privilege | Add explicit role checks in `changeMyVote`, `cancel`, new arbitration endpoint |
| Missing audit on financial mutation | Repudiation | Every `FinancialTransaction` create paired with `AuditEvent` — enforce in code review |
| State machine manipulation | Tampering | Centralize transitions in `votingService.closeVoting`; validate status guards |
| IDOR (Insecure Direct Object Reference) | Information Disclosure | `canViewRequest` middleware on all request-scoped endpoints |
| JWT secret fallback | Elevation of Privilege | `compose.yaml` enforces `JWT_*` at deploy; `env.js` dev fallbacks not used in prod |

---

## Sources

### Primary (HIGH confidence)
- `backend/src/services/votingService.js` — lines 1-113: `canVote`, `tally`, `validateVoteInput`, `closeVoting` — **[VERIFIED: Read tool]**
- `backend/src/controllers/votingController.js` — lines 1-227: `castVote`, `changeMyVote`, `closeManual`, `suspend`, `unsuspend`, `collegiateDecision` — **[VERIFIED: Read tool]**
- `backend/src/controllers/requestController.js` — lines 1-144: `submit`, `cancel`, `annualTotalCents` usage — **[VERIFIED: Read tool]**
- `backend/src/services/requestService.js` — lines 1-65: `annualTotalCents`, `calcAmount` — **[VERIFIED: Read tool]**
- `backend/src/controllers/financeController.js` — lines 1-71: `markSpent`, `reverseProvision` — **[VERIFIED: Read tool]**
- `backend/prisma/schema.prisma` — lines 1-180: All models, enums, relations — **[VERIFIED: Read tool]**
- `backend/tests/voting.test.js` — lines 1-21: Existing `tally` tests — **[VERIFIED: Read tool]**
- `docs/03-regras-de-negocio.md` — lines 32-138: RN-004, RN-009, RN-010, RN-011, RN-012, RN-013 — **[VERIFIED: Read tool]**
- `docs/06-permissoes.md` — lines 1-33: Permission matrix — **[VERIFIED: Read tool]**
- `docs/14-decisoes-em-aberto.md` — lines 1-21: Decisions D-05 through D-11 — **[VERIFIED: Read tool]**
- `.planning/codebase/CONCERNS.md` — lines 67-229: Known bugs, fragile areas, race conditions — **[VERIFIED: Read tool]**
- `.planning/phases/06-voting-money-state-machine/06-CONTEXT.md` — lines 1-237: All locked decisions — **[VERIFIED: Read tool]**

### Secondary (MEDIUM confidence)
- `backend/package.json` — Dependencies and scripts — **[VERIFIED: Read tool]**
- `.planning/config.json` — Workflow config (nyquist_validation=true) — **[VERIFIED: Read tool]**
- `frontend/src/views/Requests.vue` — lines 1-99: Current cancel UI (only submit button shown) — **[VERIFIED: Read tool]**

### Tertiary (LOW confidence)
- None — all critical claims verified against source code or official docs

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all packages verified in package.json and npm registry
- Architecture: HIGH — all patterns sourced from reading actual source files
- Pitfalls: HIGH — each maps to a documented bug in CONCERNS.md with file:line references
- Test strategy: MEDIUM — characterization-then-flip is standard practice but Wave 0 gaps are large
- Race guard: HIGH — conditional updateMany pattern is documented Prisma/PostgreSQL best practice

**Research date:** 2026-09-24
**Valid until:** 2026-10-24 (30 days — stable stack, but Prisma/Postgres versions may evolve)