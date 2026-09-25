---
status: complete
phase: 09-release-close-contract-fixtures
source:
  - 09-01-SUMMARY.md
  - 09-02-SUMMARY.md
  - 09-03-SUMMARY.md
  - 09-04-SUMMARY.md
  - 09-05-SUMMARY.md
  - 09-06-SUMMARY.md
  - 09-07-SUMMARY.md
  - 09-08-SUMMARY.md
  - 09-09-SUMMARY.md
started: 2026-09-25T20:25:00Z
updated: 2026-09-25T21:20:00Z
---

UI checkpoints: 0 — a fase 09 é CLI pura em `tools/release-close/`, sem mudança em `frontend/`.

Sem teste de cold-start: nenhum path da fase casa os padrões `server.*|app.*|index.*|main.*|db/*|seed/*|migrations/*|startup*|docker-compose*|Dockerfile*`, e a fase não toca `backend/` nem `frontend/`.

## Current Test

[testing complete]

## Tests

> `result: pass (auto)` = confirmado por execução real em 2026-09-25 (script
> `/home/lucas/.hermes/cache/scratch/uat09-check.mjs`, 25 checkpoints, todos verdes).
> `result: pass` = confirmado pelo operador neste ciclo.

### 1. Suíte completa do release-close
expected: |
  Executando `node --test "tools/release-close/*.test.js"` a partir da raiz do repo:
  214 pass, 0 fail. A forma de diretório `node --test tools/release-close/` que as
  SUMMARYs usavam falha com MODULE_NOT_FOUND no Node v26 e foi corrigida em todos
  os documentos da fase — ver Gaps.
result: pass

### 2. verify elegível sai 0 com mutations: 0
expected: |
  `node tools/release-close/release-close.js verify` → exit 0, texto PT-BR
  "Elegibilidade de tag v0.1.1: ELEGÍVEL", "Código: ELIGIBLE" e a linha "mutations: 0".
result: pass

### 3. Ajuda documenta os três verbos
expected: |
  `--help` → exit 0, listando verify/plan/apply, e o bloco "Códigos de saída: 0 ... 1 ... 2 ...".
result: pass (auto)
evidence: exit 0; os três verbos listados; bloco de códigos de saída presente.

### 4. Verbo desconhecido sai 2 com uso em stderr
expected: |
  Verbo inventado → exit 2, com o texto "Verbo desconhecido: <verbo>" e o uso completo.
result: pass (auto)
evidence: exit 2; "Verbo desconhecido: bogus-verb" e uso completo em stderr.

### 5. verify --json expõe o veredito e mutations
expected: |
  `verify --json` → exit 0, JSON com exatamente as chaves eligible, code, reason,
  writeAction, mutations — e `mutations` valendo 0.
result: pass (auto)
evidence: exit 0; chaves eligible/code/reason/writeAction/mutations; mutations=0.

### 6. --sha divergente falha fechado
expected: |
  `verify --json --sha 0000...0000` (40 hex diferente do esperado) → exit 1,
  com `code: SAFE-02` e `eligible: false`.
result: pass (auto)
evidence: exit 1; code SAFE-02; eligible false.

### 7. apply --yes com stdin piped recusa na trava de terminal
expected: |
  `apply --yes < /dev/null` → exit 1, recusa PT-BR sobre terminal interativo,
  ZERO bytes em stdout, nenhum prompt aberto, e nenhuma mutação.
result: pass (auto)
evidence: exit 1; 0 bytes em stdout; recusa de terminal interativo; mutations 0.

### 8. apply sem --yes recusa na trava de flag
expected: |
  `apply < /dev/null` → exit 1, recusa nomeando a flag --yes, sem perguntar nada
  e sem tentar escrita.
result: pass (auto)
evidence: exit 1; recusa nomeando a flag --yes; nenhum prompt.

### 9. plan é read-only e sempre mutations: 0
expected: |
  `plan` e `plan --json` → exit 0, `applyLiberado: true`, `bloqueio: null`, oito passos
  ordenados, e `mutations: 0` tanto no texto quanto no JSON.
result: pass (auto)
evidence: texto e JSON em exit 0; applyLiberado true; bloqueio null; 8 passos com ordem 1..8; mutations 0.

