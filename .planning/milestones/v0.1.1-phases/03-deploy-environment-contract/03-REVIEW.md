---
phase: 03-deploy-environment-contract
reviewed: 2026-09-24T12:00:00Z
depth: deep
files_reviewed: 7
files_reviewed_list:
  - backend/src/config/env.js
  - backend/src/utils/tokens.js
  - backend/src/controllers/authController.js
  - compose.yaml
  - backend/.env.example
  - backend/tests/env-gate.test.js
  - docs/16-contrato-deploy.md
  - .github/workflows/ci.yml
findings:
  critical: 0
  warning: 5
  info: 3
  total: 8
status: issues
---

# Phase 03: Code Review Report

**Reviewed:** 2026-09-24T12:00:00Z
**Depth:** deep
**Files Reviewed:** 7 (+1 docs file read for contract consistency)
**Status:** issues

## Summary

Reviewed the Phase 03 deploy/environment contract (SEC-02 production gate + SEC-04 cookie Secure flag) end-to-end, including cross-file traces: `Dockerfile` (confirms `ENV NODE_ENV=production`, so the gate is live in the real deploy path — not dead code), `backend/src/utils/helpers.js` (`isInstitutionalEmail`), `backend/docker-entrypoint.sh`, and the working-tree diff (uncommitted `compose.yaml`/`start-dev.sh`/`package-lock.json` changes excluded per scope).

What holds up: the gate is **fail-closed on missing values** (unset vars hit the empty-string rule), the refusal error **names variables without leaking values** (verified `offenders` array holds names only), set-path and clear-path cookie attributes **match** (`{...cookieOpts}` on both, so logout deletion mirrors login issuance), `compose.yaml` defaults `COOKIE_SECURE` to `true` with `:?` fail-fast on real secrets, and there is **no scope overreach** (trust-proxy/rate-limit correctly deferred to Phase 8, including an explicit statement in `docs/16-contrato-deploy.md:18`). Dev/test flows are unaffected (gate keyed on exact `NODE_ENV=production`).

No ship-blocking (critical) defects. Five warnings below are real, proven by reading the exact lines — the strongest two are the `@utfpr.edu.com` gate/helpers mismatch (can produce an admin that boots but can never log in) and the test-env leakage that means the "absent COOKIE_SECURE" tests never actually exercise the absent-value branch.

## Critical Issues

None. The gate trips (fail-closed, no value leakage), the cookie flag follows `env.cookieSecure` on both set and clear paths, and the deploy path (`Dockerfile` sets `NODE_ENV=production`) actually reaches the gate.

## Warnings

### WR-01: Gate allows `@utfpr.edu.com` but login rejects it — bootable yet unusable admin

**File:** `backend/src/config/env.js:50`
**Issue:** The production gate accepts `INITIAL_ADMIN_EMAIL` ending in `@utfpr.edu.com` as valid, but `isInstitutionalEmail()` in `backend/src/utils/helpers.js:6` only accepts `@utfpr.edu.br`. An operator deploying with `admin@utfpr.edu.com` passes the gate, the entrypoint seeds the admin, and that admin can never log in (`login` returns 400 `Use e-mail @utfpr.edu.br`). The error message (`env.js:63`) and `docs/16-contrato-deploy.md` both document only `@utfpr.edu.br`, so the `.com` acceptance is an undocumented inconsistency, not a feature. Recovery requires a redeploy with a corrected email plus manual DB cleanup of the unreachable admin row.
**Fix:**
```js
// env.js:50 — accept only the suffix the rest of the system enforces
if (!emailLower.endsWith('@utfpr.edu.br')) {
  offenders.push('INITIAL_ADMIN_EMAIL (missing institutional suffix @utfpr.edu.br)');
}
```
Alternatively, widen `isInstitutionalEmail()` to match — but a single suffix in both places is the correct call; pick one.

### WR-02: `SKIP_GW_ENV=true` silently disables the entire production gate (and forces `cookieSecure=false`)

**File:** `backend/src/config/env.js:22-23,79`
**Issue:** Setting `SKIP_GW_ENV=true` in a production environment completely bypasses the SEC-02 gate with no log line, no warning, nothing. The flag name is obscure (undocumented outside a code comment; absent from `docs/16-contrato-deploy.md` and `.env.example`), so a value leaked/copied from a test setup into production (e.g., via a shared env file) would silently disarm the gate *and* force `cookieSecure=false` (line 79) even under `NODE_ENV=production` with no `COOKIE_SECURE` set — two security properties defeated by one leftover variable. Threat model note: this requires env-write access, so it is not remotely exploitable; the risk is operational footgun, which is exactly what this phase exists to prevent.
**Fix:**
```js
const skipProductionGate = process.env.SKIP_GW_ENV === 'true';
if (skipProductionGate && process.env.NODE_ENV === 'production') {
  console.warn('SEC-02 WARNING: SKIP_GW_ENV=true is set under NODE_ENV=production — production gate DISABLED. Unset it unless running tests.');
}
```
Better still, scope the bypass to test runs (e.g., honor it only when `NODE_ENV !== 'production'` is false… i.e., require an explicit test marker) and document the variable in `docs/16-contrato-deploy.md`.

### WR-03: `isInsecureSecret` placeholder check is case-sensitive — `CHANGE-ME` bypasses the gate

