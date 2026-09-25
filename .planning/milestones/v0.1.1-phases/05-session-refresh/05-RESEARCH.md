# Phase 05: Session Refresh - Research

**Researched:** 2026-09-24
**Domain:** Frontend session continuity — axios 401 interceptor (single-flight refresh + retry-once + bounce)
**Confidence:** HIGH

## Summary

SES-01 is a frontend-only phase: the shared axios instance in `frontend/src/services/api.js` (currently a 2-line module with no interceptor) gains a single-flight 401 response interceptor that awaits one shared `POST /auth/refresh` promise, replays the original request once (`_retry` guard), and on refresh failure bounces exactly once via `window.location.assign` — never importing the router (import cycle). The backend already supports this flow unchanged: `refresh` sets a new 15-minute `access_token` cookie and returns `{ ok: true }`, failing with 401 `Sem refresh` / `Inválido` / `Refresh expirado`. `Login.vue` gains the locked session-expired notice plus `?redirect` return-to-origin handling, and `Requests.vue` gains a best-effort `sessionStorage` draft-restore read. Zero new dependencies — axios `^1.20.0` is already installed.

**Primary recommendation:** Implement the canonical single-flight interceptor (module-level shared refresh promise + `isRedirecting` flag + per-request `_retry`) strictly inside `api.js`, with 401-only triggering, `window.location.assign('/login?reason=session-expired&redirect=<origem>')` on refresh death, and the amended Login/Requests handling — no backend changes, no new files.

## User Constraints (from CONTEXT.md)

### Locked Decisions

**Retorno pós-login (post-expiry landing)**
- **D-01:** Após sessão expirada + re-login, voltar à origem (onde o usuário estava), com fallback para o dashboard `/` quando não houver destino guardado.
- **D-02:** O destino viaja estendendo a query do bounce: `/login?reason=session-expired&redirect=<origem>`. **AMENDS 05-UI-SPEC** Navigation contract (que trava só `?reason=session-expired`) — o planner deve levar a forma estendida adiante verbatim e tratar a UI-SPEC como atualizada neste ponto. — **Reversibility:** costly — undo toca o contrato de navegação partilhado entre interceptor e Login (bounce, leitura do redirect, fallback) em dois ficheiros acoplados.
- **D-03:** Sem `redirect` (visita manual a `/login`, navegação direta), o pós-login cai no comportamento atual `router.push('/')`.
- **D-04:** `redirect` validado como path interno apenas: começa com `/` único, sem `//`, sem esquema/host. Qualquer outro valor é descartado e cai no fallback dashboard (proteção contra open-redirect).

**Aviso de sessão expirada (Login notice)**
- **D-05:** Após montar o aviso a partir de `location.search`, limpar `?reason` (e `?redirect` após consumo) via `history.replaceState` — URL limpa; refresh posterior no login esconde o aviso.
- **D-06:** O `.alert.warn` persiste até o login dar certo — digitar não o dispensa; conserva o contexto do porquê o usuário caiu ali.
- **D-07:** Coexistência empilhada: `.alert.warn` acima, `div.alert.error[role=alert]` abaixo/quando houver erro de credenciais — papéis nunca misturados (warn jamais exibe erro de credencial, error jamais usa `.alert.warn`).
- **D-08:** Copy verbatim travada pela UI-SPEC, sem reescrever: `Sua sessão expirou. Entre novamente para continuar.` (`role="status"`).

**Rascunho não salvo (forced-logout data loss)**
- **D-09:** Preservação best-effort **só em Requests** (formulário crítico: título/justificativa/valor). Demais views aceitam a perda no reload — **AMENDS 05-UI-SPEC** two-file boundary só no sentido de *ler* sessionStorage em Requests; nenhum ficheiro novo em `frontend/`. — **Reversibility:** costly — undo remove o acoplamento interceptor→sessionStorage→Requests (snapshot, leitura, limpeza) em três pontos.
- **D-10:** Mecanismo `sessionStorage`, chave fixa única + JSON (sugestão: `sgrf:pending-draft` com `{title, justification, valueCents, …}`); cada bounce sobrescreve (1 slot).
- **D-11:** Ciclo de vida: limpa ao restaurar no mount de Requests E ao submeter com sucesso; parse/shape inválido descarta silencioso e o form abre vazio normal (best-effort nunca bloqueia login/redirect).
- **D-12:** Same-origin basta — `sessionStorage` é por origem e por aba; sem criptografia no MVP.
- **D-13:** Views não-Requests ignoram a chave; snapshot órfão (redirect para outra view) é limpo na próxima restauração em Requests.

