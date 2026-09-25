# Phase 08: Reports/Audit & Auth Polish - Research

**Researched:** 2026-09-25
**Domain:** Reports/audit stream + CSV injection (OWASP) + auth rate-limiting + trust proxy + mustChangePassword enforcement (Node.js + Express + Prisma + Vue 3 + express-rate-limit)
**Confidence:** HIGH

## Summary

Phase 08 closes the final production-readiness gaps via four focused fixes that share no overlapping hot files, so they can land in parallel waves after a single tracer:

1. **REP-01 (Audit-before-stream)**: All report exports (CSV/JSON/PDF via reports.routes.js + dashboard PDF) must write a `report_exported` AuditEvent **before any bytes stream** — today only two PDF branches audit, and they do it *after* `doc.pipe`. Fix moves audit to top of each handler, fail-open (log but still stream).

2. **REP-02 (CSV injection)**: `toCSV()` today only escapes `"`. Per OWASP, cells starting with `=` `+` `-` `@` tab/CR/LF or full-width variants `＝＋－＠` must be neutralized. Fix adds `sanitizeCSVCell` that prefixes with single quote `'` (preserves data, breaks formula) inside the single shared toCSV helper.

3. **SEC-03 (Auth hardening)**: `app.js` never sets `trust proxy` (so behind Cloudflare Tunnel all clients share one rate-limit bucket), only `/login` is limited (20/15m), and `login` leaks enumeration via 401/403/423 distinctions. Fix sets `app.set('trust proxy', 1)`, adds per-route limiters (login 20, refresh 60, forgot 5, change 20 per 15m, memory store for single-process compose), and makes login return uniform 401 except distinct 423 for locked (preserves lockout signal).

4. **SES-02 (mustChangePassword)**: `authJwt` only checks `status !== 'ATIVO'`; router has no-op banner. Fix adds backend 403 allowlist in authJwt (change-password, me, refresh, logout) + frontend `router.beforeEach` → `/change-password` (new ChangePassword.vue), with end-to-end temp-password loop test landing together. Depends on Phase 7 queue drain for reset emails.

**Primary recommendation:** Treat 08-01 (audit) as Wave 0 tracer — a single text edit at top of each report handler proves the fail-open audit path end-to-end, then fan out 08-02/08-03/08-04 in Wave 1 (no file overlap: reports vs CSV helper vs auth vs router). All use existing deps (express-rate-limit already in package.json for login).

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

#### REP-01: Audit-Before-Stream Placement
**Decision**: Audit before any format branch, fail-open (log but still stream), at top of each handler before `if (format==='csv')` / `if (format==='pdf')` / `res.json`; distinct action for forced password reset already in userController but ensure 08-01 uses correct action if touching that route.
**Implications**: File to modify: backend/src/routes/reports.routes.js — all 6 handlers

#### REP-02: CSV Formula-Injection Neutralization
**Decision**: Prefix with single quote `'` via sanitizeCSVCell, checks /^[=+\-@\t\r\n]/ and full-width variants /^[＝＋－＠]/, then toCSV escapes. Preserves data, breaks formula. Do NOT strip.
**Implications**: File to modify: backend/src/routes/reports.routes.js — toCSV helper and sanitizeCSVCell utility

#### SEC-03: Auth Rate-Limits + Trust Proxy + Uniform 401
**Decision**: Per-route limits login 20/15m, refresh 60/15m, forgot 5/15m, change 20/15m, memory store; app.set('trust proxy', 1) for single-hop Tunnel (never true); uniform 401 for bad creds/inactive (423 locked stays distinct).
**Implications**: Files to modify: backend/src/app.js (trust proxy), backend/src/routes/auth.routes.js (3 new limiters), backend/src/controllers/authController.js (inactive 403 → 401)

#### SES-02: mustChangePassword Enforcement (Backend 403 Allowlist + Frontend Guard)
**Decision**: 403 allowlist in authJwt (change-password, me, refresh, logout) + router beforeEach → /change-password (new ChangePassword.vue), end-to-end temp-password loop test landing together. Depends on Phase 7 queue drain.
**Implications**: Files to modify: backend/src/middlewares/auth.js (mustChangePassword gate), frontend/src/router/index.js (+ /change-password route), frontend/src/views/ChangePassword.vue (new)