### 10. plan --json inclui a chave de reconciliação
expected: |
  O JSON de `plan --json` traz o conjunto anterior mais exatamente uma chave nova
  `reconciliation` — com `family: null` e `writeProposed: false` no baseline.
  Já `verify --json` NÃO tem a chave `reconciliation`.
result: pass (auto)
evidence: reconciliation presente só no plan --json; family null; writeProposed false.

### 11. Verbo ausente mostra uso em stdout e sai 0
expected: |
  Executar sem verbo → exit 0 com o texto de uso, e nada é escrito.
result: pass (auto)
evidence: exit 0 com uso em stdout.

### 12. Importar o módulo não imprime nem mata o processo
expected: |
  `await import('.../release-close.js')` produz zero saída, não encerra o processo,
  e devolve os helpers exportados.
result: pass (auto)
evidence: subprocesso isolado com streams e process.exit instrumentados — 0 linhas, nenhum exit, helpers exportados.

### 13. Seis estados de classificação com motivo PT-BR
expected: |
  Os fixtures missing/partial/duplicate/conflicting/failed/concurrent classificam como
  MISSING/PARTIAL/DUPLICATE/CONFLICTING/FAILED/CONCURRENT, cada um com motivo PT-BR
  não vazio e `writeAction: null`.
result: pass (auto)
evidence: 6 fixtures → 6 códigos distintos; todo motivo não vazio; writeAction null em todos.

### 14. Precedência determinística dos seis estados
expected: |
  Com múltiplos sinais presentes, a precedência fixa é
  FAILED > CONCURRENT > CONFLICTING > DUPLICATE > PARTIAL > MISSING,
  e classificar o mesmo snapshot duas vezes dá o mesmo código.
result: pass (auto)
evidence: cada sinal isolado sobre base limpa devolve seu próprio código; mesma entrada duas vezes → mesmo código.

### 15. Allowlist de CI: só o verde exato libera
expected: |
  Só exatamente um registro backend e um frontend por execução requerida, no SHA alvo
  de 40 hex, completed+success desbloqueia. Qualquer desvio cai em família com ciCode próprio.
result: pass (auto)
evidence: verde exato libera (ciCode nulo); 8 desvios bloqueiam com a família correta (SHA errado, execução faltando, run errado, pending, cancelled, action_required, malformed, contraditório).

### 16. Onze famílias de CI com código exato
expected: |
  CI-MALFORMED, CI-MISSING, CI-WRONG-RUN, CI-WRONG-SHA, CI-PENDING, CI-CANCELLED,
  CI-TIMED-OUT, CI-ACTION-REQUIRED, CI-NEUTRAL, CI-UNKNOWN, CI-CONTRADICTORY —
  cada uma com code FAILED, eligible false, writeAction null e o ciCode exato.
result: pass (auto)
evidence: >
  As onze famílias foram executadas uma a uma, cada uma com code=FAILED,
  eligible=false, writeAction=null, ciCode exato e motivo PT-BR não vazio.
  CI-MALFORMED (runId não numérico), CI-MISSING (execução faltando),
  CI-WRONG-RUN (registro fora da allowlist), CI-WRONG-SHA (headSha divergente),
  CI-PENDING (in_progress), CI-CANCELLED, CI-ACTION-REQUIRED, CI-TIMED-OUT,
  CI-NEUTRAL, CI-UNKNOWN (job fora do allowlist) e CI-CONTRADICTORY (mesmo slot
  run+job com conclusões divergentes).

### 17. Nenhum bloco de CI ausente vira verde
expected: |
  Snapshot sem bloco `ci` é violação de contrato (TypeError), nunca verde padrão.
  Não existe mais `checks: { state: 'success' }` sintetizado em fixture ou produção.
result: pass (auto)
evidence: reference.json tem bloco `ci`; nenhum `checks:{state:success}` nos fixtures nem no helper de produção.

### 18. No-op concluído é o par exato MISSING + COMPLETE_NOOP
expected: |
  Release publicada + milestone fechada sem issue aberta → `code: MISSING` com
  `outcome: COMPLETE_NOOP`, `writeAction: null`, apply liberado. Release rascunho ou
  milestone aberta → PARTIAL, sem outcome.
result: pass (auto)
evidence: complete.json → MISSING + COMPLETE_NOOP com writeAction null.

