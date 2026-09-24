---
phase: 05-session-refresh
plan: 04
subsystem: auth
tags: [axios, interceptor, session-refresh, draft-restore, vue]

# Dependency graph
requires:
  - phase: 05-session-refresh
    provides: 05-01 single-flight 401 interceptor + draft lifecycle; 05-REVIEW.md WR-01/WR-02/WR-03 fix snippets
provides:
  - WR-01 widened auth-endpoint bypass so failed logins reject straight to Login.vue
  - WR-02 same-page bounce guard so /login 401s bounce with redirect=/
  - WR-03 draft type allowlist so tampered slots keep the form default
affects: [05-02 manual protocol, session-refresh verification]

# Actuals (#2632) — pairs with the plan's `estimate` to calibrate future estimates.
actuals:
  tokens: 523
  tasks: 2
  commits: 2

# Tech tracking
tech-stack:
  added: []
  patterns: [regex auth-endpoint bypass in axios interceptor, same-page bounce guard, enum allowlist on draft restore]

key-files:
  created: []
  modified: [frontend/src/services/api.js, frontend/src/views/Requests.vue]

key-decisions:
  - "Regex bypass over _skipRefresh flag: single-file change, keeps stores/auth.js untouched"
  - "WR-01/WR-02/WR-03 applied verbatim in spirit from 05-REVIEW.md; no backend, no new deps"

patterns-established:
  - "Auth-endpoint bypass: 401s from /auth/(login|refresh|register) reject straight to the caller, never enter refresh"
  - "Bounce origin guard: pathname==='/login' falls back to '/' before assign()"

requirements-completed: [SES-01]

# Coverage metadata (#1602)
coverage:
  - id: D1
    description: "Failed login 401 rejects straight to Login.vue error alert with no POST /auth/refresh and no self-bounce"
    requirement: "SES-01"
    verification:
      - kind: other
        ref: "cd frontend && npm run build (green) + grep -n 'login|refresh' frontend/src/services/api.js → line 33 regex bypass"
        status: pass
    human_judgment: true
    rationale: "Build + structural grep prove the bypass exists, but the no-refresh-fired / no-bounce behavior is observable only in a live browser; owned by the 05-02 manual protocol"
  - id: D2
    description: "401 raised while on /login bounces with redirect=/ instead of a nested /login redirect"
    requirement: "SES-01"
    verification:
      - kind: other
        ref: "grep -n \"pathname === '/login'\" frontend/src/services/api.js → line 20 safeOrigin guard"
        status: pass
    human_judgment: true
    rationale: "Structural grep proves the guard exists, but bounce-target behavior needs a live session-death on /login; owned by the 05-02 manual protocol"
  - id: D3
    description: "Tampered draft {type:FOO} restores all other fields but leaves type at the form default"
    requirement: "SES-01"
    verification:
      - kind: other
        ref: "grep -n 'TYPES' frontend/src/views/Requests.vue → lines 71-72 allowlist restore"
        status: pass
    human_judgment: true
    rationale: "Structural grep proves the allowlist exists, but restore behavior needs a live tampered-slot round-trip; owned by the 05-02 manual protocol"

# Metrics
duration: 8min
completed: 2026-09-24
status: complete
---

# Phase 05 Plan 04: Close VERIFICATION Gaps Summary

**Widened interceptor auth bypass (login 401s reject to Login.vue), same-page bounce guard (redirect=/), and draft type allowlist — build green, all structural greps resolve**

## Performance

- **Duration:** ~8 min
- **Started:** 2026-09-24T20:30:00Z
- **Completed:** 2026-09-24T20:38:00Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments

- WR-01 (blocking): `POST /auth/login` 401s now reject straight to the Login.vue credential alert — no spurious `POST /auth/refresh`, no self-bounce wiping the form
- WR-02 (warning): `doBounce()` from `/login` itself falls back to `redirect=/`, never nests a stale `/login` redirect
- WR-03 (warning): `restoreDraft()` allowlist-checks `type` against the four valid enum options; `{type:"FOO"}` keeps the current form default
- 401-strict gate, `_retry` guard, `??=` single-flight, `_retry` replay, and no-router-import rule all untouched; zero backend diff, zero manifest diff

## Task Commits

Each task was committed atomically:

1. **Task 1: WR-01 + WR-02: widen interceptor bypass, add same-page bounce guard** - `7adc567` (fix)
2. **Task 2: WR-03: allowlist-check restored draft type, close out with structural proof** - `dda9127` (fix)

## Files Created/Modified

- `frontend/src/services/api.js` - WR-01 regex bypass `/\/auth\/(login|refresh|register)/` (line 33); WR-02 `safeOrigin` same-page guard (line 20), `isRedirecting` still set before `assign()`
- `frontend/src/views/Requests.vue` - WR-03 `TYPES` allowlist + guarded restore (lines 71-72); shape checks, unconditional clear-on-mount, try/catch, `suppressPersist` untouched

## Decisions Made

- Regex bypass over the `_skipRefresh` flag alternative: achieves WR-01 in a single-file change and keeps `stores/auth.js` untouched (plan authorized either; regex chosen for minimal blast radius). Also tightens the old over-broad `includes('/auth/refresh')` substring match (IN-01) as a side effect.
- No other decisions — fixes applied verbatim in spirit from 05-REVIEW.md snippets.

## Structural Proof (observed outputs)

Build green after each task (`cd frontend && npm run build`, 106 modules, ✓ built in ~570ms):

- `grep -n "login|refresh" frontend/src/services/api.js` → `33: if (typeof config.url === 'string' && /\/auth\/(login|refresh|register)/.test(config.url)) throw error;`
- `grep -n "pathname === '/login'" frontend/src/services/api.js` → `20: const safeOrigin = window.location.pathname === '/login' ? '/' : origin;`
- `grep -n "TYPES" frontend/src/views/Requests.vue` → `71: const TYPES = [...]` + `72: form.value.type = TYPES.includes(d.type) ? d.type : form.value.type;`
- `grep -n "response?.status !== 401" frontend/src/services/api.js` → `30: if (response?.status !== 401 || !config || config._retry) throw error;` (401-strict gate intact)
- 05-03 regression greps: `??=` single-flight at line 36 ✓; zero per-view 401 handling in `src/views/` ✓; no router import in service (only the never-import-router comment) ✓
- Scope: `git status` shows only the two frontend files changed by this plan — no backend diff, no `package.json`/`package-lock.json` diff (frontend manifest untouched; `backend/package-lock.json` was already modified before this plan started, not by it)

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None. Both builds passed first try; no stub patterns introduced (no empty values, no TODO/placeholder text — the allowlist fallback reuses the live form default by design).

## Threat Flags

None beyond the plan's threat model — no new network endpoints, auth paths, file access, or schema changes. Threat dispositions updated by this plan: T-05-02 (bypass widened narrowly + same-page guard), T-05-03 (validator now receives clean origin), T-05-05 upgraded accept→mitigate (type allowlist), T-05-06 re-confirmed (strict 401 gate intact); T-05-01 untouched and preserved.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- 05-02 manual protocol (the phase DoD) is unblocked and next in line: WR-01/WR-02 polluted exactly the bounce paths it observes, now fixed
- Behavioral proof (SC1–SC3, notice, return-to-origin, draft round-trip) explicitly owned by 05-02 — this plan did NOT re-run it; phase re-verifies after 05-02 executes

---
*Phase: 05-session-refresh*
*Completed: 2026-09-24*
