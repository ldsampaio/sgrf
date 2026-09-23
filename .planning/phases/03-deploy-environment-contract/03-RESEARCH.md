# Phase 03: Deploy & Environment Contract - Research

**Researched:** 2026-09-23
**Domain:** Production environment contract — Node.js env validation, Secure cookies behind Cloudflare Tunnel, compose wiring
**Confidence:** HIGH

## Summary

Phase 3 is a backend/infrastructure phase with zero `.vue` changes: make production boot fail fast on insecure secret *values* (SEC-02) and resolve the cookie/HTTPS story behind Cloudflare Tunnel (SEC-04), then document the contract as a validatable checklist. All three edit points are small and centralized: `backend/src/config/env.js` (fail-fast gate), `backend/src/utils/tokens.js` (read `COOKIE_SECURE` instead of hardcoding `NODE_ENV===production`), and `compose.yaml` + `backend/.env.example` (wiring + production notes).

The critical domain facts the planner must bake in: (1) the gate triggers ONLY on `NODE_ENV=production` with a value-based blocklist (empty / contains `change-me` / starts with `dev-`) across all four vars; (2) `Secure` cookies work behind Cloudflare Tunnel because the *browser* sees edge HTTPS even though cloudflared→app traffic is plain HTTP internally — so production sets `COOKIE_SECURE=true` explicitly and Phase 3 configures nothing proxy-related; (3) the `http://<LAN-IP>` check is dropped (Secure=true makes plain-HTTP login impossible by design) — verification is via the public `https://` URL only, which is a manual human-verify step.

**Primary recommendation:** Put a single `isInsecureSecret()` helper + fail-fast `throw` at the top of `env.js` load (gated strictly on `NODE_ENV=production`), expose `cookieSecure` from `env.js` (explicit `COOKIE_SECURE` wins, absent follows `NODE_ENV`), consume it in `tokens.js cookieOpts`, wire `COOKIE_SECURE`/`FRONTEND_URL` through `compose.yaml` + `.env.example` production notes, and document the three-step validatable checklist.

## User Constraints (from CONTEXT.md)

### Locked Decisions

**Fail-fast strictness (SEC-02):**
- **D-01:** Gate triggers ONLY on `NODE_ENV=production` — staging/homolog with any other `NODE_ENV` keeps dev fallbacks.
- **D-02:** Detection is value-based blocklist, not presence-only: empty, contains `change-me`, or starts with `dev-` fails. Catches current `env.js` fallbacks (`dev-*-secret-change-me-...`) and the `.env.example` `change-me-access-32chars-min` placeholder. Compose `PROCESSO:?` presence checks stay as-is (complementary layer).
- **D-03:** All four vars gate: `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`, `INITIAL_ADMIN_EMAIL`, `INITIAL_ADMIN_TEMPORARY_PASSWORD`. Admin email additionally checked for `@utfpr.edu.br` format.
- **D-04:** Failure mode is `throw new Error` at `env.js` load listing the offending vars + how to fix. CI stays green because CI runs vitest with `NODE_ENV!=production` (dummy `JWT_*` env only).

**COOKIE_SECURE semantics (SEC-04):**
- **D-05:** New `COOKIE_SECURE` env var; explicit value wins. Absent = follow `NODE_ENV` (production → true). `tokens.js cookieOpts.secure` reads it instead of hardcoding `NODE_ENV===production`.
- **D-06:** Production behind Cloudflare Tunnel sets `COOKIE_SECURE=true` explicitly — browser sees edge HTTPS so `Secure` cookies work, even though cloudflared→app origin traffic is plain HTTP. No auto-detect via `x-forwarded-proto` (would depend on proxy headers).
- **D-07:** `FRONTEND_URL` in production is the public `https://<host>` (CORS origin matches edge); dev default `http://localhost:5173` unchanged.
- **D-08:** `sameSite` stays `'lax'` — SPA+API are same-origin single hostname behind the Tunnel; no `sameSite:'none'` (only for split hosts). CSRF residual risk already accepted in `docs/11`.

