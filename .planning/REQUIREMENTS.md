# Requirements: SGRF — Production Hardening

**Defined:** 2026-09-23
**Core Value:** Requests are decided correctly and funds cannot leak — the right people approve the right amounts, every state change is authorized and auditable, and the ledger always balances.

## v1 Requirements

Requirements for this milestone (bug fixes + security hardening + CI). Each maps to roadmap phases.

### Security

- [x] **SEC-01**: Every endpoint enforces the documented permission matrix server-side — `cancel`, message `remove`, `getOne`/`list` scoping, `listVotes`, settings `transactions`, `force-password-reset` guard, reports `voting` — deny-by-default via one shared permission map (transcribed from `docs/06-permissoes.md`), with row-level ownership checks in controllers
- [x] **SEC-02**: Production boot fails fast when `JWT_*` / `INITIAL_ADMIN_*` secrets are missing or insecure — no `dev-*-secret-change-me` fallbacks under `NODE_ENV=production`; local dev fallbacks unchanged
- [ ] **SEC-03**: All auth mutation routes are rate-limited (login, refresh, forgot-password, change-password), login returns a uniform 401 (no 401/403/423 account enumeration), and `trust proxy` is explicitly configured for the deployment topology (hop count / trusted subnets — never bare `true`)
- [x] **SEC-04**: Cookie/HTTPS story resolved — `secure` flag follows a `COOKIE_SECURE` env var (or TLS termination is documented with `FRONTEND_URL=https://…`); login works on non-localhost hosts

### Session

- [x] **SES-01**: Users stay logged in past 15 minutes — single-flight 401 response interceptor on the shared axios instance refreshes once (`POST /auth/refresh`) and retries the original request; redirect to login only when refresh itself fails; no router import (import cycle)
- [ ] **SES-02**: `mustChangePassword` blocks API access (403 until `changePassword`) and router navigation allows only the change-password flow + logout — the documented "troca obrigatória de senha" guarantee is actually enforced

### Voting & Finance Rules

<!-- Rule decisions first (docs/14 close-out), then fixes, then tests encoding the rule. -->

