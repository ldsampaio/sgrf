---
last_mapped_commit: b3837b7e16bf00622f1be01d8316a0290affc7f6
last_mapped_at: 2026-09-23
---
# Codebase Structure

**Analysis Date:** 2026-09-22

## Directory Layout

```
sgrf/
├── backend/                 # Node 22 + Express + Prisma API (CommonJS, own package.json)
│   ├── src/
│   │   ├── server.js        # Entry: createApp() + listen
│   │   ├── app.js           # App factory: middleware, route mounts, SPA fallback, errorHandler
│   │   ├── config/          # env.js (dotenv), db.js (Prisma singleton), logger.js (pino)
│   │   ├── routes/          # 6 *.routes.js routers (auth, users, requests, settings, messages, reports)
│   │   ├── controllers/     # 8 *Controller.js — auth, request, voting, deliberation,
│   │   │                    #   finance, settings, user, userBatch
│   │   ├── services/        # Domain: requestService, votingService, auditService, emailService
│   │   ├── middlewares/     # auth.js (authJwt, requireRole), validate.js (validate, errorHandler)
│   │   ├── jobs/            # votingCloser.js (orphaned/broken — see ARCHITECTURE.md)
│   │   └── utils/           # helpers, tokens, password, batchUsers (Zod)
│   ├── tests/               # Vitest: unit.test.js, batch.test.js, voting.test.js
│   ├── prisma/              # schema.prisma, migrations/, seed.js, seed.dev.js
│   ├── openapi.yaml         # API contract
│   ├── .env.example         # Env template (real .env exists locally — never commit)
│   └── docker-entrypoint.sh # migrate deploy → seed admin → exec server
├── frontend/                # Vue 3 + Vite SPA (ESM, own package.json)
│   ├── index.html           # Vite entry
│   ├── vite.config.js       # port 5173, proxy /api → localhost:3000
│   ├── dist/                # Build output (gitignored; copied into Docker image)
│   └── src/
│       ├── main.js          # createApp + Pinia + router
│       ├── App.vue          # <AppShell><router-view/></AppShell>
│       ├── router/index.js  # Routes + auth/role guards (meta.auth, meta.roles)
│       ├── stores/auth.js   # Only Pinia store (useAuth)
│       ├── services/api.js  # Shared axios instance baseURL '/api', withCredentials
│       ├── views/           # 6 page SFCs: Login, Dashboard, Requests, Council, Reports, Admin
│       ├── components/      # AppShell, StatusBadge, MoneyInput, DateInput, PieChart
│       ├── styles/          # tokens.css, base.css
│       └── utils/masks.js   # Input masks
├── docs/                    # Numbered domain spec 00–15 + DESIGN.md (source of truth for rules)
├── .planning/               # GSD planning state (codebase/ maps live here)
├── Dockerfile               # Multi-stage: Vite build → Node app image (API + static SPA)
├── compose.yaml             # db (postgres:16-alpine) + app; APP_PORT default 8081
├── start-dev.sh             # Dev orchestrator: env, db, migrate, seed, both servers
├── README.md                # Quick start, seeds, deploy notes
└── AGENTS.md                # Verified pitfalls — read before changing backend/infra
```

## Directory Purposes

**`backend/src/`:**

- Purpose: all API source code, layered by role
- Contains: `server.js`/`app.js` entry, then one directory per layer
- Key files: `app.js` (route mounts + middleware order), `config/env.js` (every env var consumed), `middlewares/auth.js` (the only auth gate)

**`backend/src/routes/`:**

- Purpose: URL → handler wiring, auth/role gating, rate limits
- Contains: Express routers suffixed `.routes.js`
- Key files: `requests.routes.js` is the largest — fans out to 4 controllers (`requestController`, `votingController`, `deliberationController`, `financeController`)

**`backend/src/controllers/`:**

- Purpose: per-request orchestration (checks → Prisma/services → audit → respond)
- Contains: `authController.js`, `requestController.js`, `votingController.js`, `deliberationController.js`, `financeController.js`, `settingsController.js`, `userController.js`, `userBatchController.js`

**`backend/src/services/`:**

