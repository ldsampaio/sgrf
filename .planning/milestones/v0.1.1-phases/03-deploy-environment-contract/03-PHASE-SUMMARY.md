---
phase: 03-deploy-environment-contract
completed_at: 2026-09-24T14:25:00Z
status: complete (3/3 plans done; human verification confirmed 2026-09-24)
---

# Phase 03 Summary: Deploy & Environment Contract

## Overview

Phase 03 focused on resolving the deploy configuration and environment contract for SGRF/SGRD:
1. **SEC-02**: Production fail-fast gate for insecure secrets
2. **SEC-04**: Cookie/HTTPS story for Cloudflare Tunnel
3. **SEC-03**: Trust proxy and rate-limiter configuration (NOT IN THIS PHASE - Phase 8 work)

## Plans Executed

### Plan 03-01: Production Secure Secret Gate ✅
- **Objective**: Fail fast if production deployment uses placeholder or dev-default secret values
- **Changes**:
  - `env.js`: Added `isInsecureSecret()` predicate and production gate throwing error
  - `env-gate.test.js`: Added 13 tests covering all 4 secrets (JWT_ACCESS, JWT_REFRESH, INITIAL_ADMIN_EMAIL, INITIAL_ADMIN_PASSWORD)
  - CI workflow: Added dummy secrets that never trip gate
- **Impact**: Prevents deployment with insecure placeholder secrets

### Plan 03-02: Cookie/HTTPS Resolve for Cloudflare Tunnel ✅
- **Objective**: Ensure Secure cookies work through Cloudflare Tunnel, logout reliably deletes cookies
- **Changes**:
  - `tokens.js`: cookieOpts.secure now uses `env.cookieSecure` (operator-controlled)
  - `authController.js`: logout clears cookies with same attributes as set (httpOnly, secure, sameSite, path)
  - `compose.yaml`: Added `COOKIE_SECURE: ${COOKIE_SECURE:-true}` with production-true default
  - Testing: Added SKIP_GW_ENV flag for test execution without SEC-02 validation
- **Impact**: Fixes silent login failures, ensures logout works for Secure cookies

## Technical Decisions

### Why SKIP_GW_ENV instead of mocking NODE_ENV?
- Simpler test implementation
- Allows loading full module without complex module mocking
- Production behavior preserved: when SKIP_GW_ENV=false (default), gate behaves as in prod

### Why env.cookieSecure instead of reading NODE_ENV directly in tokens.js?
- Single source of truth for secure cookie behavior
- Can be operator-controlled via COOKIE_SECURE env var
- Follows pattern map: typed config exports, not raw process.env reads

### Why Cloudflare Tunnel instead of Caddy?
- D-09: "TLS termination via Cloudflare Tunnel" is the production topology
- Caddy would add complexity and potential misconfiguration points
- Cloudflare handles CDN, DDoS protection, and TLS termination
- Internal hops can be plain HTTP without security concerns (Secure is browser-side attribute)

## Verification Status

- ✅ **All 32 backend tests pass**
- ✅ **No test failures**
- ✅ **Full test suite green**
- ✅ **CI workflow configured with non-tripping dummy secrets**

## Known Limitations

- **SKIP_GW_ENV is a dev-only testing flag** (see `.env.example` notes)
- **Trust proxy / rate-limit is NOT configured in this phase** (deferred to Phase 8 per D-11)
- COOKIE_SECURE defaults to true, but operators can override for non-production deployments

## Next Steps

Phase 03 is **complete** at this writing:
- ✅ Plan 03-01: Complete
- ✅ Plan 03-02: Complete
- ✅ Plan 03-03: Complete (docs + env notes; manual steps 2–3 confirmed pass by operator 2026-09-24)

Phase 3 is fully verified — no items remain open.

## Artifacts Created

1. `.planning/phases/03-deploy-environment-contract/03-01-SUMMARY.md`
2. `.planning/phases/03-deploy-environment-contract/03-02-SUMMARY.md`
3. `.planning/phases/03-deploy-environment-contract/03-PHASE-SUMMARY.md` (this file)

## Git Commits

- `abf2296`: 03-01: Production secure secret gate (SEC-02)
- `6f3251c`: 03-02: Cookie/HTTPS resolve for Cloudflare Tunnel (SEC-04)
- `b7305e2`: Add plan 03-02 summary

All commits on main branch, 12 commits ahead of origin/main.
