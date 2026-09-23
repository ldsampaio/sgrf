# Decisões em aberto

Estas questões devem ser resolvidas antes da implantação em produção. Para não bloquear o desenvolvimento, os valores recomendados abaixo podem ser usados na primeira versão.

| Tema | Recomendação inicial |
|------|---------------------|
| Quórum do conselho | maioria dos conselheiros elegíveis — OVERRIDDEN 2026-09-23 (D-09): sem quórum mínimo; decide a apuração dos votos válidos lançados (`tally()` inalterado); nenhum status "sem quórum"; critério 4 do ROADMAP Fase 2 (quórum/vista adiados para v2) STALE, superado por decisão do usuário (RN-011) |
| Ausência de quórum | status "sem quórum" e ação manual — OVERRIDDEN 2026-09-23 (D-09): recomendação anterior superada; nenhum status novo é introduzido (RN-011) |
| Voto do chefe | voto regular se elegível; desempate somente quando necessário |
| Abstenção | não conta como favorável ou contrário |
| Pedido de vista | máximo de um por solicitação — REJECTED 2026-09-23 (D-10): 1 vista por conselheiro por solicitação, com prorrogações de prazo acumuladas (`@@unique([requestId, requestedBy])`); o teto por solicitação é descartado (RN-012) |
| Alteração do limite | não afeta decisões anteriores |
| Saldo insuficiente | bloquear aprovação |
| Taxa de dólar | valor configurado pelo admin e congelado no envio |
| Pedido de aluno para auxílio estudantil | permitir somente conforme política configurada |
| Cancelamento após aprovação | permitido apenas por admin ou chefe, com justificativa — decidido 2026-09-23: dono somente RASCUNHO/EM_VOTACAO, ADMINISTRADOR qualquer não-terminal (inclui INDEFERIDO como limpeza), CHEFE_DEPARTAMENTO antes de CONCLUIDO, justificativa obrigatória (400) em metadados REVERSE + AuditEvent request_cancelled/provision_reversed, cancelamento de aprovada/provisionada grava REVERSE compensatória auditada, CONCLUIDO/CANCELADO imutáveis (RN-010, D-05…D-08) |
| Exclusão de usuário | desativação lógica, nunca exclusão física |
| Prazo de senha temporária | 24 horas |
| Retenção de anexos | política institucional configurável |
| E-mails falhos | três tentativas e alerta ao administrador |
| Aprovação parcial (agregação) | decidido 2026-09-23: PARCIAL → AGUARDANDO_ARBITRAGEM, chefe arbitra (0, solicitado] com justificativa auditada; substitui primeiro-voto-parcial-vence; votos [8000, 5000, 6000] não mais se resolvem sozinhos |