---
phase: 09-release-close-contract-fixtures
verified: 2026-09-25T15:04:45Z
status: gaps_found
score: 6/13 must-haves verified
covered_files:
  - .github/workflows/ci.yml
  - .planning/REQUIREMENTS.md
  - .planning/ROADMAP.md
  - .planning/phases/09-release-close-contract-fixtures/09-01-PLAN.md
  - .planning/phases/09-release-close-contract-fixtures/09-01-SUMMARY.md
  - .planning/phases/09-release-close-contract-fixtures/09-02-PLAN.md
  - .planning/phases/09-release-close-contract-fixtures/09-02-SUMMARY.md
  - .planning/phases/09-release-close-contract-fixtures/09-03-PLAN.md
  - .planning/phases/09-release-close-contract-fixtures/09-03-SUMMARY.md
  - .planning/phases/09-release-close-contract-fixtures/09-CONTEXT.md
  - .planning/phases/09-release-close-contract-fixtures/09-DISCUSSION-LOG.md
  - .planning/phases/09-release-close-contract-fixtures/09-PATTERNS.md
  - .planning/phases/09-release-close-contract-fixtures/09-RESEARCH.md
  - .planning/phases/09-release-close-contract-fixtures/09-REVIEW.md
  - .planning/phases/09-release-close-contract-fixtures/09-SECURITY.md
  - .planning/phases/09-release-close-contract-fixtures/09-VALIDATION.md
  - .planning/phases/09-release-close-contract-fixtures/COVERAGE.md
  - tools/release-close/apply-gate.js
  - tools/release-close/classify.js
  - tools/release-close/classify.test.js
  - tools/release-close/client.js
  - tools/release-close/eligibility.js
  - tools/release-close/eligibility.test.js
  - tools/release-close/fake-client.js
  - tools/release-close/fixtures/concurrent.json
  - tools/release-close/fixtures/conflicting.json
  - tools/release-close/fixtures/duplicate.json
  - tools/release-close/fixtures/failed.json
  - tools/release-close/fixtures/missing.json
  - tools/release-close/fixtures/partial.json
  - tools/release-close/fixtures/reference.json
  - tools/release-close/gh-client.js
  - tools/release-close/nowrite.test.js
  - tools/release-close/package.json
  - tools/release-close/release-close.js
  - tools/release-close/safe04.test.js
