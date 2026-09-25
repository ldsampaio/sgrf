# Phase 9: Release-Close Contract & Fixtures - Context

**Gathered:** 2026-09-25
**Status:** Ready for planning

## Phase Boundary

Phase 9 delivers the shared deterministic, fail-closed release-close contract before any remote client or mutation can exist: a checked-in Node 22 ESM operator tool with `verify` / `plan` / `apply` modes through the existing `gh` authentication surface, plus the pure eligibility/ref/CI decision contract proven by deterministic `node:test` fixtures and mocked API scenarios over missing, partial, duplicate, conflicting, failed, and concurrent states. No live GitHub mutation happens here — all writes are rehearsed against fakes/fixtures only. Real preflight (Phase 10), reconciliation (Phase 11), CI-race/runbook (Phase 12), and the live v0.1.1 recovery (Phase 13) are explicitly out of scope.

## Implementation Decisions

### Tool location & invocation

- **D-01:** Tool lives in `tools/release-close/` (new top-level directory), invoked directly as `node tools/release-close/release-close.js <verify|plan|apply> ...` with `--help` — **Reversibility:** costly — Fase 12 runbook, docs, and any CI references will quote this path; moving it later means updating the operator procedure
- **D-02:** The tool directory carries its own `package.json` with `"type": "module"` and zero `dependencies` — keeps the ESM tool isolated from the CommonJS backend (`backend/package.json` is `type: commonjs`) with no new npm package, workspace, or hosted publisher
- **D-03:** No npm-script wrapper as the primary contract — the documented invocation is the direct `node` path so the contract is explicit and versionable
- **D-04:** The tool talks to GitHub exclusively by shelling out to the `gh` CLI subprocess, reusing the operator's existing login/token/permissions — no direct HTTPS client, no new secret handling, no `GH_TOKEN` plumbing in this phase

### Fixtures & mocked scenarios

- **D-05:** Scenario fixtures are versioned JSON files under `tools/release-close/fixtures/` (one per state: missing, partial, duplicate, conflicting, failed, concurrent), not inline literals — **Reversibility:** costly — downstream phases and tests will import these files by path; restructuring means rewriting the fixture suite
- **D-06:** The tool's suite runs on `node:test` (`node --test`), never on the backend's vitest — zero dependencies, runs on any Node 22 checkout, per the roadmap success criteria
- **D-07:** GitHub API is mocked with a programmable in-memory fake client (scripted response sequences: timeouts, lost responses, `409`/`422`/`429`, server failures) rather than per-function stubs, so retry / re-read / ordering behavior is observable without network
- **D-08:** Determinism rule: everything frozen — fixed timestamps, full SHAs, canned run/job/check IDs in fixtures; no real clock or network in the suite

### Pure decision contract & state taxonomy

- **D-09:** The pure contract is split into focused pure functions (ref eligibility check, state classification — not one monolithic evaluator), each independently testable — **Reversibility:** costly — the module split becomes the planner's file structure and the tests' import surface
- **D-10:** The six states are represented as stable string codes (`MISSING`, `PARTIAL`, `DUPLICATE`, `CONFLICTING`, `FAILED`, `CONCURRENT`) carried in the decision object and referenced by output and tests — never loose booleans
- **D-11:** Domain mismatches (SHA divergence, absent tag, failed checks) are returned as data in the decision object (`{ eligible, reason, writeAction: null }` shape family); `throw` is reserved for invalid inputs only — keeps the tool fail-closed without accidental try/catch swallowing
- **D-12:** Human-facing reasons in PT-BR (matching repo convention: tests and controller errors are Portuguese); machine codes in EN (`MISSING`, `SAFE-02`, …) for stability and runbook reference

### verify / plan / apply UX

- **D-13:** `verify` and `plan` print human-readable text by default with a `--json` flag for machine/runbook evidence (the full structured-evidence shape of OPS-03 lands in Phase 12; Phase 9 only fixes text-default + `--json` availability)
- **D-14:** `apply` requires BOTH a `--yes` flag AND an interactive TTY confirmation prompt with the plan visible; non-TTY without `--yes` refuses — two independent locks, so a stray `--yes` in a script can never approve an unseen plan — **Reversibility:** costly — Phase 13's live procedure depends on this double-lock; weakening it later invalidates the safety case
- **D-15:** The displayed plan lists ordered steps (what will be created vs. adopted, in which order, against which SHAs/IDs) — the operator reviews exactly what `apply` would do, previewing the Phase 11 recovery order
- **D-16:** Every `verify`/`plan` output carries a `mutations: 0` counter, and the fixture suite asserts zero writes escaped (fails if any write path executes) — the no-mutation guarantee is executable proof, not a code convention

### the agent's Discretion

