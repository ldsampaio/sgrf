# Requisitos funcionais

## RF-001 — Autenticação

O sistema deve permitir autenticação mediante:

- e-mail institucional;
- senha;
- domínio obrigatório @utfpr.edu.br.

O sistema deve rejeitar:

- e-mails de domínios externos;
- usuários inexistentes;
- usuários inativos;
- senha incorreta.

### Critérios de aceite

- usuario@utfpr.edu.br pode ser aceito.
- usuario@gmail.com deve ser rejeitado.
- O e-mail deve ser normalizado para letras minúsculas.
- A senha nunca deve ser armazenada em texto puro.
- Após cinco tentativas consecutivas inválidas, a conta deve ser temporariamente bloqueada.

## RF-002 — Usuário administrador inicial

O primeiro usuário do sistema deve ser criado durante o deploy por configuração segura de ambiente:

```
INITIAL_ADMIN_EMAIL=ldsampaio@utfpr.edu.br
INITIAL_ADMIN_TEMPORARY_PASSWORD=<valor-fornecido-no-deploy>
```

Regras:

- o usuário inicial deve possuir papel ADMINISTRADOR;
- a senha deve ser temporária;
- a troca deve ser obrigatória no primeiro login;
- a senha temporária não deve aparecer em logs;
- o sistema não deve recriar o usuário se ele já existir;
- a senha inicial não deve ser embutida no código-fonte.

## RF-003 — Papéis de usuário

O sistema deve possuir os seguintes papéis:

- ADMINISTRADOR;
- CHEFE_DEPARTAMENTO;
- CONSELHEIRO;
- PROFESSOR;
- ALUNO.

### Regras de composição:

- todo administrador também é professor;
- todo chefe de departamento também é professor;
- todo conselheiro também é professor.

A implementação deve permitir que um usuário tenha:

- um papel principal; ou
- uma combinação de papéis, desde que as regras de herança sejam respeitadas.

Recomendação inicial: utilizar um papel principal com permissões derivadas, evitando combinações arbitrárias.

## RF-004 — Cadastro de usuários

O administrador deve poder:

- criar usuários;
- informar nome completo;
- informar e-mail institucional;
- selecionar a classe;
- ativar ou desativar usuários;
- reenviar convite;
- forçar redefinição de senha;
- consultar data do último acesso.

Ao criar um usuário:

- o sistema gera uma senha temporária aleatória;
- salva somente o hash da senha;
- envia e-mail de convite;
- marca must_change_password = true.

A senha temporária deve:

- ser aleatória;
- ter validade configurável;
- ser usada uma única vez;
- não ser exibida novamente após o envio.

## RF-005 — Alteração de papéis

### Administrador

Pode alterar a classe de qualquer usuário, inclusive chefe, conselheiro, professor e aluno.

### Chefe de departamento

Pode alterar a classe de qualquer usuário, exceto:

- administrador;
- outro usuário administrador.

### Demais usuários

Não podem alterar papéis.

Toda alteração deve registrar:

- usuário que realizou a alteração;
- usuário alterado;
- papel anterior;
- novo papel;
- data e hora;
- justificativa opcional.

## RF-006 — Configuração de e-mail

O administrador deve poder configurar:

- servidor SMTP;
- porta;
- criptografia;
- usuário da conta institucional;
- senha ou token;
- endereço remetente;
- nome do remetente;
- endereço de resposta;
- ativação ou desativação do envio.

Requisitos de segurança:

- credenciais devem ser criptografadas em repouso;
- a senha nunca deve ser exibida novamente;
- o sistema deve oferecer envio de e-mail de teste;
- alterações devem ser auditadas;
- credenciais não devem aparecer em logs ou respostas de API.

## RF-007 — Configurações financeiras

O administrador ou chefe deve poder configurar:

- limite de aprovação automática;
- período de vigência do limite;
- regra de soma anual;
- informações sobre diárias oficiais;
- taxa de câmbio utilizada para solicitações em dólar;
- saldo disponível;
- saldo provisionado;
- saldo gasto.

A configuração das diárias deve conter:

- título;
- texto explicativo;
- fonte ou referência administrativa;
- data de vigência;
- data de atualização.

O conteúdo será mostrado ao solicitante por meio de um ícone de informação.

## RF-008 — Solicitação de equipamento

Campos obrigatórios:

