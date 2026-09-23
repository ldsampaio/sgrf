---
last_mapped_commit: b3837b7e16bf00622f1be01d8316a0290affc7f6
last_mapped_at: 2026-09-23
---
# Codebase Concerns

**Analysis Date:** 2026-09-22

## Tech Debt

**Email queue is never processed:**

- Issue: `processQueue()` is exported but never called — no scheduler in `backend/src/server.js`, no cron in `backend/docker-entrypoint.sh`, no caller anywhere in the repo (verified by grep).
- Files: `backend/src/services/emailService.js`, `backend/src/server.js`, `backend/docker-entrypoint.sh`
- Impact: All emails (temporary passwords, invitations, request notifications) sit `PENDING` forever in the `EmailQueue` table. Invitation/reset flows are effectively dead in every environment, not just when `SMTP_ENABLED=false`.
- Fix approach: Wire `processQueue` into a `setInterval` (or node-cron) started from `server.js`; also implement the "give up → alert admin" behavior promised in `docs/14-decisoes-em-aberto.md` (currently only `logger.error`).

**Voting auto-close job never scheduled:**

- Issue: `backend/src/jobs/votingCloser.js` runs only when invoked manually (`node src/jobs/votingCloser.js`); its comment claims "Chamado por cron" but no cron/interval exists in `server.js` or the entrypoint. Backlog item "encerramento automático" (`docs/13-backlog.md` Fase 5) is unchecked.
- Files: `backend/src/jobs/votingCloser.js`, `backend/src/server.js`
- Impact: Past `votingDeadlineAt`, new votes are rejected (`canVote`/`changeMyVote` deadline checks in `backend/src/services/votingService.js` and `backend/src/controllers/votingController.js`), but the request stays `EM_VOTACAO` forever — tally never runs, decision never recorded, funds never provisioned.
- Fix approach: Start `closeExpired()` on an interval from `server.js` (e.g., every 5 min) and cover with an integration test.

**No CI, lint, or typecheck:**

- Issue: No `.github/` directory, no ESLint/Prettier/TS config anywhere; `AGENTS.md` states this is intentional for the MVP ("Sem lint/typecheck/CI configurados; não invente esses comandos"), and `docs/13-backlog.md` Fase 1 "configurar CI" is unchecked.
- Files: `backend/package.json`, `frontend/package.json`
- Impact: Nothing automated prevents the authorization/state-machine bugs below from landing.
- Fix approach: Add minimal CI (backend `npx vitest run` + `frontend npm run build`) before production phase.

**Dead schema fields and dead code:**

- Issue: `DepartmentSettings.maxViewRequests`, `limitValidFrom`, `limitValidTo`, `dailyAllowanceInfo`, `currency` are never read by any backend code; `RequestFile` model and `backend/uploads/` directory have no upload endpoint (grep: no `RequestFile` usage in `backend/src/`); `backend/src/models/` is an empty directory; `dashReq` variable in `reports.routes.js` `dashboard-pdf` is computed and unused.
- Files: `backend/prisma/schema.prisma`, `backend/src/routes/reports.routes.js`, `backend/src/models/`, `backend/uploads/`
- Impact: Misleads readers into believing features (attachments, configurable vista limits, limit history) exist. Backlog confirms "upload seguro" (Fase 4) is unchecked.
- Fix approach: Either implement or remove; keep schema in sync with reality.

**JSON stored as strings:**

- Issue: `ResourceRequest.payload`, `ResourceRequest.approvedItems`, `DeliberationMessage.history`, `FinancialTransaction.metadata`, `AuditEvent.beforeData/afterData` are `String` columns with manual `JSON.stringify`/`JSON.parse` scattered across controllers (e.g., `backend/src/controllers/deliberationController.js` parses history inline with try/catch).
- Files: `backend/prisma/schema.prisma`, all controllers in `backend/src/controllers/`
- Impact: Not queryable at DB level; parse errors are silent (`catch → false`); drift risk between writers/readers.
- Fix approach: Use Prisma `Json` columns on Postgres (migration is already Postgres-only since v0.1.1).

**Enums modeled as unvalidated Strings:**

