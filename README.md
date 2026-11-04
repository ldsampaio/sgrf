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

## Deploy (v0.1.4, Docker)

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

### Pré-requisitos

- Docker Engine + Docker Compose (v2) instalados e funcionando.
- O usuário atual precisa pertencer ao grupo `docker`:
  ```bash
  sudo usermod -aG docker $USER && newgrp docker
  ```

### 1. Definir secrets obrigatórios

O `compose.yaml` exige quatro variáveis de ambiente. Sem elas o Compose recusa o boot.
Gere valores seguros (nunca commite estes valores):

```bash
JWT_ACCESS_SECRET="$(openssl rand -base64 36 | tr -d '\n=' | head -c 48)"
JWT_REFRESH_SECRET="$(openssl rand -base64 36 | tr -d '\n=' | head -c 48)"
INITIAL_ADMIN_EMAIL="seu.admin@utfpr.edu.br"           # domínio institucional obrigatório
INITIAL_ADMIN_TEMPORARY_PASSWORD="$(openssl rand -base64 24 | tr -d '\n=' | head -c 32)"
```

> A senha temporária expira em 24 h e exige troca no primeiro login.

### 2. Selecionar a porta de entrada

A porta externa (host) é controlada pela variável **`APP_PORT`** (default **8081**).
Ela mapeia para a porta 3000 dentro do container:

```bash
export APP_PORT=8081     # altere aqui para usar outra porta
```

O `FRONTEND_URL` deve apontar para a mesma porta — o compose interpola automaticamente:
`FRONTEND_URL=http://localhost:${APP_PORT:-8081}`.

Em produção atrás de Cloudflare (https), sobrescreva ambas:
```bash
export APP_PORT=443
export FRONTEND_URL=https://seu-dominio.utfpr.edu.br
export COOKIE_SECURE=true      # cookies marcados Secure
```

### 3. Criar o arquivo `.env` de deploy

Cole os valores no arquivo `.env` na raiz do projeto (`.gitignore` já o exclui).
Use este script de conveniência:

```bash
cd ~/Documents/Projetos/sgrf
cat > .env << 'EOF'
APP_PORT=8081
COOKIE_SECURE=false
FRONTEND_URL=http://localhost:8081
JWT_ACCESS_SECRET=GERE-UMA-STRING-SEGREDO-48-chars
JWT_REFRESH_SECRET=GERE-UMA-STRING-SEGREDO-48-chars
INITIAL_ADMIN_EMAIL=seu.admin@utfpr.edu.br
INITIAL_ADMIN_TEMPORARY_PASSWORD=GERE-UMA-SENHA-SEGREDO-32-chars
EOF
```

> Em desenvolvimento local (HTTP sem TLS) mantenha `COOKIE_SECURE=false`.
> Em produção use `COOKIE_SECURE=true` e HTTPS.

### 4. Subir a stack

```bash
docker compose up -d --build
```

O entrypoint roda `prisma migrate deploy` (migrações acumuladas) e `seed.js` (admin, idempotente)
antes de iniciar o Express. O app sobe na porta 3000 dentro do container, exposta pelo host em `APP_PORT`.

### 5. Verificar

```bash
curl http://localhost:8081/health     # esperado: {"ok":true,"service":"sgrd-backend"}
curl -I http://localhost:8081/        # esperado: HTTP/1.1 200  (SPA servido pelo Express)
docker compose logs -f app            # seguir logs
```

A aplicação e o banco ficam disponíveis em `http://localhost:${APP_PORT:-8081}`.
