# Arquitetura

## Arquitetura recomendada

Aplicação web modular monolítica na primeira versão:

```
Frontend Web
    |
API Backend
    |
+------------------+
| Banco de dados   |
| Armazenamento    |
| Serviço de e-mail|
| Jobs agendados   |
+------------------+
```

A arquitetura deve separar os seguintes módulos:

```
auth
users
roles
settings
requests
voting
deliberation
finance
notifications
reports
audit
files
```

## Princípios

- regras de negócio no backend;
- frontend sem autoridade para decisões;
- transações para aprovação e movimentações financeiras;
- serviços independentes por domínio;
- comandos idempotentes;
- eventos internos para notificações;
- auditoria centralizada.

## Tecnologias

A escolha definitiva de framework pode ser feita pelo agente conforme o ambiente do projeto. Independentemente da stack, deve haver:

- tipagem forte, quando suportada;
- migrations;
- validação de schemas;
- testes unitários;
- testes de integração;
- testes de API;
- testes end-to-end;
- documentação OpenAPI;
- lint e formatação automatizados.