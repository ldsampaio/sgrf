# Stack Research

**Domain:** Production hardening of an existing Express 4 + Prisma 5 + Vue 3 MVP (bug-fix/security milestone — no new features)
**Researched:** 2026-09-23
**Confidence:** HIGH — every version, engine range, and peer dependency below was verified today against the npm registry and official migration guides, not training data. Behavioral/migration-effort claims are tagged MEDIUM inline where docs were read but the change was not yet executed.

## Recommended Stack

### Core Technologies

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| Node.js | 22 LTS (≥22.12; Docker `node:22-bookworm-slim`) | Backend runtime + CI runtime | vitest 5 and Vite 7/8 both require Node ≥22.12; the Dockerfile already pins 22, so CI must match it or builds drift. Maintenance LTS until 2027-04-30 — comfortably past this milestone. **Conf: HIGH** (npm `engines` + Node release schedule) |
| Express | 4.22.3 — **stay on 4.x** | HTTP framework | 4.22.3 is the current, security-patched `latest-4` release. Express 5 (5.2.1) changes route wildcards, removes `req.param`/`res.send(status)`, and reworks async error propagation across all 8 route files — pure regression risk with zero audit driver this milestone. **Conf: HIGH** |
| Prisma + @prisma/client | 5.22.0 — **upgrade deferred** | ORM | Audit-clean. Prisma 7 (7.10.0) *forces* driver adapters (`@prisma/adapter-pg`), a `prisma.config.ts`, a new generator with explicit output, and rewritten env loading — a dedicated migration phase, not a hardening bump. **Conf: HIGH** on versions; **MEDIUM** on how long 5.x keeps receiving patches (support window not verified) |
| PostgreSQL | 16 (`postgres:16-alpine`) | Database | PG 16 is supported through ~2028-11; money-as-cents integers and UUID strings behave identically on 18. No advisory forces an upgrade; a major DB jump adds dump/restore risk to a milestone already touching voting/ledger bugs. **Conf: HIGH** on lifecycle, **MEDIUM** on exact EOL date |
| Vue 3 + vue-router + Pinia | 3.5.42 / 4.6.4 / 4.0.3 | SPA stack | Already on current majors and audit-clean — no change; frontend verification stays `npm run build`. **Conf: HIGH** |
| helmet | 8.3.0 | Security headers | v8 is a drop-in for the bare `helmet()` defaults used in `app.js`; raises default HSTS `max-age` from 180 to 365 days (only meaningful once HTTPS exists — see Deploy Topology) and requires Node ≥18. **Conf: HIGH** (release notes) |
| express-rate-limit | 8.7.0 | Auth throttling | Current code only limits login (`max: 20`/15 min); the milestone extends limiting to all auth mutation routes. v8 fixes an IPv6-subnet bypass in IP keying — the exact class of bug this milestone exists to close. **Conf: HIGH** on version; **MEDIUM** on v8 keying/`max` vs `limit` behavior — verify at upgrade time |
| Caddy 2 | `caddy:2-alpine` | TLS-terminating reverse proxy | Automatic Let's Encrypt issuance *and renewal* in a 3-line Caddyfile, no Docker-socket access (Traefik's attack surface) and no renew cron (nginx+certbot's moving part). Directly resolves the "secure-cookie/HTTPS story" requirement. **Conf: HIGH** (official docs); **MEDIUM** (compose wiring not yet executed) |

### Supporting Libraries

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| nodemailer | 10.0.10 | SMTP transport for the email queue | Always — it clears the **high** advisory (≤9.1.0). v10's only breaking change is Node ≥20 plus built-in TS types/dual ESM+CJS build; `createTransport({host, port, secure, auth})` is unchanged, so `require('nodemailer')` in the CommonJS backend keeps working. With `SMTP_ENABLED=false` default the bump is zero-runtime-risk. **Conf: HIGH** (v9/v10 release notes); **MEDIUM** (send path untested until SMTP is enabled) |
| node-cron | 4.6.0 | Schedules the email-queue drain and voting auto-close | Always — both jobs are dead this milestone (`processQueue()` never scheduled; `closeExpired()` has a `system-cron` actor string but nothing runs it). Calendar expressions + `timezone` + `noOverlap: true` prevent the drift and double-runs you'd hand-roll with `setInterval`; zero dependencies. Node ≥20 (4.x). **Conf: MEDIUM** (v4 options read from docs, not executed) |
| supertest | 7.3.0 (already in devDeps, **never imported**) | HTTP route tests | Use it for every auth/authorization fix: `request(app)` binds an ephemeral port with no listening server, and `request.agent(app)` persists the httpOnly cookie jar — exactly what's needed to regression-test login → refresh → protected-route flows against `createApp()`. **Conf: HIGH** (README); **MEDIUM** (first suite not yet written) |
| argon2 | 0.41.1 (keep) | Password hashing | Current, audit-clean, memory-hard — the right choice for institutional credentials. Do not "simplify" to bcrypt. **Conf: HIGH** |
| jsonwebtoken | 9.0.3 (keep) | Cookie JWT (15m/7d) | Audit-clean on the current major; swapping to `jose` touches every auth path for zero security gain this milestone. **Conf: HIGH** |
| zod | 3.25.76 (keep) | Request/batch validation | Audit-clean; zod 4 (4.6.5) renames core APIs (`z.string().email()` → `z.email()`, error customization) across every validator — defer with the other excluded refactors. **Conf: HIGH** (audit); **MEDIUM** (4.x API scope) |
| pino + pino-http | 9.14.0 / 10.5.0 (keep) | Structured logs + audit trail | Current majors, audit-clean; run `npm update` for patches only — pino 10 / pino-http 11 majors buy nothing here. **Conf: HIGH** |
| multer | 2.4.0 (optional bump) | CSV batch user import | Only used in `userBatchController.js` (memoryStorage, 1 MB cap). v2 keeps the `.single()` middleware API and removes the legacy callback style; audit doesn't flag 1.4.5-lts.2, so this is hygiene, not urgent — retest = one CSV upload. **Conf: MEDIUM** |
| uuid | **REMOVE entirely** | — | Zero usages in `backend/src` (grep-verified) *and* it carries a moderate advisory (<11.1.1). If an ID is ever needed, use Node 22's built-in `crypto.randomUUID()` — uuid 14.x is ESM-only and would break the `"type": "commonjs"` backend. **Conf: HIGH** |

### Development Tools

| Tool | Purpose | Notes |
|------|---------|-------|
| vitest | 5.0.1 — backend test runner | Clears the repo's only **critical** advisory (the ≤4.1.10 chain: `vite-node`, `@vitest/mocker`, bundled old vite/esbuild). v5 makes `vite` a **peer dependency** (`^6.4.0 ‖ ^7 ‖ ^8`) and needs Node ≥22.12 — pin `vite@^8.3.0` explicitly in backend devDeps instead of letting npm hoist a surprise. Breaking defaults to check: `clearMocks` now defaults `true`, and unawaited async assertions fail — the 17 existing tests may need small assertion tweaks. **Conf: HIGH** (peers/engines via registry); **MEDIUM** (test-compat impact) |
| Vite | 8.3.0 (frontend) — fallbacks 7.3.6 → 6.4.3 | SPA build | The installed 5.4.21 sits under the **high** advisory (vite ≤6.4.2, incl. esbuild dev-server issues). v8 swaps esbuild/Rollup for Rolldown/Oxc — a real behavior change; `@vitejs/plugin-vue@6.0.9` peers already accept `vite ^5‖^6‖^7‖^8`, so no plugin bump is needed. If `npm run build` breaks, fall back to 7.3.6 (classic pipeline, still advisory-free); 6.4.3 is the minimum patched release if forced to stay near current. **Conf: HIGH** (versions/peers); **MEDIUM** (v8 build behavior on this SPA) |
| GitHub Actions | `actions/checkout@v7` + `actions/setup-node@v7`, `node-version: 22`, `cache: npm` | CI | No `.github/workflows` exists today. Both actions are current majors (node24 runtime). In a two-package repo you **must** pass `cache-dependency-path` per job or the cache key is wrong. Backend job: `npm ci` → `npx prisma generate` → `npx vitest run`. Frontend job: `npm ci` → `npm run build`. See workflow below. **Conf: HIGH** |
| CI job env | dummy `DATABASE_URL` at **job level** | CI correctness | CI has no `backend/.env`; tests import `votingService` → `config/db` → `new PrismaClient()`. Prisma connects lazily (no test queries the DB — grep-verified), but the generated client and env resolution still need a syntactically valid `DATABASE_URL`. Set a throwaway one at job level; `prisma generate` does not open a connection. **Conf: MEDIUM** |

## Installation

```bash
# Backend — clears 1 critical, 2 high, 4 moderate advisories (npm audit, 2026-09-23)
cd backend
npm rm uuid                                # dead dependency + moderate advisory
npm install nodemailer@^10.0.10            # high advisory ≤9.1.0; API-compatible, Node ≥20
npm install helmet@^8.3.0 express-rate-limit@^8.7.0
npm install node-cron@^4.6.0               # schedule processQueue() + closeExpired() from server.js
npm install -D vitest@^5.0.1 vite@^8.3.0 supertest@^7.3.0
# ^ vitest 5 peer-depends on vite ≥6.4 — pin it explicitly; supertest is installed but unused, start importing it
npm update                                  # jsonwebtoken/zod/pino/pdfkit → latest patch-in-range

# Frontend — clears 1 high + 1 moderate advisory
cd ../frontend
npm install -D vite@^8.3.0                 # if the build breaks: vite@^7.3.6, then vite@^6.4.3

# Verify (the only two commands that exist, per AGENTS.md)
cd ../backend && npx vitest run
cd ../frontend && npm run build
```

## CI Workflow (minimal)

Mandated by PROJECT.md: "backend `npx vitest run` + frontend `npm run build` on every push". Nothing else — no lint, no typecheck, no coverage gates (explicitly Out of Scope).

```yaml
# .github/workflows/ci.yml
name: CI
on: push                        # "every push" per milestone scope; add pull_request if branches diverge
jobs:
  backend:
    runs-on: ubuntu-latest
    env:                         # CI has no backend/.env — tests construct PrismaClient via votingService
      DATABASE_URL: postgresql://user:pass@localhost:5432/sgrd   # dummy: generate/tests never connect
    defaults: { run: { working-directory: backend } }
    steps:
      - uses: actions/checkout@v7
      - uses: actions/setup-node@v7
        with:
          node-version: 22
          cache: npm
          cache-dependency-path: backend/package-lock.json   # required in a two-package repo
      - run: npm ci
      - run: npx prisma generate    # generated client is not committed; no postinstall script exists
      - run: npx vitest run
  frontend:
    runs-on: ubuntu-latest
    defaults: { run: { working-directory: frontend } }
    steps:
      - uses: actions/checkout@v7
      - uses: actions/setup-node@v7
        with:
          node-version: 22
          cache: npm
          cache-dependency-path: frontend/package-lock.json
      - run: npm ci
      - run: npm run build
```

Why this shape: tests are pure unit tests (17 assertions over `calcAmount`/`tally`/batch validation — grep confirms no test queries Postgres), so **no `postgres` service container is needed**. If a future test touches the DB, add a `services: db: image: postgres:16-alpine` block — matching compose, not upgrading to 18.

## Deploy Topology: TLS & Reverse Proxy

The "secure-cookie/HTTPS story" requirement resolves with one box in front, not code changes:

```yaml
# compose.yaml — add alongside app + db:
  caddy:
    image: caddy:2-alpine
    restart: unless-stopped
    ports: ["80:80", "443:443"]
    environment:
      SITE_ADDRESS: ${SITE_ADDRESS:-:443}     # e.g. sgrd.example.edu.br:443 → auto ACME cert
      UPSTREAM: app:3000
    volumes:
      - caddy_data:/data                      # certs persist + auto-renew
      - caddy_config:/config
      - ./deploy/Caddyfile:/etc/caddy/Caddyfile:ro
    depends_on: [app]
```

```
# deploy/Caddyfile
{$SITE_ADDRESS} {
  reverse_proxy {$UPSTREAM}
}
```

Wiring rules once Caddy exists:
1. **Stop publishing `APP_PORT` publicly** — bind it to `127.0.0.1` or drop the `ports` mapping; only Caddy owns 80/443.
2. **`app.set('trust proxy', 1)`** in `app.js` (one hop = Caddy) — without it express-rate-limit v7+ raises `ERR_ERL_UNEXPECTED_X_FORWARDED_FOR`, and `AuditEvent` IPs record the proxy, not the client. Leave it **off** in dev where nothing sets `X-Forwarded-For`. **Conf: MEDIUM** (well-documented behavior, not re-executed today).
3. `FRONTEND_URL=https://…`, `secure` cookies on, CORS origin matching — the axios `withCredentials` flow then works same-origin and cross-origin.
4. No-domain/LAN deploy: Caddy `tls internal` gives real TLS on a private network; plain-HTTP dev is unaffected (browsers ignore HSTS over http, so helmet 8's 365-day header is harmless).

**Scheduling wiring:** in `server.js`, `cron.schedule('* * * * *', …, { noOverlap: true, timezone: 'America/Sao_Paulo' })` calling `processQueue()` and `closeExpired()` — but **first fix `src/jobs/votingCloser.js`'s broken requires** (`./config/db` and `./config/logger` are one directory off from `src/jobs/`; should be `../config/db`, `../config/logger`, `../services/votingService`). Confirmed broken in code read today; the `require.main === module` CLI block should stay for manual runs. **Conf: HIGH** (requires read directly).

## Alternatives Considered

| Recommended | Alternative | When to Use Alternative |
|-------------|-------------|-------------------------|
| Express 4.22.3 | Express 5.2.1 | New feature work *after* this milestone, or if a fix needs Express-5-only behavior — budget a full pass over route wildcards, `req.param` removal, and async error handling first |
| Prisma 5.22.0 | Prisma 7.10.0 | A dedicated upgrade phase: driver adapters mandatory (`@prisma/adapter-pg`), `prisma.config.ts`, generator output path, manual env loading, changed pool defaults — orthogonal to bug fixing |
| Vite 8.3.0 | Vite 7.3.6 / 6.4.3 | 7.3.6 if Rolldown/Oxc breaks the Vue build (same advisory fixed); 6.4.3 only if forced to remain on the 6.x line |
| node-cron 4.6.0 | `setInterval` | A single fire-and-forget interval with no overlap risk — wrong here: drift, hand-rolled overlap guards, and no calendar/timezone semantics for two independent jobs |
| node-cron (in-process) | host cron / `docker exec` crontab | Ops wants schedules visible outside the app (the `'system-cron'` actor string hints at this) — viable, but in-process is simpler for a single-container deploy |
| Caddy | Traefik | Many services needing dynamic routing, and you accept granting it the Docker socket |
| Caddy | nginx + certbot | Org already standardizes on nginx *and* has renewal automation wired |
| express-rate-limit MemoryStore | `@rate-limit/redis` / `rate-limit-redis` | More than one app replica (in-memory counters diverge and reset per process) — single-container compose makes Redis pure overhead now |
| nodemailer (self SMTP) | Managed API (Resend/SendGrid/SES) | Deliverability, DKIM, or bounce handling becomes a real problem; current requirement is the UTFPR SMTP relay |
| PostgreSQL 16 | PostgreSQL 18 | Next scheduled DB upgrade window — requires dump/restore plus a migration-test pass |
| supertest (route tests) | Playwright E2E | Only once a frontend test suite enters scope — explicitly Out of Scope this milestone |

## What NOT to Use

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| `uuid` (any version) | Dead dependency with a moderate advisory; 14.x is ESM-only and would break the CommonJS backend | Delete it — Node 22's `crypto.randomUUID()` if an ID is ever needed |
| vitest 2.x | Carries the repo's only **critical** advisory (≤4.1.10 chain: vite-node, @vitest/mocker, old vite/esbuild) | `vitest@^5.0.1` + explicit `vite@^8.3.0` |
| Vite 5.x | High advisory (≤6.4.2) incl. esbuild dev-server vulnerabilities; audit cannot be silenced on 5.x | `vite@^8.3.0` (fallback `^7.3.6`) |
| nodemailer 6/9 | High advisory (≤9.1.0) | `nodemailer@^10.0.10` |
| Express 5 *this milestone* | Breaking route/error semantics across all 8 route files — regression risk with no audit driver | Stay on 4.22.3 (patched, maintained `latest-4` line) |
| Prisma 7 *this milestone* | Driver-adapter + config rewrite touches every query path while you're fixing money/vote bugs | Stay on 5.22; dedicated upgrade phase later |
| bcrypt | Weaker than argon2 for equal cost; a swap means a rehash migration | argon2 0.41.1 (already correct) |
| Redis + BullMQ/Agenda for the email queue | Extra container and infra for one queue drained in one process — contradicts the single-image deploy shape | In-process queue + node-cron schedule around the existing `processQueue()` |
| ESLint/TypeScript/coverage gates in CI | Explicitly Out of Scope (PROJECT.md) — would fail the build on day one for pre-existing style debt | Gate only `vitest run` + `vite build`, exactly as mandated |
| `setInterval` for `processQueue`/`closeExpired` | Drift, overlapping runs, no calendar semantics — and `closeExpired` currently isn't scheduled *at all* | node-cron 4 with `noOverlap: true` |
| Trusting `X-Forwarded-For` without `trust proxy` | Wrong client IPs in the audit trail; express-rate-limit v7+ throws `ERR_ERL_UNEXPECTED_X_FORWARDED_FOR` behind Caddy | `app.set('trust proxy', 1)` — **only** when a proxy actually fronts the app **(Conf: MEDIUM)** |
| Insecure `dev-*-secret-change-me` fallbacks in prod | `env.js` silently accepts dev secrets when `NODE_ENV=production` | Fail-fast refusal (an Active requirement) — an `env.js` change, not a library |

## Stack Patterns by Variant

**If deploying behind Caddy/HTTPS (target production):**
- Set `trust proxy` to `1`, `FRONTEND_URL=https://…`, and `secure` cookies; helmet 8's 365-day HSTS becomes active and correct.
- Because: rate-limit keying, audit IPs, and the cookie `secure` flag all depend on knowing a proxy terminated TLS.

**If plain-HTTP LAN/dev (current compose shape):**
- Leave `trust proxy` **off**, keep `secure: false`, don't inject `X-Forwarded-For`.
- Because: without a proxy, trusting forwarded headers lets any client spoof its IP into rate-limit keys and the audit trail.

**If `SMTP_ENABLED=false` (the default):**
- The nodemailer 6→10 bump is code-path-dead — verify only that `createTransport` still parses when SMTP is enabled.
- Because: no runtime exposure now, but invites/resets must actually send once the queue drains.

**If a single app replica (always true today):**
- MemoryStore rate limiting, in-process email queue, node-cron inside `server.js`.
- Because: no shared state is needed; horizontal scaling is explicitly out of scope.

**If a second replica is ever added (out of scope now):**
- `rate-limit-redis` + an external scheduler + a shared queue become mandatory together.
- Because: per-process memory state silently diverges the moment two containers exist — revisit all three at once, not piecemeal.

## Version Compatibility

| Package | Compatible With | Notes |
|---------|-----------------|-------|
| vitest@5.0.1 | vite `^6.4.0 ‖ ^7 ‖ ^8`, Node ≥22.12 | `vite` became a **peer dep** in v5 — pin `vite@^8.3.0` in backend devDeps; peers `@vitest/*` must all sit at 5.0.1 |
| vite@8.3.0 | Node `^20.19 ‖ ≥22.12`; @vitejs/plugin-vue `^6.0.9` (peers `vite ^5‖^6‖^7‖^8`) | plugin-vue already at 6.0.9 — no change needed on either package |
| nodemailer@10.0.10 | Node ≥20; CommonJS `require()` | Dual ESM+CJS build — safe in the `"type": "commonjs"` backend |
| helmet@8.3.0 | Node ≥18, Express 4 | Drop-in for bare `helmet()` defaults |
| express-rate-limit@8.7.0 | Node ≥16, Express 4/5 | Behind Caddy: set `trust proxy` or request-time validation throws; check `max` vs `limit` option naming on bump **(Conf: MEDIUM)** |
| node-cron@4.6.0 | Node ≥20, CommonJS | Zero deps; `noOverlap` is a v4 task option |
| multer@2.4.0 | Express 4, Node ≥10.16 | v2 drops callback-style handling — `.single()` middleware API unchanged |
| Prisma@5.22.0 | PostgreSQL 16 | v7 is not drop-in: requires `@prisma/adapter-pg` + config rework |
| actions/setup-node@v7 | `node-version: 22` | `cache: npm` **requires** `cache-dependency-path` in a two-package repo |
| express@4.22.3 | everything above | No peer constraints (non-ESM package) |

## Sources

- npm registry queries (`npm view`, 2026-09-23) — versions, dist-tags, `engines`, peerDeps for all packages above — **HIGH**
- `npm audit` (backend + frontend, 2026-09-23) — 1 critical / 2 high / 4 moderate (backend), 1 high / 1 moderate (frontend) — **HIGH**
- https://expressjs.com/en/guide/migrating-5 — Express 5 breaking-change list — **HIGH**
- https://www.prisma.io/docs/orm/major-upgrades — Prisma 7 upgrade guide (driver adapters, prisma.config.ts, pool defaults) — **HIGH** for requirements, **MEDIUM** for effort estimate
- https://github.com/nodemailer/nodemailer/releases (v9.0.0, v10.0.0) — Node ≥20, TS+dual build, otherwise compatible API — **HIGH**
- https://vite.dev/guide/migration (v5→6, 6→7, 7→8 guides) — breaking changes, Node requirements, Rolldown/Oxc in v8 — **HIGH**
- https://vitest.dev/guides/migration (5.0) — Vite peer dep, Node ≥22.12, clearMocks/async-assertion defaults — **HIGH**
- https://github.com/helmetjs/helmet/releases (v8) — HSTS 365d default, Node ≥18 — **HIGH**
- https://github.com/express-rate-limit/express-rate-limit (changelog: v7, v8.0.0) — IPv6 subnet bypass fix, `X-Forwarded-For` validation — **MEDIUM** (changelog read, not executed)
- https://github.com/node-cron/node-cron (v4 docs) — `noOverlap`, timezone, zero deps — **MEDIUM**
- https://github.com/ljharb/supertest (README) — `request(app)` ephemeral port, `request.agent` cookie persistence — **HIGH**
- actions/checkout + actions/setup-node release pages — v7 is current, node24 runtime, automatic npm caching — **HIGH**
- https://caddyserver.com/docs/quick-starts/reverse-proxy — auto-HTTPS, Caddyfile syntax — **HIGH** for behavior, **MEDIUM** for compose specifics
- Node.js release schedule + PostgreSQL lifecycle pages — Node 22 EOL 2027-04-30, PG 16 ≈2028-11 — **HIGH / MEDIUM**
- Local codebase reads (`package.json` ×2, lockfiles, `Dockerfile`, `compose.yaml`, `app.js`, `emailService.js`, `auth.routes.js`, `votingCloser.js`, `tests/`) — current versions and dead-dependency/require-breakage evidence — **HIGH**

Context7 MCP was unavailable in this run; official docs + npm registry were used as the authoritative version source per the documentation-lookup fallback.

---
*Stack research for: SGRF/SGRD production-hardening milestone*
*Researched: 2026-09-23*