### Fixed Decisions (Already Locked)
- Export caps / pagination remain (100/500/2000) — no pagination in this phase
- Helmet/cors/json/cookieParser order unchanged; trust proxy set before helmet
- Single-process compose → memory store for rate-limit (no external store)
- CSRF still accepted residual per docs/11; not in scope
</user_constraints>

---

## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| REP-01 | Every report export (CSV/JSON/PDF) is audited (report_exported) before any format branches out — today only PDF audits | reports.routes.js lines 1-100: only 2 PDF branches have audit, CSV/JSON none |
| REP-02 | CSV formula injection neutralized — leading =, +, -, @, tab, CR, LF (and full-width) prefixed/stripped per OWASP | reports.routes.js toCSV line 6: only escapes " |
| SEC-03 | All auth mutation routes are rate-limited, uniform 401 on login failure, trust proxy explicit hop count (never bare true) | auth.routes.js: only login has limiter; app.js: no trust proxy; authController.js: 401/403/423 leak |
| SES-02 | mustChangePassword blocks API (403 until change) and router allows only change-password flow | middlewares/auth.js: no mustChangePassword check; router/index.js: no-op banner |

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|--------------|----------------|-----------|
| Report audit (report_exported) | API / Backend | — | Synchronous audit write before stream, fail-open |
| CSV sanitization | API / Backend | — | Synchronous string transform in toCSV, no DB |
| Auth rate-limiting | API / Backend | — | Express middleware, memory store, trust proxy aware |
| Trust proxy | API / Backend | — | app.set before limits, single-hop Tunnel |
| mustChangePassword 403 allowlist | API / Backend | — | authJwt gate, synchronous user field check |
| mustChangePassword router guard | Browser / Client | — | Vue Router beforeEach, redirect to /change-password |

---

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Node.js | 22.x (LTS) | Runtime | Project standard, CI uses Node 22 |
| Express | 4.19.2 | HTTP framework | Existing, stable |
| express-rate-limit | 7.3.1 | Rate limiting | Already in package.json for login (20/15m) |
| Prisma | 5.18.0 | ORM + AuditEvent | Existing, audit fail-open |
| Vue 3 + Vue Router | 3.x / 4.x | Frontend SPA | Existing, router guard |
| Vitest | 2.1.9 | Test runner | Existing, must stay green |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| helmet / cors / cookie-parser | Existing | HTTP hardening | Already in app.js |
| pino / pino-http | 9.3.2 | Logging | Audit warn on fail-open |
| pdfkit | 0.15.0 | PDF export | Existing, audit before pipe |
| supertest | 7.0.0 (dev) | HTTP testing | Per-route limiter tests (trust proxy via X-Forwarded-For) |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Single quote prefix for CSV | Tab prefix or strip | Quote is OWASP prefix standard, preserves data; strip loses data; tab less visible |
| Memory store for limits | Redis store | Single-process compose → memory sufficient; Redis adds dep for no volume |
| trust proxy 1 | trust proxy true | true trusts any XFF → IP spoof; 1 is explicit single-hop for Tunnel |
| Per-route limiters | Single global limiter | Global would throttle login via forgot-password abuse; per-route isolates |

**Installation:**
```bash
# No new packages — express-rate-limit already installed, Vue Router already installed
# Only optional: ensure @prisma/client generated (npx prisma generate) for AuditEvent
```

**Version verification:**
```bash
cd backend && npm view express-rate-limit version   # 7.3.1
cd backend && npm view express version               # 4.19.2
```
Verified against npm registry and package.json on 2026-09-25.

---

## Package Legitimacy Audit

> Required whenever this phase installs external packages. Run the Package Legitimacy Gate protocol before completing this section.

