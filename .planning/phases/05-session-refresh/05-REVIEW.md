---
phase: 05-session-refresh
reviewed: 2026-09-24T20:00:00Z
depth: standard
files_reviewed: 3
files_reviewed_list:
  - frontend/src/services/api.js
  - frontend/src/views/Login.vue
  - frontend/src/views/Requests.vue
findings:
  critical: 0
  warning: 3
  info: 3
  total: 6
status: issues-found
---

# Phase 05: Code Review Report

**Reviewed:** 2026-09-24T20:00:00Z
**Depth:** standard
**Files Reviewed:** 3
**Status:** issues-found

## Summary

Reviewed the 05-01 tracer diff (commits `a8b2b1b`, `b26cb4a`, `3bb4bed`) plus the
05-01/05-03 SUMMARYs and PLANs. The single-flight mechanism, bounce-once flag
ordering, 401-strict gate with 403 passthrough (Phase 8 SES-02 safe), open-redirect
validator, and draft try/catch + unconditional-clear lifecycle are all sound, and
the sync-flush `suppressPersist` flag is reset-safe (`finally` guarantees reset on
every path, including the early `return` when the slot is empty).

One real logic bug found: **failed logins (`POST /auth/login` → 401
'Credenciais inválidas', confirmed in `backend/src/controllers/authController.js:16,30`)
flow through the shared `api` instance (`frontend/src/stores/auth.js:12`) and enter
the refresh/bounce path**, because the only interceptor bypass is `/auth/refresh`.
For a logged-out user with no live refresh cookie this ends in a full-page bounce
of the login page onto itself with a misleading "session expired" notice and wiped
input. Two further low-severity warnings (same-page bounce nesting, unvalidated
draft `type` restore) and three info notes below. No security holes: no token/cookie
logging, no open redirect (validator + same-origin `router.push`), 403/429/5xx/network
passthrough intact.

## Warnings

### WR-01: Failed-login 401 enters the refresh/bounce path

**File:** `frontend/src/services/api.js:29-31`
**Issue:** The interceptor bypasses only `/auth/refresh`, but `auth.login` uses the
same shared instance (`frontend/src/stores/auth.js:12`) and the backend answers bad
credentials with 401 (`backend/src/controllers/authController.js:16,30`). So every
wrong-password submit fires a spurious `POST /auth/refresh`, and when the refresh
cookie is dead/absent (the normal logged-out state) `doBounce()` full-reloads the
login page onto `/login?reason=session-expired&redirect=%2Flogin` — wiping the typed
email/password and showing a "session expired" notice for what was a credential error.
The credential error alert (`Login.vue:58`) never gets its chance in this path.
**Fix:**
```js
// Bypass auth endpoints that legitimately 401 outside a session (login, not just refresh)
if (typeof config.url === 'string' && /\/auth\/(login|refresh|register)/.test(config.url)) throw error;
```
Alternatively mark the login call `{ _skipRefresh: true }` and gate on it, keeping the
bypass list out of URL substring matching.

### WR-02: Bounce has no same-page guard, nesting `redirect` on the login page

**File:** `frontend/src/services/api.js:16-21`
**Issue:** `doBounce()` unconditionally appends `pathname + search` as `redirect`. Any
401 raised while already on `/login` (WR-01 is one trigger; any future login-page
request is another) produces `/login?reason=session-expired&redirect=/login%3F...`,
and `isInternalPath` legitimately accepts that nested value — so post-login
`router.push` lands back on a login URL carrying stale params instead of `/`.
**Fix:**
```js
function doBounce() {
  if (isRedirecting) return;
  isRedirecting = true;
  const origin = window.location.pathname + window.location.search;
  const safeOrigin = window.location.pathname === '/login' ? '/' : origin;
  window.location.assign('/login?reason=session-expired&redirect=' + encodeURIComponent(safeOrigin));
}
```

### WR-03: Draft restore accepts an arbitrary `type` string into the enum select

**File:** `frontend/src/views/Requests.vue:71`
**Issue:** `title`/`justification`/`spec`/`valueCents` are shape-checked, but `type` is
restored from any string. A tampered slot (or a value written by a future form version)
e.g. `{"type":"FOO","title":"x"}` leaves the `<select>` with no matching option
(blank control) and the next submit posts an invalid `type` to the backend.
**Fix:**
```js
const TYPES = ['EQUIPAMENTO', 'PUBLICACAO', 'VIAGEM', 'AUXILIO_ESTUDANTIL'];
if (d && typeof d.title === 'string') {
  form.value.type = TYPES.includes(d.type) ? d.type : form.value.type;
  ...
}
```

## Info

### IN-01: Refresh bypass uses over-broad substring match

**File:** `frontend/src/services/api.js:31`
**Issue:** `config.url.includes('/auth/refresh')` also matches unrelated URLs that merely
contain that substring (e.g. a query param), silently skipping refresh for them. Harmless
today, brittle as a convention.
**Fix:** Match on path suffix instead, e.g. `new URL(config.url, window.location.origin).pathname === '/api/auth/refresh'`
(or combine with the `_skipRefresh` flag suggested in WR-01).

### IN-02: Pre-existing unhandled rejections in `load()` / `submit()` (not introduced here)

**File:** `frontend/src/views/Requests.vue:80,96`
**Issue:** `load()` and `submit(id)` have no try/catch (pre-existing lines, untouched by
this phase). Now that the interceptor rethrows original 401s plus replay errors into
these callers, a session-death during `submit()` surfaces as an unhandled promise
rejection. Flagging for awareness only — out of this phase's scope.
**Fix:** Wrap `submit()` (and `load()` when called from event handlers) in try/catch
surfacing to `err`.

### IN-03: `isRedirecting` never resets within a tab lifetime (by design, noted)

**File:** `frontend/src/services/api.js:14-18`
**Issue:** The flag is only cleared by the full-reload bounce. If `assign()` were ever
stubbed, blocked, or run in an environment without navigation, all subsequent session
deaths in that tab would skip the bounce (views still get the thrown error, so no silent
data loss). Acceptable as designed — recorded so a future non-reload navigation change
remembers to reset it.

---

_Checked and clean (no finding):_ `?redirect` validation rejects `//` and `scheme:` and
`router.push` cannot leave the origin (history mode confirmed in
`frontend/src/router/index.js`) — no open redirect; zero `console.*`/token logging in
all three files (T-05-04 holds); 403/429/5xx/network passthrough intact (T-05-06 holds,
Phase 8 SES-02 path untouched); draft slot read-and-cleared unconditionally on mount
with corrupt-shape fallback to empty form (T-05-05 holds); no router/store import in
`api.js` (no cycle).

_Reviewed: 2026-09-24T20:00:00Z_
_Reviewer: the agent (gsd-code-reviewer)_
_Depth: standard_
