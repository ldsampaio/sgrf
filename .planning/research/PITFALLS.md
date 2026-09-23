# Pitfalls Research

**Domain:** Hardening / production-readiness of an existing brownfield MVP (Node 22 / Express 4 / Prisma 5 / PostgreSQL 16 backend + Vue 3 SPA) — bug-fix and security milestone, no new features
**Researched:** 2026-09-23
**Confidence:** MEDIUM (see note)

> **Confidence note (honest reporting).** Findings below are grounded in (a) local code and the evidence-backed concern map at `.planning/codebase/CONCERNS.md` (commit b3837b7) — verified by direct file reads, and (b) first-party docs fetched today (nodemailer CHANGELOG + nodemailer.com, prisma.io transactions docs, MDN `Set-Cookie`, OWASP Authorization cheat sheets, GitHub Actions docs, express-rate-limit official docs, axios docs). The classify seam returns **LOW** for the generic `webfetch` provider (it cannot attest arbitrary URLs); mitigated by preferring first-party sources and cross-checking every claim against local code. Claims resting on community wisdom with no fetched first-party source (timer overlap, single-flight refresh specifics) are marked **MEDIUM/LOW** inline and must not be treated as authoritative.

---

## Critical Pitfalls

### Pitfall 1: Authorization fix over-restricts legitimate flows (closing under-restriction by over-correcting)

**What goes wrong:**
Holes get plugged so aggressively that documented-legitimate access breaks. Concrete traps in this codebase:
- Scoping `list` (`requestController.list`) to "own + in voting" per `docs/06-permissoes.md` can hide requests a `CHEFE_DEPARTAMENTO`/`CONSELHEIRO` legitimately needs (the matrix is role × ownership × state, not "owner only"); frontend views (`Requests.vue`, `Council.vue`) that assumed the unfiltered list go blank or sparse.
- Gating `getOne` behind ownership breaks legitimate readers of *other* users' requests: conselheiros open requests under vote, admins open everything, `getOne` is also embedded in flows that predate the check.
- `listVotes`/reports voting scoping can accidentally hide the *user's own* votes from the voter, or block the tally-display path.
- A blanket "403 until `mustChangePassword`" (Pitfall 2) or a `requirePermission` mounted too high can also catch `/auth/refresh` — the endpoint the new interceptor depends on.
- `force-password-reset` gaining `canManageUsers` must not block admins resetting themselves/each other incorrectly (`canManageUsers` semantics: admin → all; chefe → all except admin).

**Why it happens:**
The project currently under-restricts (auth-only default routes), so the mental model flips to deny-by-default in one pass — but OWASP's own guidance is deny-by-default **with an explicit, tested allow matrix**, and `docs/06` encodes nuance the code never had. Tests written first (or only) as "assert 403" validate the deny side and never notice the allow side regressed. OWASP also notes revoking access users previously enjoyed is the most disruptive change you can make — scoping `list`/`getOne` changes observed behavior for *every* non-`ALUNO` role at once.

**How to avoid:**
- Build the **Actor-Resource-Action matrix from `docs/06-permissoes.md`** as supertest fixtures covering *both* sides for every fixed route × all 5 roles: an ALLOW case and a DENY case per cell (OWASP Authorization Regression Testing pattern: IDOR "user A resource / user B request → 403 or 404, never 200"; vertical: iterate all non-privileged roles incl. unauthenticated). `supertest` is already a devDependency and never used — this is its stated purpose (CONCERNS §Dependencies).
- Enumerate every caller of each restricted route *including non-browser callers*: jobs (`system-cron` → `closeVoting`), the refresh flow, seed scripts. Anything without `req.user` must not be caught by `authJwt`-adjacent guards.
- Use `scopeFilter` in `reports.routes.js` as the in-repo model for `list` scoping (CONCERNS recommends this) and diff frontend expectations against the new scope before merging.
- Watch the over-restriction signal OWASP calls out: an unusual volume of 401/403 in logs/tests after the change means a legit flow is colliding with the new guard.

**Warning signs:**
- Tests only ever assert 403/404 (deny), never 200 (allow).
- UI screens render empty lists or generic "Falha" after a backend fix.
- Console/network tab shows 403 from routes the UI demonstrably uses (or from `/auth/refresh`).
- Manual smoke of a conselheiro opening a request under vote returns 403.

**Phase to address:** Authorization-hardening phase — DoD must be the full allow+deny matrix, not "holes closed".

---

### Pitfall 2: `mustChangePassword` 403 enforcement creates a lockout loop

**What goes wrong:**
Server-side enforcement ("403 until changed") is added as a blanket check on every authenticated endpoint, and the user **cannot comply**: `POST /auth/change-password` is itself 403'd, or `GET /auth/me` is 403'd so the router guard can never discover the flag and redirect to a change form, or `/auth/refresh` is 403'd so the session dies while the user stares at a dead app. Result: user with a temp password is hard-locked with no path out.

**Why it happens:**
Enforcement is naturally written in `authJwt` (one place, covers everything) but `authJwt` runs before route identity is considered — the exceptions (login, refresh, logout, change-password, me, health) are easy to forget, and the frontend guard is currently an empty comment (`router/index.js` line ~28), so there's no existing path to test against.

**How to avoid:**
- Enforce on a **deny-by-default list with an explicit whitelist**: deny everything authenticated except `POST /auth/change-password`, `POST /auth/refresh`, `POST /auth/logout`, `GET /auth/me` (or return the flag from `me` *with* the 403 decision), `POST /auth/login`, `GET /health`. Document the whitelist in code.
- Return a distinguishable error (`code: 'PASSWORD_CHANGE_REQUIRED'`, 403) so the frontend can route to a change view instead of showing generic failure — the router guard must redirect, not banner (MVP comment currently says "mantém no dashboard com banner").
- Frontend + backend enforcement must land together (constraint: role authority stays server-side, but the UX must honor the same rule); test the full loop: temp password login → blocked everywhere → change → unblocked.