- Issue: Schema comment says "Enums como String + validação em código/Zod", but several write paths skip validation: `userController.patch` writes `status: req.body.status` and `name` unchecked; `userController.patchRole` writes `req.body.role` without checking it against `ROLES` (defined only in `backend/src/utils/batchUsers.js`); `settingsController.patchFinancial`/`patchBalance` accept `Number(...)` that can be `NaN` (e.g., `currentExchangeRate: "abc"` → stored NaN/500 on read).
- Files: `backend/src/controllers/userController.js`, `backend/src/controllers/settingsController.js`, `backend/prisma/schema.prisma`
- Impact: Invalid role/status values become permanent rows; authz checks fail unpredictably (usually fail-closed, but `canManageUsers` semantics break on unknown roles).
- Fix approach: Validate every write with the existing `zod` dependency via the unused-in-routes `validate` middleware (`backend/src/middlewares/validate.js`).

**Duplicated/legacy route mounting:**

- Issue: `backend/src/app.js:25` mounts `settings.routes` on `/api/finance` as well as `/api/settings`, while actual finance actions (`mark-spent`, `reverse-provision`) live under `/api/requests/:id/*` via `financeController`. Two prefixes serve the same settings router.
- Files: `backend/src/app.js`, `backend/src/routes/settings.routes.js`
- Impact: API surface confusion; `openapi.yaml`/`docs/08-api.md` can easily drift from one of the two prefixes.
- Fix approach: Decide on one prefix; remove the alias or introduce a real `finance.routes.js`.

**Stale local artifacts:**

- Issue: `backend/prisma/dev.db` (leftover SQLite from pre-Postgres migration; schema header says "SQLite → Postgres concluído (v0.1.1)") still sits next to the live schema. `backend/.env` and `.env.example` exist (contents not reviewed here — treat as secret-bearing). `frontend/dist/` build output present locally.
- Files: `backend/prisma/dev.db`, `backend/.env`, `frontend/dist/`
- Impact: Encourages running against the wrong database; `dev.db` is gitignored but confusing on disk.
- Fix approach: Delete `dev.db` (gitignored, safe); keep relying on `.gitignore` rules for `.env`/`dist`.

## Known Bugs

**Anyone can cancel any request (missing authorization):**

- Symptom: `POST /api/requests/:id/cancel` performs no ownership or role check — any authenticated user (including `ALUNO`) can cancel any other user's request. Compare `submit` in the same file, which correctly checks `requesterId`/role.
- Files: `backend/src/controllers/requestController.js` (`cancel`), `backend/src/routes/requests.routes.js`
- Trigger: Authenticated `ALUNO` sends `POST /api/requests/<others-id>/cancel`.
- Workaround: None; fix by mirroring the `submit` guard (requester or `ADMINISTRADOR`/`CHEFE_DEPARTAMENTO`, and per `docs/14-decisoes-em-aberto.md` cancellation after approval should require admin/chefe + justification).

**Anyone can delete any discussion message:**

- Symptom: `DELETE /api/messages/:mid` (`remove`) checks only suspension, not author or role — any authenticated user can soft-delete anyone's message. `patch` correctly restricts to the author.
- Files: `backend/src/controllers/deliberationController.js` (`remove`), `backend/src/routes/messages.routes.js`
- Trigger: Authenticated `ALUNO` (or anyone) deletes arbitrary `DeliberationMessage` rows.
- Workaround: None; fix by requiring author or `ADMINISTRADOR`/`CHEFE_DEPARTAMENTO`.

**Request detail readable by anyone; list scope wider than documented:**

- Symptom: `GET /api/requests/:id` (`getOne`) has no ownership/role check and includes `files` + `transactions`. `list` gives every non-`ALUNO` an unfiltered view of ALL requests, contradicting its own comment and `docs/06-permissoes.md` ("próprios + em votação"; professors see "Próprios" for reports).
- Files: `backend/src/controllers/requestController.js` (`getOne`, `list`)
- Trigger: Any authenticated user opens another user's request; any `PROFESSOR` lists all requests.
- Workaround: Frontend only shows scoped views; API is directly exploitable.
- Fix approach: Apply the documented scope filter server-side (`scopeFilter` in `reports.routes.js` is a good in-repo model).

**Tie-break dead-end (AGUARDANDO_DESEMPATE can get stuck):**

