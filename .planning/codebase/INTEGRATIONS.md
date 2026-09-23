---
last_mapped_commit: b3837b7e16bf00622f1be01d8316a0290affc7f6
last_mapped_at: 2026-09-23
---
# External Integrations

**Analysis Date:** 2026-09-22

## APIs & External Services

**HTTP calls from app code:**

- None in backend — `backend/src/**` contains no outbound HTTP client calls; all `/api/*` routes are internal Express routes mounted in `backend/src/app.js`

**Frontend-only external resources:**

- Google Fonts (Readex Pro) — `frontend/index.html` (`fonts.googleapis.com` / `fonts.gstatic.com` preconnect + stylesheet); the only third-party runtime dependency of the SPA

**Currency/exchange rates:**

- No FX API integration — exchange rate is a manually maintained setting (`currentExchangeRate` on `DepartmentSettings` in `backend/prisma/schema.prisma`), applied in `backend/src/services/requestService.js` (`calcAmount`, USD → cents conversion). Rate is frozen per request (`ResourceRequest.exchangeRate`).

**API contract:**

- Self-documented OpenAPI 3.0.3 spec at `backend/openapi.yaml` (SGRD API v0.2.0); domain docs in `docs/08-api.md`

## Data Storage

**Databases:**

- PostgreSQL 16 (compose service `db`, image `postgres:16-alpine`, volume `pgdata`)
  - Connection: `DATABASE_URL` env (read in `backend/src/config/env.js`; compose builds it from `DB_PASSWORD`)
  - Client: Prisma Client 5.22.0 — singleton in `backend/src/config/db.js`; schema `backend/prisma/schema.prisma`; migrations `backend/prisma/migrations/` (applied via `prisma migrate dev` in dev, `prisma migrate deploy` in `backend/docker-entrypoint.sh`)
  - Conventions: UUID stored as String, money as integer cents, enums as String + Zod/code validation (schema header comments)
- Legacy SQLite artifact: `backend/prisma/dev.db` exists locally (gitignored, `*.db` in `.gitignore`) — schema is now `provider = "postgresql"`; not used at runtime

**File Storage:**

- Local filesystem only — `backend/uploads/` locally, volume `app-uploads` mounted at `/app/uploads` in `compose.yaml`
- Caveat: `RequestFile` model exists in `backend/prisma/schema.prisma`, but no `backend/src/` code references `RequestFile`/`storageKey` and `backend/uploads/` is empty — file upload persistence is not wired yet. The only upload endpoint is batch-user import (multer memoryStorage, never touches disk): `backend/src/controllers/userBatchController.js` used by `backend/src/routes/users.routes.js`

**Caching:**

- None (no Redis, no in-memory cache; Prisma queries hit Postgres directly)

## Authentication & Identity

**Auth Provider:**

- Custom, self-hosted — no external IdP/OAuth/OIDC
  - Implementation:
    - Login restricted to institutional e-mail `@utfpr.edu.br` (`isInstitutionalEmail` in `backend/src/utils/helpers.js`)
    - Passwords hashed with argon2id (`backend/src/utils/password.js`)
    - JWT access (15 min) + refresh (7 days) signed in `backend/src/utils/tokens.js`, delivered as httpOnly `access_token` (and refresh) cookies — `sameSite: 'lax'`, `secure` when `NODE_ENV=production`
    - Middleware chain `authJwt` → `requireRole(...)` in `backend/src/middlewares/auth.js`; roles: ADMINISTRADOR, CHEFE_DEPARTAMENTO, CONSELHEIRO, PROFESSOR, ALUNO
    - Brute-force lockout: `failedLoginAttempts >= 5` → `lockedUntil` +15 min, handled in `backend/src/controllers/authController.js`; IP rate-limit 20/15min on `/api/auth/login` (`backend/src/routes/auth.routes.js`)
    - Forced password change flag `mustChangePassword` + temporary-password expiry on `User` model
  - Frontend session state: `frontend/src/stores/auth.js` (calls `/auth/me`, `/auth/login`, `/auth/logout`) via credentialed axios client `frontend/src/services/api.js`; route guards in `frontend/src/router/index.js`
- Bootstrap admin: seeded from `INITIAL_ADMIN_EMAIL` / `INITIAL_ADMIN_TEMPORARY_PASSWORD` by `backend/prisma/seed.js` (idempotent, run by entrypoint)

