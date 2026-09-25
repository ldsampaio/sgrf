# Project Research Summary

**Project:** SGRF/SGRD — v0.1.2 GitHub Release Reliability
**Domain:** Brownfield GitHub Release and Milestone publication reliability for a UTFPR-internal financial-management system
**Researched:** 2026-09-25
**Confidence:** MEDIUM-HIGH (repository and live-remote evidence HIGH; GitHub API edge behavior MEDIUM because no publication write was performed)

## Executive Summary

SGRF/SGRD is an existing Node 22/Express/Prisma/PostgreSQL backend with a Vue 3/Vite frontend; v0.1.2 does **not** add product behavior, change either npm package, or alter the application acceptance commands. Its business outcome is to recover the missing GitHub Release and GitHub Milestone for the already-valid `v0.1.1` tag, then make future milestone publication an explicit, auditable, operator-invoked operation. The research consistently models GitHub as the authority: a local tag, local planning file, successful command exit, or either GitHub object alone is not completion proof.

The recommended implementation is one checked-in `scripts/github-release-close.mjs` Node 22 ESM reconciler, with built-in `fetch`, `node:test`, and no new npm dependency. The operator authenticates with the existing `gh` credential; the script uses GitHub REST reads/writes, exact remote ref and Checks evidence, reviewed notes/record inputs, and a single state machine. A hosted GitHub Actions publisher is explicitly deferred: if added later, it must be a thin wrapper around this same script, not a second implementation and not a new automatic release trigger. The existing `.github/workflows/ci.yml` remains the regression gate and is read, not replaced.

The principal risks are identity and race risks: confusing a tag object with its peeled commit, selecting the wrong or late CI run, trusting a dirty local checkout, mutating an existing publication on retry, and treating Release and Milestone writes as atomic. The roadmap therefore puts the contract and fixture tests first, then read-only verification, then guarded idempotent apply, then a CI/concurrency rehearsal, and only then the operator-confirmed live v0.1.1 recovery. Every transition is read-after-write, every preflight failure is `mutations: 0`, and the valid `v0.1.1` tag is never created, moved, deleted, or force-updated.

## Key Findings

### Resolved Cross-Research Decisions

The research files use a few deliberately different phrasings. The following resolutions are the downstream roadmap contract:

| Question | Resolution for v0.1.2 | Reason and source alignment |
|---|---|---|
| **Operator surface: checked-in Node script or Actions workflow** | **Use the checked-in Node 22 CLI as the only publication surface.** Keep `ci.yml` unchanged. A `workflow_dispatch` wrapper is a later option only, and must invoke the same script and contract. | STACK and ARCHITECTURE both reject a second publisher and new CI authority; FEATURES/PITFALLS describe a workflow only as a possible future explicit surface. The milestone requires an operator boundary, not a new automatic release workflow. |
| **Exact-SHA CI selection** | For a new close, require the latest successful `backend` and `frontend` jobs from the existing `ci.yml` for **both** the protected `main` push run and the version-tag push run, all bound to the same full target SHA and expected Actions app/check suite. Require a stable final fence; absent, pending, late, failed, skipped, neutral, wrong-app, or contradictory evidence blocks. | This resolves STACK/FEATURES shorthand about “one coherent target-SHA run” against ARCHITECTURE’s explicit two-run late-run barrier. The observed v0.1.1 baseline has both runs green, so it is eligible immediately. A green run on another SHA never qualifies. |
| **Historical target-SHA evidence** | Normal `apply` requires remote `main` = peeled tag = supplied full expected SHA. An explicit `historical`/`resume` mode may audit a pinned historical target after `main` advances, but it must use the recorded target-SHA CI/tag/Release/Milestone evidence and label the result historical. It is not a generic old-commit bypass. Any historical mutation requires proof of a reviewed prior partial attempt; a missing-object recovery with current-main divergence is not authorized. | STACK, FEATURES, ARCHITECTURE, and PITFALLS all distinguish current-close equality from later historical audit. The mode must not silently replace the historical SHA with local `HEAD` or today’s `main`. |
| **Milestone identity** | The GitHub Milestone title to create/close is exactly **`v0.1.1`**, the historical release identity. The current GSD milestone **v0.1.2** is the automation/reliability milestone; do not create a GitHub Milestone titled `v0.1.2` as a substitute. Discover all `state=all` pages, require one exact-title candidate, then retain and operate on its stable Milestone `number`. | PROJECT.md separates the current v0.1.2 goal from the missing v0.1.1 publication. GitHub Milestone titles are not documented as unique, so title is a discovery key and number is the durable identity. |
| **Release/Milestone write order** | Use Release draft → readback → publish/readback, then Milestone open → readback → close/readback, then final combined readback. | ARCHITECTURE and PITFALLS make the two-step open/close sequence canonical for recoverability. STACK/FEATURES allow a direct closed create as an API optimization, but it is not the safer default for this milestone. |
| **Tag and signature policy** | Require an existing annotated tag and exact peeled commit. The current commit is GitHub-verified; the tag object is unsigned. Record those layers separately and do not reject or rewrite `v0.1.1` merely because the tag object lacks a signature. | The project explicitly preserves the valid tag. PITFALLS requires distinguishing commit verification from tag-object verification; no new tag-signature policy belongs in v0.1.2. |