- Symptom: When a vote ties, status becomes `AGUARDANDO_DESEMPATE`. If the `CHEFE` already voted during the normal phase (allowed — `ELIGIBLE` includes `CHEFE_DEPARTAMENTO`), the tie-break path fails: `castVote` hits `@@unique([requestId, voterId])` → 409 ("use PUT /votes/me"), and `changeMyVote` rejects because status ≠ `EM_VOTACAO` → 400. `closeManual` re-tallies to `EMPATE` again.
- Files: `backend/src/controllers/votingController.js` (`castVote`, `changeMyVote`), `backend/src/services/votingService.js` (`canVote`, `closeVoting`)
- Trigger: Chefe votes in a request that later ties.
- Workaround: None in UI or API; request stays `AGUARDANDO_DESEMPATE`.
- Fix approach: Allow `changeMyVote` (or a dedicated tiebreak endpoint) in `AGUARDANDO_DESEMPATE` for the chefe, or exclude the chefe's regular vote from tiebreak eligibility explicitly.

**Frontend never refreshes the session:**

- Symptom: Access token lives 15 min (`backend/src/utils/tokens.js`), refresh cookie 7 days, `/api/auth/refresh` exists — but `frontend/src/services/api.js` is a bare axios instance with no response interceptor, and nothing in `frontend/src` calls `refresh` (verified by grep). After 15 minutes `me()` 401s and the router bounces the user to `/login`.
- Files: `frontend/src/services/api.js`, `frontend/src/router/index.js`, `backend/src/controllers/authController.js`
- Trigger: Stay logged in > 15 min.
- Fix approach: Add a 401 response interceptor that calls `POST /auth/refresh` once and retries.

**`mustChangePassword` is not enforced:**

- Symptom: The router guard for forced password change is an empty comment (`// força troca: mantém no dashboard com banner (MVP)`); backend `authJwt` only checks `status === 'ATIVO'`.
- Files: `frontend/src/router/index.js` (line ~31), `backend/src/middlewares/auth.js`
- Trigger: User with a temporary/expired password uses the app normally.
- Fix approach: Block API access (403 until `changePassword`) and redirect in the router.

**`smtpConfigured: true` is hardcoded:**

- Symptom: Settings API reports email configured even when `SMTP_ENABLED=false`.
- Files: `backend/src/controllers/settingsController.js` (`get`)
- Fix approach: Return `env.smtpEnabled && Boolean(env.smtp.host)`.

**Annual limit bypass via `CONCLUIDO`:**

- Symptom: `annualTotalCents` sums statuses `SUBMETIDO|EM_VOTACAO|APROVADO|APROVADO_AUTOMATICAMENTE|APROVADO_PARCIALMENTE` but omits `CONCLUIDO` — once a request is marked spent, its amount no longer counts toward the requester's annual auto-approval limit (`docs/03-regras-de-negocio.md` intends the annual total to gate auto-approval).
- Files: `backend/src/services/requestService.js` (`annualTotalCents`)
- Trigger: Cycle requests through `mark-spent`, then submit new ones under the limit again.
- Fix approach: Include `CONCLUIDO` (and confirm intended RN against `docs/03`) with a unit test.

**PARCIAL approval takes the first partial vote's amount:**

- Symptom: `closeVoting` picks `validVotes.find(v => v.voteType === 'DEFERIR_PARCIALMENTE')` — the first partial vote's `approvedAmountCents`, regardless of other partial votes' amounts (code comment admits "primeiro").
- Files: `backend/src/services/votingService.js` (`closeVoting`)
- Trigger: Multiple `DEFERIR_PARCIALMEMENTE` votes with different amounts.
- Fix approach: Define the rule (e.g., median/majority amount or chefe-decides) in `docs/03-regras-de-negocio.md` and implement deliberately.

**`force-password-reset` is an alias of `resend-invite`:**

- Symptom: `backend/src/routes/users.routes.js` maps both routes to `resendInvite`; audit action is logged as `invite_resent`, and the handler lacks a `canManageUsers` check — a `CHEFE_DEPARTAMENTO` can reset an `ADMINISTRADOR`'s password (lockout; temp password emailed to the admin).
- Files: `backend/src/routes/users.routes.js`, `backend/src/controllers/userController.js`
- Fix approach: Add `canManageUsers` guard inside `resendInvite`; log distinct audit action for forced reset.

**`GET /api/requests/:id/history` returns `getOne`:**

