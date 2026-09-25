# Phase 08 CONTEXT: Decisions Clear Enough for Downstream Agents

**Phase:** Reports/Audit & Auth Polish
**Date:** 2026-09-25
**Status:** Context captured — ready for planning

---

## Goals (from ROADMAP.md)

Exports are auditable and injection-safe, auth routes are rate-limited behind a correctly configured proxy, and the forced-password-change guarantee is actually enforced.

### Success Criteria

1. CSV and JSON exports — like PDF today — write a `report_exported` audit event before any bytes stream to the client
2. Opening an exported CSV whose cells start with `=`, `+`, `-`, `@`, tab, or CR/LF in a spreadsheet executes no formula (OWASP prefix/strip applied)
3. All auth mutation routes (login, refresh, forgot-password, change-password) are rate-limited with correct client IPs behind the proxy; login failure returns a uniform 401 while the distinct lockout signal stays intact
4. A user with `mustChangePassword` gets 403 from every API route except the documented allowlist (change-password, me, refresh, logout) and can navigate only to the change-password flow — after changing, full access is restored (reset emails work, since Phase 7 drains the queue)

---

## Domain

The domain is the **reports/audit + auth hardening surface**:

- Four export formats (CSV/JSON/PDF via reports.routes.js + dashboard PDF) with audit-before-stream
- CSV cell sanitization per OWASP (full-width variants inclusive)
- Auth mutation rate-limiting with trust-proxy hop count for Cloudflare Tunnel single-hop topology
- mustChangePassword enforcement (backend 403 allowlist + frontend router guard + temp-password loop)

---

## Canonical Refs (MANDATORY — full relative paths)

