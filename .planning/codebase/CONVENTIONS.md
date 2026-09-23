---
last_mapped_commit: b3837b7e16bf00622f1be01d8316a0290affc7f6
last_mapped_at: 2026-09-23
---
# Coding Conventions

**Analysis Date:** 2026-09-22

## Naming Patterns

**Files:**

- Backend (CommonJS): `camelCase.js` with a role suffix per layer — routes use `*.routes.js` (e.g. `backend/src/routes/requests.routes.js`), controllers `*Controller.js` (e.g. `backend/src/controllers/requestController.js`), services `*Service.js` (e.g. `backend/src/services/requestService.js`), middleware plain name (`backend/src/middlewares/auth.js`, `backend/src/middlewares/validate.js`), config plain name (`backend/src/config/db.js`, `backend/src/config/env.js`, `backend/src/config/logger.js`).
- Frontend: Vue SFCs use `PascalCase.vue` for both views and components (`frontend/src/views/Requests.vue`, `frontend/src/components/MoneyInput.vue`); plain JS modules use `camelCase.js` (`frontend/src/services/api.js`, `frontend/src/utils/masks.js`); the router entry is the exception: `frontend/src/router/index.js`.
- Tests: `backend/tests/<topic>.test.js` — flat, lowercase topic names (`unit.test.js`, `voting.test.js`, `batch.test.js`).

**Functions:**

- `camelCase` everywhere. Controllers export small named async handlers named after the verb/noun of the action: `list`, `create`, `submit`, `getOne`, `cancel` in `backend/src/controllers/requestController.js`; `login`, `me`, `refresh`, `logout`, `changePassword`, `forgotPassword` in `backend/src/controllers/authController.js`.
- Route files alias controller modules with 1–2 lowercase letters: `rc`, `vc`, `dc`, `fc` in `backend/src/routes/requests.routes.js`.
- Vue composable-style getters use `use*` prefix: `useAuth` in `frontend/src/stores/auth.js`.

**Variables:**

- `camelCase` for locals/params; money fields always carry a `Cents` suffix and hold **integer cents** — `requestedAmountCents`, `availableCents`, `provisionedCents`, `automaticApprovalLimitCents` (see `backend/prisma/schema.prisma`, `backend/src/services/requestService.js`). Never store reais as floats.
- Domain status/role/type values are `SCREAMING_SNAKE_CASE` string enums in Portuguese: `'RASCUNHO'`, `'EM_VOTACAO'`, `'APROVADO_AUTOMATICAMENTE'`, `'ADMINISTRADOR'`, `'CHEFE_DEPARTAMENTO'`, `'EQUIPAMENTO'`, `'VIAGEM'`.
- IDs are UUID strings from Prisma; no numeric-id assumptions.

**Types:**

- No TypeScript anywhere — plain `.js` backend (`backend/package.json` `"type": "commonjs"`) and plain `.js`/`.vue` frontend (`frontend/package.json` `"type": "module"`). Do not introduce TS files; do not add a typecheck step (none configured — see `AGENTS.md`).
- Prisma models are `PascalCase` (`ResourceRequest`, `FundBalance`, `AuditEvent` in `backend/prisma/schema.prisma`).

## Code Style

**Formatting:**

- No formatter configured (no `.prettierrc`, `biome.json`, or `.editorconfig` in the repo). Match the existing style by hand: 2-space indent, single quotes, semicolons, no trailing-comma churn, compact one-line guards.
- Common compact idiom in controllers: `} catch (e) { next(e); }` on one line (e.g. `backend/src/controllers/requestController.js:16`).
- Early-return validation guards on one line: `if (!title || return res.status(400).json({ error: '...' });` style (see `backend/src/controllers/requestController.js:22`).

**Linting:**

