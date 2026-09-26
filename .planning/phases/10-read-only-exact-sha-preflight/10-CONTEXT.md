# Phase 10: Read-Only Exact-SHA Preflight - Context

**Gathered:** 2026-09-25
**Status:** Ready for planning

<domain>
## Phase Boundary

Phase 10 wires `gh-client.js` — today a stub where all five read methods throw "not wired, Phase 10" — so `verify` reports the authoritative GitHub state for a pinned repository, version, and full target SHA, read-only, with `mutations: 0`. It does not mutate, reconcile, retry, or recover. Recovery is Phase 11; CI-race rehearsal is Phase 12; the live v0.1.1 publish is Phase 13.

</domain>

<decisions>
## Implementation Decisions

### CI run discovery (SAFE-03)

- **D-10:** The two canonical runs are discovered by property, not operator input: `event=push`, `headSha == expectedSha`, branch in `{main, version-tag}`. No new CLI flag; `requiredRunIds` becomes a *derived* result of the discovery, not an entry. Simplest: the operator never handles an ID.
- **D-11:** "Última verde" per branch+SHA: the most recent run on that branch+SHA must be green. Monotonic — a green re-run recovers, a red re-run blocks, regardless of earlier greens. The rule makes the verdict a function of the set, so re-running `verify` gives the same answer (verdict idempotence), and Phase 12's race rehearsal stays coherent. The historical red on another SHA is ignored by construction.
- **D-11b (consequence):** the classifier must read `failedRunIds` from `ci.records`, not from a top-level `snapshot.failedRunIds`. Removes the stray key; the discovery fill becomes the single source of truth.

### G-1 / failedRunIds source

- **D-12:** `failedRunIds` is derived from `ci.records` inside the CI read: the IDs of non-green runs on the target branch+SHA. The classifier already validates and honors the field — it only needs filling. No new declared read (09-06 exact-surface check stays green).
- **D-12a (consequence to track):** the 09 fixture suite pins the fail-open as expected (`evidence.test.js` MISSING, `safe04.test.js`). Those tests must flip to expect `FAILED` in the same change that wires the source. That redness is the correct signal.

### 404 vs permission ambiguity (SAFE-01)

- **D-13:** Verified live: repo is public (`private=false`), single account (`ldsampaio`), token has `admin` scope. A 404 on any object means *absence* — no repo probe, no permission disambiguation step. "Absent vs insufficient permission" is out of scope; a real permission failure surfaces as a distinct HTTP error the tool already recuses (transport family).
- **D-13b:** the `gh-client.js` stubs keep their "not wired" path unchanged — 404→MISSING stays the only absence path, and any transport error stays a recusa.

### Verify coexistence (09 fixtures vs 10 live)

- **D-14:** Single `verify` command. `ghClient` (real) is the default; `makeFakeClient(snapshot)` activates only with `--fixture`. The operator's recovery command is the same surface the suite proved. The CLI path is one; the client injected is the switch.
- **D-14b:** the `--fixture` flag is the *only* way fixtures enter production flow. No implicit fallback to fake.

### Claude's discretion

- Internal module split inside `tools/release-close/` (e.g., whether the discovery logic lives in `classify.js` or a new `discover.js`) — researcher/planner decide, guided by D-10/D-11.
- Exact `--json` field names for the discovered runs and the `failedRunIds` derivation — planner chooses, keeping PT-BR reasons / EN codes.
- Whether the re-run policy needs an explicit `--policy latest-green` flag now or can stay implicit — Claude to propose in the plan, with the monotonicity argument as the default.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Milestone & phase contract

- `.planning/ROADMAP.md` — Phase 10 goal + success criteria (REL-01, SAFE-01, SAFE-03), milestone constraints; the Phase 10 entry that inherits the G-1 gate from Phase 9
- `.planning/REQUIREMENTS.md` — REL-01 (read-only verify), SAFE-01 (reject invalid version/repo/tag/SHA/credential/permission), SAFE-03 (canonical CI on exact SHA); traceability table maps all three to Phase 10
- `.planning/PROJECT.md` — Constraints (Express+Prisma+Vue stay; `gh` CLI/API surface; tag preserved; operator-invoked idempotent automation) and Key Decisions (tag immutability, Release+Milestone both required, green-checks + exact-SHA agreement)

### Prior phase decisions & verified gaps

- `.planning/phases/09-release-close-contract-fixtures/09-CONTEXT.md` — Phase 9 decisions D-01..D-16 that Phase 10 inherits (D-04 `gh` only, D-06 `node:test`, D-08 determinism, D-12 PT-BR/EN, D-16 `mutations: 0`)
- `.planning/phases/09-release-close-contract-fixtures/09-UAT.md` — 29/29, gap G-1 deferred (status `deferred`, `deferred_to: phase-10`), G-3 fixed (`b196ee0`)
- `.planning/phases/09-release-close-contract-fixtures/COVERAGE.md` — G-1 recorded as Phase 10 gate (the classifier honors `failedRunIds`, two suites pin the fail-open as expectation)
- `.planning/phases/09-release-close-contract-fixtures/09-VERIFICATION.md` — G-1/G-3 verified by execution 2026-09-25

