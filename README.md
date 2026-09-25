# SGRD — Sistema de Gestão de Recursos Departamentais (MVP)

MVC · Backend Node + Express + Postgres (Prisma) · Frontend Vue 3 + Vite (SPA).

Gestão de usuários, solicitações financeiras, aprovação automática/votação do conselho, provisionamento de saldo e relatórios para prestação de contas. Detalhes em `docs/`.

## Início rápido

```bash
./start-dev.sh              # backend :3000 + frontend :5173
./start-dev.sh --seed-dev   # + massa de teste (nunca em produção)
```

Manual:
```bash
cd backend && cp .env.example .env
npx prisma migrate dev && node prisma/seed.js
npm run dev
cd ../frontend && npm run dev
```

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

- Deploy (`npm run seed`): cria só o admin via `INITIAL_ADMIN_EMAIL` + `INITIAL_ADMIN_TEMPORARY_PASSWORD`.
- Dev (`SEED_DEV_CONFIRM=1 npm run seed:dev`): 7 usuários `@utfpr.edu.br` (senha `Trocar123!`) + limite, saldos e solicitações de exemplo.

## Principal

- Auth só `@utfpr.edu.br`, bloqueio após 5 tentativas, troca obrigatória, JWT em cookie httpOnly.
- Papéis: admin/chefe/conselho/professor/aluno; importação em lote (JSON, até 200) com preview dry-run em `POST /api/users/batch/preview|confirm`.
- Solicitações (equipamento, publicação, viagem, auxílio): `totalAnual <= limite` aprova e provisiona automaticamente; acima vai a votação (maioria simples, desempate do chefe, vista +24h, suspensão read-only).
- Gastos idempotentes (`mark-spent` / `reverse-provision`); relatórios CSV/PDF em `/api/reports/*` e telas `/council`, `/reports`.

## Deploy (v0.1.1, Docker)

```bash
export JWT_ACCESS_SECRET JWT_REFRESH_SECRET INITIAL_ADMIN_EMAIL INITIAL_ADMIN_TEMPORARY_PASSWORD
docker compose up -d --build   # app em ${APP_PORT:-8081} + Postgres interno
```

Imagem única: o Express serve o build do Vite + API na mesma porta (`SERVE_FRONTEND=true`).
Banco e uploads persistem nos volumes `pgdata` e `app-uploads`. Código sem SQL raw
(UUID string, valores em cents).
