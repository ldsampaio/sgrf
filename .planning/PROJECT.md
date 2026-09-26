# SGRF — Sistema de Gestão de Recursos Financeiros

## What This Is

SGRF (aka SGRD) is an internal web system for UTFPR that manages departmental funding requests end-to-end: a requester submits a request, it either auto-approves under an annual limit or goes to council vote, approved funds are provisioned in a ledger, and admins track everything through reports and audit. It serves five roles — ADMINISTRADOR, CHEFE_DEPARTAMENTO, CONSELHEIRO, PROFESSOR, ALUNO — through a Vue 3 SPA talking to an Express API. Milestone v0.1.1 completed the production-hardening pass; v0.1.2 makes milestone publication on GitHub complete, verifiable, and resistant to incomplete release states.

## Core Value

Requests are decided correctly and funds cannot leak — the right people approve the right amounts, every state change is authorized and auditable, and the ledger always balances.

## Current Milestone: v0.1.2 GitHub Release Reliability

**Goal:** Recover the v0.1.1 GitHub publication and make every future milestone close only after its version, commit, required CI checks, Release, and Milestone form a verifiable, coherent state.

**Target features:**
- Publish a factual v0.1.1 GitHub Release from the existing annotated tag and verified v0.1.1 merge commit
- Create and close a GitHub Milestone v0.1.1 with a concise completion record
- Add a deterministic, operator-driven release-close path with CI, ref, and remote-object preconditions
- Verify each published object through GitHub API/CLI readback and document recovery and failure handling

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
- ✓ Unit test baseline: 131 Vitest tests, including database-backed authorization and concurrent-balance invariants — v0.1.1
- ✓ Minimal CI: backend `npx vitest run` + frontend `npm run build` on every push/PR — Phase 1 (CI-01)
- ✓ Secrets fail fast in production: `env.js` refuses insecure `dev-*-secret-change-me` fallbacks when `NODE_ENV=production` — Phase 3 (SEC-02)
- ✓ Secure-cookie/HTTPS story resolved: `secure` follows `COOKIE_SECURE` env var, Cloudflare Tunnel is the TLS termination — Phase 3 (SEC-04)
- ✓ Session refresh works: single-flight 401 interceptor on the shared axios instance refreshes once and retries; bounce to login only on refresh death with locked notice + validated return-to-origin + draft restore — Phase 5 (SES-01)
- ✓ Deny-by-default authorization, ownership scoping, forced-password enforcement, voting/money rules, scheduled email/voting jobs, report auditing, CSV-injection protection, and auth hardening shipped — v0.1.1

### Active

<!-- Current scope — GitHub release recovery and future close reliability. -->

- [ ] Publish the missing GitHub Release `v0.1.1` from the existing tag at verified merge commit `10c62ac`, with factual milestone notes
- [ ] Create a closed GitHub Milestone `v0.1.1` with a concise completion record
- [ ] Add a deterministic, operator-driven release-close path that requires a clean main commit, exact version refs, and green backend/frontend CI before mutation
- [ ] Make publication idempotent and safe to re-run: existing objects are read back rather than blindly duplicated or overwritten
- [ ] Verify tag, Release, Milestone, and CI through GitHub readback; document recovery and rollback behavior

### Out of Scope

- Rewriting or replacing the valid existing `v0.1.1` tag — it already resolves to the release commit; recreating it adds risk without value
- Automatically deleting, force-moving, or overwriting existing remote releases/tags
- Fully autonomous releases from arbitrary branches or commits — the milestone defines an operator-invoked, auditable path
- Historical release-note rewriting or a hosting migration — scope is completing and safeguarding publication on the current repository
- New product features, broad application refactors, framework migrations, or changes to the CI test/build commands themselves

## Context

- **Technical environment:** two independent npm packages (no workspaces) — `backend/` (Node 22, Express 4, Prisma 5, PostgreSQL 16, CommonJS) and `frontend/` (Vue 3, Vite 5, ESM, Pinia). Verification commands: `cd backend && npx vitest run` and `cd frontend && npm run build`. No lint/typecheck/CI exist today.
- **Spec corpus:** `docs/` holds the authoritative domain specs — `03-regras-de-negocio.md` (voting/approval rules), `06-permissoes.md` (permission matrix), `07-fluxos.md` (flows), `11-seguranca-e-auditoria.md` (security policy), `13-backlog.md` (Fase 1–7 backlog), `14-decisoes-em-aberto.md` (open decisions the code already answered implicitly). Bug fixes must align code to these docs — or update the doc when the doc is wrong.
- **Current state:** v0.1.1 completed 8/8 phases, 29 plans, and 32 tasks; merge commit `10c62ac` is green on `main` and the annotated remote tag resolves to the same commit. GitHub publication is incomplete: Release `v0.1.1` and all GitHub Milestones are absent.
- **CI incident evidence:** release-branch run `36095528423` failed only in backend because its fresh PostgreSQL service had no `DepartmentSettings(id=default)` row; commit `b50dc94` changed test setup to upsert. The latest main and tag runs pass backend 131/131 and frontend build, so the historical red run is root-caused and superseded rather than merely rerun.
- **Fragile areas:** voting/deliberation state machine (6 interlinked statuses), financial balance invariants (copy-pasted transaction blocks in 5 files), scattered authorization checks (new routes default to "auth-only" — how `cancel`/`remove` shipped unprotected).
- **Danger zones:** never commit `backend/.env`, `*.db*`, `backend/uploads/*`; money is cents (integer); IDs are UUID strings; no raw SQL; after schema changes run `npx prisma migrate dev`.

