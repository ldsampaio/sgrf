# Phase 3: Deploy & Environment Contract - Context

**Gathered:** 2026-09-23
**Status:** Ready for planning

<domain>
## Phase Boundary

Phase 3 makes production boot only with real secrets and makes login work through the production HTTPS topology — one coherent environment contract across `env.js`, cookies, and compose. Covers SEC-02 (fail-fast on insecure `JWT_*`/`INITIAL_ADMIN_*` values under `NODE_ENV=production`) and SEC-04 (`COOKIE_SECURE` env var + working cookie story off localhost). Ends with the deployment contract documented so a fresh deploy validates step-by-step, while `./start-dev.sh` local dev keeps working unchanged. No Caddy: Cloudflare Tunnel is the official TLS termination. `trust proxy` + rate-limit expansion stay atomic in Phase 8 (SEC-03), not here.

</domain>

<decisions>
## Implementation Decisions

### Fail-fast strictness (SEC-02 input)
- **D-01:** Gate triggers ONLY on `NODE_ENV=production` — staging/homolog with any other `NODE_ENV` keeps dev fallbacks. Roadmap plan 03-01 "gated strictly on `NODE_ENV=production"`.
- **D-02:** Detection is value-based blocklist, not presence-only: empty, contains `change-me`, or starts with `dev-` fails. Catches current `env.js` fallbacks (`dev-*-secret-change-me-...`) and the `.env.example` `change-me-access-32chars-min` placeholder. Compose `PROCESSO:?` presence checks stay as-is (complementary layer).
- **D-03:** All four vars gate: `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`, `INITIAL_ADMIN_EMAIL`, `INITIAL_ADMIN_TEMPORARY_PASSWORD`. Admin email additionally checked for `@utfpr.edu.br` format.
- **D-04:** Failure mode is `throw new Error` at `env.js` load listing the offending vars + how to fix. CI stays green because CI runs vitest with `NODE_ENV!=production` (dummy `JWT_*` env only).

### COOKIE_SECURE semantics (SEC-04 input)
- **D-05:** New `COOKIE_SECURE` env var; explicit value wins. Absent = follow `NODE_ENV` (production → true). `tokens.js cookieOpts.secure` reads it instead of hardcoding `NODE_ENV===production`.
- **D-06:** Production behind Cloudflare Tunnel sets `COOKIE_SECURE=true` explicitly — browser sees edge HTTPS so `Secure` cookies work, even though cloudflared→app origin traffic is plain HTTP. No auto-detect via `x-forwarded-proto` (would depend on proxy headers).
- **D-07:** `FRONTEND_URL` in production is the public `https://<host>` (CORS origin matches edge); dev default `http://localhost:5173` unchanged.
- **D-08:** `sameSite` stays `'lax'` — SPA+API are same-origin single hostname behind the Tunnel; no `sameSite:'none'` (only for split hosts). CSRF residual risk already accepted in `docs/11`.

### HTTPS topology (Cloudflare Tunnel)
- **D-09:** Cloudflare Tunnel is the official and only TLS termination — no Caddy alternative documented or tested. Origin path: Cloudflare edge (TLS) → cloudflared → server entry port → app port (HTTP internally).
- **D-10:** Login verification happens via the public `https://` URL through the Tunnel. The roadmap's `http://<LAN-IP>` LAN check is dropped for this deploy: with `Secure=true`, plain-HTTP LAN login cannot work by design.
- **D-11:** `trust proxy` + rate-limit work is confirmed necessary (tunnel hides real client IP: rate-limit would bucket all users as one IP, audit IP would log cloudflared/local) but stays ATOMIC in Phase 8 (SEC-03) — Phase 3 configures nothing proxy-related.

