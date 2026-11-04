# Backlog

## Fase 1 — Fundação

- [ ] criar projeto;
- [ ] configurar banco;
- [ ] configurar migrations;
- [ ] configurar variáveis de ambiente;
- [ ] implementar logging;
- [ ] implementar tratamento de erros;
- [ ] configurar CI;
- [ ] criar papel do administrador inicial em `sgrf.user_roles` (a identidade é criada pelo
  saga no primeiro login);
- [x] autenticação: **removida do sgrf** — o sgrf verifica a sessão compartilhada do saga;
- [x] troca obrigatória de senha: **removida** — o sgrf não guarda credencial (T10).

## Fase 2 — Usuários e permissões

- [ ] atribuição de papel por sistema (`sgrf.user_roles`) — o CRUD de identidade é do saga;
- [ ] papéis;
- [ ] autorização;
- [x] convite por e-mail: removido — o sgrf não cria usuário nem credencial;
- [x] redefinição de senha: removida — credencial é do saga (T10);
- [ ] auditoria de usuários.

## Fase 3 — Configurações e financeiro

- [ ] limite automático;
- [ ] informações de diárias;
- [ ] taxa de câmbio;
- [ ] saldo departamental;
- [ ] transações financeiras;
- [ ] histórico de configurações.

## Fase 4 — Solicitações

- [ ] modelo genérico;
- [ ] equipamento;
- [ ] publicação;
- [ ] viagem;
- [ ] auxílio estudantil;
- [ ] upload seguro;
- [ ] submissão;
- [ ] cálculo anual.

## Fase 5 — Aprovação e conselho

- [ ] aprovação automática;
- [ ] abertura de votação;
- [ ] votação;
- [ ] alteração de voto;
- [ ] abstenção;
- [ ] decisão parcial;
- [ ] pedido de vista;
- [ ] painel de discussão;
- [ ] encerramento automático.

## Fase 6 — Dashboard e relatórios

- [x] dashboard (KPIs + 3 pizzas: docentes Top 8, saldos, categorias + filtro ano);
- [x] exportação PDF do dashboard com gráficos;
- [ ] filtros;
- [ ] relatório financeiro;
- [ ] relatório de solicitações;
- [ ] relatório de votação;
- [ ] prestação de contas;
- [ ] exportação.

## Fase 7 — Preparação para RPA

- [ ] API de consulta de pedidos provisionados;
- [ ] identificador externo;
- [ ] endpoint idempotente;
- [ ] status de integração;
- [ ] registro de erros;
- [ ] documentação para futura integração.