- Internal module/file split inside `tools/release-close/` (e.g. `eligibility.js`, `classify.js`, `fake-client.js`, CLI arg parsing style), exact `--json` field names beyond `mutations`, exit-code numbering, and fixture JSON schema details — researcher/planner decide, guided by the decisions above
- Whether the fake client also records a call log for ordering assertions (recommended) vs. state-only — planner's choice

## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Milestone & phase contract

- `.planning/ROADMAP.md` — Phase 9 goal + 4 success criteria (Node 22 ESM tool, no-mutation proof, `node:test` fixtures, pure tag-eligibility contract) and Milestone Constraints (immutable tag, no writes before Phase 13, CI authority, app/DB/Docker unchanged)
- `.planning/REQUIREMENTS.md` — OPS-01 (tool modes via `gh` auth, no new package), OPS-02 (`node:test` fixtures + mocked scenarios), SAFE-02 (peeled tag == remote `main` == full target SHA, no ref-write path), SAFE-04 (`verify`/`plan` mutation-free, `apply` gated); traceability table maps all four to Phase 9
- `.planning/PROJECT.md` — Constraints (Express+Prisma+Vue stay; `gh` CLI/API surface; tag preserved; operator-invoked idempotent automation) and Key Decisions (tag immutability, Release+Milestone both required, green-checks + exact-SHA agreement)

### Existing-code patterns & constraints

- `.planning/codebase/STACK.md` — backend is CommonJS (`type: commonjs`), no workspaces, no lint/typecheck; verification commands are `npx vitest run` + `npm run build` (do not invent others)
- `.planning/codebase/ARCHITECTURE.md` — idempotent-command precedent (`closeVoting`, `mark-spent`), fail-open audit (contrast: release tool is fail-closed), module systems section (CJS backend vs. ESM tool friction)
- `.planning/codebase/TESTING.md` — backend tests use ESM imports, Portuguese `it` names, inline literals, zero mocking precedent; new `fixtures/` + `node:test` convention starts here
- `.github/workflows/ci.yml` — the regression authority: `backend` (`npx vitest run`, Node 22, Postgres service) + `frontend` (`npm run build`) job names that later phases' CI checks refer to
- `backend/package.json` — proves the constraints: `type: commonjs`, no workspaces, scripts limited to dev/start/migrate/seed/test

## Existing Code Insights

### Reusable Assets

- `backend/src/services/votingService.js` (`tally`, `closeVoting`) — precedent for small pure domain functions + idempotent commands; model the pure eligibility/classify functions on this shape
- `backend/src/config/logger.js` (pino redaction of cookie/password/token) — the secret-hygiene pattern the tool's output must follow (never print auth headers or tokens)
- `backend/tests/*.test.js` — Portuguese test-name convention (`'empate detectado'`) to mirror in the `node:test` suite
- `start-dev.sh` / `backend/docker-entrypoint.sh` — operator-facing script precedent (fail-fast, explicit steps)

### Established Patterns

- Money-as-cents, UUID strings, no raw SQL — not directly used by the tool, but the planner must not introduce new backend conventions while building it
- `Object.assign(new Error(...), { status })` domain-error style in backend services — explicitly NOT followed here (D-11: return objects, don't throw, for eligibility decisions)
- No `fixtures/`, `__mocks__/`, or `vitest.config.*` anywhere — the `tools/release-close/fixtures/` + `node:test` layout is a new convention owned by this phase
- Two independent npm packages, no workspaces — the tool's zero-dependency `package.json` preserves this invariant

### Integration Points

- `gh` CLI subprocess boundary — the single seam between the pure contract (this phase) and the real GitHub client (Phase 10+); design the client interface now so Phase 10 swaps fake → `gh` without touching pure logic
- `.github/workflows/ci.yml` job names (`backend`, `frontend`, Node 22) — canonical check names the contract will reference from Phase 10 on
- Live v0.1.1 baseline (tag object `0a68d6f0c55e7be07d13a0bbc4ed36d4af772630`, commit `10c62ac85fd3ab275b8926c89f5f34ba4116e2cf`, green runs `36095855139` + `36095872529`) — reference fixture data, not live reads, in this phase

## Specific Ideas

- Live v0.1.1 baseline values above should become the canonical "happy-path" reference fixture (peeled == main == expected SHA, green runs, missing Release/Milestone) — grounds the contract in real evidence without network access
- Plan-display shape should preview the Phase 11 recovery order (Release draft → readback → publish → readback → Milestone open → readback → close → final readback) so the UX contract survives into reconciliation
- No "I want it like X" external references were given — standard CLI conventions (`--help`, `--json`, `--yes`) apply

## Deferred Ideas

None — discussion stayed within phase scope.

---

*Phase: 9-release-close-contract-fixtures*
*Context gathered: 2026-09-25*
