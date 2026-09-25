# Phase 05: Session Refresh - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-09-24
**Phase:** 05-Session Refresh
**Areas discussed:** Retorno pós-login, Aviso de expirada, Dados não salvos, Bounce multi-aba, Higiene do snapshot

---

## Retorno pós-login

| Option | Description | Selected |
|--------|-------------|----------|
| Sempre dashboard | Mantém router.push('/') atual — zero escopo extra | |
| Voltar à origem | Guarda destino e retorna após login | ✓ |
| Você decide | Planner escolhe | |

**User's choice:** Voltar à origem
**Notes:** Fallback dashboard quando sem destino; mecanismo = estender query (`&redirect=`); validação só-paths-internos (anti open-redirect). Amenda o Navigation contract da 05-UI-SPEC.

---

## Aviso de expirada

| Option | Description | Selected |
|--------|-------------|----------|
| Manter na URL | Sem código extra; refresh mantém aviso | |
| Limpar após exibir | history.replaceState remove ?reason após montar | ✓ |
| Você decide | Planner escolhe | |

**User's choice:** Limpar após exibir
**Notes:** Warn persiste até login ok (não dispensa ao digitar); empilha warn acima + error abaixo; copy verbatim da UI-SPEC mantida.

---

## Dados não salvos

| Option | Description | Selected |
|--------|-------------|----------|
| Aceitar perda no MVP | Reload descarta; refresh silencioso cobre caso comum | |
| Preservar melhor esforço | Snapshot e restaura pós-login | ✓ |
| Você decide | Planner avalia | |

**User's choice:** Preservar melhor esforço (só Requests, via sessionStorage, descarta silencioso em falha)

---

## Bounce multi-aba

| Option | Description | Selected |
|--------|-------------|----------|
| Bounce por aba | Cada aba independente, sem sync | ~ |
| Sincronizar via storage | Coordenação cross-tab | inicial |
| Você decide | Planner escolhe | |

**User's choice:** Refinado em duas rodadas: sync → só bounce/logout → descoberta passiva (cada aba percebe no próprio 401/me; zero canal sync; cada bounce leva próprio redirect)
**Notes:** Motivação original era não deixar abas órfãs; cookies partilhados já garantem convergência.

---

## Higiene do snapshot

| Option | Description | Selected |
|--------|-------------|----------|
| Restaurar+submeter | Limpa ao restaurar E ao submeter; parse-fail limpa | ✓ |
| Só ao restaurar | Limpa apenas na leitura | |
| Você decide | Planner define | |

**User's choice:** Restaurar+submeter; chave fixa + JSON 1 slot; same-origin basta; não-Requests ignoram (órfão limpo na próxima restauração)

---

## the agent's Discretion

Nenhuma área delegada como "você decide" — usuário escolheu todas. Micro-detalhes deixados ao planner: string exata da chave, momento do replaceState, ponto de captura do redirect.

## Deferred Ideas

- trust proxy + rate-limit (Phase 8 SEC-03); SES-02 forced-password UX (Phase 8); sync cross-tab ativo; snapshot além de Requests.