**Bounce multi-aba**
- **D-14:** Sem canal sync cross-tab. Single-flight segue por aba (promise partilhada em módulo); cada aba percebe a morte no seu próximo 401/`me` (cookies partilhados) e faz o próprio bounce levando seu próprio `location` como `redirect` (descoberta passiva, zero código sync).

### the agent's Discretion
- String exata da chave sessionStorage (sugestão `sgrf:pending-draft` acima é não-normativa) e campos exatos do snapshot JSON.
- Momento exato do `replaceState` (no mount após leitura vs após primeiro render) e ponto de captura do `redirect` (pathname+search da aba no instante do bounce).
- Ordem de limpeza warn/error em fluxos finos não cobertos acima.
- Nada do fluxo foi delegado como "você decide" — todas as escolhas acima são do usuário; a lista aqui é só micro-detalhe.

### Deferred Ideas (OUT OF SCOPE)
- `trust proxy` + rate-limit expansion atrás do Tunnel (SEC-03, Phase 8) — taxa generosa em `/auth/refresh` deve considerar o refresh silencioso desta fase.
- UX completa de troca forçada de senha (SES-02, Phase 8) — o interceptor desta fase só precisa não engolir o 403 correspondente.
- Sync cross-tab ativo (storage-event push, lock global de refresh) — rejeitado nesta discussão em favor de descoberta passiva; revisitar só com evidência de storm real entre abas.
- Preservação de rascunho em views além de Requests — fora do MVP; reavaliar se perda virar reclamação.

## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| SES-01 | Users stay logged in past 15 minutes — single-flight 401 response interceptor on the shared axios instance refreshes once (`POST /auth/refresh`) and retries the original request; redirect to login only when refresh itself fails; no router import (import cycle) | Interceptor pattern (§ Architecture Patterns), backend refresh contract (§ Standard Stack), manual verification protocol (§ Validation Architecture) |

## Project Constraints (from AGENTS.md)

- Two packages, **no workspaces** — run commands inside `backend/` or `frontend/`.
- Frontend has **no tests** (`npm test` fails by design) — verify with `cd frontend && npm run build`. No lint/typecheck configured; do not invent those commands.
- CI gate: every push to `main` must pass `backend` (`npx vitest run`) + `frontend` (`npm run build`); land via PR under required checks.
- Auth: `@utfpr.edu.br`-only email; JWT in httpOnly cookies; frontend axios uses `baseURL: '/api'` + `withCredentials: true`; backend requires correct `FRONTEND_URL` in CORS (with credentials).
- Frontend dev proxy `/api` → `http://localhost:3000`; in production the backend must serve/be behind the same `/api` origin.
- Money is integer cents; IDs are UUID strings; no raw SQL (irrelevant here except the `valueCents` snapshot field).
- Never commit: `backend/.env`, `*.db*`, `backend/uploads/*`.
- Domain docs `docs/03, 06, 07, 08` + `backend/openapi.yaml` govern request logic — not touched by this phase.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Silent token refresh + retry | Browser / Client (shared axios instance) | — | Refresh is a transport concern; the httpOnly cookies are sent automatically, so the client only needs response-interceptor logic — no backend change |
| Session-death bounce | Browser / Client (`window.location.assign`) | — | Full reload clears in-memory Pinia state and avoids the `api.js ⇄ router` import cycle |
| Post-login return-to-origin | Browser / Client (Login.vue + vue-router) | — | Login already owns `router.push('/')`; extending it with a validated `?redirect` composes with the existing `beforeEach` guard |
| Draft preservation | Browser / Client (sessionStorage) | — | Same-origin per-tab storage; no server round-trip needed for best-effort form restore |

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| axios | `^1.20.0` [VERIFIED: frontend/package.json:16] — `"axios": "^1.20.0"` | Shared HTTP client; `axios.create` instance + `interceptors.response.use` for 401 handling | Already the app's only HTTP layer; interceptors are its documented extension point for exactly this auth-refresh pattern |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| vue-router | `^4.6.4` [VERIFIED: frontend/package.json:20] | Post-login `router.push(redirect)` in Login.vue only | Never imported by `api.js` — bounce uses `window.location.assign` |
| pinia | `^4.0.3` [VERIFIED: frontend/package.json:18] | Auth store `user` cleared on bounce | Bounce path resets `user` so the guard converges |
| Web `sessionStorage` + `history.replaceState` | browser-native | Draft snapshot (1 slot, JSON) + query cleanup | Zero deps; per-origin per-tab semantics match D-12 |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `window.location.assign` bounce | `router.push` from interceptor | Rejected: creates `api.js ⇄ router/index.js ⇄ stores/auth.js ⇄ api.js` import cycle; full reload also clears stale Pinia state |
| Shared refresh promise | Per-request refresh / request queue with retry | Per-request refresh causes refresh storms; a queued-retry manager is over-engineering for one silent retry |
| Cross-tab sync (storage events, shared lock) | Passive per-tab discovery (D-14) | Rejected in CONTEXT: shared cookies already converge tabs; revisit only with evidence of a real cross-tab storm |