**Warning signs:**
- 403 on `/auth/me` or `/auth/refresh` in tests after the change.
- User with `mustChangePassword: true` sees only "Falha" with no form to change the password.
- Router guard still an empty comment while backend now 403s (half-shipped).

**Phase to address:** Session & password-enforcement phase (pair frontend redirect + backend whitelist in one plan).

---

### Pitfall 3: Refresh interceptor request storms and infinite retry loops

**What goes wrong:**
The new 401 interceptor in `frontend/src/services/api.js` (currently a bare axios instance, zero interceptors) does any of:
1. **N parallel refreshes** — dashboard load fires several requests; all 401 at once after 15 min; each triggers `POST /auth/refresh` independently → storm, cookie races, and hits any rate limit newly placed on `/auth/refresh` (milestone wants rate-limiting on auth mutation routes) → 429 → mass logout.
2. **Infinite retry** — retried request 401s again (or a non-auth 401 like `mustChangePassword`) and re-enters the handler with no per-request "already retried" flag → request ⇄ interceptor loop, browser tab floods the API.
3. **Refresh failure loops** — refresh returns 401 (7-day cookie expired); if the handler retries refresh or the router guard (`auth.me()`) races the logout redirect, the user bounces `/login` ⇄ dashboard.

**Why it happens:**
Axios official docs document interceptor *mechanics* (error handler receives non-2xx; a retry re-enters the chain) but not the refresh pattern; the single-flight + retry-flag pattern is community wisdom (MEDIUM confidence) applied here. There are zero frontend tests (`npm test` intentionally fails) — verification is `npm run build` only, so nothing executes the interceptor.

**How to avoid:**
- Implement the three-part pattern: (a) per-request `config._retry` flag — retry at most once; (b) **single-flight refresh**: one shared in-flight Promise; all concurrent 401s await it, then replay; (c) refresh 401 → clear auth store, reject once, single redirect to `/login` — never retry the refresh itself.
- Do **not** rate-limit `/auth/refresh` tightly, or key it so legitimate bursts survive (each expiry = burst of parallel replays by design). Prefer generous limits there; `/forgot-password` is the route that actually needs a tight limit.
- Install the interceptor on the *same* instance the auth store uses (`me()`), so the router guard benefits; ensure `FRONTEND_URL`/CORS credentials still flow (intercepted retries reuse `withCredentials`).
- Manual verification protocol (no test framework): temporarily drop access TTL to ~10s, load dashboard, confirm in network tab exactly **one** `/auth/refresh` per expiry and zero loops; test the 7-day-expired path (delete refresh cookie → exactly one bounce to login).

**Warning signs:**
- More than one `POST /auth/refresh` in the network tab per expiry.
- Repeating 401/refresh pairs in pino-http logs (`pino-http` logs every request).
- Console tab with cycling requests; 429 from `/auth/refresh`.

**Phase to address:** Session-refresh phase (define DoD as the manual protocol above — build alone proves nothing here).

---

### Pitfall 4: State-machine fixes regress behavior under a 17-test suite

**What goes wrong:**
Tie-break (`AGUARDANDO_DESEMPATE`), `CONCLUIDO` in `annualTotalCents`, partial-approval rule, and cancellation-after-approval all edit `votingService.js`/`requestController.js` — six interlinked statuses guarded by scattered `status ===` checks across ≥5 files (CONCERNS §Fragile Areas). Existing coverage: 5 `tally()` unit tests + `calcAmount` + batch validation — **no** test executes `closeVoting`, `canVote`, `castVote`, `changeMyVote`, or `annualTotalCents`. A fix lands, CI (added later) is green, and a transition broke silently: e.g., allowing `changeMyVote` in `AGUARDANDO_DESEMPATE` re-opens deadline checks (`canVote` rejects past `votingDeadlineAt` only in `EM_VOTACAO`), lets non-chefe vote, or allows voting after `finalizedAt` was set; adding `CONCLUIDO` to the annual sum double-counts or interacts with `excludeId` on resubmit.

**Why it happens:**
Rule-dependent bugs invite "make the failing case work" fixes without characterization tests first; the suite passes by construction because it never touches the changed code; and if the bugfix phase runs **before** the CI phase, nothing gates any of it (CONCERNS explicitly names missing CI as the reason these bugs shipped).

**How to avoid:**
- **Order the roadmap so the minimal CI gate lands first or in parallel** — `cd backend && npx vitest run` + `cd frontend && npm run build` on every push (exactly these commands; AGENTS.md forbids inventing others).
- Characterization-test-first: write tests pinning *current* behavior of `closeVoting`/`canVote`/`annualTotalCents` (all statuses), then flip expectations deliberately per the `docs/03` decision.
- Before adding any transition, `grep` the status string across `backend/src` (CONCERNS "Safe modification" instruction) and check every guard.
- `docs/12-testes.md` already enumerates the desired cases (vista extension, deadline, tie-break, annual-limit edge cases) — treat it as the test backlog for this phase.
- Add a DB-backed integration test for `closeVoting`'s balance side effects (provision on approve, none on reject) — currently zero.

**Warning signs:**
- Test count unchanged after a phase that changes behavior.
- A fix commit whose diff touches `votingService.js` with no accompanying test change.
- `grep` reveals a `status ===` guard in a file the fix didn't review (e.g., `votingCloser.js`, `financeController.js`).

**Phase to address:** CI baseline phase **before** (or parallel with) the State-machine & money-rules phase.

---

### Pitfall 5: Prisma "race fix" that doesn't actually serialize — or deadlocks instead

