---
phase: 05-session-refresh
plan: 01
subsystem: auth
tags: [axios, vue, session-refresh, single-flight, sessionStorage]

# Dependency graph
requires:
  - phase: 04-permission-map
    provides: 403 semantics the interceptor must not swallow (permission-map 403s passthrough untouched)
provides:
  - Single-flight 401 interceptor on the shared axios instance (silent refresh + retry-once + bounce-once)
  - Session-expired Login notice with validated return-to-origin
  - Best-effort Requests draft persist/restore via sessionStorage
affects: [05-02-manual-protocol, 05-03-regression-pass, phase-08-forced-password-change]

# Actuals (#2632) — pairs with the plan's `estimate` to calibrate future estimates.
# Same estimateTokens scale (chars/4 over the realized diff), never a harness token count.
actuals:
  tokens: 2284
  tasks: 3
  commits: 3
  plan_head_before: 02d1c8d4e24feff12cf47fd99c9180308fcb6fee

# Tech tracking
tech-stack:
  added: []
  patterns: [single-flight refresh promise, redirect-once flag, proactive form-side draft persist]

key-files:
  created: []
  modified: [frontend/src/services/api.js, frontend/src/views/Login.vue, frontend/src/views/Requests.vue]

key-decisions:
  - "Proactive form-side persist (not interceptor pull): Requests.vue writes its own snapshot on input/change; interceptor only bounces"
  - "Sync-flush watcher with suppress flag so mount-restore and submit-reset never re-persist the draft slot"
  - "Param reading at Login mount with history.replaceState cleanup; redirect validated internal-path-only with '/' fallback"

patterns-established:
  - "Single-flight refresh: module-level refreshPromise with ??= + finally null-reset; concurrent 401s await the same promise"
  - "Bounce-once: module-level isRedirecting flag set BEFORE window.location.assign; no router import in api.js (cycle avoidance)"
  - "Best-effort storage: every sessionStorage access in try/catch; malformed shape discards silently, form opens empty"

requirements-completed: [SES-01]

# Coverage metadata (#1602) — runtime behavior proof is owned by the 05-02 manual protocol.
coverage:
  - id: D1
    description: "Silent single-flight refresh: 401 with live refresh cookie retries invisibly, N parallel 401s trigger one POST /auth/refresh"
    requirement: "SES-01"
    verification:
      - kind: other
        ref: "cd frontend && npm run build"
        status: pass
    human_judgment: true
    rationale: "Build proves compile-safety only; single-flight runtime behavior requires the 05-02 manual protocol (network-tab evidence)"
  - id: D2
    description: "Dead-cookie bounce exactly once to /login?reason=session-expired&redirect=<origin> with locked notice and return-to-origin login"
    requirement: "SES-01"
    verification:
      - kind: other
        ref: "cd frontend && npm run build"
        status: pass
    human_judgment: true
    rationale: "Bounce-once and notice rendering require the 05-02 manual protocol (cookie deletion + navigation evidence)"
  - id: D3
    description: "Requests draft survives forced-logout bounce (persist on input, restore on mount, clear on submit, corrupt slot opens empty)"
    requirement: "SES-01"
    verification:
      - kind: other
        ref: "cd frontend && npm run build"
        status: pass
    human_judgment: true
    rationale: "Draft round-trip requires the 05-02 manual protocol (type, bounce, re-login, verify restore)"
  - id: D4
    description: "401-only gate with 403/429/5xx/network passthrough and no router import in api.js"
    requirement: "SES-01"
    verification:
      - kind: other
        ref: "grep status !== 401 + absent router import in frontend/src/services/api.js"
        status: pass
    human_judgment: false

# Metrics
duration: 3min
completed: 2026-09-24
status: complete
---

# Phase 05 Plan 01: Session Refresh Tracer Summary

**Single-flight axios 401 interceptor with exactly-once session-death bounce, locked Login expiry notice with validated return-to-origin, and best-effort Requests draft persist/restore**

## Performance

- **Duration:** 3min
- **Started:** 2026-09-24T19:47:12Z
- **Completed:** 2026-09-24T19:49:30Z
- **Tasks:** 3
- **Files modified:** 3

