# Regras de negócio

## RN-001 — Domínio de e-mail

Somente endereços terminados exatamente em:

```
@utfpr.edu.br
```

serão aceitos.

A validação deve ser feita no backend. A validação no frontend é apenas auxiliar.

## RN-002 — Ano financeiro

Cada solicitação deve possuir um ano de referência.

O total anual deve considerar o ano da solicitação, não necessariamente o ano de criação do registro.

## RN-003 — Valores monetários

Valores financeiros não devem ser armazenados em ponto flutuante.

Usar:

- DECIMAL(15,2) no banco; ou
- inteiro em centavos.

A recomendação é usar inteiro em centavos internamente.

## RN-004 — Limite de aprovação

O limite deve possuir histórico:

```
limite
vigência inicial
vigência final
criado por
data de criação
alterado por
data de alteração
```

Uma alteração de limite não deve modificar decisões já realizadas.

## RN-005 — Disponibilidade financeira

O sistema deve impedir aprovação quando o saldo disponível for inferior ao valor aprovado, salvo se uma configuração explícita permitir saldo negativo.

Recomendação inicial: não permitir saldo disponível negativo.

## RN-006 — Imutabilidade após submissão

Depois de submetida, a solicitação não pode ter seus dados principais alterados pelo solicitante.

Alterações administrativas devem:

- registrar versão;
- indicar autor;
- indicar motivo;
- preservar o conteúdo anterior.

## RN-007 — Prazo de votação

O prazo deve ser armazenado como data absoluta:

```
voting_started_at
voting_deadline_at
```

O sistema não deve depender apenas de um contador no frontend.

## RN-008 — Encerramento automático

Um processo agendado deve:

- encontrar votações vencidas;
- impedir novos votos;
- apurar o resultado;
- executar a transação financeira;
- enviar notificações.

Também deve existir uma ação manual autorizada para reprocessamento seguro.