**What goes wrong:**
The TOCTOU overspend race (reads of `getBalance`/`annualTotalCents` outside `$transaction`, unconditional `decrement`, `FundBalance.version` never used — CONCERNS §Performance) gets "fixed" ineffectively:
- Wrapping the existing read-then-write in `$transaction` **changes nothing**: PostgreSQL default isolation is `READ COMMITTED` (verified, prisma.io) — two transactions both read `availableCents=100`, both pass the check, both decrement.
- Moving to `SERIALIZABLE` without retry: Prisma does **not** retry write conflicts (`sqlState 40001` serialization failure, `40P01` deadlock — verified) — they surface as 500s under load; a deadlock arises from the five copy-pasted balance blocks locking rows in different orders.
- Using the root `prisma` client inside a `$transaction(async (tx) => …)` callback: those queries run **outside** the transaction and commit independently — atomicity silently lost (a documented Prisma "common mistake"; in Prisma 5 the API is `$transaction`, but the tx-vs-root pitfall is identical).
- Fixing the balance but leaving `annualTotalCents` read outside the transaction — the annual cap race remains.

**Why it happens:**
`$transaction` *feels* like a race fix; the `version` column looks like optimistic locking but is only incremented, never checked; five duplicated transaction blocks make consistent edits hard; the whole suite runs single-threaded, so every test passes.

**How to avoid:**
- Make the **conditional update the serialization point** (works in Prisma 5, no raw SQL — project forbids raw SQL): `fundBalance.updateMany({ where: { referenceYear, availableCents: { gte: amount } }, data: { decrement: …, version: { increment: 1 } } })`; if `count === 0` → throw "Saldo insuficiente". The WHERE is evaluated atomically against the committed row.
- Move balance **and** annual-total reads inside the transaction; use `tx.*` exclusively inside callbacks; pass `tx` into helpers rather than letting them re-enter via `prisma.*`.
- If SERIALIZABLE is chosen instead (Prisma 5 `$transaction` options support `isolationLevel` — verify against Prisma **v5** docs at implementation, MEDIUM confidence; fetched page documents ORM 8), wrap the call in a retry-on-`40001`/`40P01` loop with backoff (official Prisma guidance).
- Add two tests: (1) reconciliation — `sum(FinancialTransaction)` per type equals `FundBalance` deltas; (2) concurrency — `Promise.all` of N submissions/approvals never drives `availableCents` negative, never double-provisions.

**Warning signs:**
- `version` incremented but never appears in any `WHERE`/`where` clause.
- A race "fix" commit with no test that runs concurrent operations.
- Balance reads (`getBalance`, `annualTotalCents`) still above `$transaction`.
- New 500s with `40001`/`40P01` in logs after introducing SERIALIZABLE.

**Phase to address:** State-machine & money-rules phase (the tie-break/partial/cancellation fixes already touch `closeVoting`'s balance path — fix the race *while in there*; note PROJECT.md's scope decision may classify TOCTOU as out-of-bucket, but a "fixed" `closeVoting` that still double-provisions contradicts Core Value "funds cannot leak").

---

### Pitfall 6: Scheduled jobs — overlap, drift, and double-run

**What goes wrong:**
`processQueue()` and `closeExpired()` get wired with naive `setInterval` from `server.js` and then:
- **Overlap:** timers fire on schedule regardless of the previous async run finishing (community wisdom, MEDIUM) — SMTP timeouts make `processQueue` slow; a run outlasting the interval double-sends queued emails (queue rows are only flipped to `SENT` *after* `sendMail` returns, so a concurrent run re-reads the same `PENDING` rows).
- **Double-run across processes:** any second scheduler against the same DB (a `docker compose up` alongside local `npm run dev`; a future second replica — CONCERNS §Scaling Limits already warns) closes votings/enqueues sends twice. `closeVoting`'s idempotence check reads status **outside** its transaction (verified in `votingService.js`), so two concurrent closers can both see `EM_VOTACAO` and **both provision** — the idempotency claim does not survive concurrency.
- **CI/test contamination:** scheduling from `app.js` (the module tests would import) starts timers in the vitest process → hanging suites, open handles, or tests writing to the dev DB. Also `votingCloser.js` currently has **broken requires** (`./config/db` from `src/jobs/` resolves to `src/jobs/config/db` — wrong) — wiring it without fixing paths fails at first tick.
- **Silent starvation:** `take: 50` per run — a backlog larger than `50 × runs/day` drains slowly; `GIVE_UP` rows just log "alert admin" without alerting anyone (docs/14 promises three attempts + admin alert).

**Why it happens:**
"Chamado por cron" comments imply infrastructure that doesn't exist; single-process assumption holds today so bugs hide; jobs have zero tests (CONCERNS: dead code paths stay green because nothing executes them).

**How to avoid:**
- In-process guard: a `running` boolean (skip tick if busy) + `clearInterval` on `SIGTERM`/`SIGINT`.
- Make the DB the cross-process arbiter: first statement inside `closeVoting`'s transaction = conditional `updateMany({ where: { id, status: { in: ['EM_VOTACAO','AGUARDANDO_DESEMPATE'] } }, … })` and bail on `count === 0`; same claim-then-process pattern for queue rows (flip `PENDING → PROCESSING` before sending). This is the no-raw-SQL, single-or-multi-replica-safe defense.
- Wire scheduling **only in `server.js`** (keep `app.js` pure — the existing `createApp()` split already enables this), so importing the app in tests never starts timers; add an integration test invoking `closeExpired()`/`processQueue()` directly (supertest or service-level).
- Fix `votingCloser.js` requires first; implement the give-up → admin path per `docs/14` (an `AuditEvent` or failed-admin notification, not `logger.error`).
- Document "single app replica" as an explicit invariant in compose (or add a job-leader note) until an external lock exists (Postgres advisory locks would need raw SQL — out of constraints).

**Warning signs:**
- Two `voting auto-closed` log lines for the same `requestId`.
- Duplicate `SENT` rows / user reports of duplicate emails.
- Vitest hangs or touches the dev DB after jobs are wired.
- `closeExpired` silently no-ops (broken require crash caught by nothing).