## Constraints

- **Tech stack**: Stay on Express + Prisma + Vue and use the existing GitHub CLI/API release surface; no framework migration or hosted release service in this milestone.
- **Verification**: Backend acceptance remains `npx vitest run`; frontend acceptance remains `npm run build`; release acceptance additionally requires GitHub readback of CI/tag/Release/Milestone state. Do not invent lint/typecheck commands.
- **Release safety**: Never delete, recreate, or force-move the valid `v0.1.1` tag; publication must be idempotent and must refuse when main, tag, or required checks disagree.
- **Automation boundary**: Release automation is operator-invoked and auditable; it must not deploy application code or silently publish from arbitrary branches.
- **Remote truth**: GitHub API/CLI readback is authoritative for published objects; local tags or GSD files alone are insufficient proof.

## Key Decisions

<!-- Decisions that constrain future work. Add throughout project lifecycle. -->

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| v0.1.1 remote tag is preserved; only missing GitHub objects are recovered | The annotated tag already resolves to the correct signed merge commit, so replacing it would add risk without repairing publication | — Pending |
| Release and GitHub Milestone are both required for milestone closure | They serve different audiences: Release packages a version; Milestone records planning completion | — Pending |
| Future release-close automation is operator-invoked and idempotent | A destructive or duplicated remote mutation is worse than an explicit operator checkpoint; read-before-write makes retries safe | — Pending |
| Publication requires green required checks plus exact main/tag SHA agreement | A tag can exist while release is absent, and a red historical run can coexist with a green release commit; invariants must be evaluated for the target SHA, not by scan order | — Pending |
| Cloudflare Tunnel is the TLS termination (no Caddy); `COOKIE_SECURE` env var drives the cookie `Secure` flag | Internal Tunnel hops are plain HTTP but `Secure` is a browser-side attribute, so no proxy TLS needed; operators override via compose for non-HTTPS testing | — Phase 3 |
| Trust proxy + rate-limit land together atomically in Phase 8 (SEC-03) | Trust proxy must never split from rate-limit expansion, else client IPs are wrong when limits enforce | — Pending |
| Single-flight refresh lives on the shared axios instance only; the service module never imports router/store (bounce via `window.location.assign`) | Avoids an api ⇄ router ⇄ store ⇄ api import cycle; full reload also clears Pinia state on session death | — Phase 5 |
| Auth endpoints that legitimately 401 outside a session (`login`/`refresh`/`register`/`logout`) bypass the refresh path; `doBounce()` no-ops when already on `/login` | Failed login shows the credential error in place; logout with a dead session can't show a misleading "session expired" notice; bouncing from `/login` re-triggered itself forever because the reload resets the module flag | — Phase 5 |
| Requests draft persist is form-side (own snapshot slot) with enum allowlist restore | Interceptor only bounces, no cross-module hook; tampered slot can't inject an invalid type | — Phase 5 |

## Context Notes (Evolution History)

- 2026-09-23: Project initialized during brownfield onboarding after `/gsd-map-codebase` produced the complete codebase map.
- 2026-09-24: Phase 3 complete — production boots only with real secrets (SEC-02 gate), cookie/HTTPS works off localhost via `COOKIE_SECURE` + Tunnel (SEC-04), contract documented in `docs/16-contrato-deploy.md`.
- 2026-09-24: Phase 5 complete — silent single-flight session refresh (SES-01) verified 8/8, 9/9 manual-protocol checks PASS; bounce-loop and logout-path defects found during protocol fixed in-phase.
- 2026-09-25: Milestone v0.1.1 completed and archived. Release branch CI initially failed on fresh-DB setup (`DepartmentSettings.default` missing, Prisma P2025); `b50dc94` fixed setup via upsert, and target-SHA main/tag runs are green.
- 2026-09-25: v0.1.2 started to recover the missing GitHub Release/Milestone for v0.1.1 and add preflight, idempotency, readback, and documentation for future milestone closes.

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
*Last updated: 2026-09-25 after starting v0.1.2 GitHub Release Reliability*