### Existing code patterns & constraints

- `tools/release-close/gh-client.js` — the five stub reads to wire; each throws "not wired, Phase 10" — the surface that changes in this phase, and the exact-surface check that 09-06 locks
- `tools/release-close/client.js` — `assertClientShape` contract (5 reads); the injected client is the switch between fake and real
- `tools/release-close/classify.js` — decision contract: `requiredRunIds` of exactly two integers, `failedRunIds` validation, CI allowlist; the classifier already honors what Phase 10 must fill
- `tools/release-close/release-close.js` — CLI entry, `buildCloseEvidence`, `lerEvidencia`, fail-closed evidence reads
- `tools/release-close/fake-client.js` — programmable fake with scripted sequences (timeouts, lost responses, 409/422/429, server failures) — the fixture client `--fixture` activates
- `.github/workflows/ci.yml` — the CI authority: jobs `backend` (Node 22) + `frontend` (Node 22); note the file is new as of 2026-09-25 (codebase maps are stale on this point)

### Codebase maps (stale — refresh after Phase 10)

- `.planning/codebase/STACK.md` — says "no `.github/`, no CI"; incorrect since yesterday; refresh after Phase 10
- `.planning/codebase/INTEGRATIONS.md` — same staleness; the `gh` integration lives entirely in `gh-client.js`, not in backend

### Real baseline verified live (2026-09-25)

- Tag object `0a68d6f0c55e7be07d13a0bbc4ed36d4af772630`, peeled commit `10c62ac85fd3ab275b8926c89f5f34ba4116e2cf`
- Main head same SHA; Release 404; zero milestones
- Runs `36095855139` (main) and `36095872529` (v0.1.1), both `success`, `completed`, `attempt:1`
- Historical red run `36095528423` on another SHA — ignored by construction
- Token scopes: `gist, read:org, repo, workflow`; repo public, `private=false`, `admin:true`

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable assets

- `gh-client.js` stub — 5 methods, all throw "not wired, Phase 10"; the exact surface to change, already shape-checked by `assertClientShape`
- `client.js` — `assertClientShape` enforces the 5-read contract; the injected client is the only switch between fake/real
- `fake-client.js` — programmable fake with scripted sequences (timeouts, lost responses, 409/422/429, server failures); already exercised by 09's 214-suite
- Fixtures pattern — versioned JSON under `tools/release-close/fixtures/`; Phase 10's live snapshots can reuse the same shape

### Established patterns

- ESM tool, zero deps, `node:test` — Phase 10 inherits; no npm-package, no workspace, no new dependency
- PT-BR reasons, EN machine codes; `mutations: 0` as executable proof
- Fail-closed on evidence reads; `404 → [] → MISSING` is the only absence path; everything else recusa

### Integration points

- `gh` CLI subprocess only — no direct HTTPS client, no `GH_TOKEN` plumbing in this phase
- GitHub REST endpoints the stub names: `getTagRef`, `getTagObject`, `getBranchHead`, `getReleaseByTag`, `listMilestones`; Phase 10 adds the CI run list (same subprocess, new method)
- `ci.yml` jobs `backend`/`frontend` are the canonical checks Phase 10 must select

### Stale-map flags

- `STACK.md` and `INTEGRATIONS.md` claim "no CI, no `.github/`" — `ci.yml` exists since 2026-09-25; maps need refresh after Phase 10
- Dev machine runs Node v26.7.0; CI pins Node 22; the tool targets Node 22 per roadmap — verify at plan time

</code_context>

<specifics>
## Specific Ideas

- The operator never sees a run ID: discovery by property means `requiredRunIds` is a derived field, not an input. If the discoverable set doesn't contain exactly one green per required branch, the verdict is FAILURE with the family naming the gap — no partial green.
- The historical red on `826953c209a6` (another SHA) stays in the record as "ignored" by construction; the tool's vocabulary should name it, not hide it.
- Idempotence of CI itself was considered and rejected: `on: [push, pull_request]` creates a new run per push forever. Idempotence lives in the verdict (set function), which is what the phase delivers and Phase 12 rehearses.

</specifics>

<deferred>
## Deferred Ideas

- "CI idempotence" as a property of the *event* — rejected; impossible under `on: [push, pull_request]`. The monotonic verdict rule (D-11) is the right place for this guarantee.
- Making the 404/permission distinction explicit with a repo probe — rejected for scope; repo is public, single account, verified. Reopen if the repo ever goes private or gains additional accounts.
- Whether Phase 10 should also verify the tag object's peeled commit matches main (the full `git rev-parse` path vs `gh` peel) — the 09 eligibility contract already covers peel; Phase 10 can inherit or extend at plan time.

</deferred>

---

*Phase: 10-Read-Only Exact-SHA Preflight*
*Context gathered: 2026-09-25*
