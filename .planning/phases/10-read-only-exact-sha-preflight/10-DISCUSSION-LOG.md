# Phase 10: Read-Only Exact-SHA Preflight - Discussion Log

> Audit trail only. Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-09-25
**Phase:** 10-Read-Only Exact-SHA Preflight
**Areas discussed:** Runs de CI, Fonte do G-1, 404 vs 403, Verify 09 vs 10

---

## Runs de CI

| Option | Description | Selected |
|--------|-------------|----------|
| Descobrir por propriedade (branch + event + SHA) | Sem flag nova; requiredRunIds vira resultado da descoberta, nao entrada. A mais simples. | ✓ |
| Allowlist explicita do operador (--runs) | Mantem o contrato atual do classificador. Mais auditavel, mas a cada recuperacao o operador descobre IDs novos. | |
| Descoberta com override opcional | Descoberta como padrao, com --runs para congelar. Mais flexivel, porem da ao implementador duas rotas a provar. | |
| Voce decide | O roadmap decide a politica de re-run. | |

**User's choice:** "da forma mais simples possível" → descoberta por propriedade, sem flag nova.

**Follow-up:** re-run policy. Qual execucao vale quando o CI foi re-executado no mesmo branch+SHA (re-run cria NOVO databaseId com attempt: 2)?

| Option | Description | Selected |
|--------|-------------|----------|
| Vale o verde mais recente de cada branch | Regra de conjunto, nao de membro. Monotonico: re-run verde recupera, re-run vermelho bloqueia. O veredito e funcao do conjunto, logo re-rodar verify da mesma resposta (idempotencia do veredito). | ✓ |
| Nenhum run nao-verde em nenhum momento | Conservador: qualquer conclusao nao-verde no mesmo branch+SHA bloqueia, mesmo havendo verde posterior. Prende o preflight num vermelho ja corrigido por re-run. | |
| Mais de um verde exige --runs | Se houver mais de um verde, mostra IDs e exige override. Mais seguro, mais manual. | |
| Voce decide | O roadmap decide. | |

**User's choice:** "última verde".

**Notes:** A CI nao pode ser idempotente — `on: [push, pull_request]` cria um run novo a cada push, para sempre. A idempotencia foi posta no veredito da ferramenta (funcao do conjunto), que e o que a fase entrega. Essa escolha tambem define o que acontece com o vermelho historico no mesmo branch: fica ignorado, nomeado, nao apagado.

---

## Fonte do G-1

| Option | Description | Selected |
|--------|-------------|----------|
| Derivar de ci.records, entregar em failedRunIds | A leitura de CI calcula os IDs nao-verdes e deposita em failedRunIds. Nenhuma leitura nova (superficie de 09-06 intacta). Consequencia: os testes de 09 que fixavam o fail-open como expectativa (evidence.test.js, safe04.test.js) vao precisar mudar — o vermelho e o sinal correto. | ✓ |
| Adicionar uma leitura sexta de runs vermelhos | Explicitamente rejeitado pelo usuario na fase 09 (sem sexta leitura). | |
| Manter chave separada mas preencher no buildCloseEvidence | A chave existe top-level mas e preenchida na montagem da evidencia. Mais acoplamento, menos limpo. | |
| Voce decide | O roadmap decide. | |

**User's choice:** "siga a opção 1 e altere o classificador para ler ci.records". Remove `failedRunIds` top-level por completo; o classifier lê `ci.records` diretamente.

**Notes:** O bug original do G-1 (evidencia nao produzia a chave) fecha com isso. A consequencia D-12a e um item de backlog da fase: os dois testes que pinavam o fail-open vao ficar vermelhos, e esse vermelho e o sinal correto.

---

## 404 vs 403

| Option | Description | Selected |
|--------|-------------|----------|
| Sim — 404 e ausencia, sem sonda de repo | Repo publico, conta unica, admin:true verificado ao vivo. 404 em release = ausencia; 403 permanece erro real e recusa. | ✓ |
| Sim, mas ainda validar o alvo antes de ler objeto | A ferramenta valida repo/versao como pre-condicao de entrada (rejeita cedo), mas nao como sonda pra desambiguar 404. | |
| Sim, e registrar explicitamente que a distincao e nao-objetivo | A distincao "ausente vs sem permissao" fica registrada como fora de escopo com o fato que a sustenta. | |
| Voce decide | O roadmap decide. | |

**User's choice:** "sim, nao precisa disso no escopo, o que simplifica o processo".

**Notes:** Verificado ao vivo: `private=false`, `owner=ldsampaio`, escopos `gist, read:org, repo, workflow`. Em repo publico de conta unica, 404 em objeto so pode ser ausencia. A sonda de repo foi descartada como desnecessaria.

---

## Verify 09 vs 10

| Option | Description | Selected |
|--------|-------------|----------|
| Um verify so; ghClient real por padrao (Recomendado) | Mesmo comando, mesmo codigo. Muda so o cliente injetado; suuite continua determinística apontando para --fixture; mutations:0 da 09 vale pro caminho real. | ✓ |
| Fixtures por padrao, --live explícito | Nunca toca a rede sem querer, mas o operador pode digitar o comando de suite em vez do de recuperação. | |
| Dois modos explicitos | Intenção óbvia, mas divergência entre caminhos é risco; runbook documenta duas formas. | |

**User's choice:** "A".

**Notes:** A recomendação se sustenta junto com a area 3: se 404=ausencia em repo publico, o risco de confundir modo fixtures com modo real cai. O comando do operador de recuperacao (fase 13) e o mesmo que a suete provou.

---

## Claude's Discretion

- Module split inside `tools/release-close/` (whether discovery logic lives in `classify.js` or a new `discover.js`) — researcher/planner decide, guided by D-10/D-11.
- Exact `--json` field names for discovered runs and the `failedRunIds` derivation — planner chooses, keeping PT-BR reasons / EN codes.
- Whether the re-run policy needs an explicit `--policy latest-green` flag or stays implicit — Claude to propose in the plan, with the monotonicity argument as the default.

## Deferred Ideas

- "CI idempotence" as a property of the *event* — rejected; impossible under `on: [push, pull_request]`. The monotonic verdict rule (D-11) is the right place for this guarantee.
- Making the 404/permission distinction explicit with a repo probe — rejected for scope; repo is public, single account, verified. Reopen if the repo ever goes private or gains additional accounts.
- Whether Phase 10 should also verify the tag object's peeled commit matches main (the full `git rev-parse` path vs `gh` peel) — the 09 eligibility contract already covers peel; Phase 10 can inherit or extend at plan time.
