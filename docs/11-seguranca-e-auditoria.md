# Segurança e auditoria

## Eventos obrigatoriamente auditados

- login bem-sucedido;
- falha de login;
- bloqueio de conta;
- criação de usuário;
- alteração de papel;
- alteração de configuração;
- criação e submissão de solicitação;
- upload e download de arquivo;
- voto;
- alteração de voto;
- pedido de vista;
- mensagem criada, editada ou removida;
- aprovação;
- indeferimento;
- provisionamento;
- alteração para gasto;
- alteração de saldo;
- exportação de relatório.

## Arquivos

- validar extensão e MIME;
- calcular checksum;
- gerar nome interno aleatório;
- não confiar no nome original;
- impedir execução;
- restringir download por autorização;
- registrar downloads;
- limitar tamanho;
- verificar arquivos corrompidos.

## Segregação de responsabilidades

O agente deve impedir que:

- aluno altere saldo;
- professor altere limite;
- conselheiro vote quando não elegível;
- solicitante vote na própria solicitação;
- usuário comum veja anexos de pedido não autorizado;
- chefe altere papel de administrador.