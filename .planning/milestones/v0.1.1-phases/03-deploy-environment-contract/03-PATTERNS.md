# Phase 03: Deploy & Environment Contract - Pattern Map

**Mapped:** 2026-09-23
**Files analyzed:** 8 (6 modified, 2 new)
**Analogs found:** 8 / 8

> Note: most edit points in this phase are small, centralized config edits where the
> file is its own analog (the existing lines to change ARE the pattern). All analog
> paths below are git-tracked (verified via `git ls-files`).

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `backend/src/config/env.js` (modify) | config | boot-validation | `backend/src/config/env.js` (self) | exact |
| `backend/src/utils/tokens.js` (modify) | utility | request-response (cookie) | `backend/src/utils/tokens.js` (self) | exact |
| `backend/src/controllers/authController.js` (modify) | controller | request-response | `backend/src/controllers/authController.js` (self) | exact |
| `compose.yaml` (modify) | config | deploy-wiring | `compose.yaml` (self, `:?` guards) | exact |
| `backend/.env.example` (modify) | config | deploy-wiring | `backend/.env.example` (self) | exact |
| `.github/workflows/ci.yml` (modify) | config | batch (CI) | `.github/workflows/ci.yml` (self) | exact |
| `backend/tests/env-gate.test.js` (new) | test | batch | `backend/tests/unit.test.js` | exact |
| `docs/XX-deploy-contract.md` or README deploy section (new) | doc | n/a | `docs/11-seguranca-e-auditoria.md` (numbered-docs convention) | role-match |

## Pattern Assignments

### `backend/src/config/env.js` (config, boot-validation)

**Analog:** `backend/src/config/env.js` (self — gate lands at load time in this module)

**Imports pattern** (lines 1-3):
```js
require('dotenv').config();

module.exports = {
  port: parseInt(process.env.PORT || '3000', 10),
```