```markdown
- .planning/ROADMAP.md
  - Phase 8 definition, dependency on Phase 3/4/7, 4 success criteria, 4 plans (08-01 … 08-04), **Mode: mvp**

- .planning/REQUIREMENTS.md
  - REP-01: Every report export (CSV/JSON/PDF) is audited (report_exported) before any format branches out — today only PDF audits
  - REP-02: CSV formula injection neutralized — leading =, +, -, @, tab, CR, LF (and full-width) prefixed/stripped per OWASP
  - SEC-03: All auth mutation routes are rate-limited, uniform 401 on login failure, trust proxy explicit hop count (never bare true)
  - SES-02: mustChangePassword blocks API (403 until change) and router allows only change-password flow

- backend/src/routes/reports.routes.js
  - Current toCSV() only escapes double quotes (line 6); get('/requests') CSV branch has no audit, PDF branch audits after pipe; /financial CSV no audit; /accountability PDF audits; /dashboard JSON no audit — REP-01 gap
  - Existing audit calls: action 'report_exported', entityType 'report', entityId 'requests-pdf' etc. (after stream today)

- backend/src/middlewares/auth.js
  - Current authJwt loads user and checks status !== 'ATIVO' → 401, but does NOT check mustChangePassword — SES-02 gap
  - requireRole/canManageUsers exist but mustChangePassword needs new gate

- backend/src/routes/auth.routes.js
  - Current only login has loginLimiter (20/15m, windowMs 15min, max 20); refresh, forgot-password, change-password have no limiter; no trust proxy set in app.js

- backend/src/controllers/authController.js
  - login returns 401 no user, 403 inactive, 423 locked — enumeration leak (SEC-03); must become uniform 401 except 423 kept distinct
  - changePassword checks mustChangePassword + expiry but no rate limit
  - forgotPassword creates temp password and enqueues email (depends on Phase 7 queue drain)

- backend/src/app.js
  - Current app.set('trust proxy') never set — behind reverse proxy all clients share one rate-limit bucket (global lockout)
  - Helmet, cors, json 2mb, cookieParser, pinoHttp — no limiter, no proxy

- frontend/src/router/index.js
  - Current mustChangePassword branch is no-op: `if (auth.user?.mustChangePassword && to.path !== '/login') { // força troca: mantém no dashboard com banner (MVP) }` — SES-02 gap
  - No /change-password route dedicated view; must add or reuse existing

- frontend/src/views/Reports.vue
  - Current no in-flight indicator, catch-nothing load(), slice(0,3000) truncation — not in scope for Phase 8 (03 backlogs) but CSV injection fix protects its exports

- .planning/codebase/CONCERNS.md
  - "Report exports partially unaudited" and "CSV injection in exports" and "Rate-limiting gaps and proxy blindness" and "mustChangePassword is not enforced" sections

- docs/11-seguranca-e-auditoria.md (referenced per REQUIREMENTS)
  - Audit policy: report_exported is auditable event; must not leak stack

- .planning/PROJECT.md / .planning/STATE.md
  - Active requirements, fragile areas (voting state machine, financial invariants), prior phase decisions
```

---

## Codebase Context (Reusable Assets & Patterns)

### Fragile Areas (from CONCERNS.md)

**Report exports partially unaudited**: Only PDF branches call audit('report_exported'); CSV and JSON of requests/financial are not audited though docs/11 treats exports as auditable.

**CSV injection**: toCSV only escapes double quotes; title beginning =, +, -, @ executes as formula when opened in spreadsheet.

**Rate-limiting gaps and proxy blindness**: Only login is limited (20/15m) — forgot-password unlimited (mass resets + queue flooding), refresh/change-password also unlimited. app.js never sets trust proxy, so behind proxy every client shares one bucket; naive trust proxy: true would allow spoofed IPs.

**mustChangePassword is not enforced**: Router guard is empty comment; backend authJwt only checks status === 'ATIVO'.

### Existing Tests

- backend/tests/authz/*, voting.test.js, env-gate.test.js, unit.test.js, batch.test.js — none cover report audit, CSV sanitization, rate-limit, or mustChangePassword 403; Phase 8 must add first coverage for these
- No existing CSV injection tests — 08-02 will add first
- No existing rate-limit or trust-proxy tests

### Transaction Patterns (Unchanged)

Reports are read-only aggregation (scopeFilter + take caps) — no transaction needed. Audit is fail-open (audit() swallows errors) — REP-01 audit-before-stream must be fail-open too (log but still stream) to avoid DoS on audit DB failure.

---

## Decisions Captured

### Implementation Decisions

#### REP-01: Audit-Before-Stream Placement

**Decision**: **Audit before any format branch (recommended)**. At the top of each report handler (requests, financial, voting, accountability, dashboard, dashboard-pdf), before `if (format==='csv')` / `if (format==='pdf')` / `res.json`, call:

```javascript
await audit({ actorId: req.user.id, action: 'report_exported', entityType: 'report', entityId: '<report>-<format>', req }).catch(e => logger.warn({err:e.message}, 'report audit failed'));
```

- This satisfies success criterion #1: "before any bytes stream to the client"
- Audit is **fail-open**: catch and warn, but still stream the export — prevents audit DB outage from blocking reports
- Keep existing PDF audits but move them before pipe/send as well (currently after pipe, before return — too late)
- Distinct audit for forced password reset: when password is reset via admin force (force-password-reset route), audit action is `forced_password_reset` not `password_reset_requested` — already in userController but ensure 08-01 uses correct action if touching that route

**Files to modify**:
- backend/src/routes/reports.routes.js — all 6 handlers (requests, financial, voting, accountability, integration stub, dashboard, dashboard-pdf) — add audit before format switch

---

#### REP-02: CSV Formula-Injection Neutralization

**Decision**: **Prefix with single quote `'` (recommended OWASP prefix)**. Create utility `function sanitizeCSVCell(v) { const s = String(v ?? ''); const needs = /^[=+\-@\t\r\n]/.test(s) || /^[＝＋－＠]/.test(s); return needs ? `'${s}` : s; }` and wrap toCSV escaping after sanitization:

```javascript
function toCSV(rows, cols) {
  const esc = (v) => {
    let s = sanitizeCSVCell(v);
    return `"${String(s).replace(/"/g, '""')}"`;
  };
  return [cols.join(','), ...rows.map(r => cols.map(c => esc(r[c])).join(','))].join('\n');
}
```

- Covers leading `=` `+` `-` `@` `\t` `\r` `\n` and full-width variants `＝` `＋` `－` `＠` (U+FF1D etc.)
- Preserves data visibly (`'=2+2` shows as '=2+2 with leading quote in spreadsheet but breaks formula) — standard OWASP "prefix with single quote" approach
- Do NOT strip the leading char (data loss) and do NOT use tab prefix (more invisible but non-standard)
- Apply to all CSV exports via the single toCSV helper — no per-route duplication
- Consider also handling cells where first non-whitespace after trim starts with trigger char (after leading spaces) — but for v1 only check first character per criterion's literal list

**Files to modify**:
- backend/src/routes/reports.routes.js — toCSV helper and sanitizeCSVCell utility

---

#### SEC-03: Auth Rate-Limits + Trust Proxy + Uniform 401

**Decision**: **Per-route limits + trust proxy 1 + uniform 401 with 423 preserved (recommended)**.

- **Rate limits** (windowMs 15 min for all):
  - login: 20/15m (existing, keep)
  - refresh: 60/15m (generous — supports single-flight retry storm protection but not strict)
  - forgot-password: 5/15m (tight — prevents mass reset + EmailQueue flooding, also protects queue)
  - change-password: 20/15m (moderate)
  - Use express-rate-limit with memory store (single-process compose — no external store needed per Out of Scope)

- **Trust proxy**: `app.set('trust proxy', 1)` in backend/src/app.js — explicit hop count for Cloudflare Tunnel single-hop topology (never bare `true` which trusts any X-Forwarded-For and allows spoof)