covered_digest: "v1:sha256:36ebf3d3cf5d6e8a76a03e2156b87db3db18990d43f5728f60272c58ccd5e2a3"
behavior_unverified: 0
overrides_applied: 0
gaps:
  - truth: "The eligibility contract accepts only an annotated tag whose second hop is a commit, validates the tag identity, and requires the peeled commit to equal the full expected SHA and remote main."
    status: failed
    reason: "The function checks the first-hop type but accepts a tree peel, a ref for another tag, a mismatched tag-object SHA, and an abbreviated tag-object SHA as ELIGIBLE."
    artifacts:
      - path: tools/release-close/eligibility.js
        issue: "Lines 47-68 never require tagObject.data.object.type === 'commit', never compare tagObject.data.sha with the first-hop object SHA, never validate ref.data.ref, and never validate the first-hop SHA shape."
      - path: tools/release-close/eligibility.test.js
        issue: "The active tests cover the happy path, lightweight first hop, and simple equality divergence, but not non-commit peels or identity mismatches."
    missing:
      - "Validate the exact requested ref identity and full tag-object SHA."
      - "Require the second-hop object to be a commit and require the tag-object identity to match the ref."
      - "Add negative tests for tree/blob/tag peels, abbreviated tag SHA, mismatched object identity, and another ref."
  - truth: "Only explicit, exact-target green CI evidence can make a plan or apply eligible."
    status: failed
    reason: "The classifier treats missing, cancelled, pending, timed-out, malformed, and unknown checks as non-red; the CLI then synthesizes checks.state = 'success' from bare run IDs, so a cancelled or malformed snapshot can become MISSING and applyLiberado = true."
    artifacts:
      - path: tools/release-close/classify.js
        issue: "Lines 41-49 recognize only the literal failure state; there is no allowlist for required backend/frontend success records, exact target SHA, or both required run types."
      - path: tools/release-close/release-close.js
        issue: "Lines 158-170 set checks to a fabricated success object and discard the fixture's real check evidence; lines 209-227 set applyLiberado from eligibility plus a blocking-code list that does not include MISSING."
      - path: .github/workflows/ci.yml
        issue: "The canonical jobs are backend and frontend, but the tool has no job/check/status/SHA evidence model and the fixtures contain only numeric run IDs."
    missing:
      - "Represent canonical backend/frontend check evidence, run/event SHA, status/conclusion, and required-run identity in the pure contract."
      - "Use an explicit success allowlist; reject absent, pending, cancelled, timed-out, contradictory, malformed, wrong-run, and wrong-SHA evidence as blocked."
      - "Pass the actual evidence into buildClosePlan and prove a negative CI case forces applyLiberado = false."
  - truth: "Production reconciliation is target-scoped and preserves all matching Release and Milestone evidence."
    status: failed
    reason: "The production decision path calls only the three tag/main reads, sets releases to an empty array, and selects only the first milestone. Duplicate and conflicting fixtures are therefore reduced to PARTIAL when normalized through the CLI-shaped path, while unrelated releases can be classified as a conflict for the requested target."
    artifacts:
      - path: tools/release-close/release-close.js
        issue: "Lines 274-283 construct the fake client and call checkTagEligibility only; no getReleaseByTag or listMilestones call is made. Lines 161-167 discard duplicate releases and retain only milestones[0]."
      - path: tools/release-close/classify.js
        issue: "Lines 59-100 compare every release in snapshot.releases and accept no target version parameter, so releases for other tags participate in duplicate/conflict decisions."
      - path: tools/release-close/safe04.test.js
        issue: "Lines 111-129 convert array releases to releases[0] and lines 175-186 assert only that a code is a string, so the claimed all-fixture production proof does not exercise duplicate/conflict states."
    missing:
      - "Route all five reads through the production decision path and retain normalized arrays/IDs."
      - "Filter candidates by the requested version/tag and expected target before duplicate/conflict classification."
      - "Test the production adapter with unrelated releases, multiple matching milestones, duplicates, and conflicts."
  - truth: "The zero-mutation counter observes the actual side-effect boundary and the suite fails if a write escapes."
    status: failed
    reason: "writes is an array with no producer connected to the capability surface, assertClientShape permits extra callable methods, and all CLI/plan renderers emit literal 0. An untracked createRelease method can run successfully while fake.mutations remains 0 and the existing static test stays green."
    artifacts:
      - path: tools/release-close/client.js
        issue: "Lines 30-39 require five methods but do not reject additional callable capabilities."
      - path: tools/release-close/fake-client.js
        issue: "Lines 75-107 initialize writes and derive mutations from its length, but no side-effect boundary can push to it."
      - path: tools/release-close/release-close.js
        issue: "Lines 221-227, 250, and 264-269 hard-code mutations: 0 instead of propagating a measured counter."
      - path: tools/release-close/nowrite.test.js
        issue: "Lines 86-114 scan a finite text denylist; this is not a capability-level canary and can miss argv-array or differently named write capabilities."
    missing:
      - "Enforce an exact read-only client capability or provide a real side-effect trap that every future write method must use."
      - "Propagate the measured counter from the client through verify/plan/apply decisions and renderers."
      - "Add a deliberately injected forbidden-write canary and prove the test fails before accepting mutations: 0."
  - truth: "Apply requires a human-visible ordered plan and reviewed Release/Milestone content before confirmation."
    status: failed
    reason: "The normal TTY path prints the eight steps before the prompt, but output is written only to redirectable stdout and there is no output-TTY lock. A pseudo-TTY with stdout redirected to a file still accepted sim after confirmation. The plan has no Release notes, Milestone completion record, or content digest, and the gate permits a no-op output sink."
    artifacts:
      - path: tools/release-close/apply-gate.js
        issue: "Lines 33-49 default write to a no-op and check only stdin isTTY; there is no outputIsTTY or reviewed-content lock."
      - path: tools/release-close/release-close.js
        issue: "Lines 373-379 pass io.stdin.isTTY and io.stdout.write but never check io.stdout.isTTY. buildClosePlan lines 181-227 emits operation metadata only, with no reviewed content payload or digest."
      - path: tools/release-close/safe04.test.js
        issue: "The confirmation test calls confirmApply without a write sink (lines 285-293), so it does not prove human visibility; no output-TTY or content-digest negative case exists."
    missing:
      - "Require a live output/control terminal, or render to a non-redirectable controlling terminal."
      - "Bind immutable reviewed Release/Milestone content or a canonical digest to the plan and confirmation gate."
      - "Add tests for stdin TTY + stdout redirected, missing reviewed content, and a missing/non-function output sink."
  - truth: "Scripted failure scenarios exercise the production retry/re-read contract for every required outcome."
    status: failed
    reason: "The fake can produce timeout, lost-response, 409, 422, 429, and 5xx outcomes, but the active tests only exercise 409 then 429 then data by calling getTagRef manually. No production classifier/CLI path consumes a failure plan or proves re-read ordering after a failed operation."
    artifacts:
      - path: tools/release-close/fake-client.js
        issue: "The scripted queue exists at lines 47-101, but it is only a test double and is not connected to reconciliation logic."
      - path: tools/release-close/classify.test.js
        issue: "Lines 44-58 cover only status-409, status-429, and subsequent data; no timeout, lost-response, 422, 5xx, or production re-read case is present."
    missing:
      - "Connect scripted failures to the state/reconciliation path and assert the natural-identity re-read after each failure family."
      - "Add active tests for timeout, lost-response, 409, 422, 429, and 5xx outcomes and assert no blind write action."