- No linter configured (no `.eslintrc*`, `eslint.config.*`; the only lint artifact is a manual `// eslint-disable-next-line no-unused-vars` for Express's 4-arg error handler in `backend/src/middlewares/validate.js:12`). `AGENTS.md` states there is **no lint/typecheck/CI — do not invent those commands.**

## Import Organization

**Order (backend, CommonJS `require`):**

1. Third-party packages — `express`, `helmet`, `pino-http` (`backend/src/app.js:1-7`)
2. App config — `./config/*` (`backend/src/app.js:8-9`)
3. Middlewares / utils / services — `../utils/tokens`, `../services/auditService` (`backend/src/middlewares/auth.js:1-2`, `backend/src/controllers/requestController.js:1-4`)
4. Sibling route modules last — `express.Router()` then controller requires (`backend/src/routes/requests.routes.js:1-5`)

Route mounting happens centrally in `backend/src/app.js:21-27` (`app.use('/api/<name>', require('./routes/<name>.routes'))`).

**Order (frontend, ESM `import`):**

1. Framework/libs — `vue`, `axios`, `pinia`, `vue-router`
2. App modules — `../services/api`, stores/router
3. Local components — `../components/MoneyInput.vue`
4. Utils — `../utils/masks`

Use **relative paths only** — there are no path aliases (nothing configured in `frontend/vite.config.js`).

**Module system rule:** backend source uses `require`/`module.exports`; **tests** use ESM `import` (Vitest transpiles them) — keep tests in `import` form, source in `require` form. Frontend is ESM throughout.

## Error Handling

**Patterns:**

- **Controller layer:** wrap the whole handler body in `try/catch` and forward with `next(e)`; the central `errorHandler` in `backend/src/middlewares/validate.js:13-17` renders `{ error: message }` with `err.status || 500` (stack only when `NODE_ENV !== 'production'`). It is mounted last in `backend/src/app.js:37`.
- **Business-rule failures:** early return with a 4xx + Portuguese message — `res.status(400).json({ error: 'Saldo disponível insuficiente (RN-005)' })`, `res.status(403).json({ error: 'Só o solicitante submete' })`, `res.status(404).json({ error: 'Não encontrado' })` (`backend/src/controllers/requestController.js`, `backend/src/middlewares/auth.js`).
- **Domain helpers throw** `new Error('mensagem em português')` instead of returning error codes; the controller catches and maps to 400 — see `calcAmount` in `backend/src/services/requestService.js:30-63` and its catch in `backend/src/controllers/requestController.js:24-29`.
- **Auth failures** are uniform: 401 `'Não autenticado'` / `'Sessão expirada'`, 403 `'Sem permissão'` (`backend/src/middlewares/auth.js`).
- **Never-throw services:** audit logging swallows its own errors and only logs (`backend/src/services/auditService.js` — "auditoria nunca deve quebrar o fluxo"). Follow this for non-critical side channels (email enqueue, audit).
- **Frontend:** every API call sits in `try/catch` and surfaces `err.value = e.response?.data?.error || '<fallback pt-BR>'`, rendered as `<div class="alert error" role="alert">{{ err }}</div>` — see `frontend/src/views/Requests.vue:47`, `frontend/src/views/Login.vue:23`, `frontend/src/views/Dashboard.vue:49-68`.
- **Frontend store:** silent catch for the session probe only (`catch { this.user = null; }` in `frontend/src/stores/auth.js:9`).

**Transactions:** multi-write financial operations go through `prisma.$transaction(async (tx) => ...)` with optimistic `version: { increment: 1 }` on `FundBalance` — see `backend/src/controllers/requestController.js:75-94`. Use this pattern for any balance mutation.

## Validation

**Patterns:**

- `zod` is a dependency and a `validate(schema)` middleware exists (`backend/src/middlewares/validate.js:1-10`, sets `req.validated`), **but no route currently uses it** — in practice validation is inline manual checks against `req.body`/`req.query` in controllers (`backend/src/controllers/requestController.js:22`, `backend/src/controllers/authController.js:75`).
- New endpoints may adopt the zod `validate()` middleware (preferred going forward), but must keep the same response shape: `{ error: 'Validação falhou', details: ... }` for schema failures, `{ error: '<pt-BR message>' }` for business rules.

## Logging

**Framework:** `pino` + `pino-http` — configured in `backend/src/config/logger.js`, attached globally in `backend/src/app.js:18`.

**Patterns:**

- Structured call shape: object first, message second — `logger.info({ requestId: r.id }, 'voting auto-closed')`, `logger.error({ mailId: mail.id }, 'email give up, alert admin')` (`backend/src/jobs/votingCloser.js:15-17`, `backend/src/services/emailService.js:31-36`).
- Level via `LOG_LEVEL` env; secrets are redacted: `['req.headers.cookie', 'password', 'pass', 'SMTP_PASS', 'token']` (`backend/src/config/logger.js:5`). Add any new secret key names to this redact list.
- `console.log` appears only in the standalone CLI job exit path (`backend/src/jobs/votingCloser.js:24`); application code logs through `logger`.
- Frontend: no logging convention — do not add `console.*` in `frontend/src`.

## Comments

**When to Comment:**

- Sparse, Portuguese, only where a rule has an external source: cite the requirement/doc — `// RN-006: especificação equipamento obrigatória` (`backend/src/controllers/requestController.js:30`), `// Chefe pode gerenciar usuários exceto admin (RF-005)` (`backend/src/middlewares/auth.js:26`), `// aluno só vê próprias... (06-permissoes)` (`backend/src/controllers/requestController.js:9`).
- Behavior-explaining one-liners for tricky bits: `// transação atômica: status + provisionamento + saldo` (`backend/src/controllers/requestController.js:74`), `// máscara progressiva: só dígitos -> centavos` (`frontend/src/components/MoneyInput.vue:16`).
- Domain rules live in `docs/03-regras-de-negocio.md` etc. — reference the doc number instead of re-explaining. No JSDoc/TSDoc blocks anywhere.

## Function Design

**Size:** Small handlers (most controllers < 120 lines total, `backend/src/controllers/`); one exported function per HTTP action. Extract business logic into `backend/src/services/` once it exceeds a guard-and-persist shape (`requestService.calcAmount`, `votingService.tally`).

**Parameters:** middleware factories take variadic config (`requireRole(...roles)` in `backend/src/middlewares/auth.js:18`); service helpers take primitive ids/values (`annualTotalCents(requesterId, referenceYear, excludeId)`); audit takes a single options object `audit({ actorId, action, entityType, entityId, beforeData, afterData, req })` (`backend/src/services/auditService.js`).

**Return Values:** Services return plain objects/values (cents integers, `{ outcome }`); controllers never return — they `res.json({ <noun>: data })`, wrapping payloads under a named key (`{ requests }`, `{ request }`, `{ user }`, `{ ok: true }`) and always JSON. Keep the `{ error }` / named-resource / `{ ok: true }` response contract.

## Module Design

**Exports:** Backend uses named exports collected in one object: `module.exports = { list, create, submit, getOne, cancel }` (`backend/src/controllers/requestController.js:122`), `module.exports = { validate, errorHandler }`. Single-export modules export the value directly (`module.exports = createApp` in `backend/src/app.js`, `module.exports = router` in routes).

**Barrel Files:** None — no `index.js` re-export barrels. Require the concrete file (`require('./config/db')`, `../utils/helpers`).

**Frontend exports:** named `export function` for utils (`frontend/src/utils/masks.js`), named store `export const useAuth`, default export only for the router (`frontend/src/router/index.js`) and Vue SFCs. All Vue components use `<script setup>` (11/11 SFCs) — do not introduce Options API or separate `<script>` blocks.

**Component contract:** v-model-style props — `modelValue` prop + `update:modelValue` emit (`frontend/src/components/MoneyInput.vue:11-12`); money inputs emit integer cents, never floats.

---

*Convention analysis: 2026-09-22*
