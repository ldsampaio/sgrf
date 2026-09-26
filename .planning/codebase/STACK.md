---
last_mapped_commit: b3837b7e16bf00622f1be01d8316a0290affc7f6
last_mapped_at: 2026-09-23
---
# Technology Stack

**Analysis Date:** 2026-09-22

## Languages

**Primary:**

- JavaScript (Node.js, CommonJS) — backend API: `backend/src/**` (`"type": "commonjs"` in `backend/package.json`)
- JavaScript (ESM, `<script setup>` Vue SFCs) — frontend SPA: `frontend/src/**` (`"type": "module"` in `frontend/package.json`)

**Secondary:**

- HTML/CSS — `frontend/index.html`, `frontend/src/styles/{base.css,tokens.css}`, styles inside `.vue` SFCs
- Prisma Schema Language — `backend/prisma/schema.prisma`
- SQL — `backend/prisma/migrations/0001_init_pg/`
- Bash — `start-dev.sh`, `backend/docker-entrypoint.sh`
- YAML — `compose.yaml`, `backend/openapi.yaml` (OpenAPI 3.0.3 spec, version 0.2.0)

No TypeScript anywhere; no lint/typecheck tooling configured (per `AGENTS.md` — do not invent those commands).

## Runtime

**Environment:**

- Node.js 22 — pinned by Docker images `node:22-bookworm-slim` (both stages of `Dockerfile`)
- Dev machine currently runs Node v26.9.0 / npm 12.0.2; no `.nvmrc`, no `engines` field in either `package.json`

**Package Manager:**

- npm (no workspaces/monorepo — `backend/` and `frontend/` are two independent packages, see `AGENTS.md`)
- Lockfiles: present — `backend/package-lock.json`, `frontend/package-lock.json`

## Frameworks

**Core:**

- Express 4.22.3 — HTTP API, app factory in `backend/src/app.js`, listener in `backend/src/server.js`
- Vue 3.5.42 — SPA UI (`frontend/src/main.js`), all views in `frontend/src/views/*.vue`
- Vite 5.4.21 + @vitejs/plugin-vue 6.0.9 — dev server (:5173) and production build (`frontend/vite.config.js`)
- vue-router 4.6.4 — history-mode routing with role guards (`frontend/src/router/index.js`)
- Pinia 4.0.3 — state; single store `frontend/src/stores/auth.js`
- Prisma ORM 5.22.0 (`@prisma/client` 5.22.0) — PostgreSQL access, single client instance in `backend/src/config/db.js`

**Testing:**

- Vitest 2.1.9 — backend only, no config file (defaults): `backend/tests/{unit,voting,batch}.test.js`
- supertest 7.2.2 — declared in `backend/package.json` devDependencies but unused in current tests

**Build/Dev:**

- Vite build — `npm run build` in `frontend/`
- Docker multi-stage build — root `Dockerfile` (stage `web` builds SPA, stage `app` runs API + serves `frontend/dist`)
- Docker Compose — root `compose.yaml` (services `app` + `db`)
- `start-dev.sh` — one-shot dev bootstrap (compose `db`, migrate, seed, run both packages)

## Key Dependencies

**Critical:**

- `express` 4.22.3 — route layer: `backend/src/routes/*.routes.js` mounted in `backend/src/app.js` under `/api/auth|users|requests|settings|finance|messages|reports`
- `@prisma/client` 5.22.0 — all persistence (`backend/prisma/schema.prisma`, 10 models: User, DepartmentSettings, FundBalance, ResourceRequest, RequestFile, FinancialTransaction, AuditEvent, EmailQueue, Vote, DeliberationMessage, ViewRequest)
- `jsonwebtoken` 9.0.3 — JWT access (15m) + refresh (7d) tokens in httpOnly cookies (`backend/src/utils/tokens.js`)
- `argon2` 0.41.1 — argon2id password hashing (`backend/src/utils/password.js`)
- `axios` 1.20.0 — single API client `frontend/src/services/api.js` (`baseURL: '/api'`, `withCredentials: true`)
- `vue` 3.5.42 / `pinia` / `vue-router` — entire frontend architecture

**Infrastructure:**

