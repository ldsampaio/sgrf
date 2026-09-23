---
last_mapped_commit: b3837b7e16bf00622f1be01d8316a0290affc7f6
last_mapped_at: 2026-09-23
---
<!-- refreshed: 2026-09-22 -->

# Architecture

**Analysis Date:** 2026-09-22

## System Overview

```text
┌──────────────────────────────────────────────────────────────────┐
│              Frontend SPA — Vue 3 + Vite (ESM)                   │
│  views/ (Login, Dashboard, Requests, Council, Reports, Admin)     │
│  stores/auth (Pinia) · router/index.js (guards) · services/api.js │
│  `frontend/src/`                                                  │
└───────────────┬──────────────────────────────────────────────────┘
                │ axios baseURL '/api' + withCredentials (cookie JWT)
                │ dev: Vite proxy /api → :3000 · prod: same-origin
                ▼
┌──────────────────────────────────────────────────────────────────┐
│              Express API — Node 22, CommonJS                     │
│  HTTP layer: helmet → cors(FRONTEND_URL, credentials) → json 2mb │
│            → cookie-parser → pino-http        `src/app.js`       │
│  Routes `/api/*` → authJwt / requireRole    `src/routes/*.js`    │
│  Controllers (HTTP + orchestration)       `src/controllers/*.js` │
│  Domain services (rules, audit, email)      `src/services/*.js`   │
│  Utils (tokens, password, helpers, batch)     `src/utils/*.js`    │
└───────────────┬──────────────────────────────────────────────────┘
                │ Prisma Client (singleton `src/config/db.js`)
                ▼
┌──────────────────────────────────────────────────────────────────┐
│  PostgreSQL 16 (docker compose service `db`)                     │
│  prisma/schema.prisma — User, ResourceRequest, FundBalance,      │
│  FinancialTransaction, Vote, AuditEvent, EmailQueue, ...          │
│  UUID String ids · money = Int cents · no raw SQL                │
└──────────────────────────────────────────────────────────────────┘
```

Production is a **single Docker image** (`Dockerfile`): Express serves both the API and the built SPA (`SERVE_FRONTEND=true`, static from `FRONTEND_DIST` + SPA fallback regex in `backend/src/app.js:32-35`), with Postgres in `compose.yaml`.

## Component Responsibilities

| Component | Responsibility | File |
|-----------|----------------|------|
| App factory | Builds Express app, middleware order, mounts all route modules, SPA fallback, error handler | `backend/src/app.js` |
| Server bootstrap | Listens on `env.port` | `backend/src/server.js` |
| Env config | Loads dotenv, exposes typed config with insecure dev fallbacks | `backend/src/config/env.js` |
| Prisma singleton | One `PrismaClient` shared by all layers | `backend/src/config/db.js` |
| Logger | pino with field redaction (cookie/password/token) | `backend/src/config/logger.js` |
| Auth middleware | `authJwt` (cookie JWT → DB user), `requireRole(...)`, `canManageUsers` | `backend/src/middlewares/auth.js` |
| Error middleware | `errorHandler` JSON responder (stack only non-prod); `validate(zodSchema)` exists but is unused by routes | `backend/src/middlewares/validate.js` |
| Request domain | Auto-approval rule, per-type amount calc, settings/balance lazy getters | `backend/src/services/requestService.js` |
| Voting domain | Eligibility, tally (simple majority, no quorum), idempotent `closeVoting` | `backend/src/services/votingService.js` |
| Audit | Writes `AuditEvent`, never throws (fail-open, logs via pino) | `backend/src/services/auditService.js` |
| Email | DB-backed queue (`enqueue` → `EmailQueue`), nodemailer `processQueue` (never scheduled — see Anti-Patterns) | `backend/src/services/emailService.js` |
| Financial ops | `mark-spent` / `reverse-provision` state transitions, idempotent | `backend/src/controllers/financeController.js` |
| Reports | Inline CSV/PDF (pdfkit) + dashboard aggregation routes | `backend/src/routes/reports.routes.js` |
| Auth controller | Login/lockout/refresh/logout/password flows | `backend/src/controllers/authController.js` |
| Auth tokens | Sign/verify 15m access + 7d refresh JWT, cookie options | `backend/src/utils/tokens.js` |
| Layout shell | Topbar/nav/footer with role-gated links, wraps `<router-view/>` | `frontend/src/components/AppShell.vue` |
| Router guard | `meta.auth` / `meta.roles` enforcement, loads `auth.me()` | `frontend/src/router/index.js` |
| API client | Shared axios instance `baseURL: '/api'`, `withCredentials: true` | `frontend/src/services/api.js` |

## Pattern Overview

**Overall:** Modular monolith, MVC-ish layered backend (routes → controllers → services → Prisma) + Vue SPA frontend. Spec-aligned with `docs/04-arquitetura.md`.

**Key Characteristics:**

- Layered but **not strictly enforced**: controllers often call Prisma directly; services hold only the extracted domain rules (calc, tally, close). `backend/src/routes/reports.routes.js` puts full controller logic inline in the route file.
- **Transaction-gated money movements**: every balance change runs inside `prisma.$transaction` writing both `FundBalance` (with `version` increment) and a `FinancialTransaction` ledger row.
- **Idempotent commands**: `closeVoting` (`backend/src/services/votingService.js:60`), `mark-spent` (`backend/src/controllers/financeController.js:23`), deploy seed (`backend/prisma/seed.js`).
- **Fail-open audit**: `audit()` swallows its own errors and logs (`backend/src/services/auditService.js:17-20`).
- Business rules live in backend only; frontend has no decision authority (per `docs/04-arquitetura.md` principles).

## Layers

**Presentation (frontend):**

- Purpose: render UI, collect input, display server decisions
- Location: `frontend/src/views/`, `frontend/src/components/`
- Contains: SFC views per page, shared components (`AppShell`, `StatusBadge`, `MoneyInput`, `DateInput`, `PieChart`), CSS design tokens (`frontend/src/styles/tokens.css`, `base.css`)
- Depends on: `frontend/src/services/api.js` (axios), Pinia `frontend/src/stores/auth.js`, `vue-router`
- Used by: `frontend/index.html` → `frontend/src/main.js`

**HTTP layer (routes):**

- Purpose: URL mapping, auth/role gating, rate limiting (login: 20/15min in `backend/src/routes/auth.routes.js:7`)
- Location: `backend/src/routes/` — `auth|users|requests|settings|messages|reports.routes.js`
- Contains: Express routers; `requests.routes.js` fans out to four controllers (`requestController`, `votingController`, `deliberationController`, `financeController`)
- Depends on: middlewares, controllers
- Used by: `backend/src/app.js` (`/api/auth|users|requests|settings|finance|messages|reports`)

**Controllers (orchestration):**

- Purpose: parse request, run rules, call Prisma/services, audit, enqueue email, respond
- Location: `backend/src/controllers/` — `authController`, `requestController`, `userController`, `userBatchController`, `settingsController`, `votingController`, `deliberationController`, `financeController`
- Depends on: `backend/src/config/db.js`, services, utils
- Used by: routes

**Domain services:**

- Purpose: reusable business rules (amount calc, auto-approval totals, vote tally/close, audit, email queue)
- Location: `backend/src/services/`
- Depends on: Prisma, env, logger
- Used by: controllers (and tests)

**Persistence:**

- Purpose: schema + migrations
- Location: `backend/prisma/schema.prisma`, `backend/prisma/migrations/`
- Constraints: PostgreSQL, UUID String PKs, money `Int` **cents**, enums as String validated in code/Zod, **no raw SQL**

## Data Flow

### Primary Request Path (submit → auto-approval)

1. SPA calls `POST /api/requests/:id/submit` via axios (`frontend/src/services/api.js`)
2. Global middleware: helmet → cors → json → cookie-parser → pino-http (`backend/src/app.js:14-18`)
3. `authJwt` reads `access_token` cookie, verifies JWT, loads user from DB, sets `req.user` (`backend/src/middlewares/auth.js:4-16`)
4. `submit` handler: ownership/status checks → `getSettings()` + `annualTotalCents()` + `getBalance()` (`backend/src/services/requestService.js`)
5. Rule: `annual + new <= automaticApprovalLimitCents` **and** balance ≥ amount → `APROVADO_AUTOMATICAMENTE`, else `EM_VOTACAO` with `votingDeadlineAt` (`backend/src/controllers/requestController.js:66-72`)
6. `prisma.$transaction`: update request + decrement `availableCents` / increment `provisionedCents` + `version++` + insert `PROVISION` ledger row (`backend/src/controllers/requestController.js:75-94`)
7. Post-commit: `audit(...)` → `enqueue(email)` → JSON response with `annualTotalCents` / `limit`

### Voting close path

1. Manual `POST /api/requests/:id/close-voting` or expired deadline → `closeVoting(requestId, performedBy)` (`backend/src/services/votingService.js:60`)
2. Eligibility/status guards (423 if suspended, idempotent if already decided)
3. `tally(votes)` — simple majority of valid votes, abstentions ignored, tie → `EMPATE` (`backend/src/services/votingService.js:29-49`)
4. Transaction: set status (`APROVADO` / `APROVADO_PARCIALMENTE` / `INDEFERIDO` / `AGUARDANDO_DESEMPATE`), provision on approval, finalize votes (`backend/src/services/votingService.js:90-110`)

### Auth flow

1. `POST /api/auth/login` — institutional email only, argon2 verify, lockout after 5 fails / 15 min (`backend/src/controllers/authController.js:9-45`)
2. Sets `access_token` (15m) + `refresh_token` (7d) httpOnly cookies (`backend/src/utils/tokens.js:20-25`)
3. Every API call carries cookie; `POST /api/auth/refresh` re-issues access; router guard calls `GET /auth/me` on first navigation (`frontend/src/router/index.js:23-31`)

**State Management:**

- Frontend: single Pinia store `auth` (`frontend/src/stores/auth.js`); all other data fetched per-view into local `ref`s (no global data store)
- Backend: stateless HTTP; all state in Postgres; env loaded once at boot

## Key Abstractions

**ResourceRequest status machine:**

- Represents: lifecycle of a departmental funding request
- Examples: `backend/prisma/schema.prisma:57-90`, transitions in `backend/src/controllers/requestController.js` and `backend/src/services/votingService.js`
- Pattern: String status constants (SCREAMING_SNAKE Portuguese): `RASCUNHO` → `EM_VOTACAO` → `APROVADO_AUTOMATICAMENTE` | `APROVADO` | `APROVADO_PARCIALMENTE` | `INDEFERIDO` | `AGUARDANDO_DESEMPATE` | `SUSPENSO_REUNIAO_ORDINARIA` → `CONCLUIDO` / `CANCELADO`

**Money-as-cents:**

- Represents: all monetary values as integer cents
- Examples: `FundBalance.availableCents`, `ResourceRequest.requestedAmountCents`, `toCents()` in `backend/src/utils/helpers.js:9`
- Pattern: convert at boundary (`calcAmount`), format at render (`brl()` in views, `formatBRL` in helpers). Never floats.

**Financial ledger:**

- Represents: append-only state transitions DISPONIVEL → PROVISIONADO → GASTO
- Examples: `backend/src/controllers/financeController.js`, model `FinancialTransaction` in `backend/prisma/schema.prisma:106-117`
- Pattern: always alongside `FundBalance` update inside one `$transaction`, with `version` increment

**Role constants:**

- Represents: `ADMINISTRADOR | CHEFE_DEPARTAMENTO | CONSELHEIRO | PROFESSOR | ALUNO`
- Examples: `requireRole(...)` in routes, inline role checks in controllers, `meta.roles` in `frontend/src/router/index.js:19`, nav gating in `frontend/src/components/AppShell.vue:10`
- Pattern: gate at route level where possible; controllers re-check ownership inline

## Entry Points

**Backend API server:**

- Location: `backend/src/server.js` (via `npm run dev` / `npm start` → `node src/server.js`)
- Triggers: start-dev.sh, Docker `CMD`, container entrypoint
- Responsibilities: `createApp()` + listen on `PORT` (default 3000)

**App factory:**

- Location: `backend/src/app.js` (`createApp()`)
- Triggers: `server.js`; usable by supertest (devDependency present, currently unused by tests)
- Responsibilities: middleware stack, route mounts, SPA fallback, error handler

**Seeds:**

- Location: `backend/prisma/seed.js` (deploy: admin only), `backend/prisma/seed.dev.js` (dev mass data, requires `SEED_DEV_CONFIRM=1`)
- Triggers: `npm run seed` / `npm run seed:dev`, docker-entrypoint (`node prisma/seed.js || true`)
- Responsibilities: idempotent bootstrap of initial admin from `INITIAL_ADMIN_*` env

**Job script (orphaned):**

- Location: `backend/src/jobs/votingCloser.js`
- Triggers: intended cron/manual (`require.main === module` guard) — **not referenced anywhere in the repo, and its relative requires are broken** (see Anti-Patterns)
- Responsibilities: close expired `EM_VOTACAO` requests (batches of 50)

**Container entrypoint:**

- Location: `backend/docker-entrypoint.sh`
- Triggers: Docker `ENTRYPOINT`
- Responsibilities: `npx prisma migrate deploy` → idempotent admin seed → `exec node src/server.js`

**Frontend SPA:**

- Location: `frontend/index.html` → `frontend/src/main.js`
- Triggers: Vite dev server (`npm run dev`, port 5173) or static serving by Express in prod
- Responsibilities: install Pinia + router, mount `App.vue` (wraps everything in `AppShell`)

**Dev orchestrator:**

- Location: `start-dev.sh`
- Triggers: manual
- Responsibilities: ensure `backend/.env` from `.env.example`, start `db` container, install + migrate + seed, run backend and frontend concurrently

## Architectural Constraints

- **Threading:** single Node process, single-threaded event loop; no worker threads. All heavy work (PDF generation in `backend/src/routes/reports.routes.js`, batch confirm loop in `backend/src/controllers/userBatchController.js`) runs inline in request handlers.
- **Global state:** module singletons — `PrismaClient` (`backend/src/config/db.js`), memoized nodemailer transporter (`backend/src/services/emailService.js:6-16`), `env` object loaded once (`backend/src/config/env.js`). Lazy singleton DB rows: `DepartmentSettings` id `'default'`, `FundBalance` per year, both create-on-miss in `backend/src/services/requestService.js:17-27`.
- **Circular imports:** none observed; services/utils import only config + Prisma. `auditService` requires the logger lazily inside its catch block to stay decoupled (`backend/src/services/auditService.js:19`).
- **Module systems:** backend is CommonJS (`"type": "commonjs"`), frontend + tests are ESM (Vitest transpiles ESM test files importing CJS source — keep exports CJS-shaped in `backend/src/`).
- **Same-origin auth:** JWT cookies are `sameSite: 'lax'`; architecture assumes `/api` is same-origin (Vite proxy in dev, Express static in prod). A cross-origin frontend requires correct `FRONTEND_URL` + credentials CORS (already wired).
- **No workspace:** two independent packages; run all commands inside `backend/` or `frontend/` (see `AGENTS.md`).
- **No CI, no lint, no typecheck:** verification is `npx vitest run` (backend) + `npm run build` (frontend) only.

## Anti-Patterns

### Orphaned job with broken requires

**What happens:** `backend/src/jobs/votingCloser.js` requires `./config/db`, `./config/logger`, `./services/votingService` — resolved relative to `src/jobs/`, these paths do not exist (should be `../...`). The file is referenced nowhere else in the repo (no cron, no script, no import).
**Why it's wrong:** executing it crashes with MODULE_NOT_FOUND; expired votings are never auto-closed in production — deadline enforcement depends entirely on someone manually calling `close-voting`.
**Do this instead:** fix requires to `../config/db` etc., then wire it — either an npm script (`node src/jobs/votingCloser.js`) run by cron, or a `setInterval` loop started in `backend/src/server.js`.

### Email queue never drains

**What happens:** `emailService.enqueue()` inserts rows into `EmailQueue` on login resets, submissions, batch invites — but `processQueue()` is exported and never called anywhere.
**Why it's wrong:** the `EmailQueue` table grows unboundedly; even with `SMTP_ENABLED=true`, queued mail would never send.
**Do this instead:** invoke `processQueue()` from the same scheduled job runner as `closeExpired()` (e.g., a `setInterval` in `backend/src/server.js` every minute), and alert when `GIVE_UP` rows appear.

### Business logic leaking into routes/controllers inconsistently

**What happens:** three different placements coexist — extracted domain functions in services (`backend/src/services/votingService.js`), inline rules in controllers (`backend/src/controllers/requestController.js:50-101`), and full query/response logic directly inside route handlers (`backend/src/routes/reports.routes.js`, 193 lines of inline endpoints).
**Why it's wrong:** the same rules (role checks, status guards, `scopeFilter`) get re-implemented per file and drift — e.g., request visibility rules are coded separately in `requestController.list` and `reports.routes.js scopeFilter`.
**Do this instead:** for new endpoints, put query/aggregation logic in `backend/src/services/*Service.js`, keep the route file to wiring only (matching `backend/src/routes/users.routes.js`), and reuse one shared scope/permission helper.

### Dead `validate` middleware

**What happens:** `validate(schema)` + `req.validated` is defined in `backend/src/middlewares/validate.js:1-10` but no route imports it; input checks are manual `if (!field)` statements scattered in controllers. Zod is only used in `backend/src/utils/batchUsers.js`.
**Why it's wrong:** two validation conventions invite inconsistency; error shapes differ between the 400 body of `validate` and ad-hoc checks; `zod` is a dependency paid for but mostly idle.
**Do this instead:** either wire `validate(zodSchema)` per route (pattern already written) and read `req.validated` in controllers, or remove the middleware — pick one convention for new endpoints and follow it.

### Placeholder endpoints shaped like real ones

**What happens:** `GET /:id/history` returns `getOne` (`backend/src/routes/requests.routes.js:15`); `PATCH /settings/email` and `POST /settings/email/test` return hardcoded `{ok:true}` (`backend/src/routes/settings.routes.js:12-13`); `GET /reports/integration/provisioned` returns a "Fase 7 — stub" note (`backend/src/routes/reports.routes.js:101-103`).
**Why it's wrong:** clients cannot distinguish implemented behavior from stubs by the response contract alone; `history` silently returns non-historical data.
**Do this instead:** return explicit stub markers (`note`, `implemented: false`) as the integration stub already does, or gate unfinished routes behind a comment + TODO referencing `docs/13-backlog.md` until implemented.

### Duplicated role gating on the frontend

**What happens:** admin visibility logic (`['ADMINISTRADOR','CHEFE_DEPARTAMENTO'].includes(role)`) is written twice in `frontend/src/router/index.js:19` and again twice in `frontend/src/components/AppShell.vue` (desktop + mobile menus).
**Why it's wrong:** adding a role to a screen requires N edits; drift leaves hidden-but-reachable routes or visible-but-blocked links.
**Do this instead:** define role constants once (e.g., `frontend/src/utils/roles.js`), and derive nav links from a single array consumed by both router and `AppShell`. Backend remains the authority regardless.

## Error Handling

**Strategy:** Express 4 async try/catch → `next(e)` → central `errorHandler` middleware (`backend/src/middlewares/validate.js:13-17`) returns `{ error }` JSON, includes `stack` only when `NODE_ENV !== 'production'`. Domain errors carry `status` via `Object.assign(new Error(...), { status })` (see `backend/src/services/votingService.js:62`) so controllers/handlers can map to HTTP codes.

**Patterns:**

- Per-handler `try { ... } catch (e) { next(e); }` in every controller function (no asyncHandler wrapper)
- Business-rule violations return early with `400/403/404/423` + Portuguese `{ error: '...' }` message instead of throwing
- `423 Locked` = temporarily blocked account or suspended request (read-only)
- Audit failures are swallowed and logged — never break user flows (`backend/src/services/auditService.js`)
- Transaction rollback for any financial inconsistency (throw inside `prisma.$transaction`)

## Cross-Cutting Concerns

**Logging:** pino (`backend/src/config/logger.js`) with redaction of `req.headers.cookie`, `password`, `SMTP_PASS`, `token`; HTTP access logging via `pino-http` in `backend/src/app.js:18`. Job-style `logger.info/error` with structured objects.

**Validation:** Zod used only in `backend/src/utils/batchUsers.js` (batch JSON); elsewhere manual checks in controllers (see Anti-Patterns). Prisma types constrain persistence shape.

**Authentication:** JWT in httpOnly cookies (15m access / 7d refresh, `sameSite: 'lax'`, `secure` in production) — `backend/src/utils/tokens.js`; argon2 hashing (`backend/src/utils/password.js`); institutional `@utfpr.edu.br` only; 5-failure lockout 15 min; mandatory temporary-password change; login rate limit 20/15min (`backend/src/routes/auth.routes.js:7`).

**Authorization:** `requireRole(...)` at route level for coarse gates; ownership + role checks inline in controllers (`canManageUsers` in `backend/src/middlewares/auth.js:27-31`); rules mirror `docs/06-permissoes.md`.

**Auditing:** every mutating flow calls `audit({ actorId, action, entityType, entityId, before/after, req })` → `AuditEvent` with IP + user agent.

**Security headers:** helmet + strict CORS origin with credentials (`backend/src/app.js:14-15`); JSON body limit 2mb; compose fails fast if `JWT_*` / `INITIAL_ADMIN_*` secrets missing (`compose.yaml:35-38`).

---

*Architecture analysis: 2026-09-22*