**File:** `backend/src/config/env.js:10`
**Issue:** The `dev-` prefix check lowercases before comparing (line 12) but the `change-me` check does not: `trimmed.includes('change-me')`. A value such as `CHANGE-ME-ACCESS-32CHARS-MIN` or `Change-Me-xxx` passes the gate in production. The in-repo placeholder values are lowercase so the documented flow trips correctly, but a gate whose stated contract is "refuses placeholder values" should not be defeated by caps lock. Note the irony: `validateDevPrefix` (line 16-19) already does the case-insensitive pattern correctly — it is just never called (see IN-01).
**Fix:**
```js
if (trimmed.toLowerCase().includes('change-me')) return true;
```

### WR-04: Test env leakage means the "absent COOKIE_SECURE" tests never test absence

**File:** `backend/tests/env-gate.test.js:13-29,150-202`
**Issue:** Two compounding defects: (a) `afterEach` restores env via `Object.assign(process.env, originalEnv)`, which overwrites but never *deletes* variables introduced by a test (`SKIP_GW_ENV`, `COOKIE_SECURE` persist into later tests); (b) `loadEnvWithEnvVars` does `Object.assign` without first deleting `COOKIE_SECURE`/`SKIP_GW_ENV`. Concretely: the `COOKIE_SECURE=false` test (line 150) leaves `COOKIE_SECURE=false` in `process.env`; the very next test, titled "absent COOKIE_SECURE yields false (SKIP_GW_ENV=true)" (line 164), therefore runs with `COOKIE_SECURE=false` still set — its `cookieSecure === false` assertion passes via the *explicit-false* branch, not the `skipProductionGate` default branch it claims to cover. All three subsequent "absent" tests (lines 164, 178, 191) are similarly contaminated, and the leaked `SKIP_GW_ENV=true` further forces `isProduction=false` for every test after line 164. The default-branch logic (`env.js:77-80`) is effectively uncovered despite appearing covered.
**Fix:**
```js
beforeEach(() => {
  vi.resetModules();
  delete process.env.NODE_ENV;
  delete process.env.COOKIE_SECURE;
  delete process.env.SKIP_GW_ENV;
});
afterEach(() => {
  for (const k of Object.keys(process.env)) {
    if (!(k in originalEnv)) delete process.env[k];
  }
  Object.assign(process.env, originalEnv);
});
```

### WR-05: Explicit `COOKIE_SECURE=false` in production is silently honored — fail-open with no warning

**File:** `backend/src/config/env.js:75-76`
**Issue:** The "explicit wins" rule means `COOKIE_SECURE=false` + `NODE_ENV=production` boots with non-Secure session cookies and emits zero signal. The test at `env-gate.test.js:150-162` even enshrines this as expected behavior. Combined with `backend/.env.example` shipping `COOKIE_SECURE="false"` as its default line (see IN-03), a copy-`example`-to-production operator gets plaintext-HTTP session cookies with no gate trip and no log. The `compose.yaml` default (`true`) protects the compose path, but any dotenv-file-based production deploy takes the insecure branch silently.
**Fix:** Emit a loud warning when insecure-by-choice under production, keeping explicit-wins semantics:
```js
} else if (cookieSecureExplicit === 'false') {
  cookieSecure = false;
  if (isProduction) console.warn('SEC-04 WARNING: COOKIE_SECURE=false under NODE_ENV=production — session cookies will lack the Secure attribute.');
}
```

## Info

### IN-01: Dead code — `validateDevPrefix` is defined but never called

**File:** `backend/src/config/env.js:16-19`
**Issue:** `validateDevPrefix()` duplicates the `dev-` prefix check already inlined in `isInsecureSecret()` (line 12) and has zero call sites. Dead predicate next to the live one invites future edits to the wrong function (e.g., someone fixes case-handling in `validateDevPrefix` thinking it is the gate).
**Fix:** Delete lines 16-19. If the intent was reuse, call it from `isInsecureSecret` instead.

### IN-02: SEC-04 tests never assert `cookieOpts.secure` — end-to-end wiring is untested

**File:** `backend/tests/env-gate.test.js:207-227`
**Issue:** The `SEC-04 cookieOpts exports` block asserts `httpOnly`/`sameSite`/`path` and function existence, but never asserts `cookieOpts.secure === true` under `COOKIE_SECURE=true`. Additionally, `cookieOpts` in `tokens.js:20-25` is a require-time snapshot of `env.cookieSecure`, so any test (or future code path) that reloads `env.js` without also invalidating the `tokens.js` require cache reads a stale `secure` value. In the single-boot production process this is fine; the gap is purely verification.
**Fix:** Add a test that sets `COOKIE_SECURE=true`, clears both `env.js` and `tokens.js` from `require.cache`, reloads, and asserts `tokens.cookieOpts.secure === true` (and the `false` counterpart). Consider exporting a `getCookieOpts()` factory if per-request freshness is ever needed — not required today.

### IN-03: `.env.example` ships `COOKIE_SECURE="false"` as the uncommented default

**File:** `backend/.env.example:27`
**Issue:** Copying `.env.example` to a production `.env` (the most common operator flow) yields explicit `COOKIE_SECURE=false`, which per WR-05 silently disables Secure cookies in production. The comment on line 26 does say production uses `true`, but the uncommented value is the insecure one. Adjacent secret placeholders (`change-me-*`) are fail-closed by the gate; this line is fail-open with no backstop.
**Fix:** Change the shipped default to `COOKIE_SECURE="true"` with a comment noting local dev should override to `"false"` (localhost has no HTTPS), or comment the line out so the fail-safe `isProduction` default applies.

---

_Reviewed: 2026-09-24T12:00:00Z_
_Reviewer: the agent (gsd-code-reviewer)_
_Depth: deep_