**HTTPS topology (Cloudflare Tunnel):**
- **D-09:** Cloudflare Tunnel is the official and only TLS termination — no Caddy alternative documented or tested. Origin path: Cloudflare edge (TLS) → cloudflared → server entry port → app port (HTTP internally).
- **D-10:** Login verification happens via the public `https://` URL through the Tunnel. The roadmap's `http://<LAN-IP>` LAN check is dropped for this deploy: with `Secure=true`, plain-HTTP LAN login cannot work by design.
- **D-11:** `trust proxy` + rate-limit work is confirmed necessary (tunnel hides real client IP: rate-limit would bucket all users as one IP, audit IP would log cloudflared/local) but stays ATOMIC in Phase 8 (SEC-03) — Phase 3 configures nothing proxy-related.

**Contract doc shape (plan 03-03):**
- **D-12:** Contract lives as a dedicated deploy doc (README section or numbered `docs/` entry, planner's call) PLUS updated `backend/.env.example` (`COOKIE_SECURE`, `FRONTEND_URL=https://…` production notes). Inline compose comments alone are not enough.
- **D-13:** Doc is a validatable checklist, not prose: boot-refuses-insecure-secret → public-URL login works → `./start-dev.sh` dev intact — each step with command + expected result.

### the agent's Discretion
- Exact fail-fast error wording (keep terse, list offending vars + fix hint); where the `COOKIE_SECURE` parse helper lives (`env.js` vs `tokens.js`); exact doc file slot for the contract (README deploy section vs new `docs/` file); `.env.example` comment wording.

### Deferred Ideas (OUT OF SCOPE)
- `trust proxy` hop count + auth rate-limit expansion behind Tunnel — Phase 8 SEC-03 (acknowledged necessary, deliberately deferred).
- Caddy-front alternative topology — rejected, not deferred (Tunnel is the only supported TLS path).

## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| SEC-02 | Production boot fails fast when `JWT_*`/`INITIAL_ADMIN_*` secrets are missing or insecure — no `dev-*-secret-change-me` fallbacks under `NODE_ENV=production`; local dev fallbacks unchanged | Fail-fast gate pattern (§ Architecture Patterns, Pattern 1); blocklist values quoted verbatim from `env.js:9-10,20-21`; CI-safety analysis (§ Common Pitfalls #1) |
| SEC-04 | Cookie/HTTPS story resolved — `secure` flag follows a `COOKIE_SECURE` env var (or TLS termination documented with `FRONTEND_URL=https://…`); login works on non-localhost hosts | `COOKIE_SECURE` parse pattern (Pattern 2); Tunnel Secure-cookie analysis (Pattern 3); `tokens.js:20-25` + `app.js:15` + `compose.yaml:29-45` edit points |

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Secret fail-fast validation | API / Backend (`env.js` load) | — | Boot-time gate in the single typed-config module; no request path involved |
| Cookie `Secure` flag decision | API / Backend (`tokens.js cookieOpts` ← `env.js`) | — | Server sets `Set-Cookie`; browser only enforces |
| TLS termination | CDN / Edge (Cloudflare) | — | Tunnel is the only TLS path; app serves plain HTTP internally |
| CORS origin matching | API / Backend (`app.js` cors origin ← `FRONTEND_URL`) | — | Must equal the public `https://` host or credentialed login fails |
| Deploy contract doc | Docs (`docs/` or README + `.env.example`) | — | Operator-facing checklist, not runtime code |

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| *(none new)* | — | — | Phase uses only Node built-ins + already-installed deps (`dotenv`, `jsonwebtoken`, `cors`, `cookie-parser` via `app.js:1-8`). No install. |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `dotenv` (already installed) | existing | Loads `backend/.env` into `process.env` at `env.js:1` | Unchanged — gate reads resolved values after this line |
| `jsonwebtoken` (already installed) | existing | Signs/verifies JWTs in `tokens.js:1-18` | Unchanged — gate only controls which secret value is allowed |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Hand-written blocklist check | `zod`/`joi`/`envalid` env schema | Rejected: new dep + churn for a 4-var check; AGENTS.md favors minimal surface; blocklist logic is ~10 lines |
| Explicit `COOKIE_SECURE` var | Auto-detect via `x-forwarded-proto` | Rejected per D-06: depends on proxy headers Phase 3 explicitly does not configure (no `trust proxy` until Phase 8) |

**Installation:** None — zero new packages. (No `npm view` verification needed; no registry lookups performed.)

## Package Legitimacy Audit

No external packages installed in this phase — audit not applicable. All work is config/code edits plus markdown docs. Skip `package-legitimacy check`.

## Architecture Patterns

### System Architecture Diagram

```
Operator env (JWT_* / INITIAL_ADMIN_* / COOKIE_SECURE / FRONTEND_URL=https://<host>)
        │
        ▼
compose.yaml (outer layer: ${VAR:?msg} presence guards) ──► container fails fast if ABSENT
        │
        ▼
backend/src/config/env.js (inner layer: value blocklist, NODE_ENV=production only)
  pass ──► app boots ──► app.js cors(origin=FRONTEND_URL) + tokens.js cookieOpts(secure)
  fail ──► throw new Error (offending vars + fix hint) ──► process exits, errorHandler never involved
        │
        ▼ (production runtime)
Browser ──HTTPS──► Cloudflare edge (TLS) ──HTTP──► cloudflared ──► server entry port ──HTTP──► app:3000
  ▲                                                                                              │
  └──────── Secure cookie accepted (browser sees HTTPS) ◄── Set-Cookie: Secure; SameSite=Lax ────┘
```

### Recommended Project Structure

No new files required except the contract doc (planner's call per D-12):
```
backend/src/config/env.js        # fail-fast gate + cookieSecure parse helper (edit)
backend/src/utils/tokens.js      # cookieOpts.secure ← env.cookieSecure (edit)
compose.yaml                     # COOKIE_SECURE / FRONTEND_URL wiring (edit)
backend/.env.example             # COOKIE_SECURE + production notes (edit)
docs/XX-deploy-contract.md       # OR README deploy section (new, planner's call)
```

### Pattern 1: Production-only fail-fast gate at config load
**What:** Validate resolved secret values immediately after `dotenv` load, gated strictly on `process.env.NODE_ENV === 'production'`; collect all offending vars and `throw new Error` once listing each + fix hint. [VERIFIED: backend/src/config/env.js:1-22 — entire module quoted below]
**When to use:** Exactly this phase (SEC-02, D-01…D-04).
**Current insecure values the blocklist must catch (verbatim quote — the gate's test fixtures):**
```js
// Source: backend/src/config/env.js:1-22 (read this session)
require('dotenv').config();

module.exports = {
  port: parseInt(process.env.PORT || '3000', 10),
  frontendUrl: process.env.FRONTEND_URL || 'http://localhost:5173',
  dbUrl: process.env.DATABASE_URL || 'postgresql://sgrd:sgrd@localhost:5432/sgrd',
  serveFrontend: process.env.SERVE_FRONTEND === 'true',
  frontendDist: process.env.FRONTEND_DIST || '/app/frontend-dist',
  jwtAccessSecret: process.env.JWT_ACCESS_SECRET || 'dev-access-secret-change-me-0123456789',
  jwtRefreshSecret: process.env.JWT_REFRESH_SECRET || 'dev-refresh-secret-change-me-0123456789',
  // ...
  initialAdminEmail: (process.env.INITIAL_ADMIN_EMAIL || 'ldsampaio@utfpr.edu.br').toLowerCase(),
  initialAdminPassword: process.env.INITIAL_ADMIN_TEMPORARY_PASSWORD || '',
};
```
**Blocklist (per D-02):** value is insecure if empty/whitespace-only, contains `change-me`, or starts with `dev-`. Note `.env.example` placeholders `change-me-access-32chars-min` / `change-me-refresh-32chars-min` [VERIFIED: backend/.env.example:7-8] are caught by the `change-me` substring rule — anyone copying `.env.example` to production without replacing secrets still fails fast. Admin email additionally requires `@utfpr.edu.br` (D-03; matches auth rule "só e-mail `@utfpr.edu.br`" per AGENTS.md).
**Example gate skeleton:**
```js
// Recommended shape (agent's discretion on wording) — runs right after dotenv load,
// BEFORE module.exports is built so no insecure value ever escapes.
if (process.env.NODE_ENV === 'production') {
  const bad = [];
  const insecure = (v) => !v || !v.trim() || v.includes('change-me') || v.startsWith('dev-');
  if (insecure(process.env.JWT_ACCESS_SECRET)) bad.push('JWT_ACCESS_SECRET');
  if (insecure(process.env.JWT_REFRESH_SECRET)) bad.push('JWT_REFRESH_SECRET');
  // ... INITIAL_ADMIN_EMAIL (+ @utfpr.edu.br check), INITIAL_ADMIN_TEMPORARY_PASSWORD
  if (bad.length) throw new Error(`Refusing to boot with insecure secrets (NODE_ENV=production): ${bad.join(', ')}. Fix: ...`);
}
```

### Pattern 2: Explicit-env-wins with NODE_ENV fallback for booleans
**What:** Parse `COOKIE_SECURE` as `'true'`/`'false'` strings; explicit value wins, absent follows `NODE_ENV` (production → true). Expose as `env.cookieSecure`; `tokens.js` consumes it. [VERIFIED: backend/src/utils/tokens.js:20-25]
```js
// Source: backend/src/utils/tokens.js:20-25 (read this session) — current line to replace:
const cookieOpts = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax',
  path: '/',
};
```
**Recommended replacement source:** put the parse helper in `env.js` (keeps the single typed-config module pattern per CONTEXT.md code-context; `tokens.js` already imports `env` at line 2) — e.g. `cookieSecure: process.env.COOKIE_SECURE === 'true' ? true : process.env.COOKIE_SECURE === 'false' ? false : process.env.NODE_ENV === 'production'`, then `secure: env.cookieSecure`. `sameSite: 'lax'` unchanged (D-08).
**Why explicit-true in prod instead of relying on fallback:** documents intent in compose (`COOKIE_SECURE=true` next to `FRONTEND_URL=https://…`), and survives any future `NODE_ENV` naming change.

### Pattern 3: Tunnel Secure-cookie topology (why it works)
**What:** Cloudflare edge terminates TLS; the browser sees `https://<host>` so `Secure` cookies are accepted and sent. The plain-HTTP internal hops (cloudflared → entry port → app:3000) never touch the cookie — `Secure` is a *browser-side* enforcement attribute, not transport encryption of the internal path [ASSUMED — standard cookie semantics, training knowledge; planner treats as assumption, low risk]. No `x-forwarded-proto` sniffing, no `trust proxy`, no app-code change beyond `secure: true` (D-06, D-11).
**CORS consequence:** `app.js` uses `cors({ origin: env.frontendUrl, credentials: true })` [VERIFIED: backend/src/app.js:15] — a single exact origin. Production `FRONTEND_URL` MUST be the public `https://<host>` or credentialed login fails (D-07). Same-origin SPA+API is preserved behind the Tunnel (Express static fallback at `app.js:32-35`), so no split-host CORS work exists.

### Anti-Patterns to Avoid
- **Presence-only check (`if (!secret) throw`):** misses placeholder values like `change-me-access-32chars-min` that ARE set — this is exactly why D-02 mandates value-blocklist. Compose `:?` guards stay as the outer presence layer [VERIFIED: compose.yaml:35-38].
- **Gating on anything other than `NODE_ENV === 'production'`:** trips CI, staging, and `./start-dev.sh`. Strict equality per D-01.
- **Auto-detecting Secure from `x-forwarded-proto`:** depends on proxy headers that require `trust proxy`, which Phase 8 owns — creates a cross-phase coupling and a spoofing surface.
- **`sameSite: 'none'` "to be safe":** requires `Secure` AND invites CSRF surface; single-hostname Tunnel topology needs only `lax` (D-08, `docs/11` acceptance).

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Presence fail-fast in compose | Custom entrypoint secret-check script | Existing `${VAR:?msg}` guards [VERIFIED: compose.yaml:35-38] | Already the outer layer; keep as-is |
| Cookie signing/encryption | Custom crypto on secrets | Existing `jsonwebtoken` HS256 via `tokens.js` | Never hand-roll crypto; gate only validates values |
| Env schema validation lib | `zod`/`envalid` for 4 vars | ~10-line blocklist helper in `env.js` | New dep + churn exceeds the problem size |

**Key insight:** This phase is two small conditionals in the existing config module plus wiring — the complexity is in the *contract* (which values, which gate, which topology), already decided in CONTEXT.md. Don't build machinery.

## Common Pitfalls

### Pitfall 1: Gate trips CI or local dev
**What goes wrong:** `throw` fires under vitest or `./start-dev.sh`, breaking the Phase 1 regression gate.
**Why it happens:** Gate condition too broad (e.g. `!== 'development'`, or checking `!process.env.CI` inversely).
**How to avoid:** Strict `process.env.NODE_ENV === 'production'` (D-01). CI workflow sets no `NODE_ENV` [VERIFIED: .github/workflows/ci.yml:7-24 — backend job env is only `DATABASE_URL`], and vitest sets `NODE_ENV=test` when unset [ASSUMED — vitest documented behavior, not verified this session; planner confirms via a CI dry-run task]. Belt-and-braces per plan 03-01: add dummy `JWT_*` to CI backend job env anyway.
**Warning signs:** CI backend job red immediately after merging 03-01.

### Pitfall 2: `tokens.js` still reads `process.env` directly, bypassing `env.js`
**What goes wrong:** `secure: process.env.NODE_ENV === 'production'` [VERIFIED: tokens.js:22] ignores `COOKIE_SECURE=true` — prod behind Tunnel with `NODE_ENV` unset/misspelled silently issues non-Secure cookies (or vice versa).
**Why it happens:** Two sources of truth for environment (raw `process.env` vs typed `env.js` module).
**How to avoid:** `cookieOpts.secure` reads `env.cookieSecure` (Pattern 2); grep for remaining raw `process.env.NODE_ENV` reads in `src/` after the change.
**Warning signs:** Login works locally but session cookie missing `Secure` in prod devtools (or `Secure` present on plain-HTTP dev).

### Pitfall 3: `clearCookie` attributes mismatch Secure cookies on logout
**What goes wrong:** Logout appears to succeed server-side but browser keeps the session cookies.
**Why it happens:** `authController.js:67-68` clears with `{ path: '/' }` only [VERIFIED via grep this session] — no `secure`/`sameSite`. Clearing must match the attributes the cookie was set with to reliably delete [ASSUMED — Express/browser cookie-matching semantics; planner treats as assumption].
**How to avoid:** Spread `cookieOpts` into `clearCookie` calls (minus `maxAge`) in the same task that changes `cookieOpts`; verify logout deletes both cookies in the public-URL check.
**Warning signs:** "Logout doesn't log out" reports after 03-02 lands.

### Pitfall 4: `FRONTEND_URL` mismatch kills credentialed login with an opaque CORS error
**What goes wrong:** Login fails in prod with browser CORS error; server logs look clean.
**Why it happens:** `cors({ origin: env.frontendUrl })` is a single exact string [VERIFIED: app.js:15] — trailing slash, `http://` vs `https://`, or LAN-IP vs public host all mismatch. `axios` uses `withCredentials: true` (AGENTS.md), so origin must match exactly.
**How to avoid:** Contract doc mandates `FRONTEND_URL=https://<public-host>` with no trailing slash; compose default `http://localhost:${APP_PORT}` [VERIFIED: compose.yaml:34] is dev-only. Checklist step asserts the login round-trip, not just boot.
**Warning signs:** `Access-Control-Allow-Origin` errors in browser console on the public URL.

### Pitfall 5: Verifying via `http://<LAN-IP>` and concluding "login is broken"
**What goes wrong:** Human tester hits plain-HTTP LAN IP, login silently fails (browser drops `Secure` cookie on `http://`), files a bug against 03-02.
**Why it happens:** Localhost is a Secure-cookie exception in browsers; any non-localhost plain-HTTP host is not [ASSUMED — standard browser behavior, training knowledge].
**How to avoid:** D-10 drops the LAN check — verification is via the public `https://` URL only. Contract doc states this explicitly as an expected-failure note.

## Code Examples

### Setting cookies with shared opts (login + refresh — unchanged call sites)
```js
// Source: backend/src/controllers/authController.js:39-40,59 (found via grep this session)
res.cookie('access_token', signAccess(user), { ...cookieOpts, maxAge: 15 * 60 * 1000 });
res.cookie('refresh_token', signRefresh(user), { ...cookieOpts, maxAge: 7 * 24 * 3600 * 1000 });
```
Only `cookieOpts.secure`'s *source* changes (Pattern 2); call sites are untouched.

### Compose wiring to add (exact anchor lines)
```yaml
# Source: compose.yaml:29-45 (read this session) — add after line 34 / 38:
      FRONTEND_URL: ${FRONTEND_URL:-http://localhost:${APP_PORT:-8081}}
      JWT_ACCESS_SECRET: ${JWT_ACCESS_SECRET:?defina JWT_ACCESS_SECRET no ambiente}
      JWT_REFRESH_SECRET: ${JWT_REFRESH_SECRET:?defina JWT_REFRESH_SECRET no ambiente}
      INITIAL_ADMIN_EMAIL: ${INITIAL_ADMIN_EMAIL:?defina INITIAL_ADMIN_EMAIL no ambiente}
      INITIAL_ADMIN_TEMPORARY_PASSWORD: ${INITIAL_ADMIN_TEMPORARY_PASSWORD:?defina INITIAL_ADMIN_TEMPORARY_PASSWORD no ambiente}
```
Recommended additions: `COOKIE_SECURE: ${COOKIE_SECURE:-true}` (prod compose override / documented `true` in prod) + keep `FRONTEND_URL` overridable (no default change needed — operator sets `FRONTEND_URL=https://<host>`).

### `.env.example` production notes anchor
```ini
# Source: backend/.env.example:7,20 (read this session)
JWT_ACCESS_SECRET="change-me-access-32chars-min"
FRONTEND_URL="http://localhost:5173"
```
Add: `COOKIE_SECURE` line + comments that any value containing `change-me` or starting with `dev-` refuses to boot under `NODE_ENV=production`, and that prod `FRONTEND_URL` is `https://<public-host>`.

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `secure: NODE_ENV===production` hardcoded in `tokens.js` | `COOKIE_SECURE` explicit var, absent follows `NODE_ENV` | This phase (D-05) | Operators control cookie policy per deploy, not per code branch |
| Presence-only compose `:?` guards | Presence (compose) + value-blocklist (`env.js`) two layers | This phase (D-02) | Catches placeholder values that presence checks miss |
| LAN-IP plain-HTTP login check | Public-`https://`-only verification via Tunnel | This phase (D-10) | Aligns verification with Secure-cookie reality |

**Deprecated/outdated:**
- Caddy-front topology: rejected, not supported (D-09) — planner must not include Caddy tasks.
- `trust proxy` / `x-forwarded-proto` detection in Phase 3: deferred to Phase 8 (D-11).

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Vitest sets `NODE_ENV=test` when unset, so the production gate cannot trip CI even without dummy env | Pitfall 1 | LOW — dummy `JWT_*` in CI (plan 03-01) covers it regardless; confirm via CI run |
| A2 | `Secure` cookie attribute is browser-side enforcement; plain-HTTP internal Tunnel hops don't affect it | Pattern 3 | LOW — standard cookie semantics; public-URL login check proves it empirically |
| A3 | `clearCookie` needs matching `secure`/`sameSite` to delete Secure cookies | Pitfall 3 | LOW — fix (spread `cookieOpts`) is harmless even if browsers are lenient |
| A4 | Browsers exempt only localhost (not LAN IPs) from the Secure-cookie requirement | Pitfall 5 | LOW — only affects the doc's expected-failure note wording |

## Open Questions

1. **Exact doc slot for the contract (README section vs new `docs/` file)?**
   - What we know: D-12 leaves it to the planner; `docs/` has numbered entries (`03`, `06`, `07`, `08`, `11` per AGENTS.md).
   - What's unclear: Whether README already has a deploy section to extend.
   - Recommendation: Planner picks at plan time; executor lists the file listing first task step.

2. **Does CI need the dummy `JWT_*` env given `NODE_ENV` is unset?**
   - What we know: Gate is strict-`production`, CI sets no `NODE_ENV` [VERIFIED: ci.yml].
   - What's unclear: Whether any CI step sets `NODE_ENV=production` implicitly.
   - Recommendation: Add dummies anyway (plan 03-01 already includes this) — cost is one line, eliminates the class.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| node | backend runtime, vitest | ✓ | v26.9.0 (probed this session) | — |
| docker | Postgres local, compose deploy | ✓ | 29.8.1 (probed this session) | — |
| Cloudflare Tunnel (`cloudflared`) + public hostname | Public-URL login verification (D-10) | ✗ (not probed; operator-owned) | — | Manual human-verify step on the real host; nothing to mock locally |
| Production secrets | Fail-fast negative test | ✗ (by design) | — | Test with dummy `change-me`/`dev-` values under `NODE_ENV=production` locally — asserts the `throw` without real secrets |

**Missing dependencies with no fallback:** None blocking — all automated checks run locally.
**Missing dependencies with fallback:** Public-URL login check (human-verify on the operator's host).

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | vitest (backend; suites `batch`, `unit`, `voting` per AGENTS.md) |
| Config file | none detected at backend root (probed `backend/*.config.*`, `vitest*` — absent); convention via `package.json` script |
| Quick run command | `cd backend && npx vitest run` |
| Full suite command | `cd backend && npx vitest run` (same; single suite < 30s expected) |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| SEC-02 | `NODE_ENV=production` + insecure values → `throw` listing offending vars | unit | `cd backend && npx vitest run tests/env-gate.test.js -x` (new file; needs `NODE_ENV` save/restore + `jest.resetModules`/dynamic `require` since gate runs at load) | ❌ Wave 0 |
| SEC-02 | Non-production keeps dev fallbacks (no throw) | unit | same file, second case | ❌ Wave 0 |
| SEC-02 | `COOKIE_SECURE` absent follows `NODE_ENV`; explicit `'false'` wins in prod | unit | same file or `tokens` opts assertion | ❌ Wave 0 |
| SEC-04 | Login round-trip on public `https://` URL | manual-only | Human checklist on operator host (needs Tunnel + secrets; cannot automate in CI) | manual — justification: requires real edge TLS + real secrets |
| Contract | `./start-dev.sh` dev flow intact | smoke (manual) | `./start-dev.sh` boot + login on `localhost:5173` | manual — justification: shell orchestration, run per checklist |

### Sampling Rate
- **Per task commit:** `cd backend && npx vitest run`
- **Per wave merge:** `cd backend && npx vitest run` + `cd frontend && npm run build` (frontend untouched, build as regression guard)
- **Phase gate:** Full suite green before `/gsd-verify-work`

### Wave 0 Gaps
- [ ] `backend/tests/env-gate.test.js` — covers SEC-02 throw/no-throw matrix + COOKIE_SECURE parse (new; no existing env test file found — `tests/` holds only `batch`, `unit`, `voting`)
- [ ] CI dummy env: `JWT_ACCESS_SECRET`/`JWT_REFRESH_SECRET` (+ `INITIAL_ADMIN_*`) in backend job `env:` of `.github/workflows/ci.yml` — one-line belt-and-braces per plan 03-01

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | yes | `Secure` + `httpOnly` + `SameSite=Lax` session cookies via `tokens.js cookieOpts`; no credential handling change |
| V3 Session Management | yes | Cookie flags contract (`COOKIE_SECURE`, same-origin Tunnel topology); no rotation change (deferred per REQUIREMENTS Out of Scope) |
| V5 Input Validation | yes | Env-value blocklist + `@utfpr.edu.br` email check at `env.js` load (allow/deny on config, not user input) |
| V6 Cryptography | yes | `jsonwebtoken` HS256 (existing); gate guarantees non-placeholder ≥ real secrets in prod — never hand-roll |
| V14 Configuration | yes | Fail-fast on insecure defaults; compose `:?` presence layer + `.env.example` production notes |

### Known Threat Patterns for Node/Express + Tunnel stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Placeholder secret deployed to prod (spoofing/admin takeover) | Spoofing | Value-blocklist `throw` (this phase) + compose `:?` presence layer |
| Session cookie stolen over plaintext (LAN-IP downgrade) | Information disclosure | `Secure` + `lax` + HTTPS-only verification (D-10 drops plain-HTTP check) |
| `FRONTEND_URL` mismatch → credentialed CORS bypass confusion | Spoofing | Exact-match single origin = public `https://` host (D-07) |
| Rate-limit bucketing all Tunnel users as one IP | Denial of service (lockout) / repudiation (wrong audit IP) | Acknowledged, atomic in Phase 8 SEC-03 — Phase 3 must not half-fix |

## Sources

### Primary (HIGH confidence)
- In-repo reads this session: `backend/src/config/env.js:1-22`, `backend/src/utils/tokens.js:1-27`, `backend/src/app.js:1-41`, `backend/src/controllers/authController.js` (via grep), `compose.yaml:1-51`, `backend/.env.example:1-20`, `.github/workflows/ci.yml:1-39`, `AGENTS.md`, `03-CONTEXT.md`, `03-UI-SPEC.md`, `REQUIREMENTS.md` (SEC-02/SEC-04), `STATE.md`, `.planning/config.json`
- Environment probes this session: `node v26.9.0`, `docker 29.8.1`, `backend/tests/{batch,unit,voting}.test.js` exist, no vitest config file

### Secondary (MEDIUM confidence)
- None — no web lookups needed; domain is fully constrained by locked decisions + in-repo code

### Tertiary (LOW confidence)
- Cookie `Secure`/localhost-exception semantics, vitest `NODE_ENV=test` default, `clearCookie` attribute matching — training knowledge, logged in Assumptions A1–A4

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - no new deps; all edit points read verbatim this session
- Architecture: HIGH - topology and gate semantics locked in CONTEXT.md D-01…D-11, confirmed against code
- Pitfalls: MEDIUM - Pitfalls 1/2/4 grounded in read code; 3/5 rest on [ASSUMED] browser/vitest semantics

**Research date:** 2026-09-23
**Valid until:** 2026-10-23 (stable domain — Express cookie semantics and project files change slowly)

## Project Constraints (from AGENTS.md)

- Two packages, no workspace — run commands inside `backend/` or `frontend/`
- Backend verify: `cd backend && npx vitest run`; frontend verify: `cd frontend && npm run build` (no frontend tests; `npm test` fails by design)
- No invented lint/typecheck commands
- After `schema.prisma` changes: `npx prisma migrate dev` (not touched by this phase — no schema change)
- Never commit: `backend/.env`, `*.db*`, `backend/uploads/*`
- Auth: `@utfpr.edu.br` only; JWT in httpOnly cookies; `axios baseURL '/api'` + `withCredentials`; `FRONTEND_URL` must be CORS-correct
- Money as cents integer, UUID string IDs (not touched by this phase)
- Secrets via environment; compose fails fast if absent