## Monitoring & Observability

**Error Tracking:**

- None (no Sentry/Datadog/etc.)

**Logs:**

- pino JSON logs, level via `LOG_LEVEL` (default `info`) — `backend/src/config/logger.js`
- HTTP request logging via `pino-http` wired in `backend/src/app.js`
- Redaction of `req.headers.cookie`, `password`, `pass`, `SMTP_PASS`, `token` configured in `backend/src/config/logger.js`
- Audit trail persisted to DB: `backend/src/services/auditService.js` → `AuditEvent` model (never throws into the request flow)
- Health endpoint: `GET /health` → `{ ok: true, service: 'sgrd-backend' }` (`backend/src/app.js`)

## CI/CD & Deployment

**Hosting:**

- Docker Compose on a self-managed host — root `compose.yaml` (`app` + `db`), image built from root `Dockerfile`; no cloud provider config in repo
- Git remote: `https://github.com/ldsampaio/sgrf.git`

**CI Pipeline:**

- None — no `.github/`, no CI config files; verification is manual (`AGENTS.md`: backend `npx vitest run`, frontend `npm run build`)

## Environment Configuration

**Required env vars:**

- Production (compose fails fast without): `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`, `INITIAL_ADMIN_EMAIL`, `INITIAL_ADMIN_TEMPORARY_PASSWORD`
- Strongly used: `DATABASE_URL` (or `DB_PASSWORD` for compose), `FRONTEND_URL` (CORS origin), `APP_PORT`, `DB_PASSWORD`
- Optional: `SERVE_FRONTEND`, `FRONTEND_DIST`, `PORT`, `SMTP_ENABLED` (+`SMTP_HOST/PORT/SECURE/USER/PASS/FROM`), `LOG_LEVEL`, `NODE_ENV`, `SEED_DEV_CONFIRM` (dev seed gate)
- Full list of names referenced in code: `backend/src/config/env.js`, `backend/src/config/logger.js`, `backend/src/utils/tokens.js`, `backend/src/middlewares/validate.js`

**Secrets location:**

- `backend/.env` (present locally, gitignored, contents not read), template `backend/.env.example` with `!backend/.env.example` un-ignore in `.gitignore`; in deploy, injected as compose environment variables
- `.dockerignore` excludes `backend/.env` and `*.db*` from the build context

## Webhooks & Callbacks

**Incoming:**

- None

**Outgoing:**

- None

## Email (SMTP)

**Transport:**

- nodemailer SMTP transport, built lazily in `backend/src/services/emailService.js` (`getTransporter`); configured entirely by `SMTP_*` env vars — disabled by default (`SMTP_ENABLED=false` in `compose.yaml` and `AGENTS.md`); when disabled, sends are logged as `[SMTP_DISABLED]` instead of delivered
- Outbox pattern: `enqueue()` writes to the `EmailQueue` Prisma model; `processQueue()` drains PENDING/FAILED with max 3 attempts then `GIVE_UP`
- Event catalog for e-mails defined in `docs/10-notificacoes.md`; enqueued by `backend/src/controllers/{auth,user,request,voting,finance,userBatch}Controller.js`

**Wiring caveats (current state):**

- No scheduler invokes `emailService.processQueue()` anywhere in `backend/src/` — the queue accumulates but nothing drains it automatically
- Settings email endpoints are stubs: `PATCH /api/settings/email` and `POST /api/settings/email/test` return `{ ok: true, note: 'SMTP via .env nesta versão MVP' }` in `backend/src/routes/settings.routes.js`

## Scheduled / Background Jobs

**Voting closer:**

- `backend/src/jobs/votingCloser.js` — `closeExpired()` closes `EM_VOTACAO` requests past `votingDeadlineAt`; runnable manually (`require.main === module`), comments say "chamado por cron", but no cron/`setInterval` exists anywhere in the repo
- Note: its requires (`./config/db`, `./config/logger`, `./services/votingService`) are relative to `backend/src/jobs/` and resolve to non-existent paths — running `node src/jobs/votingCloser.js` as-is fails with MODULE_NOT_FOUND; correct paths would be `../config/db` etc.

---

*Integration audit: 2026-09-22*
