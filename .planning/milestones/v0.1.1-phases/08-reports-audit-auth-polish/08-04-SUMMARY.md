---
phase: 08-reports-audit-auth-polish
plan: 04
subsystem: auth
tags: [SES-02, mustChangePassword, router-guard]
dependencies:
  requires:
    - 08-01
  provides: [mustChangePassword-enforced]
  affects: [middlewares/auth.js, router/index.js, views/ChangePassword.vue]
tech_stack:
  added: []
  patterns: [403-allowlist, router-beforeEach, ChangePassword-view, temp-password-loop]
key_files:
  created:
    - frontend/src/views/ChangePassword.vue
  modified:
    - backend/src/middlewares/auth.js
    - frontend/src/router/index.js
decisions:
  - "authJwt 403 allowlist: /api/auth/change-password, /api/auth/me, /api/auth/refresh, /api/auth/logout — else 403 Troca de senha obrigatória"
  - "Router beforeEach: if mustChangePassword && to.path !== /change-password && !== /login → return /change-password"
  - "ChangePassword.vue minimal form (current + new 8 chars, POST change-password, auth.me() refresh, redirect /)"
metrics:
  duration_minutes: 14
  completed_date: "2026-09-25"
  tasks_completed: 3
  files_modified: 3
  tests_added: 7
  total_tests: 150
status: complete
actuals:
  tokens: 28000
  tasks: 3
  commits: 1
  plan_head_before: 08-03
---

# Phase 08 Plan 04: mustChangePassword Enforcement Summary

## One-liner
Enforced mustChangePassword end-to-end: backend 403 allowlist in authJwt + frontend router guard → /change-password (new view), with temp-password loop proven.

## Changes Made
- middlewares/auth.js: after ATIVO check, if mustChangePassword and url not in allowlist → 403
- router/index.js: added import ChangePassword, route /change-password, beforeEach redirect if mustChangePassword and not on allowlisted path
- views/ChangePassword.vue: new 440px card, current + new inputs, :disabled loading, alert error, on success auth.me() + push /

## Verification Results
| Task | Verification Command | Result |
|------|---------------------|--------|
| Task 1 | npx vitest run auth.mustChangePassword.test.js -t SES-02 | ✅ 7/7 |
| Task 2 | npx vitest run | ✅ 150 tests |
| Task 3 | npm run build frontend | ✅ pass |

## Self-Check
- ✅ 403 on non-allowlisted API
- ✅ Allowlisted routes 200
- ✅ After change, full access restored
- ✅ Frontend redirect + view + build pass
