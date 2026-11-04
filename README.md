# SGRD — Sistema de Gestão de Recursos Departamentais (MVP)

MVC · Backend Node + Express + Postgres (Prisma) · Frontend Vue 3 + Vite (SPA).

Gestão de papéis por sistema, solicitações financeiras, aprovação automática/votação do conselho, provisionamento de saldo e relatórios para prestação de contas. Detalhes em `docs/`.

## Início rápido

```bash
./start-dev.sh              # backend :3000 + frontend :5173
./start-dev.sh --seed-dev   # + massa de teste (nunca em produção)
```

Manual:
```bash
cd backend && cp .env.example .env
# Postgres e Redis compartilhados: ../compose.dev.yml (o schema `auth` é do saga).
npx prisma migrate dev && node prisma/seed.js   # migrate cobre só o schema `sgrf`
npm run dev
cd ../frontend && npm run dev
```

O login é do saga (portal em `:8000`): o sgrf não tem formulário de credencial.

Teste backend: `cd backend && npx vitest run`.

## Release Close CLI (read-only preflight)

Verifica elegibilidade de tag antes do fechamento de release:

```bash
node tools/release-close/release-close.js verify --version v0.1.1 --sha <40-char-sha>
node tools/release-close/release-close.js verify --fixture --version v0.1.1 --sha <40-char-sha>   # sem rede
node tools/release-close/release-close.js verify --json --version v0.1.1 --sha <40-char-sha>
```

Verbos: `verify` (tag/main/CI/Release/Milestone, mutations: 0), `plan` (plano de fechamento), `apply` (plano + confirmação).

Nenhum verbo escreve no remoto nesta fase. `--fixture` ativa cliente fake.

## Seeds

- Deploy (`npm run seed`): grava só o **papel** do admin em `sgrf.user_roles` via
  `INITIAL_ADMIN_LOGIN`. O sgrf não cria identidade nem credencial — `auth.users` é do saga
  e é criado no primeiro login.
- Dev (`SEED_DEV_CONFIRM=1 npm run seed:dev`): papéis de 7 logins `@utfpr.edu.br` (sem senha)
  + limite, saldos e solicitações de exemplo.

## Principal

- **Sessão compartilhada**: o sgrf não autentica credencial. Ele confirma no Redis que a
  sessão do saga está viva (cookie `saga_session`, JWT-ponteiro ES256 + liveness). Sem
  sessão → 401 com `login_url` (redirect para o saga); sem heartbeat → 503 com página de erro
  própria, sem redirect. Rate-limit, bloqueio e troca de senha são do saga.
  Ver `docs/session-contract.md` e `AGENTS.md`.
- Papéis: admin/chefe/conselho/professor/aluno; importação em lote (JSON, até 200) com preview dry-run em `POST /api/users/batch/preview|confirm`.
- Solicitações (equipamento, publicação, viagem, auxílio): `totalAnual <= limite` aprova e provisiona automaticamente; acima vai a votação (maioria simples, desempate do chefe, vista +24h, suspensão read-only).
- Gastos idempotentes (`mark-spent` / `reverse-provision`); relatórios CSV/PDF em `/api/reports/*` e telas `/council`, `/reports`.

## Deploy (v0.1.1, Docker)

```bash
export REDIS_URL SAGA_JWKS_URL SAGA_LOGIN_URL PORTAL_ALLOWED_REDIRECT_HOSTS INITIAL_ADMIN_LOGIN
docker compose up -d --build   # app em ${APP_PORT:-8081} + Postgres interno
```

Redis e saga não estão neste compose — são a infra compartilhada (`../compose.dev.yml`).
Sem Redis o verifier não confirma liveness e o sgrf responde 503: indisponibilidade do
Redis é indisponibilidade do sistema.

Imagem única: o Express serve o build do Vite + API na mesma porta (`SERVE_FRONTEND=true`).
Banco e uploads persistem nos volumes `pgdata` e `app-uploads`. Código sem SQL raw
(UUID string, valores em cents).
