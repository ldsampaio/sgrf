---
phase: 08-reports-audit-auth-polish
plan: 03
subsystem: auth
tags: [SEC-03, rate-limit, trust-proxy, uniform-401]
dependencies:
  requires:
    - 08-01
  provides: [auth-hardening, trust-proxy]
  affects: [app.js, routes/auth.routes.js, controllers/authController.js]
tech_stack:
  added: []
  patterns: [per-route-limiter, trust-proxy-1, uniform-401, 423-distinct]
key_files:
  created: []
  modified:
    - backend/src/app.js
    - backend/src/routes/auth.routes.js
    - backend/src/controllers/authController.js
decisions:
  - "app.set('trust proxy', 1) for Cloudflare Tunnel single-hop — never bare true"
  - "Per-route limiters: login 20, refresh 60, forgot 5, change 20 per 15m, memory store"
  - "Login uniform 401 for no-user/inactive/bad-pwd, keep 423 distinct for locked"
metrics:
  duration_minutes: 12
  completed_date: "2026-09-25"
  tasks_completed: 3
  files_modified: 3
  tests_added: 7
  total_tests: 143
status: complete
actuals:
  tokens: 22000
  tasks: 3
  commits: 1
  plan_head_before: 08-02
---

# Phase 08 Plan 03: Auth Hardening Summary

## One-liner
Set trust proxy 1, added per-route rate limiters for all auth mutations, and made login uniform 401 while preserving distinct 423 lockout.

## Changes Made
- app.js: app.set('trust proxy', 1) before helmet
- auth.routes.js: loginLimiter 20, refreshLimiter 60, forgotLimiter 5, changeLimiter 20 per 15m, standardHeaders true
- authController.js: inactive 403 → 401 uniform (same message Credenciais inválidas), locked remains 423

## Verification Results
| Task | Verification Command | Result |
|------|---------------------|--------|
| Task 1 | npx vitest run auth.rate-limit.test.js -t SEC-03 | ✅ 7/7 |
| Task 2 | node -e app.get trust proxy 1 | ✅ 1 |
| Task 3 | npx vitest run | ✅ 143 tests |

## Self-Check
- ✅ Trust proxy 1 not true
- ✅ Per-route limits wired
- ✅ Uniform 401 + 423 distinct
