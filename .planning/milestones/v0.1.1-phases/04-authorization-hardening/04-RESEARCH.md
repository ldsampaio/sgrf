# Phase 04: Authorization Hardening - Research

**Researched:** 2026-09-24
**Domain:** Express server-side authorization (deny-by-default permission map + row-level ownership) + supertest allow/deny matrix
**Confidence:** HIGH (code facts verified by direct reads this session; test strategy grounded in Prisma official testing series)

## Summary

Phase 4 closes the "auth-only default" hole: today every route file mounts `router.use(authJwt)` and only `users.routes.js` adds any `requireRole` gate, leaving `cancel`, message `remove`, `getOne`/`list` scoping, `listVotes`, reports `voting`, and `force-password-reset` target checks enforced nowhere or only inline. The fix is a static `PERMISSIONS` map + `requirePermission(action)` middleware factory (mirroring the existing `requireRole` shape in `middlewares/auth.js`) wired per-route, plus a shared request-visibility helper reused by `requestController` and `reports.scopeFilter`, plus owner/target guards in the four controllers that need row-level data (`requestController.cancel`, `deliberationController.remove`, `userController.resendInvite` via `canManageUsers`, `votingController.listVotes` via view-scope).

Two findings change the plan shape versus CONTEXT assumptions. First, settings `transactions` view is **already open** — neither the route nor the controller has any role gate — so D-10's "loosen the view gate" is a verify-and-lock no-op, not a code change (the leaders-only gates that exist are on `patchFinancial`/`patchBalance`). Second, CI's backend job has **no Postgres service** (only a dummy `DATABASE_URL` string), so a real-DB supertest matrix would require changing the CI workflow; the mock-Prisma (`vi.mock` of `src/config/db.js`) story runs with zero infra changes and directly tests the permission layer, which is the point of this phase.

**Primary recommendation:** Build `middlewares/permissions.js` with a static role map + `requirePermission(action)` (403 on undeclared action), centralize the draft-visibility rule in one `canViewRequest` helper used by `getOne`/`list`/`listVotes`/reports, add the four row-level guards, and cover it all with a mock-Prisma supertest matrix plus a router-stack coverage test proving every route declares a permission.

## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-01:** Votes are fully transparent: anyone who can view the request sees individual votes (voter identity + value) in real time, including while voting is open, and the requester sees full detail on their own request.
- **D-02:** `listVotes` therefore enforces view-scope, not voter-role: any role with `getOne`/`list` visibility on the request gets full vote detail. No tally-only redaction layer.
- **D-03:** PROFESSOR and ALUNO see everything except drafts (RASCUNHO): own requests + all non-draft requests. ALUNO parity with PROFESSOR here **overrides** `docs/06` matrix row "Visualizar pedidos em votação: Não" — the planner must update that row instead of implementing it.
- **D-04:** Drafts (RASCUNHO) are visible only to the owner + ADMINISTRADOR/CHEFE_DEPARTAMENTO. CONSELHEIRO sees a request from submission onward.
- **D-05:** Financial fields (amounts) follow view scope: anyone who can view the request sees its amounts. No separate amount-redaction layer.
- **D-06:** Ordinary (non-approved) cancel: owner + ADMINISTRADOR/CHEFE_DEPARTAMENTO, with mandatory justification (audited). Same justification discipline as the Phase 2 after-approval path (RN-010), applied to ordinary cancel.
- **D-07:** Message remove: author + ADMINISTRADOR + CHEFE_DEPARTAMENTO, no time window — removal is allowed any time because the audit trail already preserves the record.
- **D-08:** Deny style is split: 403 for wrong role on a visible route/scope, 404 when the resource is outside the caller's scope (hides existence).
- **D-09:** Chefe "limitada" audit means own-scope events: CHEFE_DEPARTAMENTO sees audit events for requests/users in their scope, not system-wide.
- **D-10:** Settings financial transactions are viewable by everyone but editable only by leaders (ADMINISTRADOR/CHEFE_DEPARTAMENTO). This **differs** from current controller code, which restricts view to leaders — the view gate must be loosened while the mutation gate stays.
- **D-11:** `force-password-reset` stays ADMIN + CHEFE, with chefe blocked from targeting admins via existing `canManageUsers` (matches matrix "Gerenciar usuários: Parcial").

### The Agent's Discretion
- Exact `PERMISSIONS` map key shape (action naming) and where the ownership helpers live (shared visibility helper reused by `reports.scopeFilter` per roadmap, or per-controller).
- Supertest DB story (mock Prisma vs test Postgres): spike at plan time per roadmap — planner's call, no user input needed.

### Deferred Ideas (OUT OF SCOPE)
None — discussion stayed within phase scope.

## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| SEC-01 | Every endpoint enforces the documented permission matrix server-side — `cancel`, message `remove`, `getOne`/`list` scoping, `listVotes`, settings `transactions`, `force-password-reset` guard, reports `voting` — deny-by-default via one shared permission map (transcribed from `docs/06-permissoes.md`), with row-level ownership checks in controllers | Permission-map pattern + per-endpoint guard table below; visibility helper design; mock-Prisma supertest matrix + router coverage test as regression gate |

## Project Constraints (from AGENTS.md)