**Installation:** none — zero new deps this phase.

**Version verification:** `axios: ^1.20.0` confirmed by Read of `frontend/package.json` this session [VERIFIED: frontend/package.json:15-21].

## Package Legitimacy Audit

No external packages are installed by this phase. `axios` is a pre-existing dependency (8+ yrs, ~50M/wk, github.com/axios/axios) — no audit needed, no `checkpoint:human-verify` required.

**Packages removed due to SLOP verdict:** none.
**Packages flagged as suspicious (SUS):** none.

## Architecture Patterns

### System Architecture Diagram

```
[Browser tab]  API call via shared axios instance (baseURL '/api', withCredentials)
      │
      ▼ 401 (access cookie expired, 15m TTL)
[api.js response interceptor] ── _retry already set? ──yes──▶ reject to view (existing err alert)
      │ no: set _retry, join/launch single shared POST /auth/refresh promise
      ▼
[Express POST /auth/refresh] ── valid 7d refresh cookie? ──yes──▶ Set-Cookie access_token, { ok:true }
      │                                                              │ interceptor replays original request once
      │ no: 401 Sem refresh / Inválido / Refresh expirado            ▼ original request succeeds — user sees nothing
      ▼
[interceptor] snapshot Requests draft → sessionStorage (best-effort) → clear auth user →
  window.location.assign('/login?reason=session-expired&redirect=<origem>') exactly once
      ▼
[Login.vue] reads ?reason → .alert.warn notice; reads+validates ?redirect → replaceState cleanup →
  auth.login → router.push(validated redirect | '/')
      ▼
[Requests.vue mount] reads+clears sessionStorage snapshot → restores draft (or opens empty on bad shape)
```

### Recommended Project Structure

No new files. Edits only (per amended boundary):
```
frontend/src/
├── services/api.js      # + response interceptor (ONLY interceptor location)
├── views/Login.vue      # + warn notice, ?reason/?redirect handling, validated push
└── views/Requests.vue   # + sessionStorage snapshot read/clear on mount (+ clear on submit)
```

### Pattern 1: Single-flight 401 interceptor (module-level shared promise)
**What:** One module-scoped `refreshPromise` (null when idle); every 401 with falsy `_retry` sets `_retry = true` and awaits the same promise; refresh request itself bypasses the interceptor. A module-level `isRedirecting` flag set *before* `assign()` guarantees exactly one bounce.
**When to use:** Exactly this phase — all authenticated traffic flows through the shared instance, so one interceptor covers every view.
**Example:** see § Code Examples.

### Pattern 2: Bounce carries return context in the query (D-02)
**What:** The interceptor captures `window.location.pathname + window.location.search` at bounce time, encodes it as `redirect`, and Login validates it as internal-path-only (starts with single `/`, no `//`, no scheme/host) before `router.push`.
**When to use:** Session-death bounce only; manual `/login` visits carry no params and keep `router.push('/')` (D-03).