- título;
- justificativa;
- especificação técnica;
- valor estimado em reais;
- anexos opcionais;
- observações.

O sistema deve impedir o envio se:

- a especificação estiver vazia;
- o valor for menor ou igual a zero;
- o valor tiver formato inválido.

## RF-009 — Solicitação de publicação

Campos obrigatórios:

- título do artigo;
- justificativa;
- PDF do artigo;
- carta de aceite;
- valor estimado da taxa em reais.

Requisitos:

- PDF deve ser validado pelo tipo MIME;
- tamanho máximo deve ser configurável;
- o sistema deve impedir arquivos executáveis renomeados como PDF;
- os anexos devem ser armazenados fora da pasta pública da aplicação.

## RF-010 — Solicitação de viagem

Campos:

- motivo da viagem;
- destino;
- consulta a outras fontes de financiamento;
- fontes consultadas;
- número de diárias;
- valor da diária;
- valor estimado das passagens;
- moeda: BRL ou USD;
- total estimado;
- anexos opcionais;
- observações.

### Regra de fontes de financiamento

Quando o usuário marcar que consultou outras fontes, o campo "Quais fontes já foram consultadas?" deve ser obrigatório.

### Regra de cálculo

Quando a moeda for real:

```
total estimado = (número de diárias × valor da diária) + passagens
```

Quando a moeda for dólar:

```
total em BRL = total em USD × taxa de câmbio registrada
```

O sistema deve guardar:

- moeda original;
- valores originais;
- taxa de câmbio utilizada;
- valor convertido para BRL;
- data da conversão.

A taxa usada no envio deve ser congelada e não recalculada posteriormente.

## RF-011 — Solicitação de auxílio estudantil

Campos:

- justificativa;
- nomes dos estudantes;
- comprovantes em PDF;
- valor estimado do auxílio;
- observações.

Regra:

- se o solicitante for professor ou chefe, o campo de estudante deve ser obrigatório;
- se o solicitante for aluno, o sistema deve aplicar a política configurada pelo administrador;
- comprovantes devem ser enviados em PDF;
- o valor deve ser maior que zero.

## RF-012 — Submissão de solicitação

Ao submeter uma solicitação, o sistema deve:

- validar os campos;
- calcular o valor total em BRL;
- calcular o total solicitado pelo mesmo usuário no período anual;
- verificar o limite configurado;
- verificar disponibilidade financeira;
- criar histórico imutável da submissão;
- determinar o fluxo aplicável.

Estados possíveis:

```
RASCUNHO
SUBMETIDO
APROVADO_AUTOMATICAMENTE
EM_VOTACAO
APROVADO
APROVADO_PARCIALMENTE
INDEFERIDO
CANCELADO
EM_PRESTACAO_DE_CONTAS
CONCLUIDO
```

## RF-013 — Aprovação automática

O valor usado para decidir o fluxo será:

```
total anual do solicitante = Σ(solicitações aprovadas ou em análise no período) + nova solicitação
```

Se:

```
total anual do solicitante ≤ limite vigente
```

a solicitação será aprovada automaticamente.

Ao aprovar:

- o solicitante recebe e-mail;
- o pedido muda para APROVADO_AUTOMATICAMENTE;
- o valor aprovado é provisionado;
- o saldo disponível é reduzido;
- o saldo provisionado é aumentado;
- o sistema registra a regra e o limite aplicados;
- o usuário recebe a orientação burocrática;
- o e-mail dirplad-cp@utfpr.edu.br é apresentado como contato para dúvidas.

## RF-014 — Votação do conselho

Solicitações acima do limite devem:

- mudar para EM_VOTACAO;
- abrir prazo inicial de 24 horas;
- enviar e-mail aos conselheiros elegíveis;
- apresentar todos os dados e anexos ao conselho;
- exibir painel de discussão;
- permitir votos até o encerramento.

Opções de voto:

- DEFERIR;
- INDEFERIR;
- DEFERIR_PARCIALMENTE;
- ABSTER_SE.

Para voto parcial, o comentário será obrigatório.

Cada voto registrado exibe nome do votante (+ papel) e data/hora de Brasília.

Se o solicitante for conselheiro:

- não poderá votar na própria solicitação;
- deverá permanecer excluído da apuração daquele pedido.

O chefe de departamento:

- vota normalmente quando for membro elegível;
- exerce voto de desempate somente quando necessário;
- não deve votar duas vezes no mesmo processo.

