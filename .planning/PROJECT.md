# SGRF — Sistema de Gestão de Recursos Financeiros

## What This Is

SGRF (aka SGRD) is an internal web system for UTFPR that manages departmental funding requests end-to-end: a requester submits a request, it either auto-approves under an annual limit or goes to council vote, approved funds are provisioned in a ledger, and admins track everything through reports and audit. It serves five roles — ADMINISTRADOR, CHEFE_DEPARTAMENTO, CONSELHEIRO, PROFESSOR, ALUNO — through a Vue 3 SPA talking to an Express API. The MVP (v0.1.1) is feature-complete but has known bugs and security holes; this project takes it to production-ready.

## Core Value

Requests are decided correctly and funds cannot leak — the right people approve the right amounts, every state change is authorized and auditable, and the ledger always balances.

## Requirements

### Validated

<!-- Shipped and confirmed valuable — inferred from existing code (codebase map, 2026-09-23). -->

- ✓ Login with institutional `@utfpr.edu.br` email, argon2 hashing, lockout after 5 failed attempts, cookie JWT (15m access / 7d refresh) — existing
- ✓ Request lifecycle: draft → voting → approved (full/partial/automatic) / rejected / suspended / concluded, with annual-limit auto-approval rule — existing
- ✓ Council voting: eligibility matrix, simple-majority tally, tie → desempate status, deadline enforcement on votes — existing
- ✓ Financial ledger: transactional provision/spend/reverse on `FundBalance` + append-only `FinancialTransaction`, money as integer cents — existing
- ✓ Role-based navigation and route-level role gates for the 5 roles — existing
- ✓ Write-only audit trail (`AuditEvent` with IP + user agent) on mutating flows — existing
- ✓ Reports: CSV/PDF export + dashboard aggregation with server-side scope filtering — existing
- ✓ Batch user import with Zod validation — existing
- ✓ Docker single-image deploy (Express serves API + built SPA) + Postgres via compose — existing
- ✓ Unit test baseline: 17 Vitest tests (`calcAmount`, `tally`, batch validation) — existing

### Active

<!-- Current scope — the bug-fix + hardening milestone. -->

- [ ] Authorization holes closed: `cancel`, message `remove`, `getOne`/`list` scoping, `listVotes`, settings `transactions`, `force-password-reset` guard — every state-changing/reading endpoint enforces documented permissions from `docs/06-permissoes.md`
- [ ] Session refresh works: frontend 401 interceptor calls `/auth/refresh` once and retries; users are not bounced to login after 15 minutes
- [ ] `mustChangePassword` enforced server-side (403 until changed) and in the router
- [ ] Tie-break dead-end fixed: `AGUARDANDO_DESEMPATE` resolves when the chefe already voted
- [ ] Annual-limit bypass fixed: `CONCLUIDO` counts toward `annualTotalCents` (per `docs/03-regras-de-negocio.md`)
- [ ] Partial-approval rule decided (close `docs/14` item) and implemented deliberately — not "first partial vote wins"
- [ ] Cancellation-after-approval rule decided and implemented (justification + role requirement)
- [ ] Email queue drains: `processQueue()` scheduled from `server.js`; invites/resets actually send; give-up path alerts the admin per `docs/14`
- [ ] Voting auto-close scheduled: `closeExpired()` runs on an interval; expired votings conclude without manual action (requires fixing `votingCloser.js` broken requires)
- [ ] `smtpConfigured` reports reality (`env.smtpEnabled && host`), not hardcoded `true`
- [ ] Report exports (CSV/JSON/PDF) all audited before streaming; CSV injection neutralized
- [ ] Auth hardening: rate-limit all auth mutation routes, uniform 401 on login failure, `trust proxy` configured for deployment topology
- [ ] Secrets fail fast in production: `env.js` refuses insecure `dev-*-secret-change-me` fallbacks when `NODE_ENV=production`
- [ ] Secure-cookie/HTTPS story resolved (compose publishes plain HTTP while cookies demand `secure` in prod)
- [ ] Minimal CI: backend `npx vitest run` + frontend `npm run build` on every push — the regression gate these bugs were missing

### Out of Scope