### Recommended Stack

([STACK.md](STACK.md)) The brownfield fit is intentionally a small operations tool, not a service or application feature. The root-level script avoids a second package/workspace and runs with the same Node 22 runtime already used by the two packages and Actions. Direct REST calls expose status codes, pagination, structured fields, and readback behavior without parsing `gh` output or adding a release SDK.

**Core technologies:**
- **Node.js 22 ESM** — one local operator CLI, JSON validation, built-in `fetch`, and deterministic `node:test` fixtures; no root package or workspace.
- **GitHub REST API** — authoritative reads and guarded writes for repository, refs, annotated tags, commits, Check Runs, workflow runs/jobs, branch protection, Releases, and Milestones; pin explicit API headers.
- **GitHub CLI (`gh`, tested locally at 2.101.0)** — operator authentication, credential access, manual inspection/recovery, and a familiar audit surface; do not make it an npm dependency or use it to parse every API response.
- **Existing Git and `.github/workflows/ci.yml`** — local safety diagnostics and the established `backend`/`frontend` regression gate; neither is publication authority.
- **Reviewed notes and Milestone record files/stdin** — factual content inputs, hashed for invocation evidence; not a second state store.

No new package, workspace, database migration, Express route, Vue component, Docker integration, CI test/build command, or hosted service is warranted. The likely new surface is `scripts/github-release-close.mjs`, `scripts/github-release-close.test.mjs`, an operator runbook (the research proposes `docs/17-github-release-close.md`), and small AGENTS/README links. An optional local evidence/lock directory may be ignored; it is supplemental and never authoritative.

### Expected Features

([FEATURES.md](FEATURES.md)) The required product behavior is a fail-closed reconciler, not a pair of one-shot `create` commands. The following are the P1 acceptance seams:

**Must have (table stakes):**
- **`verify` is read-only and zero-mutation** — independently report repository, tag, target, CI, Release, and Milestone invariants; an incomplete result explicitly says `mutations=0`.
- **Repository/auth and permission preflight** — pin `ldsampaio/sgrf`/GitHub host, verify active credentials and endpoint permissions, and distinguish 401/403/404 permission failures from absent objects.
- **Existing annotated-tag guard** — resolve `refs/tags/v0.1.1` to the tag object and peeled commit; never let Release creation auto-create or alter a tag.
- **Exact `main`/tag SHA guard** — for a new close, compare full SHAs immediately before mutation; `strict:false` is recorded but does not replace equality.
- **Canonical exact-SHA CI gate** — select by full `head_sha`, workflow path, event/ref, attempt, app/check-suite identity, and exact `success` conclusions for both required jobs; ignore the combined status endpoint and superseded wrong-SHA runs.
- **Release reconciliation** — paginate all visible Releases including drafts; create from the existing tag or adopt an exact published Release; publish only an owned matching draft; conflict on duplicates or material differences.
- **Milestone reconciliation** — paginate `state=all`, require exactly one exact-title match, use the stable number, verify the factual record and no open issues, and close only after Release publication.
- **Explicit plan/apply path** — `plan` displays actions; `apply` requires reviewed content and an explicit confirmation; writes are ordered and separated.
- **Idempotent recovery** — read natural keys before every retry, adopt exact results, and report `PARTIAL_STATE`/`PARTIAL_OR_UNCERTAIN` rather than duplicating or deleting.
- **Final remote evidence** — fresh GitHub readback of tag, target, CI run/job/check evidence, Release ID/URL, Milestone number/URL, timestamps, and action result; never log credentials.

