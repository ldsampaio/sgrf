# AGENTS.md — SGRF/SGRD

MVP: backend Node+Express+Postgres (Prisma) + frontend Vue 3+Vite (SPA). Dois pacotes **sem workspace** — rode comandos dentro de `backend/` ou `frontend/`.

## Dev rápido

```bash
./start-dev.sh              # backend :3000 + frontend :5173 (install + migrate + seed admin)
./start-dev.sh --seed-dev   # + massa de teste — NUNCA em produção
```

Ordem manual: `cp backend/.env.example backend/.env` → `docker compose up -d db` (Postgres local) → `cd backend && npx prisma migrate dev` → `npm run seed` → `npm run dev`; frontend em outro shell: `npm run dev`.

## Testes / verificação

- Backend: `cd backend && npx vitest run` (suítes: `batch`, `unit`, `voting`).
- Frontend **não tem testes** (`npm test` falha de propósito) — verifique com `cd frontend && npm run build`.
- CI vive em `.github/workflows/ci.yml` (jobs `backend` + `frontend`, obrigatórios na `main` — ver nota do gate abaixo). Sem lint/typecheck configurados; não invente esses comandos.

## Gate de regressão (CI obrigatório)

CI é o gate de regressão: todo push na `main` precisa passar os dois checks obrigatórios (`backend` = `cd backend && npx vitest run`, `frontend` = `cd frontend && npm run build`). Proteção configurada via API com `required_status_checks` contextos `["backend", "frontend"]`, `strict:false` e `enforce_admins:true` (sem `required_pull_request_reviews`, sem `restrictions`).
- `strict:false` — branches não precisam estar atualizadas antes do merge; revisitar quando PRs virarem o fluxo normal (com PRs, `strict:true` passa a fazer sentido).
- `enforce_admins:true` — pushes de admin também são bloqueados quando o gate está vermelho; não há bypass de hotfix.
- Recuperação GH006 (push bloqueado com main vermelha): re-execute o workflow que falhou (`gh run rerun`), ou abra um PR com a correção, ou desabilite temporariamente a regra em Settings → Branches e reative após o verde.

## Armadilhas verificadas

- **Prisma/Postgres**: após mexer em `backend/prisma/schema.prisma`, rode `npx prisma migrate dev` (banco local via `docker compose up -d db`; histórico em `backend/prisma/migrations/`). Sem SQL raw; IDs são UUID string e dinheiro é **cents (inteiro)**.
- **Deploy Docker**: `Dockerfile` (imagem única: Express serve `frontend/dist` + API) + `compose.yaml` (app + Postgres). Porta externa via `APP_PORT` (default **8081**); `SERVE_FRONTEND=true` ativa o estático com fallback SPA. Entrypoint roda `migrate deploy` + seed do admin. Segredos (`JWT_*`, `INITIAL_ADMIN_*`) via ambiente — o compose falha rápido se ausentes.
- **Nunca commite**: `backend/.env`, `*.db*` (`backend/prisma/dev.db*`), `backend/uploads/*`. Seeds dev usam `SEED_DEV_CONFIRM=1 npm run seed:dev`.
- **Auth**: só e-mail `@utfpr.edu.br`; JWT em cookie httpOnly — o frontend usa `axios` com `baseURL: '/api'` + `withCredentials: true`, e o backend exige `FRONTEND_URL` correto no CORS (com credentials). Há rate-limit com bloqueio após 5 tentativas de login.
- **Frontend**: dev proxy `/api` → `http://localhost:3000` (ver `frontend/vite.config.js`); em produção o backend precisa servir/estar atrás da mesma origem de `/api`.
- **Rotas**: `backend/src/app.js` monta `/api/auth|users|requests|settings|finance|messages|reports`; `GET /health` retorna `{ ok: true }`.
- **Env**: `backend/src/config/env.js` carrega `dotenv` com fallbacks inseguros de dev (`dev-*-secret-change-me`) — nunca confie neles fora do local; SMTP vem desligado (`SMTP_ENABLED=false`).
- **Docs de domínio**: `docs/` numerados (`03-regras-de-negocio.md`, `06-permissoes.md`, `07-fluxos.md`, `08-api.md`) + `backend/openapi.yaml`. Regras de votação/aprovação automática vivem nesses arquivos — consulte antes de alterar lógica de solicitações.