- Two packages, **no workspace** — all backend commands run inside `backend/` (`cd backend && npx vitest run` for tests).
- Backend verification is `npx vitest run` only; frontend has no tests (`npm test` fails by design) — verify frontend with `npm run build`. **No lint/typecheck commands exist; do not invent them.**
- CI (`.github/workflows/ci.yml`, jobs `backend` + `frontend`) is the required regression gate on `main` — new tests must run under the existing `npx vitest run` invocation with no new workflow services if avoidable.
- Prisma/Postgres conventions: **no raw SQL**; IDs are UUID strings; **money is integer cents**.
- Auth: `@utfpr.edu.br` only; JWT in httpOnly cookie; frontend `axios` `baseURL: '/api'` + `withCredentials: true`; backend CORS needs correct `FRONTEND_URL`.
- Routes mount in `backend/src/app.js` as `/api/auth|users|requests|settings|finance|messages|reports`; `GET /health` returns `{ ok: true }`.
- Never commit: `backend/.env`, `*.db*`, `backend/uploads/*`.
- Domain rules live in `docs/` (`03-regras-de-negocio.md`, `06-permissoes.md`, `07-fluxos.md`, `08-api.md`) + `backend/openapi.yaml` — consult before changing request logic.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Role gate per endpoint (`requirePermission`) | API / Backend | — | Server-side enforcement is the whole point of SEC-01; frontend role gating is cosmetic only |
| Row-level ownership / visibility (`canViewRequest`, cancel/remove guards) | API / Backend | — | Requires requesterId/status from Postgres; cannot trust client claims |
| Vote transparency scoping (`listVotes` = view-scope) | API / Backend | — | Same visibility query as `getOne`; no separate redaction tier |
| Supertest allow/deny matrix | API / Backend (test) | — | HTTP-level regression gate running in CI backend job |
| Login/session/cookie behavior | Out of scope | — | Phase 5 (SES-01) and Phase 8 (SEC-03/SES-02); do not touch `authJwt` semantics here |

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| express | 4.19.2 (pinned in `backend/package.json`) | Route wiring + middleware chain | Already the framework; `requirePermission` is a plain `(req,res,next)` factory like existing `requireRole` |
| supertest | 7.3.0 [VERIFIED: npm registry — `npm view` 2026-09-24; already in devDependencies as `^7.0.0`] | HTTP-level allow/deny matrix | Already declared; drives the `createApp()` factory without listening (ARCHITECTURE.md confirms app factory is supertest-usable) |
| vitest | ^2.1.1 (repo-pinned; do NOT upgrade to 5.x) | Test runner for the matrix | Existing `npx vitest run` CI invocation; ESM test files already import CJS sources successfully |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| jsonwebtoken | 9.0.2 (existing dep) | Sign real test tokens for matrix auth | Matrix tests sign valid `access_token` cookies per role instead of stubbing `authJwt` — exercises the real chain |
| cookie (via supertest agent / `set('Cookie', ...)`) | — | Session handling in tests | supertest `request.agent(app)` persists httpOnly cookies across login→call flows |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Mock-Prisma matrix (`vi.mock` of `src/config/db.js`) | Real test Postgres (+ CI `services:` postgres) | Real DB tests ledger/tally paths better, but changes the CI workflow shape (STATE.md blocker) and tests the wrong layer for this phase — permission decisions, not query correctness. Recommend mock for 04-03; real-DB authz tests can ride along later with finance integration suites |
| `vitest-mock-extended` deep mock | Hand-rolled `vi.fn()` mock object for `prisma` | New dep for marginal ergonomics; hand-rolled mock of only the models touched (`user`, `resourceRequest`, `vote`, `deliberationMessage`, `financialTransaction`, `$transaction`) is smaller and needs no install |

**Installation:** None. No new packages required for this phase.

**Version verification:** `supertest@7.3.0` confirmed via `npm view supertest version` 2026-09-24 [VERIFIED: npm registry]. `vitest` latest is 5.0.1 on the registry but the repo pins `^2.1.1` — do not upgrade; CI stability outranks novelty.

## Package Legitimacy Audit

No external packages are installed by this phase. `supertest` and `vitest` are pre-existing devDependencies (read in `backend/package.json` this session). **Packages removed: none. Flagged: none.**

## Architecture Patterns

### System Architecture Diagram

```text
client (cookie: access_token)
  │  GET/POST /api/...
  ▼
helmet → cors → json → cookie-parser → pino-http        (app.js, unchanged)
  ▼
authJwt  (cookie → verify → prisma.user.findUnique → req.user; 401)   (unchanged)
  ▼
requirePermission(action)  ★ NEW (middlewares/permissions.js)
  │  PERMISSIONS[action] = { roles: [...] }  → 403 + 'Sem permissão'
  │  unknown action → 403 fail-closed
  ▼
controller handler
  ├─ role-only actions → proceed (map already decided)
  └─ row-level actions → ownership helper → 403 (wrong role, visible scope)
                                                 / 404 (outside scope, D-08)
        canViewRequest(user, request)      request detail/list/listVotes/messages/reports
        cancel guard (owner/admin/chefe + justification)
        message-remove guard (author/admin/chefe)
        force-reset guard (canManageUsers actor/target)
  ▼
audit(...)  (unchanged, fail-open) → JSON response
```

### Recommended Project Structure

```text
backend/src/
├── middlewares/
│   ├── auth.js              # unchanged: authJwt, requireRole, canManageUsers
│   ├── permissions.js       # ★ NEW: PERMISSIONS map + requirePermission(action)
│   └── visibility.js        # ★ NEW (or inside permissions.js — planner's call):
│                            #   canViewRequest(user, request), scopeWhere(user, query)
├── routes/                  # wire requirePermission per action (all 6 route files)
└── controllers/             # row-level guards only (cancel, remove, resendInvite, listVotes/getOne/list)
backend/tests/
└── authz/                   # ★ NEW: matrix.test.js + route-coverage.test.js + mock db helper
```