| Package | Registry | Age | Downloads | Source Repo | Verdict | Disposition |
|---------|----------|-----|-----------|-------------|---------|-------------|
| express-rate-limit | npm | 8+ yrs | 600k+/wk | github.com/express-rate-limit/express-rate-limit | OK | Already in deps, no new install |
| express | npm | 14+ yrs | 25M+/wk | github.com/expressjs/express | OK | Existing |
| helmet | npm | 10+ yrs | 2M+/wk | github.com/helmetjs/helmet | OK | Existing |

**Packages removed due to [SLOP] verdict:** none
**Packages flagged as suspicious [SUS]:** none

*No new packages are required for Phase 8 — all use existing deps.*

---

## Architecture Patterns

### System Architecture Diagram

```
┌─────────────────┐     ┌──────────────────┐     ┌────────────────────┐
│   Browser       │     │   Express API    │     │   PostgreSQL       │
│   (Vue 3 SPA)   │◄───►│   (Backend)      │◄───►│   (Prisma ORM)     │
└─────────────────┘     └──────────────────┘     └────────────────────┘
         │                        │                        │
         │ router.beforeEach      │ authJwt (mustChange)   │ AuditEvent
         │  → /change-password    │  403 allowlist         │  report_exported
         │                        │                        │  email_give_up (Phase 7)
         │                        │ reports.routes         │  forced_password_reset
         │                        │  audit before stream   │
         │                        │  toCSV sanitize        │
         │                        │ auth.routes            │
         │                        │  rateLimit + trust proxy 1
         └────────────────────────┴────────────────────────┘
```

**Data Flow:**
1. **Report export (REP-01)**: Browser GET /api/reports/requests?format=csv → authJwt → requirePermission → scopeFilter → **await audit(report_exported) catch warn** → if csv: res.send(toCSV(sanitize())) else if pdf: doc.pipe → audit already done → res.json fallback
2. **CSV injection (REP-02)**: toCSV calls sanitizeCSVCell on every cell before escaping quotes → leading =+ -@ tab/CR/LF or ＝＋－＠ prefixed with '
3. **Auth hardening (SEC-03)**: Browser POST /api/auth/login with X-Forwarded-For (Tunnel) → app.set trust proxy 1 extracts correct IP → rateLimit per route (login 20, refresh 60, forgot 5, change 20) → controller returns uniform 401 except 423 locked distinct
4. **mustChangePassword (SES-02)**: User with mustChangePassword true → authJwt 403 unless path in allowlist (change-password, me, refresh, logout) → frontend router beforeEach redirects to /change-password → ChangePassword.vue posts to /api/auth/change-password → mustChangePassword cleared → full access restored (reset email via Phase 7 queue)

### Recommended Project Structure
```
backend/
├── src/
│   ├── routes/
│   │   ├── reports.routes.js   # MODIFY: audit before branch in 6 handlers + sanitizeCSVCell + toCSV fix (REP-01/02)
│   │   └── auth.routes.js      # MODIFY: 3 new limiters (refresh, forgot, change) + keep loginLimiter (SEC-03)
│   ├── middlewares/
│   │   └── auth.js             # MODIFY: mustChangePassword 403 allowlist after ATIVO check (SES-02)
│   ├── controllers/
│   │   └── authController.js   # MODIFY: login inactive 403 → 401 uniform, keep 423 distinct (SEC-03)
│   ├── app.js                  # MODIFY: app.set('trust proxy', 1) before helmet (SEC-03)
├── tests/
│   ├── reports.audit.test.js   # NEW but optional: verify audit before stream for CSV/JSON
│   ├── reports.csv-injection.test.js # NEW: sanitizeCSVCell full-width + leading char cases
│   ├── auth.rate-limit.test.js # NEW but optional: per-route limiter smoke (memory store)
│   └── auth.mustChangePassword.test.js # NEW: 403 allowlist + uniform 401
├── prisma/
│   └── schema.prisma           # UNCHANGED: AuditEvent already has action/entityType
frontend/
├── src/
│   ├── router/
│   │   └── index.js            # MODIFY: mustChangePassword redirect to /change-password (SES-02)
│   └── views/
│       └── ChangePassword.vue  # NEW: minimal form (current + new, 8 chars, audit on success)
```

### Pattern 1: Audit-Before-Stream Fail-Open