### Anti-Patterns to Avoid
- **Router import in api.js:** creates an import cycle (`api ⇄ router ⇄ auth store ⇄ api`) and breaks the build/test graph — use `window.location.assign` exclusively.
- **Refreshing on 403/5xx/network errors:** 403 (incl. `PASSWORD_CHANGE_REQUIRED` for Phase 8 SES-02) must passthrough untouched; transient failures must not bounce a healthy user to login.
- **Retrying the refresh request or the replayed request:** refresh is fired via the bare `axios` default instance or a flagged bypass, never through the interceptor; a replayed 401 rejects straight through (`_retry` guard).
- **Per-view 401 handling:** forbidden — interceptor lives ONLY on the shared instance (ROADMAP criterion 4; verified: no `401`/`interceptors`/`_retry` string exists anywhere in `frontend/src` today).
- **Logging token/cookie values:** never log auth material in the interceptor path.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| HTTP retry orchestration | Custom fetch wrapper with refresh logic | axios `interceptors.response.use` + shared promise | Documented API, covers all views at once, preserves original config incl. `withCredentials` |
| Open-redirect validation | Regex allowlist of routes | Internal-path check (single leading `/`, reject `//`, scheme, host) per D-04 | Minimal, sufficient for same-origin return; full URL parsing invites bypass bugs |
| Cross-tab session sync | storage-event bus / leader election | Passive discovery per D-14 (shared cookies + per-tab bounce) | Zero sync code; tabs converge on next 401/`me()` via shared cookies |
| Draft persistence backend | Server-side draft endpoint | `sessionStorage` 1-slot JSON snapshot | Best-effort only; server drafts are new product surface (out of scope) |

**Key insight:** Every "smarter" variant (router-aware bounce, cross-tab locks, queued retries) adds coupling or new surface for a flow whose contract is deliberately minimal: invisible retry once, else exactly one bounce.

## Common Pitfalls

### Pitfall 1: Refresh storm (N parallel 401s → N refreshes)
**What goes wrong:** Each concurrent 401 fires its own `POST /auth/refresh`; with lockout/rate-limit semantics nearby, this can cascade into mass logout.
**Why it happens:** Creating the refresh promise inside the per-request handler instead of sharing one module-level promise.
**How to avoid:** Module-level `let refreshPromise = null`; first 401 creates it (`refreshPromise = api.post('/auth/refresh').finally(...)` with null-reset), the rest await it.
**Warning signs:** Network tab shows >1 refresh per expiry in manual protocol 05-02.

### Pitfall 2: Infinite retry / bounce loop
**What goes wrong:** Replayed request 401s again → re-enters refresh → refresh 401s → bounce → guard re-fires `me()` → 401 → bounce…
**Why it happens:** Missing `_retry` guard, or the refresh request itself passing through the interceptor, or no redirect-once flag.
**How to avoid:** Three independent guards: (a) per-request `_retry`, (b) refresh call bypasses interceptor, (c) `isRedirecting` set before `assign()`.
**Warning signs:** Repeated `/login?reason=session-expired` navigations; login ⇄ dashboard flicker.

### Pitfall 3: Import cycle via router
**What goes wrong:** `api.js` imports router for bounce; router imports auth store; store imports api → cycle, undefined module at init, build or runtime failure.
**Why it happens:** Using `router.push` from the interceptor for convenience.
**How to avoid:** `window.location.assign` is the ONLY navigation mechanism in `api.js`; Login.vue (which already imports the router) owns `router.push`.
**Warning signs:** `vite build` warnings about circular imports; `undefined` store/router at runtime.

### Pitfall 4: Swallowing 403 forced-password signal (Phase 8 SES-02)
**What goes wrong:** Interceptor treats any non-2xx as session death and bounces, hiding `PASSWORD_CHANGE_REQUIRED`-class 403s.
**Why it happens:** Checking `!error.response` loosely or matching status ranges instead of `status === 401`.
**How to avoid:** Strict `error.response?.status === 401` gate; everything else (403, 429, 5xx, network, timeout) rejects through untouched.
**Warning signs:** Forced-password flow unreachable; 403s from Phase 4 permission map redirect to login.

### Pitfall 5: Open redirect via `?redirect=`
**What goes wrong:** Attacker crafts `/login?reason=session-expired&redirect=https://evil…`; post-login push leaks the session context off-origin.
**Why it happens:** Passing `redirect` to `router.push` unvalidated.
**How to avoid:** D-04 validation (single leading `/`, reject `//`/scheme/host); discard → fallback `/`.
**Warning signs:** Any `router.push(redirect)` without a validator function beside it in review.

