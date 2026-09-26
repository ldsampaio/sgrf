# Phase 9: Release-Close Contract & Fixtures - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-09-25
**Phase:** 9-release-close-contract-fixtures
**Areas discussed:** Local e invocação do tool, Fixtures e mocks, Contrato puro e taxonomia, UX de verify/plan/apply

---

## Local e invocação do tool

| Option | Description | Selected |
|--------|-------------|----------|
| tools/release-close/ | Diretório novo no repo root, isolado do backend CJS; ESM sem fricção, CI/Docker intactos | ✓ |
| backend/scripts/ | Dentro do pacote backend, mas exigiria contornar o type:commonjs | |
| bin/ raiz único | Um único arquivo executável na raiz, sem espaço para crescer | |

**User's choice:** tools/release-close/ (Recommended)
**Notes:** —

| Option | Description | Selected |
|--------|-------------|----------|
| package.json próprio | package.json com type:module, sem dependencies; explícito que é ESM puro | ✓ |
| Só .mjs soltos | Sem package.json; mistura resolução de módulo com o root | |

**User's choice:** package.json próprio (Recommended)
**Notes:** —

| Option | Description | Selected |
|--------|-------------|----------|
| node direto + --help | Contrato explícito e versionável; serve ao runbook da Fase 12 | ✓ |
| npm script wrapper | Atalho conveniente, mas esconde o caminho real | |

**User's choice:** node direto + --help (Recommended)
**Notes:** —

| Option | Description | Selected |
|--------|-------------|----------|
| Subprocesso gh CLI | Reusa login, token e permissões do operador; nenhum segredo novo | ✓ |
| HTTP direto com GH_TOKEN | Mais controle, mas duplica a auth e arrisca vazar credencial | |

**User's choice:** Subprocesso gh CLI (Recommended)
**Notes:** —

---

## Fixtures e mocks

| Option | Description | Selected |
|--------|-------------|----------|
| JSON em fixtures/ | Snapshots GitHub versionados e legíveis; reusáveis como doc vivo | ✓ |
| Literais inline | Segue backend/tests, mas cenários de 6 estados viram blocos repetidos | |

**User's choice:** JSON em fixtures/ (Recommended)
**Notes:** —

| Option | Description | Selected |
|--------|-------------|----------|
| node:test puro | Roadmap à risca: zero dependências, roda com node --test no Node 22 | ✓ |
| vitest como backend | Reusa runner existente, mas quebra a regra 'sem pacote novo' | |

**User's choice:** node:test puro (Recommended)
**Notes:** Roadmap success criterion mandates `node:test` — locked, not re-decided.

| Option | Description | Selected |
|--------|-------------|----------|
| Fake client | Sequências programáveis; prova ordem, retry e re-leitura sem rede | ✓ |
| Stubs por função | Mais simples, mas não prova retry/re-read/concorrência | |

**User's choice:** Fake client (Recommended)
**Notes:** —

| Option | Description | Selected |
|--------|-------------|----------|
| Tudo congelado | Timestamps e SHAs fixos; baseline real v0.1.1 vira fixture sem rede | ✓ |
| Relógio/rede reais isolados | Flexível, mas flaky — quebra o 'determinístico' | |

**User's choice:** Tudo congelado (Recommended)
**Notes:** —

---

## Contrato puro e taxonomia

| Option | Description | Selected |
|--------|-------------|----------|
| Funções puras focadas | Uma função por preocupação; testável isoladamente | ✓ |
| Avaliador único | Um avaliador com snapshot→decisão; mistura ref + reconciliação | |

**User's choice:** Funções puras focadas (Recommended)
**Notes:** —

| Option | Description | Selected |
|--------|-------------|----------|
| Códigos MISSING/PARTIAL/... | Cada estado vira código estável referenciado por output e testes | ✓ |
| Booleans soltos | Flexível, mas a taxonomia deriva por consumidor | |

**User's choice:** Códigos MISSING/PARTIAL/... (Recommended)
**Notes:** —

| Option | Description | Selected |
|--------|-------------|----------|
| Sempre retorna objeto | Mismatch é dado, não exceção; throw só em input inválido | ✓ |
| Lança erro de domínio | Segue Object.assign(Error,{status}) do backend, mas mistura decisão com erro | |

**User's choice:** Sempre retorna objeto (Recommended)
**Notes:** —

| Option | Description | Selected |
|--------|-------------|----------|
| PT-BR + códigos EN | Padrão do repo em PT; códigos EN para estabilidade máquina | ✓ |
| Tudo em inglês | Consistente com GitHub API, mas quebra o padrão PT do repo | |

**User's choice:** PT-BR + códigos EN (Recommended)
**Notes:** —

---

## UX de verify/plan/apply

| Option | Description | Selected |
|--------|-------------|----------|
| Texto + --json | Operador lê no terminal; --json alimenta runbook/evidência futura | ✓ |
| Sempre JSON | Máquina-first, mas ilegível no terminal | |

**User's choice:** Texto + --json (Recommended)
**Notes:** Full OPS-03 evidence shape deferred to Phase 12.

| Option | Description | Selected |
|--------|-------------|----------|
| --yes + prompt | Flag explícita + confirmação interativa com plano visível; sem TTY sem --yes recusa | ✓ |
| Só --yes | Simples, mas --yes perdido em script aprova sem ver o plano | |

**User's choice:** --yes + prompt (Recommended)
**Notes:** —

| Option | Description | Selected |
|--------|-------------|----------|
| Passos ordenados | O que será criado/adotado, em que ordem, contra quais SHAs | ✓ |
| Só resumo alto-nível | Menos a revisar, mas o operador aprova no escuro | |

**User's choice:** Passos ordenados (Recommended)
**Notes:** Should preview the Phase 11 recovery order.

| Option | Description | Selected |
|--------|-------------|----------|
| Contador + assert | mutations:0 em toda saída; suite falha se qualquer write escapar | ✓ |
| Só convenção de código | Depende de inspeção manual | |

**User's choice:** Contador + assert (Recommended)
**Notes:** —

---

## the agent's Discretion

None — user decided all 16 questions directly. Internal module split, exact `--json` field names, exit-code numbering, and fixture JSON schema left to researcher/planner (recorded in CONTEXT.md).

## Deferred Ideas

None — discussion stayed within phase scope. No scope-creep raised.
