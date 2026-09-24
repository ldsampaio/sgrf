# Phase 05: Session Refresh - Context

**Gathered:** 2026-09-24
**Status:** Ready for planning

<domain>
## Phase Boundary

Phase 5 keeps users logged in past the 15-minute access-token TTL through a silent single-flight 401 interceptor on the shared axios instance (`frontend/src/services/api.js`): one in-flight `POST /auth/refresh`, per-request `_retry` guard, replay once, and exactly one `window.location.assign` bounce when the refresh cookie is dead. Covers SES-01. Touch boundary in `frontend/` is `src/services/api.js` + `src/views/Login.vue` only (Login gains the session-expired notice + redirect handling). No new views, components, tokens, or stylesheets. The 05-UI-SPEC interaction contract (invisible refresh, 401-only, no router import, locked notice copy) is normative — this discussion's redirect/snapshot decisions AMEND it in two explicit points (D-02, D-09…D-13), recorded below so the planner carries the amended boundary verbatim.

</domain>

<decisions>
## Implementation Decisions

### Retorno pós-login (post-expiry landing)
- **D-01:** Após sessão expirada + re-login, voltar à origem (onde o usuário estava), com fallback para o dashboard `/` quando não houver destino guardado.
- **D-02:** O destino viaja estendendo a query do bounce: `/login?reason=session-expired&redirect=<origem>`. **AMENDS 05-UI-SPEC** Navigation contract (que trava só `?reason=session-expired`) — o planner deve levar a forma estendida adiante verbatim e tratar a UI-SPEC como atualizada neste ponto. — **Reversibility:** costly — undo toca o contrato de navegação partilhado entre interceptor e Login (bounce, leitura do redirect, fallback) em dois ficheiros acoplados.
- **D-03:** Sem `redirect` (visita manual a `/login`, navegação direta), o pós-login cai no comportamento atual `router.push('/')`.
- **D-04:** `redirect` validado como path interno apenas: começa com `/` único, sem `//`, sem esquema/host. Qualquer outro valor é descartado e cai no fallback dashboard (proteção contra open-redirect).

### Aviso de sessão expirada (Login notice)
- **D-05:** Após montar o aviso a partir de `location.search`, limpar `?reason` (e `?redirect` após consumo) via `history.replaceState` — URL limpa; refresh posterior no login esconde o aviso.
- **D-06:** O `.alert.warn` persiste até o login dar certo — digitar não o dispensa; conserva o contexto do porquê o usuário caiu ali.
- **D-07:** Coexistência empilhada: `.alert.warn` acima, `div.alert.error[role=alert]` abaixo/quando houver erro de credenciais — papéis nunca misturados (warn jamais exibe erro de credencial, error jamais usa `.alert.warn`).
- **D-08:** Copy verbatim travada pela UI-SPEC, sem reescrever: `Sua sessão expirou. Entre novamente para continuar.` (`role="status"`).

### Rascunho não salvo (forced-logout data loss)
- **D-09:** Preservação best-effort **só em Requests** (formulário crítico: título/justificativa/valor). Demais views aceitam a perda no reload — **AMENDS 05-UI-SPEC** two-file boundary só no sentido de *ler* sessionStorage em Requests; nenhum ficheiro novo em `frontend/`. — **Reversibility:** costly — undo remove o acoplamento interceptor→sessionStorage→Requests (snapshot, leitura, limpeza) em três pontos.
- **D-10:** Mecanismo `sessionStorage`, chave fixa única + JSON (sugestão: `sgrf:pending-draft` com `{title, justification, valueCents, …}`); cada bounce sobrescreve (1 slot).
- **D-11:** Ciclo de vida: limpa ao restaurar no mount de Requests E ao submeter com sucesso; parse/shape inválido descarta silencioso e o form abre vazio normal (best-effort nunca bloqueia login/redirect).
- **D-12:** Same-origin basta — `sessionStorage` é por origem e por aba; sem criptografia no MVP.
- **D-13:** Views não-Requests ignoram a chave; snapshot órfão (redirect para outra view) é limpo na próxima restauração em Requests.

### Bounce multi-aba
- **D-14:** Sem canal sync cross-tab. Single-flight segue por aba (promise partilhada em módulo); cada aba percebe a morte no seu próximo 401/`me` (cookies partilhados) e faz o próprio bounce levando seu próprio `location` como `redirect` (descoberta passiva, zero código sync).

### the agent's Discretion
- String exata da chave sessionStorage (sugestão `sgrf:pending-draft` acima é não-normativa) e campos exatos do snapshot JSON.
- Momento exato do `replaceState` (no mount após leitura vs após primeiro render) e ponto de captura do `redirect` (pathname+search da aba no instante do bounce).
- Ordem de limpeza warn/error em fluxos finos não cobertos acima.
- Nada do fluxo foi delegado como "você decide" — todas as escolhas acima são do usuário; a lista aqui é só micro-detalhe.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase scope + requirements
- `.planning/ROADMAP.md` Phase 5 section — goal, 4 success criteria, 3 plan descriptions (05-01 interceptor, 05-02 manual protocol, 05-03 regression pass)
- `.planning/REQUIREMENTS.md` SES-01 — single-flight 401 interceptor, retry once, redirect only when refresh fails, no router import
- `.planning/STATE.md` Blockers/Concerns — ordering (Phase 4 permission map lands before this phase; Phase 8 owns trust-proxy/rate-limit + SES-02)

