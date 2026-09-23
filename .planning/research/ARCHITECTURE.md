# Architecture Research — SGRF Hardening Placement

**Domain:** Internal financial-management web app (layered modular monolith: Express/Prisma backend + Vue SPA)
**Researched:** 2026-09-23
**Confidence:** HIGH (placement decisions — derived from the actual codebase + `docs/` specs); MEDIUM (external pattern research — see [Sources](#sources))

## Standard Architecture

### System Overview (as-is, with hardening overlays marked ⟦NEW⟧)

```text
┌──────────────────────────────────────────────────────────────────┐
│  Frontend SPA — Vue 3 + Vite (ESM) — frontend/src/               │
│  views/ → stores/auth (Pinia) → services/api.js (axios)           │
│  router/index.js guards (meta.auth / meta.roles / mustChange)     │
│  ⟦NEW⟧ response interceptor in services/api.js: 401 → refresh     │
│         once (single-flight) → retry original request             │
└───────────────┬──────────────────────────────────────────────────┘
                │ axios baseURL '/api' + withCredentials (cookie JWT)
                │ dev: Vite proxy · prod: same-origin static
                ▼
┌──────────────────────────────────────────────────────────────────┐
│  Express API — Node 22, CommonJS — backend/src/                   │
│  app.js factory: helmet → cors → json → cookie-parser → pino-http │
│  ⟦NEW⟧ app.set('trust proxy', …) — config, belongs in app.js      │
│  Routes /api/* :                                                  │
│    router.use(authJwt)                                            │
│    ⟦NEW⟧ requirePermission('<action>') — permission-map middleware │
│    ⟦NEW⟧ rate-limiters on ALL auth mutation routes (auth.routes)  │
│  Controllers (HTTP + orchestration) → Services (domain rules)     │
│  ⟦NEW⟧ balance writes: conditional atomic UPDATE inside           │
│         prisma.$transaction (no raw SQL) — 5 existing call sites  │
│  server.js bootstrap:                                             │
│    ⟦NEW⟧ jobs/scheduler.js setInterval: closeExpired + processQueue│
└───────────────┬──────────────────────────────────────────────────┘
                │ Prisma Client singleton (config/db.js)
                ▼
┌──────────────────────────────────────────────────────────────────┐
│  PostgreSQL 16 (compose service `db`) — money = cents, UUID ids   │
└──────────────────────────────────────────────────────────────────┘

⟦NEW⟧ GitHub Actions (repo root .github/workflows/):
  job "backend":  working-directory=backend  → npm ci → npx vitest run
  job "frontend": working-directory=frontend → npm ci → npm run build
```

Production shape is unchanged: single Docker image (Express serves API + built SPA) + compose Postgres. No new frameworks, no new services, no microservices — every overlay below is an in-layer addition.

### Component Responsibilities

| Component | Responsibility | Talks to | File |
|-----------|----------------|----------|------|
| App factory | Middleware order, route mounts, SPA fallback, error handler | routes, middlewares | `backend/src/app.js` |
| Server bootstrap | Process entry: `createApp()` + `listen` ⟦NEW⟧ + `startJobs()` | app, jobs | `backend/src/server.js` |
| Auth middleware | `authJwt` (cookie → DB user) ⟦NEW⟧ `mustChangePassword` 403 gate lives here | controllers (via `req.user`) | `backend/src/middlewares/auth.js` |
| ⟦NEW⟧ Permission middleware | `requirePermission(action)` reading a static map mirroring `docs/06-permissoes.md`; `authJwt` → permission → controller | routes only | `backend/src/middlewares/permissions.js` (new) + map |
| Rate limiters | Per-route `express-rate-limit` instances on login/refresh/forgot/change-password | auth routes | `backend/src/routes/auth.routes.js` |
| Routes | URL mapping + coarse gates (role) only — wiring, never row-level rules | middlewares, controllers | `backend/src/routes/*.routes.js` |
| Controllers | HTTP orchestration; **row-level checks stay here** (ownership after loading the row) | services, prisma | `backend/src/controllers/*.js` |
| Domain services | Voting/close rules, annual-limit math, audit, email queue ⟦NEW⟧ balance conditional-update helper if extracted | prisma, env, logger | `backend/src/services/*.js` |
| ⟦NEW⟧ Job scheduler | In-process `setInterval` loops (email drain, voting auto-close); re-entrancy guard; logs | services (`processQueue`), jobs (`closeExpired`) | `backend/src/jobs/scheduler.js` (new) |
| Email service | `enqueue` (writers: authController, userController…) → `processQueue` (reader: scheduler only) | prisma, nodemailer | `backend/src/services/emailService.js` |
| Report routes | Export/aggregation with `scopeFilter` sharing the visibility rule with `requestController.list` | prisma, audit | `backend/src/routes/reports.routes.js` |
| API client | Single shared axios instance ⟦NEW⟧ 401→refresh interceptor (single-flight) | all views, auth store | `frontend/src/services/api.js` |
| Router guard | `meta.auth`/`meta.roles` + ⟦NEW⟧ `mustChangePassword` redirect (fill the empty branch) | auth store | `frontend/src/router/index.js` |
| ⟦NEW⟧ CI workflow | Regression gate: backend tests + frontend build on push/PR | both packages via `working-directory` | `.github/workflows/ci.yml` (new) |

## Recommended Project Structure (delta — only hardening-related changes)

```
.github/
└── workflows/
    └── ci.yml                 # ⟦NEW⟧ two jobs, per-package working-directory
backend/src/
├── middlewares/
│   ├── auth.js                # EDIT: + mustChangePassword 403 (allowlist: me/change-password/logout/refresh)
│   └── permissions.js         # ⟦NEW⟧ PERMISSIONS map + requirePermission()
├── jobs/
│   ├── votingCloser.js        # EDIT: fix broken requires (./ → ../)
│   └── scheduler.js           # ⟦NEW⟧ setInterval runner (imported ONLY by server.js)
├── services/
│   ├── requestService.js      # EDIT: annualTotalCents += CONCLUIDO; shared scope helper for list/getOne
│   ├── votingService.js       # EDIT: tie-break rule, partial-approval rule, conditional balance update
│   └── balanceService.js      # OPTIONAL: only if extracting provision/spend/reverse simplifies the 5-site fix
├── config/env.js              # EDIT: fail-fast on dev-* secrets when NODE_ENV=production
├── controllers/…              # EDIT: ownership guards (cancel/getOne/remove), login uniform-401, smtpConfigured
├── routes/
│   ├── auth.routes.js         # EDIT: limiters on refresh/forgot-password/change-password
│   ├── requests|messages|settings|reports.routes.js  # EDIT: requirePermission per route
│   └── reports.routes.js      # EDIT: audit before stream (CSV/JSON), CSV formula escape, scopeFilter share
├── app.js                     # EDIT: app.set('trust proxy', env-derived, explicit value)
└── server.js                  # EDIT: startJobs() after listen
frontend/src/
├── services/api.js            # EDIT: 401 response interceptor + single-flight refresh + one retry
└── router/index.js            # EDIT: mustChangePassword branch → '/login' (or change-password view)
```

### Structure Rationale

- **`middlewares/permissions.js` next to `auth.js`:** authorization is an HTTP-layer concern; `docs/06-permissoes.md` explicitly demands "autorizações explícitas, não apenas verificações espalhadas". One file = one obvious place a new route must be declared; keeps `auth.js` doing authentication only.
- **`jobs/scheduler.js` separate from `server.js`:** keeps the bootstrap readable and lets tests import job functions without starting listeners; `server.js` stays the only file that wires intervals to the process.
- **Interceptor in `services/api.js`, not in views or the store:** every request already flows through this one instance (grep: all views + `stores/auth.js` import it) — one interceptor fixes all 401s; per-view handling is what created the current drift.
- **CI at repo root `.github/` (not per package):** the repo is one git repo with two independent npm packages (no workspaces) — one workflow, two jobs with `defaults.run.working-directory`, mirrors how a human runs the commands per `AGENTS.md`.

## Architectural Patterns

### Pattern 1: Route-level permission map + `requirePermission` (authorization layer)

**What:** Static map keyed by action name → allowed roles (+ flags for ownership-dependent checks), enforced as route middleware after `authJwt`.
**When:** Every state-changing route and every scoped-read route in `requests|messages|settings|reports`.
**Trade-offs:** (+) fail-closed by construction — a route with no declared action can be rejected by a catch-all test that enumerates the map vs the router; (+) `docs/06` matrix is directly transcribable; (−) row-level rules (does this request belong to `req.user`?) still need the row loaded — those stay in controllers; the map only declares *which* rule applies (`ownership: 'requester'|'author'`).

```js
// backend/src/middlewares/permissions.js (CommonJS)
const PERMISSIONS = {
  'request.list':   { roles: ['ADMINISTRADOR', 'CHEFE_DEPARTAMENTO', 'CONSELHEIRO', 'PROFESSOR', 'ALUNO'], scope: 'own+inVoting' },
  'request.get':    { roles: ['*'], ownership: 'requester|council' },   // row-level checked in controller
  'request.cancel': { roles: ['ADMINISTRADOR', 'CHEFE_DEPARTAMENTO', 'OWNER'], ownership: 'requester' },
  'message.remove': { roles: ['ADMINISTRADOR', 'CHEFE_DEPARTAMENTO', 'OWNER'], ownership: 'author' },
  'settings.transactions': { roles: ['ADMINISTRADOR', 'CHEFE_DEPARTAMENTO'] },
  'votes.list':     { roles: ['ADMINISTRADOR', 'CHEFE_DEPARTAMENTO', 'CONSELHEIRO'] }, // ALUNO out per docs/06
  'report.financial': { roles: ['ADMINISTRADOR', 'CHEFE_DEPARTAMENTO'] },
  // …transcribe every row of docs/06-permissoes.md
};
function requirePermission(action) {
  return (req, res, next) => {
    const rule = PERMISSIONS[action];
    if (!rule) return res.status(403).json({ error: 'Sem permissão' });        // fail-closed: undeclared action
    const u = req.user;
    if (!u) return res.status(401).json({ error: 'Não autenticado' });
    if (!rule.roles.includes('*') && !rule.roles.includes(u.role) && !rule.roles.includes('OWNER'))
      return res.status(403).json({ error: 'Sem permissão' });
    req.permission = rule;                                                     // controller reads ownership rule
    next();
  };
}
module.exports = { PERMISSIONS, requirePermission };
```

```js
// backend/src/routes/requests.routes.js — wiring stays declarative
router.use(authJwt);
router.get('/', requirePermission('request.list'), rc.list);
router.get('/:id', requirePermission('request.get'), rc.getOne);   // controller enforces ownership after load
router.post('/:id/cancel', requirePermission('request.cancel'), rc.cancel);
```

**Placement decision:** *not* scattered `requireRole(...)` additions per CONCERNS ("Scattered authorization checks… new routes default to auth-only — that's how `cancel`/`remove` shipped unprotected"). Existing `requireRole` call sites in `users.routes.js` can stay or migrate opportunistically — both delegate to the same map long-term. Shared visibility logic (`own + inVoting` scope) must be one helper reused by `requestController.list/getOne` **and** `reports.routes.js scopeFilter` — they currently encode it twice (CONCERNS evidence).

### Pattern 2: In-process interval scheduler started from `server.js`

**What:** One `scheduler.js` that wraps each job in `setInterval` with a re-entrancy guard; called once from `server.js` after `app.listen`.
**When:** Single-instance deploy (current compose: one `node src/server.js` via `exec` in `docker-entrypoint.sh`) with two fixed-period jobs.
**Trade-offs:** (+) zero new dependencies, zero compose/entrypoint changes, jobs share the Prisma singleton and logger; (−) not durable across restarts mid-run (acceptable: both jobs are idempotent — `closeVoting` is idempotent, queue rows carry `attempts`); (−) >1 replica would double-run jobs — already an acknowledged single-process assumption (CONCERNS "Scaling Limits"), unchanged by this milestone.

```js
// backend/src/jobs/scheduler.js — decision: setInterval, NOT node-cron, NOT a separate process
const logger = require('../config/logger');
const { processQueue } = require('../services/emailService');
const { closeExpired } = require('./votingCloser');   // requires fixed to ../ — prerequisite

function run(name, fn, everyMs) {
  let running = false;
  const tick = async () => {
    if (running) return;                                // skip re-entrant runs
    running = true;
    try { const n = await fn(); logger.info({ job: name, n }, 'job tick'); }
    catch (e) { logger.error({ job: name, err: e.message }, 'job failed'); }
    finally { running = false; }
  };
  setInterval(tick, everyMs);
  return tick;
}
function startJobs() {
  run('email-queue', () => processQueue(10), 60 * 1000);          // drain every 60s
  run('voting-close', () => closeExpired(), 5 * 60 * 1000);       // every 5 min (CONCERNS suggestion)
}
module.exports = { startJobs };
```

**Rejected alternatives:** `node-cron` adds a dependency for cron syntax neither job needs (fixed periods, no calendar schedules); a separate process would require a second container in `compose.yaml` or a supervisor in `docker-entrypoint.sh` — an infra change outside "fixes only". Manual runs keep the existing `require.main === module` guard in `votingCloser.js`. **Placement: `server.js`, never `app.js`** — `app.js` is the factory (imported by potential supertest tests); starting timers there would leak intervals into test runs.

### Pattern 3: Single-flight 401 refresh interceptor on the shared axios instance

**What:** Response interceptor on `frontend/src/services/api.js`'s single instance: on 401 (excluding the refresh/login/logout calls themselves and already-retried requests), call `POST /auth/refresh` behind one module-level promise, then replay the original request once; only refresh-failure clears auth and navigates to `/login`.
**When:** Always-on for this app — access cookie is 15 min, refresh is 7 d, and the backend `POST /auth/refresh` already exists and works (`authController.refresh` sets a fresh access cookie).
**Trade-offs:** (+) one place fixes every current and future view; single-flight prevents N parallel 401s from stampeding `/refresh`; (−) api.js must not import `router` — `router/index.js` → views → `services/api.js` would form an import cycle; redirect on refresh-failure uses `window.location.assign('/login')` (acceptable: full reload, state cleared) or a callback registered from `main.js`.

```js
// frontend/src/services/api.js (ESM)
import axios from 'axios';
export const api = axios.create({ baseURL: '/api', withCredentials: true });

let refreshPromise = null; // single-flight
api.response.use(
  (r) => r,
  async (error) => {
    const cfg = error.config || {};
    const url = cfg.url || '';
    const isAuthFlow = url.includes('/auth/login') || url.includes('/auth/refresh') || url.includes('/auth/logout');
    if (error.response?.status === 401 && !cfg._retry && !isAuthFlow) {
      cfg._retry = true;
      if (!refreshPromise) {
        refreshPromise = api.post('/auth/refresh')
          .then(() => { refreshPromise = null; return true; })
          .catch((e) => { refreshPromise = null; throw e; });
      }
      try { await refreshPromise; return api.request(cfg); } // replay once
      catch { window.location.assign('/login'); }            // no router import (avoids cycle)
    }
    return Promise.reject(error);
  }
);
```

**Placement decision:** interceptor in `api.js`; the **router guard keeps only navigation concerns** (`meta.auth`, `meta.roles`, and the `mustChangePassword` redirect — fill the empty branch at `frontend/src/router/index.js:28-30`). The backend half of this fix is zero: `POST /api/auth/refresh` already issues the cookie.

### Pattern 4: Transaction-safe balance updates WITHOUT raw SQL

**What:** Inside each existing `prisma.$transaction(async (tx) => …)` block, replace "read balance → check in JS → unconditional decrement" with a **conditional atomic `updateMany`** (`WHERE availableCents >= amount`), throw on `count === 0` to roll back; move *all* balance/annual reads inside the transaction; optionally add `{ isolationLevel: 'Serializable' }` for the annual-cap aggregate read.
**When:** The 5 money-write sites: `requestController.submit`, `votingService.closeVoting`, `votingController.collegiateDecision`, `financeController.markSpent`/`reverseProvision`, `settingsController.patchBalance`.
**Trade-offs:** (+) `updateMany` with a `gte` guard is a single atomic UPDATE — under READ COMMITTED Postgres re-evaluates the WHERE after lock waits, so concurrent spenders can't both pass; (+) **no raw SQL** — `SELECT … FOR UPDATE` via `$queryRaw` is forbidden by the project's danger-zone rule, which is exactly why the conditional-update pattern wins over the textbook row lock; (−) the per-requester annual cap is an aggregate — it can't be expressed as a row guard, so `submit` also needs the annual read *inside* the transaction, with `Serializable` isolation (+ retry on Prisma `P2034`) as the belt-and-suspenders option.

```js
// requestController.submit — TOCTOU closed: guard is part of the UPDATE, not a prior read
const updated = await prisma.$transaction(async (tx) => {
  const bal = await tx.fundBalance.updateMany({          // atomic conditional decrement
    where: { referenceYear, availableCents: { gte: r.requestedAmountCents } },
    data: { availableCents: { decrement: r.requestedAmountCents },
            provisionedCents: { increment: r.requestedAmountCents },
            version: { increment: 1 } },
  });
  if (bal.count === 0) throw Object.assign(new Error('Saldo insuficiente'), { status: 409 });
  const annual = await annualTotalCents(tx, …);          // read INSIDE tx; include CONCLUIDO (bug fix)
  if (annual + r.requestedAmountCents > limitCents) throw Object.assign(new Error('Limite anual excedido'), { status: 409 });
  await tx.resourceRequest.update({ … status: 'APROVADO_AUTOMATICAMENTE' … });
  await tx.financialTransaction.create({ … PROVISION … });
  // annualTotalCents must also run under serializable isolation or re-check — see research flag
}, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
```

**Placement decision:** apply **in place** in each existing `$transaction` block — the milestone explicitly excludes "balance service extraction" as tech debt; the conditional-update edit is mechanical per site, so a new abstraction is only justified if the fix naturally converges all 5 sites (then a minimal `services/balanceService.js` with `provision/spend/reverse` is the allowed "touch where a bug fix requires it" exception — decide during planning, not here). Also: `settingsController.patchBalance` currently writes `fundBalance.upsert` + `financialTransaction.create` as **two separate operations with no transaction** — wrapping them in `$transaction` is part of this fix. `FundBalance.version` becomes a real write-through counter (today it increments but nothing reads it).

### Pattern 5: Two-job CI with per-package `working-directory`

**What:** One workflow, two independent jobs; no workspace tooling (repo has none).
**When:** First commit of the milestone — CONCERNS flags "no CI" as the reason these bugs shipped, and `PROJECT.md` calls CI the regression gate.
**Trade-offs:** (+) jobs run in parallel, cache keyed per lockfile, failures isolated; (−) if DB-backed tests are added later (authorization/`$transaction` integration tests), the backend job needs a `postgres` service container + `DATABASE_URL` env — today's 17 tests are pure unit, so v1 of the workflow needs no services (research flag for the tests phase).

```yaml
# .github/workflows/ci.yml
name: ci
on: [push, pull_request]
jobs:
  backend:
    runs-on: ubuntu-latest
    defaults: { run: { working-directory: backend } }
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 22, cache: npm, cache-dependency-path: backend/package-lock.json }
      - run: npm ci
      - run: npx vitest run
  frontend:
    runs-on: ubuntu-latest
    defaults: { run: { working-directory: frontend } }
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 22, cache: npm, cache-dependency-path: frontend/package-lock.json }
      - run: npm ci
      - run: npm run build
```

Commands match `AGENTS.md` exactly — no invented lint/typecheck steps.

## Data Flow

### Request flow after hardening (direction: top → bottom)

```
View action
  ↓ (axios, shared instance)
api.js interceptor ── 401? ──→ /auth/refresh (single-flight) → retry once → /login on failure
  ↓                                          ↑ cookie set by authController.refresh
Vite proxy / prod same-origin
  ↓
app.js: helmet → cors → json → cookie-parser → pino-http → [trust proxy]
  ↓
route: authJwt (verify cookie, load user, ↳ mustChangePassword 403 unless allowlist)
  ↓
route: requirePermission('<action>')  ← PERMISSIONS map ← docs/06-permissoes.md
  ↓                                    (403 fail-closed if action undeclared)
route: rateLimit (auth mutations only)
  ↓
controller: load row → enforce ownership (req.permission.ownership) → call service
  ↓                                     ↳ audit() after state change (fail-open)
service: domain rule (calc, tally, close, annual limit) with reads INSIDE $transaction
  ↓
prisma: conditional updateMany (gte guard) + FinancialTransaction insert — one $transaction
  ↓
Postgres → JSON response → interceptor passthrough → view
```

**Direction is strict:** middleware never queries rows it doesn't need (authJwt's user lookup is the only pre-controller DB read); controllers never bypass services for rules; services never see `req`/`res`; frontend never decides authority (docs/04 principle, unchanged).

### Job flow

```
server.js boot → createApp() → listen → startJobs()
  scheduler.js setInterval (60s / 5min), re-entrancy-guarded
    ├→ emailService.processQueue() → EmailQueue rows → nodemailer (or log if SMTP off)
    │    ↳ GIVE_UP row → alert path per docs/14 (admin notification — not just logger.error)
    └→ jobs/votingCloser.closeExpired() → closeVoting(id, 'system-cron')
         ↳ status machine → $transaction (tally + conditional balance update)
```

Job → service → Prisma, i.e., jobs reuse the exact same domain layer as HTTP handlers — no second implementation of close/provision logic.

### Balance mutation flow (the race fix, before → after)

```
BEFORE (TOCTOU):  read balance (outside tx) → check in JS → $transaction { unconditional decrement }
                  two concurrent requests can both pass the check → negative balance
AFTER:            $transaction { updateMany WHERE availableCents >= x → count 0 ⇒ throw ⇒ rollback
                                 annual total read inside tx (serializable for submit)
                                 + FinancialTransaction row } ⇒ atomic, DB-enforced guard
```

## Scaling Considerations

| Scale | Architecture adjustments |
|-------|--------------------------|
| Current (single container, ≤1 replica) | All patterns above as written — in-process scheduler, in-memory rate-limit store, conditional updates |
| >1 replica (NOT this milestone) | Scheduler needs single-leader election or a `SELECT … SKIP LOCKED` job claim; rate-limit needs a shared store; CI unchanged |
| List/report growth | Silent `take:` caps (100/500/2000) become wrong totals → pagination (already logged as out of scope) |

### Scaling Priorities

1. **First bottleneck:** none at current volume — the *correctness* fixes (race, authz) are what production-readiness requires, not throughput.
2. **If scaling ever happens:** the in-process scheduler is the first piece that breaks (double-run), the in-memory rate limiter second — both are acknowledged single-process assumptions, unchanged by this milestone.

## Anti-Patterns

### Anti-Pattern 1: Patching authorization endpoint-by-endpoint in controllers

**What people do:** add `if (role !== …)` inside each vulnerable controller function, leaving `requireRole` at routes for some and inline checks for others.
**Why it's wrong:** this is the existing shape and it failed — CONCERNS: "scattered authorization… new routes default to auth-only — that's how `cancel`/`remove` shipped unprotected"; `docs/06` explicitly warns against it.
**Do this instead:** one `requirePermission` map at the route layer + row-level ownership in controllers, plus a test that asserts every route declares an action.

### Anti-Pattern 2: Scheduling jobs in `app.js` or adding node-cron

**What people do:** put `setInterval` in the app factory (or pull in node-cron) so "jobs live with the app".
**Why it's wrong:** `app.js` is imported by tests — intervals would leak into test runs and double-run; node-cron adds a dependency with no durability gain for two fixed-period jobs.
**Do this instead:** `jobs/scheduler.js` called from `server.js` only (Pattern 2).

### Anti-Pattern 3: Refresh handling in views/stores or importing `router` into `api.js`

**What people do:** each view catches 401 and redirects, or api.js imports the router for a clean `router.push`.
**Why it's wrong:** per-view handling is the current drift (CONCERNS "Frontend error/refresh handling"); importing router into api.js creates an import cycle (router → views → api → router).
**Do this instead:** one interceptor in `api.js` with single-flight refresh; redirect via `window.location.assign('/login')` or a callback registered in `main.js`.

### Anti-Pattern 4: `SELECT … FOR UPDATE` via `$queryRaw`, or check-then-decrement

**What people do:** reach for `tx.$queryRaw` row locks (textbook fix) — or keep the current read-check-decrement "because it's in a transaction".
**Why it's wrong:** raw SQL is a project danger zone (PROJECT.md/AGENTS.md "Sem SQL raw"); read-check-decrement inside READ COMMITTED is exactly the TOCTOU bug CONCERNS documents (negative balances, double provisioning).
**Do this instead:** conditional `updateMany` with `gte` guard, reads moved inside the transaction, serializable isolation for the annual-cap aggregate (Pattern 4).

### Anti-Pattern 5: CI with workspace tooling, matrix gymnastics, or invented commands

**What people do:** add npm workspaces/pnpm turborepo "to make CI easier", or add lint/typecheck jobs that don't exist locally.
**Why it's wrong:** repo is deliberately two independent packages; `AGENTS.md` forbids inventing verification commands.
**Do this instead:** two flat jobs with `working-directory` running exactly `npx vitest run` and `npm run build` (Pattern 5).

## Integration Points

### Internal Boundaries

| Boundary | Communication | Hardening-relevant notes |
|----------|---------------|--------------------------|
| route ↔ middleware | ordered chain: authJwt → requirePermission → rateLimit → controller | New permission file slots between existing `authJwt` and handlers; no controller signature changes |
| controller ↔ service | direct function calls (CommonJS require) | Row-level ownership checks stay controller-side; rules stay service-side — don't push `req.user` into services |
| controller ↔ prisma | `$transaction` blocks | All 5 money sites keep their transactions; only the *guard mechanism* inside changes |
| jobs ↔ services | direct calls | Jobs must reuse `closeVoting`/`processQueue`, not reimplement |
| api.js ↔ router | **must stay acyclic** | Interceptor cannot import router (Pattern 3) |
| email writers ↔ queue | `enqueue()` from auth/user controllers; `processQueue()` from scheduler only | Single consumer prevents double-send if jobs are ever parallelized |
| reports ↔ requests scope | shared visibility helper | `reports.scopeFilter` and `requestController.list/getOne` must call ONE function (fix duplicates rule) |
| CI ↔ packages | `working-directory` per job | No cross-package coupling; backend job may need `postgres` service once DB tests exist (research flag) |

## Build Order (dependencies for the roadmap)

Ordering rationale: gates first, foundations before the fixes that ride on them, rule decisions before rule-dependent code.

1. **CI (Pattern 5)** — first, because CONCERNS names it the missing regression gate; pure additive, no code risk. Existing 17 tests + `npm run build` must be green before anything else moves.
2. **Config fail-fast layer** (`env.js` production secret refusal, `app.js` `trust proxy`, `tokens.js` cookie-secure resolution) — foundational boot/deploy behavior; independent of everything; land early so later auth work tests against it.
3. **Authorization layer (Pattern 1):** `permissions.js` map + `requirePermission` wiring → *then* fix `cancel`, `remove`, `getOne`/`list` (shared scope helper), `listVotes`, settings `transactions`, `force-password-reset` (+ `canManageUsers`) → *then* tests asserting 403/404 for cross-user access. **Layer before its tests** — tests encode the map; writing tests first would encode the current scattered behavior. `mustChangePassword` 403 joins this phase (same file, `authJwt`).
4. **Frontend session refresh (Pattern 3)** — independent of backend (refresh endpoint works today); pairs with the router-guard `mustChangePassword` branch.
5. **Voting & finance rule fixes** — requires the `docs/14` decisions *first* (partial approval, cancellation-after-approval), then: tie-break (`votingService`/`votingController`), `annualTotalCents` + `CONCLUIDO` (`requestService`, unit-testable immediately), balance conditional updates (Pattern 4, all 5 sites together — they share the pattern and should land as one change for review coherence).
6. **Job scheduler (Pattern 2)** — prerequisite: fix `votingCloser.js` requires; then `scheduler.js` + `server.js` wiring + email give-up alert path. Lands after voting fixes so `closeExpired` runs the corrected state machine (tie-break resolution inside auto-close).
7. **Reports/audit hardening** — audit-before-stream in CSV/JSON branches, CSV formula escaping, `smtpConfigured` reality check; independent, low-risk, last before verification.
8. **Auth hardening polish** — rate-limits on all auth mutation routes, uniform 401 login responses; depends on (2) for `trust proxy` correctness.

**Research flags for phases:**
- **Balance/finance phase:** Prisma `Serializable` isolation + `P2034` retry semantics need phase-specific verification against Prisma 5 docs (digest confidence MEDIUM), and it must be decided whether DB-backed tests are in scope — that decision changes the CI workflow (postgres service container).
- **Authorization test phase:** supertest is installed but unused; wiring HTTP-level tests requires deciding the DB story (mock Prisma vs test Postgres) — needs a spike, not assumed.
- **Job scheduler phase:** standard patterns, unlikely to need research (LOW-complexity `setInterval` wrapper); only the `docs/14` admin-alert channel choice is an open product decision.
- **Cookie/HTTPS phase:** deployment-topology decision (reverse proxy TLS vs `COOKIE_SECURE` env) — product/ops decision, documented in compose env rather than researched.

## Sources

- **In-repo (HIGH — direct code evidence):** `.planning/codebase/ARCHITECTURE.md`, `.planning/codebase/CONCERNS.md` (bug/race/anti-pattern evidence, mapped at commit b3837b7), `backend/src/{app,server}.js`, `backend/src/middlewares/{auth,validate}.js`, `backend/src/routes/*.js`, `backend/src/services/{votingService,requestService,emailService,auditService}.js`, `backend/src/controllers/{requestController,votingController,financeController,settingsController,authController}.js`, `backend/src/jobs/votingCloser.js`, `backend/src/utils/tokens.js`, `backend/src/config/env.js`, `frontend/src/{services/api.js,router/index.js,stores/auth.js}`, `docs/06-permissoes.md`, `docs/03-regras-de-negocio.md`, `docs/14-decisoes-em-aberto.md`, `AGENTS.md`, `PROJECT.md`.
- **Research digests (via research-plan seam; tiers from `classify-confidence`):**
  - Prisma concurrency patterns (conditional `updateMany`/version/precondition, reads-in-tx) — provider `context7`, tier **MEDIUM**, corroborated in-repo by CONCERNS "Fund-balance TOCTOU race" recommendation.
  - Single-instance scheduler: `setInterval` from `server.js` vs node-cron vs separate process — provider `brave`, tier LOW unverified → **MEDIUM** cross-checked (CONCERNS recommends setInterval/5-min for `closeExpired`; compose entrypoint confirms single process).
  - axios 401 single-flight refresh interceptor — provider `brave`, tier LOW unverified → **MEDIUM** cross-checked (CONCERNS confirms no interceptor exists; backend refresh endpoint verified in `authController.refresh`).
  - Two-package CI via per-job `working-directory` — provider `brave`, tier LOW unverified → **MEDIUM** cross-checked (command set verified verbatim against `AGENTS.md`).

---
*Architecture research for: SGRF production-hardening milestone*
*Researched: 2026-09-23*