- New features (file uploads/`RequestFile`, audit-trail read UI, RPA/finance integration stubs, email settings UI) — deferred; this milestone is bug fixes + hardening only
- Tech-debt refactors (balance service extraction, `validate()` middleware adoption, JSON columns, role-constant dedup) — only touch where a bug fix requires it
- Session revocation/refresh rotation beyond making refresh actually work — deeper token lifecycle work deferred
- CSRF tokens — `sameSite: 'lax'` + CORS accepted residual risk per `docs/11` (revisit if app spans subdomains)
- Frontend test suite / E2E — verification stays `npm run build` per `AGENTS.md`; CI only gates existing suites
- TypeScript, lint, or typecheck adoption — intentionally absent for MVP (per `AGENTS.md`); not part of this milestone
- Horizontal scaling / pagination of list caps — no user volume yet to justify it

## Context

- **Technical environment:** two independent npm packages (no workspaces) — `backend/` (Node 22, Express 4, Prisma 5, PostgreSQL 16, CommonJS) and `frontend/` (Vue 3, Vite 5, ESM, Pinia). Verification commands: `cd backend && npx vitest run` and `cd frontend && npm run build`. No lint/typecheck/CI exist today.
- **Spec corpus:** `docs/` holds the authoritative domain specs — `03-regras-de-negocio.md` (voting/approval rules), `06-permissoes.md` (permission matrix), `07-fluxos.md` (flows), `11-seguranca-e-auditoria.md` (security policy), `13-backlog.md` (Fase 1–7 backlog), `14-decisoes-em-aberto.md` (open decisions the code already answered implicitly). Bug fixes must align code to these docs — or update the doc when the doc is wrong.
- **Current state:** v0.1.1 deployed shape (Docker + compose) works locally; 17 unit tests pass; known bugs documented in `.planning/codebase/CONCERNS.md` (evidence-backed, mapped 2026-09-22 at commit b3837b7).
- **Fragile areas:** voting/deliberation state machine (6 interlinked statuses), financial balance invariants (copy-pasted transaction blocks in 5 files), scattered authorization checks (new routes default to "auth-only" — how `cancel`/`remove` shipped unprotected).
- **Danger zones:** never commit `backend/.env`, `*.db*`, `backend/uploads/*`; money is cents (integer); IDs are UUID strings; no raw SQL; after schema changes run `npx prisma migrate dev`.

## Constraints

- **Tech stack**: Stay on Express + Prisma + Vue — fixes only, no framework migrations; why: milestone is hardening, and the map shows the stack is sound.
- **Business rules**: Code must conform to `docs/` specs; where `docs/14` is undecided, decide explicitly and record it — why: several bugs exist precisely because rules were answered implicitly.
- **Security**: Institutional `@utfpr.edu.br`-only accounts, cookie-based JWT, role authority stays server-side — why: architecture assumes same-origin `/api`; frontend never has decision authority.
- **Verification**: Only `npx vitest run` (backend) + `npm run build` (frontend) — don't invent lint/typecheck commands; why: `AGENTS.md` is explicit.
- **Deployment**: Single Docker image + compose, `APP_PORT` external, secrets via environment with fail-fast — why: existing deploy shape works; production-readiness means hardening it, not replacing it.

## Key Decisions

<!-- Decisions that constrain future work. Add throughout project lifecycle. -->

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Scope = all Known Bugs + Security bucket, both dead jobs, and CI | Production-ready MVP requires closing every known hole, not just a subset | — Pending |
| Open business decisions (`docs/14`) get decided now, then fixed | Rule-dependent bugs (partial approval, cancellation) can't be fixed without a rule | — Pending |
| Excludes new features and broad tech-debt refactors | Keeps the milestone a verifiable hardening pass; refactors only where a fix requires them | — Pending |

## Context Notes (Evolution History)

- 2026-09-23: Project initialized during brownfield onboarding after `/gsd-map-codebase` produced the complete codebase map.

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `/gsd-transition`):
1. Requirements invalidated? → Move to Out of Scope with reason
2. Requirements validated? → Move to Validated with phase reference
3. New requirements emerged? → Add to Active
4. Decisions to log? → Add to Key Decisions
5. "What This Is" still accurate? → Update if drifted

**After each milestone** (via `/gsd-complete-milestone`):
1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state

---
*Last updated: 2026-09-23 after initialization*