- Symptom: Route is wired to the same handler as `getOne`; there is no per-request history endpoint (history exists only inside `AuditEvent`, which has no read API).
- Files: `backend/src/routes/requests.routes.js` (line ~17)
- Fix approach: Either serve audit trail for the request or remove the route.

**Report exports partially unaudited:**

- Symptom: In `reports.routes.js`, only the PDF branches call `audit('report_exported')`; CSV and JSON exports of requests/financial data are not audited, though `docs/11-seguranca-e-auditoria.md` treats exports as auditable events.
- Files: `backend/src/routes/reports.routes.js`
- Fix approach: Audit before streaming any format.

## Security Considerations

**Missing authorization on state-changing endpoints:**

- Risk: Account-takeover-adjacent actions reachable by wrong roles — request `cancel` and message `remove` have zero ownership checks (see Known Bugs); `GET /api/settings/transactions` exposes the last 100 financial transactions to any authenticated user while the equivalent `/api/reports/financial` correctly requires `ADMINISTRADOR`/`CHEFE_DEPARTAMENTO`; `GET /api/requests/:id/votes` and `GET /api/reports/voting` expose all votes (incl. `ALUNO`) contrary to `docs/06-permissoes.md` ("Pedidos em votação: Não" for `ALUNO`).
- Files: `backend/src/controllers/requestController.js`, `backend/src/controllers/deliberationController.js`, `backend/src/controllers/votingController.js` (`listVotes`), `backend/src/routes/settings.routes.js`, `backend/src/routes/reports.routes.js`
- Current mitigation: All routes sit behind `authJwt`; role checks exist on financial mutations and suspend/unsuspend.
- Recommendations: Add a centralized `requirePermission(action)` layer — `docs/06-permissoes.md` itself demands "autorizações explícitas, não apenas verificações espalhadas pelo código". Fix `cancel`, `remove`, `getOne`, `list`, `listVotes`, settings `transactions`, reports `voting` first.

**Insecure fallback secrets in env config:**

- Risk: `backend/src/config/env.js` falls back to `dev-access-secret-change-me-0123456789` / `dev-refresh-secret-change-me-0123456789` and a default `postgresql://sgrd:sgrd@...` URL when env vars are missing — any deploy started outside `compose.yaml` (which enforces `${VAR:?}`) silently signs forgeable JWTs. Also hardcodes a personal default admin email.
- Files: `backend/src/config/env.js`, `compose.yaml`
- Current mitigation: `compose.yaml` fails fast on missing `JWT_*`/`INITIAL_ADMIN_*`; `backend/.env` exists for local dev (existence noted; contents not read).
- Recommendations: Fail fast in `env.js` when `NODE_ENV=production` and secrets are absent; never default secrets to known strings.

**No session revocation / refresh rotation:**

- Risk: JWTs are stateless — `logout`, `changePassword`, and `forgotPassword` do not invalidate already-issued tokens; refresh tokens are never rotated (7-day lifetime), so a stolen refresh cookie works even after a password reset.
- Files: `backend/src/utils/tokens.js`, `backend/src/controllers/authController.js`
- Current mitigation: httpOnly + `sameSite: 'lax'` cookies, 15-min access TTL, argon2id hashing.
- Recommendations: Add a `tokenVersion`/`passwordChangedAt` claim checked in `verifyRefresh`, and rotate refresh tokens.

**Rate-limiting gaps and proxy blindness:**

- Risk: Only `POST /api/auth/login` is rate-limited (20/15min) — `/forgot-password` is unlimited (mass password resets + queue/audit-row flooding), as are `/refresh` and `/change-password`. `app.js` never sets `trust proxy`, so behind a reverse proxy every client shares one bucket (global login lockout) — and naive `trust proxy: true` later would allow spoofed IPs.
- Files: `backend/src/routes/auth.routes.js`, `backend/src/app.js`
- Current mitigation: Per-account lockout after 5 failed logins (15 min) in `authController.login`, matching `docs/11`.
- Recommendations: Rate-limit all auth mutation routes; configure `trust proxy` explicitly for the deployment topology.

**Temporary passwords delivered in email body:**

