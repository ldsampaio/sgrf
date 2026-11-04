# Contrato de deploy

Checklist validável do contrato de ambiente (SEC-02 + SEC-04). Cada passo traz comando e
resultado esperado. Nenhum valor secreto real aparece neste documento — apenas nomes de
variáveis e formatos de placeholder.

## Topologia oficial

O único término TLS é o túnel Cloudflare. Não há Caddy nem outro proxy documentado ou testado nesta fase.

| Etapa | Componente | Observação |
|-------|-----------|------------|
| 1 | Borda Cloudflare | Termina TLS, origem pública https |
| 2 | cloudflared local | Encaminha ao host do servidor |
| 3 | Porta de entrada do servidor | Mapeada via APP_PORT para a porta interna |
| 4 | App na porta 3000 | Serve API e SPA na mesma origem |

CORS exige origem exata igual ao host público https, sem barra final. `FRONTEND_URL=https://exemplo.utfpr.edu.br` é válido; `FRONTEND_URL=https://exemplo.utfpr.edu.br/` é inválido.

O **Redis de sessões e o saga não estão neste compose**: são a infra compartilhada. Sem o
Redis o verifier não confirma liveness e o sgrf responde 503 — indisponibilidade do Redis é
indisponibilidade do sistema inteiro.

Trust proxy e rate limit são propriedade da Fase 8 (SEC-03). Nada há para configurar aqui.

## Passo 1 — boot recusa ambiente inseguro em produção

- [ ] Subir com valores em formato placeholder e confirmar a recusa que nomeia os ofensores.

```bash
cd backend
NODE_ENV=production \
  REDIS_URL="redis://saga_readonly:change-me@redis:6379/0" \
  SAGA_JWKS_URL="change-me" \
  SAGA_LOGIN_URL="" \
  PORTAL_ALLOWED_REDIRECT_HOSTS="" \
  node -e "require('./src/config/env.js')"
```

Resultado esperado: o processo aborta com erro `SEC-02: Production boot refused`, listando
`REDIS_URL`, `SAGA_JWKS_URL`, `SAGA_LOGIN_URL` e `PORTAL_ALLOWED_REDIRECT_HOSTS` como
ofensores. Nenhum valor secreto aparece na mensagem, apenas os nomes das variáveis com dica
de correção. O gate também exige que `REDIS_URL` use o usuário ACL `saga_readonly` — o sgrf
nunca escreve no store de sessões. Não existem mais `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`
nem senha de admin: o sgrf não assina token próprio. Fora de `NODE_ENV=production`, os
fallbacks de desenvolvimento carregam sem recusa.

## Passo 2 — sessão compartilhada na URL pública

O sgrf **não emite cookie**: quem define `saga_session` é o saga. O que o sgrf pode
verificar em produção é o caminho de erro do contrato.

- [ ] Com `FRONTEND_URL` apontando ao host público https e `PORTAL_ALLOWED_REDIRECT_HOSTS`
  contendo esse host, confirmar:

```bash
curl -s https://exemplo.utfpr.edu.br/api/auth/me          # sem cookie
curl -s https://exemplo.utfpr.edu.br/api/auth/me -H "Cookie: saga_session=<token válido>"
```

Resultado esperado: sem cookie, 401 `NO_SESSION` com `login_url` apontando para o login do
saga e `redirect` montado só porque o host de origem está na allowlist; com cookie de sessão
viva, 200. Se o host de origem não está na allowlist, `login_url` vem sem `redirect` (anti
open-redirect). Com `saga:heartbeat` ausente, a resposta é 503 `IDENTITY_UNAVAILABLE` com
`Retry-After` e **sem** `login_url` — o frontend serve a página própria `/unavailable`.

## Passo 3 — desenvolvimento local continua intacto

- [ ] Subir o fluxo de desenvolvimento e confirmar o redirecionamento para o portal.

```bash
./start-dev.sh
```

Resultado esperado: backend em `:3000` e frontend em `:5173` sobem com os defaults locais;
não há formulário de login — `/login` é a página de redirecionamento para o portal do saga
em `:8000`; nenhum gate de produção dispara fora de `NODE_ENV=production`.

## Falha esperada — acesso via IP de LAN em HTTP puro

O cookie compartilhado `saga_session` é emitido pelo saga com `Secure` fora de `localhost`;
por isso acesso por IP de LAN em HTTP puro é falha esperada por desenho, não um bug. Apenas
`localhost` é isento da exigência de `Secure` pelos navegadores; IPs de LAN exigem HTTPS.
Não desabilite `Secure` como contorno — use a URL pública https ou o fluxo localhost do
passo 3. O sgrf não tem controle sobre esse atributo: ele só lê o cookie.
