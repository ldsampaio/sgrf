# Phase 04: Authorization Hardening - Pattern Map

**Mapped:** 2026-09-24
**Files analyzed:** 14 (5 new, 9 modified)
**Analogs found:** 14 / 14

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `backend/src/middlewares/permissions.js` (NEW) | middleware | request-response | `backend/src/middlewares/auth.js` | exact |
| `backend/src/middlewares/visibility.js` (NEW, or inside permissions.js) | utility | CRUD | `backend/src/routes/reports.routes.js` (`scopeFilter`, lines 10-22) | role-match |
| `backend/tests/authz/matrix.test.js` (NEW) | test | request-response | `backend/tests/voting.test.js` + `backend/tests/unit.test.js` | role-match |
| `backend/tests/authz/route-coverage.test.js` (NEW) | test | request-response | `backend/src/app.js` (router-stack source) — no existing coverage test | partial |
| `backend/tests/authz/helpers.js` (NEW) | test utility | request-response | `backend/src/utils/tokens.js` + `backend/src/config/db.js` | role-match |
| `backend/src/routes/requests.routes.js` (MOD) | route | request-response | `backend/src/routes/users.routes.js` | exact |
| `backend/src/routes/messages.routes.js` (MOD) | route | request-response | `backend/src/routes/users.routes.js` | exact |
| `backend/src/routes/settings.routes.js` (MOD) | route | request-response | `backend/src/routes/users.routes.js` | exact |
| `backend/src/routes/reports.routes.js` (MOD) | route | request-response | `backend/src/routes/users.routes.js` | exact |
| `backend/src/routes/users.routes.js` (MOD) | route | request-response | itself (sole `requireRole` precedent) | exact |
| `backend/src/controllers/requestController.js` (MOD) | controller | CRUD | itself (`submit` owner guard, lines 54-56; `cancel` stub, lines 112-120) | exact |
| `backend/src/controllers/votingController.js` (MOD) | controller | CRUD | itself (inline role arrays `requestVista` line 101, `closeManual` line 128) | exact |
| `backend/src/controllers/deliberationController.js` (MOD) | controller | CRUD | itself (`patch` author guard line 60 + suspension guard lines 4-6) | exact |
| `backend/src/controllers/userController.js` (MOD) | controller | CRUD | itself (`patchRole`/`patch` `canManageUsers` gates, lines 42-66) | exact |
| `backend/src/controllers/settingsController.js` (VERIFY-ONLY) | controller | CRUD | itself (leaders-only gates lines 18, 39; open `transactions` lines 58-63) | exact |
| `docs/06-permissoes.md` (MOD) | doc | — | no code analog; D-03 override row update | no-analog (doc edit) |

## Pattern Assignments

### `backend/src/middlewares/permissions.js` (NEW — middleware, request-response)

**Analog:** `backend/src/middlewares/auth.js`

**Imports pattern** (lines 1-2):
```js
const { verifyAccess } = require('../utils/tokens');
const prisma = require('../config/db');
```
New file needs neither import (pure map + closure, no DB/JWT). Copy only the CJS `require`/`module.exports` style — no ESM.

**Middleware-factory pattern to mirror** (lines 18-24):
```js
function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user) return res.status(401).json({ error: 'Não autenticado' });
    if (!roles.includes(req.user.role)) return res.status(403).json({ error: 'Sem permissão' });
    next();
  };
}
```
`requirePermission(action)` uses the identical closure shape: lookup `PERMISSIONS[action]` → 403 `'Ação não autorizada'` when undeclared (fail closed) → 401 when `!req.user` → 403 `'Sem permissão'` when role not listed → `next()`. Tag the returned fn with `fn._permissionAction = action` so the route-coverage test can detect it. Freeze the map with `Object.freeze`. Role strings must be exactly `ADMINISTRADOR|CHEFE_DEPARTAMENTO|CONSELHEIRO|PROFESSOR|ALUNO` (schema comment, `backend/prisma/schema.prisma:18`).

**Export pattern** (line 33):
```js
module.exports = { authJwt, requireRole, canManageUsers };
```
→ `module.exports = { PERMISSIONS, requirePermission };`

**Target guard table for the map** (from RESEARCH.md §Per-Endpoint Guard Table — transcribe verbatim at plan time, do not invent roles):
- `requests:list/get`, `votes:list`, `messages:remove`, `settings:transactions:view`, `reports:voting` → all 5 roles (+ controller row-guard)
- `votes:cast` → `CHEFE_DEPARTAMENTO, CONSELHEIRO` (eligibility stays in `canVote` service)
- `settings:financial:edit` → `ADMINISTRADOR, CHEFE_DEPARTAMENTO`
- `users:force-reset` → `ADMINISTRADOR, CHEFE_DEPARTAMENTO` (+ `canManageUsers` in handler)