### Pattern 1: Static PERMISSIONS map + requirePermission factory
**What:** A frozen object mapping action names to allowed roles, plus a middleware factory mirroring `requireRole`'s closure shape. Mounted per-route after `authJwt`. Unknown actions 403.
**When to use:** Every route in `requests|messages|settings|reports|users` routes. Pure role gates live entirely here; anything needing the target row stays in the controller.
**Example:**
```js
// backend/src/middlewares/permissions.js (planner: exact key names at plan time)
// Shape mirrors requireRole in backend/src/middlewares/auth.js:18-24 [VERIFIED]
const PERMISSIONS = Object.freeze({
  'requests:list':            { roles: ['ADMINISTRADOR', 'CHEFE_DEPARTAMENTO', 'CONSELHEIRO', 'PROFESSOR', 'ALUNO'] },
  'requests:get':             { roles: ['ADMINISTRADOR', 'CHEFE_DEPARTAMENTO', 'CONSELHEIRO', 'PROFESSOR', 'ALUNO'] },
  'requests:cancel':          { roles: ['ADMINISTRADOR', 'CHEFE_DEPARTAMENTO', 'CONSELHEIRO', 'PROFESSOR', 'ALUNO'] }, // + ownership guard in controller
  'votes:list':               { roles: ['ADMINISTRADOR', 'CHEFE_DEPARTAMENTO', 'CONSELHEIRO', 'PROFESSOR', 'ALUNO'] }, // + view-scope in controller (D-02)
  'votes:cast':               { roles: ['CHEFE_DEPARTAMENTO', 'CONSELHEIRO'] }, // eligibility re-checked by canVote service
  'messages:remove':          { roles: ['ADMINISTRADOR', 'CHEFE_DEPARTAMENTO', 'CONSELHEIRO', 'PROFESSOR', 'ALUNO'] }, // + author guard (D-07)
  'settings:transactions:view': { roles: ['ADMINISTRADOR', 'CHEFE_DEPARTAMENTO', 'CONSELHEIRO', 'PROFESSOR', 'ALUNO'] }, // D-10 view-open
  'settings:financial:edit':  { roles: ['ADMINISTRADOR', 'CHEFE_DEPARTAMENTO'] },
  'users:force-reset':        { roles: ['ADMINISTRADOR', 'CHEFE_DEPARTAMENTO'] }, // + canManageUsers in controller (D-11)
  'reports:voting':           { roles: ['ADMINISTRADOR', 'CHEFE_DEPARTAMENTO', 'CONSELHEIRO', 'PROFESSOR', 'ALUNO'] }, // + view-scope filter
});
function requirePermission(action) {
  return (req, res, next) => {
    const entry = PERMISSIONS[action];
    if (!entry) return res.status(403).json({ error: 'Ação não autorizada' }); // fail closed
    if (!req.user) return res.status(401).json({ error: 'Não autenticado' });
    if (!entry.roles.includes(req.user.role)) return res.status(403).json({ error: 'Sem permissão' });
    return next();
  };
}
module.exports = { PERMISSIONS, requirePermission };
```

### Pattern 2: Shared visibility helper (draft rule in one place)
**What:** `canViewRequest(user, request)` encodes D-03/D-04; `scopeWhere(user, query)` builds the Prisma `where` for `list` and replaces `reports.scopeFilter`'s divergent copy.
**When to use:** `requestController.getOne` (404 when invisible, D-08), `list`, `votingController.listVotes` (view-scope per D-02), deliberation `list`/`post` parent check, reports `voting` filter.
```js
// Drafts: owner + leaders only. Non-drafts: every authenticated role (D-03/D-04).
function canViewRequest(user, r) {
  if (!r) return false;
  if (r.status === 'RASCUNHO') {
    return String(r.requesterId) === String(user.id)
      || ['ADMINISTRADOR', 'CHEFE_DEPARTAMENTO'].includes(user.role);
  }
  return true;
}
function scopeWhere(user, q = {}) {
  const where = {};
  // PROFESSOR/ALUNO: own drafts + everything non-draft; leaders/conselheiro: all (D-03/D-04)
  if (['PROFESSOR', 'ALUNO'].includes(user.role)) {
    where.OR = [{ requesterId: user.id }, { status: { not: 'RASCUNHO' } }];
  } else if (q.mine === '1') where.requesterId = user.id;
  if (q.status) where.status = q.status;
  if (q.type) where.type = q.type;
  return where;
}
```

### Pattern 3: Router-stack coverage test (proves "undeclared fails closed")
**What:** A test that walks `app._router.stack`, collects every `route` layer, and asserts each route's handler chain contains a `requirePermission` frame (tag the middleware with `fn._permissionAction = action` at factory time). This is the executable form of success criterion 4 — a future auth-only route fails the suite.
**When to use:** `backend/tests/authz/route-coverage.test.js`, runs inside the same `npx vitest run`.

### Pattern 4: Mock-Prisma supertest matrix
**What:** `vi.mock('../src/config/db.js')`-style mock of the singleton Prisma client (the only import path controllers/services use), real JWTs signed with test secrets for the cookie, `request.agent(app)` driving allow+deny cases per role. `$transaction` mocked as `mockImplementation((cb) => cb(mockTx))` per the Prisma official testing series [CITED: prisma.io/blog/testing-series-1 + testing-series-3].
**When to use:** `backend/tests/authz/matrix.test.js` — fixed routes × 5 roles, asserting 200/201 allow paths plus 403 (wrong role) and 404 (out-of-scope) deny paths.