## RF-015 — Apuração da votação

Ao encerrar a votação, o sistema deve:

- verificar o quórum configurado;
- excluir votos inválidos;
- excluir o solicitante quando ele for conselheiro;
- contar deferimentos, indeferimentos e abstenções;
- detectar empate;
- solicitar voto de desempate do chefe, quando aplicável;
- registrar o resultado;
- enviar comunicação ao solicitante.

Regra recomendada para a primeira versão:

- abstenções não contam como votos favoráveis ou contrários;
- a decisão é tomada pela maioria simples dos votos válidos;
- empate exige voto de desempate do chefe;
- ausência de quórum resulta em VOTACAO_SEM_QUORUM, exigindo ação do chefe ou administrador.

A política de quórum deve ser configurável, pois não foi especificada no requisito original.

## RF-016 — Pedido de vista

Durante a votação, um professor elegível poderá solicitar vista.

O pedido deve conter:

- justificativa;
- usuário solicitante;
- data e hora.

Ao ser aprovado pelo sistema:

- o prazo é ampliado em 24 horas;
- o evento é registrado;
- todos os conselheiros recebem notificação;
- o contador de prazo é atualizado;
- o pedido de vista não pode ser usado após o encerramento.

A quantidade máxima de pedidos de vista deve ser configurável. Valor inicial recomendado: um pedido por solicitação.

## RF-017 — Painel de discussão

Durante a deliberação, usuários elegíveis devem poder:

- publicar mensagens;
- responder mensagens;
- visualizar histórico;
- marcar mensagem como relevante;
- consultar autor e data.
- toda mensagem do histórico exibe nome do autor (+ papel) e data/hora de Brasília; mensagens editadas exibem selo "editado" com histórico preservado para auditoria.

O sistema deve impedir:

- edição silenciosa de mensagens;
- exclusão sem registro;
- mensagens após o encerramento, exceto em modo histórico;
- acesso de usuários não autorizados.

Quando uma mensagem for editada, o histórico anterior deve permanecer disponível para auditoria.

## RF-018 — Resultado parcial

Para uma decisão parcialmente deferida, o resultado deve registrar:

- valor total solicitado;
- valor total aprovado;
- itens aprovados;
- itens rejeitados;
- justificativa;
- comentário de cada voto parcial;
- decisão final do conselho.

O valor provisionado deve ser somente o valor aprovado.

## RF-019 — Controle financeiro

Estados financeiros:

- DISPONIVEL;
- PROVISIONADO;
- GASTO.

O saldo deve obedecer:

```
saldo total = disponível + provisionado + gasto
```

A interpretação operacional será:

- disponível: ainda sem destinação;
- provisionado: destinado a solicitação aprovada;
- gasto: pago efetivamente.

Ao aprovar uma solicitação:

```
disponível ← disponível − valor aprovado
provisionado ← provisionado + valor aprovado
```

Ao marcar como gasto:

```
provisionado ← provisionado − valor aprovado
gasto ← gasto + valor aprovado
```

A transição para gasto deve ser permitida somente para:

- administrador;
- chefe de departamento.

Toda movimentação deve ocorrer em transação atômica.

## RF-020 — Dashboard

O dashboard deve apresentar:

- saldo disponível;
- saldo provisionado;
- saldo gasto;
- total solicitado;
- total aprovado;
- total indeferido;
- solicitações em votação;
- solicitações por tipo;
- solicitações por período;
- valores por solicitante;
- pizza de docentes: Top 8 por valor solicitado no ano + "Outros";
- pizza de saldos: disponível × provisionado × gasto do ano;
- pizza por categoria: VIAGEM, PUBLICACAO, AUXILIO_ESTUDANTIL, EQUIPAMENTO (valores aprovados/gastos);
- valores por centro ou categoria, caso configurado;
- pedidos próximos do vencimento;
- pedidos aguardando ação;
- distribuição por status.

O conteúdo deve respeitar as permissões do usuário.

## RF-021 — Relatórios

Relatórios mínimos:

- solicitações por período;
- solicitações por usuário;
- solicitações por tipo;
- solicitações por status;
- valores aprovados;
- valores provisionados;
- valores gastos;
- decisões do conselho;
- votos individuais;
- pedidos de vista;
- histórico financeiro;
- prestação de contas.

Formatos recomendados:

- visualização na tela;
- CSV;
- PDF.