**Should have (differentiators, after P1 correctness):**
- immutable plan preview with content hashes and ownership marker;
- time-of-check/time-of-use ref/CI fence before each transition;
- secret-free machine-readable result plus human recovery summary;
- state-aware next-action output (`rerun-safe`, `repair-draft`, `manual-release-conflict`, `reconcile-open-milestone`);
- explicit historical audit/resume mode that separates close-time proof from current `main`.

**Defer or reject in v0.1.2:**
- a hosted `workflow_dispatch` publisher or any automatic publication on push/merge/tag;
- Immutable Releases, attestations, assets, generated notes, and due dates not supplied by an operator;
- delete/recreate/force/retag rollback;
- a service, daemon, webhook, queue, second state file, or extra npm dependency.

### Architecture Approach

([ARCHITECTURE.md](ARCHITECTURE.md)) The publication layer is a single local orchestration state machine outside both application packages. It uses `observe → decide → one guarded transition → observe again`; a fresh GitHub snapshot reconstructs progress after a crash or timeout. The process is sequential and single-writer by design because Release and Milestone mutations cannot be parallelized without weakening the ordering invariant.

**Major components:**
1. **`scripts/github-release-close.mjs` operator CLI** — parse `verify`, `plan`, `apply`, and explicit `historical`/`resume`; validate version/repository/SHA/content; coordinate preflight, lock, CI fence, mutations, and output.
2. **Internal `GitHubClient`** — built-in `fetch` with pinned API version/Accept/User-Agent headers, pagination, rate-limit handling, structured HTTP errors, and in-memory auth from `GH_TOKEN`/`GITHUB_TOKEN` or `gh auth token`.
3. **Pure preflight/reconciliation functions** — classify refs, protection, CI evidence, Release/Milestone inventories, content markers, and conflicts without network I/O; feed deterministic fixture tests.
4. **Audit and local lock helpers** — redacted operation UUID/JSONL evidence and an advisory repository/version lock; neither is a remote source of truth or a distributed lock.
5. **GitHub remote objects** — own the tag, target, CI evidence, Release, and Milestone state; every decision and completion claim is based on their fresh readback.

The canonical flow is:

```text
validate inputs + acquire apply lock
  → read repository/refs/policy/CI/Release/Milestone snapshot
  → wait for canonical main+tag CI runs and a stable fingerprint
  → revalidate refs/CI immediately before the first write
  → Release: create draft → readback → publish → readback
  → revalidate refs/CI
  → Milestone: create open → readback → close by number → readback
  → final tag/ref/CI/Release/Milestone readback
  → emit secret-free result/evidence
```

The tool has no intentional `git tag`, Git ref POST/PATCH/DELETE, tag rename, or force path. It rechecks the tag around Release creation because GitHub’s Release endpoint can create a missing tag when the request races with a disappearing ref. A partial result is a recoverable state, not an invitation to roll back history.

### Critical Pitfalls

([PITFALLS.md](PITFALLS.md)) The most important failure modes and required controls are:

1. **Tag object mistaken for commit, or automatic tag creation** — `git rev-parse v0.1.1` may return the annotated tag object, and `gh release create` may create a tag from the default branch. **Avoid:** strict full-SHA input, remote ref → tag object → commit dereference, `--verify-tag` semantics in any one-off recovery, and a no-ref-write code path.
2. **Wrong, stale, or late CI evidence** — a red PR/release-branch run can coexist with green target runs, while a tag push creates a second run after the main run. **Avoid:** never use list order, “latest branch run,” PR synthetic SHAs, or `/commits/{sha}/status`; require the canonical exact-SHA main+tag run set, app/suite/job identity, latest attempt, and a settled final fence.
3. **Local or remote drift / TOCTOU** — this checkout is ahead of `origin/main` and dirty; another push can move `main` after preflight. **Avoid:** remote GitHub equality as proof, clean `main` only as an apply hygiene check, pinned expected SHA, local lock, and ref/CI revalidation before each mutation.
4. **Non-idempotent retries and partial writes** — a lost response can mean the server committed a POST, and Release/Milestone are separate endpoints. **Avoid:** paginated natural-key inventory, readback after timeout/409/422/5xx, bounded GET backoff, no blind mutation retry, and explicit partial-state exit.
5. **Milestone title/state/pagination confusion** — default open-only listing misses closed objects, titles are not a documented unique key, and `open_issues`/`closed_issues` are not closure proof. **Avoid:** `state=all` + complete pagination, exact-title uniqueness check, stable number persistence, no close-by-title, and no invented due date.
6. **Permission and shell-safety errors** — the CI token has read-only permissions, a 403/404 can masquerade as absence, and interpolated titles/notes can execute shell text. **Avoid:** explicit endpoint permission matrix, existing operator credential, no dummy write probe, strict version/SHA validation, `execFile`/argument-safe calls, structured API bodies, and secret-free logs.
7. **Concurrent operators, cancellation, and rate limits** — local locks do not protect separate hosts; repeated POSTs and uncapped polling can duplicate objects or trigger secondary limits. **Avoid:** one documented surface, natural-key conflict handling, serialized mutations, `Retry-After`, bounded request budget, and explicit stale-lock handling.

