---
phase: 04-authorization-hardening
reviewed: 2026-09-24T19:10:00Z
depth: standard
files_reviewed: 12
files_reviewed_list:
  - backend/src/middlewares/permissions.js
  - backend/src/middlewares/visibility.js
  - backend/src/routes/requests.routes.js
  - backend/src/routes/messages.routes.js
  - backend/src/routes/settings.routes.js
  - backend/src/routes/reports.routes.js
  - backend/src/routes/users.routes.js
  - backend/src/controllers/requestController.js
  - backend/src/controllers/deliberationController.js
  - backend/src/controllers/votingController.js
  - backend/src/controllers/userController.js
  - backend/src/controllers/settingsController.js
  - backend/tests/authz/helpers.js
  - backend/tests/authz/mockDbState.js
  - backend/tests/authz/matrix.test.js
  - backend/tests/authz/route-coverage.test.js
findings:
  critical: 1
  warning: 4
  info: 5
  total: 10
status: issues_found
---

# Phase 04: Code Review Report

**Reviewed:** 2026-09-24T19:10:00Z
**Depth:** standard
**Files Reviewed:** 12 (+4 test files in scope per phase brief)
**Status:** issues_found

## Summary

Reviewed the three Phase 04 plans/SUMMARYs, then traced every production diff across
commits `3b65c62`, `729db89`, `ff9717a`, `e735b04`, `01ae101` against the cited
decisions (D-01..D-11, RN-010, docs/06, docs/14:16). The foundation is solid:
deny-by-default map with fail-closed 403 / 401-no-user, route wiring keeps
`router.use(authJwt)` first on all five files, check order (map 403 → fetch →
visibility 404 → ownership 403) is honored on the touched read paths, mutation
role arrays in `settingsController`/`financeController` are byte-identical
(zero behavior change verified via diff), and `tests/authz` is green (53/53,
re-ran during this review).

One read-scope hole contradicts the phase's own D-04 rule (`CONSELHEIRO` list
exposure of drafts that `getOne` 404s), plus four warnings (write-path
existence oracles, whitespace justification bypass, dead `mine` forcing on the
dashboard). All test-harness findings are INFO-grade. Advisory only per phase
brief — nothing here claims the suite is red.

## Critical Issues

### CR-01: `scopeWhere` leaves CONSELHEIRO unscoped — list leaks RASCUNHO rows that `getOne` 404s (D-04 violation)

