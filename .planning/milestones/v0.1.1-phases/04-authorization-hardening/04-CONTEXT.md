# Phase 04: Authorization Hardening - Context

**Gathered:** 2026-09-24
**Status:** Ready for planning

<domain>
## Phase Boundary

Phase 4 makes every endpoint enforce the documented permission matrix server-side through one deny-by-default permission map (`middlewares/permissions.js` + `requirePermission(action)`), with row-level ownership checks in controllers where the matrix requires them. Covers SEC-01: `cancel`, message `remove`, `getOne`/`list` scoping, `listVotes`, settings `transactions`, `force-password-reset` guard, reports `voting`. Ends with a supertest allow+deny matrix covering the fixed routes × all 5 roles as the authorization regression gate. Undeclared actions fail closed (403). Trust proxy + rate limits stay atomic in Phase 8 (SEC-03), not here.

</domain>

<decisions>
## Implementation Decisions

### Vote visibility (listVotes — votes are NOT secret)
- **D-01:** Votes are fully transparent: anyone who can view the request sees individual votes (voter identity + value) in real time, including while voting is open, and the requester sees full detail on their own request.
- **D-02:** `listVotes` therefore enforces view-scope, not voter-role: any role with `getOne`/`list` visibility on the request gets full vote detail. No tally-only redaction layer.

### Request scoping (getOne/list)
- **D-03:** PROFESSOR and ALUNO see everything except drafts (RASCUNHO): own requests + all non-draft requests. ALUNO parity with PROFESSOR here **overrides** `docs/06` matrix row "Visualizar pedidos em votação: Não" — the planner must update that row instead of implementing it.
- **D-04:** Drafts (RASCUNHO) are visible only to the owner + ADMINISTRADOR/CHEFE_DEPARTAMENTO. CONSELHEIRO sees a request from submission onward.
- **D-05:** Financial fields (amounts) follow view scope: anyone who can view the request sees its amounts. No separate amount-redaction layer.

### Cancel & message-remove rules
- **D-06:** Ordinary (non-approved) cancel: owner + ADMINISTRADOR/CHEFE_DEPARTAMENTO, with mandatory justification (audited). Same justification discipline as the Phase 2 after-approval path (RN-010), applied to ordinary cancel.
- **D-07:** Message remove: author + ADMINISTRADOR + CHEFE_DEPARTAMENTO, no time window — removal is allowed any time because the audit trail already preserves the record.

### Deny style & chefe-limited views
- **D-08:** Deny style is split: 403 for wrong role on a visible route/scope, 404 when the resource is outside the caller's scope (hides existence).
- **D-09:** Chefe "limitada" audit means own-scope events: CHEFE_DEPARTAMENTO sees audit events for requests/users in their scope, not system-wide.
- **D-10:** Settings financial transactions are viewable by everyone but editable only by leaders (ADMINISTRADOR/CHEFE_DEPARTAMENTO). This **differs** from current controller code, which restricts view to leaders — the view gate must be loosened while the mutation gate stays.
- **D-11:** `force-password-reset` stays ADMIN + CHEFE, with chefe blocked from targeting admins via existing `canManageUsers` (matches matrix "Gerenciar usuários: Parcial").

### the agent's Discretion
- Exact `PERMISSIONS` map key shape (action naming) and where the ownership helpers live (shared visibility helper reused by `reports.scopeFilter` per roadmap, or per-controller).
- Supertest DB story (mock Prisma vs test Postgres): spike at plan time per roadmap — planner's call, no user input needed.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase scope + requirements
- `.planning/ROADMAP.md` Phase 4 section — goal, 4 success criteria, 3 plan descriptions (04-01 permission map, 04-02 ownership fixes, 04-03 supertest matrix)
- `.planning/REQUIREMENTS.md` SEC-01 — endpoint list, deny-by-default via shared map, row-level ownership
- `.planning/STATE.md` Blockers/Concerns — supertest DB story undecided (spike at plan time)

### Specs (matrix authority + decided rules)
- `docs/06-permissoes.md` — permission matrix; authority for role×action, EXCEPT the "Visualizar pedidos em votação: Não" cell for ALUNO, which D-03 overrides (planner must update the doc)
- `docs/14-decisoes-em-aberto.md` — Phase 2 closed rows (RN-010 cancellation roles/justification/reversal) constraining cancel guards

### Code targets (edit points)
- `backend/src/middlewares/auth.js` — `authJwt`, `requireRole`, `canManageUsers`; permission map + `requirePermission(action)` land here or in a new `middlewares/permissions.js`
- `backend/src/routes/requests.routes.js` — auth-only today; wire `requirePermission` per action
- `backend/src/routes/messages.routes.js` — auth-only today; remove needs author/admin/chefe rule (D-07)
- `backend/src/routes/settings.routes.js` — auth-only today; transactions view loosened per D-10, mutations stay leaders-only
- `backend/src/routes/reports.routes.js` — auth-only today; `voting` report + `scopeFilter` reuse the shared visibility helper
- `backend/src/routes/users.routes.js` — only file using `requireRole` today; `force-password-reset` keeps admin+chefe per D-11
- `backend/src/controllers/requestController.js` — line 10 ALUNO owner-scoping (widened per D-03), line 54 owner/admin/chefe read guard, cancel handler needs D-06
- `backend/src/controllers/votingController.js` — scattered inline role arrays; `listVotes` becomes view-scope per D-01/D-02
- `backend/src/controllers/settingsController.js` — lines 18/39 leaders-only gates; view loosened per D-10

### Codebase maps
- `.planning/codebase/ARCHITECTURE.md` — same-origin auth assumption, route/middleware layout
- `.planning/codebase/CONCERNS.md` — scattered-authorization-checks concern this phase resolves

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `middlewares/auth.js` `requireRole(...roles)` — role-check factory the new `requirePermission(action)` mirrors; `canManageUsers(actor, target)` already encodes the chefe-can't-touch-admin rule for D-11
- `requestController.js` line 10 (`ALUNO` owner-scoping) and line 54 (owner/admin/chefe read guard) — seed patterns for the shared visibility helper
- `supertest@^7.0.0` already in backend devDependencies — matrix tests need only the DB story (mock vs Postgres), not new deps

### Established Patterns
- All routes mount `router.use(authJwt)` (auth-only default) — the hole this phase closes; `users.routes.js` is the sole `requireRole` precedent
- Inline `['ADMINISTRADOR', 'CHEFE_DEPARTAMENTO'].includes(req.user.role)` arrays scattered across finance/settings/voting controllers — centralized into the map, not duplicated
- Money is integer cents; IDs are UUID strings; audit via `auditService` on mutating flows (cancel/remove keep auditing)

### Integration Points
- Phase 6 VOT-04 ordinary cancellation wires to this phase's ownership guard; Phase 8 SES-02/SEC-03 build on (not alter) these gates
- CI gate (Phase 1) constrains the supertest matrix: must run with existing `npx vitest run`, no new lint/typecheck commands

</code>

<specifics>
## Specific Ideas

- User verbatim (votes): "everyone, vote is not secret" — full transparency is a deliberate product stance, not an oversight.
- User verbatim (ALUNO): "ALUNO should see the same as any PROFESSOR" — explicit override of the matrix; doc update required.
- User verbatim (transactions): "everyone can see but only leaders can edit information" — view/mutation split.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 04-Authorization Hardening*
*Context gathered: 2026-09-24*
