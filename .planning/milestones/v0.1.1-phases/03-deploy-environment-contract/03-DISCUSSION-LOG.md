# Phase 03: Deploy & Environment Contract - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-09-23
**Phase:** 03-Deploy & Environment Contract
**Areas discussed:** Fail-fast strictness, COOKIE_SECURE semantics, HTTPS topology, Contract doc shape

---

## Fail-fast strictness

| Option | Description | Selected |
|--------|-------------|----------|
| production-only | Só NODE_ENV=production dispara o fail-fast | ✓ |
| non-dev gates | Qualquer NODE_ENV ≠ development/test dispara | |
| Blocklist substrings | Vazio, contém 'change-me' ou prefixo 'dev-' falha | ✓ |
| Min-length/entropy | Exigir 32+ chars de entropia | |
| All four | JWT_ACCESS + JWT_REFRESH + INITIAL_ADMIN_EMAIL + TEMP_PASSWORD | ✓ |
| JWT-only | Só as 2 JWT | |
| Throw at boot | throw new Error listando vars ofensivas | ✓ |
| exit(1) checklist | console.error + process.exit(1) | |

**User's choice:** production-only / Blocklist substrings / All four / Throw at boot (all recommended)
**Notes:** Roadmap plan 03-01 already constrains trigger to NODE_ENV=production strictly; CI dummy JWT must keep passing.

---

## COOKIE_SECURE semantics

| Option | Description | Selected |
|--------|-------------|----------|
| Explicit wins | COOKIE_SECURE explícito vence; ausente segue NODE_ENV | ✓ |
| Auto-detect only | secure via x-forwarded-proto | |
| Explicit true | COOKIE_SECURE=true com Tunnel+TLS (origem HTTP, browser HTTPS) | ✓ |
| Public HTTPS URL | FRONTEND_URL=https://<host-público> em prod | ✓ |
| Keep lax | sameSite 'lax', SPA+API mesma origem | ✓ |

**User's choice:** Free-text hosting constraint — "usando cloudflare tunnel com TLS ativo, use a melhor configuração para este cenário específico." + Explicit true / Public HTTPS URL / Keep lax
**Notes:** Tunnel terminates TLS at edge; origin cloudflared→app is HTTP. Secure cookies work (browser sees HTTPS). Auto-detect rejected (proxy-header fragility).

---

## HTTPS topology

| Option | Description | Selected |
|--------|-------------|----------|
| Tunnel is TLS | Cloudflare Tunnel é a terminação TLS oficial; sem Caddy | ✓ |
| Tunnel + Caddy | Dois caminhos documentados | |
| Public-URL verify | Login verificado via https:// pública; sem teste LAN-http | ✓ |
| Keep LAN test | Manter http://<LAN-IP> com COOKIE_SECURE=false temporário | |
| Defer to Phase 8 | trust proxy + rate-limit ficam atômicos na Phase 8 | ✓ |

**User's choice:** Tunnel is TLS / Public-URL verify + free-text: "mapeio a requisição http para uma porta específica de entrada do servidor via cloudflare e o servidor repassa para a aplicação internamente" — "É necessário incluir trust proxy e rate limit? Se sim, deixe esses passos na phase 8"
**Notes:** Confirmed: trust proxy IS needed eventually (tunnel masks client IP → rate-limit buckets + audit IP wrong) but stays in Phase 8. Phase 3 needs nothing proxy-related (Secure flag is static).

---

## Contract doc shape

| Option | Description | Selected |
|--------|-------------|----------|
| Docs + example | Doc dedicado + .env.example atualizado | ✓ |
| Inline only | Só comentários compose/.env.example | |
| Checklist steps | boot-recusa → login-https → dev-intacto, com comandos | ✓ |
| Prose only | Texto corrido sem verificação | |

**User's choice:** Docs + example / Checklist steps (both recommended)
**Notes:** None.

---

## the agent's Discretion

Error wording; COOKIE_SECURE parse helper location (env.js vs tokens.js); contract doc slot (README vs docs/); .env.example comment wording.

## Deferred Ideas

trust proxy + rate-limit expansion → Phase 8 SEC-03. Caddy alternative → rejected outright.