### UI contract (normative, as amended by D-02/D-09…D-13 above)
- `.planning/phases/05-session-refresh/05-UI-SPEC.md` — approved 2026-09-23: interaction contract (silent refresh, retry-once, one bounce, 401-only, 403 passthrough incl. `PASSWORD_CHANGE_REQUIRED`, no router import), locked notice copy, `.alert.warn` existing-class reuse, manual verification DoD; **read with the two amendments in `<decisions>`**

### Code targets (edit points)
- `frontend/src/services/api.js` — shared axios instance (`baseURL: '/api'`, `withCredentials: true`); interceptor lands ONLY here
- `frontend/src/views/Login.vue` — mounts warn from `?reason`, reads+consome `?redirect`, `replaceState`, empilha warn+error, `router.push(redirect|'/')` após login ok
- `frontend/src/stores/auth.js` — Pinia `auth` (`me`/`login`/`logout`); bounce limpa `user`; `me()` falhando é o sinal de sessão morta no router guard
- `frontend/src/router/index.js` — `beforeEach` chama `auth.me()`, `meta.auth` → `/login`; redirect de retorno deve compor com este guard, não duplicá-lo
- `frontend/src/views/Requests.vue` — única view que lê/limpa o snapshot sessionStorage no mount
- `backend/src/controllers/authController.js` — `refresh` (401 `Sem refresh`/`Inválido`/`Refresh expirado`), login/logout; o interceptor reage a estes formatos
- `backend/src/utils/tokens.js` — `cookieOpts` (15m access / 7d refresh, `sameSite: 'lax'`); nenhuma mudança de backend esperada nesta fase

### Specs
- `docs/06-permissoes.md` — matriz de permissões (contexto: 403 nunca dispara refresh/redirect — D-14/UI-SPEC §5)
- `docs/11-seguranca-e-auditoria.md` — risco residual CSRF aceito (`sameSite: 'lax'` + CORS); sessionStorage segue a mesma origem

### Codebase maps
- `.planning/codebase/ARCHITECTURE.md` — same-origin auth assumption, axios client, router guard, auth flow (15m/7d cookies)
- `.planning/codebase/INTEGRATIONS.md` — auth provider details (lockout, `@utfpr.edu.br`, cookie flags)
- `.planning/codebase/STACK.md` — axios 1.20.0 já instalado; zero novos deps nesta fase

</code_context>

<code_context>
## Existing Code Insights

### Reusable Assets
- `frontend/src/services/api.js` — instância axios partilhada já usada por todo o app (`api.get/post`); interceptor acoplado aqui cobre todas as views sem tocar em cada uma
- `frontend/src/stores/auth.js` — `me()` já falha suave (`catch → user=null`); o guard e o bounce reaproveitam este sinal sem novo endpoint
- `Login.vue` — `.alert.error[role=alert]` + `e.response?.data?.error || 'Falha no login'` existentes; warn segue o mesmo padrão visual via `.alert.warn` (classe já existe em `base.css`)
- `router/index.js` `beforeEach` — já carrega `auth.me()` e redireciona `/login`; o retorno com `redirect` compõe com ele (Login empurra para o destino, guard autoriza)

### Established Patterns
- Navegação programática pós-auth é `router.push(...)` (Login faz `push('/')`); bounce de morte é `window.location.assign` (full reload, sem import de router — evita ciclo `api.js` ⇄ `router`)
- Erros de servidor renderizam verbatim em `.alert.error` dentro do card 440px, sem truncamento — warn segue a mesma regra de bloco
- Money é centavos inteiros; irrelevante aqui exceto pelo campo `valueCents` do snapshot
- Sem testes de frontend (`npm run build` é o gate); verificação desta fase é o protocolo manual 05-02

### Integration Points
- Interceptor → `POST /auth/refresh` (mesma origem, `withCredentials` preservado no replay) → retry do request original → ou bounce com `?reason&redirect`
- Login → `history.replaceState` (limpeza) → `auth.login` → `router.push(redirect validado | '/')`
- Requests mount → lê+limpa `sessionStorage` → preenche rascunho → limpa de novo ao submeter
- Phase 8 (SES-02/SEC-03) consome sem alterar: 403 `PASSWORD_CHANGE_REQUIRED` atravessa o interceptor intocado; rate-limit generoso em `/auth/refresh` assume este fluxo

</code>

<specifics>
## Specific Ideas

- Escolha do usuário (retorno): "voltar à origem" em vez de sempre-dashboard — motivação: não perder o contexto de onde estava ao cair a sessão.
- Escolha do usuário (aviso): limpar a URL após exibir — motivação: URL limpa após o aviso cumprir o papel.
- Escolha do usuário (rascunho): preservar melhor esforço só em Requests — motivação: rascunho de pedido é o único formulário cuja perda dói; resto aceita perda.
- Escolha do usuário (abas): sincronizar via storage → refinado para descoberta passiva por aba — motivação original: não deixar abas órfãs deslogadas; resolução: cookies partilhados já garantem convergência sem canal extra.

</specifics>

<deferred>
## Deferred Ideas

- `trust proxy` + rate-limit expansion atrás do Tunnel (SEC-03, Phase 8) — taxa generosa em `/auth/refresh` deve considerar o refresh silencioso desta fase.
- UX completa de troca forçada de senha (SES-02, Phase 8) — o interceptor desta fase só precisa não engolir o 403 correspondente.
- Sync cross-tab ativo (storage-event push, lock global de refresh) — rejeitado nesta discussão em favor de descoberta passiva; revisitar só com evidência de storm real entre abas.
- Preservação de rascunho em views além de Requests — fora do MVP; reavaliar se perda virar reclamação.

</deferred>

---

*Phase: 05-Session Refresh*
*Context gathered: 2026-09-24*
