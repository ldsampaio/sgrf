# Requisitos não funcionais

## Segurança

- senhas armazenadas com Argon2id ou bcrypt;
- proteção contra CSRF, XSS e SQL Injection;
- controle de acesso no backend e no frontend;
- autenticação baseada em sessão segura ou tokens de curta duração;
- cookies HttpOnly, Secure e SameSite;
- limite de tentativas de login;
- expiração de sessão por inatividade;
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