- [x] **VOT-01**: Ties always resolve — `AGUARDANDO_DESEMPATE` reaches a terminal status even when the chefe already voted during the normal phase (decide mechanism: chefe `changeMyVote` allowed in tiebreak status, or chefe's regular vote excluded from tie-break eligibility); every `status ===` guard grepped before changing
- [ ] **VOT-02**: `CONCLUIDO` counts toward `annualTotalCents` — the annual auto-approval cap cannot be bypassed by cycling requests through `mark-spent`; RN confirmed against `docs/03-regras-de-negocio.md` with a unit test
- [x] **VOT-03**: Partial-approval aggregation rule decided (median / majority amount / chefe-decides — recorded in `docs/03` + `docs/14`), implemented in `closeVoting` replacing "first partial vote wins", encoded in tests
- [ ] **VOT-04**: Cancellation-after-approval rule decided — `ADMINISTRADOR`/`CHEFE_DEPARTAMENTO` only, mandatory justification, audited compensating reversal (reverse `FinancialTransaction` when funds were provisioned); ordinary cancellation gets the ownership guard from SEC-01

### Jobs & Email

- [ ] **JOB-01**: Email queue drains on an interval started from `server.js` (re-entrancy-guarded, cleared on SIGTERM); invites/resets/notifications actually send; give-up path alerts the admin after 3 tries per `docs/14-decisoes-em-aberto.md` (not just `logger.error`)
- [ ] **JOB-02**: Voting auto-close runs on an interval — `votingCloser.js` broken requires fixed (`./` → `../`) first; expired `EM_VOTACAO` requests conclude (tally → provision → notify) without manual action; idempotent per run; lands **after** VOT-01 so the job cannot wedge tied requests
- [ ] **JOB-03**: `smtpConfigured` reports reality (`env.smtpEnabled && Boolean(env.smtp.host)`), not hardcoded `true`

### Reports & Audit

- [ ] **REP-01**: Every report export (CSV/JSON/PDF) is audited (`report_exported`) before any format branches out — today only PDF audits
- [ ] **REP-02**: CSV formula injection neutralized — leading `=`, `+`, `-`, `@`, tab, CR, LF (and full-width variants) prefixed/stripped per OWASP CSV Injection guidance

### CI

- [x] **CI-01**: Two-job pipeline runs on every push/PR as a required check — backend `npx vitest run` + frontend `npm run build` (Node 22, per-package `working-directory`, per-lockfile npm cache); no workspace tooling, no invented lint/typecheck commands; landed **first** as the regression gate for every other fix

## v2 Requirements

Deferred to future work. Tracked but not in this roadmap.

### Quality & Tests

- HTTP-level authorization regression matrix (supertest 403/404 for cross-user/cross-role) — trigger: opportunistically with each SEC-01 fix
- Finance invariant reconciliation test (`sum(FinancialTransaction)` vs `FundBalance`) — trigger: first change to any balance-mutation path
- Job overlap guard + last-run/failure telemetry — trigger: while wiring the two jobs (cheap ride-along)
- Error-handler hardening (no `err.stack`/Prisma internals leaked) — trigger: when `validate.js` is touched anyway

### Rules & Email

- Remaining `docs/14` decisions: quorum, "sem quóró" manual path, vista-limit doc-vs-`@@unique` conflict — trigger: before declaring the council workflow production-complete
- One-time reset/invite token instead of emailed plaintext temp password + purge `EmailQueue.body` — trigger: before enabling SMTP for real users
- nodemailer ≥10 (HIGH advisories on ≤9.x) — trigger: any phase setting `SMTP_ENABLED=true` (send surface is small)

## Out of Scope

Explicitly excluded. Documented to prevent scope creep.

| Feature | Reason |
|---------|--------|
| New features (file uploads/`RequestFile`, audit read API/UI, RPA/finance integration, email settings UI) | Milestone is fixes + hardening only; untested new surface destroys the verifiable-hardening framing |
| Broad refactors (balance-service extraction, JSON columns, `validate()` middleware everywhere, role-constant dedup) | Behavior churn in money/auth paths unverifiable with 17 unit tests; refactor only where a fix structurally requires it |
| CSRF tokens | `docs/11` formally accepts the residual risk (`sameSite: 'lax'` + origin-restricted CORS); revisit if the app spans subdomains |
| Refresh rotation / session revocation (`tokenVersion`) | Layering rotation onto a not-yet-working refresh flow doubles blast radius; dedicated milestone after SES-01 ships |
| TypeScript / ESLint / typecheck | `AGENTS.md` forbids inventing these commands; mass churn would obscure the actual fixes |
| Frontend E2E suite (Playwright etc.) | `npm test` exits 1 by design; an E2E harness dwarfs the fix set; manual UAT per wave + `npm run build` in CI instead |
| Horizontal scaling / pagination / external rate-limit store | No user volume justifies it; >1 replica would also double-run jobs |
| MFA / institutional OIDC SSO | Product decision for UTFPR IT, not a bug fix |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| SEC-01 | Phase 4 | Complete |
| SEC-02 | Phase 3 | Complete |
| SEC-03 | Phase 8 | Pending |
| SEC-04 | Phase 3 | Complete |
| SES-01 | Phase 5 | Complete |
| SES-02 | Phase 8 | Pending |
| VOT-01 | Phase 6 | Complete |
| VOT-02 | Phase 6 | Pending |
| VOT-03 | Phase 6 | Complete |
| VOT-04 | Phase 6 | Pending |
| JOB-01 | Phase 7 | Pending |
| JOB-02 | Phase 7 | Pending |
| JOB-03 | Phase 7 | Pending |
| REP-01 | Phase 8 | Pending |
| REP-02 | Phase 8 | Pending |
| CI-01 | Phase 1 | Complete |

*Phase 2 (Rules Decisions, docs/14 close-out) carries no requirement ID directly — it is the decision gate for VOT-03/VOT-04; their implementation lands in Phase 6 after Phase 2's decisions and Phase 4's permission map.*

**Coverage:**

- v1 requirements: 16 total
- Mapped to phases: 16
- Unmapped: 0 ✓

---
*Requirements defined: 2026-09-23*
*Last updated: 2026-09-23 after roadmap creation (traceability filled)*