## Implications for Roadmap

The roadmap must treat the live recovery as an operator-confirmed outcome, not as permission to bypass the safety contract. The “P1–P4” labels in PITFALLS are business/control priorities, not a license to mutate before the implementation gates. The safest concrete order is the ARCHITECTURE build order below.

### Requirement Implications

These are downstream requirement seams, not new product scope:

- **Identity and preflight requirement** — cover TS-01 through TS-04: exact repository, auth, annotated tag, peeled target, remote `main`, protection, and exact-SHA CI; every failure must produce stable reason codes and zero mutations.
- **Operator contract requirement** — cover TS-05, TS-08, and D-01: `verify`/`plan` are read-only; `apply` requires reviewed content, a displayed plan, and explicit confirmation; historical mode is separately labeled and constrained.
- **Release requirement** — cover TS-06, TS-10, and TS-12: discover all exact-tag Releases including drafts, preserve the tag, publish only the desired object, and prove final `draft=false`/`published_at`/tag readback.
- **Milestone requirement** — cover TS-07 and TS-08: create/read back an exact-title `v0.1.1` Milestone only after Release publication, close by number, require the factual record and `closed_at`, and never use v0.1.2 as the remote title.
- **Recovery/idempotency requirement** — cover TS-09, TS-11, and D-04: all partial, duplicate, timeout, 409/422/429, and concurrent states are safe to rerun or explicitly conflict; no blind POST, delete, or retag path exists.
- **Evidence requirement** — cover TS-10 and D-03: stdout JSON and optional JSONL evidence include IDs, URLs, SHAs, run/job/check IDs, action result, and timestamps but never tokens or headers.
- **Safety/hardening requirement** — cover TS-01, TS-04, TS-12 plus PITFALLS controls: endpoint permissions, input/shell safety, exact ref/CI fence, branch protection readback, and no application/CI contract changes.

### Phase 1: Contract, Inputs, and Pure State Machine
**Rationale:** The failure modes are identity, ambiguity, and state-machine defects. A stable command, reason-code, content, marker, and fixture contract must exist before any code can make a remote write. This is the “P1” engineering foundation, not permission to publish.

**Delivers:** `verify`/`plan`/`apply` contracts; strict repository/version/full-SHA validation; reviewed notes/record schema; deterministic ownership marker/content hash; stable result schema and exit/reason-code taxonomy; pure Release/Milestone/CI/ref classifiers; `scripts/github-release-close.test.mjs` fixture matrix; initial runbook contract.

**Addresses:** TS-05, TS-08, TS-11; D-01; anti-features for generated notes, arbitrary branches, and destructive rollback.

**Avoids:** Pitfalls 1, 2, 12, 15, and 16 through no-I/O fixtures, strict parsing, and an explicit ban on tag/ref/delete paths.

**Research flag:** LOW for the contract itself; use standard Node test patterns. Do not add live mutation tests.

### Phase 2: Read-Only Client and Exact-SHA Preflight
**Rationale:** The current v0.1.1 state is known to be incomplete, but the first executable command must prove exactly what is remote. This phase proves the canonical target and CI contract before any apply path can be reached.

**Delivers:** `GitHubClient` with built-in `fetch`, pinned headers, pagination, auth handoff, and structured errors; repository/branch-protection/ref/tag/commit reads; exact main+tag Actions run/job/check selection; commit-vs-tag signature recording; Release/Milestone inventories; read-only `verify` and `plan`; a live v0.1.1 read-only baseline report.

