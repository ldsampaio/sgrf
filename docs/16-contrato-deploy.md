# Contrato de deploy

Checklist validável do contrato de ambiente (SEC-02 + SEC-04). Cada passo traz comando e resultado esperado. Nenhum valor secreto real aparece neste documento — apenas nomes de variáveis e formatos de placeholder.

## Topologia oficial

O único término TLS é o túnel Cloudflare. Não há Caddy nem outro proxy documentado ou testado nesta fase.

| Etapa | Componente | Observação |
|-------|-----------|------------|
| 1 | Borda Cloudflare | Termina TLS, origem pública https |
| 2 | cloudflared local | Encaminha ao host do servidor |
| 3 | Porta de entrada do servidor | Mapeada via APP_PORT para a porta interna |
| 4 | App na porta 3000 | Serve API e SPA na mesma origem |

CORS exige origem exata igual ao host público https, sem barra final. `FRONTEND_URL=https://exemplo.utfpr.edu.br` é válido; `FRONTEND_URL=https://exemplo.utfpr.edu.br/` é inválido.

Trust proxy e rate limit são propriedade da Fase 8 (SEC-03). Nada há para configurar aqui.

## Passo 1 — boot recusa segredo inseguro em produção

- [ ] Subir com valores em formato placeholder e confirmar a recusa que nomeia os ofensores.

```bash
cd backend
NODE_ENV=production \
  JWT_ACCESS_SECRET="change-me-access-32chars-min" \
  JWT_REFRESH_SECRET="change-me-refresh-32chars-min" \
  INITIAL_ADMIN_EMAIL="admin@utfpr.edu.br" \
  INITIAL_ADMIN_TEMPORARY_PASSWORD="" \
  node -e "require('./src/config/env.js')"
```

Resultado esperado: o processo aborta com erro `SEC-02: Production boot refused`, listando `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET` e `INITIAL_ADMIN_TEMPORARY_PASSWORD` como ofensores. Nenhum valor secreto aparece na mensagem, apenas os nomes das variáveis com dica de correção. Fora de `NODE_ENV=production`, os mesmos fallbacks de desenvolvimento carregam sem recusa.

## Passo 2 — login via URL pública emite cookie Secure e logout apaga

- [ ] Com `COOKIE_SECURE=true` e `FRONTEND_URL` apontando ao host público https, fazer login pela URL pública e confirmar o cookie de sessão Secure; depois fazer logout e confirmar a remoção.

```bash
COOKIE_SECURE=true FRONTEND_URL=https://exemplo.utfpr.edu.br docker compose up -d --build
```

Resultado esperado: login com credenciais válidas na URL pública responde 200 e retorna para `/` com `Set-Cookie` contendo `access_token` e `refresh_token` com atributos `HttpOnly`, `Secure` e `SameSite=Lax`; o botão de login exibe `Entrando` desabilitado durante a requisição e volta ao normal depois; falha de login exibe o alerta existente com a mensagem do servidor ou `Falha no login`, nunca um silêncio sem login; logout responde 200 e remove ambos os cookies com os mesmos atributos da emissão.

## Passo 3 — desenvolvimento local continua intacto

- [ ] Subir o fluxo de desenvolvimento e confirmar login em localhost sem Secure.

```bash
./start-dev.sh
```

Resultado esperado: backend em `:3000` e frontend em `:5173` sobem com os defaults locais; login em `http://localhost:5173` funciona com cookies sem o atributo `Secure`; nenhum gate de produção dispara fora de `NODE_ENV=production`.

## Falha esperada — login via IP de LAN em HTTP puro

Login via IP de LAN em HTTP puro é falha esperada por desenho do cookie `Secure`, não um bug. Apenas `localhost` é isento da exigência de `Secure` pelos navegadores; IPs de LAN exigem HTTPS. Não desabilite `Secure` como contorno — use a URL pública https ou o fluxo localhost do passo 3.
