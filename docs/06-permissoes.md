# Permissões

| Ação | Admin | Chefe | Conselheiro | Professor | Aluno |
|------|-------|-------|-------------|-----------|-------|
| Criar solicitação | Sim | Sim | Sim | Sim | Sim |
| Visualizar própria solicitação | Sim | Sim | Sim | Sim | Sim |
| Visualizar pedidos em votação | Sim | Sim | Sim | Sim | Não |
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
| Gerar relatórios | Sim | Sim | Limitado | Próprios | Próprios |

> Observação: os nomes das permissões devem ser implementados como autorizações explícitas, não apenas como verificações espalhadas pelo código.