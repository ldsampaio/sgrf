# Roadmap: SGRF

## Overview

This milestone takes the feature-complete but buggy SGRF MVP (v0.1.1) to production-ready in eight dependency-ordered phases: a CI regression gate first (the gate that was missing when these bugs shipped), then the open `docs/14` business-rule decisions, then the deploy/environment contract, the deny-by-default authorization layer, silent session refresh, the voting/money state-machine fixes (implementing the decided rules), the two dead background jobs on one scheduler, and a final reports/audit + auth-polish pass. Load-bearing ordering constraints: decisions before rule-dependent code (VOT-03/VOT-04), tie-break fix before auto-close scheduling (VOT-01 → JOB-02), email queue before forced-password enforcement (JOB-01 → SES-02), and trust proxy landing together with rate-limit expansion (SEC-03). All 16 v1 requirements map to exactly one phase.

## Phases

**Phase Numbering:**

- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

- [x] **Phase 1: CI Regression Gate** - Two-job pipeline (backend vitest + frontend build) on every push — the gate for everything that follows (completed 2026-09-23)
- [x] **Phase 2: Rules Decisions (docs/14 close-out)** - Decide and record partial-approval and cancellation rules before any code implements them (completed 2026-09-23)
- [x] **Phase 3: Deploy & Environment Contract** - Production boots only with real secrets; cookie/HTTPS story works off localhost (completed 2026-09-24)
- [x] **Phase 4: Authorization Hardening** - Deny-by-default permission map + ownership fixes on every documented endpoint (completed 2026-09-24)
- [x] **Phase 5: Session Refresh** - Silent single-flight token refresh; users stay logged in past 15 minutes (completed 2026-09-24)
- [ ] **Phase 6: Voting & Money State Machine** - Tie-breaks resolve, annual cap holds, decided rules implemented deliberately
- [ ] **Phase 7: Background Jobs** - Email queue drains with admin give-up alert; voting auto-close runs on a scheduler
- [ ] **Phase 8: Reports/Audit & Auth Polish** - Export auditing, CSV-injection neutralization, auth rate limits, forced-password enforcement

## Phase Details

### Phase 1: CI Regression Gate

**Goal**: A required two-job CI check (backend `npx vitest run` + frontend `npm run build`) runs on every push and PR, so no later fix ships unverified.
**Mode:** mvp
**Depends on**: Nothing (first phase)
**Requirements**: CI-01
**Success Criteria** (what must be TRUE):

  1. Every push and pull request triggers a check with two jobs — backend tests and frontend build — on Node 22 with per-package working directories
  2. The check passes on a clean checkout of the current codebase (existing 17 tests + build green; no database service, no invented lint/typecheck commands)
  3. A deliberately broken test turns the check red — proven the gate actually catches regressions

**Plans**: 3/3 plans executed

Plans:
**Wave 1**

- [x] 01-01-ci-workflow-PLAN.md — Add `.github/workflows/ci.yml` (two jobs, Node 22, per-package `working-directory`, `cache-dependency-path`, `npx prisma generate` before vitest, dummy `DATABASE_URL`, `checkout@v7`/`setup-node@v7`), push, confirm green

**Wave 2** *(blocked on Wave 1 completion)*

- [x] 01-02-red-proof-PLAN.md — Prove the gate: commit a deliberate test break (unit.test.js line 8 → 'WRONG'), confirm red via `gh run list`, `git revert HEAD` + push, confirm green

**Wave 3** *(blocked on Wave 2 completion)*

- [x] 01-03-required-checks-PLAN.md — Mark checks required on main (`backend`+`frontend`, strict:false, enforce_admins:true, verified by readback) + record CI as the regression gate in `AGENTS.md`

**Cross-cutting constraints:**

