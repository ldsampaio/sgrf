# Critérios de aceite

## Critério geral de pronto

Uma funcionalidade somente será considerada concluída quando:

- possuir requisitos documentados;
- possuir validação no frontend e backend;
- possuir testes unitários;
- possuir testes de integração quando envolver persistência ou serviços;
- possuir teste end-to-end quando envolver fluxo de usuário;
- possuir autorização;
- possuir auditoria quando alterar dados relevantes;
- possuir mensagens de erro;
- possuir documentação de API;
- passar no pipeline de CI;
- não apresentar vulnerabilidades críticas ou altas conhecidas.

## Critério de aceite da aprovação automática

Dado que:

- o usuário está autenticado;
- possui e-mail institucional;
- existe limite vigente;
- a solicitação é válida;
- o total anual, incluindo a nova solicitação, não supera o limite;
- há saldo disponível suficiente;

quando ele submeter a solicitação,

então:

- o pedido deve ser aprovado automaticamente;
- o valor deve ser provisionado;
- o saldo deve ser atualizado atomicamente;
- o histórico deve registrar a regra aplicada;
- o solicitante deve ser notificado.

## Critério de aceite da votação

Dado que o total supera o limite,

quando a solicitação for submetida,

então:

- deve ser aberta uma votação de 24 horas;
- conselheiros elegíveis devem ser notificados;
- o solicitante, se conselheiro, não pode votar;
- deve haver as opções: deferir, indeferir, deferir parcialmente e abster-se;
- voto parcial deve exigir comentário;
- pedido de vista deve adicionar 24 horas;
- o resultado deve ser auditável;
- o valor aprovado deve ser provisionado somente após a decisão final.

## Prompt inicial para o agente de codificação

O agente pode receber o seguinte prompt como instrução de implementação:

```
Implemente o Sistema de Gestão de Recursos Departamentais conforme os documentos em /docs.

Antes de escrever código:
- analise todos os requisitos;
- identifique conflitos e decisões em aberto;
- proponha o modelo de dados;
- propõe os contratos de API;
- crie uma lista de tarefas pequenas e verificáveis;
- implemente uma tarefa por vez;
- escreva os testes antes ou junto da implementação;
- não altere regras de negócio sem atualizar a documentação;
- nunca coloque segredos no código;
- nunca confie em validações feitas apenas no frontend.

Para cada tarefa:
- descreva o objetivo;
- liste arquivos alterados;
- implemente;
- crie ou atualize testes;
- execute lint, testes e build;
- informe riscos e decisões;
- verifique os critérios de aceite.

Priorize a implementação nesta ordem:
1. fundação do projeto;
2. banco e migrations;
3. autenticação;
4. usuários e permissões;
5. configurações;
6. solicitações;
7. aprovação automática;
8. votação;
9. financeiro;
10. dashboard e relatórios.

Todas as operações de aprovação, votação, provisionamento e alteração para gasto devem ser idempotentes, autorizadas e auditadas.

Ponto técnico mais importante:

A regra "o total anual do solicitante" precisa ser definida com precisão antes da implementação final. A especificação acima recomenda considerar as solicitações aprovadas e em análise no mesmo ano, para evitar que o usuário divida uma solicitação grande em várias menores e contorne o limite.
```