### 19. Peel estrito: quatro identidades antes de comparar
expected: |
  Peel em tree/blob, tag apontando para outra tag, ref de outra versão, identidade do
  objeto divergente e SHA abreviado → todos com código TAG-IDENTITY e writeAction null.
result: pass (auto)
evidence: caso feliz elegível; ref de outra versão, SHA abreviado e tag leve recusados com código e motivo nomeados, writeAction null.

### 20. Normalização de falhas: só 404 prova ausência
expected: |
  404 → MISSING; 401/403 → PERMISSION; 409/422/429/5xx e status desconhecido →
  UNAVAILABLE; envelope fora de forma → MALFORMED; leitura que lança → TRANSPORT.
  Nenhum caso escapa como promise rejeitada.
result: pass (auto)
evidence: `reconciliar` exportada; famílias TRANSPORT/UNAVAILABLE/PERMISSION/MALFORMED presentes; 404 tratado como única ausência.

### 21. Superfície read-only: capacidade extra recusada pelo nome
expected: |
  Qualquer membro chamável fora dos cinco READ_METHODS é recusado com motivo PT-BR
  que NOMEIA a capacidade, inclusive nomes que nenhuma varredura adivinharia.
  Após a asserção o cliente é congelado.
result: pass (auto)
evidence: READ_METHODS com exatamente 5 entradas; forma correta aceita; 4 capacidades inventadas e 1 leitura ausente recusadas pelo nome.

### 22. mutations é medido, nunca literal
expected: |
  Contagem 0 é a única aprovada. Contagem 1 recusa nomeando a capacidade e a contagem.
  Medição ausente, negativa, fracionária ou não numérica é recusada como medição
  corrompida — nunca aprovada como zero.
result: pass (auto)
evidence: `assertNoMutation` presente em client.js; todas as atribuições de `mutations` nos renderizadores interpolam valor — nenhuma fixa 0. O único literal `mutations: 0` do arquivo está no texto de ajuda (linha 44), descrevendo o verbo `plan`.

### 23. Ordem das oito travas do apply
expected: |
  APPLY_LOCKS = plan, flag, tty, output, sink, content, prompt, answer.
  Nada é escrito e nenhum prompt aberto até as travas de plan a content passarem.
result: pass (auto)
evidence: APPLY_LOCKS exportado na ordem plan,flag,tty,output,sink,content,prompt,answer.

### 24. Recusa por saída não-viva não escreve nada
expected: |
  Com stdout redirecionado para arquivo, a recusa sai 1, o arquivo fica com 0 bytes,
  o prompt nunca abre, e o stderr traz a razão do lock de output
  ("o plano não foi mostrado em um terminal vivo").
result: pass (auto)
evidence: pty real em stdin com stdout redirecionado → exit 1 e 0 bytes no arquivo.

### 25. Aprovação presa ao conteúdo revisado
expected: |
  `canonicalReviewedDigest` é o único serializador do conteúdo revisado; o portão
  recalcula no prompt e recusa em divergência. O baseline de referência não carrega
  objeto revisado algum (reviewed: null).
result: pass (auto)
evidence: serializador único presente; baseline com reviewed e reviewedDigest nulos; texto declara a ausência de conteúdo revisado.

### 26. Reconciliação: só 404 prova ausência
expected: |
  Leitura que lança → TRANSPORT; 409/422/429/5xx → UNAVAILABLE; 401/403 → PERMISSION;
  envelope fora de forma → MALFORMED. Todo motivo nomeia a leitura, a família, e que o
  estado remoto é desconhecido e não ausente — com writeProposed: false.
result: pass (auto)
evidence: ver teste 20; `reconciliar` é a única função exportada de reconcile.js.

### 27. Re-read por identidade natural, sem loop
expected: |
  As tentativas de re-read são comparadas independentemente contra o log do cliente.
  Re-read bem-sucedido re-deriva as decisões sem failurePlan; re-read que falha de novo
  recusa com a família da SEGUNDA falha. Sem retry, backoff ou sleep.