---

### `backend/src/middlewares/visibility.js` (NEW — utility, CRUD)

**Analog:** `scopeFilter` in `backend/src/routes/reports.routes.js` (lines 10-22) + `submit` owner check in `backend/src/controllers/requestController.js` (lines 54-56)

**Scope-builder pattern to generalize** (`reports.routes.js` lines 10-22):
```js
function scopeFilter(user, q) {
  const where = {};
  if (user.role === 'ALUNO' || user.role === 'PROFESSOR') where.requesterId = user.id;
  else if (q.mine === '1') where.requesterId = user.id;
  if (q.status) where.status = q.status;
  if (q.type) where.type = q.type;
  if (q.from || q.to) {
    where.createdAt = {};
    if (q.from) where.createdAt.gte = new Date(q.from);
    if (q.to) where.createdAt.lte = new Date(q.to);
  }
  return where;
}
```
New `scopeWhere(user, q)` keeps this shape but changes the PROFESSOR/ALUNO branch per D-03/D-04 to `where.OR = [{ requesterId: user.id }, { status: { not: 'RASCUNHO' } }]`. New `canViewRequest(user, r)`: RASCUNHO → owner + `ADMINISTRADOR`/`CHEFE_DEPARTAMENTO` only; non-draft → `true` for any authenticated role.

**Ownership-comparison pattern** (`requestController.js` lines 54-56):
```js
if (r.requesterId !== req.user.id && !['ADMINISTRADOR', 'CHEFE_DEPARTAMENTO'].includes(req.user.role)) {
  return res.status(403).json({ error: 'Só o solicitante submete' });
}
```
Copy the `String(...)` coercion discipline for UUID comparison (`String(r.requesterId) === String(user.id)`) — Prisma returns UUID strings and `!==` on mixed types fails open/closed unpredictably. Planner decides location (standalone `visibility.js` vs inside `permissions.js`); either way `reports.scopeFilter` is replaced by (or delegates to) `scopeWhere`.

---

### `backend/src/routes/requests.routes.js` + `messages.routes.js` + `settings.routes.js` + `reports.routes.js` (MOD — route, request-response)

**Analog:** `backend/src/routes/users.routes.js`

**Auth-only default to close** (all four files mount bare `router.use(authJwt);` — requests.routes.js:9, messages.routes.js:6, settings.routes.js:6, reports.routes.js:8):
```js
const router = express.Router();
router.use(authJwt);
```

**Per-route gate precedent to copy** (`users.routes.js` lines 8, 14-15):
```js
router.get('/', requireRole('ADMINISTRADOR', 'CHEFE_DEPARTAMENTO'), c.list);
router.post('/:id/resend-invite', requireRole('ADMINISTRADOR', 'CHEFE_DEPARTAMENTO'), c.resendInvite);
router.post('/:id/force-password-reset', requireRole('ADMINISTRADOR', 'CHEFE_DEPARTAMENTO'), c.resendInvite);
```
Replace `requireRole(...)` with `requirePermission('<action>')` per route per the guard table; import becomes `const { authJwt } = require('../middlewares/auth'); const { requirePermission } = require('../middlewares/permissions');`. Keep `router.use(authJwt)` as the first layer — `requirePermission` assumes `req.user` is set and returns 401 otherwise. `GET /:id/history` (requests.routes.js:15, wired to `getOne`) reuses `requests:get`, no separate action (Pitfall 5 — do not build audit-read).

---

### `backend/src/routes/users.routes.js` (MOD — route, request-response)

**Analog:** itself — the sole `requireRole` precedent in the codebase.

No route-shape change required: `force-password-reset` keeps `requireRole('ADMINISTRADOR', 'CHEFE_DEPARTAMENTO')` (D-11). Planner may optionally migrate these two lines to `requirePermission('users:force-reset')` for uniformity, but the behavioral fix for D-11 lives in the controller (`resendInvite` + `canManageUsers`), not here. `PATCH /:id` and `PATCH /:id/role` (lines 12-13, no route gate) gain a broad `requirePermission` declaration with `canManageUsers` retained as the target-dependent gate in the handler.

---

### `backend/src/controllers/requestController.js` (MOD — controller, CRUD)

**Analog:** itself.