human_verification: []
---

# Phase 9: Release-Close Contract & Fixtures Verification Report

**Phase Goal:** Operators and the implementer share one deterministic, fail-closed release-close contract before any remote client or mutation can exist.

**Verified:** 2026-09-25T15:04:45Z  
**Status:** `gaps_found`  
**Verification mode:** Initial verification (no prior `09-VERIFICATION.md`; re-verification metadata omitted)  
**Verifier stance:** Summary claims were treated as leads only. The conclusion is based on source inspection, local execution, fixture-level adversarial probes, and a scoped test run. No GitHub/network mutation was performed.

## Goal Achievement

The implementation is substantive and the scoped suite is green, but the phase goal is not achieved. Several safety properties are represented in comments/tests while the executable path still permits unsafe decisions. The most important failures are not deferred transport wiring: they are defects in the Phase 9 contract itself.

### Observable Truths

The 13 rows below are the deduplicated merge of the four ROADMAP success criteria, all PLAN frontmatter truths, the explicit CI/target-scope focus in the phase context, and the PLAN prohibitions that form observable negative checks. Duplicate plan/roadmap wording is counted once.

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Checked-in Node 22 ESM tool exposes `verify`, `plan`, and `apply`, has no added dependency/workspace/hosted publisher, and has a fail-closed gh seam. | ✓ VERIFIED | `tools/release-close/package.json:1-4` is private ESM with no `dependencies` or `scripts`; `verify --help` returned 0 and printed all three verbs; `gh-client.js:12-50` throws for every method. Live transport is intentionally absent in this phase, so this is a contract-surface verification, not a live-auth test. |
| 2 | Eligibility accepts only an annotated tag whose second hop is a commit, with valid ref/object identity, and peeled commit equal to the full expected SHA and remote `main`. | ✗ FAILED | `eligibility.js:47-68` checks only first-hop `type: tag` and a SHA string. A direct probe with `object.type: tree`, a different ref, mismatched tag-object identity, and an abbreviated tag SHA all returned `ELIGIBLE`. |
| 3 | Scoped `node:test` execution is clean, deterministic, and requires no network or database. | ✓ VERIFIED | `node --test tools/release-close/` completed with 57 passed, 0 failed; implementation imports no network/subprocess modules and the package has no dependencies. The tests spawn only local Node CLI processes for smoke/idempotency checks. |
| 4 | The pure classifier maps the six supplied raw fixtures one-to-one to `MISSING`, `PARTIAL`, `DUPLICATE`, `CONFLICTING`, `FAILED`, and `CONCURRENT` with null write action. | ✓ VERIFIED | `classify.test.js:16-35` asserts the exact table and the direct classifier probe reproduced it. This is a raw-fixture claim only; production adapter coverage is a separate failed truth below. |
| 5 | Scripted timeout/lost/409/422/429/5xx scenarios are exercised through the production mocked API path with observable re-read ordering. | ✗ FAILED | `fake-client.js:27-101` supports the outcome vocabulary, but `classify.test.js:44-58` only drives 409 → 429 → data manually. No production decision path consumes a failure plan or re-reads after timeout/lost/422/5xx. |
| 6 | Classification is target-scoped and the production adapter preserves all target Release/Milestone evidence. | ✗ FAILED | `release-close.js:274-283` calls only eligibility; `evidenceFromSnapshot` sets `releases: []` and takes `milestones[0]`. A normalized duplicate fixture becomes `PARTIAL`; an unrelated release pair becomes `CONFLICTING`. |
| 7 | Current non-test source has no ref-write/destructive tag path, and the gh seam is fail-closed. | ✓ VERIFIED | Static source scan found no write methods/HTTP verbs/ref mutation paths; `gh-client.js` throws on all five methods; `nowrite.test.js:136-145` exercises every stub method. This verifies current absence, not future-proof capability enforcement, which fails in row 8. |
| 8 | `verify`/`plan` emit a real measured zero-mutation result and a canary write makes the suite fail. | ✗ FAILED | `client.js:30-39` allows extra methods; `fake-client.js:75-107` has no connected write boundary; `release-close.js:226,250,264-269` hard-code zero. A probe added and called `fake.createRelease()`; it printed `WRITE CALLED` while `mutations` and `writes.length` stayed 0. |
| 9 | `apply` displays the complete ordered plan before asking for confirmation. | ✗ FAILED | The normal pty path passes, but `release-close.js:373-379` checks only stdin TTY. In a pty with stdout redirected to a file, the plan was written to the file and the gate still accepted `sim`; stderr explicitly said confirmation was accepted. |
| 10 | `apply` requires reviewed Release/Milestone content, a human-visible plan, `--yes`, a live TTY, and typed `sim`. | ✗ FAILED | `plan --json` has no notes, completion record, or content digest; `confirmApply` has no content lock and defaults `write` to a no-op. The double-lock test passes only in the narrow, visible-output case. |
| 11 | Implementation and captured CLI output contain no credential/auth material. | ✓ VERIFIED | `safe04.test.js:445-512` passed its source/output scans; implementation source contains no credential environment access and captured verify/plan/apply output contained no banned forms. |
| 12 | Only exact-target green `backend`/`frontend` evidence on both required runs can unlock plan/apply. | ✗ FAILED | `classify.js:41-49` recognizes only literal `failure`; `release-close.js:167` synthesizes `state: success` from run IDs. Direct probes for cancelled, pending, timed-out, and missing checks returned `MISSING`; the `applyLiberado` formula then returned true. The tool has no check/job/SHA evidence model. |
| 13 | The production `verify` path has no network, subprocess, or credential read. | ✓ VERIFIED | No production implementation import/grep hit for network, `child_process`, `fetch`, or credential env reads; `gh-client.js` is only a throwing seam. `eligibility.test.js`/`safe04.test.js` spawn local test CLI processes, but the production `verify` implementation does not. |