**Addresses:** TS-01 through TS-05, TS-10, D-05; `REPO_MISMATCH`, `TAG_*`, `REF_MISMATCH`, `PROTECTION_DRIFT`, `CI_NOT_READY`, and `CI_SOURCE_MISMATCH`.

**Avoids:** Pitfalls 3, 4, 6, 7, 8, 9, and the wrong-repository/local-HEAD/legacy-status traps.

**Verification:** The read-only result must show tag object `0a68d6f0c55e7be07d13a0bbc4ed36d4af772630`, peeled/expected/main SHA `10c62ac85fd3ab275b8926c89f5f34ba4116e2cf`, the two green target-SHA push runs (`36095855139` and `36095872529`), and missing Release/Milestone with `mutations:0`.

**Research flag:** HIGH — run `/gsd-plan-phase --research-phase 2` to pin the API-version/header contract, deterministic selection among reruns/check suites, branch-protection permissions, and historical evidence semantics. This is the most research-sensitive phase.

### Phase 3: Guarded Apply, Idempotency, and Evidence
**Rationale:** Once the read-only preflight is trustworthy, implement the smallest restartable mutation state machine. The state machine must prove recovery from an uncertain response before any live recovery is attempted.

**Delivers:** `apply` with explicit confirmation; draft Release create/readback/publish/readback; Milestone open/create/readback/close-by-number/readback; content marker ownership checks; local repository/version lock; final secret-free JSON/JSONL evidence; bounded GET/rate-limit handling; readback-first handling of timeout/409/422/5xx; historical/resume guardrails; complete mocked partial-state and duplicate/concurrency tests.

**Addresses:** TS-06 through TS-12; D-01 through D-04; all P1 recovery scenarios and the P2 historical evidence seam.

**Avoids:** Pitfalls 10–14, 16, and 17: draft/prerelease conflation, duplicate Release creation, Milestone ambiguity, cross-object atomicity assumptions, concurrent invocation, destructive rollback, and blind retries.

**Verification:** Fake-client/disposable-repository tests cover both missing objects, Release-only partial, draft Release, open/closed Milestone, page-two objects, duplicate titles, lost POST response, 403/404 permission, main advance, malicious input, and two simultaneous invocations. No test mutates `ldsampaio/sgrf`.

**Research flag:** MEDIUM-HIGH — rehearse lost-response and concurrent-write behavior with a high-fidelity mock or disposable repository. The endpoint existence is known; the exact safe serialization behavior is the unresolved implementation question.

### Phase 4: CI Fence, TOCTOU Protection, and Operator Runbook
**Rationale:** A green preflight snapshot is not enough because tag-push CI can appear late and `main` can move between calls. This phase closes the race before the live v0.1.1 apply.

**Delivers:** Bounded wait for both canonical target-SHA runs; stable fingerprint/settle interval; immediate ref/CI revalidation before every transition; explicit late-run failure and `main` divergence behavior; exit-code/recovery matrix; permission checklist; AGENTS.md/README links; finalized `docs/17-github-release-close.md`; optional evidence archive instructions.

**Addresses:** TS-04, TS-08, TS-10, D-02, D-05; exact run IDs/attempts, workflow/app/suite identity, and final readback.

**Avoids:** Pitfalls 5, 6, 7, 8, 9, and 14; no hosted workflow, automatic publication, or unbounded polling is introduced.

**Verification:** A delayed tag run resets the fence; a late failure blocks; a stable green main+tag tuple permits only the next guarded step; a simulated main advance produces a pre-write abort; historical mode is read-only unless a prior partial state is proven.

**Research flag:** MEDIUM — validate the proposed settle/timeout policy and GitHub event timing against the repository’s actual Actions behavior. Do not re-open the already-decided question of adding a workflow in v0.1.2.

### Phase 5: Operator-Confirmed Live v0.1.1 Recovery
**Rationale:** This is the business-critical P1 outcome, but it must occur only after Phases 1–4. The current remote baseline already satisfies the identity/CI conditions, so the operator can proceed without a tag rewrite or CI rerun.

**Delivers:** A fresh read-only `verify` and reviewed `plan`; explicit human-approved Release notes and Milestone completion record; one clean `main` checkout at the expected tool revision; `apply --yes`; ordered remote writes; final GitHub readback and archived secret-free evidence. Expected initial actions are `create-draft-release`, `publish-release`, `create-open-milestone`, `close-milestone`; if a prior partial state exists, actions become `adopt`/`repair` and must not duplicate objects.