**Owner-guard + status-guard + transaction + audit pattern** (`submit`, lines 52-56 and 75-96):
```js
if (r.requesterId !== req.user.id && !['ADMINISTRADOR', 'CHEFE_DEPARTAMENTO'].includes(req.user.role)) {
  return res.status(403).json({ error: 'Só o solicitante submete' });
}
if (r.status !== 'RASCUNHO') return res.status(400).json({ error: 'Só rascunho pode ser submetido' });
// ...
const updated = await prisma.$transaction(async (tx) => { /* status + writes */ });
await audit({ actorId: req.user.id, action: 'request_submitted', entityType: 'request', entityId: r.id, beforeData: { status: 'RASCUNHO' }, afterData: updated, req });
```

**Cancel target shape** (current stub lines 112-120 has zero checks — replace with the RN-010 matrix from RESEARCH.md §Code Examples):
```js
const r = await prisma.resourceRequest.findUnique({ where: { id: req.params.id } });
if (!r) return res.status(404).json({ error: 'Não encontrado' });
await prisma.resourceRequest.update({ where: { id: r.id }, data: { status: 'CANCELADO' } });
await audit({ actorId: req.user.id, action: 'request_cancelled', entityType: 'request', entityId: r.id, req });
```
New order per D-06/D-08/RN-010: fetch → `!canViewRequest` → 404 (hides existence) → `CONCLUIDO`/`CANCELADO` → 400 immutable → missing `justification` → 400 → approved-status branch (admin/chefe only + `// Phase 6: compensating REVERSE here` seam, no `FinancialTransaction` writes) → ordinary branch (owner/admin/chefe else 403) → update + `audit('request_cancelled', { justification })`. Keep `try { } catch (e) { next(e); }` and `errorHandler` delegation (see Shared Patterns).

**List/getOne target shape:** `list` (lines 6-17) replaces the `ALUNO`-only branch with `scopeWhere`; `getOne` (lines 104-110) adds `if (!r || !canViewRequest(req.user, r)) return 404` before responding (keep `include: { files: true, transactions: true }` — D-05, no amount redaction).

---

### `backend/src/controllers/votingController.js` (MOD — controller, CRUD)

**Analog:** itself — inline role arrays are the pattern being centralized.

**Inline role-gate pattern to move into the map** (lines 101-103, 128-130):
```js
if (!['ADMINISTRADOR', 'CHEFE_DEPARTAMENTO', 'CONSELHEIRO', 'PROFESSOR'].includes(req.user.role)) {
  return res.status(403).json({ error: 'Sem permissão para vista' });
}
// ...
if (!['ADMINISTRADOR', 'CHEFE_DEPARTAMENTO'].includes(req.user.role)) {
  return res.status(403).json({ error: 'Só admin/chefe' });
}
```
Route-level `requirePermission` replaces these; eligibility logic (`canVote`, `ELIGIBLE = ['CHEFE_DEPARTAMENTO', 'CONSELHEIRO']` in `votingService.js:3`) stays in the service. `listVotes` (lines 25-30, currently zero checks) gains parent lookup + `canViewRequest` → 404 when invisible, full `enrichVotes` detail when visible (D-01/D-02, no tally redaction). Keep the suspension-guard convention (`suspendedGuard` → 423 keeps precedence) and the `enrichVotes` join pattern (lines 13-23: collect IDs → one `findMany` → `Map` lookup → fallback `'Usuário removido'`) for any new voter-name enrichment.

---

### `backend/src/controllers/deliberationController.js` (MOD — controller, CRUD)

**Analog:** itself.

**Author-only guard pattern** (`patch`, line 60):
```js
if (String(m.authorId) !== String(req.user.id)) return res.status(403).json({ error: 'Só o autor edita' });
```
**Suspension-guard pattern** (lines 4-6, applied lines 59, 75):
```js
function suspended(r) {
  return r && r.status === 'SUSPENSO_REUNIAO_ORDINARIA';
}
// ... if (suspended(r)) return res.status(423).json({ error: 'Suspensa — somente leitura' });
```
`remove` (lines 71-81) inserts between the exists check and the suspension guard:
```js
const isAuthor = String(m.authorId) === String(req.user.id);
const isLeader = ['ADMINISTRADOR', 'CHEFE_DEPARTAMENTO'].includes(req.user.role);
if (!isAuthor && !isLeader) return res.status(403).json({ error: 'Sem permissão' });
```
Keep the 423 suspension precedence and the `audit({ action: 'message_deleted', ... })` call. `list` gains a parent `canViewRequest` check; `post`'s ALUNO exclusion (lines 42-44) moves to the map.

---

### `backend/src/controllers/userController.js` (MOD — controller, CRUD)