**File:** `backend/src/middlewares/visibility.js:22-33` (root cause), `backend/src/controllers/requestController.js:7-14` (exposure site)
**Issue:** D-04 (04-CONTEXT.md:22) states drafts are visible only to owner +
ADMINISTRADOR/CHEFE_DEPARTAMENTO, with CONSELHEIRO seeing a request "from
submission onward". `canViewRequest` implements this correctly, and `getOne`
returns 404 for a CONSELHEIRO reading another user's draft (pinned by matrix
test). But `scopeWhere` has no CONSELHEIRO branch — it returns `{}` (plus
optional status/type filters), so `GET /api/requests` returns other users'
`RASCUNHO` rows (full row: title, amounts, justification) to any CONSELHEIRO.
Read path A (list) discloses exactly what read path B (getOne) hides — an
internally contradictory authorization rule, and an information-disclosure of
draft contents to a role the decision explicitly excludes. The same hole flows
into `reports.scopeFilter` (delegation added in `e735b04`), so `/requests` and
`/dashboard` reports leak drafts to CONSELHEIRO too. Pre-existing behavior
(old list scoped only ALUNO), but this phase's mandate was to encode D-03/D-04
in the shared helper and its header comment claims to do so — the helper does
not implement what it documents.
**Fix:**
```js
function scopeWhere(user, q = {}) {
  const where = {};
  // PROFESSOR/ALUNO/CONSELHEIRO: próprios rascunhos + tudo que não é rascunho (D-03/D-04).
  if (['PROFESSOR', 'ALUNO', 'CONSELHEIRO'].includes(user.role)) {
    where.OR = [{ requesterId: user.id }, { status: { not: 'RASCUNHO' } }];
  } else if (q.mine === '1') {
    where.requesterId = user.id;
  }
  ...
}
```
Then extend the matrix `GET /api/requests` describe with a CONSELHEIRO case
(sees open, not others' drafts).

## Warnings

### WR-01: `deliberationController.post` writes to out-of-scope (invisible) drafts + 404/201 existence oracle

**File:** `backend/src/controllers/deliberationController.js:41-54`
**Issue:** `list` gained a parent `canViewRequest` 404 in this phase, but `post`
did not: any role passing the `messages:post` map gate (e.g. PROFESSOR,
CONSELHEIRO) can create a message on another user's `RASCUNHO` — a resource
`getOne`, message `list`, and `listVotes` all report as 404 to that caller.
Write-allowed-where-read-denied breaks the view-scope invariant established
everywhere else, and the `404 missing` vs `201 created` differential lets a
caller probe arbitrary UUIDs for draft existence. (Mitigating factor: IDs are
unguessable UUIDs, so exploitability is low — hence WARNING, not CR.)
**Fix:**
```js
const r = await prisma.resourceRequest.findUnique({ where: { id: req.params.id } });
if (!r || !canViewRequest(req.user, r)) return res.status(404).json({ error: 'Não encontrado' });
```

### WR-02: `submit` (and `closeManual`/`requestVista`) return 403-vs-404 differentially, leaking draft existence

**File:** `backend/src/controllers/requestController.js:47-54` (primary), `backend/src/controllers/votingController.js:129-140`, `backend/src/controllers/votingController.js:100-108` (same pattern)
**Issue:** `submit` fetches then answers 404-if-missing but 403-if-not-owner on
an existing draft, so a non-owner caller distinguishes "nonexistent ID" (404)
from "someone's draft" (403) — the exact oracle D-08 was created to eliminate
on reads. `closeManual` (fetch → 404, then leaders-only 403) and `requestVista`
(fetch → 404, then role 403) share the shape. `cancel` got the `canViewRequest`
404 treatment in this phase; `submit` was left untouched (out of plan scope, but
the inconsistency is now glaring side-by-side). Same UUID-unguessability
mitigation as WR-01.
**Fix:**
```js
// submit, after fetch:
if (!r || !canViewRequest(req.user, r)) return res.status(404).json({ error: 'Não encontrado' });
```
(For `closeManual`/`requestVista`, a 404-first for out-of-scope callers keeps
the leaders' happy paths identical while closing the oracle.)

### WR-03: Cancel "mandatory justification" accepts whitespace-only strings

**File:** `backend/src/controllers/requestController.js:117-118`
**Issue:** D-06 requires mandatory audited justification, enforced as
`if (!justification) return 400`. A body of `{ "justification": "   " }` is
truthy, passes the gate, and is stored as the audit record — an empty audit
trail entry that defeats the stated purpose (RN-010 accountability). Non-string
payloads (object/array) also pass and land in `afterData` unnormalized.
**Fix:**
```js
const justification = typeof req.body?.justification === 'string' ? req.body.justification.trim() : '';
if (!justification) return res.status(400).json({ error: 'Justificativa obrigatória' });
```

### WR-04: Dashboard `mine: '1'` forcing is dead code — `scopeWhere` silently ignores `mine` for PROFESSOR/ALUNO

**File:** `backend/src/routes/reports.routes.js:124`, `backend/src/middlewares/visibility.js:25-29`
**Issue:** The dashboard forces `mine: '1'` for ALUNO/PROFESSOR, clearly
intending a personal scope — but `scopeWhere`'s PROFESSOR/ALUNO branch never
reads `q.mine`, so the parameter is silently discarded and the dashboard shows
all non-drafts. Current behavior matches the recorded unify-widen decision, so
nothing leaks; the defect is that the code states an intent it does not
implement. Anyone later "fixing" `scopeWhere` to honor `mine` will silently
narrow the dashboard, and anyone reading line 124 will misstate the dashboard's
scoping. `GET /api/requests?mine=1` is likewise silently ignored for those
roles (returns the superset — over-delivery of in-scope data, confusing but not
a leak).
**Fix:** Either remove the forcing (align code with the widen decision):
```js
const where = scopeFilter(req.user, { ...req.query });
```
or honor `mine` inside `scopeWhere`'s role branch (`where.requesterId = user.id`
when `q.mine === '1'`). Pick one and pin it with a matrix case.

## Info

### IN-01: `deliberationController.patch` parses `history` without try/catch — corrupt row → 500

**File:** `backend/src/controllers/deliberationController.js:63`
**Issue:** `JSON.parse(m.history || '[]')` throws on malformed/legacy `history`
content (and `.push` throws if it parses to a non-array), escaping to the
generic error handler as 500. The sibling `enrichMessages` (line 18) already
guards the same parse with try/catch — the convention exists, `patch` just
doesn't follow it.
**Fix:** Mirror the `enrichMessages` guard: `let history = []; try { history = JSON.parse(m.history || '[]') || []; } catch { history = []; }`.

### IN-02: `deliberationController.remove` re-deletes already-deleted messages and re-audits

**File:** `backend/src/controllers/deliberationController.js:73-88`
**Issue:** Unlike `patch` (line 59, checks `m.deletedAt`), `remove` only checks
`!m`, so deleting an already-soft-deleted message succeeds again and emits a
duplicate `message_deleted` audit event. Idempotent outcome, noisy audit trail.
**Fix:** `if (!m || m.deletedAt) return res.status(404).json({ error: 'Não encontrada' });`

### IN-03: Force-reset vs invite audit split relies on `req.path` substring matching

**File:** `backend/src/controllers/userController.js:82`
**Issue:** `String(req.path || '').includes('force-password-reset')` couples
audit semantics to the route's URL slug: renaming the route (or a future user
ID containing that substring — impossible for UUIDs, but the coupling stands)
silently mislabels `password_reset_forced` as `invite_resent` with no test to
catch it (matrix asserts status codes, not audit actions).
**Fix:** Pass the action explicitly, e.g. mount with a wrapper
`(req, res, next) => { req.auditAction = 'password_reset_forced'; return c.resendInvite(req, res, next); }`
or split into two handler functions sharing a private helper.