- Risk: Invitation/reset flows email the plaintext temporary password; the body is also persisted forever in `EmailQueue` rows (readable by anyone with DB access) and logged by `pino` on the `SMTP_DISABLED` path (logger redacts `password`/`token` keys but the message text contains it).
- Files: `backend/src/services/emailService.js`, `backend/src/controllers/userController.js`, `backend/src/config/logger.js`
- Current mitigation: Passwords stored as argon2id hashes (`backend/src/utils/password.js`); temp password expires in 24h; `mustChangePassword` flag.
- Recommendations: One-time reset token instead of emailed password; purge `EmailQueue.body` after send.

**CSV injection in exports:**

- Risk: `toCSV` only escapes double quotes; a request title beginning `=`, `+`, `-`, `@` executes as a formula when the admin opens the export in a spreadsheet.
- Files: `backend/src/routes/reports.routes.js` (`toCSV`)
- Current mitigation: Titles come from authenticated users only.
- Recommendations: Prefix cells with `'` or strip leading formula characters.

**Weak password policy / user enumeration:**

- Risk: `changePassword` only requires length ≥ 8 (no complexity); `create` sets no policy on the temp password beyond generated charset. Login responses distinguish 401 (no user) / 403 (inactive) / 423 (locked), confirming account existence to an attacker.
- Files: `backend/src/controllers/authController.js`
- Current mitigation: Institutional `@utfpr.edu.br`-only accounts; login rate limiter; lockout.
- Recommendations: Uniform 401 for login failures; align policy with `docs/11`.

**Error handler leaks internals:**

- Risk: `errorHandler` always returns `err.message` (Prisma errors can include query/model detail) and returns `err.stack` whenever `NODE_ENV !== 'production'` — a mis-set NODE_ENV exposes stacks.
- Files: `backend/src/middlewares/validate.js`
- Current mitigation: Generic 500 fallback message.
- Recommendations: Map known `status` errors to safe messages; whitelist the stack flag.

**No CSRF token (accepted residual risk):**

- Risk: Cookie-only auth without CSRF tokens; state-changing POSTs rely solely on `sameSite: 'lax'`.
- Files: `backend/src/utils/tokens.js` (`cookieOpts`), `backend/src/app.js`
- Current mitigation: httpOnly + `sameSite: 'lax'` (blocks cross-site POSTs), CORS restricted to `FRONTEND_URL` with `credentials: true`, helmet defaults.
- Recommendations: Verify `docs/11-seguranca-e-auditoria.md` accepts this; add `Origin` checking on mutations if the app ever spans subdomains.

**Deployment note — Secure cookies need HTTPS:**

- Risk: `cookieOpts.secure` is true only when `NODE_ENV=production` (set in `Dockerfile`), but `compose.yaml` publishes plain HTTP (`APP_PORT` → 3000) with no TLS. Browsers reject `Secure` cookies over HTTP on non-localhost hosts → login silently fails for LAN/production deployments.
- Files: `backend/src/utils/tokens.js`, `compose.yaml`, `Dockerfile`
- Recommendations: Terminate TLS in front (reverse proxy) or make `secure` follow a `COOKIE_SECURE` env var; document that `FRONTEND_URL` must be `https://…` in production.

## Performance Bottlenecks

**Fund-balance TOCTOU race (overspend):**

- Problem: `requestController.submit` reads `getBalance`/`annualTotalCents` OUTSIDE the `$transaction`, then unconditionally `decrement`s; `votingService.closeVoting` and `votingController.collegiateDecision` read-then-write inside a `READ COMMITTED` transaction with no row lock and no conditional update. The `FundBalance.version` column is incremented but never used as an optimistic precondition anywhere.
- Files: `backend/src/controllers/requestController.js` (`submit`), `backend/src/services/votingService.js` (`closeVoting`), `backend/src/controllers/votingController.js` (`collegiateDecision`), `backend/src/controllers/financeController.js`
- Cause: Concurrent submissions/vote-closes can each pass the `availableCents >= amount` check and both decrement → negative balances, double provisioning; same for the per-requester annual cap.
- Improvement path: `UPDATE … SET availableCents = availableCents - $x WHERE id = $y AND availableCents >= $x` (fail on 0 rows), or `SELECT … FOR UPDATE`, or check `version` optimistically inside the transaction; move the balance/annual reads inside the transaction.

**Silent result truncation:**

