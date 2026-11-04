# Segurança e auditoria

## Eventos auditados pelo sgrf

A suíte de auditoria do sgrf cobre os eventos de domínio do sistema. Os nomes abaixo
são os que o código realmente escreve em `sgrf.audit_events` (`src/services/auditService.js`):

- criação e submissão de solicitação (`request_created`, `request_submitted`);
- cancelamento de solicitação e reversão de cancelamento (`request_cancelled`, `cancellation_reversal`);
- voto (`vote` — registrado pelo serviço de votação), fechamento de votação e arbitragem
  (`voting_closed`, `voting_closed_arbitration`, `partial_arbitration`, `collegiate_decision`);
- suspensão e reabertura de votação (`voting_suspended`, `voting_unsuspended`);
- pedido de vista (`vista_requested`);
- mensagem criada, editada ou removida (`message_created`, `message_edited`, `message_deleted`);
- alteração de papel (`role_changed`) e de usuário (`user_updated`, `users_batch_preview`, `users_batch_created`);
- alteração de configuração e de saldo (`settings_changed`, `balance_changed`);
- provisionamento e gasto (`marked_spent`, `provision_reversed`);
- exportação de relatório (`report_exported`);
- falha de envio de e-mail (`email_give_up`).

## Eventos de autenticação não são do sgrf

Login bem-sucedido, falha de login e bloqueio de conta são auditados pelo **saga**, que é o
único sistema que autentica credencial. O sgrf não tem rota de login, não tem tabela de
credencial e não registra tentativa de acesso — ele apenas confirma no Redis que a sessão do
saga está viva (`docs/session-contract.md`).

## Credencial (T10)

Vale para os três repositórios: nenhuma credencial em log, banco, store ou resposta de erro.

- O sgrf **não aceita campo de credencial** em corpo de request: `src/middlewares/noCredentialFields.js`
  responde `CREDENTIAL_FIELD_NAO_ACEITA` / `CREDENTIAL_FIELD_NOT_ACCEPTED`.
- Nenhuma coluna de senha existe em `prisma/schema.prisma` — nem `passwordHash`, nem
  contadores de tentativa, nem `mustChangePassword`. A suíte `tests/contratoSessao.test.js`
  falha se alguém reintroduzir esses campos.
- O token de sessão nunca é escrito em log (`src/config/logger.js` redige `cookie`).
- A resposta de erro não revela se um login existe: `NO_SESSION`, `BAD_TOKEN`, `SESSION_DEAD`
  e `SESSION_STALE` compartilham a mesma copy.

## Sessão compartilhada

- Sessão = JWT-ponteiro (`ES256`, claims `iss/sub/sid/gen/role/exp`) + liveness no Redis.
  O Redis é a fonte da verdade; só o JWKS pode ser cacheado (por `kid`) e o cache nunca
  concede acesso sozinho.
- Falha fechada: sem `saga:heartbeat` o sgrf responde **503** mesmo com token válido, e o
  frontend serve a página de erro própria (`/unavailable`) **sem redirect** — redirecionar
  para o serviço que caiu é o loop que se quer evitar.
- 401 → redirect para `login_url`; o `redirect` só é montado quando o host de origem está na
  allowlist (anti open-redirect).
- ACL Redis `saga_readonly`: o sgrf só lê `saga:sess:*:meta` e `saga:heartbeat`; não lê o
  payload upstream e não escreve nada.
- Papel por sistema vive em `sgrf.user_roles`; o claim `role` do JWT nunca é usado.
- Prisma nunca migra o schema `auth` — `AuthUser`/`AuthProfile` são modelos read-only. Quem
  escreve em `auth` é o saga.

## Segregação de responsabilidades

O agente deve impedir que:

- aluno altere saldo;
- professor altere limite;
- conselheiro vote quando não elegível;
- solicitante vote na própria solicitação;
- usuário comum veja anexos de pedido não autorizado;
- chefe altere papel de administrador.

## Arquivos

- validar extensão e MIME;
- calcular checksum;
- gerar nome interno aleatório;
- não confiar no nome original;
- impedir execução;
- restringir download por autorização;
- registrar downloads;
- limitar tamanho;
- verificar arquivos corrompidos.