- Login.vue mounts with empty email/password refs ('') and placeholders voce@utfpr.edu.br / placeholder mask showing the expected format
- While auth is in flight the submit button is :disabled and its label reads Entrando… (loading ? 'Entrando…' : 'Entrar'); finally resets loading=false
- Failed auth renders div.alert.error[role=alert] (v-if=err) with the server message (e.response?.data?.error) or fallback 'Falha no login'
- No client-side required/validation blocks submission — incomplete or invalid credentials surface only after the server round-trip via the error alert
- The error alert renders the server message verbatim as block text inside the 440px card (max-width:440px); no truncation directive exists in Login.vue
- Requests form mounts with defaults type EQUIPAMENTO, empty title, empty justification, valueCents 0 (MoneyInput displays the BRL mask at 0)
- While creating, the submit button is :disabled and reads Salvando… (loading ? 'Salvando…' : 'Criar rascunho')
- Create failure renders div.alert.error[role=alert] (v-if=err) with server error or fallback 'Falha'
- Only Titulo carries required; Justificativa/Especificacao accept empty (spec falls back to 'n/a' in the payload) — a partially filled draft is a valid submit state
- Each v-for row renders r.title, StatusBadge with status, formatBRL(r.requestedAmountCents), and a Submeter button gated v-if r.status RASCUNHO
- Title cell renders r.title verbatim — no truncation, ellipsis, or title attribute is set at the call site in Requests.vue
- At zero items the table renders its thead over an empty tbody — no empty-state message exists in the template; list starts empty and rows appear linearly (no pagination)
- Titulo is a single-line input (long text stays on one line, scrolling inside the input); Justificativa is a textarea rows=2 that wraps
- DateInput mounts showing modelValue (default empty) with placeholder dd/mm/aaaa; MoneyInput mounts showing formatCentsInput(0)
- No async state exists in Date/Money inputs — mask formatting is synchronous in the input handler, so no loading/skeleton state can occur inside these controls
- DateInput has no validation UI; MoneyInput renders an optional hint div (v-if=hint) — validation messaging is parent-controlled, none is intrinsic
- Progressive masks: MoneyInput accepts digits only, slice(0, 12), reformatting centavos on each keystroke; DateInput applies maskDateDigits incrementally
- Input values are length-bounded by the masks (12 digits / date mask); label and hint are block elements that wrap
- Reports: no in-flight indicator exists — load() awaits the API without a loading ref, buttons stay enabled during the request, no spinner/skeleton declared
- Reports load() catches nothing — a failed api.get leaves the previous pre output (or none) and surfaces no error message; Reports.vue has no err alert
- Reports output renders in pre with inline overflow:auto — long JSON scrolls horizontally within the card
- Reports output is hard-truncated at 3000 characters: JSON.stringify(data, null, 1).slice(0, 3000)
- docs/DESIGN.md contains no raw HTML or fenced width constraints — markdown tables (max 6 columns) and prose wrap or scroll per the consuming renderer; horizontal overflow cannot originate from the file itself
- docs/DESIGN.md prose is single long markdown lines (renderer wraps); longest atomic tokens are hex/gradient literals that must stay unbroken on a line
- StatusBadge renders status verbatim in span.badge with no truncation/nowrap declared — the full status word (longest known: SUSPENSO_REUNIAO_ORDINARIA) always displays
- StatusBadge fixed vocabulary maps to classes (APROVADO/CONCLUIDO to ok, EM_VOTACAO/AGUARDANDO_DESEMPATE to pending, SUSPENSO_REUNIAO_ORDINARIA to dark); any other value falls to .muted — unknown or long values render fully, never hidden
- No .vue file, stylesheet, or src file is created or modified by this plan

### Phase 2: Rules Decisions (docs/14 close-out)

**Goal**: The two open business rules — partial-approval aggregation and cancellation-after-approval — are explicitly decided and recorded in `docs/03` + `docs/14` before any code implements them.
**Mode:** mvp
**Depends on**: Nothing (can run in parallel with Phase 1)
**Requirements**: None directly (decision gate for VOT-03 and VOT-04)
**Success Criteria** (what must be TRUE):

  1. The `docs/14` partial-approval item is closed with the chosen aggregation rule, date, and rationale — and `docs/03` states the rule the code must follow
  2. The `docs/14` cancellation-after-approval item is closed with required roles, mandatory justification, and reversal requirement recorded
  3. Each decision lands as a docs commit before any implementation plan starts — no rule gets re-guessed in code
  4. Out-of-milestone `docs/14` items (quorum, vista-limit conflict) are explicitly deferred to v2, not silently dropped

**Plans**: 3/3 plans executed

Plans:
**Wave 1**

- [x] 02-01-PLAN.md — Partial-approval arbitration slice: RN-009 (AGUARDANDO_ARBITRAGEM) + closed docs/14 partial row (D-01..D-04)
- [x] 02-02-PLAN.md — Cancellation slice: RN-010 status×role matrix + REVERSE + closed docs/14 cancellation row (D-05..D-08)

