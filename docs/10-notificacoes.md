# Notificações

## Eventos de e-mail

| Evento | Destinatários |
|--------|---------------|
| Novo usuário cadastrado | Novo usuário |
| Reenvio de convite | Usuário |
| Solicitação aprovada automaticamente | Solicitante |
| Solicitação acima do limite | Conselheiros elegíveis |
| Pedido de vista | Conselheiros elegíveis e chefe |
| Novo comentário na deliberação | Participantes elegíveis |
| Votação encerrada | Solicitante e conselheiros |
| Solicitação aprovada | Solicitante |
| Solicitação parcialmente aprovada | Solicitante |
| Solicitação indeferida | Solicitante |
| Pedido marcado como gasto | Solicitante |
| Falha no envio de e-mail | Administrador |

Cada e-mail deve conter:

- identificação do pedido;
- tipo;
- valor;
- status;
- prazo, quando aplicável;
- link interno para o sistema;
- orientação correspondente.

O envio deve ser assíncrono por fila, com:

- tentativas automáticas;
- registro de falha;
- prevenção de duplicidade;
- histórico de entrega.