**Score:** **6/13** unique must-haves verified. No truth is being silently counted as behavior-unverified: the behavior-dependent safety truths were exercised with local adversarial probes and failed deterministically.

**Phase-level conclusion:** The phase must not proceed as “complete.” The passing 57-test suite is necessary but not sufficient; the implementation fails the goal's fail-closed contract on strict peel validation, CI gating, target-scoped state reconciliation, real mutation accounting, and human-reviewed apply content/visibility.

## Required Artifacts

All declared files exist and contain real code/fixtures, but several are functionally hollow or behaviorally incorrect. `EXISTS + SUBSTANTIVE` is not treated as `VERIFIED` where the required behavior or data flow fails.

| Artifact | Expected | Status | Level 1 / 2 / 3 / 4 details |
|-----------|----------|--------|-------------------------------|
| `tools/release-close/package.json` | Standalone private ESM, zero dependencies | ✓ VERIFIED | Exists, valid JSON, `type: module`; no `dependencies` or `scripts`; no wiring needed. |
| `tools/release-close/client.js` | Five-read client contract | ⚠️ PARTIAL | Exists and is imported by fake/gh clients; shape checker validates required methods but not exact capability surface, so extra write methods are accepted. |
| `tools/release-close/fake-client.js` | Scripted reads, call log, real write trap | ⚠️ HOLLOW | Exists, imports the interface, and serves fixture data/call logs; `writes` has no connected producer, so the mutation proof is not at the side-effect boundary. |
| `tools/release-close/eligibility.js` | Strict two-hop annotated-tag decision | ✗ FAILED | Exists, substantive, imported by CLI/tests, and receives fake data; accepts non-commit/unproven object links and wrong identities. |
| `tools/release-close/release-close.js` | `verify`/`plan`/`apply` orchestration and output | ⚠️ HOLLOW | Exists, runs as the documented CLI, and imports the gate/pure functions; release/milestone reads are bypassed, CI is fabricated, and mutation values are literals. |
| `tools/release-close/fixtures/reference.json` | Frozen canonical baseline | ✓ VERIFIED | Exists, valid JSON, full SHAs/run IDs match the documented baseline, and is loaded by CLI/tests. |
| `tools/release-close/fixtures/missing.json` | Missing-state fixture | ✓ VERIFIED | Exists and raw classifier maps it to `MISSING`; target-scoped production normalization remains a separate failure. |
| `tools/release-close/fixtures/partial.json` | Partial-state fixture | ✓ VERIFIED | Exists and raw classifier maps it to `PARTIAL`. |
| `tools/release-close/fixtures/duplicate.json` | Duplicate-state fixture | ⚠️ HOLLOW | Exists and raw classifier maps it to `DUPLICATE`, but the production-shaped adapter drops all but the first release. |
| `tools/release-close/fixtures/conflicting.json` | Conflict-state fixture | ⚠️ HOLLOW | Exists and raw classifier maps it to `CONFLICTING`, but the production-shaped adapter drops all but the first release and does not target-filter. |
| `tools/release-close/fixtures/failed.json` | Failed-CI fixture | ⚠️ HOLLOW | Exists and only literal `failure` is recognized; the CLI does not pass its actual `checks` through and can synthesize success. |
| `tools/release-close/fixtures/concurrent.json` | Concurrent-close fixture | ✓ VERIFIED | Exists and two in-progress markers deterministically map to `CONCURRENT`. |
| `tools/release-close/classify.js` | Pure target-scoped state classifier | ✗ FAILED | Exists, substantive, standalone, and returns null write actions; CI allowlist, target scoping, and complete-state semantics are missing. |
| `tools/release-close/gh-client.js` | Fail-closed seam | ✓ VERIFIED | Exists, exports all five read methods, shape-checks, and every method throws naming Phase 10; intentionally not a live client. |
| `tools/release-close/classify.test.js` | Deterministic six-state/mock tests | ⚠️ INCOMPLETE | Active and discovered; raw mappings are strong, but failure coverage and production adapter coverage are insufficient. |
| `tools/release-close/nowrite.test.js` | Executable no-write proof | ✗ FAILED | Active static denylist test; it is not a capability-level canary and can be bypassed by a differently named/argv-array write path. |
| `tools/release-close/apply-gate.js` | Human-visible double-lock gate | ✗ FAILED | Exists, imported by CLI/tests, and checks flag/input TTY/answer; lacks output-TTY and reviewed-content locks and allows a no-op sink. |
| `tools/release-close/safe04.test.js` | SAFE-04 proof suite | ⚠️ INCOMPLETE | 25 active tests pass, but tests omit output-TTY redirection, content binding, real counter propagation, and untracked-write canary cases. |
| `.planning/phases/09-release-close-contract-fixtures/COVERAGE.md` | API coverage declaration | ✓ VERIFIED | Exists and accurately declares no live `gh api` integration in Phase 9; the production safety gaps are in the contract, not a missing live client. |

## Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `release-close.js` | `eligibility.js` + `fake-client.js` | imports and `decide()` | ⚠️ PARTIAL | `release-close.js:17-20,277-282` wires the three ref/head reads through the fake, but never invokes `getReleaseByTag` or `listMilestones`. |
| `eligibility.js` | decision contract | `checkTagEligibility()` | ✗ FAILED | Returns null write actions for many domain paths, but does not normalize transport/status failures and accepts invalid object shapes as eligible. |
| `classify.js` | eligibility module | independent import boundary | ✓ WIRED | `classify.js` has no eligibility import; the test at `classify.test.js:37-42` actively checks that separation. |
| `fake-client.js` | state classifier | scripted calls in tests | ⚠️ PARTIAL | Tests call fake methods manually; no production classifier/CLI path consumes failure queues or uses its call log for re-read decisions. |
| `release-close.js` | `apply-gate.js` | `confirmApply()` after plan rendering | ⚠️ PARTIAL | Call order exists at lines 360-379, but “rendered” means redirectable output and is not equivalent to human-visible output. |
| `safe04.test.js` | mutation and gate fences | assertions over fake/gate/CLI | ✗ FAILED | Green tests assert a literal/empty trap, not the actual capability boundary or output TTY/content conditions. |

The installed `gsd-tools verify artifacts`/`verify key-links` route returned zero parsed frontmatter items for these plans in this runtime; the manual level checks above were used instead rather than treating the empty query result as evidence.