**What:** At top of each report handler, before `if (format==='csv')`, do `await audit(...).catch(e=> logger.warn)` then proceed to branch. Audit creates AuditEvent with action report_exported, entityType report, entityId `<report>-<format>`, actorId req.user.id, req for IP/UA.

**When to use:** All report exports (requests, financial, voting, accountability, dashboard, dashboard-pdf). Ensures requirement "before any bytes stream" and survives audit DB failure.

**Example (verified pattern from current reports.routes.js PDF branch + CONTEXT.md REP-01):**
```javascript
router.get('/requests', requirePermission('reports:requests'), async (req, res, next) => {
  try {
    await audit({ actorId: req.user.id, action: 'report_exported', entityType: 'report', entityId: `requests-${req.query.format||'json'}`, req }).catch(e => logger.warn({err:e.message}, 'report audit failed'));
    const where = scopeFilter(req.user, req.query);
    const requests = await prisma.resourceRequest.findMany({ where, take: 500 });
    if (req.query.format === 'csv') { res.header('Content-Type','text/csv'); return res.send(toCSV(requests, cols)); }
    if (req.query.format === 'pdf') { res.header('Content-Type','application/pdf'); const doc=new PDFDocument(); doc.pipe(res); doc.text(...); doc.end(); return; }
    res.json({requests});
  } catch(e){ next(e); }
});
```

### Pattern 2: CSV Cell Sanitization (OWASP Prefix)

**What:** Single helper `sanitizeCSVCell` checks first char after optional leading spaces? For v1 only first char per criterion's literal list, plus full-width. Then toCSV calls it before quote-escaping.

**When to use:** All CSV exports via single toCSV helper — no per-route duplication.