- Problem: Hard `take:` caps — request list 100 (`requestController.list`), reports 500, dashboard 2000, PDF detail 200/300 rows, auto-close 50/run — with no pagination or "truncated" signal.
- Files: `backend/src/controllers/requestController.js`, `backend/src/routes/reports.routes.js`, `backend/src/jobs/votingCloser.js`
- Cause: Fixed caps chosen for MVP.
- Improvement path: Cursor/offset pagination in API + infinite scroll/paging in `frontend/src/views/Requests.vue`; document caps until then.

**Unbounded audit/event growth:**

- Problem: Every action writes an `AuditEvent` with full `beforeData`/`afterData` JSON (e.g., `settings_changed` stores the whole settings row; `request_created` the whole request) — no retention job; `EmailQueue` never drained (see Tech Debt) grows forever.
- Files: `backend/src/services/auditService.js`, `backend/src/services/emailService.js`
- Cause: No retention policy yet (attachment/audit retention listed as open in `docs/14-decisoes-em-aberto.md`).
- Improvement path: Prune/archive job + size limits on stored snapshots.

**Per-request DB lookup in auth middleware:**

- Problem: `authJwt` runs `prisma.user.findUnique` on every API request; acceptable at MVP scale, but couples every request to DB latency.
- Files: `backend/src/middlewares/auth.js`
- Improvement path: Short-TTL in-memory user cache if request volume grows; keep revocation semantics in mind.

## Fragile Areas

**Voting/deliberation state machine:**

- Files: `backend/src/controllers/votingController.js`, `backend/src/services/votingService.js`
- Why fragile: Six interlinked statuses (`RASCUNHO`, `EM_VOTACAO`, `AGUARDANDO_DESEMPATE`, `SUSPENSO_REUNIAO_ORDINARIA`, approval variants, `CONCLUIDO`) with transitions spread across `castVote`, `closeVoting`, `suspend`/`unsuspend`, `collegiateDecision`, and the (unscheduled) cron job; tie-break dead-end already present; business rules live only partially in `docs/03-regras-de-negocio.md`.
- Safe modification: Read `docs/07-fluxos.md` + `docs/03-regras-de-negocio.md` first; extend `backend/tests/voting.test.js` with `closeVoting` tests before touching; never add a transition without checking every `status ===` guard (grep the status string).
- Test coverage: Only `tally()` unit tests (5 cases in `backend/tests/voting.test.js`); no tests for close/balance/suspend paths.

**Financial balance invariants:**

- Files: `backend/src/controllers/requestController.js`, `backend/src/controllers/financeController.js`, `backend/src/services/votingService.js`, `backend/src/controllers/votingController.js`, `backend/src/controllers/settingsController.js`
- Why fragile: The `available → provisionado → gasto` state machine is implemented independently in 5 files with copy-pasted transaction blocks; race-prone (see Performance); an inconsistent edit in one place silently desynchronizes `FundBalance` from `FinancialTransaction` rows.
- Safe modification: Consider extracting a `balanceService` with `provision/spend/reverse` before the next finance feature; add a reconciliation check (sum of transactions vs balance) as a test.
- Test coverage: None for balance mutations.

**Scattered authorization checks:**

- Files: `backend/src/middlewares/auth.js` (`requireRole`, `canManageUsers`), inline `['ADMINISTRADOR', 'CHEFE_DEPARTAMENTO'].includes(...)` repeated in ≥6 controllers, hard-coded role arrays in `deliberationController.post` and `votingService.ELIGIBLE`
- Why fragile: New routes default to "auth only" — that's how `cancel`/`remove` shipped unprotected; `docs/06-permissoes.md` explicitly warns against this shape.
- Safe modification: New endpoints must declare roles at the route level (`backend/src/routes/*.routes.js`); prefer one shared permission map over inline arrays.
- Test coverage: No HTTP-level tests exist to catch regressions (supertest is a devDependency but is never imported).

**Frontend error/refresh handling:**

- Files: `frontend/src/services/api.js`, `frontend/src/views/*.vue`
- Why fragile: No global interceptor — every view hand-rolls `e.response?.data?.error || 'Falha'` (blank when `error` is undefined), 401s are not distinguished from network errors, and the refresh flow is never invoked.
- Safe modification: Fix session refresh centrally in `api.js` before adding new views; standardize a `useApiError` helper.
- Test coverage: Zero frontend tests (`npm test` intentionally exits 1 in `frontend/package.json`); verification is `npm run build` only, per `AGENTS.md`.