### Pitfall 6: Snapshot breaks login/redirect when malformed
**What goes wrong:** Corrupt `sessionStorage` JSON throws during bounce/mount and blocks navigation or renders an empty crash.
**Why it happens:** Unwrapped `JSON.parse` or assuming snapshot shape.
**How to avoid:** Best-effort everywhere: try/catch around snapshot write AND read; invalid shape → discard silently, form opens empty (D-11).
**Warning signs:** Login bounce fails with DevTools console errors; Requests mounts blank-crashes.

## Code Examples

### Single-flight 401 interceptor (canonical skeleton for `api.js`)
```javascript
// Pattern: axios response interceptor, single shared refresh promise. [ASSUMED] — shape to be finalized at plan time.
import axios from 'axios';

export const api = axios.create({ baseURL: '/api', withCredentials: true }); // [VERIFIED: frontend/src/services/api.js:2] — `export const api = axios.create({ baseURL: '/api', withCredentials: true });`

let refreshPromise = null;   // single in-flight POST /auth/refresh per tab (D-14)
let isRedirecting = false;   // redirect-once flag, set BEFORE assign()

function doBounce() {
  if (isRedirecting) return;
  isRedirecting = true;
  try {
    // best-effort draft snapshot (Requests-only restore, D-09…D-12) — never throws
    const draft = window.__pendingDraft?.(); // planner: replace with actual form read or omit
    if (draft) sessionStorage.setItem('sgrf:pending-draft', JSON.stringify(draft));
  } catch { /* best-effort: ignore */ }
  const origin = window.location.pathname + window.location.search;
  window.location.assign('/login?reason=session-expired&redirect=' + encodeURIComponent(origin));
}

api.interceptors.response.use(
  (res) => res,
  async (error) => {
    const { config, response } = error;
    if (response?.status !== 401 || !config || config._retry) throw error; // 401-only; retry-once
    if (config.url?.includes('/auth/refresh')) throw error; // refresh itself never retried
    config._retry = true;
    try {
      refreshPromise ??= api.post('/auth/refresh').finally(() => { refreshPromise = null; });
      await refreshPromise;
      return api(config); // replay once, original config (withCredentials preserved)
    } catch {
      doBounce(); // exactly once; refresh death only
      throw error;
    }
  }
);
```

### Login.vue notice + redirect handling (amended contract D-02…D-08)
```vue
<!-- Existing baseline [VERIFIED: frontend/src/views/Login.vue:7] — `<div class="alert error" v-if="err" role="alert">{{ err }}</div>` -->
<!-- ADD above it (D-07 stacking: warn above, error below): -->
<div class="alert warn" v-if="expiredNotice" role="status">Sua sessão expirou. Entre novamente para continuar.</div>
```
```javascript
// [ASSUMED] — wiring sketch; planner pins exact placement (mount timing per discretion).
const params = new URLSearchParams(window.location.search);
const expiredNotice = ref(params.get('reason') === 'session-expired'); // D-08 locked copy
const redirectTarget = ref(params.get('redirect') || '');
function isInternalPath(p) { return typeof p === 'string' && p.startsWith('/') && !p.startsWith('//') && !/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(p); } // D-04
history.replaceState(null, '', window.location.pathname); // D-05: clean URL after reading
// post-login (replaces bare push('/')): [VERIFIED: frontend/src/views/Login.vue:22] — `try { await auth.login(email.value.trim().toLowerCase(), password.value); router.push('/'); }`
await auth.login(email.value.trim().toLowerCase(), password.value);
router.push(isInternalPath(redirectTarget.value) ? redirectTarget.value : '/'); // D-01/D-03/D-04
// D-06: typing never clears expiredNotice; it persists until login succeeds (navigation away unmounts).
```

### Requests.vue snapshot restore (D-09…D-13, read-only amendment)
```javascript
// [ASSUMED] — sketch; planner pins key/fields (key suggestion non-normative per discretion).
import { onMounted } from 'vue';
onMounted(() => {
  try {
    const raw = sessionStorage.getItem('sgrf:pending-draft');
    if (raw) {
      const d = JSON.parse(raw);
      if (d && typeof d.title === 'string') { form.value.title = d.title ?? ''; form.value.justification = d.justification ?? ''; valueCents.value = Number.isFinite(d.valueCents) ? d.valueCents : 0; }
    }
  } catch { /* invalid shape → open empty (D-11) */ }
  finally { sessionStorage.removeItem('sgrf:pending-draft'); } // clear on restore (D-11); also clear on successful submit
});
```

