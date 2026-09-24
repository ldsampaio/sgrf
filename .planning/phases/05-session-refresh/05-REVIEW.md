---
phase: 05-session-refresh
reviewed: 2026-09-24T20:47:45Z
depth: standard
files_reviewed: 5
files_reviewed_list:
  - frontend/src/services/api.js
  - frontend/src/views/Login.vue
  - frontend/src/views/Requests.vue
  - frontend/src/stores/auth.js
  - frontend/src/router/index.js
findings:
  critical: 0
  warning: 1
  info: 4
  total: 5
status: issues_found
---

# Phase 05: Code Review Report (re-review — fix verification)

**Reviewed:** 2026-09-24T20:47:45Z
**Depth:** standard
**Files Reviewed:** 5
**Status:** issues_found

## Summary

Re-reviewed the phase scope on top of the 2026-09-24T20:00:00Z review: verified
each of WR-01/WR-02/WR-03 actually landed (commits `7adc567`, `dda9127`), plus
the new post-review fix `56526f2` (doBounce early-return on `/login` + hardened
safeOrigin). All three prior findings are **fixed in code**, and the `56526f2`
bounce-loop analysis holds — the full-reload self-bounce cycle is closed
(`me()` swallows its own 401 internally at `stores/auth.js:8-9`, the login view
makes no authed calls, and `doBounce()` now no-ops on `/login` without poisoning
`isRedirecting`).

One new WARNING below: the voluntary-logout path (`POST /auth/logout` →
`AppShell.vue:45`) still enters the refresh/bounce machinery when the session is
already dead, producing a spurious refresh plus a misleading "session expired"
notice on what was a deliberate logout. No security holes introduced or found:
401-strict gate intact, 403/429/5xx/network passthrough intact, no open redirect
(validator + `startsWith('/login')` fallback to `/` can only narrow the target),
no token/cookie logging, no router/store import in `api.js` (no cycle).

## Fix verification (prior review)

- **WR-01 FIXED** — `frontend/src/services/api.js:40`: bypass widened to
  `/\/auth\/(login|refresh|register)/`, applied per the suggested snippet.
  Failed-login 401s reject straight to the `Login.vue:58` credential alert.
- **WR-02 FIXED + hardened** — `frontend/src/services/api.js:24,27`:
  `doBounce()` early-returns on `pathname === '/login'` (commit `56526f2`,
  supersedes the `safeOrigin`-only version from `7adc567`) and the residual
  `safeOrigin` fallback now uses `startsWith('/login') → '/'`.
- **WR-03 FIXED** — `frontend/src/views/Requests.vue:71-72`: `TYPES` allowlist
  restore applied per the suggested snippet; shape checks, unconditional
  clear-on-mount, try/catch lifecycle, and `suppressPersist` untouched.

## Warnings

### WR-04: Voluntary logout with a dead session enters the refresh/bounce path

**File:** `frontend/src/stores/auth.js:15` via `frontend/src/components/AppShell.vue:45`
**Issue:** The interceptor bypass (`api.js:40`) covers `login|refresh|register`
but not `/auth/logout`. If the 7-day cookie is already dead when the user clicks
"sair", `POST /auth/logout` 401s → fires a spurious `POST /auth/refresh` →
refresh fails → `doBounce()` full-reloads to
`/login?reason=session-expired&redirect=...`, showing a "session expired" notice
for what was a deliberate logout, and `this.user = null` never executes (masked
only because the reload clears Pinia state). Additionally `AppShell logout()`
has no try/catch, so any rejection that does *not* navigate (e.g. a future
non-reload bounce, or the early-return path if logout is ever reachable from
`/login`) surfaces as an unhandled promise rejection.
**Fix (APPLIED post-review):** `stores/auth.js` logout is now best-effort
(`try/catch` + `finally { this.user = null; }`) and `/auth/logout` added to the
`api.js:40` bypass regex — a 401 there means "no session", which is the desired
end state of logout anyway.
```js
// stores/auth.js — logout must be best-effort: clear state and land on /login
// regardless of what the dead session answers.
async logout() {
  try { await api.post('/auth/logout'); } catch { /* best-effort */ }
  finally { this.user = null; }
}
```

## Info

### IN-01 (residual): Bypass regex is still an unanchored substring match

**File:** `frontend/src/services/api.js:40`
**Issue:** `/\/auth\/(login|refresh|register|logout)/.test(config.url)` also matches a
URL that merely *contains* that substring (e.g. a query param value), silently
skipping refresh for it. Strictly tighter than the old
`includes('/auth/refresh')`, harmless today — noted so a future `_skipRefresh`
flag migration (suggested in the original WR-01) still has a reason.
**Fix:** Match on path suffix, e.g.
`new URL(config.url, window.location.origin).pathname === '/api/auth/refresh'`
per endpoint, or adopt the `_skipRefresh` request flag.

### IN-02 (residual, pre-existing): Unhandled rejections in `load()` / `submit()`

**File:** `frontend/src/views/Requests.vue:81,97`
**Issue:** Unchanged by this phase. A session-death during `submit()` rejects
into a caller with no try/catch (unhandled rejection; the bounce still lands the
user on `/login`). Flagging for awareness only — out of this phase's scope.
**Fix:** Wrap `submit()` (and event-handler-called `load()`) in try/catch
surfacing to `err`.

### IN-03 (carried, by design): `isRedirecting` never resets within a tab lifetime

**File:** `frontend/src/services/api.js:14,25`
**Issue:** Only cleared by the full-reload bounce. `56526f2` correctly does NOT
set it on the `/login` early-return path, so the flag cannot be poisoned by a
suppressed bounce. Acceptable as designed — recorded so a future non-reload
navigation change remembers to reset it.
**Fix:** None (design note).

### IN-04: `safeOrigin` hardening is partially redundant and over-broad

**File:** `frontend/src/services/api.js:26-27`
**Issue:** After the `56526f2` early return (line 24), the exact-`/login` case
never reaches line 27, so `startsWith('/login')` only matters for hypothetical
`/login/...` subpaths — of which the router defines none (`router/index.js:14`
is the sole `/login` route; `pathname` never contains the query string).
Harmless defense-in-depth; also maps any future `/loginXYZ` path to `/`.
**Fix:** None required; if touched, prefer the exact
`pathname === '/login' ? '/' : origin` form to match the (single) real route.

---

_Checked and clean (no finding):_ 401-strict gate (`response?.status !== 401`,
`api.js:37`) with 403/429/5xx/network passthrough intact (Phase 8 SES-02 path
untouched); `_retry` set only after the bypass so login 401s are never marked;
`??=` single-flight with `finally` reset intact; replayed request rejects
straight through via `_retry`; `?redirect` validator rejects `//` and `scheme:`
and `router.push` cannot leave the origin (history mode,
`router/index.js:11-12`); zero `console.*`/token logging in all five files;
draft slot read-and-cleared unconditionally on mount with corrupt-shape fallback
to empty form; no router/store import in `api.js` (no cycle).

_Reviewed: 2026-09-24T20:47:45Z_
_Reviewer: the agent (gsd-code-reviewer)_
_Depth: standard_
