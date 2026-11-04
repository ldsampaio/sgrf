# API

## Autenticação

```
GET  /api/auth/me
```

Só `me`. O sgrf **não autentica credencial**: não há `login`, `change-password`,
`forgot-password`, `reset-password` nem `logout` — sessão, cookie e credencial são do saga
(`docs/session-contract.md`). `me` responde a partir de `req.user`, montado pelo Redis, não
do banco. Um corpo com campo de credencial é rejeitado por
`src/middlewares/noCredentialFields.js`.

## Usuários

```
GET    /api/users
POST   /api/users/batch/preview
POST   /api/users/batch/confirm
PATCH  /api/users/{id}
PATCH  /api/users/{id}/role
```

Removido: criação de usuário, `resend-invite` e `force-password-reset` — identidade e
credencial são do saga; o sgrf só atribui papel em `sgrf.user_roles`.

## Configurações

```
GET   /api/settings
PATCH /api/settings/financial
PATCH /api/settings/daily-allowance
PATCH /api/settings/email
POST  /api/settings/email/test
```

## Solicitações

```
GET    /api/requests
POST   /api/requests
GET    /api/requests/{id}
PATCH  /api/requests/{id}
POST   /api/requests/{id}/submit
POST   /api/requests/{id}/cancel
GET    /api/requests/{id}/history
```

## Votação

```
GET  /api/requests/{id}/votes          # cada voto inclui voterName, voterRole, createdAt
POST /api/requests/{id}/votes
PUT  /api/requests/{id}/votes/me
POST /api/requests/{id}/view-requests
POST /api/requests/{id}/close-voting
```

## Discussão

```
GET    /api/requests/{id}/messages     # cada mensagem inclui authorName, authorRole, createdAt, edited
POST   /api/requests/{id}/messages
PATCH  /api/messages/{id}
DELETE /api/messages/{id}
```

## Financeiro

```
GET  /api/finance/balance
PATCH /api/finance/balance
POST /api/requests/{id}/mark-spent
POST /api/requests/{id}/reverse-provision
GET  /api/finance/transactions
```

## Relatórios

```
GET  /api/reports/requests
GET  /api/reports/financial
GET  /api/reports/voting
GET  /api/reports/accountability
GET  /api/reports/dashboard?year=2026
POST /api/reports/dashboard-pdf
```

`GET /dashboard` retorna `{ year, byDocente (Top 8 + Outros), bySaldo, byCategoria, totals }` respeitando permissões (professor/aluno: só próprios).
`POST /dashboard-pdf` recebe `{ year, images: { docentes, saldos, categorias } (dataURL PNG) }` e retorna PDF com as 3 pizzas + tabelas.

## Padrões de resposta

Todos os endpoints devem:

- validar autenticação;
- validar autorização;
- validar entrada;
- retornar erros padronizados;
- registrar eventos relevantes;
- evitar exposição de dados sensíveis.