**Phase to address:** Background-jobs phase (queue + voting closer together — same scheduler, same guard pattern).

---

### Pitfall 7: Secure cookie over plain HTTP — login silently works on localhost, fails in production

**What goes wrong:**
`cookieOpts.secure = (NODE_ENV === 'production')` (verified, `tokens.js`) while `compose.yaml` publishes plain HTTP (`APP_PORT → 3000`, no TLS). Per MDN (authoritative): browsers accept `Secure` cookies **only over `https:` — except on localhost**. So the login endpoint returns 200 + `Set-Cookie: …; Secure`, the browser silently drops it, the next `/me` 401s, and the user bounces to `/login` forever — on any LAN/production hostname. Every localhost test passes. CONCERNS flags exactly this.

**Why it happens:**
`secure` is derived from *process* mode (`NODE_ENV`) instead of *transport* reality; local verification happens on localhost where the exception applies, so the bug is invisible until first non-localhost deployment.

**How to avoid:**
- Decouple: `secure: process.env.COOKIE_SECURE === 'true'` (explicit deployment intent), **or** terminate TLS in front and require `FRONTEND_URL=https://…`; document in the deployment story that compose-as-shipped is HTTP → `COOKIE_SECURE=false`, TLS-fronted prod → `true`.
- Acceptance test that localhost cannot satisfy: `curl -i http://<lan-ip>:<APP_PORT>/api/auth/login -d …` and assert the `Set-Cookie` **is storable over HTTP** (no `Secure`) in the HTTP deployment — and conversely that a TLS deployment sends `Secure`.
- Keep `sameSite: 'lax'` + httpOnly unchanged (accepted CSRF posture per `docs/11`).

**Warning signs:**
- Login returns 200 but immediately `/api/auth/me` 401s (check pino-http).
- Cookies missing in devtools' Application panel when using an IP hostname.
- "Works on my machine" only reproducible via `localhost`.

**Phase to address:** Deploy/secrets/HTTPS phase — must include a non-localhost login verification step.

---

### Pitfall 8: Rate-limit `trust proxy` misconfiguration (global lockout or spoofable buckets)

**What goes wrong:**
- **Proxy-blind (current state):** `app.js` never sets `trust proxy`. Behind any reverse proxy, every client shares `req.ip` = proxy IP → the limiter's default `keyGenerator` (client IP — verified) collapses everyone into one bucket → one bonafide burst or attacker trips 429/20 for *all* users (CONCERNS: "global login lockout").
- **Over-corrected:** `trust proxy = true` lets clients spoof `X-Forwarded-For`; express-rate-limit's built-in validation (on by default — verified) logs `ERR_ERL_PERMISSIVE_TRUST_PROXY`/`ERR_ERL_UNEXPECTED_X_FORWARDED_FOR` **to console only** — easy to ignore while buckets become attacker-rotatable (unlimited login attempts against the per-account lockout).
- **Wrong hop count:** trusting more hops than the topology has re-opens spoofing; trusting fewer keeps the shared bucket.
- **Store semantics:** the default memory store is per-process (also reset on restart — verified) — correct only while compose runs a single app replica; scaling out silently splits/quarantines buckets.
- Interacts with Pitfall 3: tight limits on `/auth/refresh` + interceptor burst = accidental mass lockout.

**Why it happens:**
The fix "just add `trust proxy`" is usually written as `true` (the dangerous value) without matching the actual topology; compose-as-shipped has **no** reverse proxy (published port direct), so the correct value differs per deployment shape.

**How to avoid:**
- Make it topology-driven: `app.set('trust proxy', env.trustProxy)` with default **off** (compose direct-publish shape needs none), set to the exact hop count (e.g. `1`) only when a reverse proxy is introduced; document the topology decision next to `compose.yaml`.
- Keep the library's `validate` enabled (default) and treat its console warnings as errors in review; add rate limits to **all** auth mutation routes (`/forgot-password`, `/refresh` generously, `/change-password`) per Active scope, with `skipSuccessfulRequests` where appropriate.
- Test both sides: behind the proxy, distinct clients must get distinct buckets; a spoofed `XFF` must not create a fresh bucket.
- Note the emergency lever: memory store resets on restart (until an external store is adopted — out of scope, single replica today).

**Warning signs:**
- `ERR_ERL_*` validation lines in startup/runtime logs.
- All users 429-ing together in staging behind the proxy.
- Sending `X-Forwarded-For: 1.2.3.4` resets your bucket (spoofing works).

**Phase to address:** Auth-hardening & deploy-config phase (rate-limit expansion + trust proxy + topology doc in one plan).

---

### Pitfall 9: Secret fail-fast breaks local dev, tests, or CI instead of catching prod misconfig

**What goes wrong:**
`env.js` gains production fail-fast, but implemented too broadly or too narrowly:
- **Too broad:** throws whenever `JWT_*` missing → fresh-clone `npm run dev` before `cp .env.example backend/.env`, `npx prisma migrate/seed` scripts (they load `env.js` via deps), and vitest (any test importing app config) all die — the developer experience documented in `AGENTS.md` breaks and gets "fixed" by reverting the guard.
- **Too narrow:** only checks *absence* — but `compose.yaml` already enforces presence via `${VAR:?}`; the real hole CONCERNS documents is the **insecure fallback values** (`dev-*-secret-change-me…`, hardcoded default admin email). A deploy with `JWT_ACCESS_SECRET=dev-access-secret-change-me-0123456789` present passes an absence check while signing forgeable JWTs.
- CI has no `JWT_*`/`INITIAL_ADMIN_*` set — fail-fast turns the new pipeline red for the wrong reason (or worse, tests were passing on dev fallback secrets).

**Why it happens:**
Fail-fast is specified as "refuse insecure fallbacks when `NODE_ENV=production`" but `env.js` is a transitive import of nearly everything, so the blast radius includes dev and test paths; presence-vs-value is an easy distinction to miss because compose already solved presence.

