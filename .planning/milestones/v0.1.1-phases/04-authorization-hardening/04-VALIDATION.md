---
phase: "04"
slug: "authorization-hardening"
status: draft
nyquist_compliant: false
wave_0_complete: false
created: "2026-09-24"
---

# Phase 04 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest ^2.1.1 (repo-pinned; do NOT upgrade) |
| **Config file** | none — default include covers `tests/` |
| **Quick run command** | `cd backend && npx vitest run tests/authz` |
| **Full suite command** | `cd backend && npx vitest run` |
| **Estimated runtime** | ~15 seconds |

---

## Sampling Rate

- **After every task commit:** Run `cd backend && npx vitest run tests/authz`
- **After every plan wave:** Run `cd backend && npx vitest run`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 60 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 04-01 | 01 | 1 | SEC-01 | T-04-01 | Undeclared action → 403 fail-closed | unit | `cd backend && npx vitest run tests/authz/route-coverage.test.js` | ❌ W0 | ⬜ pending |
| 04-01 | 01 | 1 | SEC-01 | T-04-01 | Wrong role on visible route → 403 | supertest | `cd backend && npx vitest run tests/authz/matrix.test.js` | ❌ W0 | ⬜ pending |
| 04-02 | 02 | 2 | SEC-01 | T-04-02 | Cross-user draft getOne → 404; non-draft visible to PROF/ALUNO | supertest | `cd backend && npx vitest run tests/authz/matrix.test.js` | ❌ W0 | ⬜ pending |
| 04-02 | 02 | 2 | SEC-01 | T-04-02 | Cancel: owner RASCUNHO/EM_VOTACAO allow, cross-user deny, justification 400 | supertest | `cd backend && npx vitest run tests/authz/matrix.test.js` | ❌ W0 | ⬜ pending |
| 04-02 | 02 | 2 | SEC-01 | T-04-03 | Message remove: non-author non-leader → 403 | supertest | `cd backend && npx vitest run tests/authz/matrix.test.js` | ❌ W0 | ⬜ pending |
| 04-02 | 02 | 2 | SEC-01 | T-04-04 | listVotes follows view-scope, full detail when visible | supertest | `cd backend && npx vitest run tests/authz/matrix.test.js` | ❌ W0 | ⬜ pending |
| 04-02 | 02 | 2 | SEC-01 | T-04-04 | force-reset chefe→admin → 403 via canManageUsers | supertest | `cd backend && npx vitest run tests/authz/matrix.test.js` | ❌ W0 | ⬜ pending |
| 04-03 | 03 | 3 | SEC-01 | — | Full matrix green + ALLOW paths intact | supertest | `cd backend && npx vitest run` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `backend/tests/authz/helpers.js` — mock Prisma singleton (`vi.mock` of `src/config/db.js`), per-role JWT signer via `src/utils/tokens.js`, 5-role fixtures, draft/non-draft fixtures
- [ ] `backend/tests/authz/matrix.test.js` — allow+deny matrix, fixed routes × 5 roles
- [ ] `backend/tests/authz/route-coverage.test.js` — every route declares `requirePermission` (tag `fn._permissionAction`)
- [ ] No framework install needed (`supertest`, `vitest` already in devDependencies)

---

## Manual-Only Verifications

All phase behaviors have automated verification.

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 60s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
