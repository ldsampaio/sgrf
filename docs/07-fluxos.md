# Fluxos

## Fluxo de aprovação

```
Usuário cria rascunho
    ↓
Submete solicitação
    ↓
Validação
    ↓
Calcula total em BRL
    ↓
Calcula total anual
    ↓
Dentro do limite?
   ├── Sim → Aprovação automática
   │            ↓
   │         Provisiona valor
   │            ↓
   │         Notifica solicitante
   └── Não → Abre votação por 24h
                ↓
             Conselheiros discutem e votam
                ↓
             Pedido de vista?
               ├── Sim → Adiciona 24h
               └── Não → (continua)
                ↓
             Encerra votação
                ↓
             Apura resultado
            ├── Deferido → Provisiona valor
            ├── Parcial → Provisiona valor parcial
            └── Indeferido → Não provisiona
                                  ↓
                           Notifica solicitante
```

## Fluxo financeiro

```
Solicitação aprovada
    ↓
Admin ou chefe confirma pagamento
    ↓
DISPONIVEL → PROVISIONADO → GASTO
```

A devolução de provisionado para disponível deve ser registrada como operação administrativa auditada.