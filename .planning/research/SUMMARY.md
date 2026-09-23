# Project Research Summary

**Project:** SGRF/SGRD — production-hardening milestone (bug-fix + security, no new features)
**Domain:** Internal financial-management web app — funding-request approval with five-role authorization, council voting with deadlines/tie-breaks, integer-cent ledger with annual limits, audit trail, CSV/PDF exports (Express 4 + Prisma 5 + Vue 3 MVP)
**Researched:** 2026-09-23
**Confidence:** MEDIUM-HIGH (in-repo evidence HIGH; external corroboration MEDIUM — websearch unavailable this run, first-party docs fetched directly)

## Executive Summary

This is a brownfield hardening milestone, not a greenfield build: an existing UTFPR-internal MVP (Node 22 / Express 4 / Prisma 5 / PostgreSQL 16 backend + Vue 3 SPA, two independent npm packages, single Docker image + compose) must be made production-safe. Experts build this class of system around three pillars research confirms are missing: a centralized deny-by-default authorization matrix with tested allow+deny cells (OWASP A01), scheduled/background machinery that reaches terminal states (voting auto-close, email-queue drain), and money-path correctness enforced by the database (conditional atomic updates inside `$transaction` — no raw SQL, per the project's danger-zone rule). The recommended approach is deliberately conservative: stay on Express 4.22.3, Prisma 5.22, PostgreSQL 16 (defer majors to dedicated phases), clear the audit trail (vitest 5, Vite 8, nodemailer 10, remove dead `uuid`), and land a minimal two-job CI gate first — CONCERNS names missing CI as the reason these bugs shipped.

The roadmap implied by research is 8 phases in strict dependency order: **CI baseline → docs/14 rules decisions → deploy/env contract → authorization layer → session refresh → state-machine & money rules → background jobs → reports/audit + auth polish**. Two ordering constraints are load-bearing: rules decisions must precede any rule-dependent code (partial-approval, cancellation), and the voting tie-break fix must precede scheduling `closeExpired()` — otherwise the job automates the wedge (Pitfall 6). The authorization layer must land with allow-side tests, not just 403 assertions, or legitimate flows (conselheiros reading requests under vote, `/auth/refresh` itself) break silently.

Key risks: (1) over-restricting authorization in the deny-by-default pass — mitigate with a full actor-resource-action matrix from `docs/06` covering ALLOW + DENY per route × 5 roles via supertest; (2) a "race fix" that doesn't serialize — `READ COMMITTED` + read-check-decrement is the existing TOCTOU bug; use conditional `updateMany({ availableCents: { gte } })` as the serialization point, `tx.*` only, and annual reads inside the transaction; (3) refresh-interceptor storms — single-flight promise + per-request `_retry` flag, generous rate limits on `/auth/refresh`; (4) secret fail-fast and secure-cookie changes breaking dev or silently failing over HTTP (localhost Secure exception hides it) — gate strictly on `NODE_ENV=production`, verify login via `http://<LAN-IP>`; (5) flaky Postgres CI eroding the gate — land CI on the existing 17 unit tests with no DB first, add the service container only with integration tests and an explicit `pg_isready` wait.

## Key Findings

### Recommended Stack

([STACK.md](STACK.md)) Everything version-sensitive was verified against the npm registry and official migration guides on 2026-09-23 — HIGH confidence. The strategy is "patch hard, don't migrate": clear 1 critical / 2 high / 4 moderate backend + 1 high / 1 moderate frontend advisories without touching Express 5 or Prisma 7, whose breaking changes (route wildcards, async error semantics; mandatory driver adapters + `prisma.config.ts`) are pure regression risk with no audit driver this milestone.

**Core technologies:**
- **Node 22 LTS (≥22.12)** — vitest 5 + Vite 7/8 floor; Docker already pins 22, CI must match or builds drift
- **Express 4.22.3 (stay on 4.x)** — current security-patched `latest-4`; Express 5 touches all 8 route files for zero gain
- **Prisma 5.22.0 (defer Prisma 7)** — audit-clean; v7 forces driver adapters = a dedicated migration phase
- **PostgreSQL 16** — supported to ~2028; money-as-cents + UUID behavior identical on 18; no advisory forces the jump
- **Vue 3.5 / vue-router 4.6 / Pinia 4.0** — already current and audit-clean; verification stays `npm run build`
- **helmet 8.3.0** — drop-in for bare `helmet()` defaults; HSTS 365d (meaningful only once HTTPS exists)
- **express-rate-limit 8.7.0** — v8 fixes the IPv6-subnet keying bypass; extend limiting to all auth mutation routes
- **Caddy 2 (`caddy:2-alpine`)** — auto-HTTPS in a 3-line Caddyfile, no Docker-socket access; resolves the secure-cookie/HTTPS requirement (compose wiring Conf: MEDIUM)
- **nodemailer 10.0.10** — clears the HIGH advisory; API-compatible with current usage; zero runtime risk while `SMTP_ENABLED=false`
- **node-cron 4.6.0** — `noOverlap` + timezone for `processQueue()`/`closeExpired()` — **⚠ conflicts with ARCHITECTURE.md, which recommends plain `setInterval` in `jobs/scheduler.js` and rejects node-cron; resolve during planning (see Gaps)**
- **vitest 5.0.1 + Vite 8.3.0** — clears the repo's only CRITICAL advisory (≤4.1.10 chain) and the frontend HIGH (vite ≤6.4.2); vitest 5 peer-depends on vite — pin `vite@^8.3.0` explicitly; fallback `^7.3.6`
- **supertest 7.3.0** — already in devDeps, never imported; the tool for the authorization allow+deny matrix
- **GitHub Actions** (`checkout@v7` + `setup-node@v7`, Node 22) — two jobs, `working-directory` per package, `cache-dependency-path` mandatory in a two-package repo, dummy `DATABASE_URL` at job level (**ARCHITECTURE.md shows v4 — STACK.md's registry-verified v7 wins**)
- **REMOVE `uuid`** — zero usages + moderate advisory; use `crypto.randomUUID()` (uuid 14.x is ESM-only and would break the CJS backend)
- **Keep as-is:** argon2 0.41.1 (do NOT swap for bcrypt), jsonwebtoken 9.0.3, zod 3.25.76 (zod 4 renames core APIs), pino 9.14.0, multer 2.4.0 (optional)

### Expected Features

([FEATURES.md](FEATURES.md)) Categorization is anchored in in-repo evidence (`PROJECT.md` Active requirements, `docs/03|06|07|11|13|14`, evidence-backed `CONCERNS.md` at b3837b7) — HIGH for the table; MEDIUM overall (external corroboration limited).

**Must have (table stakes — production blockers, all map to Active requirements):**
- Endpoint authorization matrix enforced server-side (cancel, message remove, getOne/list scoping, listVotes, settings transactions, force-password-reset, reports voting) — any `ALUNO` can cancel others' requests today
- Silent session refresh (401 → refresh once → single-flight retry) — system is unusable past 15 min today
- `mustChangePassword` enforced server-side (403 + allowlist) + router guard — forced-change guarantee is currently void
- Tie-break convergence (`AGUARDANDO_DESEMPATE` always resolves) + voting auto-close scheduled (`closeExpired()` every 5 min) — decisions must reach terminal state
- Annual-limit accounting includes `CONCLUIDO` — direct money-leak (cycle spend → re-approve under cap)
- Partial-approval rule + cancellation-after-approval rule decided (docs/14), documented in `docs/03`, implemented deliberately with tests
- Email queue actually drains (`processQueue()` scheduled) + give-up admin alert + honest `smtpConfigured` — invites/resets are dead today
- Export auditing (all formats, before streaming) + CSV formula-injection neutralization
- Auth hardening: rate-limit all auth mutation routes, uniform 401 on login failure (keep distinct lockout 423), explicit `trust proxy`
- Secrets fail fast in production (no `dev-*-secret-change-me` fallbacks — forgeable JWTs today)
- Secure-cookie / HTTPS story resolved (deployment blocker — silent login failure on non-localhost)
- Minimal CI: `npx vitest run` + `npm run build` on every push — the gate everything else depends on staying fixed

**Should have (differentiators, P2 — outside committed scope unless requirements say otherwise):**
- supertest authorization regression matrix (recurrence gate — do opportunistically as each authz fix lands)
- Finance invariant reconciliation test (`sum(FinancialTransaction)` vs `FundBalance`)
- Remaining `docs/14` decisions (quorum, vista-limit doc-vs-`@@unique` conflict) — flag: may deserve its own phase
- One-time reset token + `EmailQueue.body` purge; job overlap guard/telemetry; error-handler stack hardening
- nodemailer ≥10 explicitly before `SMTP_ENABLED=true`

**Defer (v2+ / anti-features — do NOT start this milestone):**
- Refresh rotation + revocation (`tokenVersion`) — own milestone after silent refresh ships
- Audit-trail read API/UI + retention policy — explicitly Out of Scope
- CSRF tokens (accepted risk per `docs/11`, revisit on subdomains), TypeScript/ESLint (AGENTS.md forbids), frontend E2E, MFA/OIDC (institutional decision), pagination/horizontal scaling (no volume), broad refactors (balance-service extraction, JSON columns — excluded by Key Decision)

### Architecture Approach

([ARCHITECTURE.md](ARCHITECTURE.md)) The system stays a layered modular monolith — single Docker image (Express serves API + built SPA) + compose Postgres; every hardening item is an in-layer overlay, no new services. Five patterns carry the milestone: a route-level `PERMISSIONS` map + `requirePermission` (fail-closed, transcribed from `docs/06`, row-level ownership stays in controllers); an in-process scheduler in `jobs/scheduler.js` called only from `server.js` (never `app.js` — timers would leak into tests); a single-flight 401 refresh interceptor on the shared axios instance in `services/api.js` (never imports the router — import cycle); conditional atomic `updateMany` balance updates inside `$transaction` without raw SQL across all 5 money-write sites; and a two-job CI with per-package `working-directory`. Direction stays strict: middleware → route gates → controller row checks → service rules → Prisma; jobs reuse `closeVoting`/`processQueue`, never reimplement.

**Major components:**
1. `middlewares/permissions.js` (new) — static PERMISSIONS map + `requirePermission(action)`; 403 on undeclared action
2. `middlewares/auth.js` (edit) — `authJwt` + `mustChangePassword` 403 gate with explicit allowlist (login/refresh/logout/change-password/me/health)
3. `jobs/scheduler.js` (new) — re-entrancy-guarded loops for email drain (60s) + voting close (5min); wired from `server.js` only
4. `services/api.js` interceptor (edit) — single-flight refresh + one retry; `window.location.assign('/login')` on refresh failure
5. Money-path fixes in place — conditional `updateMany` + reads-inside-tx at `requestController.submit`, `votingService.closeVoting`, `votingController.collegiateDecision`, `financeController.markSpent/reverseProvision`, `settingsController.patchBalance` (the last also currently writes two ops with **no transaction**)
6. `.github/workflows/ci.yml` (new) — backend: npm ci → prisma generate → vitest; frontend: npm ci → build
7. Shared visibility helper — one scope function reused by `requestController.list/getOne` AND `reports.scopeFilter` (encoded twice today)

**Anti-patterns to avoid:** per-endpoint `if (role …)` patches in controllers (the failure that shipped); `setInterval` in `app.js`; per-view 401 handling or router import in `api.js`; `$queryRaw` `SELECT … FOR UPDATE` (raw SQL forbidden) or check-then-decrement; workspace tooling / invented lint-typecheck commands in CI.

### Critical Pitfalls

([PITFALLS.md](PITFALLS.md)) Top 5 of 12:

1. **Authorization over-restriction (P1)** — deny-by-default in one pass breaks documented-legitimate access (conselheiro opening a request under vote, `/auth/refresh` caught by a too-high guard, empty lists in `Council.vue`). *Avoid:* full actor-resource-action matrix from `docs/06` with ALLOW + DENY cell per fixed route × 5 roles via supertest; enumerate non-browser callers (jobs, seeds); use `reports.scopeFilter` as the scoping model; watch for 403 spikes.
2. **`mustChangePassword` lockout loop (P2)** — blanket 403 in `authJwt` also blocks `change-password`/`me`/`refresh` → hard lock. *Avoid:* deny list with explicit documented allowlist, distinguishable `PASSWORD_CHANGE_REQUIRED` code, backend + frontend guard landing together, temp-password full-loop test.
3. **Refresh interceptor storms (P3)** — N parallel 401s → refresh stampede → 429 mass logout; infinite retry loops. *Avoid:* per-request `_retry` flag, single-flight shared promise, never retry the refresh itself, generous limits on `/auth/refresh`, manual protocol (drop TTL to 10s, verify exactly one refresh per expiry) since there are zero frontend tests.
4. **Prisma race "fix" that doesn't serialize (P5)** — wrapping read-check-decrement in `$transaction` changes nothing under READ COMMITTED; SERIALIZABLE without retry → 500s on 40001/40P01; root `prisma.*` inside a tx callback silently escapes the transaction. *Avoid:* conditional `updateMany` `gte` guard as the serialization point, `tx.*` only, annual read inside tx (+ Serializable + retry as belt-and-suspenders), reconciliation + `Promise.all` concurrency tests. Note: `version` column increments but is never checked anywhere.
5. **State-machine fixes regress under a 17-test suite (P4)** — no test executes `closeVoting`/`canVote`/`castVote`/`annualTotalCents`; six statuses guarded by scattered `status ===` checks across ≥5 files. *Avoid:* CI first, characterization-test-then-flip per `docs/03` decisions, `grep` every touched status across `backend/src`, `docs/12-testes.md` as the test backlog.

*Also noted:* job overlap/double-run + broken `votingCloser.js` requires (P6), secure cookie over HTTP invisible on localhost (P7), `trust proxy` global-lockout vs spoofable buckets (P8), secrets fail-fast breaking dev/CI if it checks presence instead of values (P9), flaky Postgres CI → tolerated retries (P10), nodemailer green-but-unverified until SMTP enables (P11), `docs/14` decisions re-guessed in code (P12).

## Implications for Roadmap

Based on research, suggested phase structure (merges PITFALLS' Phases A–H with ARCHITECTURE's Build Order 1–8 — the two agree on ordering rationale):

### Phase 1: CI Baseline
**Rationale:** CONCERNS names missing CI as *the* reason these bugs shipped; a gate that lands last gates nothing. Pure additive, zero code risk — existing 17 tests + build must be green twice before anything moves.
**Delivers:** `.github/workflows/ci.yml` — two jobs, per-package `working-directory`, Node 22, `cache-dependency-path`, dummy `DATABASE_URL` at job level; `npx prisma generate` before vitest; no DB service yet, no lint/typecheck.
**Addresses:** FEATURES "Minimal CI" (P1); STACK CI workflow; ARCHITECTURE Pattern 5.
**Avoids:** Pitfall 10 (flaky DB CI) — v1 has zero flake surface; no `migrate dev`, no retry-suppression.
**Research flags:** LOW — standard pattern, skip research-phase. Prove the gate red on a deliberate break.

### Phase 2: Rules Decisions (`docs/14` close-out)
**Rationale:** Partial-approval and cancellation-after-approval are untestable without decided rules; every rule-dependent phase queues behind this. Can run in parallel with Phase 1.
**Delivers:** Decided + documented items in `docs/03`/`docs/14` (partial-approval aggregation rule, cancellation-after-approval, ideally quorum/vista-limit) with date + rationale.
**Addresses:** FEATURES "Partial-approval rule", "Cancellation rule", "Remaining docs/14 decisions".
**Avoids:** Pitfall 12 (decisions re-guessed in code) — one commit updates doc + code + test together.
**Research flags:** MEDIUM — mostly product/council decisions, not technical research; flag the scope question of whether quorum/vista decisions belong in this milestone or their own phase.

### Phase 3: Deploy & Environment Contract (secrets, trust proxy, cookie/HTTPS)
**Rationale:** One environment contract (`env.js` + `app.js` + `tokens.js` + compose) — splitting it invites the inconsistent story Pitfall G warns about. Foundational and independent; land early so later auth work tests against it.
**Delivers:** Production fail-fast on *values* not just presence (`dev-*`, `change-me`, empty temp password) gated strictly on `NODE_ENV=production`; `trust proxy` env-driven hop count, default off; `COOKIE_SECURE` env (or Caddy TLS front per STACK's compose topology); CI dummy `JWT_*` env.
**Addresses:** FEATURES "Secrets fail fast", "Secure-cookie/HTTPS story", trust-proxy precondition for auth rate limits.
**Avoids:** Pitfalls 7 (localhost Secure exception hides the bug — verify via `http://<LAN-IP>`), 8 (never bare `true`), 9 (`start-dev.sh` flow must stay untouched).
**Uses:** helmet 8, express-rate-limit 8, Caddy 2 topology (STACK), `app.set('trust proxy', 1)` behind Caddy only.
**Research flags:** MEDIUM — topology decision (Caddy vs direct-publish) is a product/ops call; Caddy compose wiring not yet executed.

### Phase 4: Authorization Hardening
**Rationale:** `middlewares/permissions.js` map *before* its tests (tests encode the map, not the current scattered behavior); then fix the 6 unprotected endpoints + shared scope helper; `mustChangePassword` joins here (same file, `authJwt`). Must precede session refresh — the interceptor replays against endpoints whose 401/403 semantics this phase defines.
**Delivers:** `PERMISSIONS` map transcribed from `docs/06` + `requirePermission` wired across requests/messages/settings/reports routes; ownership fixes (cancel, remove, getOne/list, listVotes, force-password-reset + `canManageUsers`); `mustChangePassword` 403 with allowlist + router-guard branch filled; supertest ALLOW+DENY matrix.
**Addresses:** FEATURES "Authorization matrix" (P1), "mustChangePassword" (P1), supertest matrix (P2, opportunistic).
**Avoids:** Pitfalls 1 (over-restriction — DoD is the full allow+deny matrix vs `docs/06`, not "holes closed") and 2 (lockout loop — full temp-password e2e loop).
**Implements:** ARCHITECTURE Pattern 1; shared visibility helper reused by controller + `reports.scopeFilter`.
**Research flags:** MEDIUM — supertest needs a DB-story spike (mock Prisma vs test Postgres); that decision changes whether the CI workflow gains a postgres service container.

### Phase 5: Session Refresh (frontend)
**Rationale:** Independent of backend (`POST /auth/refresh` already works); pairs with Phase 4's `PASSWORD_CHANGE_REQUIRED` semantics.
**Delivers:** Single-flight 401 interceptor in `services/api.js` (`_retry` flag, one shared refresh promise, `window.location.assign('/login')` on refresh failure — no router import); uniform-401 prerequisite handled; manual verification protocol as DoD (exactly one refresh per expiry with shortened TTL, one bounce on dead cookie).
**Addresses:** FEATURES "Session refresh interceptor" (P1).
**Avoids:** Pitfall 3 (storms/infinite loops) and the import-cycle anti-pattern.
**Research flags:** LOW — pattern well-documented; single-flight specifics are community wisdom (MEDIUM) but the manual protocol validates it.

### Phase 6: State Machine & Money Rules
**Rationale:** After Phase 2 decisions, gated by Phase 1 CI. All balance/annual fixes share one pattern and should land as one reviewable change; tie-break must land here *before* Phase 7 schedules `closeExpired()`.
**Delivers:** Tie-break convergence (decide mechanism: chefe `changeMyVote` in `AGUARDANDO_DESEMPATE` vs exclude chefe's regular vote — grep every `status ===` first); `annualTotalCents` += `CONCLUIDO`; partial-approval + cancellation-with-justification + audited reversal; conditional `updateMany` balance guards at all 5 money sites + wrap `settingsController.patchBalance`'s two ops in one `$transaction`; characterization→flip tests, `Promise.all` concurrency test, finance reconciliation test.
**Addresses:** FEATURES "Tie-break convergence", "Annual-limit CONCLUIDO", "Partial-approval", "Cancellation-after-approval" (all P1); reconciliation test (P2).
**Avoids:** Pitfalls 4 (regressions under 17 tests — test count must grow in this phase) and 5 (race that doesn't serialize — no raw SQL, `tx.*` only).
**Uses:** Prisma 5 `$transaction` + conditional `updateMany`; `docs/12-testes.md` as test backlog.
**Research flags:** HIGH — **needs `--research-phase`**: Prisma 5-version-specific isolation options (fetched docs were ORM 8) + `P2034`/40001 retry semantics; DB-backed test scope decision; PROJECT.md bucket ambiguity on whether TOCTOU is in-scope (research says it must be — "funds cannot leak").

### Phase 7: Background Jobs (scheduler + voting auto-close + email queue)
**Rationale:** After Phase 6 so `closeExpired()` runs the corrected state machine (tie-break inside auto-close); one phase for both jobs — they share one scheduler/guard design (splitting duplicates Pitfall 6). Job tests need the Phase 1 gate.
**Delivers:** Fix `votingCloser.js` broken requires (`./` → `../`) first; `jobs/scheduler.js` with re-entrancy guard + `clearInterval` on SIGTERM, wired from `server.js` only; DB-as-arbiter claim (`updateMany` status claim / `PENDING → PROCESSING` before send); email give-up admin alert path; `smtpConfigured` honesty; nodemailer 10 upgrade in its own commit + stub-`sendMail` queue state test.
**Addresses:** FEATURES "Email queue drains", "Voting auto-close scheduled", "smtpConfigured" (P1); nodemailer + job telemetry (P2).
**Avoids:** Pitfalls 6 (overlap/double-run/timers-in-tests) and 11 (upgrade unverifiable while SMTP off — stub test + `transporter.verify()` before enable).
**Uses:** **Resolve the scheduler conflict:** STACK recommends node-cron 4 (`noOverlap`, timezone), ARCHITECTURE recommends plain `setInterval` and rejects node-cron — decide explicitly in planning (research leans `setInterval`: two fixed-period jobs, zero deps, no calendar needs).
**Research flags:** LOW — standard patterns; only the `docs/14` admin-alert channel is an open product decision.

### Phase 8: Reports/Audit Hardening + Auth Polish
**Rationale:** Independent, low-risk, last before final verification — everything it touches (routes, rate limits) was defined by earlier phases.
**Delivers:** Audit-before-stream for CSV/JSON/PDF (currently PDF only), CSV formula-injection neutralization (`=+-@\t\r\n` prefix-strip per OWASP), rate limits on all auth mutation routes (generous on `/refresh`, tight on `/forgot-password`), uniform login 401 while preserving lockout 423 + `PASSWORD_CHANGE_REQUIRED` distinction, distinct audit action for forced password reset.
**Addresses:** FEATURES "Export audit + CSV neutralization", "Auth hardening" (P1).
**Avoids:** Security-table mistakes (audit after headers sent; dropping lockout signaling; `invite_resent` lying about forced resets).
**Research flags:** LOW — well-documented patterns; fold into Phases 4/6 where routes are already touched if convenient.

### Phase Ordering Rationale

- **CI first:** the regression gate must exist before behavior changes; cheap and independent.
- **Decisions before rule-dependent code:** partial-approval/cancellation/tie-break cannot be test-written without decided rules (Pitfall 12).
- **Env contract before auth expansion:** rate-limit keying, audit IPs, and cookie `secure` all depend on knowing the proxy topology (Pitfalls 7/8).
- **Authorization before session refresh:** interceptor replays against endpoints whose 401/403 semantics the permission layer just defined; P2's whitelist must exist before frontend routing trusts the codes.
- **Tie-break fix before scheduler:** scheduling `closeExpired()` first automates the wedge — the one ordering constraint that silently reintroduces a "fixed" bug.
- **Jobs once, env contract once:** both dead jobs share one scheduler design; secrets/cookies/proxy are one environment contract — splitting either duplicates the pitfall.
- **Reports/auth polish last:** independent, touches routes hardened by Phase 4.

### Research Flags

Needs deeper research (`/gsd-plan-phase --research-phase <N>`):
- **Phase 6 (State machine & money rules):** Prisma 5-specific isolation/retry semantics (fetched docs were ORM 8); DB-backed test strategy; TOCTOU scope-vs-PROJECT.md-bucket ambiguity — the single most research-hungry phase.
- **Phase 4 (Authorization):** supertest DB story spike (mock Prisma vs test Postgres) — changes the CI workflow shape.
- **Phase 3 (Deploy contract):** Caddy compose wiring + topology decision — re-verify express-rate-limit `max` vs `limit` naming at upgrade time.

Standard patterns (skip research-phase):
- **Phase 1 (CI):** fully specified workflow in STACK.md.
- **Phase 5 (Session refresh):** code sketch in ARCHITECTURE.md; validated by manual protocol.
- **Phase 7 (Background jobs):** standard `setInterval` wrapper; only a product decision (admin-alert channel) open.
- **Phase 8 (Reports/auth polish):** OWASP guidance fetched and mapped to exact files.

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | Every version, engine range, and peer dependency verified against npm registry + official migration guides on 2026-09-23; effort/behavior claims tagged MEDIUM inline; Context7 unavailable (official docs used as fallback) |
| Features | HIGH (table) / MEDIUM (overall) | Categorization anchored in in-repo Active requirements + evidence-backed CONCERNS; external corroboration limited — websearch unavailable, OWASP/Express fetched directly (seam tiers webfetch as LOW) |
| Architecture | HIGH (placement) / MEDIUM (external patterns) | Placement decisions derived from direct codebase reads; Prisma concurrency / axios interceptor / CI digests are MEDIUM (cross-checked in-repo) |
| Pitfalls | MEDIUM | Grounded in direct code reads + first-party docs (nodemailer, prisma.io, MDN, OWASP, express-rate-limit); timer-overlap and single-flight specifics rest on community wisdom, marked inline; Prisma page documents ORM 8 not v5 |

**Overall confidence:** MEDIUM-HIGH — in-repo evidence is exceptionally strong (every claim traceable to code or `docs/`); the residual risk is external-pattern claims (Prisma 5 isolation syntax, GitHub Actions readiness, single-flight refresh) that were cross-checked but not executed.

### Gaps to Address

- **Scheduler technology conflict:** STACK.md recommends node-cron 4; ARCHITECTURE.md explicitly rejects it for `setInterval`. Resolve as an explicit decision during Phase 7 planning — do not let both land in PLAN.md.
- **CI action versions:** STACK (registry-verified) says `checkout@v7`/`setup-node@v7`; ARCHITECTURE code block shows v4. Use v7; treat the ARCHITECTURE snippet as illustrative.
- **Prisma 5 isolation syntax:** fetched docs cover ORM 8 — Phase 6 must confirm `$transaction({ isolationLevel })` option names + `P2034` behavior against Prisma **v5** docs before relying on Serializable.
- **TOCTOU scope ambiguity:** PROJECT.md's bucket language may classify the race fix as out-of-scope; research argues it contradicts Core Value "funds cannot leak" — orchestrator must decide explicitly, not silently.
- **DB-backed test strategy:** unsolved across phases 4 and 6 — mock Prisma vs test Postgres changes CI (service container + `pg_isready` wait + `migrate deploy`); needs a spike in Phase 4.
- **Remaining `docs/14` decisions (quorum, vista-limit):** milestone commits only to partial-approval/cancellation/email — flag for requirements definition; may deserve its own phase (FEATURES marks this P2 but "before declaring council workflow production-complete").
- **External verification limits:** websearch unavailable this run — generic Node/CI/axios claims are LOW externally; timer-overlap practices MEDIUM with no first-party source; validate at implementation.
- **Caddy compose wiring:** documented but not executed — Phase 3 includes the first real run; dev plain-HTTP shape must remain unaffected.

## Sources

### Primary (HIGH confidence)
- In-repo: `.planning/PROJECT.md`, `AGENTS.md`, `docs/03|06|07|11|12|13|14`, `.planning/codebase/CONCERNS.md` + `ARCHITECTURE.md` (b3837b7), direct reads of `app.js`, `server.js`, `env.js`, `tokens.js`, `auth.js`, `votingService.js`, `requestService.js`, `emailService.js`, `votingCloser.js`, all routes/controllers, `frontend/src/{services/api.js,router/index.js}`, `compose.yaml`, `Dockerfile`, both `package.json`/lockfiles
- npm registry queries + `npm audit` (2026-09-23) — versions, engines, peers, advisory counts
- expressjs.com Express 5 migration guide; nodemailer CHANGELOG v7→v10; MDN `Set-Cookie` (localhost Secure exception); OWASP Authorization / Authorization Regression Testing / Authentication / Forgot Password / JWT / Secrets / Logging cheat sheets + CSV Injection page; express-rate-limit official docs; supertest README; node-cron v4 docs; helmet v8 release notes; Vite/vitest migration guides; Node release schedule; PostgreSQL lifecycle pages; GitHub Actions docs; Caddy reverse-proxy quick start; prisma.io transactions docs

### Secondary (MEDIUM confidence)
- Prisma concurrency digests (context7) — conditional `updateMany` pattern, corroborated by CONCERNS
- Prisma 5 isolation syntax — page documents ORM 8, re-verify for v5 (Phase 6 flag)
- GitHub Actions service containers "no readiness wait" — negative claim verified against current page, not explicit
- express-rate-limit v8 keying / `max` vs `limit` — changelog read, not executed
- axios single-flight refresh pattern, GitHub Actions two-package CI, job scheduling digests (brave) — LOW tier cross-checked against in-repo evidence

### Tertiary (LOW confidence — needs validation)
- Timer overlap / `setInterval` best practices — community wisdom, no first-party source fetched
- Generic Node/CI/axios pattern claims — websearch unavailable this run; marked inline in FEATURES/PITFALLS
- Caddy compose specifics (`SITE_ADDRESS`, volume wiring) — behavior HIGH, compose wiring unexecuted
- Frontend interceptor behavior — zero frontend tests exist (`npm test` fails by design); verification is `npm run build` + the manual TTL protocol

---
*Research completed: 2026-09-23*
*Ready for roadmap: yes*