## Data-Flow Trace (Level 4)

| Artifact | Data variable | Source | Produces real data? | Status |
|----------|---------------|--------|---------------------|--------|
| `eligibility.js` | tag ref, tag object, `main` head | `reference.json` → `makeFakeClient()` → three fake reads | Yes for the happy fixture, but malformed object identity can still be accepted | ⚠️ PARTIAL FLOW |
| `release-close.js` release/milestone evidence | `release`, `releases`, `milestone` | Raw fixture fields via `evidenceFromSnapshot()`; full client reads are not called | No for the production seam: arrays are discarded and only the first milestone survives | ✗ DISCONNECTED |
| `release-close.js` CI evidence | `checks`, `applyLiberado` | Hard-coded `{ state: 'success', runs: ... }` | No; no job/check/SHA/status evidence flows into the decision | ✗ DISCONNECTED |
| `release-close.js` mutation value | `mutations` | Literal `0` in plan/renderers; fake counter is not passed | No; untracked writes remain invisible | ✗ DISCONNECTED |
| `release-close.js` reviewed content | Release notes / Milestone record / digest | No source field exists | No; confirmation is not bound to reviewed content | ✗ DISCONNECTED |

This is the central stub pattern: files are present and outputs are produced, but the values that make the contract fail-closed do not flow from an authoritative source.

## Behavioral Spot-Checks

No live server, GitHub API, or network mutation was started. All commands below are local and non-mutating.

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Scoped Node suite | `node --test tools/release-close/` | 57 tests, 57 pass, 0 fail, exit 0 | ✓ PASS |
| CLI help/ESM invocation | `node tools/release-close/release-close.js verify --help` | Exit 0; usage includes `verify`, `plan`, `apply` | ✓ PASS |
| JSON output | `node tools/release-close/release-close.js verify --json; ... plan --json` | Both contain `mutations: 0`; this confirms output shape, not the counter boundary | ✓ PASS (insufficient for safety claim) |
| Piped apply refusal | `node tools/release-close/release-close.js apply --yes < /dev/null` | Exit 1; terminal-interactivity refusal; no prompt | ✓ PASS |
| Normal visible pty path | `script -qec 'node ... apply --yes'` with `sim` | Plan appeared before prompt; after confirmation Phase 9 failed closed | ✓ PASS (ordinary path only) |
| Human visibility under output redirection | pty stdin + `stdout > /tmp/...` + `sim` | Gate returned “Confirmação dupla aceita”; plan was only in redirected file | ✗ FAIL |
| Strict annotated peel | custom `checkTagEligibility` probe with tree peel / wrong ref / mismatched tag object | All four cases returned `ELIGIBLE` | ✗ FAIL |
| Non-green/malformed CI | custom `classifySnapshot` and `applyLiberado` probe | Cancelled/pending/timed-out/missing checks → `MISSING`; `applyLiberado: true` | ✗ FAIL |
| Target-scoped state | normalized duplicate/conflict probe and unrelated-tag probe | Duplicate/conflict became `PARTIAL` through production-shaped evidence; unrelated tags produced `CONFLICTING` | ✗ FAIL |
| Real mutation accounting | extend fake with `createRelease`, invoke it | `WRITE CALLED`; `mutations` remained 0 and writes length remained 0 | ✗ FAIL |
| CLI import safety | `await import('./tools/release-close/release-close.js')` | Import printed usage and terminated the host before `AFTER_IMPORT`; warning-level defect | ⚠️ FAIL (non-blocking follow-up) |
| Backend collateral | `cd backend && npx vitest run` | 6 files, 131 tests passed, exit 0 | ✓ PASS |
| Frontend collateral | `cd frontend && npm run build` | 107 modules transformed, build passed, exit 0 | ✓ PASS |

## Probe Execution

No conventional `scripts/*/tests/probe-*.sh` files exist, and neither PLAN nor SUMMARY declares a probe. This section is not applicable; no missing probe is being used to excuse a failure.

## Test Quality Audit

The test runner itself is healthy, but test quality does not establish all claimed safety properties.