## Accomplishments

- Shared axios instance gains the single-flight 401 interceptor: one in-flight `POST /auth/refresh`, `_retry` replay-once, 401-only gate, refresh-call bypass, redirect-once flag set before `assign()` (T-05-01, T-05-02, T-05-06 mitigated)
- Login mounts `.alert.warn[role=status]` with the locked copy only on `?reason=session-expired`, stacked above `div.alert.error[role=alert]`; consumed query params cleaned via `history.replaceState`; `?redirect` validated internal-path-only with `/` fallback (T-05-03 mitigated)
- Requests form proactively persists `{type, title, justification, spec, valueCents}` to `sgrf:pending-draft` on input, restores on mount with unconditional clear, clears on successful submit, all storage in try/catch (T-05-04 mitigated, T-05-05 accepted)
- `cd frontend && npm run build` green after every task commit; zero new files, zero backend edits, zero new dependencies

## Task Commits

Each task was committed atomically:

1. **Task 1: Tracer: single-flight 401 interceptor end-to-end, one path only** - `a8b2b1b` (feat)
2. **Task 2: Login notice hardening: stacking, persistence, cleanup, redirect validation** - `b26cb4a` (feat)
3. **Task 3: Requests draft lifecycle: proactive persist, restore, cleanup** - `3bb4bed` (feat)

## Files Created/Modified

- `frontend/src/services/api.js` - Single-flight 401 interceptor: shared refresh promise, retry-once replay, bounce-once via `window.location.assign`, no router import
- `frontend/src/views/Login.vue` - Session-expired notice, mount-time `?reason`/`?redirect` handling, `replaceState` cleanup, `isInternalPath` validator, validated post-login push
- `frontend/src/views/Requests.vue` - Draft snapshot persist (sync-flush watcher + suppress flag), mount restore with shape validation, clear on submit

## Decisions Made

- Proactive form-side persist chosen over interceptor pull (RESEARCH recommendation): interceptor cannot import view state, so Requests.vue writes its own snapshot and the interceptor only bounces — no cross-module hook.
- Sync-flush watcher with `suppressPersist` flag: Vue's default pre-flush watchers run async, so synchronous flag resets would not suppress re-persist after mount-restore/submit-reset; `flush: 'sync'` makes suppression exact.
- Param reading at Login mount (not setup top-level) with `history.replaceState` cleanup: URL is clean after the notice mounts, so a later refresh hides the notice while the in-memory ref preserves the redirect until login succeeds.
- `isInternalPath` validator per D-04: single leading `/`, reject `//` prefix, reject `scheme:` patterns → discard to `/` fallback (open-redirect protection).

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

- Watcher re-persist after programmatic resets: restoring the draft on mount (and resetting the form on submit) fires the persist watcher, which would rewrite the slot just cleared. Solved with `flush: 'sync'` + `suppressPersist` flag so only genuine user input writes — verified by code reasoning (behavioral proof belongs to the 05-02 manual protocol).

## Known Stubs

None - no stub patterns in created/modified files (no empty values flowing to UI, no placeholder text, no unwired components).

## Threat Flags

None - all new surface (bounce URL `?redirect`, draft slot, shared refresh promise) is covered by the plan threat model T-05-01…T-05-06 with mitigations implemented as specified.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- 05-01 implementation complete; ready for 05-02 manual protocol (silent refresh, single-flight under concurrency, bounce-once, notice, return-to-origin, draft restore) and 05-03 regression pass (no per-view 401 handling — verified absent via grep this plan).
- No blockers. Note for 05-02: behavioral proof (network-tab single refresh, exactly-one navigation) is explicitly out of scope for this plan's build-gate verification.

## Self-Check: PASSED

- FOUND: frontend/src/services/api.js
- FOUND: frontend/src/views/Login.vue
- FOUND: frontend/src/views/Requests.vue
- FOUND: commits a8b2b1b, b26cb4a, 3bb4bed (`git log` verified)
- Build green after every task commit

---
*Phase: 05-session-refresh*
*Completed: 2026-09-24*