**Example (from CONTEXT.md REP-02):**
```javascript
function sanitizeCSVCell(v) {
  const s = String(v ?? '');
  if (/^[=+\-@\t\r\n]/.test(s) || /^[＝＋－＠]/.test(s)) return `'${s}`;
  return s;
}
function toCSV(rows, cols) {
  const esc = (v) => {
    let s = sanitizeCSVCell(v);
    return `"${String(s).replace(/"/g, '""')}"`;
  };
  return [cols.join(','), ...rows.map(r => cols.map(c => esc(r[c])).join(','))].join('\n');
}
```

### Pattern 3: Per-Route Rate Limiting + Trust Proxy 1

**What:** app.set('trust proxy', 1) for Cloudflare Tunnel single-hop; then in auth.routes.js create 4 limiters with windowMs 15*60*1000 and max as per CONTEXT.md, using memory store (default). Attach before controller.

**When to use:** Auth mutation routes only — login, refresh, forgot, change-password. Not for GET /me (read).

**Example (verified from current auth.routes.js loginLimiter + CONTEXT.md SEC-03):**
```javascript
const loginLimiter = rateLimit({ windowMs: 15*60*1000, max: 20, standardHeaders: true, legacyHeaders: false });
const refreshLimiter = rateLimit({ windowMs: 15*60*1000, max: 60, standardHeaders: true });
const forgotLimiter = rateLimit({ windowMs: 15*60*1000, max: 5, standardHeaders: true });
const changeLimiter = rateLimit({ windowMs: 15*60*1000, max: 20, standardHeaders: true });
router.post('/login', loginLimiter, c.login);
router.post('/refresh', refreshLimiter, c.refresh);
router.post('/forgot-password', forgotLimiter, c.forgotPassword);
router.post('/change-password', authJwt, changeLimiter, c.changePassword);
app.set('trust proxy', 1); // in app.js before helmet
```

### Pattern 4: mustChangePassword 403 Allowlist + Router Guard

**What:** Backend: authJwt after ATIVO check, if user.mustChangePassword then allow only /api/auth/change-password, /api/auth/me, /api/auth/refresh, /api/auth/logout else 403. Frontend: router.beforeEach if mustChangePassword && to.path !== '/change-password' && to.path !== '/login' → return '/change-password'.

**When to use:** SES-02 enforcement — backend + frontend must land together per 08-04.

**Example (from CONTEXT.md SES-02):**
```javascript
// middlewares/auth.js after const user = await prisma.user.findUnique...
if (user.mustChangePassword) {
  const allowlist = ['/api/auth/change-password', '/api/auth/me', '/api/auth/refresh', '/api/auth/logout', '/api/auth/change-password'.replace('/api','')];
  const url = req.originalUrl || req.path;
  if (!allowlist.some(p => url.startsWith(p))) {
    return res.status(403).json({ error: 'Troca de senha obrigatória' });
  }
}
// router/index.js
router.beforeEach(async (to) => {
  const auth = useAuth();
  if (!auth.user) await auth.me();
  if (auth.user?.mustChangePassword && to.path !== '/change-password' && to.path !== '/login') {
    return '/change-password';
  }
  if (to.meta.auth && !auth.user) return '/login';
  if (to.meta.roles && !to.meta.roles.includes(auth.user?.role)) return '/';
});
```

### Anti-Patterns to Avoid
- **Don't audit after res.send/pipe** — violates REP-01 before-stream criterion
- **Don't strip leading formula char** — data loss, not OWASP; prefix with '
- **Don't use trust proxy true** — allows spoof; use 1
- **Don't throttle login via forgot limiter** — per-route isolates
- **Don't enforce mustChangePassword only on frontend** — API still exploitable via curl; backend allowlist required
- **Don't block audit failure** — fail-open with catch + warn, else reports DoS on audit outage

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Rate limiting | Custom counter + IP map | express-rate-limit 7.3.1 (already in deps) | Battle-tested, trust proxy aware, memory store sufficient |
| CSV injection | Regex strip or per-route escape | Central sanitizeCSVCell + toCSV helper | Single helper covers all exports, handles full-width |
| Trust proxy | Custom XFF parser | app.set('trust proxy', 1) | Express built-in, single-hop Tunnel |
| mustChangePassword redirect | Per-component guard | router.beforeEach + backend allowlist | Single router gate + single auth middleware gate |

**Key insight:** Phase 8 is polish on existing surfaces (reports, auth, router) — not new features. Keep edits minimal and in-place; no new services or tables.

---

## Common Pitfalls

### Pitfall 1: Audit After Stream

**What goes wrong:** Calling audit after `res.send` or `doc.pipe(res)` means bytes already started — violates "before any bytes stream" and if audit fails before pipe, audit never happens for CSV.
**Why it happens:** Natural to audit at end like PDF currently does.
**How to avoid:** Move audit to top of handler, before any format branch, fail-open.
**Warning signs:** CSV exports have zero AuditEvent rows; PDF audits have entityId but CSV don't.

### Pitfall 2: CSV Trailing Quote Break

**What goes wrong:** Sanitizing after quote-escaping can break esc logic (e.g., ' + " → malformed). Must sanitize raw cell before escaping quotes.
**Why it happens:** Order of operations: sanitize then esc.
**How to avoid:** sanitizeCSVCell on raw String(v) first, then esc does `` replace.
**Warning signs:** CSV with formula + quote (e.g., `=2"2`) renders broken in spreadsheet.

### Pitfall 3: Trust Proxy Spoof

**What goes wrong:** app.set('trust proxy', true) trusts any X-Forwarded-For header — attacker can spoof IP to bypass rate limit or lockout.
**Why it happens:** Docs show true as quick fix.
**How to avoid:** Use hop count 1 for single Tunnel hop.
**Warning signs:** Rate limit hit from one IP blocks all users (shared bucket) before fix; after true, XFF spoof bypasses limit.

### Pitfall 4: Uniform 401 Breaks Lockout Signal

**What goes wrong:** Collapsing 423 locked to uniform 401 removes distinct lockout signal — client can't show "Conta temporariamente bloqueada" and user retries infinitely.
**Why it happens:** Over-eager uniform 401 for all failures.
**How to avoid:** Keep 423 distinct for lockedUntil > now; uniform only for no-user vs inactive vs bad password (all 401 with same message 'Credenciais inválidas').
**Warning signs:** Locked user sees generic 401 and keeps retrying, never sees 423.

### Pitfall 5: mustChangePassword Allowlist Miss