| Test file | Linked requirement(s) | Active cases | Skipped | Circular generation | Strongest assertion level | Verdict |
|-----------|-----------------------|-------------:|--------:|-------------------|------------------------|---------|
| `eligibility.test.js` | SAFE-02, OPS-01 | 12 | 0 | None found; fixtures are static, not generated by the system | Value/behavioral | ⚠️ INSUFFICIENT — misses non-commit peel, object identity, and status families |
| `classify.test.js` | OPS-02 | 13 (six generated fixture cases plus direct checks) | 0 | None found | Value/behavioral | ⚠️ INSUFFICIENT — raw fixture mapping only; no production target/CI integration |
| `nowrite.test.js` | SAFE-02 | 7 | 0 | None found | Static presence/status | ✗ INSUFFICIENT — denylist scan is not a side-effect canary |
| `safe04.test.js` | SAFE-04, OPS-01 | 25 | 0 | None found | Behavioral for narrow gate cases | ⚠️ INSUFFICIENT — positive confirmation test omits a write sink; no output-TTY/content/untracked-write cases |
| **Total** | OPS-01/02, SAFE-02/04 | **57** | **0** | **0** | — | Green suite, incomplete contract proof |

- Disabled tests linked to requirements: **0**.
- Circular test generation: **0 detected**.
- Misleading/weak assertions: the all-fixture SAFE-04 test checks only that `classificacao.code` is a string, not the expected code, while `clientSnapshotFor` discards duplicate/conflict arrays. The positive `confirmApply` test passes without a `write` sink. These are why the test-green result is not sufficient.
- Expected-value provenance: fixture values are deterministic and manually frozen, but no live GitHub read is invoked in Phase 9. That is acceptable for the explicitly fixture-only scope, but it cannot prove the current remote baseline or exact CI state.

## Requirements Coverage

The plan frontmatter declares these IDs:

- `09-01-PLAN.md`: `OPS-01`, `SAFE-02`
- `09-02-PLAN.md`: `OPS-02`, `SAFE-02`
- `09-03-PLAN.md`: `SAFE-04`, `OPS-01`

`REQUIREMENTS.md` maps exactly these four unique IDs to Phase 9; no Phase 9 requirement is orphaned and no additional Phase 9 ID is unmapped. The actual traceability result is:

| Requirement | Source plan(s) | Description checked | Status | Evidence / blocking issue |
|-------------|----------------|--------------------|--------|--------------------------|
| `OPS-01` | 09-01, 09-03 | Checked-in Node 22 ESM tool with `verify`/`plan`/`apply`, existing gh auth surface, no new package/service | ⚠️ PHASE-SCOPED / NOT FULLY PROVEN | CLI surface, ESM manifest, and no-dependency property verified. `gh-client.js` is intentionally a throwing stub and production does not invoke a live gh client; that transport is explicitly reserved for Phase 10. The contract's safety behavior still fails under SAFE-04 gaps. |
| `OPS-02` | 09-02 | Pure reconciliation logic with deterministic fixtures and mocked missing/partial/duplicate/conflicting/failed/concurrent states | ✗ BLOCKED | Raw fixtures classify correctly, but production orchestration does not read the full release/milestone seam, loses duplicate/conflict evidence, and does not integrate scripted failures or target filtering. `REQUIREMENTS.md` still marks OPS-02 pending despite summary claims. |
| `SAFE-02` | 09-01, 09-02 | Existing annotated tag peel equals remote main and full target SHA; no ref-write path | ✗ BLOCKED | Non-commit/unproven object links are accepted; static no-write proof does not enforce the read-only capability boundary. |
| `SAFE-04` | 09-03 | `verify`/`plan` no mutations; `apply` requires reviewed content, displayed plan, and explicit confirmation | ✗ BLOCKED | Output redirection bypasses human visibility, reviewed content is absent, mutation count is literal, and non-green/malformed CI can be treated as apply-ready. |

**Coverage:** 1/4 requirements fully or phase-scoped satisfied; 3/4 blocked by executable contract defects. All four IDs are accounted for.

## Anti-Patterns Found

No unreferenced `TBD`, `FIXME`, or `XXX` debt markers were found in the changed implementation. The following are semantic anti-patterns discovered by reading the code and exercising the paths:

| File | Line(s) | Pattern | Severity | Impact |
|------|---------|---------|----------|--------|
| `tools/release-close/eligibility.js` | 47-68 | Incomplete annotated-tag validation | 🛑 Blocker | A tree/unproven tag object can be reported as eligible. |
| `tools/release-close/classify.js` | 41-49 | Failure-only CI detection | 🛑 Blocker | Pending, cancelled, timed-out, malformed, and unknown evidence is treated as non-failed. |
| `tools/release-close/release-close.js` | 158-170 | Fabricated success / first-milestone normalization | 🛑 Blocker | Real CI and full remote-object evidence never reach the classifier. |
| `tools/release-close/release-close.js` | 274-283 | Client seam bypass for two of five reads | 🛑 Blocker | Fake-to-real replacement is not wired into production state classification. |
| `tools/release-close/client.js` | 30-39 | Required-method-only shape check | 🛑 Blocker | Extra callable write capabilities are accepted without rejection or mutation tracking. |
| `tools/release-close/fake-client.js` | 75-107 | Inert `writes` array | 🛑 Blocker | The claimed zero-write trap cannot observe an escaped write. |
| `tools/release-close/release-close.js` | 221-227, 250, 264-269 | Literal `mutations: 0` | 🛑 Blocker | Output is tautologically green rather than measured. |
| `tools/release-close/apply-gate.js` | 33-49 | No-op default sink and no output-TTY lock | 🛑 Blocker | Confirmation can be accepted without a human-visible plan. |
| `tools/release-close/release-close.js` | 181-227 | Plan has no reviewed content/digest | 🛑 Blocker | Reusable apply gate is not bound to the facts an operator must review. |
| `tools/release-close/classify.js` | 59-100 | No target filtering | 🛑 Blocker | Unrelated repository history can block a valid target. |
| `tools/release-close/release-close.js` | 327-337 | Readline has no close/error settlement | ⚠️ Warning | EOF/Ctrl-D can leave apply pending rather than refusing cleanly. |
| `tools/release-close/release-close.js` | 418-419 | Unconditional top-level CLI execution | ⚠️ Warning | Importing the module terminates the host process. |
| `tools/release-close/nowrite.test.js` | 86-114 | Finite text denylist presented as capability proof | ⚠️ Warning | Future write paths can evade the static proof while tests remain green. |

`git diff --check` found trailing whitespace in the already-produced `09-REVIEW.md` documentation artifact, not in the implementation files; it is not treated as a debt-marker blocker.

## Decision Coverage

The configured decision-coverage gate was run independently:

```text
gsd-tools query check.decision-coverage-verify .planning/phases/09-release-close-contract-fixtures .planning/phases/09-release-close-contract-fixtures/09-CONTEXT.md
→ { skipped: false, blocking: false, total: 16, honored: 16, not_honored: [] }
```

All 16 trackable CONTEXT decisions are represented in shipped artifacts. This gate is advisory and does not override the failed behavioral truths.

## Deferred Items

None were moved to a later phase. ROADMAP phases 10–13 explicitly own live gh transport, exact live CI/preflight, reconciliation writes, and the live recovery. That boundary does **not** excuse the Phase 9 defects above: the pure contract is unsafe before any later client is wired, and a later client cannot repair an invalid predicate, an unmeasured mutation counter, or a reusable apply gate without reviewed content.

## Human Verification

None required for this verdict. This is an infrastructure/CLI contract phase; the relevant human-visible paths were exercised locally with a real pseudo-terminal, including redirected-output and EOF cases. No live GitHub or external service check was needed or permitted. The observed TTY failures are deterministic blockers, not unresolved human-only questions.

## Gaps Summary

The phase has **6 blocking gap groups**:

1. **Strict tag peel is not proven** — non-commit and identity-invalid objects are accepted as `ELIGIBLE`.
2. **CI evidence is not exact or fail-closed** — non-green/malformed evidence can become apply-ready.
3. **State classification is not target-scoped or fully wired** — production drops duplicate/conflict evidence and can classify unrelated releases.
4. **Zero mutation is a literal convention, not an enforced boundary** — untracked writes remain invisible.
5. **Apply does not require a human-visible reviewed plan/content** — redirected output bypasses visibility and no content digest is bound to confirmation.
6. **Scripted failure scenarios are not connected to production retry/re-read behavior** — the fake is tested manually, not through the decision path.

The 57/57 scoped test result and the backend/frontend collateral checks are real, but they do not clear these gaps. The phase goal is not achieved; the orchestrator should route these gaps into a focused repair plan before marking Phase 9 complete.

---

_Verified: 2026-09-25T15:04:45Z_  
_Verifier: the agent (gsd-verifier)_