**How to avoid:**
- Gate strictly on `NODE_ENV === 'production'`; dev/test keep documented fallbacks (`start-dev.sh` flow untouched).
- Check **values, not just presence**: reject known-bad values (`dev-`, `change-me`, empty `INITIAL_ADMIN_TEMPORARY_PASSWORD`) in production; error message must list the offending variable names (actionable, not stack trace).
- CI workflow sets dummy `JWT_ACCESS_SECRET`/`JWT_REFRESH_SECRET` (any string) so tests exercise the guarded path without real secrets; never commit real values (`backend/.env` is danger-zone per AGENTS.md).
- Verify every boot path: `docker compose up` (has envs) ✓, bare `node src/server.js` in prod mode without envs → clear crash ✓, `npm run dev` → unaffected ✓, `npx vitest run` → unaffected ✓.

**Warning signs:**
- Container restart-loop with env errors; seed/migrate scripts crashing.
- CI red with "missing secret" on a commit unrelated to config.
- A "production" boot succeeding with `dev-*-secret-change-me` still in place.

**Phase to address:** Deploy/secrets phase (same phase as Pitfall 7 — both are env/deploy contract).

---

### Pitfall 10: Postgres-dependent CI starts flaky — then the gate gets tolerated instead of fixed

**What goes wrong:**
The minimal CI (first pipeline ever — no `.github/` exists) grows DB-backed tests (authorization supertest suite needs Postgres) and flakes:
- GitHub Actions service containers have **no built-in wait-for-readiness** (verified against current docs; unlike compose's `healthcheck`/`depends_on`) → first steps hit `ECONNREFUSED`/Prisma `P1001` intermittently → red builds that pass on rerun → someone adds blanket retries or marks tests optional → the regression gate CONCERNS asked for is de-facto dead.
- `prisma migrate dev` used in CI — AGENTS.md warns it's the local interactive command (can reset the DB); CI must use `migrate deploy`.
- Missing env (Pitfall 9), shared-DB test pollution (batch tests create users; parallel vitest files interleave), or accidentally importing `server.js`/job modules (Pitfall 6) → hanging/open-handle timeouts.

**Why it happens:**
Compose's readiness semantics are assumed to carry over to Actions; the team's first pipeline mixes "make it green" pressure with new integration tests.

**How to avoid:**
- Explicit wait step before tests, e.g. `until pg_isready -h localhost -p 5432; do sleep 1; done` (service is reachable at `localhost:<port>` on `ubuntu-latest` — verified).
- Pipeline shape: checkout → Node 22 → `npm ci` (backend) → set dummy `JWT_*` env → `npx prisma generate` → `npx prisma migrate deploy` → `npx vitest run` → checkout frontend → `npm ci` → `npm run build`. Exactly the two documented verification commands; no invented lint/typecheck.
- **Phase the gate:** land CI on the existing 17 unit tests (no DB, zero flake surface) *first*; add the DB service only when integration tests land, with the wait step from day one.
- Integration tests own their data (truncate/reset per test or dedicated CI schema); never import `server.js` in tests; `retry-on-failure` is banned as a substitute for the wait step (flaky gate = no gate).

**Warning signs:**
- First runs fail with `P1001`/`ECONNREFUSED`, rerun passes.
- `prisma migrate dev` output (or reset prompts) in workflow logs.
- Tests green locally, red in CI (or vice versa) — indicates shared-DB/env drift.

**Phase to address:** CI-baseline phase (early — see phase mapping); DB-service sub-step lands with the authorization test suite.

---

### Pitfall 11: nodemailer major upgrade looks green but breaks exactly when SMTP turns on

**What goes wrong:**
`nodemailer ^6.9.14` → current **v10.0.10** (verified CHANGELOG, 2026-09-14). For this codebase's usage (`createTransport({host,port,secure,auth})` + `sendMail({from,to,subject,text})`) the breaking changes are **all irrelevant**: v7 removed SES SDK features (SMTP unaffected), v8 renamed error code `NoAuth→ENOAUTH` (code only stores `e.message`), v9 validates TLS only for *fetched remote content/OAuth/proxy* (unused here), v10 requires **Node ≥20** (project: Node 22 ✓) and rewrote in TypeScript shipping a CJS build (`require` works ✓; no `@types/nodemailer` present ✓). The actual traps:
- `SMTP_ENABLED=false` everywhere (compose default-off, CI has no SMTP) means **`sendMail` is never executed** by any test — the upgrade is unverifiable-by-default and breaks only when an admin flips SMTP on in production.
- `npm audit fix --force` performs the major bump blind and can drag other majors in the same commit — conflating failures.
- `getTransporter()` caches the transporter forever (module-level `let`) — config changes/tests need a reset path; also nodemailer docs advise `transporter.verify()` for config smoke.

**Why it happens:**
Audit pressure ("HIGH severity ≤ 9.1.0") tempts `--force`; the disabled-by-default send path creates false confidence (CONCERNS' own migration plan assumes the surface is small — it is, but *unexercised*).

**How to avoid:**
- Pin explicitly: `npm install nodemailer@^10` in its **own commit**; read the v7→v10 breaking-changes list once more at upgrade time (current as of 2026-09-23).
- Add a unit test that stubs `transporter.sendMail` and drives `processQueue()` through `PENDING → SENT` and `FAILED → attempts++ → GIVE_UP` (no real SMTP needed — this exercises everything except the wire protocol).
- Before enabling SMTP in any environment: `transporter.verify()` smoke (script or `/email/test` stub made real), ideally against Ethereal/staging first.
- Do the upgrade **before** enabling SMTP (CONCERNS migration plan) and before/with the queue-wiring phase so one review covers "sends" end-to-end.

**Warning signs:**
- Upgrade bundled with unrelated fixes; `--force` in the diff.
- Zero tests touch `emailService.sendMail` after the upgrade.
- `@types/nodemailer` appearing anywhere (would conflict with v10 bundled types).

**Phase to address:** Email-queue phase (upgrade inside it, own commit).

---

### Pitfall 12: Open business decisions (`docs/14`) get re-guessed in code

**What goes wrong:**
Partial-approval rule and cancellation-after-approval (both Active requirements) get implemented by whichever engineer reads `closeVoting` first — e.g., partial keeps "first partial vote wins" with a shrug — so the code records *another* implicit decision, `docs/13`/`docs/14` go stale, and the fix is reworked when the council disagrees. Existing pattern: `docs/14` vs code already diverge on "vista máx 1 por solicitação" (doc) vs `@@unique([requestId, requestedBy])` (schema) — N vistas stacking deadline extensions.

**Why it happens:**
Rule-dependent bugs can't be test-written without a rule; time pressure resolves the ambiguity locally in code instead of in the doc; several answers already live implicitly in code, making "match current behavior" look like a decision.

**How to avoid:**
- Hard dependency: a **Rules-decisions phase precedes** state-machine fixes — every `docs/14` item that blocks an Active bug gets decided, written into `docs/03`/`docs/14` (mark decided, date, rationale), then implemented with a test encoding *that* rule.
- One commit must update doc + code + test together (constraint from PROJECT.md Key Decisions).
- For any "match the doc or match the code?" conflict, choose explicitly and note which one changed — never silently align to existing behavior.

**Warning signs:**
- Implementation PR with no `docs/` diff for a rule-dependent item.
- Comments like "usa o primeiro (por enquanto)" / "MVP" carrying business rules (already present in `closeVoting`).
- Test asserting a rule that neither `docs/03` nor `docs/14` states.

**Phase to address:** Rules-decisions phase (first content phase — everything rule-dependent queues behind it).

---

## Technical Debt Patterns

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| Authz tests that only assert 403 (deny side) | Fast "holes closed" evidence | Over-restriction ships unnoticed; matrix rots | Never — every deny cell needs an allow cell |
| `trust proxy = true` "to make rate-limit work" | One-line fix | IP spoofing → unlimited login attempts behind proxy | Never — use exact hop count |
| Blanket retries / `continue-on-error` in CI | Green pipeline | Gate de-facto disabled; original bugs recur (the exact failure CONCERNS cites) | Never — fix readiness/wait instead |
| `npm audit fix --force` bundled into feature commits | Audit noise gone | Opaque major bumps; two failure modes in one diff | Only as its own reviewed commit |
| Leaving `version` column unused after "optimistic locking fix" | Looks implemented | False security; race persists | Never — either use it in `WHERE` or drop the claim |
| Suppressing rate-limiter `validate` (`validate: false`) to silence console warnings | Quiet logs | Proxy misconfig undetected forever | Never — fix the config it's warning about |
| Hardcoding role arrays in new guards (`['ADMINISTRADOR','CHEFE_DEPARTAMENTO'].includes`) | Fast endpoint fix | The scattered-checks shape `docs/06` explicitly warns against; next route defaults open again | Acceptable only if the shared permission map lands in the same milestone |
| Keeping both `/api/settings` and `/api/finance` mounts while touching settings auth | Avoids a breaking decision | Docs/OpenAPI drift across two prefixes | Only if flagged in CONCERNS-style notes; decide in a dedicated fix |
| JSON-string columns left as-is | Avoids migration | Silent parse failures, unqueryable audit data | Acceptable this milestone (explicitly out of scope) |

## Integration Gotchas

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| SMTP / nodemailer | Bump with `--force`, trust green CI while `SMTP_ENABLED=false` | Own-commit pin to `^10`; stub-`sendMail` queue test; `transporter.verify()` before enabling |
| Reverse proxy (future) | `trust proxy = true`, or never set it at all (current) | Env-driven hop count, default off for compose's direct publish; keep limiter `validate` on |
| GitHub Actions + Postgres | Assume compose healthcheck semantics; run `migrate dev` | Explicit `pg_isready` wait step; `prisma migrate deploy`; dummy `JWT_*` env |
| axios + cookies (refresh) | Retry without `_retry` flag; refresh called N times; tight rate limit on `/auth/refresh` | Single-flight promise + one-retry flag + generous refresh limits |
| Cookies + HTTPS (compose is HTTP) | Tie `secure` to `NODE_ENV` | Explicit `COOKIE_SECURE` (or TLS in front); verify login over `http://<ip>` |
| Prisma `$transaction` | Use root `prisma.*` inside callback; assume it serializes READ COMMITTED | `tx.*` everywhere; conditional `updateMany` as lock; retry `40001`/`40P01` if SERIALIZABLE |
| CORS/FRONTEND_URL with credentials | Change cookie/HTTPS story without updating `FRONTEND_URL` (CORS origin + `credentials: true`) | Keep `FRONTEND_URL` and cookie domain/scheme story in one deploy-config checklist |
| Local dev vs Docker double-process | Dev server + container both run jobs/rate-limiters against one DB | Single scheduler invariant (Pitfall 6); never wire jobs in `app.js` |

## Performance Traps

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| Scoped list + hard `take: 100` cap | Users see fewer rows after authz fix and report data loss; silent truncation misread as a scoping bug | Document the cap; distinguish "scoped" from "truncated" in UI/logs (pagination itself is Out of Scope) | Any list where scoped+cap interact — noticed immediately, wrong diagnosis |
| New audit rows on every export/config change (audit-before-stream) | `AuditEvent` grows faster (full before/after JSON snapshots), no retention policy exists | Acceptable this milestone; flag retention decision (docs/14) | Months of production — Out of Scope now, known limit |
| `processQueue` serial sends with SMTP timeouts | Queue backs up behind one slow host; overlap risk (Pitfall 6) | Batch limit + running-flag guard; monitor `PENDING` depth | Slow/unreachable SMTP, e.g., first enablement |
| Per-request `prisma.user.findUnique` in `authJwt` | Latency couples to DB (existing, unchanged) | No change needed at current scale; revisit only with volume | Out of Scope — noted so nobody "fixes" it mid-milestone |
| Dashboard loads 2000 rows into Node (existing) | Slow dashboard as data grows | Unchanged this milestone (Out of Scope) | Known, deferred |

## Security Mistakes

| Mistake | Risk | Prevention |
|---------|------|------------|
| Uniform-401 login change accidentally drops lockout (423) or `mustChangePassword` signals | Lockout behavior per `docs/11` silently disabled, or user can't distinguish causes | Decide explicitly: uniform *401 for wrong credentials*, keep distinct lockout/forced-change handling; test all three paths |
| `force-password-reset` alias fix adds guard but keeps `invite_resent` audit action | Audit trail lies about a privileged action (chefe resetting admin) | Distinct audit action for forced reset; `canManageUsers(actor, target)` inside handler (verified missing) |
| Report audit added *after* streaming starts | Audit failure occurs post-headers → event lost or half-download | Audit before `res` streaming for CSV/JSON/PDF alike (Active scope says exactly this) |
| CSV neutralization only for quotes (current `toCSV`) | `=`/`+`/`-`/`@` formula injection when admin opens export | Prefix/strip formula-leading chars in every cell — titles are user-controlled |
| Refresh interceptor logs or exposes refresh errors | Token material in logs (pino redaction covers keys, not message text — known issue with temp passwords) | Never log token/cookie values; keep pino redaction |
| Error handler still returns `err.stack` when `NODE_ENV` mis-set / `err.message` always | Prisma query internals leak | Whitelist stack flag; map known `status` errors to safe messages (CONCERNS recommendation) |
| Rate limits added only to `/login` (current) | `/forgot-password` floods `EmailQueue` + audit; password resets for a victim | Limit all auth mutation routes (Active scope) with refresh carve-out (Pitfall 8) |

## UX Pitfalls

| Pitfall | User Impact | Better Approach |
|---------|-------------|-----------------|
| Interceptor kicks user to `/login` on *any* 401 (incl. `mustChangePassword` 403/401 or transient errors) | Bouncing to login while still valid; lost form state | Distinguish `PASSWORD_CHANGE_REQUIRED` and refresh-failure; only true session death redirects |
| Forced-password users hit dashboard banner (current no-op guard) while backend 403s everything | Confusing wall of "Falha" errors | Router guard redirects to change-password view; whitelist guarantees a path out (Pitfall 2) |
| Uniform login error message hides lockout state | User retries into an invisible 15-min lockout | Keep a distinct lockout message (docs/11 lockout is UX-relevant) even if wrong-credential errors unify |
| Scoped lists render empty with the existing `e.response?.data?.error \|\| 'Falha'` pattern (undefined error → blank) | Blank UI on any new 403 | Standardize error surfacing when touching interceptor (CONCERNS suggests `useApiError` helper) — minimal version OK |
| Job-driven state changes (voting auto-closes) happen with no UI cue | User sees status changed "by itself" | Status/timestamps (`decidedAt`, `decidedBy: system-cron`) surfaced in detail view |

## "Looks Done But Isn't" Checklist

- [ ] **Authorization:** every fixed route has **allow + deny** tests for all 5 roles — verify by counting matrix cells vs `docs/06`, not by "403 works".
- [ ] **Refresh:** one `POST /auth/refresh` per expiry with N parallel requests, exactly one bounce on dead refresh cookie, no 429 — verify with devtools + temporarily shortened TTL.
- [ ] **`mustChangePassword`:** temp-password user can reach and complete change (whitelist proven by test), then all routes unlock — verify the full loop, not the 403 alone.
- [ ] **Jobs:** running in the deployed container (log lines on schedule), survives two ticks with a slow run (no overlap), no timers start when tests import the app, `votingCloser` requires actually resolve.
- [ ] **Race fix:** concurrency test (N parallel operations) leaves `availableCents` correct and `sum(transactions)` reconciles; `version` used or claim removed.
- [ ] **Secrets:** prod-mode boot **with present-but-insecure** `dev-*-secret-change-me` values fails (not just missing vars); `start-dev.sh` still works untouched.
- [ ] **Cookies:** login verified once via `http://<LAN-IP>` hostname (the localhost exception hides this bug class).
- [ ] **Rate limit:** behind the real topology, two clients = two buckets, spoofed `X-Forwarded-For` = same bucket; no `ERR_ERL_*` in logs.
- [ ] **nodemailer:** queue `PENDING→SENT→GIVE_UP` covered by a stub test; upgrade diff contains no unrelated major bumps; `verify()` smoke before SMTP enablement.
- [ ] **CI:** pipeline goes red on a deliberately broken assertion (gate proven, not assumed); second consecutive run also green (no flake); no `migrate dev` / retry-suppression anywhere.
- [ ] **State machine:** test count grew in the phase that changed behavior; `grep` of each touched status shows every guard reviewed.
- [ ] **Decisions:** `docs/14` items touched by fixes are marked decided with doc+code+test in one commit.

## Recovery Strategies

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| Over-restriction broke legit flow (P1) | MEDIUM | Failing allow-case in matrix pinpoints cell; relax that route's guard; hotfix + matrix test added same day |
| Refresh storm in prod (P3) | MEDIUM | Ship fix forward (flag + single-flight); emergency: users clear cookies / restart app clears rate buckets; downgrade: revert frontend commit (SPA redeploy, no data impact) |
| Double-provisioned balance (P5/P6) | HIGH | Freeze financial mutations; reconciliation query finds divergence; reverse via existing `reverse-provision` flow + `FinancialTransaction` correction rows; audit log documents incident |
| Cookie lockout on HTTP deploy (P7) | HIGH for affected users | Set `COOKIE_SECURE=false` (if env-ized) or front with TLS; redeploy; affected users re-login |
| Rate-limit mass 429 (P8) | LOW | Restart app (memory store clears); correct `trust proxy`; redeploy |
| Secret fail-fast crash-loop (P9) | LOW | Set the named vars (message lists them); fix `.env.example`/compose docs; redeploy |
| Flaky CI eroded trust (P10) | MEDIUM | Fix wait step at root; forbid retry-suppression; re-run history to prove stability before relying on gate |
| nodemailer break found at SMTP enablement (P11) | LOW pre-enable | Pin back to v6 (own commit revert), re-test with stub, re-attempt upgrade in isolation |

## Pitfall-to-Phase Mapping

Suggested phase topics (roadmap may rename/merge) — ordering rationale follows dependencies: **decisions first, CI gate before behavior changes, authz before session UX, scheduler once, deploy contract together.**

| Pitfall | Prevention Phase | Verification |
|---------|------------------|--------------|
| P12 Open decisions guessed | **Phase A — Rules decisions (`docs/14` close-out)** | Doc+code+test commits for each decided item |
| P10 17-test regression; P10 CI flake (initial gate) | **Phase B — CI baseline (early!)** | Pipeline red on deliberate break; 17 tests + build green twice |
| P1 Authz over-restriction; P2 mustChangePassword loop | **Phase C — Authorization hardening** (+ session phase pairing for P2) | Full allow+deny matrix vs `docs/06`; temp-password loop e2e |
| P3 Refresh storm | **Phase D — Session refresh** | Manual protocol: 1 refresh/expiry, 1 bounce on dead cookie |
| P4 State-machine regressions; P5 Prisma race | **Phase E — State machine & money rules** (after A, gated by B) | Characterization→flip tests; concurrency + reconciliation tests |
| P6 Job overlap/double-run | **Phase F — Background jobs** (after B so job tests are gated) | Overlap guard test; idempotent close under parallel calls; no timers in tests |
| P8 Rate-limit/trust proxy; P7 cookie/HTTPS; P9 secrets fail-fast | **Phase G — Deploy & auth config** (single env-contract phase) | LAN-IP login test; spoofed-XFF test; prod boot with bad values fails |
| P11 nodemailer; queue drain mechanics | **Phase H — Email pipeline** (after F's scheduler exists) | Stub-send queue state test + `verify()` smoke |
| Report audit/CSV (Security table) | Fold into C or E where routes touched | Audit-before-stream test; formula-cell fixture |

**Phase ordering rationale:**
- B (CI) before C–F: CONCERNS names missing CI as *the* reason these bugs shipped; a gate that lands last gates nothing.
- A before E: partial-approval/cancellation fixes are untestable without decided rules (P12).
- C before D: interceptor replays against endpoints whose 401/403 semantics C just defined; P2's whitelist must exist before frontend routing trusts the codes.
- F once: both dead jobs share one scheduler/guard design — splitting them duplicates Pitfall 6.
- G grouped: `env.js`, cookies, and proxy config are one environment contract; splitting invites inconsistent story (e.g., secrets fixed but cookie still tied to `NODE_ENV`).
- H after F: `processQueue` wiring must exist (and be job-tested) before upgrading its mailer.

**Research flags for phases:**
- Phase E (state machine/money): **needs deeper research** — Prisma 5-version-specific isolation/locking options must be confirmed against Prisma v5 docs (fetched page was ORM 8); race scope vs PROJECT.md bucket ambiguity should be resolved by the orchestrator.
- Phase G (deploy config): topology decision (proxy or direct) pending — affects `trust proxy` value; MEDIUM confidence item (CI wait step) to re-verify against Actions docs at implementation.
- Phases A–D, F, H: standard patterns, unlikely to need research beyond docs/ corpus.

## Sources

| Source | Confidence | Notes |
|--------|------------|-------|
| Local code + `.planning/codebase/CONCERNS.md` (b3837b7, 2026-09-22/23) | HIGH | Directly read: `auth.js`, `api.js`, `env.js`, `tokens.js`, `authController.js`, `votingService.js`, `requestService.js`, `emailService.js`, `votingCloser.js`, `server.js`, `app.js`, `router/index.js`, `compose.yaml`, `Dockerfile`, `docs/03|06|11|12|14`, both `package.json` |
| nodemailer CHANGELOG (raw.githubusercontent.com) + nodemailer.com, fetched 2026-09-23 | HIGH | First-party; version chain v7→v10 breaking changes verified |
| prisma.io transactions docs, fetched 2026-09-23 | HIGH for semantics / MEDIUM for Prisma 5 syntax | Page documents ORM 8; READ COMMITTED default, no auto-retry, tx-vs-root mistakes verified; v5 `$transaction` option names to re-check |
| MDN `Set-Cookie` reference (rev. 2026-09-01) | HIGH | Authoritative; localhost Secure exception verified |
| OWASP Authorization + Authorization Regression Testing cheat sheets | HIGH | First-party OWASP; matrix/allow-deny/CI-gating patterns |
| express-rate-limit GitHub readme + mintlify configuration docs | HIGH | First-party; `keyGenerator` default, `validate` proxy checks, memory-store semantics verified |
| GitHub Actions service-container docs (fetched 2026-09-23) | MEDIUM | No-readiness-wait is a negative claim verified against current page; corroborated by practice, not an explicit "does not wait" statement |
| axios official interceptor docs | HIGH for mechanics / MEDIUM for refresh pattern | Single-flight + retry-flag specifics are community wisdom (websearch integration unavailable this run — flagged, not hidden) |
| Timer overlap / setInterval practices | MEDIUM | Community wisdom; no first-party doc fetched — validate at implementation |

---
*Pitfalls research for: SGRF/SGRD hardening milestone (production-ready bug-fix pass)*
*Researched: 2026-09-23*
