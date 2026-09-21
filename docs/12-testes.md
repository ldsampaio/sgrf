# Testes

## Testes unitários

### Autenticação
- aceita domínio institucional;
- rejeita domínio externo;
- rejeita senha inválida;
- força troca de senha temporária;
- expira senha temporária;
- bloqueia excesso de tentativas.

### Cálculo financeiro
- calcula diárias corretamente;
- soma passagens;
- converte dólar para real;
- preserva taxa de câmbio do envio;
- rejeita valores negativos;
- mantém precisão monetária.

### Limite anual
- aprova quando o total é menor que o limite;
- aprova quando o total é exatamente igual ao limite;
- encaminha para votação quando excede;
- considera pedidos anteriores do mesmo ano;
- não mistura anos diferentes;
- usa o limite vigente na data de submissão.

### Votação
- permite um voto por conselheiro;
- permite alteração antes do fechamento;
- impede alteração após fechamento;
- exclui solicitante conselheiro;
- aceita abstenção;
- exige comentário para voto parcial;
- identifica empate;
- solicita desempate do chefe;
- adiciona 24 horas por pedido de vista;
- impede pedido de vista após o prazo.

### Financeiro
- aprovação provisiona corretamente;
- aprovação parcial provisiona somente o valor aprovado;
- indeferimento não altera saldo;
- marcar gasto move o valor corretamente;
- impede gasto superior ao provisionado;
- usa transação atômica;
- evita dupla execução por requisições repetidas.

## Testes de integração

- criação de usuário e envio de convite;
- configuração SMTP e envio de e-mail;
- submissão de pedido com anexos;
- aprovação automática;
- abertura de votação;
- alteração de voto;
- pedido de vista;
- encerramento automático;
- provisionamento;
- marcação como gasto;
- geração de relatório;
- gravação de auditoria.

## Testes end-to-end

### Cenário 1 — Aluno solicita equipamento
1. aluno faz login;
2. cria solicitação;
3. informa especificação;
4. informa valor;
5. submete;
6. sistema avalia o limite;
7. resultado é exibido;
8. e-mail é gerado;
9. dashboard é atualizado.

### Cenário 2 — Professor solicita publicação acima do limite
1. professor anexa artigo e carta de aceite;
2. informa justificativa;
3. informa valor;
4. submete;
5. conselho recebe a notificação;
6. conselheiros discutem;
7. conselheiros votam;
8. votação é encerrada;
9. pedido é aprovado;
10. valor é provisionado.

### Cenário 3 — Pedido parcialmente aprovado
1. professor solicita passagens e diárias;
2. conselho escolhe deferimento parcial;
3. comentários individuais são exigidos;
4. decisão registra itens aprovados;
5. somente o valor aprovado é provisionado;
6. solicitante recebe o resultado detalhado.

### Cenário 4 — Solicitação de vista
1. professor elegível solicita vista;
2. sistema registra justificativa;
3. prazo é ampliado em 24 horas;
4. conselheiros são notificados;
5. votos permanecem disponíveis;
6. votação é encerrada no novo prazo.

### Cenário 5 — Transformação em gasto
1. chefe abre pedido provisionado;
2. informa dados administrativos;
3. confirma pagamento;
4. sistema registra transação;
5. saldo provisionado diminui;
6. saldo gasto aumenta;
7. auditoria é atualizada.