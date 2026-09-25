# Permissões

| Ação | Admin | Chefe | Conselheiro | Professor | Aluno |
|------|-------|-------|-------------|-----------|-------|
| Criar solicitação | Sim | Sim | Sim | Sim | Sim |
| Visualizar própria solicitação | Sim | Sim | Sim | Sim | Sim |
| Visualizar pedidos em votação | Sim | Sim | Sim | Sim | Sim |
| Votar | Não aplicável | Sim, quando elegível | Sim, quando elegível | Não | Não |
| Pedir vista | Sim | Sim | Sim | Sim | Não |
| Participar da discussão | Sim | Sim | Sim | Sim | Não |
| Gerenciar usuários | Sim | Parcial | Não | Não | Não |
| Alterar papel de admin | Sim | Não | Não | Não | Não |
| Alterar limite | Sim | Sim | Não | Não | Não |
| Alterar saldo | Sim | Sim | Não | Não | Não |
| Marcar como gasto | Sim | Sim | Não | Não | Não |
| Configurar e-mail | Sim | Não | Não | Não | Não |
| Ver auditoria | Sim | Sim, limitada | Não | Não | Não |
| Gerar relatórios | Sim | Sim | Limitado | Não-rascunhos | Não-rascunhos |

> Observação: os nomes das permissões devem ser implementados como autorizações explícitas, não apenas como verificações espalhadas pelo código.
>
> Notas de decisão (Fase 4 — SEC-01):
> - D-03 (override): a célula ALUNO de "Visualizar pedidos em votação" era
>   "Não" e passou a "Sim". ALUNO enxerga o mesmo que PROFESSOR em pedidos:
>   próprios + todos os não-rascunhos. Implementado em
>   `backend/src/middlewares/visibility.js` (`canViewRequest`/`scopeWhere`).
> - Decisão de escopo de relatórios (04-01, opção "unify widen"): "Gerar
>   relatórios" para PROFESSOR/ALUNO segue a mesma visibilidade da listagem
>   (`scopeWhere`) — próprios + todos os não-rascunhos — em vez de
>   "Próprios". Racional: uma listagem que mostra todos os não-rascunhos ao
>   lado de um relatório que mostra só os próprios seria incoerente, e o
>   rationale de paridade do D-03 generaliza. O relatório de votação segue o
>   view-scope por D-02 (rascunhos excluídos salvo dono/líderes).