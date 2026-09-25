# Phase 1: CI Regression Gate - Context

**Gathered:** 2026-09-23
**Status:** Ready for planning

<domain>
## Phase Boundary

Phase 1 adds one file — `.github/workflows/ci.yml` — with two parallel jobs (backend `npx vitest run`, frontend `npm run build`) on Node 22, proves the gate catches regressions with a deliberate break-revert on `main`, then marks both job checks required on `main` and records CI as the regression gate in `AGENTS.md`. No src/ changes, no new UI surfaces: the word "frontend" in the goal means *run `npm run build` as a CI job*, not UI work. Footprint is one workflow file + one docs edit (+ temporary test break, reverted).

</domain>

<decisions>
## Implementation Decisions

### Protection strictness (branch protection shape)
- **D-01:** `strict: false` — do not require branches to be up-to-date before merge (single-dev direct-push flow, less churn).
- **D-02:** Record the `strict:false` choice in `AGENTS.md` with a revisit note (revisit when PRs become the norm).
- **D-03:** Plan 01-03 verifies `strict:false` with an API readback (`gh api .../protection`), not just the PUT response.
- **D-04:** No required pull-request reviews (`required_pull_request_reviews: null`) — the two checks alone gate merges.
- **D-05:** No push restrictions (`restrictions: null`) — any collaborator can push subject to the checks.

### Red-proof method (success criterion 3)
- **D-06:** Direct break-push-revert on `main` (matches `branching_strategy: none`); no PR-based proof.
- **D-07:** Break one assertion in `backend/tests/unit.test.js` line 8 (flip expected value to `'WRONG'`).
- **D-08:** Undo via `git revert HEAD` + push (no amend / force-push).
- **D-09:** Evidence is CLI output: `gh run list` showing `backend: failure` on the break commit, then green after the revert. No UI screenshots required.

### Admin enforcement
- **D-10:** `enforce_admins: true` — admin pushes are also blocked when red (a real gate, no hotfix bypass).
- **D-11:** Document the GH006 recovery path in `AGENTS.md` (re-run the failed workflow, or PR the fix, or temporarily disable the rule).
- **D-12:** Plan 01-03 verifies `enforce_admins` in the same protection readback as D-03.
- **D-13:** Record the `enforce_admins:true` choice in the `AGENTS.md` regression-gate note.

### the agent's Discretion
- Exact workflow YAML shape (job keys, `permissions: contents: read`, `cache-dependency-path` values, `npx prisma generate` placement, dummy `DATABASE_URL` value), commit messages for the break/revert, and the exact `AGENTS.md` note wording — follow `01-RESEARCH.md` Code Examples and the repo's existing Portuguese voice with the exact commands (`cd backend && npx vitest run`, `cd frontend && npm run build`).

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase scope + requirements
- `.planning/ROADMAP.md` Phase 1 section — goal, 3 success criteria, 3 plan descriptions (01-01 workflow, 01-02 red-proof, 01-03 required checks + AGENTS.md)
- `.planning/REQUIREMENTS.md` CI-01 — two-job pipeline, Node 22, per-package dirs, per-lockfile cache, no invented commands, lands first
- `.planning/phases/01-ci-regression-gate/01-RESEARCH.md` — full workflow skeleton, verified action tags, clean-checkout green evidence, prove-then-enforce sequencing, pitfalls (cache-dependency-path, prisma generate, GH006, no DB service, job-name ambiguity)
- `.planning/phases/01-ci-regression-gate/01-VALIDATION.md` — per-task verification map + sampling rate (CI-observation evidence)
- `.planning/phases/01-ci-regression-gate/01-UI-SPEC.md` — scope note: NO `.vue`/CSS edits permitted; only `.github/workflows/ci.yml`, `backend/tests/unit.test.js` (temporary), `AGENTS.md`

### Project contracts
- `AGENTS.md` — two packages no workspace, exact verify commands, no invented lint/typecheck, never-commit list
- `.planning/PROJECT.md` — milestone scope (fixes + hardening + CI), fragile areas, danger zones
- `.planning/STATE.md` Decisions log — `checkout@v7`/`setup-node@v7` locked, ordering (CI first), branching_strategy none

### Codebase maps (CI-relevant)
- `.planning/codebase/STACK.md` — Node 22 Docker pin, npm no-workspace lockfiles, vitest 2.1.9 / vite 5.4.21, no CI config today
- `.planning/codebase/ARCHITECTURE.md` — app factory / server bootstrap / entry points, `votingCloser.js` orphan note (not this phase)
- `.planning/codebase/INTEGRATIONS.md` — CI/CD section (none exists), Git remote `https://github.com/ldsampaio/sgrf.git`, required env vars

### Break target (D-07)
- `backend/tests/unit.test.js` — line 8 assertion to flip to `'WRONG'` for the red-proof, then `git revert`

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `backend/tests/unit.test.js` (line 8 assertion) — the designated red-proof break point; existing 17 tests (`batch`, `unit`, `voting`) are the gate payload, no new tests in this phase
- `backend/package.json` `"test": "vitest run"` — backend job runs `npx vitest run` and nothing else
- `frontend/package.json` `"build": "vite build"` — frontend job runs `npm run build`; `npm test` exits 1 by design and must never run in CI
- `gh` CLI (`/usr/bin/gh`, authed as `ldsampaio`, ADMIN on `ldsampaio/sgrf`) — run watching (01-02) + branch protection (01-03); repo is PUBLIC, Actions enabled, `main` currently unprotected
- `Dockerfile` (`node:22-bookworm-slim` both stages) — corroborates the Node 22 pin

### Established Patterns
- Two independent npm packages, no workspace — every CI job needs its own `working-directory`; never hoist to a root install
- `cache-dependency-path` is repo-root-relative (`backend/package-lock.json`, not `package-lock.json`); auto-cache is off (no `packageManager` field)
- Prove-then-enforce: workflow green → deliberate red → revert green → *then* enable required checks (GH006 deadlock avoidance; required checks need a successful run in the past 7 days)
- No migrations / seeds / DB service in CI — tests pass with no `DATABASE_URL` (Prisma 5.22 defers env resolution); dummy `DATABASE_URL` at job level is cheap insurance only
- Required-check contexts must equal reported check names (`backend`, `frontend` as explicit `name:`)

### Integration Points
- GitHub repo `ldsampaio/sgrf`, branch `main` — protection payload: `required_status_checks { strict:false, contexts:[backend, frontend] }`, `enforce_admins:true`, `required_pull_request_reviews:null`, `restrictions:null`
- `AGENTS.md` — the human-facing regression-gate record (strict:false + revisit note, enforce_admins:true, GH006 recovery path, exact verify commands)

</code_context>

<specifics>
## Specific Ideas

- Workflow name `CI`; job / required-check contexts exactly `backend` and `frontend` (lowercase).
- Break target verbatim: `backend/tests/unit.test.js` line 8, `expect(normalizeEmail('A@Utfpr.Edu.Br ')).toBe('WRONG')` for the red commit.
- Evidence verbatim: `gh run list --limit 2` showing `backend: failure` on the break, then green after `git revert HEAD` + push; protection verified via `gh api repos/ldsampaio/sgrf/branches/main/protection --jq '.required_status_checks.contexts'` → `["backend","frontend"]` plus `strict`/`enforce_admins` readback.
- No specific `AGENTS.md` wording locked — keep the repo's existing Portuguese voice and exact commands.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 1-CI Regression Gate*
*Context gathered: 2026-09-23*