- **Uniform 401**: In authController.login, collapse credential errors to uniform 401:
  - `if (!user) return 401 'Credenciais inválidas'` (was 401 already — keep)
  - `if (user.status !== 'ATIVO') return 401 'Credenciais inválidas'` (was 403 — change to 401 to avoid enumeration)
  - Keep `if (lockedUntil > now) return 423 'Conta temporariamente bloqueada'` distinct (lockout signal stays — required)
  - Keep `if (!ok) return 401` for bad password (already uniform)
  - This removes account enumeration (active vs inactive vs nonexistent) while preserving lockout 423

**Files to modify**:
- backend/src/app.js — add app.set('trust proxy', 1) before helmet/cors
- backend/src/routes/auth.routes.js — add limiters for refresh, forgot-password, change-password (keep loginLimiter, create 3 new)
- backend/src/controllers/authController.js — change inactive 403 → 401 uniform (keep 423 for locked)

---

#### SES-02: mustChangePassword Enforcement (Backend 403 Allowlist + Frontend Guard)

**Decision**: **403 allowlist in authJwt + router guard branch (recommended, backend + frontend land together)**.

- **Backend** (auth.js authJwt):
  ```javascript
  // After loading user and checking ATIVO
  if (user.mustChangePassword) {
    const allowlist = ['/api/auth/change-password', '/api/auth/me', '/api/auth/refresh', '/api/auth/logout'];
    // Also allow GET /health?
    if (!allowlist.some(p => req.path.startsWith(p) || req.originalUrl.startsWith(p))) {
      return res.status(403).json({ error: 'Troca de senha obrigatória' });
    }
  }
  ```
  - Allowlist is exactly: change-password, me, refresh, logout — per success criterion #4 (change-password, me, refresh, logout) — note: criterion says change-password, me, refresh, logout — implement as path prefix match
  - Return 403 with error 'Troca de senha obrigatória' — frontend can detect and redirect
  - After successful changePassword, mustChangePassword is cleared (already does), full access restored immediately (no need to re-login)

- **Frontend** (router/index.js):
  - Create or reuse view for password change (existing Login or new /change-password route)
  - Update beforeEach:
    ```javascript
    if (auth.user?.mustChangePassword && to.path !== '/change-password' && to.path !== '/login') {
      return '/change-password';
    }
    ```
  - Add route: { path: '/change-password', component: ChangePassword, meta: { auth: true } } — if ChangePassword.vue doesn't exist, create minimal form (currentPassword + newPassword, calls POST /api/auth/change-password, on success auth.me() refresh and redirect to '/')
  - Keep banner on dashboard as well if needed, but hard redirect is primary
  - End-to-end temp-password loop test: create user with mustChangePassword true via seed or API, login with temp, assert 403 on /api/requests, navigate, change password, assert full access — backend + frontend guard land together per 08-04

- **Dependency**: Reset emails work because Phase 7 drains EmailQueue (JOB-01) — ensures temp password actually arrives

**Files to modify**:
- backend/src/middlewares/auth.js — add mustChangePassword 403 gate with allowlist after ATIVO check
- frontend/src/router/index.js — add mustChangePassword redirect branch + /change-password route
- frontend/src/views/ChangePassword.vue — new view (or repurpose Login) — minimal form with validation (8 chars) and error display

---

## Deferred Ideas (Not in Scope)

None captured for this phase — Phase 8 is the final milestone phase; all out-of-scope items already parked in PROJECT.md:

- Horizontal scaling / pagination of list caps — no user volume yet
- TypeScript / lint adoption — per AGENTS.md
- MFA / OIDC SSO — product decision for UTFPR IT
- CSRF tokens — sameSite:lax + CORS accepted residual per docs/11
- Refresh rotation / tokenVersion — deferred to post-SES-01 milestone

---

## Next Steps for Downstream Agent

After planning and implementation:

1. **Add audit before stream** in reports.routes.js for every export format (CSV/JSON/PDF) before any if-format branch, fail-open (08-01)
2. **Sanitize CSV cells** via sanitizeCSVCell prefix with single quote for OWASP triggers including full-width variants, via single toCSV helper (08-02)
3. **Rate-limit all auth mutation routes** with per-route limits (login 20, refresh 60, forgot 5, change 20 per 15m), set trust proxy 1, make login 401 uniform while keeping 423 lockout distinct (08-03)
4. **Enforce mustChangePassword** via 403 allowlist in authJwt (change-password, me, refresh, logout) + frontend router guard to /change-password, with end-to-end temp-password loop test (08-04)
5. **Verify** four success criteria: CSV/JSON audited before stream, CSV injection neutralized (open in spreadsheet no formula), rate limits with correct IPs behind proxy and uniform 401, mustChangePassword 403 + router redirect with full restore after change (reset emails work)

---

*Phase context captured: 2026-09-25 — ready for planning → implementation*