**Addresses:** The active PROJECT requirements to publish `v0.1.1`, close the exact-title GitHub `v0.1.1` Milestone, and verify tag/Release/Milestone/CI. It also demonstrates TS-09 and TS-12 recovery-forward behavior.

**Avoids:** Every critical pitfall, especially accidental tag creation, wrong-SHA CI selection, blind retry, Milestone close-before-Release, and local-planning-state confusion.

**Verification:** Fresh remote reads show the preserved annotated tag and commit, exact successful main+tag CI run/job/check evidence, one published Release with stable ID/URL, and one closed `v0.1.1` Milestone with stable number/URL, `closed_at`, factual record, and no open issues. The local planning files and command exit are only supporting evidence.

**Research flag:** LOW for external research; this phase needs a human operator review and a live read-only preflight, not another ecosystem study.

### Phase 6: Closeout and Future Policy Decision (Deferred)
**Rationale:** Do not make speculative hardening a prerequisite for the v0.1.1 recovery. Once the close is complete, record evidence and decide separately whether future milestones need a tag ruleset, Immutable Releases, attestations/assets, distributed operator locking, or a thin hosted wrapper.

**Delivers:** Evidence archive/requirements evidence; explicit future-policy decision record. No change to the v0.1.1 tag, historical notes, application code, or current CI contract.

**Research flag:** Only if activated later; confirm repository-owner permissions and policy compatibility before enabling any future protection or workflow.

### Phase Ordering Rationale

- **Contract before mutation:** the first live write must be preceded by a versioned state contract, stable failure semantics, and fixtures; otherwise an ambiguous response is indistinguishable from a failed write.
- **Read-only client before apply:** the observed baseline proves why remote truth matters: the local tree is ahead/dirty, the combined status endpoint is misleading, and the Release/Milestone are absent remotely.
- **Apply before live recovery:** partial-state and timeout behavior cannot be safely inferred from a happy-path `gh release create`.
- **CI fence before recovery:** both target-SHA push runs and the late-run race are load-bearing; a single green main run is insufficient under the resolved architecture contract.
- **Live recovery after rehearsal:** the milestone’s business goal is urgent, but fail-closed means the operator action is gated by all safety seams.
- **Future hardening last:** tag rules, immutable releases, assets, distributed locks, and a hosted wrapper are not substitutes for the tested local reconciler and are not v0.1.2 acceptance scope.

### Research Flags

**Phases likely needing deeper research during planning (`/gsd-plan-phase --research-phase N`):**
- **Phase 2:** GitHub API version/header pinning; exact check-suite/run/attempt selection; branch-protection read permissions; historical target-SHA evidence.
- **Phase 3:** lost-response and duplicate-write behavior; local versus multi-host concurrency; marker ownership and content-change conflicts.
- **Phase 4:** late tag-run timing, settle-window policy, and final-fence race rehearsal.
- **Phase 6 only if activated:** tag ruleset/immutable-release eligibility and any future hosted workflow permissions.

**Phases with standard patterns (skip broad research-phase):**
- **Phase 1:** pure state-machine fixtures, command parsing, and reason-code tables are local engineering; no ecosystem research is needed.
- **Phase 5:** the live recovery procedure is specified by the preflight/plan/apply contract; use operator review and readback, not new product research.

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| **Stack** | MEDIUM-HIGH | Node 22, existing `gh`, REST, and repository fit are directly verified; the script has not yet been implemented, and GitHub’s rendered API-version guidance is not fully uniform. |
| **Features** | HIGH for SGRF requirements / MEDIUM overall | Active requirements and current remote baseline are direct evidence. GitHub title uniqueness, atomicity, and eventual-consistency behavior are not fully documented and are treated conservatively. |
| **Architecture** | HIGH for brownfield placement and state ordering / MEDIUM for CI races | Repository integration and baseline are direct; the two-run late-CI fence, marker ownership, and API edge behavior need implementation rehearsal. |
| **Pitfalls** | MEDIUM-HIGH | The major failure modes are corroborated by first-party docs and the incident-shaped repository evidence; no destructive publication was executed to prove every edge case. |

**Overall confidence:** MEDIUM-HIGH

### Gaps to Address