### Anti-Patterns to Avoid
- **Inline role arrays in controllers:** `['ADMINISTRADOR', 'CHEFE_DEPARTAMENTO'].includes(...)` is copy-pasted in ≥6 files today (finance, settings, voting, deliberation). Move pure role decisions into the map; leave only target-dependent checks (`canManageUsers`, author, owner) in controllers.
- **Redaction layers:** D-02/D-05 explicitly forbid tally-only or amount-redaction layers. View-scope is the only gate on votes and amounts.
- **Stubbing `authJwt` in matrix tests:** bypasses the real chain (cookie → user → permission). Sign real tokens instead; stub only the Prisma singleton.
- **Real-DB matrix in this phase:** requires adding a Postgres service to CI and per-test resets; defers to a later finance-integration context. Mock keeps this phase's blast radius on the permission layer.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| JWT signing/verification in tests | Custom token stub or hand-rolled crypto | Existing `backend/src/utils/tokens.js` sign functions with test secrets | Cookie shape/`sameSite`/`secure` semantics must match production or the matrix tests fiction |
| Deep Prisma mock | Hand-rolled recursive mock factory | Small explicit `vi.fn()` mock object covering only touched models, or `vitest-mock-extended` if planner prefers (single devDep) | Hand-rolled deep mocks drift from the client API; explicit narrow mocks stay readable |
| Role constants | New string literals per file | The exact 5 strings from schema comment: `ADMINISTRADOR\|CHEFE_DEPARTAMENTO\|CONSELHEIRO\|PROFESSOR\|ALUNO` [VERIFIED: backend/prisma/schema.prisma:18] | Any typo fails closed unpredictably and breaks `canManageUsers` semantics |
| Audit trail for cancel/remove | New audit mechanism | Existing `auditService.audit` (fail-open) with `request_cancelled` / `message_deleted` actions | Already the convention; audit failures must never break the guard path |

**Key insight:** Authorization fails dangerous when re-implemented per file (that's how `cancel`/`remove` shipped with zero checks). The map + one visibility helper is a consolidation, not a new system — every precedent (`requireRole`, `canManageUsers`, `scopeFilter`, `submit`'s owner check) already exists in-repo.

## Per-Endpoint Guard Table (verified current state → target)