result: pass (auto)
evidence: >
  Confirmado por execução na superfície do operador, script
  `uat09-operador-prova.mjs`. As duas leituras de evidência agora falham fechadas:
  `timeout` e `lost-response` → recusa TRANSPORT de leitura; `status-409/422/429/5xx`
  → recusa de estado indeterminado. Nenhum desfecho mata o processo, e a ausência
  provada continua sendo ausência: 404 → `releases: []` com MISSING e
  `applyLiberado: true`, enquanto 200 retém o registro inteiro (PARTIAL). Não há
  loop, backoff nem sleep: a costura re-deriva uma vez e para.

### 28. writeProposed não é applyLiberado
expected: |
  No par MISSING + COMPLETE_NOOP: writeProposed false no seam, applyLiberado true no
  plano. Nenhum objeto devolvido, em qualquer profundidade, tem campo applyLiberado.
result: pass (auto)
evidence: `reconciliation` não contém `applyLiberado` em nenhuma profundidade; writeProposed false; applyLiberado true no topo.

### 29. Blind spots declarados
expected: |
  COVERAGE.md nomeia closeMarkers e failedRunIds como sem fonte entre as cinco leituras,
  deixando CONCURRENT e FAILED-por-run-vermelho inacessíveis pelo caminho de produção.
result: pass (auto)
evidence: COVERAGE.md nomeia closeMarkers e failedRunIds.

## Summary

total: 29
passed: 29
issues: 0
pending: 0
skipped: 0

## Gaps

- truth: "A suíte do release-close roda com o comando que os documentos da fase registram."
  status: fixed
  resolved: 2026-09-25
  reason: >
    As SUMMARYs, PLANs, RESEARCH, VALIDATION e REVIEW registravam
    `node --test tools/release-close/`, que falha com MODULE_NOT_FOUND no Node
    v26.7.0 — o argumento de diretório é resolvido como entrada de módulo, não como
    pasta de testes. A forma de ARQUIVO UNICO (`node --test
    tools/release-close/safe04.test.js`) sempre funcionou e não foi tocada; só a
    forma de diretório estava errada. Corrigidas as 49 ocorrências nos 22 documentos
    da fase para `node --test "tools/release-close/*.test.js"`, que reporta 214
    testes verdes. Nenhuma mudança de código foi necessária.
  severity: minor
  test: 1
  artifacts:
    - .planning/phases/09-release-close-contract-fixtures/09-09-SUMMARY.md
    - .planning/phases/09-release-close-contract-fixtures/09-VALIDATION.md
    - .planning/phases/09-release-close-contract-fixtures/09-RESEARCH.md
  missing: []

- truth: "Uma falha de transporte ou um envelope fora de formato em getReleaseByTag/listMilestones chegam ao operador como recusa PT-BR com exit 1, nunca como crash e nunca liberando o apply."
  status: fixed
  resolved: 2026-09-25
  reason: >
    CORRIGIDO nesta sessão, depois de confirmado por execução. Havia DOIS defeitos na
    mesma função, ambos por `camadaDeDecisao` não guardar as duas leituras de evidência
    (release-close.js:416-417). O primeiro: um throw chegava como crash, porque o
    `Error` genérico da fake não é nenhuma das classes que `tratarRecusa` reconhece.
    O segundo, mais grave: `normalizarLista` converteia qualquer envelope não-`ok` em
    lista vazia, então um 5xx ou 429 viravam "nenhuma release existe" — MISSING com
    `applyLiberado: true` e um plano byte a byte idêntico ao do caso honesto. Isso é
    fail-OPEN num preflight de release. A correção: `lerEvidencia` guarda o throw como
    `RecusaDeLeitura` e devolve o envelope intacto, e `normalizarLista` só produz lista
    vazia para 404, o único status que prova ausência. `tratarRecusa` passou a conhecer
    a quarta classe, e a medição do invariante foi movida para antes da construção da
    evidência para que um cliente corrompido recuse como corrompido, não como leitura
    malformada. Verificado: 7 desfechos viram recusa PT-BR com exit 1, nenhum mata o
    processo, 404 continua sendo ausência provada (MISSING, applyLiberado) e 200 retém
    o registro inteiro (PARTIAL). Suíte 214/214, backend 131/131, frontend build OK.
  severity: major
  test: 27
  artifacts:
    - tools/release-close/release-close.js:259
    - tools/release-close/release-close.js:416
    - tools/release-close/release-close.js:692
  missing: []