**Analog:** itself (`patchRole`/`patch` lines 42-66) + `canManageUsers` in `backend/src/middlewares/auth.js` (lines 26-31).

**Target-guard pattern to copy into `resendInvite`** (lines 44-46, 59-61):
```js
const target = await prisma.user.findUnique({ where: { id: req.params.id } });
if (!target) return res.status(404).json({ error: 'Usuário não encontrado' });
if (!canManageUsers(req.user, target)) return res.status(403).json({ error: 'Chefe não pode alterar administrador (RF-005)' });
```
`resendInvite` (lines 68-81, currently no target check — chefe can force-reset an admin) adds exactly this block after the `findUnique`; file already imports `canManageUsers` (line 6). Add a distinct audit action `password_reset_forced` when invoked via the `force-password-reset` path vs `invite_resent` (route wrapper or `req.path` check — planner's call). Keep the temp-password + `enqueue` + `hashPassword` flow unchanged.

---

### `backend/src/controllers/settingsController.js` (VERIFY-ONLY — controller, CRUD)

**Analog:** itself. No code change expected; lock behavior with tests.

**Leaders-only mutation gates that must stay** (lines 18-20, 39-41):
```js
if (!['ADMINISTRADOR', 'CHEFE_DEPARTAMENTO'].includes(req.user.role)) {
  return res.status(403).json({ error: 'Sem permissão' });
}
```
**Open view to lock, not loosen** (lines 58-63 — no gate on route `settings.routes.js:10` or here):
```js
async function transactions(req, res, next) {
  try {
    const txs = await prisma.financialTransaction.findMany({ orderBy: { createdAt: 'desc' }, take: 100 });
    res.json({ transactions: txs });
  } catch (e) { next(e); }
}
```
Plan task as "declare `settings:transactions:view` (all roles) + matrix allow-test for all 5 roles; `PATCH /financial` + `PATCH /balance` declare `settings:financial:edit` (keep inline check — safer)". Warning: any diff touching the PATCH role arrays in a view task is Pitfall 1.

---

### `backend/tests/authz/matrix.test.js` + `helpers.js` + `route-coverage.test.js` (NEW — test, request-response)

**Analog (test style):** `backend/tests/voting.test.js` (lines 1-2) + `backend/tests/unit.test.js` (lines 1-3)
```js
import { describe, it, expect } from 'vitest';
import { tally } from '../src/services/votingService.js';
```
Copy: vitest ESM `import` of CJS sources with explicit `.js` extension, `describe`/`it`/`expect` only, runnable under bare `npx vitest run` (no config file exists — default include covers `tests/`). No new deps: `supertest@7.3.0` + `vitest ^2.1.1` already in devDependencies; do not upgrade vitest (registry 5.x breaks CI pin).

**Analog (app factory):** `backend/src/app.js` (lines 12-28, 41)
```js
function createApp() {
  const app = express();
  // ... helmet → cors → json → cookie-parser → pino-http ...
  app.use('/api/requests', require('./routes/requests.routes'));
  // ...
}
module.exports = createApp;
```
Matrix drives `createApp()` via `request.agent(app)` without listening.

**Analog (JWT for tests):** `backend/src/utils/tokens.js` (lines 4-6, 20-25)
```js
function signAccess(user) {
  return jwt.sign({ sub: user.id, role: user.role }, env.jwtAccessSecret, { expiresIn: '15m' });
}
const cookieOpts = { httpOnly: true, secure: env.cookieSecure, sameSite: 'lax', path: '/', };
```
Sign real `access_token` cookies per role with test JWT secrets; set via `agent.set('Cookie', `access_token=${token}`)`. Do NOT stub `authJwt` (bypasses the real chain). Mock only the Prisma singleton `backend/src/config/db.js` (lines 1-5: `const prisma = new PrismaClient(); module.exports = prisma;`) via `vi.mock('../../src/config/db.js', ...)` with hand-rolled `vi.fn()` per touched model (`user`, `resourceRequest`, `vote`, `deliberationMessage`, `financialTransaction`, `$transaction` as `(cb) => cb(mockTx)`). `authJwt`'s `prisma.user.findUnique` is mocked per-test to return `{ id, role, status: 'ATIVO' }`.

**Analog (error delegation):** `backend/src/middlewares/validate.js` lines 13+ (`errorHandler(err, req, res, next)`, mounted last in `app.js:37`). Controllers use `try { } catch (e) { next(e); }` — matrix asserts status codes, never error text beyond the stable `'Sem permissão'` / `'Não encontrado'` / `'Não autenticado'` strings.

**Route-coverage test:** walks `app._router.stack`, collects route layers, asserts each handler chain contains a frame tagged `fn._permissionAction`. No existing analog (first router-introspection test) — the tagging contract is defined in the `permissions.js` assignment above. Node ≤22 APIs only (CI pins 22; local is 26).

---

## Shared Patterns

### Authentication (applies to: all route files, matrix helpers)
**Source:** `backend/src/middlewares/auth.js` (lines 4-16)
```js
async function authJwt(req, res, next) {
  const token = req.cookies?.access_token;
  if (!token) return res.status(401).json({ error: 'Não autenticado' });
  try {
    const payload = verifyAccess(token);
    const user = await prisma.user.findUnique({ where: { id: payload.sub } });
    if (!user || user.status !== 'ATIVO') return res.status(401).json({ error: 'Usuário inválido' });
    req.user = user;
    next();
  } catch {
    return res.status(401).json({ error: 'Sessão expirada' });
  }
}
```
Unchanged this phase. `requirePermission` always mounts after `authJwt`; check order is authenticate → map (403) → fetch row → `canViewRequest` (404, D-08) → ownership mutation guard (403).

### Target-dependent authorization (applies to: `userController.resendInvite`, `requestController.submit/cancel`, `deliberationController.remove`)
**Source:** `backend/src/middlewares/auth.js` (lines 26-31)
```js
// Chefe pode gerenciar usuários exceto admin (RF-005)
function canManageUsers(actor, target) {
  if (actor.role === 'ADMINISTRADOR') return true;
  if (actor.role === 'CHEFE_DEPARTAMENTO' && target.role !== 'ADMINISTRADOR') return true;
  return false;
}
```
Pure role decisions move to the map; only target-dependent checks (`canManageUsers`, author, owner) stay in controllers.

### Error handling (applies to: all controllers, new middleware)
**Source:** `backend/src/middlewares/validate.js` (`errorHandler`, mounted `app.js:37`) + controller convention
```js
} catch (e) { next(e); }
```
Controllers return `400` (validation/justification/state), `401` (no user), `403` (wrong role on visible scope), `404` (missing or outside scope, D-08), `423` (suspended — keeps precedence over authz inserts), `409` (unique conflicts). Deny strings: `'Sem permissão'`, `'Não encontrado'`, `'Não autenticado'`, `'Ação não autorizada'` (undeclared action, fail-closed 403).

### Audit (applies to: `cancel`, `remove`, `resendInvite`/force-reset)
**Source:** `backend/src/services/auditService.js` (lines 3-21)
```js
async function audit({ actorId, action, entityType, entityId, beforeData, afterData, req }) {
  try {
    await prisma.auditEvent.create({
      data: {
        actorId: actorId || null, action, entityType, entityId: entityId || null,
        beforeData: JSON.stringify(beforeData || {}),
        afterData: JSON.stringify(afterData || {}),
        ipAddress: req?.ip || null,
        userAgent: req?.headers?.['user-agent'] || null,
      },
    });
  } catch (e) {
    // auditoria nunca deve quebrar o fluxo
    require('../config/logger').error({ err: e }, 'audit failed');
  }
}
```
Fail-open: audit never breaks the guard path. Reuse actions `request_cancelled` / `message_deleted`; add `password_reset_forced` distinct from `invite_resent`. Do NOT introduce `auditEvent.findMany` reads — D-09 constrains future work only (zero reads in `src/` today).

### Money/ID conventions (applies to: cancel guard, matrix fixtures)
Integer cents; UUID strings with `String()` coercion on comparison; no raw SQL. Fixtures: draft (`status: 'RASCUNHO'`) vs non-draft requests, 5-role users, per-role JWTs.

## No Analog Found

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| `docs/06-permissoes.md` (row update) | doc | — | Doc edit, not code: D-03 overrides the `Visualizar pedidos em votação / ALUNO = Não` cell to `Sim`; planner may also update the `Gerar relatórios` row if `scopeWhere` unification is chosen (Open Question 1). No code pattern to copy. |

## Metadata

**Analog search scope:** `backend/src/middlewares/`, `backend/src/routes/`, `backend/src/controllers/`, `backend/src/services/`, `backend/src/utils/`, `backend/src/config/`, `backend/tests/`
**Files scanned:** 17 (13 source + 4 test/config); 3–5 core analogs deep-read per instructions, remainder verified via RESEARCH.md line-cited reads this session
**All analog paths git-tracked:** verified via `git ls-files` (17/17 non-empty)
**Pattern extraction date:** 2026-09-24