| Endpoint | Current state [VERIFIED] | Target (map action + row guard) |
|----------|--------------------------|---------------------------------|
| `POST /api/requests/:id/cancel` | No check: `cancel` updates status directly (requestController.js:112-120) | `requests:cancel` + RN-010 matrix (owner if RASCUNHO/EM_VOTACAO; ADMIN any non-terminal; CHEFE before CONCLUIDO; justification 400; CONCLUIDO/CANCELADO immutable) + audit |
| `DELETE /api/messages/:mid` | No author/role check, only suspension (deliberationController.js:71-81) | `messages:remove` + author/admin/chefe (D-07), keep audit + suspension guard |
| `GET /api/requests/:id` (+ `/:id/history` alias) | No check, includes files+transactions (requestController.js:104-110) | `requests:get` + `canViewRequest` → 404 when invisible (D-08) |
| `GET /api/requests` | ALUNO owner-only; everyone else unfiltered (requestController.js:6-17) | `requests:list` + `scopeWhere` (PROF/ALUNO: own-or-nondraft; others: all) |
| `GET /api/requests/:id/votes` | No check at all (votingController.js:25-30) | `votes:list` + parent `canViewRequest` → 404 when invisible; full vote detail when visible (D-01/D-02) |
| `GET /api/settings/transactions` | **No gate on route or controller** (settings.routes.js:10; settingsController.js:58-63) — D-10's "loosen view" is a no-op | `settings:transactions:view` (all roles) — lock current open behavior with a test |
| `PATCH /api/settings/financial`, `PATCH /api/settings/balance` | Inline leaders-only (settingsController.js:18,39) | `settings:financial:edit` at route level; keep or remove inline check (planner's call — keep is safer) |
| `POST /api/users/:id/force-password-reset` | Route has `requireRole(admin,chefe)` (users.routes.js:15) but handler `resendInvite` has **no `canManageUsers`** — chefe can reset an admin (userController.js:68-81) | Keep route gate + add `canManageUsers(req.user, target)` in handler (D-11) + distinct audit action (`password_reset_forced` vs `invite_resent`) |
| `GET /api/reports/voting` | No gate, returns all votes+vistas (reports.routes.js:69-75) | `reports:voting` + filter to requests passing `canViewRequest` (drafts excluded unless owner/leaders) |
| `GET /api/reports/requests`, `/dashboard` | `scopeFilter` restricts PROF/ALUNO to own (reports.routes.js:10-22) | Planner decision (see Open Questions): unify with `scopeWhere` per roadmap, or keep own-only per matrix "Próprios" row |
| `PATCH /api/users/:id`, `PATCH /api/users/:id/role` | No route gate; controller `canManageUsers` (userController.js:42-66) | Declare map actions + `requirePermission` (broad roles) with controller `canManageUsers` retained as the target-dependent gate |
| `GET /api/requests/:id/messages`, `POST .../messages` | `post` excludes ALUNO inline (deliberationController.js:42-44); `list` open | Map actions; `list` gains parent `canViewRequest` check; `post` keeps role rule via map |
| Voting mutations (`castVote`, `changeMyVote`, `requestVista`, `closeManual`, `suspend/unsuspend`, `collegiateDecision`, `mark-spent`, `reverse-provision`) | Inline role arrays (votingController/financeController) | Map actions mirroring current roles (no behavior change) + `requirePermission`; eligibility (`canVote`, ELIGIBLE) stays in service |

**Verbatim evidence (all read this session):**
- Auth-only default: `router.use(authJwt);` with zero `requireRole` in requests/messages/settings/reports routes [VERIFIED: backend/src/routes/requests.routes.js:9, messages.routes.js:6, settings.routes.js:6, reports.routes.js:8]; sole precedent `router.get('/', requireRole('ADMINISTRADOR', 'CHEFE_DEPARTAMENTO'), c.list);` [VERIFIED: backend/src/routes/users.routes.js:8].
- `cancel`: `const r = await prisma.resourceRequest.findUnique({ where: { id: req.params.id } }); if (!r) return res.status(404)...; await prisma.resourceRequest.update({ where: { id: r.id }, data: { status: 'CANCELADO' } });` — no ownership/role/justification [VERIFIED: backend/src/controllers/requestController.js:112-120].
- `remove`: `const m = await prisma.deliberationMessage.findUnique(...); ... const up = await prisma.deliberationMessage.update({ where: { id: m.id }, data: { deletedAt: new Date() } });` — no author/role check [VERIFIED: backend/src/controllers/deliberationController.js:71-81].
- `requireRole`/`canManageUsers`: `if (!roles.includes(req.user.role)) return res.status(403).json({ error: 'Sem permissão' });` and `if (actor.role === 'ADMINISTRADOR') return true; if (actor.role === 'CHEFE_DEPARTAMENTO' && target.role !== 'ADMINISTRADOR') return true; return false;` [VERIFIED: backend/src/middlewares/auth.js:18-31].
- Roles: `role String @default("PROFESSOR") // Role: ADMINISTRADOR|CHEFE_DEPARTAMENTO|CONSELHEIRO|PROFESSOR|ALUNO (enum nativo no Postgres)` [VERIFIED: backend/prisma/schema.prisma:18]; request status default `status String @default("RASCUNHO")` [VERIFIED: backend/prisma/schema.prisma:64]; vote types `voteType String // DEFERIR|INDEFERIR|DEFERIR_PARCIALMENTE|ABSTER_SE` with `@@unique([requestId, voterId])` [VERIFIED: backend/prisma/schema.prisma:150,156].
- Voting eligibility: `const ELIGIBLE = ['CHEFE_DEPARTAMENTO', 'CONSELHEIRO'];` [VERIFIED: backend/src/services/votingService.js:3]; requester-can't-vote + tiebreak-chefe-only rules [VERIFIED: backend/src/services/votingService.js:18-24].
- Matrix ALUNO override target: `| Visualizar pedidos em votação | Sim | Sim | Sim | Sim | Não |` [VERIFIED: docs/06-permissoes.md:7] — the `Não` cell for ALUNO is what D-03 overrides (planner updates doc).
- RN-010 cancel matrix: `dono somente RASCUNHO/EM_VOTACAO, ADMINISTRADOR qualquer não-terminal (inclui INDEFERIDO como limpeza), CHEFE_DEPARTAMENTO antes de CONCLUIDO, justificativa obrigatória (400) em metadados REVERSE + AuditEvent request_cancelled/provision_reversed, ... CONCLUIDO/CANCELADO imutáveis (RN-010, D-05…D-08)` [CITED: docs/14-decisoes-em-aberto.md:16].

## Common Pitfalls

### Pitfall 1: D-10 "loosen the view gate" has nothing to loosen
**What goes wrong:** Planner writes a task to remove a leaders-only view gate on `transactions` that doesn't exist, then the executor "finds" a gate to remove (e.g., on `patchFinancial`) and opens a mutation endpoint.
**Why it happens:** CONTEXT.md asserts current code "restricts view to leaders" — but `transactions()` has no role check on either the route (`router.get('/transactions', c.transactions);` [VERIFIED: backend/src/routes/settings.routes.js:10]) or the controller (`const txs = await prisma.financialTransaction.findMany({ orderBy: { createdAt: 'desc' }, take: 100 });` [VERIFIED: backend/src/controllers/settingsController.js:58-63]). The leaders-only gates in that file are on `patchFinancial`/`patchBalance` (`if (!['ADMINISTRADOR', 'CHEFE_DEPARTAMENTO'].includes(req.user.role))` [VERIFIED: backend/src/controllers/settingsController.js:18,39]).
**How to avoid:** Plan task as "verify view-open + lock with allow test for all 5 roles", and explicitly guard the two PATCH mutations as must-stay-leaders.
**Warning signs:** Any diff touching `patchFinancial`/`patchBalance` role arrays in a view-loosening task.

### Pitfall 2: Ordinary-cancel vs after-approval-cancel split with Phase 6
**What goes wrong:** Phase 4 implements a cancel guard that Phase 6 must rip out to add the compensating REVERSE, or Phase 4 accidentally implements the reversal (VOT-04 scope leak).
**Why it happens:** RN-010 covers both paths in one row; D-06 assigns ordinary cancel here while the reversal belongs to Phase 6 (plan 06-04).
**How to avoid:** Implement the full RN-010 status×role routing now (owner RASCUNHO/EM_VOTACAO; ADMIN non-terminal; CHEFE pre-CONCLUIDO; justification 400; CONCLUIDO/CANCELADO immutable) with the approved-path branch delegating to a clearly-marked stub/extension point (`// Phase 6: compensating REVERSE here`) rather than a bare TODO. Keep auditing identical on both paths.
**Warning signs:** `cancel` handler with no status branching; `FinancialTransaction` writes appearing in Phase 4 diffs beyond audit.

### Pitfall 3: 403/404 split applied backwards
**What goes wrong:** Out-of-scope resources return 403 (leaking existence) or wrong-role on visible routes returns 404 (breaking legitimate UI error handling).
**Why it happens:** D-08 has two rules and the check order matters.
**How to avoid:** Order: authenticate → `requirePermission` (403 on role) → fetch row → `canViewRequest` (404 when invisible) → ownership mutation guard (403). The 404 branch must come from the visibility helper, never from the role map.
**Warning signs:** Matrix tests asserting 403 for cross-user draft access (should be 404).

### Pitfall 4: CI has no database — matrix must not need one
**What goes wrong:** Supertest matrix hits real Prisma, passes locally (docker db up), fails in CI.
**Why it happens:** CI backend job sets only `DATABASE_URL: postgresql://user:pass@localhost:5432/sgrd` as a dummy string with **no `services: postgres`** and runs `npx prisma generate` + `npx vitest run` [VERIFIED: .github/workflows/ci.yml:10-11,27-29]. No server listens on 5432 in the runner.
**How to avoid:** Mock the `src/config/db.js` singleton in matrix tests (auth/JWT stay real). If the planner wants real-DB coverage, that is a CI-workflow change (add service + migrate step) and must be planned as its own task with gate-risk review.
**Warning signs:** Any test file importing the real `config/db` transitively without `vi.mock`.

### Pitfall 5: `/:id/history` alias inherits whatever `getOne` gets
**What goes wrong:** Planner treats `GET /:id/history` (wired to `getOne` [VERIFIED: backend/src/routes/requests.routes.js:15]) as needing its own permission, or "fixes" it by serving audit data (unblocks a missing feature — audit read API is out of scope per REQUIREMENTS.md).
**Why it happens:** The alias looks like a distinct endpoint.
**How to avoid:** Cover it with the same `requests:get` action; do not build audit-read (D-09's chefe-limited audit has no read endpoint today — CONCERNS.md confirms zero `auditEvent.find*` in `src/` — so D-09 constrains future work only).
**Warning signs:** New `auditEvent.findMany` queries appearing in Phase 4 diffs.

### Pitfall 6: Local Node 26 vs CI Node 22
**What goes wrong:** Tests pass locally, break in CI on engine-specific behavior.
**Why it happens:** Local `node --version` is v26.9.0; CI pins Node 22 [VERIFIED: .github/workflows/ci.yml:24].
**How to avoid:** Avoid Node 23+ APIs in test helpers; treat CI green as the verdict, not local runs.
**Warning signs:** Use of `node:` builtins or flag-gated features newer than Node 22.

## Code Examples

### Row-level cancel guard (RN-010 ordinary path + Phase 6 seam)
```js
// backend/src/controllers/requestController.js — cancel (target shape for planner)
// RN-010 [CITED: docs/14-decisoes-em-aberto.md:16]: owner⇐RASCUNHO/EM_VOTACAO;
// ADMIN⇐any non-terminal; CHEFE⇐before CONCLUIDO; justification 400; CONCLUIDO/CANCELADO immutable.
async function cancel(req, res, next) {
  try {
    const r = await prisma.resourceRequest.findUnique({ where: { id: req.params.id } });
    if (!r || !canViewRequest(req.user, r)) return res.status(404).json({ error: 'Não encontrado' }); // D-08
    if (['CONCLUIDO', 'CANCELADO'].includes(r.status)) return res.status(400).json({ error: 'Pedido imutável' });
    if (!req.body?.justification) return res.status(400).json({ error: 'Justificativa obrigatória' }); // D-06
    const isOwner = String(r.requesterId) === String(req.user.id);
    const role = req.user.role;
    const approved = ['APROVADO', 'APROVADO_AUTOMATICAMENTE', 'APROVADO_PARCIALMENTE'].includes(r.status);
    if (approved) {
      if (!['ADMINISTRADOR', 'CHEFE_DEPARTAMENTO'].includes(role)) return res.status(403).json({ error: 'Sem permissão' });
      // Phase 6 (VOT-04/06-04): audited compensating REVERSE here. Phase 4: audited status change only.
    } else if (!(isOwner || ['ADMINISTRADOR', 'CHEFE_DEPARTAMENTO'].includes(role))) {
      return res.status(403).json({ error: 'Sem permissão' });
    }
    if (role === 'CHEFE_DEPARTAMENTO' && r.status === 'CONCLUIDO') return res.status(403).json({ error: 'Sem permissão' });
    // ... update + audit('request_cancelled', { justification }) ...
  } catch (e) { next(e); }
}
```

### Message remove guard (D-07)
```js
// backend/src/controllers/deliberationController.js — remove: add after the exists check,
// before the suspension guard (suspension 423 keeps precedence as today):
const isAuthor = String(m.authorId) === String(req.user.id);
const isLeader = ['ADMINISTRADOR', 'CHEFE_DEPARTAMENTO'].includes(req.user.role);
if (!isAuthor && !isLeader) return res.status(403).json({ error: 'Sem permissão' });
```

### Force-reset target guard (D-11, reuses existing helper)
```js
// backend/src/controllers/userController.js — resendInvite: route gate stays,
// add target check using the existing helper [VERIFIED: backend/src/middlewares/auth.js:27-31]:
const target = await prisma.user.findUnique({ where: { id: req.params.id } });
if (!target) return res.status(404).json({ error: 'Não encontrado' });
if (!canManageUsers(req.user, target)) return res.status(403).json({ error: 'Sem permissão' });
// ... plus distinct audit action 'password_reset_forced' when called via force-password-reset
// (route can pass context, e.g. resendInvite wrapped, or req.path check — planner's call).
```

### Matrix test skeleton (mock Prisma, real JWTs)
```js
// backend/tests/authz/matrix.test.js — sketch (vitest ESM importing CJS app, as existing tests do)
import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';

vi.mock('../../src/config/db.js', () => ({
  user: { findUnique: vi.fn(), findMany: vi.fn() },
  resourceRequest: { findUnique: vi.fn(), findMany: vi.fn(), update: vi.fn() },
  vote: { findMany: vi.fn() },
  deliberationMessage: { findUnique: vi.fn(), update: vi.fn() },
  financialTransaction: { findMany: vi.fn() },
  $transaction: vi.fn((cb) => cb(mockTx)),
}));
import createApp from '../../src/app.js';
import prisma from '../../src/config/db.js';
// sign real access tokens per role via src/utils/tokens.js with test JWT secrets,
// set cookie on agent: agent.set('Cookie', `access_token=${token}`)
// authJwt's prisma.user.findUnique mocked per-test to return { id, role, status: 'ATIVO' }.
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Inline role arrays per controller | Central `PERMISSIONS` map + `requirePermission` | This phase | One place to audit role decisions; `docs/06` note already demands "autorizações explícitas, não (…) verificações espalhadas" [VERIFIED: docs/06-permissoes.md:20] |
| `scopeFilter` copy in reports.routes.js | Shared `scopeWhere`/`canViewRequest` helper | This phase | Kills the drift ARCHITECTURE.md flags ("same rules re-implemented per file") |
| No HTTP tests (supertest unused) | Mock-Prisma supertest matrix + route-coverage test | This phase | Authorization regression gate (success criterion 3); runs under existing CI invocation |

**Deprecated/outdated:** Nothing in this stack is deprecated. Express 4 middleware-chain authorization is stable; no framework upgrade is in scope.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `docs/06` "Gerenciar usuários: Parcial" for chefe = exactly `canManageUsers` (chefe cannot touch admins), reused for force-reset per D-11 | Guard table | LOW — CONTEXT.md D-11 already locks this interpretation |
| A2 | Mock-Prisma matrix is sufficient as the regression gate; no real-DB authz test needed in this phase | Standard Stack / Pitfall 4 | MEDIUM — planner confirms DB story at plan time per CONTEXT discretion; if real-DB chosen, CI workflow change must be planned |
| A3 | `GET /settings` (settings+balance) stays view-open to all roles under D-10's view/mutation split (it has no gate today) | Guard table | LOW — consistent with D-10 rationale; matrix test locks behavior either way |
| A4 | Deliberation `patch` (edit) stays author-only; D-07 covers `remove` only | Guard table | LOW — no decision asks to widen edit; changing it would expand scope |
| A5 | `/:id/history` alias needs no separate permission beyond `requests:get` | Pitfall 5 | LOW — alias returns `getOne` today; any real history endpoint is out of scope |

## Open Questions

1. **Unify `reports.scopeFilter` with `scopeWhere` (widen PROF/ALUNO report scope to all non-drafts)?**
   - What we know: Roadmap/CONTEXT say the shared visibility helper is "reused by `reports.scopeFilter`". Matrix "Gerar relatórios" row grants PROF/ALUNO only "Próprios". D-03 overrides only the "Visualizar pedidos em votação" row.
   - What's unclear: Whether reports/requests + dashboard for PROF/ALUNO widen to non-draft-global (consistent with D-03 list behavior) or stay own-only (matrix-literal).
   - Recommendation: Unify (widen + update the matrix "Gerar relatórios" row in the same docs task as the D-03 row update) — a list showing all non-drafts next to a report showing only own is incoherent, and D-03's parity rationale generalizes. Planner decides; either way the voting report follows view-scope per D-02.

2. **Does ordinary `cancel` by owner require the request to be RASCUNHO/EM_VOTACAO only (RN-010), or any non-approved status?**
   - What we know: RN-010 (docs/14:16) says owner-only for RASCUNHO/EM_VOTACAO; ADMIN any non-terminal; CHEFE before CONCLUIDO.
   - What's unclear: Nothing material — RN-010 is explicit. Listed so the planner transcribes the full matrix rather than D-06's shorthand ("owner + admin/chefe").
   - Recommendation: Implement the RN-010 matrix verbatim; D-06 adds the justification/audit discipline on top.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| node (CI parity) | All backend work + tests | ✓ (local 26.9.0; CI 22) | local v26.9.0 / CI 22 | Avoid >22 APIs; CI is the verdict |
| docker | Only if planner picks real-DB story | Partial (client 29.8.1 present; daemon unconfirmed; no local pg running) | — | Mock-Prisma story needs no DB at all (recommended) |
| Postgres service in CI | Only real-DB story | ✗ (dummy URL string, no service) | — | Mock story; or plan a CI workflow change explicitly |
| supertest / vitest | Matrix tests | ✓ (installed; registry 7.3.0 / repo vitest ^2.1.1) | — | — |

**Missing dependencies with no fallback:** None for the recommended (mock) story.
**Missing dependencies with fallback:** Test Postgres (local daemon + CI service) — only needed if planner rejects the mock story.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | vitest ^2.1.1 (repo-pinned) |
| Config file | none (no vitest.config.* — default include covers `tests/`) |
| Quick run command | `cd backend && npx vitest run tests/authz` |
| Full suite command | `cd backend && npx vitest run` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| SEC-01 | cancel denies cross-user/ALUNO, allows owner+leaders with justification | supertest matrix (mock Prisma) | `npx vitest run tests/authz/matrix.test.js` | ❌ Wave 0 |
| SEC-01 | message remove denies non-author/non-leader | supertest matrix | same | ❌ Wave 0 |
| SEC-01 | getOne/list hide drafts cross-user (404), show non-drafts to PROF/ALUNO | supertest matrix | same | ❌ Wave 0 |
| SEC-01 | listVotes follows view-scope, full detail when visible | supertest matrix | same | ❌ Wave 0 |
| SEC-01 | transactions view open all roles; PATCH mutations leaders-only | supertest matrix | same | ❌ Wave 0 |
| SEC-01 | force-reset: chefe→admin denied via canManageUsers | supertest matrix | same | ❌ Wave 0 |
| SEC-01 | reports/voting scoped to viewable requests | supertest matrix | same | ❌ Wave 0 |
| SEC-01 | every route declares a permission (undeclared fails closed) | router-stack coverage test | `npx vitest run tests/authz/route-coverage.test.js` | ❌ Wave 0 |
| SEC-01 | ALLOW paths still work (conselheiro opens request under vote, owner sees own, admin force-reset) | supertest matrix allow cases | same | ❌ Wave 0 |

### Sampling Rate
- **Per task commit:** `cd backend && npx vitest run tests/authz`
- **Per wave merge:** `cd backend && npx vitest run`
- **Phase gate:** Full suite green before `/gsd-verify-work`

### Wave 0 Gaps
- [ ] `backend/tests/authz/matrix.test.js` — allow+deny matrix, fixed routes × 5 roles
- [ ] `backend/tests/authz/route-coverage.test.js` — every route declares `requirePermission`
- [ ] `backend/tests/authz/helpers.js` — mock Prisma singleton (`vi.mock` factory), per-role JWT signer, 5-role user fixtures, draft/non-draft request fixtures
- [ ] No framework install needed (`supertest`, `vitest` already in devDependencies)

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|------------------|
| V2 Authentication | No (unchanged) | `authJwt` untouched; session work is Phase 5/8 |
| V3 Session Management | No (unchanged) | Out of scope |
| V4 Access Control | **Yes** | `PERMISSIONS` map + `requirePermission` (deny-by-default) + `canViewRequest`/`canManageUsers` row checks; verify 403/404 split per D-08 |
| V5 Input Validation | Partial | Mandatory `justification` on cancel (400 when absent); no other new inputs |
| V6 Cryptography | No | No crypto changes |

### Known Threat Patterns for Express + Prisma stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Missing function-level access control (cancel/remove as-shipped) | Elevation of privilege | `requirePermission` on every route + matrix tests (this phase) |
| IDOR via predictable/foreign IDs (getOne/list/votes) | Information disclosure | `canViewRequest` → 404 outside scope (D-08) |
| Forced browsing to admin functions (force-reset targeting admin) | Elevation of privilege | `canManageUsers(actor, target)` in handler, not just route roles (D-11) |
| Audit-log injection via justification/metadata | Tampering | Existing audit stores raw strings; unchanged this phase — do not log unsanitized justification into executable contexts (no CSV/export path touched here) |

## Sources

### Primary (HIGH confidence)
- In-repo reads this session: `backend/src/middlewares/auth.js`, `backend/src/routes/*.routes.js` (6 files), `backend/src/controllers/requestController.js`, `votingController.js`, `deliberationController.js`, `settingsController.js`, `userController.js`, `financeController.js`, `backend/src/services/votingService.js`, `backend/prisma/schema.prisma`, `backend/src/app.js`, `backend/package.json`, `.github/workflows/ci.yml`, `docs/06-permissoes.md`, `docs/14-decisoes-em-aberto.md` (RN-010 row), `.planning/ROADMAP.md` Phase 4, `04-CONTEXT.md`, `.planning/codebase/ARCHITECTURE.md` + `CONCERNS.md`
- Tool-verified versions: `supertest@7.3.0` via `npm view`; local `node v26.9.0`; docker client 29.8.1

### Secondary (MEDIUM confidence)
- [CITED: prisma.io/blog/testing-series-1 + testing-series-3] — mock-Prisma (`vi.mock` + `$transaction` callback-with-mock) vs real-DB supertest patterns; grounds the DB-story recommendation

### Tertiary (LOW confidence)
- Express `requirePermission` factory shape — standard middleware-closure idiom, corroborated by in-repo `requireRole` precedent; no external doc fetch needed

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — zero new deps; versions tool-verified
- Architecture: HIGH — every guard gap verified by direct code read with line citations
- Pitfalls: HIGH — D-10 discrepancy and CI-no-DB findings are read-verified, not inferred
- Test strategy: MEDIUM — Prisma official docs corroborate; SGRF-specific mock paths sketched, not executed

**Research date:** 2026-09-24
**Valid until:** 2026-10-24 (stable domain: Express 4 authz patterns + frozen in-repo code)