**Open business decisions leaking into code:**

- Files: `docs/14-decisoes-em-aberto.md`, `backend/src/controllers/votingController.js`, `backend/src/services/votingService.js`
- Why fragile: Quorum, "vista máx 1 por solicitação" (doc) vs "máx 1 por conselheiro" (`@@unique([requestId, requestedBy])` — currently N vistas each stacking deadline extensions), cancellation-after-approval rules, and e-mail retry alerts are undecided; code already picked answers implicitly.
- Safe modification: Resolve `docs/14` items before production phase; add tests that encode whichever decision wins.

## Scaling Limits

**Query/list caps:**

- Current capacity: 100 requests/list (`requestController.list`), 500 rows/report, 2000 rows/dashboard, 200–300 PDF lines, 50 auto-closes per run, 200 users/batch import (`backend/src/utils/batchUsers.js`), 2 MB JSON body (`app.js`), 1 MB batch upload (`userBatchController.js`).
- Limit: Silent wrong totals/dashboards once a department exceeds these counts in a year.
- Scaling path: Pagination first (API + UI); aggregation in SQL for `/reports/dashboard` (currently loads up to 2000 full rows into Node).

**Single-process assumptions:**

- Current capacity: One `node src/server.js` process; `express-rate-limit` uses the default in-memory store; email/voting jobs are not scheduled at all.
- Limit: Running >1 replica breaks rate-limit accounting and (once wired) would double-run jobs.
- Scaling path: External rate-limit store and a single-scheduler job model before horizontal scaling.

**Unserved feature surface:**

- Current capacity: `backend/uploads/` exists but no code writes to it; `RequestFile` table unused.
- Limit: When attachments land, storage location/volume is undefined (retention open in `docs/14`).
- Scaling path: Object storage decision before implementing "upload seguro".

## Dependencies at Risk

**nodemailer `^6.9.14` (backend):**

- Risk: `npm audit` reports HIGH severity — multiple advisories affecting all versions ≤ 9.1.0 (SMTP command injection, header/CRLF injection, TLS validation issues, addressparser DoS).
- Impact: Relevant only when `SMTP_ENABLED=true` (currently default-off in `compose.yaml`).
- Migration plan: Upgrade to nodemailer ≥ 10 (`npm audit fix --force`, breaking major); the send surface used is only `sendMail({from,to,subject,text})`, so migration should be small — do it before enabling SMTP.

**uuid `^10.0.0` (backend):**

- Risk: `npm audit` moderate advisory for < 11.1.1 (buffer bounds check in v3/v5/v6). The package is **never imported** anywhere in `backend/src` — dead dependency.
- Impact: Audit noise only.
- Migration plan: Remove it (Prisma generates UUIDs; `crypto.randomBytes` used elsewhere).

**supertest `^7.0.0` (backend devDependency):**

- Risk: Declared but never imported — signals intended-but-unwritten HTTP tests.
- Impact: False sense that integration tests exist.
- Migration plan: Use it for authorization tests (cancel/remove/getOne) or drop it.

**multer `1.4.5-lts.1` (backend):**

- Risk: Old 1.x line (current is 2.x); currently used only for the admin batch-JSON upload with `memoryStorage` + 1 MB limit.
- Impact: Low today (no general file-upload endpoint); becomes important with "upload seguro".
- Migration plan: Move to multer 2.x when attachments are implemented.

**Frontend dependencies:**

- Risk: `npm audit` reports **0 vulnerabilities** (axios, chart.js, pinia, vue, vue-router, vite plugin).
- Impact: None detected on 2026-09-22.

## Missing Critical Features

**Audit trail read access:**

- Problem: `docs/06-permissoes.md` grants "Ver auditoria" to admin (and limited to chefe), but no endpoint or UI reads `AuditEvent` — audit rows are write-only (grep confirms no `auditEvent.find*` in `backend/src/`).
- Blocks: Compliance/oversight requirement (RF audit) and the chefe's limited audit view.

**Secure file upload / attachments:**

- Problem: `RequestFile` model exists but no upload endpoint; "upload seguro" (backlog Fase 4) unchecked.
- Blocks: Request supporting documents (equipment specs, travel quotes) — flows that mention files in `getOne` (`include: { files: true }`) always return an empty array.

