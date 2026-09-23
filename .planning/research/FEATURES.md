# Feature Research

**Domain:** Production hardening of an authorization / voting / financial system (SGRF bug-fix + security milestone)
**Researched:** 2026-09-23
**Confidence:** HIGH for categorization (anchored in in-repo evidence: `PROJECT.md` Active requirements, `docs/` specs, evidence-backed `CONCERNS.md` at commit b3837b7); MEDIUM overall because external corroboration is limited — websearch was unavailable this run (no `BRAVE_API_KEY`, built-in WebSearch returned empty), OWASP/Express sources were fetched directly instead.

Class of system: internal funding-request approval — five-role authorization, council voting with deadlines and tie-breaks, integer-cent ledger with annual limits, audit trail, CSV/PDF exports. Benchmark for "what production versions have": `docs/03|06|07|11|13|14` (the system's own authoritative specs), OWASP cheat sheets (Authorization, Authentication, Forgot Password, JWT, Logging, CSV Injection), and Express deployment docs.

## Feature Landscape

### Table Stakes (Production Blockers — must ship in this milestone)

Missing these = users at risk, funds can leak, or the system is dead in production. Every row maps to an `PROJECT.md` Active requirement.

| Feature | Why Expected (production behavior) | Complexity | Notes |
|---------|------------------------------------|------------|-------|
| Endpoint authorization matrix enforced (`cancel`, message `remove`, `getOne`/`list` scoping, `listVotes`, settings `transactions`, `force-password-reset` guard, reports `voting`) | Production systems deny by default and enforce the documented permission matrix server-side on **every** request; Broken Access Control is OWASP A01. Today any authenticated `ALUNO` can cancel others' requests, delete others' messages, read any request; a `CHEFE` can reset an `ADMIN`'s password. `docs/06` itself demands "autorizações explícitas, não espalhadas". | MEDIUM | Evidence: CONCERNS "Missing authorization" + 6 Known Bugs. Fix shape: one shared route-level permission map (deny-by-default), ownership scope filter mirroring `reports.routes.js:scopeFilter`. Distinct audit action for forced reset vs `invite_resent`. |
| Silent session refresh (401 → `POST /auth/refresh` once → retry original request) | Short-TTL access tokens (15m) are only viable with client-side silent refresh; production apps never bounce a logged-in user to `/login` mid-session. | LOW–MEDIUM | axios response interceptor in `frontend/src/services/api.js`; single-flight the refresh (one shared promise) so parallel 401s don't stampede; redirect only if refresh itself fails. Backend `/auth/refresh` already exists. Pattern digest stored (brave-tier, LOW external confidence). |
| `mustChangePassword` enforced server-side (403 until changed) + router guard | Forced password change is the core control of the invite/temp-password flow; if not enforced, the documented guarantee ("troca obrigatória", backlog Fase 1) is void and users keep weak/temporary credentials indefinitely. | LOW | Guard in `authJwt` (after `status === 'ATIVO'` check) + fill the empty router-guard comment in `frontend/src/router/index.js`. Allow only `/change-password` + logout through. |
| Tie-break convergence: `AGUARDANDO_DESEMPATE` always resolves | Production voting systems must reach a terminal decision; today a chefe who voted during the normal phase wedges the request forever (409 on `castVote`, 400 on `changeMyVote`, `closeManual` re-tallies to `EMPATE`) → funds never provisioned. | MEDIUM | Fragile 6-status state machine. Decide mechanism explicitly: allow chefe's `changeMyVote` in `AGUARDANDO_DESEMPATE`, or exclude chefe's regular vote from tie-break eligibility. Grep every `status ===` guard before changing. |
| Annual-limit accounting includes `CONCLUIDO` in `annualTotalCents` | The annual cap is the single control gating auto-approval; omitting `CONCLUIDO` lets requesters cycle spend → re-approve under the cap: a direct money-leak. Production budget systems count every committed *and* completed obligation against the cap. | LOW | One-line fix in `requestService.annualTotalCents` + unit test; confirm RN against `docs/03` (RN-002/RN-004) when recording the decision. |
| Partial-approval amount rule decided, documented in `docs/03`, implemented deliberately | "First partial vote wins" is arbitrary and indefensible in an audit; production approval workflows define an aggregation rule (e.g. majority amount, median of proposed amounts, or chefe-decides-among-proposals) before tallying. | MEDIUM | Rule decision first (`docs/14` close-out is a milestone Key Decision), then `votingService.closeVoting`, then tests encoding the chosen rule. Code comment already admits "primeiro". |
| Cancellation-after-approval: admin/chefe only, with justification, audited reversal | Production financial systems never allow silent post-approval changes: restricted role + mandatory reason + a compensating ledger entry. `docs/14` already recommends exactly this. | MEDIUM | Depends on the `cancel` authorization guard; should emit a reverse `FinancialTransaction` if funds were provisioned (financial reversal path exists: `reverse-provision`). |
| Email queue actually drains: `processQueue()` scheduled from `server.js`; give-up alerts admin after 3 tries | Invites, temporary passwords and notifications are dead today (rows sit `PENDING` forever) — operators cannot onboard or recover accounts in production. Production queues: retry with backoff, terminal give-up state, and an operator alert (promised in `docs/14`). | MEDIUM | `setInterval` from `server.js` is sufficient at single-instance scale (digest stored, brave-tier LOW external confidence); implement the alert path that today only `logger.error`s. |
| Voting auto-close scheduled: `closeExpired()` on an interval | RN-008 mandates a scheduled process: find expired votings → block new votes → tally → transact → notify. Today deadlines only *block* votes; requests stay `EM_VOTACAO` forever without manual action — not how any production voting system behaves. | MEDIUM | Requires fixing `votingCloser.js` broken requires first; every 5 min; idempotent per run; **depends on the tie-break fix** (see dependencies) so the job cannot wedge requests into `AGUARDANDO_DESEMPATE`. |
| `smtpConfigured` reports reality (`env.smtpEnabled && host`) | Operators must be able to trust system diagnostics; a hardcoded `true` hides a dead email subsystem from the admin. | LOW | One line in `settingsController.get`; pairs with the queue-drain work. |
| All report exports (CSV/JSON/PDF) audited before streaming + CSV formula injection neutralized | `docs/11` lists "exportação de relatório" as a mandatory audit event; OWASP Logging counts data exports among always-log events. CSV exports are a known attack surface: cells starting `=`, `+`, `-`, `@`, tab, CR, LF (and full-width variants) execute as formulas in spreadsheets — quote-escaping alone does not stop it. | LOW | `reports.routes.js`: call `audit()` before any format branches out (today only PDF does); in `toCSV`, prefix/strip leading formula characters (OWASP CSV Injection guidance). |
| Auth hardening: rate-limit **all** auth mutation routes, uniform 401 on login failure, explicit `trust proxy` | Production auth surfaces throttle login, refresh, forgot-password and change-password (OWASP Forgot Password explicitly requires rate-limiting reset requests — otherwise mass-reset floods the queue/inbox); uniform error messages + status codes prevent account enumeration (OWASP Authentication); per-IP buckets are wrong behind a proxy unless `trust proxy` is set to the actual topology (Express docs: never bare `true` — use hop count or trusted subnets). | LOW–MEDIUM | Keep per-account lockout (5 attempts) as-is; add per-IP express-rate-limit on the four auth routes; login must return one generic 401 instead of 401/403/423. |
| Secrets fail fast in production: no `dev-*-secret-change-me` fallbacks under `NODE_ENV=production` | OWASP Secrets Management: never hardcode or default secrets. Today any start outside `compose.yaml` silently signs **forgeable JWTs** — an authentication bypass waiting to happen. | LOW | `env.js` throws on missing/known-insecure `JWT_*` (and default admin email) when `NODE_ENV=production`; keep dev fallbacks for local only. |
| Secure-cookie / HTTPS story resolved | `secure: true` cookies over compose's plain HTTP make login silently fail on any non-localhost host — deployment blocker, not a nicety; OWASP Authentication requires credentials over TLS in production. | LOW–MEDIUM | Either terminate TLS in front (document `FRONTEND_URL=https://…`) or make the flag follow a `COOKIE_SECURE` env var. Must be decided before calling the deploy production-ready. |
| Minimal CI: backend `npx vitest run` + frontend `npm run build` on every push (required check) | Production codebases gate merges; this exact bug class (missing ownership check, dead job) shipped because nothing ran automatically. Backlog Fase 1 "configurar CI" is unchecked. | LOW | Two independent packages, no workspaces → per-job `working-directory` (digest stored, brave-tier LOW external confidence). No lint/typecheck — verification stays exactly what `AGENTS.md` defines. |

### Differentiators (Quality Boosters — valuable, not production blockers)

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| HTTP-level authorization regression tests (supertest 403/404 matrix for cross-user/cross-role access) | OWASP Authorization: create tests that validate the permission map — the recurrence gate *inside* CI; exactly the tests CONCERNS marks High priority and missing. | LOW–MEDIUM | `supertest` is already a devDependency, never imported. Not explicitly in Active scope (CI gates existing suites), but every authz fix should land with one. |
| Finance invariant reconciliation test (`sum(FinancialTransaction)` vs `FundBalance`) | Detects ledger divergence caused by the copy-pasted transaction blocks in 5 files — protects the "ledger always balances" core value. | MEDIUM | Needs a test-DB strategy (vitest currently unit-only). CONCERNS recommends it explicitly. |
| Token lifecycle: revocation on password change (`tokenVersion`/`passwordChangedAt` claim) + refresh rotation | A stolen 7-day refresh cookie keeps working after password reset today (OWASP JWT: short-lived access + secure refresh rotation). Top security follow-up. | MEDIUM–HIGH | Explicitly deferred by PROJECT.md ("beyond making refresh actually work") — schedule as its own milestone after silent refresh ships. |
| One-time reset/invite token instead of emailing the plaintext temporary password; purge `EmailQueue.body` after send | OWASP Forgot Password: never send the password in the email; today the plaintext temp password persists forever in the `EmailQueue` table and in logs. Removes a standing credential-at-rest risk. | MEDIUM | Ride-along candidate with the queue-drain work; not in Active scope. |
| Error-handler hardening (never return `err.stack`/Prisma internals; whitelist the dev flag) | Prevents internal disclosure when `NODE_ENV` is mis-set; cheap insurance. | LOW | Not in Active requirements — do it only if `validate.js` is already being touched, or log as follow-up. |
| nodemailer upgraded to ≥10 **before** SMTP is enabled | `npm audit` HIGH advisories (SMTP/header injection) on the ≤9.x line; blocker for turning email on in production, not for the deploy itself. | LOW–MEDIUM | Send surface is only `sendMail({from,to,subject,text})` — small migration. Trigger: any phase that sets `SMTP_ENABLED=true`. |
| Remaining `docs/14` decisions resolved (quorum, "sem quóró" manual path, vista-limit doc-vs-`@@unique` conflict) | `docs/14` states these must be resolved before production; production council-voting systems handle quorum explicitly, and today N vistas each stack +24h against the doc's "max 1 per solicitação". | MEDIUM (mostly decision + tests) | Milestone only commits to partial-approval/cancellation/email decisions — flag this gap for requirements definition; it may deserve its own phase. |
| Job operability: overlap guard + last-run/failure recording for the two revived jobs | Makes scheduled work debuggable in production (single-process `setInterval` double-fires if a run stalls; dead-job blindness is how both bugs shipped). | LOW–MEDIUM | Cheap while wiring the jobs; no external scheduler needed. |
| Audit retention/pruning policy | `AuditEvent` (full before/after JSON) and `EmailQueue` grow unbounded — compliance expectation (OWASP Logging: retention period) and disk hygiene. | MEDIUM | No volume yet; decide policy, implement when growth is real. |
| Audit-trail read API/UI (admin full, chefe limited) | `docs/06` grants "Ver auditoria" but audit rows are write-only — oversight requirement unmet; also makes export auditing useful. | MEDIUM–HIGH | Explicitly Out of Scope this milestone — a feature milestone of its own. |

### Anti-Features (Commonly Requested, Deliberately NOT This Milestone)

| Anti-Feature | Why Requested | Why Problematic | Alternative |
|--------------|---------------|-----------------|-------------|
| CSRF tokens | Cookie-only auth *looks* like it requires them. | Touches every mutation route; `docs/11` formally accepts the residual risk (`sameSite: 'lax'` blocks cross-site POSTs, CORS is origin-restricted with credentials). Building them dilutes a fix-only milestone. | Keep accepted risk; add `Origin` verification on mutations if the app ever spans subdomains (documented trigger). |
| Refresh-token rotation / full session-revocation system now | Correct long-term hygiene (OWASP JWT). | Refresh doesn't even work client-side yet — layering rotation onto a broken flow doubles the blast radius of the fix and expands test surface beyond what the suite can verify. | Ship silent single-retry refresh first (table stakes); rotation + revocation as a dedicated follow-up milestone. |
| TypeScript / ESLint / typecheck adoption | Would catch whole bug classes. | `AGENTS.md` forbids inventing these commands; enabling them mid-hardening gates CI on a new toolchain and forces mass-file churn that obscures the actual fixes. | Verification stays `npx vitest run` + `npm run build`; revisit post-milestone. |
| Frontend E2E suite (Playwright etc.) | Guards router guards and the new interceptor. | `npm test` exits 1 by design; standing up an E2E harness dwarfs the 15 fixes and can't be maintained by this milestone's gates. | Manual UAT per wave + `npm run build` in CI; add a smoke suite in a later quality milestone. |
| Broad refactors (balance-service extraction, JSON columns, `validate()` middleware everywhere, role-constant dedup) | Tempting — you're editing exactly those files anyway. | Behavior churn in money and auth paths with only 17 unit tests cannot be verified; Key Decision already excludes them. | Refactor only where a fix structurally requires it (e.g. permission map is a fix, not a refactor). |
| New features mid-hardening (file uploads/`RequestFile`, audit read UI, RPA stubs, email settings UI) | They're visible on the backlog. | Each adds untested surface to a system whose job is closing holes; destroys the "verifiable hardening pass" framing. | Separate feature milestone after blockers close (PROJECT.md Out of Scope). |
| Horizontal scaling / pagination / external rate-limit store | List caps truncate silently; in-memory limiter is per-process. | No user volume justifies it (PROJECT.md Out of Scope); >1 replica would also double-run jobs — solving scale now means solving single-scheduler design with no one to benefit. | Document the caps; single-instance `setInterval` jobs; scale when volume appears. |
| MFA / passkeys or institutional OIDC SSO | Strongest available auth control (OWASP: MFA stops ~99.9% of account compromise). | Needs an IdP, enrollment UX and backend protocol work — a product decision for UTFPR IT, not a bug fix. | Keep `@utfpr.edu.br`-only + lockout + new rate limits now; evaluate OIDC with IT as a future milestone. |

## Feature Dependencies

```
[Secrets fail-fast] ──enhances──> [Secure-cookie/HTTPS story]   (both touch env/token/compose config)

[Trust proxy configured]
    └──requires before──> [Rate-limit all auth routes]          (per-IP buckets are wrong without it)

[Tie-break convergence fix]
    └──requires before──> [Voting auto-close scheduled]         (job runs tally → can hit EMPATE path)

[Cancellation-after-approval rule]
    └──requires──> [Authorization matrix (cancel guard)]
    └──requires──> [Audited reversal transaction]

[docs/14 decisions recorded]
    └──requires before──> [Partial-approval rule]
    └──requires before──> [Cancellation-after-approval rule]

[Email queue drains + smtpConfigured reality]
    └──enhances──> [mustChangePassword enforcement]             (temp password must actually arrive)
    └──enhances──> [Auth rate limiting]                         (protects queue from forgot-password flooding)

[Authorization matrix]
    └──enhanced by──> [supertest authz regression tests]
    └──gated by──> [Minimal CI]                                 (nothing prevents recurrence without it)

[Session refresh (FE interceptor]
    └──requires──> [Uniform 401 semantics]                      (interceptor must distinguish expired vs invalid)

[Export audit + CSV neutralization] ──same file──> [reports.routes.js]  (do together, one change)
```

### Dependency Notes

- **Trust proxy → rate limiting:** without it every client behind the proxy shares one bucket (global lockout) or, with naive `true`, the bucket key is spoofable — expand rate limits only with the proxy setting in the same change.
- **Tie-break fix → auto-close job:** scheduling `closeExpired()` before the tie-break path is fixed automates the wedge — expired tied requests would be pushed into a status with no exit. This is the one ordering constraint that can silently reintroduce a "fixed" bug.
- **docs/14 decisions → rule-dependent fixes:** partial-approval and cancellation cannot be coded before the rule exists; the milestone Key Decision ("decide now, then fix") makes this a within-milestone ordering, not a cross-phase dependency.
- **Queue drain → forced password change:** enforcing `mustChangePassword` while invites/resets never send would soft-lock users with unreachable temporary passwords.
- **CI → everything:** the regression gate is cheap and independent — land it first so every subsequent fix is protected as it merges.

## MVP Definition

### Launch With (this milestone = production blockers)

- [ ] Endpoint authorization matrix + ownership scoping — funds/data exposed to wrong roles today
- [ ] Secrets fail fast in production — forgeable-JWT bypass outside compose
- [ ] Auth rate limiting (all auth routes) + uniform 401 + `trust proxy` — account-enumeration and mass-reset exposure
- [ ] Session refresh interceptor — system unusable past 15 minutes
- [ ] `mustChangePassword` enforced — forced-change guarantee currently void
- [ ] Annual-limit `CONCLUIDO` accounting — direct money-leak
- [ ] Tie-break convergence + voting auto-close scheduled — decisions must reach terminal state
- [ ] Partial-approval + cancellation-after-approval rules decided and implemented — auditable, non-arbitrary outcomes
- [ ] Email queue drains with give-up alert + honest `smtpConfigured` — invites/resets/notification subsystem alive
- [ ] Export auditing (all formats) + CSV injection neutralization — compliance-mandated events
- [ ] Secure-cookie/HTTPS story resolved — deploy works beyond localhost
- [ ] Minimal CI (vitest + build) — the gate every fix above depends on staying fixed

### Add After Validation (v1.x differentiators)

- [ ] supertest authorization regression matrix — trigger: as each authz fix lands (cheap, do opportunistically)
- [ ] Finance reconciliation test — trigger: first change to any balance-mutation code path
- [ ] Remaining `docs/14` decisions (quorum, vista limits) — trigger: before declaring council workflow production-complete
- [ ] One-time reset token + `EmailQueue.body` purge — trigger: before enabling SMTP for real users
- [ ] nodemailer ≥10 — trigger: `SMTP_ENABLED=true`
- [ ] Job overlap guard / run telemetry — trigger: while wiring the two jobs

### Future Consideration (v2+ / anti-feature alternatives)

- [ ] Refresh rotation + revocation (`tokenVersion`) — trigger: dedicated session-lifecycle milestone after silent refresh is stable
- [ ] Audit-trail read API/UI + retention policy — trigger: oversight/compliance ask
- [ ] Frontend E2E smoke suite — trigger: post-milestone quality push
- [ ] CSRF tokens / Origin checks — trigger: app spans subdomains
- [ ] MFA or institutional OIDC — trigger: UTFPR IT identity decision
- [ ] Pagination / external rate-limit store / multi-replica — trigger: real user volume

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority |
|---------|------------|---------------------|----------|
| Endpoint authorization matrix + scoping | HIGH | MEDIUM | P1 |
| Secrets fail fast (prod) | HIGH | LOW | P1 |
| Auth rate limits + uniform 401 + trust proxy | HIGH | LOW–MEDIUM | P1 |
| Session refresh interceptor | HIGH | LOW–MEDIUM | P1 |
| `mustChangePassword` enforcement | HIGH | LOW | P1 |
| Annual-limit `CONCLUIDO` fix | HIGH | LOW | P1 |
| Tie-break convergence | HIGH | MEDIUM | P1 |
| Voting auto-close scheduled | HIGH | MEDIUM | P1 |
| Email queue drain + admin alert | HIGH | MEDIUM | P1 |
| Partial-approval rule (decide+implement) | HIGH | MEDIUM | P1 |
| Cancellation-after-approval rule | HIGH | MEDIUM | P1 |
| Export audit + CSV neutralization | HIGH | LOW | P1 |
| Secure-cookie/HTTPS resolution | HIGH | LOW–MEDIUM | P1 |
| Minimal CI | HIGH | LOW | P1 |
| `smtpConfigured` honesty | MEDIUM | LOW | P1 |
| supertest authz regression tests | HIGH | LOW–MEDIUM | P2 |
| Finance reconciliation test | MEDIUM | MEDIUM | P2 |
| Remaining `docs/14` decisions | HIGH | MEDIUM | P2 |
| One-time reset token + queue purge | MEDIUM | MEDIUM | P2 |
| nodemailer upgrade | MEDIUM | LOW–MEDIUM | P2 (P1 before SMTP enable) |
| Error-handler hardening | MEDIUM | LOW | P2 |
| Job overlap guard / telemetry | MEDIUM | LOW–MEDIUM | P2 |
| Refresh rotation + revocation | HIGH | HIGH | P3 (deferred milestone) |
| Audit read API/UI + retention | MEDIUM | HIGH | P3 (deferred milestone) |
| CSRF tokens / Origin checks | LOW | HIGH | P3 (accepted risk) |
| TypeScript / lint / typecheck | MEDIUM | HIGH | P3 (forbidden this milestone) |
| Frontend E2E suite | MEDIUM | HIGH | P3 |
| MFA / OIDC SSO | HIGH | HIGH | P3 (institutional decision) |
| Pagination / horizontal scaling | LOW | HIGH | P3 (no volume) |

**Priority key:** P1 = table stakes for this milestone; P2 = differentiator, add when possible (note: P2 items remain *outside* the milestone's committed scope unless requirements say otherwise); P3 = anti-feature/deferred — do not start this milestone.

## Class-of-System Reference Behavior

No direct competitors (internal UTFPR system) — benchmark is how production instances of this class behave, per OWASP and the repo's own specs.

| Area | Production norm for this class | SGRF status |
|------|--------------------------------|-------------|
| Endpoint authorization | Centralized, deny-by-default permission map validated on every request, with tests asserting denials (OWASP Authorization) | Scattered inline checks; 6 endpoints unprotected (CONCERNS) |
| Session refresh | Silent refresh + single retry under short-TTL tokens | No interceptor; logout at 15 min |
| Forced password change | Server-side 403 gate until changed | Not enforced anywhere |
| Vote deadline | Scheduler concludes expired votes; every path reaches a terminal status | Votes blocked but status stuck; no scheduler |
| Tie-break | Defined mechanism resolves ties (chefe casting/vetoing per bylaws) | Dead-end once chefe pre-voted |
| Annual budget cap | All obligated + completed amounts count | `CONCLUIDO` excluded (bypass) |
| Partial approval | Documented aggregation rule (median/majority/chefe-decides) | First partial vote wins |
| Post-approval cancellation | Restricted role + mandatory justification + compensating entry (`docs/14` agrees) | Any role, no justification |
| Auth throttling | All auth mutation endpoints throttled, uniform errors, proxy-aware keys | Login only; 3 distinguishable errors; no `trust proxy` |
| Export auditing | Every export format logged before data leaves (OWASP Logging: data exports) | PDF only |
| CSV exports | Leading `=+-@\t\r\n` neutralized (OWASP CSV Injection) | Quote-escaping only |
| Secrets | Fail fast on defaults in production (OWASP Secrets Management) | `dev-*-secret-change-me` fallbacks |
| Background jobs | Interval/cron scheduler, idempotent runs, failure alerting | Both jobs never run |
| CI | Tests + production build as required checks | None |

## Sources

- **In-repo, curated (primary basis, HIGH):** `.planning/PROJECT.md` (Active/Out-of-Scope requirements, Key Decisions); `docs/03-regras-de-negocio.md`, `docs/06-permissoes.md`, `docs/07-fluxos.md`, `docs/11-seguranca-e-auditoria.md`, `docs/13-backlog.md`, `docs/14-decisoes-em-aberto.md`; `.planning/codebase/CONCERNS.md` (evidence-backed bug/security inventory at commit b3837b7, 2026-09-22); `AGENTS.md` (verification constraints).
- **OWASP Cheat Sheet Series, fetched directly via webfetch (first-party but LOW tier per `classify-confidence --provider webfetch`):** Authorization, Authentication, Forgot Password, JSON Web Token, Secrets Management, Logging cheat sheets; OWASP CSV Injection attack page — https://owasp.org/www-community/attacks/CSV_Injection.
- **Express official docs, webfetch (LOW tier per seam):** "Express behind proxies" — https://expressjs.com/en/guide/behind-proxies.html (`trust proxy` semantics and spoofing warnings).
- **Research seam digests stored** (`gsd_run query research-store put`): Prisma concurrent-update pattern (context7 tier, MEDIUM); job scheduling, axios single-flight refresh, GitHub Actions two-package CI (brave tier, LOW).
- **Confidence caveats:** websearch was unavailable this run (Brave key unset; built-in WebSearch empty) — claims about generic Node/CI/axios practices rest on pattern knowledge at LOW external confidence and are marked so; the OWASP/Express claims were verified against fetched pages but the seam tiers `webfetch` as LOW. No competitor products were analyzed (internal system).

---
*Feature research for: SGRF production-hardening milestone*
*Researched: 2026-09-23*
