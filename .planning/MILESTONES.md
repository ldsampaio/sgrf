# Milestones

## v0.1.1 v0.1.1 (Shipped: 2026-09-25)

**Phases completed:** 8 phases, 29 plans, 32 tasks

**Key accomplishments:**

- Two-job GitHub Actions regression gate (backend vitest + frontend build) landed on main and green in CI
- Deliberate one-assertion break turned the backend check red (run 35913880897), then git revert restored green (run 35914010303) — the CI gate is proven non-vacuous
- Branch protection enforced on main (backend + frontend required, strict false, admins enforced) and CI recorded as the regression gate in AGENTS.md — landed via PR #1 after the gate itself declined the direct push
- RN-009 arbitration contract (PARCIAL → AGUARDANDO_ARBITRAGEM, chefe arbitrates any value in (0, requestedAmountCents]) plus closed docs/14 partial row — ready for Phase 6 plan 06-03
- RN-010 cancellation-after-approval contract (D-05..D-08) in docs/03 plus the docs/14 cancellation row closed with date 2026-09-23 — Phase 6 plan 06-04 consumes it directly
- RN-011 (no quorum, tally decides), RN-012 (1 vista per conselheiro, stacking extensions), RN-013 (extraordinary meeting via SUSPENSO_REUNIAO_ORDINARIA, admin/chefe-only entry) plus OVERRIDDEN/REJECTED docs/14 closings — landed via PR #7 with backend plus frontend CI green
- Deny-by-default PERMISSIONS map + requirePermission middleware, shared draft-visibility helper, all five route files wired, mock-Prisma supertest skeleton green (13 authz tests), docs/06 ALUNO override recorded
- RN-010 cancel matrix with audited justification and Phase 6 REVERSE seam, message remove author-or-leader guard, listVotes/reports view-scope, shared scopeWhere everywhere, force-reset chefe→admin block — full suite 45/45 green
- Full supertest allow+deny matrix (cancel RN-010, message remove, list/listVotes scoping, transactions, force-reset, reports voting across all 5 roles) plus router-stack coverage test with negative control — full suite 85/85 green, zero CI change
- Single-flight axios 401 interceptor with exactly-once session-death bounce, locked Login expiry notice with validated return-to-origin, and best-effort Requests draft persist/restore
- SES-01 proven in a live browser: single-flight silent refresh, bounce-once with locked notice, validated return-to-origin with draft restore — all 11 checks PASS, TTL rig reverted, build green
- Read-only regression evidence for SES-01: interceptor lives ONLY on the shared axios instance, no per-view 401 handling, service module navigation-free, 401-strict gate with 403 passthrough intact, build green, zero new dependencies, zero phase-introduced backend diff — no defects against 05-01.
- Widened interceptor auth bypass (login 401s reject to Login.vue), same-page bounce guard (redirect=/), and draft type allowlist — build green, all structural greps resolve
- Added CONCLUIDO to annualTotalCents statuses array to prevent annual cap bypass via mark-spent cycling, with characterization-then-flip tests proving the fix.
- Implemented VOT-04 cancellation-after-approval per RN-010: cancelling an approved/provisioned request requires ADMINISTRADOR/CHEFE_DEPARTAMENTO + mandatory justification, writes audited compensating REVERSE financial transaction that restores FundBalance, with full audit trail in both FinancialTransaction.metadata and AuditEvent.afterData.

---