- Purpose: reusable domain logic and cross-cutting write helpers
- Contains: `requestService.js` (amount calc, auto-approval totals, settings/balance getters), `votingService.js` (tally, closeVoting, eligibility), `auditService.js`, `emailService.js`

**`backend/prisma/`:**

- Purpose: schema, migration history, seeds
- Contains: `schema.prisma` (9 models), `migrations/` (run with `npx prisma migrate dev` after schema edits), `seed.js` (deploy admin), `seed.dev.js` (dev mass data, needs `SEED_DEV_CONFIRM=1`)

**`backend/tests/`:**

- Purpose: Vitest suites (`batch`, `unit`, `voting`) — pure-function tests importing `backend/src/**` with ESM specifiers + `.js` extensions

**`frontend/src/`:**

- Purpose: SPA source; pages in `views/`, reusable UI in `components/`, one store, one API client
- Key files: `router/index.js` (guards), `stores/auth.js` (session state), `services/api.js` (all HTTP goes through this instance)

**`docs/`:**

- Purpose: numbered domain specification — rules live here first
- Key files: `03-regras-de-negocio.md`, `04-arquitetura.md`, `06-permissoes.md`, `07-fluxos.md`, `08-api.md`; cross-check against `backend/openapi.yaml`

## Key File Locations

**Entry Points:**

- `backend/src/server.js`: API server (`node src/server.js`)
- `backend/src/app.js`: `createApp()` factory (middleware + mounts + SPA fallback)
- `frontend/src/main.js`: SPA bootstrap (Pinia + router + `App.vue`)
- `backend/prisma/seed.js` / `backend/prisma/seed.dev.js`: DB seeds
- `backend/docker-entrypoint.sh`: container boot (migrate deploy → seed → server)
- `start-dev.sh`: local full-stack startup

**Configuration:**

- `backend/src/config/env.js`: single source for all backend env vars (dotenv; insecure dev fallbacks — production must set `JWT_*`, `INITIAL_ADMIN_*`, `DATABASE_URL`, `FRONTEND_URL`)
- `backend/.env.example`: template (copy to `backend/.env`; never commit `backend/.env`)
- `frontend/vite.config.js`: dev port + `/api` proxy
- `compose.yaml`: services, ports (`APP_PORT`), required secrets
- `Dockerfile`: multi-stage build (frontend build stage → app stage)
- `backend/openapi.yaml`: API documentation contract

**Core Logic:**

- `backend/src/services/requestService.js`: auto-approval rule + `calcAmount` per request type (money in cents)
- `backend/src/services/votingService.js`: tally + idempotent `closeVoting` + eligibility
- `backend/src/controllers/requestController.js`: request lifecycle (create/submit/cancel)
- `backend/src/controllers/financeController.js`: `mark-spent` / `reverse-provision` ledger transitions
- `backend/src/middlewares/auth.js`: `authJwt`, `requireRole`, `canManageUsers`
- `backend/src/utils/tokens.js`: JWT sign/verify + cookie options
- `backend/prisma/schema.prisma`: data model (9 models; UUID String PKs; `*Cents` Int)

**Testing:**

- `backend/tests/unit.test.js`: auth-domain + finance helpers
- `backend/tests/batch.test.js`: batch user parsing/validation
- `backend/tests/voting.test.js`: tally outcomes
- Run: `cd backend && npx vitest run` — frontend has no tests; verify with `npm run build`

## Naming Conventions

**Files:**

- Routes: `<noun>.routes.js` — `backend/src/routes/users.routes.js`
- Controllers: `<noun>Controller.js` — `backend/src/controllers/votingController.js`
- Services: `<noun>Service.js` — `backend/src/services/requestService.js`
- Frontend views/components: `PascalCase.vue` matching the feature — `frontend/src/views/Council.vue`, `frontend/src/components/StatusBadge.vue`
- Frontend JS modules: `camelCase.js` — `frontend/src/services/api.js`
- Tests: `<topic>.test.js` colocated under `backend/tests/` (not co-located with src)

**Directories:**

- Backend layers are plural nouns: `routes/`, `controllers/`, `services/`, `middlewares/`, `utils/`, `jobs/`
- Config is singular: `backend/src/config/`
- Frontend layers: `views/`, `components/`, `stores/`, `services/`, `styles/`, `router/`