### Contract doc shape (plan 03-03)
- **D-12:** Contract lives as a dedicated deploy doc (README section or numbered `docs/` entry, planner's call) PLUS updated `backend/.env.example` (`COOKIE_SECURE`, `FRONTEND_URL=https://…` production notes). Inline compose comments alone are not enough.
- **D-13:** Doc is a validatable checklist, not prose: boot-refuses-insecure-secret → public-URL login works → `./start-dev.sh` dev intact — each step with command + expected result.

### the agent's Discretion
- Exact fail-fast error wording (keep terse, list offending vars + fix hint); where the `COOKIE_SECURE` parse helper lives (`env.js` vs `tokens.js`); exact doc file slot for the contract (README deploy section vs new `docs/` file); `.env.example` comment wording.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase scope + requirements
- `.planning/ROADMAP.md` Phase 3 section — goal, 3 success criteria, 3 plan descriptions (03-01 env fail-fast, 03-02 COOKIE_SECURE + topology, 03-03 contract doc)
- `.planning/REQUIREMENTS.md` SEC-02, SEC-04 — fail-fast and cookie contract; traceability table
- `.planning/STATE.md` Blockers/Concerns — HTTPS topology was the open product/ops call, now decided (D-09)

### Code targets (edit points)
- `backend/src/config/env.js` — dotenv + insecure dev fallbacks; fail-fast gate lands here (D-01…D-04)
- `backend/src/utils/tokens.js` — `cookieOpts.secure = NODE_ENV===production` today; reads `COOKIE_SECURE` after fix (D-05, D-06)
- `backend/src/app.js` — CORS origin from `env.frontendUrl`; must receive public https URL in prod (D-07)
- `compose.yaml` — presence fail-fast (`:?`) for `JWT_*`/`INITIAL_ADMIN_*` stays; add `COOKIE_SECURE`/`FRONTEND_URL` production wiring
- `backend/.env.example` — placeholder secrets + missing `COOKIE_SECURE`; update with production notes (D-12)

### Specs
- `docs/11-seguranca-e-auditoria.md` — CSRF residual-risk acceptance (`sameSite:'lax'` + CORS), referenced by D-08
- `docs/02-requisitos-nao-funcionais.md` — deploy/non-functional expectations touching this contract

### Codebase maps
- `.planning/codebase/STACK.md` — env var inventory, compose/Docker deploy shape, insecure-fallback note
- `.planning/codebase/ARCHITECTURE.md` — same-origin auth assumption, single-image prod, `FRONTEND_URL` + credentials CORS
- `.planning/codebase/INTEGRATIONS.md` — required/optional env vars, secrets locations, auth cookie details

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `compose.yaml` `:?` presence guards — keep as outer layer; `env.js` value-check is the inner layer that catches `change-me` values presence-checks miss
- `middlewares/validate.js` `errorHandler` — hides stack in production, so thrown boot error stays clean
- `start-dev.sh` — dev bootstrap that must keep working untouched (criterion #1 second half)

### Established Patterns
- `env.js` single typed-config module loaded once — gate lives at load time, not per-request
- Cookie options centralized in `tokens.js cookieOpts` — single edit point for D-05/D-06
- Same-origin SPA+API (`/api` proxy in dev, Express static in prod) — Tunnel preserves this, so no CORS split-host work needed

### Integration Points
- Phase 8 SEC-03 consumes D-11: explicit `trust proxy` hop count + rate-limit expansion behind the Tunnel (real client IP via CF-Connecting-IP/X-Forwarded-For)
- CI (Phase 1 gate) constrains D-04: dummy `JWT_*` in CI workflow must not trip the gate — hence `NODE_ENV`-strict gating

</code>

<specifics>
## Specific Ideas

- User verbatim (hosting): "No servidor onde será hospedado estou usando cloudflare tunnel com TLS ativo, use a melhor configuração para este cenário específico."
- User verbatim (topology): "eu mapeio a requisição http para uma porta específica de entrada do servidor via cloudflare e o servidor repassa para a aplicação internamente na porta da propria aplicação. É necessário incluir trust proxy e rate limit? Se sim, deixe esses passos na phase 8"
- Deploy path: edge TLS → cloudflared → server entry port → app port (HTTP internally); `COOKIE_SECURE=true` + `FRONTEND_URL=https://<public-host>`.

</specifics>

<deferred>
## Deferred Ideas

- `trust proxy` hop count + auth rate-limit expansion behind Tunnel — Phase 8 SEC-03 (acknowledged necessary, deliberately deferred).
- Caddy-front alternative topology — rejected, not deferred (Tunnel is the only supported TLS path).

</deferred>

---

*Phase: 3-Deploy & Environment Contract*
*Context gathered: 2026-09-23*