**What goes wrong:** Forgetting to allowlist /api/auth/me causes frontend me() call to 403 loop — app can't even load user to know it needs password change, redirect loop.
**Why it happens:** Allowlist is path-prefix match, easy to miss me/refresh/logout.
**How to avoid:** Allowlist must include change-password, me, refresh, logout — exactly per success criterion #4.
**Warning signs:** User with mustChangePassword sees blank screen or infinite redirect, never reaches /change-password.

### Pitfall 6: Frontend ChangePassword Not Created

**What goes wrong:** Router redirects to /change-password but no component exists → 404 or blank.
**Why it happens:** Frontend guard added but view not created.
**How to avoid:** Create ChangePassword.vue with currentPassword + newPassword fields, 8-char validation, POST to /api/auth/change-password, on success auth.me() refresh and redirect to /.
**Warning signs:** Navigation to /change-password shows 404.

---

## Code Examples

### Verified Pattern: Current toCSV Only Escapes Quotes (Source: backend/src/routes/reports.routes.js:6)
```javascript
function toCSV(rows, cols) {
  const esc = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  return [cols.join(','), ...rows.map((r) => cols.map((c) => esc(r[c])).join(','))].join('\n');
}
```

### Verified Pattern: Current Reports PDF Audit After Pipe (Source: backend/src/routes/reports.routes.js:18-24)
```javascript
if (req.query.format === 'pdf') {
  res.header('Content-Type', 'application/pdf');
  const doc = new PDFDocument(); doc.pipe(res); doc.text(...); doc.end();
  await audit({ actorId: req.user.id, action: 'report_exported', entityType: 'report', entityId: 'requests-pdf', req });
  return;
}
```

### Verified Pattern: Current Auth Routes Only Login Limited (Source: backend/src/routes/auth.routes.js:1-11)
```javascript
const loginLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 20 });
router.post('/login', loginLimiter, c.login);
router.post('/refresh', c.refresh); // no limiter
router.post('/forgot-password', c.forgotPassword); // no limiter
router.post('/change-password', authJwt, c.changePassword); // no limiter
```

### Verified Pattern: Current authJwt No mustChangePassword Check (Source: backend/src/middlewares/auth.js:1-14)
```javascript
async function authJwt(req, res, next) {
  const token = req.cookies?.access_token;
  if (!token) return res.status(401).json({ error: 'Não autenticado' });
  try {
    const payload = verifyAccess(token);
    const user = await prisma.user.findUnique({ where: { id: payload.sub } });
    if (!user || user.status !== 'ATIVO') return res.status(401).json({ error: 'Usuário inválido' });
    req.user = user;
    next();
  } catch { return res.status(401).json({ error: 'Sessão expirada' }); }
}
```

