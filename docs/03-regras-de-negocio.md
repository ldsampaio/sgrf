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

## RN-009 — Arbitragem de aprovação parcial

Quando a apuração resultar `PARCIAL`, a solicitação NÃO conclui com valor — move para:

```
AGUARDANDO_ARBITRAGEM
```

e o `CHEFE_DEPARTAMENTO` arbitra o valor final em `(0, requestedAmountCents]`, em centavos inteiros, com justificativa obrigatória registrada e auditada (`decidedBy` = chefe, como votos parciais exigem `comment`).

Esta regra substitui o comportamento anterior de primeiro-voto-parcial-vence em `backend/src/services/votingService.js:84` (`validVotes.find(...)`), que concluía com o valor do primeiro voto parcial. Votos parciais como `[8000, 5000, 6000]` não mais se resolvem automaticamente para nenhum desses valores.

(Decidido em 2026-09-23, D-01…D-04.)

## RN-010 — Cancelamento após aprovação

O cancelamento exige justificativa em TODA solicitação; ausente, o backend responde 400.

A matriz por status e papel:

```
dono (solicitante): somente RASCUNHO e EM_VOTACAO
ADMINISTRADOR: qualquer status não-terminal (inclui INDEFERIDO como limpeza)
CHEFE_DEPARTAMENTO: qualquer status antes de CONCLUIDO
CONCLUIDO (gasto): NUNCA cancelável
CANCELADO: NUNCA cancelável
```

Papéis válidos: ADMINISTRADOR, CHEFE_DEPARTAMENTO, CONSELHEIRO, PROFESSOR, ALUNO.

O conjunto cancelável é todo status não-terminal exceto o próprio CANCELADO; `INDEFERIDO` é cancelável pelo admin como limpeza; terminais `CONCLUIDO` e `CANCELADO` são imutáveis.

Cancelar solicitação aprovada ou provisionada grava `FinancialTransaction` compensatória auditada de tipo `REVERSE` (padrão `reverseProvision`), com a justificativa nos metadados da transação `REVERSE` e nos eventos `AuditEvent` `request_cancelled` e `provision_reversed`.

(Decidido em 2026-09-23, D-05…D-08.)

## RN-011 — Ausência de quórum

Não há quórum mínimo: decide a apuração dos votos válidos lançados (`tally()` inalterado, maioria simples dos válidos, abstenção ignora).

Nenhum status "sem quórum" é introduzido; a recomendação anterior (maioria dos conselheiros elegíveis + ação manual) está superada pela decisão abaixo registrada em `docs/14-decisoes-em-aberto.md`.

(Decidido em 2026-09-23, D-09.)

## RN-012 — Pedido de vista

Cada conselheiro tem direito a 1 vista por solicitação; as prorrogações de prazo acumulam-se.

Garantido pelo comportamento atual `@@unique([requestId, requestedBy])` (máx 1 vista por conselheiro por solicitação; segunda tentativa responde 409). O teto anterior de máximo de um por solicitação está descartado pela decisão abaixo registrada em `docs/14-decisoes-em-aberto.md`.

(Decidido em 2026-09-23, D-10.)

## RN-013 — Interrupção da votação e reunião extraordinária

Conselheiros podem solicitar a interrupção da votação; o chefe pauta o pedido em reunião extraordinária do conselho, entrando em suspensão pelo fluxo existente:

```
SUSPENSO_REUNIAO_ORDINARIA
```

Nenhum novo status é criado. Após a reunião, somente `ADMINISTRADOR` ou `CHEFE_DEPARTAMENTO` lançam manualmente o resultado da deliberação do conselho (via `collegiateDecision`, a partir do estado suspenso).

(Decidido em 2026-09-23, D-11.)