### IN-04: Test-harness seams — dead `mockDbModule` export; `require.cache` seeding is order-fragile

**File:** `backend/tests/authz/mockDbState.js:26`, `backend/tests/authz/matrix.test.js:18-22`, `backend/tests/authz/route-coverage.test.js:15-19`
**Issue:** (a) `mockDbModule()` is exported but imported nowhere — dead seam
that suggests a second mocking path exists. (b) Both test files seed
`require.cache[dbPath]` only `if (!cache[dbPath])`: if any execution mode ever
loads the real `db.js` first in the same registry (e.g. `--no-isolate`, future
global setup importing the app), the seed is skipped and the suite silently
talks to a real database. Works today under default per-file isolation
(53/53 green confirmed), but the guard rails on the guard rails are thin.
**Fix:** Remove the unused export; add a fail-loud assertion after seeding
(e.g. `expect(_require.cache[_dbPath].exports).toBe(prisma)`).

### IN-05: Minor inconsistencies — shared `LEADERS` array in a frozen map; `submit` owner compare without `String()` coercion

**File:** `backend/src/middlewares/permissions.js:16-29`, `backend/src/controllers/requestController.js:51`
**Issue:** (a) `Object.freeze(PERMISSIONS)` is shallow: `roles: LEADERS` shares
one mutable array across six actions — a future `PERMISSIONS['x'].roles.push()`
mutates all of them despite the "frozen" label. (b) `submit` compares
`r.requesterId !== req.user.id` with strict equality while the phase convention
(visibility.js, cancel, remove, patch) is `String()`-coerced UUID comparison;
a type mismatch (number vs string IDs) would wrongly 403 the owner. No live bug
today (UUID strings throughout), but the convention drift invites one.
**Fix:** Deep-freeze (`Object.freeze(LEADERS)` + freeze each entry, or inline
literals); use `String(r.requesterId) !== String(req.user.id)` in `submit`.

---

_Reviewed: 2026-09-24T19:10:00Z_
_Reviewer: the agent (gsd-code-reviewer)_
_Depth: standard_
