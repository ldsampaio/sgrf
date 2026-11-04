# Requisitos não funcionais

## Segurança

- **nenhuma senha de usuário existe no sgrf** (T10): nada de hash, Argon2 ou bcrypt — o sgrf
  não autentica credencial. Credenciais SMTP ficam cifradas em repouso e nunca aparecem em
  log ou resposta de API;
- proteção contra CSRF, XSS e SQL Injection;
- controle de acesso no backend e no frontend;
- sessão compartilhada do saga: JWT-ponteiro ES256 + liveness no Redis. O cache de JWKS
  evita uma chamada de rede, mas nunca concede acesso sozinho;
- cookies HttpOnly, Secure e SameSite (o cookie `saga_session` é definido pelo saga);
- limite de tentativas de login e bloqueio de conta: são do **saga**, não do sgrf;
- expiração de sessão por inatividade: decisão exclusiva do saga;
- validação de uploads;
- antivírus ou inspeção de arquivos, quando disponível;
- logs sem senhas, tokens ou credenciais SMTP.

## Privacidade

O sistema deve aplicar:

- minimização de dados;
- controle de acesso por necessidade;
- trilha de auditoria;
- política de retenção configurável;
- exportação de dados autorizada;
- anonimização ou exclusão conforme política institucional.

## Disponibilidade

- backups automatizados;
- restauração testada periodicamente;
- migrações versionadas;
- monitoramento de erros;
- health check da aplicação;
- logs estruturados.

## Usabilidade

- interface responsiva;
- mensagens de erro claras;
- confirmação para ações destrutivas;
- acessibilidade compatível com WCAG 2.1 AA;
- valores monetários formatados em padrão brasileiro;
- datas exibidas no fuso horário de Brasília.