**Core typed-config pattern** (lines 4-22) — single module, `process.env.X || fallback`, typed coercion inline; the fail-fast gate goes BEFORE `module.exports` is built, gated strictly on `NODE_ENV === 'production'`:
```js
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

**Boolean-parse convention to copy for `cookieSecure`** (lines 7, 11, 15 — `=== 'true'` pattern already used 3× in this file):
```js
serveFrontend: process.env.SERVE_FRONTEND === 'true',
smtpEnabled: process.env.SMTP_ENABLED === 'true',
secure: process.env.SMTP_SECURE === 'true',
```

**Blocklist fixtures** (what the gate must catch — verbatim values from lines 9-10 plus `.env.example` lines 7-8):
- `dev-access-secret-change-me-0123456789` / `dev-refresh-secret-change-me-0123456789` → caught by `startsWith('dev-')` AND `includes('change-me')`
- `change-me-access-32chars-min` / `change-me-refresh-32chars-min` → caught by `includes('change-me')`

**Failure mode:** `throw new Error` at load listing offending vars + fix hint. Never `console.error + process.exit` — a throw at require-time crashes boot with a stack, and stays clean in production where `errorHandler` hides stacks.

---

### `backend/src/utils/tokens.js` (utility, request-response)

**Analog:** `backend/src/utils/tokens.js` (self — single edit point for D-05/D-06)

**Imports pattern** (lines 1-2) — `tokens.js` already imports the typed config; do NOT read `process.env` directly after the fix:
```js
const jwt = require('jsonwebtoken');
const env = require('../config/env');
```

**Core signing pattern** (lines 4-10, unchanged — gate only controls which secret value is allowed):
```js
function signAccess(user) {
  return jwt.sign({ sub: user.id, role: user.role }, env.jwtAccessSecret, { expiresIn: '15m' });
}
```

**Cookie opts pattern** (lines 20-25) — THE line to change is line 22; `sameSite: 'lax'` stays (D-08):
```js
const cookieOpts = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',  // ← REPLACE with env.cookieSecure
  sameSite: 'lax',
  path: '/',
};
```

**Recommended replacement:** parse helper lives in `env.js` (keeps single typed-config module pattern), consumed here as `secure: env.cookieSecure`. Explicit `'true'`/`'false'` wins, absent follows `NODE_ENV`:
```js
// in env.js: cookieSecure: process.env.COOKIE_SECURE === 'true' ? true
//   : process.env.COOKIE_SECURE === 'false' ? false
//   : process.env.NODE_ENV === 'production',
// in tokens.js: secure: env.cookieSecure,
```

---

### `backend/src/controllers/authController.js` (controller, request-response)

**Analog:** `backend/src/controllers/authController.js` (self — Pitfall 3 `clearCookie` fix)

**Imports pattern** (lines 1-7):
```js
const prisma = require('../config/db');
const env = require('../config/env');
const { normalizeEmail, isInstitutionalEmail, randomTempPassword } = require('../utils/helpers');
const { hashPassword, verifyPassword } = require('../utils/password');
const { signAccess, signRefresh, verifyRefresh, cookieOpts } = require('../utils/tokens');
```

**Cookie set pattern** (lines 39-40, 59 — spread shared `cookieOpts`, unchanged call sites):
```js
res.cookie('access_token', signAccess(user), { ...cookieOpts, maxAge: 15 * 60 * 1000 });
res.cookie('refresh_token', signRefresh(user), { ...cookieOpts, maxAge: 7 * 24 * 3600 * 1000 });
```

**Logout pattern to fix** (lines 66-70) — currently clears with `{ path: '/' }` only, which will NOT reliably delete `Secure; SameSite=Lax` cookies after 03-02. Spread `cookieOpts` (minus `maxAge`):
```js
async function logout(req, res) {
  res.clearCookie('access_token', { path: '/' });   // ← must match set attributes
  res.clearCookie('refresh_token', { path: '/' });  // ← must match set attributes
  res.json({ ok: true });
}
```

**Error handling pattern** (lines 44, 91, 113): `catch (e) { next(e); }` → centralized `errorHandler`; direct `res.status(...).json({ error: '...' })` for expected failures.

---

### `compose.yaml` (config, deploy-wiring)

**Analog:** `compose.yaml` (self — outer presence layer stays as-is)

**Presence-guard pattern** (lines 34-38) — `${VAR:?message}` outer layer; DO NOT touch, value-blocklist in `env.js` is the complementary inner layer:
```yaml
      FRONTEND_URL: ${FRONTEND_URL:-http://localhost:${APP_PORT:-8081}}
      JWT_ACCESS_SECRET: ${JWT_ACCESS_SECRET:?defina JWT_ACCESS_SECRET no ambiente}
      JWT_REFRESH_SECRET: ${JWT_REFRESH_SECRET:?defina JWT_REFRESH_SECRET no ambiente}
      INITIAL_ADMIN_EMAIL: ${INITIAL_ADMIN_EMAIL:?defina INITIAL_ADMIN_EMAIL no ambiente}
      INITIAL_ADMIN_TEMPORARY_PASSWORD: ${INITIAL_ADMIN_TEMPORARY_PASSWORD:?defina INITIAL_ADMIN_TEMPORARY_PASSWORD no ambiente}
```

**Optional-with-default pattern** (lines 39-45) — copy for `COOKIE_SECURE` wiring:
```yaml
      SMTP_ENABLED: ${SMTP_ENABLED:-false}
```

**Change:** add `COOKIE_SECURE: ${COOKIE_SECURE:-true}` after line 34; keep `FRONTEND_URL` overridable (operator sets `FRONTEND_URL=https://<host>` in prod — no default change).

---

### `backend/.env.example` (config, deploy-wiring)

**Analog:** `backend/.env.example` (self — comment + placeholder convention)

**Placeholder + comment pattern** (lines 1-8, 17-20):
```ini
DATABASE_URL="postgresql://sgrd:sgrd@localhost:5432/sgrd"
# Deploy (compose): porta externa da aplicação (default 8081 se ausente).
# APP_PORT="8081"
JWT_ACCESS_SECRET="change-me-access-32chars-min"
JWT_REFRESH_SECRET="change-me-refresh-32chars-min"
INITIAL_ADMIN_EMAIL="ldsampaio@utfpr.edu.br"
INITIAL_ADMIN_TEMPORARY_PASSWORD=""
PORT="3000"
FRONTEND_URL="http://localhost:5173"
```

**Change:** add `COOKIE_SECURE` line + comments stating (a) any value containing `change-me` or starting with `dev-` refuses to boot under `NODE_ENV=production`, (b) prod `FRONTEND_URL` is `https://<public-host>` with no trailing slash. Copy the `# Deploy (compose): ...` comment voice.

---

### `.github/workflows/ci.yml` (config, batch)

**Analog:** `.github/workflows/ci.yml` (self — belt-and-braces dummy env)

**Backend job env pattern** (lines 7-11):
```yaml
  backend:
    name: backend
    runs-on: ubuntu-latest
    env:
      DATABASE_URL: postgresql://user:pass@localhost:5432/sgrd
```

**Change:** add dummy `JWT_ACCESS_SECRET` / `JWT_REFRESH_SECRET` (+ `INITIAL_ADMIN_*`) under backend job `env:` so the production gate can never trip CI even if `NODE_ENV` is ever set to `production` there. CI currently sets no `NODE_ENV`, and vitest defaults it to `test` — the dummies are belt-and-braces (one line, eliminates the class).

---

### `backend/tests/env-gate.test.js` (test, batch) — NEW FILE

**Analog:** `backend/tests/unit.test.js`

**Imports + structure pattern** (lines 1-9):
```js
import { describe, it, expect } from 'vitest';
import { isInstitutionalEmail, normalizeEmail, toCents } from '../src/utils/helpers.js';
import { calcAmount } from '../src/services/requestService.js';

describe('auth domain', () => {
  it('aceita @utfpr.edu.br', () => expect(isInstitutionalEmail('A@UTFPR.EDU.BR')).toBe(true));
  it('rejeita externo', () => expect(isInstitutionalEmail('a@gmail.com')).toBe(false));
  it('normaliza', () => expect(normalizeEmail('A@Utfpr.Edu.Br ')).toBe('a@utfpr.edu.br'));
});
```

**Test idiom to copy:** ESM `import` from vitest, `describe`/`it` with Portuguese labels, `toBe`/`toThrow` assertions. Note: `env.js` is CommonJS (`require`/`module.exports`) while tests are ESM `import` — the new test must handle the CJS/ESM boundary (dynamic `import()` after setting `process.env`, or `createRequire`). Gate runs at module load, so each case needs `NODE_ENV` save/restore + fresh module load (`vi.resetModules()` + dynamic import).

**Cases to cover:** (1) `NODE_ENV=production` + insecure values → `throw` listing offending vars; (2) non-production keeps dev fallbacks (no throw); (3) `COOKIE_SECURE` absent follows `NODE_ENV`; explicit `'false'` wins in prod.

---

### Deploy contract doc (doc) — NEW FILE

**Analog:** `docs/11-seguranca-e-auditoria.md` (numbered-docs convention; CSRF residual-risk acceptance referenced by D-08)

**Convention to copy:** numbered `docs/NN-*.md` slot (`00`–`15` taken; planner picks next free number) OR a README deploy section (planner's call per D-12). Doc is a **validatable checklist, not prose** — three steps, each with command + expected result:
1. boot-refuses-insecure-secret (`NODE_ENV=production` + `change-me`/`dev-` value → `throw`, process exits)
2. public-URL login works (`https://<host>` through Tunnel, `Secure` cookie set, logout deletes it)
3. `./start-dev.sh` dev intact (`localhost:5173` login still works)

**Must state explicitly (Pitfall 5):** no `http://<LAN-IP>` check — with `Secure=true`, plain-HTTP non-localhost login cannot work by design (expected failure, not a bug).

---

## Shared Patterns

### Email validation (`@utfpr.edu.br`)
**Source:** `backend/src/utils/helpers.js` (lines 1-7)
**Apply to:** `env.js` fail-fast gate (D-03 — admin email check)
```js
function normalizeEmail(email) {
  return String(email || '').trim().toLowerCase();
}

function isInstitutionalEmail(email) {
  return normalizeEmail(email).endsWith('@utfpr.edu.br');
}
```
Note: `env.js` line 20 already lowercases the admin email; the gate reuses the same `endsWith('@utfpr.edu.br')` check. `helpers.js` is not imported by `env.js` today (config module stays dependency-free — inline the one-liner rather than adding an import).

### Error surfacing at boot vs request
**Source:** `backend/src/middlewares/validate.js` (lines 12-17)
**Apply to:** understanding why the gate uses `throw` (not `next(err)`)
```js
// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  const safe = { error: err.message || 'Erro interno' };
  if (process.env.NODE_ENV !== 'production') safe.stack = err.stack;
  res.status(err.status || 500).json(safe);
}
```
The gate `throw`s at `require` time — before Express exists — so `errorHandler` is never involved. Keep the thrown message terse: offending var names + fix hint (no stack needed; Node prints it).

### CORS single-origin contract
**Source:** `backend/src/app.js` (line 15)
**Apply to:** contract doc (D-07 rationale)
```js
app.use(cors({ origin: env.frontendUrl, credentials: true }));
```
Single exact-string origin: trailing slash, `http://` vs `https://`, or LAN-IP vs public host all mismatch. Prod `FRONTEND_URL` MUST be `https://<host>` with no trailing slash. No code change in this phase — doc-only constraint.

### Same-origin SPA serving (why no CORS split-host work)
**Source:** `backend/src/app.js` (lines 29-35)
**Apply to:** contract doc topology section
```js
// Deploy em imagem única: serve o build do frontend (Vite) na mesma origem.
// Ativado via SERVE_FRONTEND=true (FRONTEND_DIST aponta p/ frontend/dist).
// O fallback abaixo é exigido pelo createWebHistory (/council, /reports...).
if (env.serveFrontend && fs.existsSync(env.frontendDist)) {
  app.use(express.static(env.frontendDist));
  app.get(/^\/(?!api).*/, (req, res) => res.sendFile(path.join(env.frontendDist, 'index.html')));
}
```
Tunnel preserves single-hostname same-origin, so `sameSite: 'lax'` suffices (D-08).

## No Analog Found

None — all 8 files have a concrete in-repo analog (6 are self-patterns on the exact lines to change; the new test copies `unit.test.js`; the new doc copies the numbered-`docs/` convention). Planner should still use RESEARCH.md Patterns 1–3 for the gate skeleton and topology rationale.

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| — | — | — | — |

## Metadata

**Analog search scope:** `backend/src/config/`, `backend/src/utils/`, `backend/src/controllers/`, `backend/src/middlewares/`, `backend/tests/`, `docs/`, repo root (`compose.yaml`), `.github/workflows/`
**Files scanned:** 12 (7 read fully in one pass each, 5 via glob/grep: 3 test files, 16 docs entries, `helpers.js` excerpt)
**Pattern extraction date:** 2026-09-23
