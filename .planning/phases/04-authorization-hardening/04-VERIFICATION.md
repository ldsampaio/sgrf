---
phase: 04-authorization-hardening
verified: 2026-09-24T19:30:00Z
status: passed
score: 10/10 must-haves verified
covered_files: [".planning/phases/04-authorization-hardening/04-01-PLAN.md", ".planning/phases/04-authorization-hardening/04-02-PLAN.md", ".planning/phases/04-authorization-hardening/04-03-PLAN.md", ".planning/phases/04-authorization-hardening/04-01-SUMMARY.md", ".planning/phases/04-authorization-hardening/04-02-SUMMARY.md", ".planning/phases/04-authorization-hardening/04-03-SUMMARY.md", ".planning/phases/04-authorization-hardening/04-REVIEW.md", "backend/src/middlewares/permissions.js", "backend/src/middlewares/visibility.js", "backend/src/controllers/requestController.js", "backend/src/controllers/deliberationController.js", "backend/src/controllers/votingController.js", "backend/src/controllers/userController.js", "backend/src/routes/requests.routes.js", "backend/src/routes/messages.routes.js", "backend/src/routes/settings.routes.js", "backend/src/routes/reports.routes.js", "backend/src/routes/users.routes.js", "backend/tests/authz/matrix.test.js", "backend/tests/authz/route-coverage.test.js", "backend/tests/authz/helpers.js", "backend/tests/authz/mockDbState.js", "docs/06-permissoes.md"]
covered_digest: "v1:sha256:c558aac3cb866333dad06f8c3276891f5baa1f410ec6a692fdb5ad8bf30ba697"
behavior_unverified: 0
overrides_applied: 0
re_verification: false
---

# Phase 04: Authorization Hardening Verification Report