**Code identifiers:**

- Functions/variables: `camelCase` everywhere; Vue components `PascalCase`
- Prisma models: `PascalCase` singular (`ResourceRequest`, `FundBalance`); money fields suffixed `Cents` and typed `Int`
- Status/role/type constants: SCREAMING_SNAKE Portuguese — `EM_VOTACAO`, `ADMINISTRADOR`, `AUXILIO_ESTUDANTIL` (string values, validated in code)
- API paths: plural nouns + kebab-case actions — `/api/requests/:id/mark-spent`, `/api/users/batch/preview`
- Module exports: backend CommonJS `module.exports = {...}`; frontend/test ESM `export`/`import`

## Where to Add New Code

**New API endpoint:**

- Router wiring: add to the matching `backend/src/routes/*.routes.js` (create a new `<noun>.routes.js` only for a new noun, then mount it in `backend/src/app.js`)
- Handler: `backend/src/controllers/<noun>Controller.js`
- Domain/query logic: `backend/src/services/<noun>Service.js` — do **not** put query/aggregation logic in the route file (reports route inline style is legacy)
- Auth: `router.use(authJwt)` + `requireRole(...)` at route level; ownership checks in handler
- Audit: call `audit({...})` after every mutation; email: `enqueue(to, subject, body)`
- Spec: update `backend/openapi.yaml` + relevant `docs/08-api.md`

**New database model/field:**

- Edit `backend/prisma/schema.prisma` → `npx prisma migrate dev` (local db via `docker compose up -d db`)
- Money fields: `Int` named `*Cents`; ids: UUID String; no raw SQL

**New frontend page:**

- View: `frontend/src/views/<Name>.vue`
- Route: add entry in `frontend/src/router/index.js` with `meta: { auth: true }` (and `roles` if gated)
- Nav link: add to all three navs in `frontend/src/components/AppShell.vue` (topbar, mobile menu, footer)
- Data: fetch via `api` from `frontend/src/services/api.js` into local `ref`s; session-only global state goes in a new Pinia store under `frontend/src/stores/`

**New shared component:**

- Implementation: `frontend/src/components/<Name>.PascalCase.vue` (e.g., form inputs follow `MoneyInput.vue` / `DateInput.vue` pattern); import explicitly in views (no barrel files)

**New backend utility:**

- Shared helpers: `backend/src/utils/helpers.js` (pure functions — keep them pure, they are unit-tested from `backend/tests/unit.test.js`)
- Env vars: add to `backend/src/config/env.js` with a safe default + document in `backend/.env.example`

**New test:**

- `backend/tests/<topic>.test.js` with `import { ... } from 'vitest'` and ESM imports of source (`../src/...` with explicit `.js` extension); pure-function tests only — no DB/network harness exists yet

## Special Directories

**`.planning/`:**

- Purpose: GSD planning state; `.planning/codebase/` holds this map
- Generated: partially (by GSD commands)
- Committed: per project convention — treat as docs, not source

**`frontend/dist/`:**

- Purpose: Vite build output, served by Express in production (`SERVE_FRONTEND=true`, `FRONTEND_DIST`)
- Generated: yes (`npm run build` / Docker build stage)
- Committed: no (`.gitignore`)

**`backend/uploads/` (gitignored via `backend/uploads/*`, keeps `.gitkeep`):**

- Purpose: local/production file uploads volume (`app-uploads` in `compose.yaml`)
- Generated: yes — no upload endpoint writes here yet (multer in `userBatchController.js` uses memory storage; `RequestFile` model exists)
- Committed: no

**`node_modules/`, `.env`, `*.db*`, `*.log`, `coverage/`:**

- Purpose: dependencies, local secrets, SQLite leftovers, logs
- Generated: yes
- Committed: no (all covered by `.gitignore` — never commit `backend/.env` or `backend/uploads/*`)

**`docs/`:**

- Purpose: numbered domain specification (business rules, permissions, flows, API) + `DESIGN.md`
- Generated: no
- Committed: yes — read `03`/`06`/`07` before touching request/voting/permission logic

---

*Structure analysis: 2026-09-22*
