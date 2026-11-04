# Interface

## Telas obrigatórias

### Autenticação
- página de redirecionamento para o portal do saga (`/login`): o sgrf não autentica
  credencial, então não há formulário de login, troca de senha nem recuperação de senha;
- página de erro própria para indisponibilidade do saga (`/unavailable`), renderizada pelo
  sgrf **sem redirect** — redirecionar para o serviço que caiu é o loop que se quer evitar;
- 401 e 503 são caminhos distintos: 401 → `login_url` do corpo; 503 → página própria.

### Dashboard
- cartões financeiros;
- gráficos de solicitações;
- 3 gráficos de pizza: docentes que solicitaram (nomes × valores solicitados, Top 8 + "Outros"), saldos (disponível × provisionado × gasto), gastos por categoria (viagem, publicação, auxílio estudantil, equipamento);
- filtro por ano de referência (padrão: ano atual);
- legenda com % e valores em BRL;
- botão "Exportar PDF com gráficos" (inclui as 3 pizzas + tabelas);
- solicitações recentes;
- pendências do usuário;
- prazos de votação.

### Solicitações
- lista;
- filtros;
- criação;
- edição de rascunho;
- detalhes;
- histórico;
- anexos;
- status visual.

### Conselho
- fila de pedidos em votação;
- detalhes do pedido;
- painel de mensagens (cada mensagem exibe nome do autor + papel e data/hora de Brasília; editadas mostram selo "editado");
- formulário de voto;
- lista de votos com nome do votante + data/hora;
- pedido de vista;
- resultado.

### Administração
- usuários;
- papéis;
- limite automático;
- informações de diárias;
- taxa de câmbio;
- configuração de e-mail;
- saldo departamental;
- auditoria.

### Relatórios
- filtros;
- tabela;
- exportação;
- resumo;
- prestação de contas.

## Regras de UX

- não esconder campos obrigatórios sem explicar por quê;
- mostrar cálculo do total em tempo real;
- destacar valores em BRL;
- indicar claramente quando um valor em dólar foi convertido;
- mostrar prazo absoluto da votação;
- exibir fuso horário;
- impedir duplo envio com estado de carregamento;
- pedir confirmação antes de votar;
- deixar claro que a votação é auditável.