**Phase Goal:** Every endpoint enforces the documented permission matrix server-side through one deny-by-default permission map, with row-level ownership checks where the matrix requires them.
**Verified:** 2026-09-24T19:30:00Z
**Status:** passed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | GET /api/requests/:id enforces role gate then row visibility: wrong-role caller gets 403, out-of-scope resource reads as 404 | ✓ VERIFIED | `requests.routes.js:13` mounts `requirePermission('requests:get')` after `router.use(authJwt)`; `requestController.getOne` (lines 101-107) fetches then `canViewRequest` → 404; matrix.test.js pins owner-draft 200, cross-user draft 404, PROFESSOR/ALUNO non-draft 200, 401 unauthenticated, history alias |
| 2 | Every route in requests/messages/settings/reports route files declares a permission action; an undeclared action fails closed with 403 | ✓ VERIFIED | Grep: 46 `requirePermission` hits across all 5 route files (17 requests + 2 messages + 5 settings + 7 reports + 8 users incl. finance/voting mutations); `permissions.js:66` returns 403 on undeclared action; `route-coverage.test.js` (4 tests) walks the router stack asserting `_permissionAction` tag + negative control |
| 3 | docs/06 ALUNO row for request visualization reads Sim (D-03 override applied) and the reports-scope decision is recorded | ✓ VERIFIED | `docs/06-permissoes.md:7` voting-visualization row is all-Sim; D-03 override note (2 mentions) + unify-widen reports decision (`Gerar relatórios` → `Não-rascunhos` for PROFESSOR/ALUNO) recorded under the table |
| 4 | `cd backend && npx vitest run tests/authz` passes | ✓ VERIFIED | Ran full suite 2026-09-24: 6 files, **88/88 green** (52 matrix + 4 coverage + 32 pre-existing) — exceeds the 85 cited in 04-03-SUMMARY because the two review-fix commits added cases |
| 5 | Cancelling a request enforces the RN-010 status-by-role matrix with mandatory justification and audit, and approved-path cancellations carry the Phase 6 REVERSE seam marker | ✓ VERIFIED | `requestController.cancel` (lines 109-142): fetch → `canViewRequest` 404 → CONCLUIDO/CANCELADO immutable 400 → trimmed-justification 400 (WR-03 fix, commit b21d8aa) → approved-branch leaders-only with `// Phase 6 (VOT-04/06-04) compensating REVERSE` seam comment, no FinancialTransaction writes → ordinary branch owner(RASCUNHO/EM_VOTACAO)/leaders/403; `request_cancelled` audit with justification on both paths |
| 6 | Message removal allows only author plus ADMINISTRADOR/CHEFE_DEPARTAMENTO with suspension precedence kept; listVotes shows full vote detail to anyone in view scope | ✓ VERIFIED | `deliberationController.remove` (lines 77-83): author-or-leader 403 inserted before suspension guard so 423 keeps precedence; `votingController.listVotes` (lines 26-33): parent lookup + `canViewRequest` 404, full `enrichVotes` detail, no tally redaction; deliberation `list` gains parent 404; `post` inline ALUNO exclusion removed (covered by `messages:post` map action) |
| 7 | Cross-user drafts are invisible (404) while PROFESSOR/ALUNO see all non-drafts; chefe cannot force-reset an admin; settings transactions stay view-open with mutations leaders-only | ✓ VERIFIED | `visibility.js` (commit 1368955, CR-01 fix): `scopeWhere` scopes PROFESSOR/ALUNO/**CONSELHEIRO** to own-drafts OR non-draft; `scopeFilter` in reports delegates to `scopeWhere`; `userController.resendInvite` (lines 74-83): target 404 + `canManageUsers` 403 with distinct `password_reset_forced`/`invite_resent` audit; settings `transactions` route open to all roles, PATCH mutations keep byte-identical leaders-only arrays |
| 8 | A supertest allow+deny matrix covering the fixed routes × all 5 roles passes, proving both ALLOW paths intact and deny paths correct | ✓ VERIFIED | `matrix.test.js`: 52 tests across cancel RN-010 (× roles, justification 400, immutable 400, whitespace 400), message remove, list scoping (incl. CONSELHEIRO case added in 1368955), listVotes, transactions 5-role sweep, force-reset chefe→admin 403 + admin flow intact, reports voting scoping; allow cases (conselheiro under-vote read, owner self-read, admin force-reset) guard against over-deny |
| 9 | The router-stack coverage test proves undeclared actions fail closed so a future auth-only route fails the suite | ✓ VERIFIED | `route-coverage.test.js` (4 tests): full 5-router tag assertion + per-router non-empty guard + negative control (synthetic untagged route detected) + positive control |
| 10 | The full backend suite (all pre-existing tests plus the authz matrix) is green with no CI workflow change | ✓ VERIFIED | `cd backend && npx vitest run` → 6 files, 88/88 green (32 pre-existing ≥ 17 required); `git log -- .github/workflows/ci.yml` shows no change since Phase 3 (abf2296); matrix mocks only the `db.js` singleton, auth chain stays real via signed tokens |

**Score:** 10/10 truths verified (0 present, behavior-unverified)

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `backend/src/middlewares/permissions.js` | Frozen PERMISSIONS map + requirePermission | ✓ VERIFIED | 29 actions, fail-closed 403 undeclared, 401 no-user, `_permissionAction` frame tag; substantive (76 lines) and wired (46 route hits) |
| `backend/src/middlewares/visibility.js` | canViewRequest + scopeWhere (D-03/D-04) | ✓ VERIFIED | CONSELHEIRO branch present (CR-01 fix verified in code); imported by requestController, deliberationController, votingController, reports.routes |
| `backend/tests/authz/helpers.js` | 5-role fixtures, real-JWT signer | ✓ VERIFIED | Exists, extended with makeVote/makeMessage in 04-03 |
| `backend/tests/authz/mockDbState.js` | Singleton mock-Prisma via require.cache | ✓ VERIFIED | Exists, extended with viewRequest/fundBalance/departmentSettings/emailQueue in 04-03 |
| `backend/tests/authz/route-coverage.test.js` | Router-stack tag assertion + negative control | ✓ VERIFIED | 4 tests, green |
| `backend/tests/authz/matrix.test.js` | Allow+deny matrix fixed routes × 5 roles | ✓ VERIFIED | 52 tests, green |
| `backend/src/controllers/requestController.js` | RN-010 cancel + getOne/list visibility | ✓ VERIFIED | Cancel matrix + trimmed justification + Phase 6 seam + audit; list via scopeWhere; getOne 404 |
| `backend/src/controllers/deliberationController.js` | Remove guard + list parent scope | ✓ VERIFIED | Author-or-leader 403, 423 precedence, list parent 404 |
| `backend/src/controllers/votingController.js` | listVotes view-scope full detail | ✓ VERIFIED | Parent lookup + 404, enriched detail, eligibility untouched |
| `backend/src/controllers/userController.js` | Force-reset target guard + distinct audit | ✓ VERIFIED | canManageUsers 403, 404 target, path-based audit split |
| `docs/06-permissoes.md` | ALUNO Sim + reports decision | ✓ VERIFIED | All-Sim voting row, D-03 ×2, widen rationale recorded |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| all 5 route files | permissions.js | `requirePermission` mounted after `authJwt` | WIRED | 46 hits; `router.use(authJwt)` first in each file |
| requestController.getOne | visibility.js | `canViewRequest` before respond | WIRED | Line 104, include files+transactions kept (D-05) |
| reports.scopeFilter | visibility.js | delegates to shared `scopeWhere` | WIRED | `reports.routes.js:15-16`, only temporal slice local — no divergent draft rule |
| voting report | visibility.js | `canViewRequest` filter on votes/vistas | WIRED | `reports.routes.js:84` |
| listVotes | visibility.js | parent lookup + 404 | WIRED | `votingController.js:31` |
| resendInvite | auth.js | `canManageUsers` actor/target check | WIRED | `userController.js:74`, chefe→admin 403 |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|--------------------|--------|
| getOne | `r` (request row) | `prisma.resourceRequest.findUnique` + include | Yes — full row with amounts unredacted (D-05) | ✓ FLOWING |
| list | `where` | `scopeWhere(req.user, req.query)` → Prisma query | Yes — OR own/non-draft scoping | ✓ FLOWING |
| listVotes | `votes` | `prisma.vote.findMany` + `enrichVotes` join | Yes — full enriched detail, no tally redaction | ✓ FLOWING |
| reports/voting | `visible` set | `canViewRequest` filter over fetched requests | Yes — drafts excluded for outsiders | ✓ FLOWING |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Full backend suite green | `cd backend && npx vitest run` | 6 files, 88/88 passed | ✓ PASS |
| Authz matrix green | (within full run) `tests/authz/matrix.test.js` | 52 tests passed | ✓ PASS |
| Coverage test green | (within full run) `tests/authz/route-coverage.test.js` | 4 tests passed | ✓ PASS |
| docs/06 override present | `grep -c D-03` + all-Sim row count | 3 all-Sim rows, 2 D-03 mentions | ✓ PASS |

### Probe Execution

No probes declared for this phase — section not applicable.

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| SEC-01 | 04-01, 04-02, 04-03 | Deny-by-default permission map + row-level ownership on every documented endpoint | ✓ SATISFIED | All 10 truths verified; 88/88 suite green; coverage gate prevents future auth-only routes |

No orphaned requirements: REQUIREMENTS.md maps only SEC-01 to Phase 4, and all three plans declare `requirements: [SEC-01]`.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| — | — | None | — | Grep over the 7 touched source files found no TODO/FIXME/XXX/TBD/placeholder/console.log/empty-return stubs |

### Human Verification Required

None — all truths are server-side authorization behaviors pinned by HTTP-level supertest cases (real middleware chain, real JWTs, mocked Prisma singleton only). No visual, real-time, or external-service behavior is in scope.

### Gaps Summary

No gaps. The two review findings that touched the phase goal (CR-01 CONSELHEIRO list-scope hole, WR-03 whitespace justification bypass) were fixed in commits `1368955`/`b21d8aa` **before** this verification, and both fixes are confirmed present in the code with regression tests (CONSELHEIRO list case; whitespace/non-string justification 400 cases — the suite grew 85 → 88). The remaining review items (WR-01 post-to-invisible-draft, WR-02 submit/closeManual/requestVista 403-vs-404 oracle, WR-04 dead `mine` forcing, IN-01..IN-05) are explicitly deferred per the verification brief and concern adjacent surfaces outside the Phase 4 success criteria — they do not contradict any must-have truth.

---

_Verified: 2026-09-24T19:30:00Z_
_Verifier: the agent (gsd-verifier)_