**Email actually being sent + admin alerting:**

- Problem: Queue processor never runs (Tech Debt §1); give-up path logs "alert admin" but does not notify anyone; `docs/14` promises "três tentativas e alerta ao administrador".
- Blocks: All invite/reset/notification flows in production.

**Automatic voting closure:**

- Problem: Job exists but never scheduled (Tech Debt §2); backlog item unchecked.
- Blocks: Timely decisions and provisioning — deadlines currently only block votes, they don't conclude them.

**Forced password change enforcement:**

- Problem: Neither frontend nor backend enforces `mustChangePassword` (Known Bugs).
- Blocks: The documented "troca obrigatória de senha" guarantee (Fase 1 backlog item).

**RPA/finance integration:**

- Problem: `GET /api/reports/integration/provisioned` is an explicit Fase 7 stub; `PATCH /api/settings/email` and `/email/test` are stubs (`{ ok: true }`) despite docs granting email config to admin.
- Blocks: External financial-system reconciliation and SMTP self-test.

**CI:**

- Problem: No pipeline of any kind (backlog "configurar CI" unchecked).
- Blocks: Automated regression gate for the authorization fixes above.

## Test Coverage Gaps

**Request/message authorization paths:**

- What's not tested: `cancel`, `getOne`, `list` scoping, message `remove`, settings `transactions` role checks — exactly where the live holes are.
- Files: `backend/src/controllers/requestController.js`, `backend/src/controllers/deliberationController.js`, `backend/src/routes/settings.routes.js`, `backend/tests/` (no HTTP tests exist)
- Risk: The same class of bug (missing ownership check) can recur in any new route unnoticed.
- Priority: **High** — add supertest-based tests asserting 403/404 for cross-user access.

**Financial state transitions:**

- What's not tested: `submit` auto-approval + provisioning, `markSpent`, `reverseProvision`, `closeVoting` balance effects, `collegiateDecision`, balance race conditions, `patchBalance`.
- Files: `backend/src/controllers/financeController.js`, `backend/src/services/votingService.js`, `backend/src/services/requestService.js` (only `calcAmount` is unit-tested)
- Risk: Money bugs ship silently; `FundBalance`/`FinancialTransaction` divergence undetected.
- Priority: **High** — at minimum a DB-backed integration suite for provision/spend/reverse invariants.

**Voting flow beyond `tally`:**

- What's not tested: `canVote` eligibility matrix, tie-break path, vista extension stacking, suspend/unsuspend deadline math, deadline enforcement.
- Files: `backend/src/services/votingService.js`, `backend/src/controllers/votingController.js`
- Risk: The tie-break dead-end bug proves the gap; rules from `docs/07-fluxos.md` aren't executable specs.
- Priority: **High**.

**Auth/session lifecycle:**

- What's not tested: login lockout, refresh issuance, cookie flags, `forgotPassword`, `changePassword` expiry rules, rate limiter.
- Files: `backend/src/controllers/authController.js`, `backend/src/utils/tokens.js`
- Risk: Security regressions (cookie flags, lockout) go unnoticed.
- Priority: **Medium**.

**Jobs and queue:**

- What's not tested: `closeExpired` (never even runs — Tech Debt §2), `processQueue` status transitions (`PENDING → SENT/FAILED → GIVE_UP`).
- Files: `backend/src/jobs/votingCloser.js`, `backend/src/services/emailService.js`
- Risk: Dead code paths stay green in CI because nothing executes them.
- Priority: **Medium**.

**Frontend:**

- What's not tested: Everything — router guards (incl. the no-op `mustChangePassword`), auth store, API error paths. Verification limited to `npm run build`.
- Files: `frontend/src/**`, `frontend/package.json` (`test` script exits 1 by design)
- Risk: Guard regressions (role redirect, login bounce) ship silently.
- Priority: **Medium** — at least a smoke/E2E check of login → dashboard → logout.

**Current suite status:** `cd backend && npx vitest run` passes — 3 files, 17 tests (helpers/`calcAmount`, `tally`, batch validation), verified 2026-09-22. Coverage is unit-only; no integration/E2E exists.

---

*Concerns analysis: 2026-09-22*