### Backend refresh contract (no changes — reference only)
```javascript
// [VERIFIED: backend/src/controllers/authController.js:52-64] —
// `async function refresh(req, res) {` … `if (!t) return res.status(401).json({ error: 'Sem refresh' });` …
// `if (!user || user.status !== 'ATIVO') return res.status(401).json({ error: 'Inválido' });` …
// `res.cookie('access_token', signAccess(user), { ...cookieOpts, maxAge: 15 * 60 * 1000 });` … `res.json({ ok: true });` …
// `catch {` … `res.status(401).json({ error: 'Refresh expirado' });`
// TTLs [VERIFIED: backend/src/utils/tokens.js:4-10] — `expiresIn: '15m'` (access), `expiresIn: '7d'` (refresh).
// Cookie flags [VERIFIED: backend/src/utils/tokens.js:20-25] — `httpOnly: true,` `secure: env.cookieSecure,` `sameSite: 'lax',` `path: '/',`.
// Router guard signal [VERIFIED: frontend/src/router/index.js:23-27] — `if (!auth.user) await auth.me();` + `if (to.meta.auth && !auth.user) return '/login';`.
// Auth store soft-fail [VERIFIED: frontend/src/stores/auth.js:7-10] — `try { const { data } = await api.get('/auth/me'); this.user = data.user; }` + `catch { this.user = null; }`.
// Notice class [VERIFIED: frontend/src/styles/base.css:101-103] — `.alert { border-radius: var(--radius-sm); padding: 0.7rem 0.9rem; margin: 0.7rem 0; font-weight: 300; }` + `.alert.warn { background: var(--amber-soft); border: 1px solid var(--spark); color: var(--text-on-dark); }`.
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Per-view 401 handlers / eager pre-expiry refresh timers | Single shared-instance response interceptor, lazy on 401 | Industry consensus (axios interceptor docs pattern) | One code site covers all views; no timer drift or duplicated handling |
| `router.push` from service layer | `window.location.assign` from service layer | Vue SPA best practice for cycle avoidance | No `api ⇄ router ⇄ store` cycle; full reload resets stale auth state |

**Deprecated/outdated:**
- Refresh-token rotation / `tokenVersion` revocation: explicitly out of scope (REQUIREMENTS.md) — dedicated milestone after SES-01 ships.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Interceptor skeleton details (bypass via `config.url` check vs separate bare instance; `??=` + `finally` reset shape) | Code Examples | LOW — planner pins exact shape; manual protocol 05-02 proves single-flight either way |
| A2 | Draft snapshot capture point (how `api.js` reads the Requests form at bounce time — global hook vs form-scoped write) | Code Examples / Pitfalls | MEDIUM — needs planner decision: interceptor cannot import the form; likely the form writes on input/change and interceptor only triggers bounce, or bounce writes via a registered callback |
| A3 | `history.replaceState` exact timing (mount-after-read vs post-first-render) | Discretion (user-owned micro-detail) | LOW — either satisfies D-05; verify in manual protocol |
| A4 | axios 1.20.0 interceptor API unchanged from documented `interceptors.response.use(onFulfilled, onRejected)` | Standard Stack | LOW — stable public API for years; `npm run build` + manual protocol confirm |

## Open Questions

1. **Draft capture mechanism across the api.js ↔ Requests boundary**
   - What we know: D-09/D-10 mandate interceptor→sessionStorage snapshot with read in Requests; interceptor cannot import view state.
   - What's unclear: Whether the form proactively persists on input (interceptor only bounces) or the interceptor pulls via a registered callback.
   - Recommendation: Planner picks one (proactive form-side persist is simpler, no cross-module hook); either satisfies the contract.

## Validation Architecture

| Property | Value |
|----------|-------|
| Framework | none — frontend has no tests (`npm test` exits 1 by design per AGENTS.md) |
| Config file | none — see Wave 0 |
| Quick run command | `cd frontend && npm run build` |
| Full suite command | `cd frontend && npm run build` (same; build IS the gate) |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| SES-01 | Silent refresh past 15m TTL; single-flight; retry once; bounce-once on dead cookie; no router import | manual-only | `cd frontend && npm run build` (gate) + manual protocol 05-02 | ❌ Wave 0 — manual protocol, no test file |

Manual protocol 05-02 (from ROADMAP + UI-SPEC, normative): drop access TTL to ~10s → exactly one `POST /auth/refresh` per expiry in network tab, view stays put, no spinner/banner; fire N parallel 401s → exactly one refresh; delete refresh cookie → exactly one navigation to `/login?reason=session-expired&redirect=…` showing the locked notice; `?redirect` round-trip returns to origin, invalid `redirect` falls back to `/`; malformed snapshot opens empty form without blocking.

### Sampling Rate
- **Per task commit:** `cd frontend && npm run build`
- **Per wave merge:** `cd frontend && npm run build`
- **Phase gate:** Build green + manual protocol 05-02 evidence recorded before `/gsd-verify-work`

### Wave 0 Gaps
- None — no test infrastructure to scaffold (frontend has no test runner by design; verification is build + manual protocol).

## Security Domain

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | yes | httpOnly `access_token` (15m) + `refresh_token` (7d) cookies [VERIFIED: backend/src/utils/tokens.js:4-10,20-25]; `POST /auth/refresh` re-issues access only; login lockout after 5 attempts (authController) |
| V3 Session Management | yes | Single-flight refresh (no fixation/storm surface); redirect-once flag; `sameSite: 'lax'` + CORS `FRONTEND_URL` (AGENTS.md); rotation/revocation explicitly deferred to post-SES-01 milestone |
| V4 Access Control | no | Unchanged — Phase 4 permission map owns it; interceptor must not alter 403 semantics |
| V5 Input Validation | yes | `?redirect` internal-path-only validation (D-04, open-redirect); snapshot `JSON.parse` in try/catch with shape check (D-11) |
| V6 Cryptography | no | No crypto changes — JWT signing untouched in `tokens.js` |

### Known Threat Patterns for axios-interceptor session refresh

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Open redirect via `?redirect=` | Spoofing | D-04 internal-path validation, fallback `/` |
| Refresh storm → account lockout / rate-limit trip | Denial of service | Single shared refresh promise (one in-flight refresh per tab) |
| Session fixation via stale replay | Spoofing | `_retry` once-only; replay reuses original config, no token injection client-side (cookies httpOnly) |
| Sensitive data in logs/storage | Information disclosure | Never log tokens/cookies; snapshot holds non-sensitive draft fields only, same-origin, best-effort |

## Sources

### Primary (HIGH confidence)
- In-repo Read this session: `frontend/src/services/api.js`, `frontend/src/views/Login.vue`, `frontend/src/stores/auth.js`, `frontend/src/router/index.js`, `frontend/src/views/Requests.vue`, `frontend/package.json`, `backend/src/controllers/authController.js`, `backend/src/utils/tokens.js`, `frontend/src/styles/base.css` — all facts quoted verbatim with line ranges
- `.planning/phases/05-session-refresh/05-CONTEXT.md` (D-01…D-14, discretion, deferred) and `05-UI-SPEC.md` (interaction contract, locked copy) — normative inputs

### Secondary (MEDIUM confidence)
- `.planning/ROADMAP.md` Phase 5 section, `.planning/REQUIREMENTS.md` SES-01, `AGENTS.md` — project constraints

### Tertiary (LOW confidence)
- Interceptor skeleton shape and Login/Requests wiring sketches — standard axios patterns, marked `[ASSUMED]`, to be pinned at plan time and proven by manual protocol 05-02

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — installed version read from `frontend/package.json`; zero new deps; backend contract read verbatim
- Architecture: HIGH — pattern is the documented axios extension point; all touch files read; no interceptor/401-handling exists today (grep-confirmed)
- Pitfalls: HIGH — derived from locked contract guards (single-flight, retry-once, bounce-once, 401-only, no-router-import) plus in-repo failure modes

**Research date:** 2026-09-24
**Valid until:** 2026-10-24 (stable domain — axios interceptor API + in-repo contract; re-check only if Phase 8 changes auth routes)