- `helmet` 7.2.0 + `cors` 2.8.6 (origin = `FRONTEND_URL`, credentials true) — security middleware in `backend/src/app.js`
- `express-rate-limit` 7.5.1 — login limiter (20 req / 15 min) in `backend/src/routes/auth.routes.js`
- `cookie-parser` 1.4.7 — reads `access_token` cookie in `backend/src/middlewares/auth.js`
- `pino` 9.14.0 + `pino-http` 10.5.0 — logging with redaction of cookie/password/token fields (`backend/src/config/logger.js`)
- `nodemailer` 6.10.1 — SMTP email transport (`backend/src/services/emailService.js`)
- `pdfkit` 0.20.2 — PDF report export (`backend/src/routes/reports.routes.js`); CSV built by hand in same file
- `multer` 1.4.5-lts.2 — memoryStorage, 1 MB limit, only for batch user upload (`backend/src/controllers/userBatchController.js`)
- `zod` 3.25.76 — schema validation for batch user import (`backend/src/utils/batchUsers.js`) plus `validate()` middleware in `backend/src/middlewares/validate.js`
- `dotenv` 16.6.1 — env loading in `backend/src/config/env.js`
- `chart.js` 4.5.1 — pie charts, tree-shaken registration in `frontend/src/components/PieChart.vue`
- `uuid` 10.0.0 — declared in `backend/package.json` but no `require('uuid')` found in `backend/src/` (Prisma generates UUIDs)

## Configuration

**Environment:**

- Central env module: `backend/src/config/env.js` (loads dotenv, exports typed config)
- `.env` files: `backend/.env` present (contents not read), template `backend/.env.example` present; `.gitignore` excludes `backend/.env` and `.env` variants
- Key vars (names only, from `backend/src/config/env.js`): `PORT` (default 3000), `FRONTEND_URL` (default `http://localhost:5173`), `DATABASE_URL`, `SERVE_FRONTEND`, `FRONTEND_DIST`, `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`, `SMTP_ENABLED/HOST/PORT/SECURE/USER/PASS/FROM`, `INITIAL_ADMIN_EMAIL`, `INITIAL_ADMIN_TEMPORARY_PASSWORD`, plus `LOG_LEVEL` (`backend/src/config/logger.js`) and `NODE_ENV`
- Compose-level vars (`compose.yaml`): `APP_PORT` (default 8081), `DB_PASSWORD`; `JWT_*` and `INITIAL_ADMIN_*` are required (`:?` fails fast if missing)
- Dev fallbacks in `backend/src/config/env.js` are insecure placeholders (`dev-*-secret-change-me-...`) — local-only, never trust outside dev

**Build:**

|- `frontend/vite.config.js` — Vue plugin, dev port 5173, proxy `/api` → `http://localhost:3000`
|- `Dockerfile` — two-stage: SPA build → backend install + `npx prisma generate`, non-root `app` user, `ENTRYPOINT docker-entrypoint.sh` (runs `prisma migrate deploy` + `prisma/seed.js`)
|- `compose.yaml` — single image, `SERVE_FRONTEND=true`, SPA fallback route in `backend/src/app.js`
|- CI: `.github/workflows/ci.yml` — backend (`npx vitest run`) + frontend (`npm run build`) gates on `main`
|- `tools/release-close/` — release-close CLI: verify/plan/apply verbs, gh-client.js real `gh` reads, fake-client.js stub, evidence/classifier/eligibility modules

## Platform Requirements

**Development:**

- `node`, `npm`, `docker` required by `start-dev.sh`
- Local Postgres via `docker compose up -d db` (postgres:16-alpine), migrations via `npx prisma migrate dev`, seeds via `npm run seed` / `SEED_DEV_CONFIRM=1 npm run seed:dev`
- Backend :3000, frontend :5173

**Production:**

- Single Docker image (`node:22-bookworm-slim`, non-root user) + Postgres 16-alpine container, orchestrated by `compose.yaml`
- External port `${APP_PORT:-8081}` → container 3000; Express serves built SPA from `/app/frontend-dist` when `SERVE_FRONTEND=true`
- Volumes: `pgdata` (database), `app-uploads` (`/app/uploads`)

---

*Stack analysis: 2026-09-22*