- **API version/header discrepancy:** STACK recommends the current `2026-03-10` header, while PITFALLS’ reproducible links use `2022-11-28` and note that `gh` defaults differ. Choose one supported/pinned version in the client and test the exact response fields; do not mix implicit versions.
- **Canonical CI selection rehearsal:** the resolved policy requires both latest successful `main` and tag push runs, but late-run timing, rerun attempts, duplicate check suites, and settle duration still need a fixture and a read-only live rehearsal. Do not relax to “any green run.”
- **Credential/permission boundary:** branch-protection reads may require Administration permission, and GitHub’s fine-grained Checks API guidance is not fully aligned across documentation. Smoke-test the existing `gh` credential and any future replacement; never use CI’s read-only token for publication.
- **Historical/resume proof format:** define what constitutes a reviewed prior partial attempt, how the close-time SHA/run IDs are recorded, and when historical mode is read-only versus allowed to continue. It must not become an arbitrary old-commit publish switch.
- **Ownership marker/content review:** settle the canonical serialization of reviewed notes/record and the marker/hash format, then make content changes produce a conflict rather than an overwrite. Do not invent due dates, generated notes, or deployment claims.
- **Concurrency scope:** a local lock protects one workstation only. The current one-operator recovery is sufficient; if multiple hosts become real, design an external lock/queue before claiming serialized publication.
- **Late/API consistency behavior:** GitHub does not promise cross-object atomicity, milestone-title uniqueness, or a general idempotency key. Keep read-after-write and bounded polling; verify any assumption that affects a mutation in a disposable repository or mock.
- **Unsigned tag object:** the project’s explicit preservation decision is stronger than a new signature requirement. Record commit verification and tag-object verification separately; do not make the existing tag ineligible for recovery.

## Sources

### Primary (HIGH confidence for repository facts)
- `.planning/PROJECT.md` — v0.1.2 goal, active requirements, operator boundary, v0.1.1 target SHA, tag-preservation decision, and remote-truth rule.
- `AGENTS.md` and `.github/workflows/ci.yml` — existing Node/Postgres/CI contracts, `backend`/`frontend` jobs, branch-protection context, and verification commands.
- Read-only GitHub API/CLI evidence for `ldsampaio/sgrf` on 2026-09-25: remote `main`, annotated tag object and peeled commit, verified/unsigned signature layers, missing v0.1.1 Release, absent Milestones, exact target-SHA runs/jobs, branch protection, and the historical red run on another SHA.
- The four detailed research artifacts: [STACK.md](STACK.md), [FEATURES.md](FEATURES.md), [ARCHITECTURE.md](ARCHITECTURE.md), and [PITFALLS.md](PITFALLS.md).

### Secondary (MEDIUM confidence; first-party platform documentation cross-checked)
- [GitHub REST Releases](https://docs.github.com/en/rest/releases/releases) — existing-tag behavior, draft/published fields, target semantics, and permissions.
- [GitHub REST Milestones](https://docs.github.com/en/rest/issues/milestones) — `state=all`, pagination, stable number, create/update/readback.
- [GitHub REST refs and tags](https://docs.github.com/en/rest/git/refs) / [Git tags](https://docs.github.com/en/rest/git/tags) — annotated-tag dereferencing and commit identity.
- [GitHub Check Runs](https://docs.github.com/en/rest/checks/runs), [Actions workflow runs](https://docs.github.com/en/rest/actions/workflow-runs), and [protected branches](https://docs.github.com/en/rest/branches/branch-protection) — exact-SHA evidence, app/check-suite identity, and protection semantics.
- [`gh release create`](https://cli.github.com/manual/gh_release_create), [`gh release view`](https://cli.github.com/manual/gh_release_view), [`gh api`](https://cli.github.com/manual/gh_api), and [`gh auth`](https://cli.github.com/manual/gh_auth) — tag auto-creation guard, machine-readable readback, and operator auth.
- GitHub Actions permissions, script-injection, event-trigger, and concurrency guidance — used only to justify deferring a hosted publisher and controlling future surfaces.
- Git `rev-parse`/tag verification documentation — used to distinguish tag-object and peeled-commit identity.

### Tertiary (LOW confidence / validation required)
- No tertiary source is used as a decision authority. The remaining low-confidence items are implementation-level behavior (API eventual consistency, exact late-run timing, multi-host locking, and the chosen settle interval); they are explicitly listed in Gaps to Address.

---

*Research completed: 2026-09-25*
*Ready for roadmap: yes*