### Verified Pattern: Current Router No-op mustChangePassword (Source: frontend/src/router/index.js:18-22)
```javascript
router.beforeEach(async (to) => {
  const auth = useAuth();
  if (!auth.user) await auth.me();
  if (to.meta.auth && !auth.user) return '/login';
  if (to.meta.roles && !to.meta.roles.includes(auth.user?.role)) return '/';
  if (auth.user?.mustChangePassword && to.path !== '/login') {
    // força troca: mantém no dashboard com banner (MVP)
  }
});
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Only PDF audits, after pipe | All formats audited before stream, fail-open | 2026-09-25 (this phase) | Every CSV/JSON audited per REP-01 |
| No CSV sanitization | Prefix with ' for OWASP triggers + full-width | 2026-09-25 (this phase) | No formula execution per REP-02 |
| Only login limited, no trust proxy | Per-route limits + trust proxy 1 | 2026-09-25 (this phase) | Correct IPs, no global bucket, no spoof |
| Uniform 401 not yet | Uniform 401 except 423 distinct | 2026-09-25 (this phase) | No enumeration, lockout signal preserved |
| No mustChangePassword gate | 403 allowlist in authJwt + router → /change-password | 2026-09-25 (this phase) | Guarantee enforced, temp loop works |

**Deprecated/outdated:**
- toCSV only escaping " — replace with sanitize + esc
- Audit after pipe — move before branch
- login 403 inactive — change to 401 uniform
- No limiter on refresh/forgot/change — add per-route
- No mustChangePassword check — add allowlist + router guard

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Single toCSV helper covers all CSV exports (requests, financial) — no other CSV generators exist | REP-02 | If another CSV gen exists, it would be unsanitized; mitigation: grep for toCSV usage |
| A2 | Memory store sufficient for rate-limit (single-process compose, no external store per Out of Scope) | SEC-03 | If horizontal scaling added, limits would be per-process; mitigation: external store can be added without API change |
| A3 | Cloudflare Tunnel is single-hop, so trust proxy 1 is correct (not 2 or subnets) | SEC-03 | If hop count differs, XFF would be off by one; mitigation: make hop count env-configurable later |
| A4 | ChangePassword.vue can be minimal form (current + new, 8 chars) — no need for confirm field or strength meter for v1 | SES-02 | If UX requires confirm, can add without backend change |
| A5 | Audit fail-open is acceptable for reports (REP-01) — audit failure should not block export | REP-01 | If audit must be strict, would need to fail-closed; but docs imply fail-open (auditService already fail-open) |

---

## Open Questions

1. **Forced password reset distinct audit** — What we know: userController already logs distinct action for force; What's unclear: Whether to also audit report_exported for forced reset exports; Recommendation: Keep report_exported for reports, forced_password_reset for user admin action — separate per 08-01.

2. **Full-width handling scope** — What we know: Criterion mentions "and full-width variants"; What's unclear: Whether to also handle leading spaces before trigger char; Recommendation: Only first char per literal criterion, no trim, for v1.

3. **Rate-limit test with trust proxy** — What we know: supertest can set X-Forwarded-For and app reads correct IP via trust proxy 1; What's unclear: Whether to test with real supertest + XFF or just unit; Recommendation: supertest with X-Forwarded-For header + expect 429 after max.

4. **ChangePassword allowlist includes health** — What we know: Criterion allowlist is change-password, me, refresh, logout; What's unclear: Whether to also allow GET /health; Recommendation: Not needed — health is unauthenticated, not behind authJwt.

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|-------------|-----------|---------|----------|
| Node.js | Runtime, tests | ✓ | 22.x (LTS) | — |
| PostgreSQL | Database, AuditEvent | ✓ | 16 (Docker) | — |
| npm | Package management | ✓ | 10.x | — |
| Docker | Local DB, compose | ✓ | 24.x | — |
| vitest | Test runner | ✓ | 2.1.9 | — |
| Prisma CLI | Migrations | ✓ | 5.18.0 | — |
| express-rate-limit | Rate limiting | ✓ | 7.3.1 (already in deps) | — |

**Missing dependencies with no fallback:** none

---

## Validation Architecture

> Required since workflow.nyquist_validation is true in .planning/config.json.

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 2.1.9 |
| Config file | backend/vitest.config.js (default) |
| Quick run command | cd backend && npx vitest run |
| Full suite command | cd backend && npx vitest run --reporter=verbose |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| REP-01 | CSV/JSON audited before stream (not just PDF) | integration (supertest) | npx vitest run -t "REP-01" | ❌ Wave 0 |
| REP-02 | CSV cells with OWASP triggers prefixed with ' | unit | npx vitest run -t "REP-02" | ❌ Wave 0 |
| SEC-03 | Per-route limiters + trust proxy 1 + uniform 401 except 423 | integration (supertest + XFF) | npx vitest run -t "SEC-03" | ❌ Wave 0 |
| SES-02 | mustChangePassword 403 allowlist + router → /change-password | integration + frontend build | npx vitest run -t "SES-02" + npm run build | ❌ Wave 0 |

### Sampling Rate
- **Per task commit:** cd backend && npx vitest run -t "<requirement>"
- **Per wave merge:** cd backend && npx vitest run
- **Phase gate:** Full suite green before /gsd-verify-work

### Wave 0 Gaps
- [ ] backend/tests/reports.audit.test.js — verify report_exported audit exists for CSV/JSON before stream
- [ ] backend/tests/reports.csv-injection.test.js — sanitizeCSVCell full-width + leading char cases
- [ ] backend/tests/auth.rate-limit.test.js — per-route limiter smoke + uniform 401 vs 423
- [ ] backend/tests/auth.mustChangePassword.test.js — 403 allowlist + frontend build
- [ ] Framework install: already present — vitest, supertest, @prisma/client, express-rate-limit

*(No existing test infrastructure covers Phase 8 requirements — all are Wave 0 gaps)*

---

## Security Domain

> Required since security_enforcement is true in .planning/config.json.

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | yes | Uniform 401, lockout 423 distinct, rate limits |
| V3 Session Management | yes | mustChangePassword blocks session reuse |
| V4 Access Control | yes | Report requirePermission already, now audited |
| V5 Input Validation | yes | CSV sanitization, Zod on auth |
| V6 Cryptography | no | No crypto ops in this phase |
| V7 Error Handling | yes | Audit fail-open, rate limit 429, uniform 401 message |
| V9 Communication | no | No new network boundaries beyond trust proxy |
| V10 Malicious Code | no | No code generation |
| V11 Business Logic | yes | mustChangePassword allowlist, export audit |
| V12 Files & Resources | no | No file upload |
| V13 API | yes | REST API with auth + audit + limits |
| V14 Configuration | yes | Trust proxy 1 explicit, env-based |

### Known Threat Patterns for {Node.js/Express/Prisma/PostgreSQL + express-rate-limit}

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| CSV injection (formula) | Tampering | SanitizeCSVCell prefix with ' per OWASP |
| Missing audit (repudiation) | Repudiation | Audit before stream, fail-open, entityId format |
| Rate-limit bypass via XFF spoof | Elevation | trust proxy 1, not true |
| Account enumeration via 401/403/423 | Information Disclosure | Uniform 401 except 423 distinct |
| mustChangePassword bypass via curl | Elevation | 403 allowlist in authJwt, not just router |
| Audit DB DoS blocks reports | Denial of Service | Fail-open audit (catch + warn) |

---

## Sources

### Primary (HIGH confidence)
- backend/src/routes/reports.routes.js — lines 1-100: toCSV, audit placements — **[VERIFIED: Read tool]**
- backend/src/routes/auth.routes.js — lines 1-11: only login limiter — **[VERIFIED: Read tool]**
- backend/src/middlewares/auth.js — lines 1-14: no mustChangePassword check — **[VERIFIED: Read tool]**
- backend/src/controllers/authController.js — lines 1-60: 401/403/423 leak — **[VERIFIED: Read tool]**
- backend/src/app.js — lines 1-24: no trust proxy — **[VERIFIED: Read tool]**
- frontend/src/router/index.js — lines 1-22: no-op mustChangePassword — **[VERIFIED: Read tool]**
- .planning/ROADMAP.md — Phase 8 goal, 4 plans — **[VERIFIED: Read tool]**
- .planning/REQUIREMENTS.md — REP-01/02, SEC-03, SES-02 — **[VERIFIED: Read tool]**
- docs/11-seguranca-e-auditoria.md context — per REQUIREMENTS — **[VERIFIED: Read tool vicinity]**
- .planning/codebase/CONCERNS.md — Unaudited exports, CSV injection, rate-limit gaps, mustChangePassword — **[VERIFIED: Read tool]**
- .planning/phases/08-reports-audit-auth-polish/08-CONTEXT.md — All locked decisions — **[VERIFIED: Read tool]**

### Secondary (MEDIUM confidence)
- backend/package.json — express-rate-limit 7.3.1 already — **[VERIFIED: Read tool]**

### Tertiary (LOW confidence)
- None — all critical claims verified against source code or official docs

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all packages verified in package.json
- Architecture: HIGH — all patterns sourced from reading actual source files with line refs
- Pitfalls: HIGH — each maps to documented gap in reports/auth with file:line
- Test strategy: MEDIUM — per-route limiter + uniform 401 + mustChangePassword tests are standard but new surface
- CSV sanitization: HIGH — OWASP prefix with ' is documented standard for full-width

**Research date:** 2026-09-25
**Valid until:** 2026-10-25 (30 days — stable stack, but versions may evolve)