**Wave 2** *(blocked on Wave 1 completion)*

- [x] 02-03-PLAN.md — Quorum + vista slice (RN-011/RN-012/RN-013, OVERRIDDEN/REJECTED markers) + whole-commit verification via PR (D-09..D-13; ROADMAP criterion #4 STALE deviation recorded)

**Cross-cutting constraints:**

- No backend/ or frontend/ file is modified by this plan (per D-12 scope discipline)

### Phase 3: Deploy & Environment Contract

**Goal**: Production boots only with real secrets, and login works on non-localhost deployments — one coherent environment contract across `env.js`, cookies, and compose.
**Mode:** mvp
**Depends on**: Phase 1
**Requirements**: SEC-02, SEC-04
**Success Criteria** (what must be TRUE):

  1. Booting with `NODE_ENV=production` and missing or `dev-*-secret-change-me` `JWT_*`/`INITIAL_ADMIN_*` values fails fast with a clear error — while `./start-dev.sh` local dev keeps working unchanged
  2. An admin can log in from a non-localhost host (e.g. `http://<LAN-IP>` or the documented HTTPS topology) — the `secure` flag follows a `COOKIE_SECURE` env var instead of being forced on in production
  3. The deployment contract (required secrets, `FRONTEND_URL`, cookie/HTTPS expectations) is documented so a fresh deploy can be validated step-by-step

**Plans**: 3/3 planned & plan-checker verified (PASS, 0 blockers)

Plans:

- [x] 03-01-PLAN.md — `env.js` production fail-fast on insecure *values* (not just presence), gated strictly on `NODE_ENV=production`; add CI dummy `JWT_*` env  
- [x] 03-02-PLAN.md — `COOKIE_SECURE` env var + Tunnel topology wiring (`tokens.js`, `clearCookie` attribute match, compose); public-`https`-only verification
- [x] 03-03-PLAN.md — Document the environment contract (`docs/16-contrato-deploy.md` checklist + `.env.example` production notes) and human-verify public-URL login + dev flow intact

**Execution trace:** Phase 3 plans written 2026-09-23. Plan-checker verification: PASS (3/3 plans, 0 blockers). Pending: execute `/gsd-execute-phase 03` to implement.

### Phase 4: Authorization Hardening

**Goal**: Every endpoint enforces the documented permission matrix server-side through one deny-by-default permission map, with row-level ownership checks where the matrix requires them.
**Mode:** mvp
**Depends on**: Phase 3
**Requirements**: SEC-01
**Success Criteria** (what must be TRUE):

  1. The currently unprotected operations — `cancel`, message `remove`, `getOne`/`list` scoping, `listVotes`, settings `transactions`, `force-password-reset`, reports `voting` — deny unauthorized roles/users with 403/404 per `docs/06-permissoes.md`
  2. Every documented ALLOW still works: a conselheiro can open a request under vote, owners see their own requests, admin force-reset works — no legitimate flow broken by the deny-by-default pass
  3. A supertest allow+deny matrix covering the fixed routes × all 5 roles passes and doubles as the authorization regression gate
  4. Undeclared actions fail closed (403) — a new route can no longer default to auth-only

**Plans**: 3 plans

Plans:

- [x] 04-01-PLAN.md — `middlewares/permissions.js` (new) — static `PERMISSIONS` map transcribed from `docs/06` + `requirePermission(action)` wired across requests/messages/settings/reports routes; 403 on undeclared action
- [x] 04-02-PLAN.md — Ownership/scoping fixes in controllers — cancel, message remove, shared visibility helper for `getOne`/`list` (reused by `reports.scopeFilter`), `listVotes`, settings `transactions`, `force-password-reset` guard
- [x] 04-03-PLAN.md — supertest allow+deny matrix (mock-Prisma story, no CI change) + router-stack coverage test proving undeclared fails closed

### Phase 5: Session Refresh

**Goal**: Users stay logged in past 15 minutes — the shared axios instance silently refreshes the session once and retries, without stampedes or import cycles.
**Mode:** mvp
**Depends on**: Phase 4
**Requirements**: SES-01
**Success Criteria** (what must be TRUE):

  1. A user working continuously past the 15-minute access-token TTL never sees the login page — the original request succeeds after one silent `POST /auth/refresh`
  2. N parallel requests hitting 401 at the same moment trigger exactly one refresh (single-flight), not a refresh storm or mass logout
  3. When the refresh cookie is dead, the user is redirected to login exactly once — and the refresh request itself is never retried
  4. `npm run build` passes and `services/api.js` imports no router (no import cycle) and no per-view 401 handling appears

**Plans**: 4/4 plans executed
**UI hint**: yes

Plans:

- [x] 05-01-PLAN.md — Tracer: single-flight 401 interceptor in `frontend/src/services/api.js` (shared promise, `_retry`, bounce `?reason=session-expired&redirect=`) + Login notice/redirect + Requests draft restore; build green
- [x] 05-02-PLAN.md — Manual verification protocol (DoD): TTL ~10s one-refresh/expiry, N-parallel 401s → one refresh, dead-cookie bounce-once + notice + return-to-origin (local-only rig, reverted)
- [x] 05-03-PLAN.md — Structural regression pass: interceptor only on shared instance, no router import in service, 401-only + 403 passthrough, recorded greps + build green
- [x] 05-04-PLAN.md — Gap closure (WR-01/WR-02/WR-03): widen api.js bypass to /auth/(login|refresh|register) or _skipRefresh, doBounce same-page guard → /, Requests.vue type allowlist; build + structural greps green

**Execution trace:** Phase 5 plans written 2026-09-24. Plan-checker verification: PASS (3/3 plans, 0 blockers). Pending: execute `/gsd-execute-phase 05` to implement.

### Phase 6: Voting & Money State Machine

**Goal**: Every voting decision reaches a terminal status and the annual cap cannot be bypassed — with the Phase 2 decided rules implemented deliberately and tested.
**Mode:** mvp
**Depends on**: Phase 1, Phase 2, Phase 4
**Requirements**: VOT-01, VOT-02, VOT-03, VOT-04
**Success Criteria** (what must be TRUE):

  1. A tied vote always resolves to a terminal status — including when the chefe already voted in the normal phase — so no request is stuck in `AGUARDANDO_DESEMPATE`
  2. `CONCLUIDO` requests count toward `annualTotalCents`: cycling a request through spend → re-approve cannot slip under the auto-approval cap (unit test proves it per `docs/03`)
  3. Partial approvals follow the Phase 2 aggregation rule — "first partial vote wins" is gone — with tests encoding the rule
  4. Cancelling an approved request requires ADMINISTRADOR/CHEFE_DEPARTAMENTO + justification and writes an audited compensating reversal; ordinary cancellation enforces ownership from the Phase 4 permission map
  5. The state-machine test count grows — fixes are covered by characterization-then-flip tests, not verified by eyeballing

**Plans**: 5 plans

Plans:

- [ ] 06-01: Tie-break convergence — grep every `status ===` guard across `backend/src`, decide mechanism (chefe `changeMyVote` allowed in tiebreak status vs chefe's regular vote excluded from tie-break eligibility), fix + tests
- [ ] 06-02: Annual-limit accounting — `CONCLUIDO` counts toward `annualTotalCents` + unit test against `docs/03`
- [ ] 06-03: Implement the Phase 2 partial-approval rule in `closeVoting`, replacing "first partial vote wins" + tests encoding the rule
- [ ] 06-04: Cancellation-after-approval — role check + mandatory justification + audited `FinancialTransaction` reversal; wire ordinary cancel to the Phase 4 ownership guard
- [ ] 06-05: Money-path serialization at the 5 balance-write sites — conditional `updateMany({ availableCents: { gte } })` inside `$transaction`, `tx.*` only, annual read inside tx, `patchBalance`'s two ops wrapped in one transaction + concurrency test *(pending TOCTOU scope confirm — see STATE.md blockers)*

### Phase 7: Background Jobs

**Goal**: Both dead jobs run — the email queue drains with a give-up admin alert, and expired votings auto-close on a scheduler that cannot wedge, overlap, or leak timers into tests.
**Mode:** mvp
**Depends on**: Phase 6
**Requirements**: JOB-01, JOB-02, JOB-03
**Success Criteria** (what must be TRUE):

  1. With SMTP enabled, invites/resets/notifications actually send — the queue drains on an interval started from `server.js`, and after 3 failed attempts the admin gets an alert per `docs/14` (not just a log line)
  2. An expired `EM_VOTACAO` request concludes automatically (tally → provision → notify) with no manual action — and tied requests from Phase 6 cannot wedge the job
  3. `smtpConfigured` reports reality (`env.smtpEnabled && host`), so the UI never claims email is configured when it isn't
  4. Jobs are re-entrancy-guarded, idempotent per run, and cleared on SIGTERM — no double-runs, no timers leaking into backend tests

**Decision**: Scheduler tech conflict resolved in favor of plain `setInterval` (`ARCHITECTURE.md`) over node-cron 4 (`STACK.md`) — two fixed-period jobs (60s / 5min), no calendar or timezone needs, zero new dependencies; the re-entrancy guard + SIGTERM cleanup covers the overlap concern node-cron's `noOverlap` would have addressed.
**Plans**: 4 plans

Plans:

- [ ] 07-01: Fix `votingCloser.js` broken requires (`./` → `../`) first; create `jobs/scheduler.js` with plain `setInterval` loops, re-entrancy guard, `clearInterval` on SIGTERM — wired from `server.js` only (never `app.js`)
- [ ] 07-02: Schedule `closeExpired()` every 5 min — DB-as-arbiter claim, idempotent per run, expired `EM_VOTACAO` concludes through the existing `closeVoting` (never reimplemented)
- [ ] 07-03: Schedule `processQueue()` every 60 s — claim-before-send, give-up path alerts the admin per `docs/14`; nodemailer 10 upgrade in its own commit + stub-`sendMail` queue-state test
- [ ] 07-04: `smtpConfigured` honesty (`env.smtpEnabled && Boolean(env.smtp.host)`) + `transporter.verify()` before anyone flips `SMTP_ENABLED=true`

### Phase 8: Reports/Audit & Auth Polish

**Goal**: Exports are auditable and injection-safe, auth routes are rate-limited behind a correctly configured proxy, and the forced-password-change guarantee is actually enforced.
**Mode:** mvp
**Depends on**: Phase 3, Phase 4, Phase 7
**Requirements**: REP-01, REP-02, SEC-03, SES-02
**Success Criteria** (what must be TRUE):

  1. CSV and JSON exports — like PDF today — write a `report_exported` audit event before any bytes stream to the client
  2. Opening an exported CSV whose cells start with `=`, `+`, `-`, `@`, tab, or CR/LF in a spreadsheet executes no formula (OWASP prefix/strip applied)
  3. All auth mutation routes (login, refresh, forgot-password, change-password) are rate-limited with correct client IPs behind the proxy; login failure returns a uniform 401 while the distinct lockout signal stays intact
  4. A user with `mustChangePassword` gets 403 from every API route except the documented allowlist (change-password, me, refresh, logout) and can navigate only to the change-password flow — after changing, full access is restored (reset emails work, since Phase 7 drains the queue)

**Plans**: 4 plans
**UI hint**: yes

Plans:

- [ ] 08-01: Audit-before-stream for every export format (CSV/JSON/PDF) before any format branch; distinct audit action for forced password reset
- [ ] 08-02: CSV formula-injection neutralization — prefix/strip leading `=`, `+`, `-`, `@`, tab, CR, LF (and full-width variants) per OWASP CSV Injection guidance
- [ ] 08-03: Auth hardening — rate-limit all auth mutation routes (generous on `/auth/refresh`, tight on `/forgot-password`), uniform login 401 preserving the lockout 423 signal, explicit `trust proxy` hop count (never bare `true`)
- [ ] 08-04: `mustChangePassword` enforcement — 403 gate with explicit allowlist in `authJwt`, frontend router guard branch, end-to-end temp-password loop test (backend + frontend guard land together)

## Progress

**Execution Order:**
Phases execute in numeric order: 1 → 2 → 3 → 4 → 5 → 6 → 7 → 8

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. CI Regression Gate | 3/3 | Complete    | 2026-09-23 |
| 2. Rules Decisions (docs/14 close-out) | 3/3 | Complete | 2026-09-23 |
| 3. Deploy & Environment Contract | 4/3 | Complete    | 2026-09-24 |
| 4. Authorization Hardening | 3/3 | Complete    | 2026-09-24 |
| 5. Session Refresh | 4/4 | Complete    | 2026-09-24 |
| 6. Voting & Money State Machine | 0/5 | Not started | - |
| 7. Background Jobs | 0/4 | Not started | - |
| 8. Reports/Audit & Auth Polish | 0/4 | Not started | - |
