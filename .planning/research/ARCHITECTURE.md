# Architecture Research

**Project:** SGRF/SGRD — v0.1.2 GitHub Release Reliability
**Domain:** Operator-invoked GitHub release/milestone publication for a brownfield repository
**Researched:** 2026-09-25
**Confidence:** HIGH for repository integration and the v0.1.1 baseline; MEDIUM for GitHub eventual-consistency edge cases (no destructive publication was performed during research)

## Recommendation at a Glance

Build one checked-in **Node 22 ESM reconciler** in the repository's existing operator environment. It uses built-in `fetch` for structured GitHub REST calls, obtains an in-memory token from the existing `gh` credential when needed, and uses Node's built-in test runner for fixtures. It is a local operator entrypoint; it is not linked into the Express server, Vue application, Docker image, or a new hosted service.

The decisive policy is:

1. **Tags are inputs, never intentional outputs.** The tool verifies the existing remote annotated tag and never intentionally creates, deletes, force-moves, or patches a tag; the documented REST tag race is handled as a critical conflict.
2. **GitHub is the publication authority.** Local Git state, planning files, and local tags are useful for context but are never sufficient proof.
3. **The CI gate is an exact-SHA gate.** For `apply`, it requires the existing `CI` workflow's `backend` and `frontend` jobs for both the protected `main` push run and the release-tag push run, all bound to the same target SHA. `verify` may report a missing late run as incomplete, but it must not convert that into permission to publish. The gate does not use the legacy combined commit-status endpoint.
4. **Publication is a two-object state machine.** Create a draft Release, read it back, publish it, create an open Milestone, read it back, then close it. A closed Milestone is impossible before a verified published Release.
5. **Natural keys plus a deterministic ownership marker provide idempotency.** GitHub's resource APIs do not give this repository a documented server-side idempotency-key field; every retry starts with a fresh read and only continues when the remote object matches the expected content contract.
6. **A late CI run is a real race.** The tool waits for the tag run to exist, requires terminal successful jobs, observes a stable CI/ref fingerprint, and repeats the fence immediately before the first mutation. It fails closed rather than treating a green `main` run as sufficient.

For v0.1.1, the expected target is the existing remote commit `10c62ac85fd3ab275b8926c89f5f34ba4116e2cf`, the existing annotated tag object is `0a68d6f0c55e7be07d13a0bbc4ed36d4af772630`, and the existing green push runs are `36095855139` (`main`) and `36095872529` (`v0.1.1` tag). The Release and Milestone are absent today; the tool should recover only those missing objects.

The operator-facing shape should be explicit and boring:

```bash
# Read-only remote audit; never mutates GitHub.
node scripts/github-release-close.mjs verify \
  --repo ldsampaio/sgrf \
  --version v0.1.1 \
  --expected-sha 10c62ac85fd3ab275b8926c89f5f34ba4116e2cf

# Read-only plan with reviewed content; displays every intended action.
node scripts/github-release-close.mjs plan \
  --repo ldsampaio/sgrf \
  --version v0.1.1 \
  --expected-sha 10c62ac85fd3ab275b8926c89f5f34ba4116e2cf \
  --notes-file release-notes-v0.1.1.md \
  --milestone-description-file milestone-v0.1.1.md

# Apply only after the plan, permissions, and operator review are recorded.
node scripts/github-release-close.mjs apply \
  --repo ldsampaio/sgrf \
  --version v0.1.1 \
  --expected-sha 10c62ac85fd3ab275b8926c89f5f34ba4116e2cf \
  --notes-file release-notes-v0.1.1.md \
  --milestone-description-file milestone-v0.1.1.md \
  --yes
```

`--historical`/`--resume` is an explicit mode for a reviewed, already-started close whose current `main` has advanced. It is not a generic bypass for publishing an arbitrary commit.

### Confidence by Finding

| Finding | Confidence | Basis |
|---|---|---|
| Repository/workflow integration points and v0.1.1 remote baseline | HIGH | Required files plus live `git`/`gh` readback. |
| GitHub endpoint fields and existing-tag/draft behavior | MEDIUM | Official REST/CLI documentation cross-checked with live reads; no write call was made. |
| Exact-SHA CI selection and late-run fence | MEDIUM | Derived from the current `push` trigger, run/job/check objects, and the observed duplicate main/tag runs; stress behavior still needs a fixture rehearsal. |
| Recommended component boundaries and state-machine placement | HIGH | Directly derived from the brownfield repository's no-workspace/no-service constraints. |

## Standard Architecture

### System Overview

```text
┌─────────────────────────────────────────────────────────────────────────┐
│ Operator workstation                                                     │
│                                                                         │
│  node scripts/github-release-close.mjs apply ...                       │
│                         │                                               │
│                         ├── reviewed notes/record + SHA-256 marker        │
│                         ├── local per-tag lock (advisory concurrency)    │
│                         └── JSONL audit log (no credentials)             │
│                                                                         │
│  ┌──────────────────────────────────────────────────────────────────┐  │
│  │ Release orchestrator                                              │  │
│  │                                                                  │  │
│  │  1. normalize inputs        2. read remote snapshot              │  │
│  │  3. evaluate preflight      4. wait for CI/ref stability fence  │  │
│  │  5. reconcile Release       6. reconcile Milestone              │  │
│  │  7. final readback          8. emit audit/result                 │  │
│  └──────────────────────────────┬───────────────────────────────────┘  │
│                                 │ fetch + pinned API headers              │
└─────────────────────────────────┼───────────────────────────────────────┘
                                  ▼
┌─────────────────────────────────────────────────────────────────────────┐
│ GitHub remote publication truth                                         │
│                                                                         │
│  refs/heads/main ───────────────┐                                       │
│  refs/tags/vX.Y.Z (annotated) ──┼──► exact target SHA                  │
│  Actions runs/jobs/check runs ───┘                                       │
│                                                                         │
│  Releases: natural key = exact tag name                                  │
│  Milestones: natural key = exact title + managed marker                 │
└─────────────────────────────────────────────────────────────────────────┘

No connection to backend/, frontend/, PostgreSQL, Docker, or a new service.
```

### Component Responsibilities

| Component | Responsibility | Communicates with |
|---|---|---|
| `scripts/github-release-close.mjs` | Single operator CLI: parse `verify`/`plan`/`apply`, validate inputs, load reviewed notes, orchestrate the state machine, and emit a secret-free result/evidence record. | GitHub client, pure evaluator, reconciler, audit/lock. |
| `GitHubClient` internal class/functions | Use built-in `fetch`, pinned `Accept`/API-version/User-Agent headers, pagination, rate-limit handling, and structured HTTP errors; obtain a token from `gh` only when `GH_TOKEN`/`GITHUB_TOKEN` is absent. | Preflight and reconciler; GitHub REST API. |
| Pure preflight/reconcile functions | Evaluate refs, protection, workflow runs/jobs/check runs, and Release/Milestone inventories; apply no I/O in unit tests. | CLI, GitHubClient, fixture tests. |
| Audit/lock helpers inside the script | Append redacted operation events and acquire an atomic repository/version lock; neither is a remote source of truth. | All phases, local filesystem. |
| GitHub remote objects | Own the source ref, CI evidence, Release, and Milestone state that operators ultimately consume. | All reads/mutations through the client. |

### Current Repository Baseline

The following are direct observations from the repository and GitHub on 2026-09-25:

| Surface | Current state | Architectural consequence |
|---|---|---|
| `.github/workflows/ci.yml` | `on: [push, pull_request]`; jobs `backend` and `frontend`; Node 22; exact acceptance commands are `npx vitest run` and `npm run build` | A tag push creates a second run for the same SHA; the tool must require/track it rather than search for any green check. |
| `main` protection | Required contexts `backend`, `frontend`; `strict:false`; `enforce_admins:true`; no required reviews/restrictions | Preflight should read this policy and refuse to publish if the required context contract has drifted. The tool does not mutate protection. |
| `v0.1.1` remote tag | Annotated tag object `0a68d6f0c55e7be07d13a0bbc4ed36d4af772630`; object commit `10c62ac85fd3ab275b8926c89f5f34ba4116e2cf` | The tag is valid input and must be preserved. The commit itself has GitHub-verified signature; the tag object is currently unsigned. Record both layers separately; do not rewrite the tag to satisfy a stronger future policy. |
| `v0.1.1` Release | Absent (`GET .../releases/tags/v0.1.1` is 404) | Create a Release without asking GitHub to create a tag. |
| v0.1.1 Milestone | No milestone exists in `state=all` | Create an open Milestone, then close it after Release publication. |
| Target CI | Main run `36095855139` and tag run `36095872529`, both completed successful; each contains successful `backend` and `frontend` jobs | These are the expected evidence tuple for the v0.1.1 recovery. |
| Historical red release-branch runs | The root incident is `36095528423` on `826953c...`; additional red tag/release-branch runs (`36095220729`, etc.) are also on non-target SHAs; `b50dc94` fixed the fresh-DB setup | They are history, not a reason to reject the target. The gate must filter by exact target SHA and latest attempt. |
| Local checkout | Local `HEAD` is `14f3da6...` and local `origin/main` is `10c62ac...`; the local tree also has planning changes | The tool must not derive the release target from local `HEAD`, `git status`, or a stale local branch. |
| Tag protection | No repository tag-protection/ruleset object was observed in the live readback | Treat tags as operator-controlled inputs; consider a future tag rule rather than adding hidden writes to the tool. |

### As-Is vs. New Behavior

| Area | Existing behavior | New behavior for v0.1.2 | Explicitly unchanged |
|---|---|---|---|
| Application runtime | Express/Prisma/Postgres/Vue, Docker deployment | No runtime integration | Backend, frontend, database, compose, Dockerfile |
| CI | Push/PR workflow with two required jobs | Read-only CI snapshot/fence; no command changes and no automatic release trigger | `.github/workflows/ci.yml` jobs and branch protection |
| Tags | Annotated tags are created and pushed manually | Verify remote annotated tag and peel it to the target commit | No tag create/delete/force/update path |
| Release | v0.1.0 exists; v0.1.1 absent | Idempotent draft → publish reconciliation for an existing tag | No release deletion, no generated notes, no target rewriting |
| Milestones | No v0.1.1 milestone | Open → closed reconciliation after Release readback | No issue/PR assignment or unrelated milestone changes |
| Audit | No release-close audit layer | Operation UUID, preflight snapshot, mutation/readback events, JSONL log | No token, secret, or full HTTP header logging |
| Permissions | Operator has authenticated `gh` access with `repo` and `workflow` scopes in the current workstation | Preflight verifies the minimum remote permissions before any POST/PATCH | No branch-protection mutation, no workflow-file edits, no tag permission grant |

## Recommended Project Structure

Keep the publication layer outside both application packages. The repository has two independent npm packages and no root workspace; a root-level Node script with built-in modules is the least disruptive fit.

```text
scripts/
├── github-release-close.mjs       # CLI, fetch client, pure state machine, evidence output
└── github-release-close.test.mjs  # node:test fixtures; no network in unit tests

docs/
└── 17-github-release-close.md     # operator runbook, recovery, permissions

.release-close/                     # optional ignored local evidence/lock output
```

Reviewed Release notes and the Milestone completion record are operator-supplied files or standard input. They are inputs, not a second remote-state store or a hidden release database. Fixture tests run with `node --test scripts/github-release-close.test.mjs`, outside the backend/frontend acceptance commands.

### New and Modified Files

| File | Status | Responsibility |
|---|---|---|
| `scripts/github-release-close.mjs` | **New** | Single Node 22 ESM operator CLI: `verify`, `plan`, `apply`, optional `historical`/`resume`, built-in `fetch` client, pure state machine, and evidence output. |
| `scripts/github-release-close.test.mjs` | **New** | `node:test` fixtures for success, conflicts, partial success, late CI, shell safety, permissions, and timeout-after-mutation cases. No live mutation tests. |
| `docs/17-github-release-close.md` | **New** | Runbook, permission checklist, exact verify/plan/apply commands, recovery matrix, and the no-tag policy. |
| `AGENTS.md` | **Modified** | Add the operator command, `gh` prerequisite, no-tag rule, and recovery pointer. Do not change application verification commands. |
| `README.md` | **Modified** | Link the release runbook; keep the application quick start unchanged. |
| `.gitignore` | **Modified** | Ignore optional `.release-close/` evidence/lock files. Credentials remain in the `gh` keyring, never in the repository. |
| `.github/workflows/ci.yml` | **No change recommended** | The current push trigger is part of the gate contract. The tool must require the tag push run. A future workflow redesign is a separate decision, not part of v0.1.2. |

If the implementation team wants an even smaller first slice, the pure evaluator and fixtures can initially live in one `github-release-close.mjs`; the boundaries above are still the required seams. Do not put the publisher in `backend/src` or `frontend/src`.

### Structure Rationale

- **`scripts/github-release-close.mjs` outside both packages:** release publication is a repository/operations concern, not an Express request or Vue feature. A single root-level Node script avoids adding a workspace or shipping publisher code in the application image.
- **Built-in `fetch` plus `gh` auth:** the script can classify HTTP status, headers, pagination, and rate limits without parsing CLI output or shelling out for every API call; `gh` remains the credential/recovery surface.
- **Pure functions inside the script:** state and conflict tests run without credentials or network access; the file remains small enough to review as one operator surface.
- **Reviewed notes as explicit inputs:** the operator supplies a notes file/standard input, and the evidence output records its hash; there is no second remote-state store.
- **No new CI workflow in v0.1.2:** the current `push` trigger already supplies the main/tag evidence tuple. Adding a second publisher workflow would duplicate test commands and reuse a `GITHUB_TOKEN` with different permission semantics; revisit only if the CI contract is intentionally redesigned.

## Publication Contract and Invariants

These are fail-closed invariants, not advisory checks:

1. **Tag immutability:** the tool has no intentional code path for `git tag`, `POST /git/refs`, `PATCH /git/refs`, or `DELETE /git/refs`. The Release API is called only after a verified existing tag, but GitHub has no atomic “create Release only if tag still exists” operation; the tool rechecks the tag before and after that call and treats any drift as critical rather than normalizing it.
2. **Annotated-tag policy:** `refs/tags/<version>` must point to a GitHub tag object, and that tag object must point to a commit. A lightweight tag is a blocking conflict, not an invitation to recreate it.
3. **Target identity:** the resolved target commit is a full 40-character SHA. In normal `apply`/new-close mode, remote `refs/heads/main`, the peeled tag, and the expected SHA are identical. In explicit `historical`/`resume` mode, a pinned historical target may be an ancestor of current `main`; it must never be an arbitrary branch tip.
4. **CI identity:** the selected workflow path, event, head SHA, branch/ref, run attempt, and job/check names are all recorded. A green run for another SHA, another workflow, or a merely similar job name is irrelevant.
5. **Publication ordering:** no Milestone is closed until the Release is published and read back successfully.
6. **No blind overwrite:** an existing object is either an exact semantic match (no-op) or a conflict. The tool never changes an unmanaged Release body/title/tag, deletes duplicates, or rewrites a Milestone description.
7. **Remote completion:** local process success is not completion. `COMPLETE` requires a final remote read of tag, target, CI fence, Release, and Milestone.
8. **No automatic rollback:** public objects are not deleted or unpublished as recovery. A partial state is reported with the exact next safe read/continue operation.

The v0.1.1 tag object's `verification.verified=false` is recorded as an existing fact but is not a new blocker: the project explicitly preserves the valid unsigned annotated tag. A future policy may require signed tags, but changing that rule in this milestone would invalidate the recovery target.

## State Machine

### Remote Object States

The orchestrator evaluates a snapshot; it does not trust a previous local state file.

```text
TAG
  MISSING ───────────────► BLOCKED (operator must create/push tag)
  LIGHTWEIGHT ────────────► BLOCKED (policy conflict)
  ANNOTATED_MISMATCH ─────► BLOCKED (never move the tag)
  ANNOTATED_MATCH ────────► VERIFIED

CI
  ABSENT ─────────────────► WAIT_THEN_BLOCK (no evidence)
  PENDING/QUEUED ─────────► WAIT
  FAILED/CANCELLED ───────► BLOCKED (latest attempt for the exact target)
  AMBIGUOUS ──────────────► BLOCKED (duplicate/latest-run cannot be identified)
  GREEN_BUT_LATE ─────────► WAIT (tag run or newer attempt may still appear)
  SETTLED_GREEN ──────────► VERIFIED

RELEASE
  ABSENT ─────────────────► CREATE_DRAFT → VERIFY_DRAFT
  OWNED_DRAFT ────────────► PUBLISH → VERIFY_PUBLISHED
  PUBLISHED_MATCH ────────► VERIFIED (no mutation)
  UNMANAGED_CONFLICT ─────► CONFLICT (no mutation)
  DUPLICATE_CONFLICT ─────► CONFLICT (no deletion)

MILESTONE
  ABSENT ─────────────────► CREATE_OPEN → VERIFY_OPEN
  OWNED_OPEN ─────────────► CLOSE → VERIFY_CLOSED
  CLOSED_MATCH ───────────► VERIFIED only if Release is published and fields match
  UNMANAGED_OPEN ─────────► CONFLICT (do not close a human-owned object)
  UNMANAGED_CLOSED ───────► VERIFIED only if Release is published and every semantic field matches
  DUPLICATE_TITLE ────────► CONFLICT (never choose or delete one)

ORCHESTRATOR
  PREFLIGHT ─► BLOCKED
  READY ─► LOCKED ─► RELEASE_DRAFT_VERIFIED
       ─► RELEASE_PUBLISHED_VERIFIED ─► MILESTONE_OPEN_VERIFIED
       ─► MILESTONE_CLOSED_VERIFIED ─► COMPLETE
```

`PARTIAL_UNVERIFIED` is a result of an uncertain mutation or a final readback failure. It is not a hidden success: the next invocation starts with a fresh remote read and can continue only through an exact match.

### State-Transition Rules

- A transition that changes a remote object requires a current preflight snapshot, an acquired lock, and a still-valid CI/ref fence.
- Before every POST/PATCH, re-read the object being transitioned and verify its current state, tag/title, and body/description still match the planned value. A concurrent human edit is a conflict, not permission to publish or close it.
- A transition is complete only after a new GET/list response, not merely after a successful HTTP status.
- A `409`, `422`, timeout, or process interruption after POST/PATCH is resolved by **readback first**. Never blindly repeat the mutation.
- A target/main mismatch after a draft Release exists aborts before Milestone mutation and leaves the draft for an explicit rerun; it never moves `main` or the tag.
- An existing closed Milestone without a matching Release is an inconsistent remote state and is reported for manual recovery rather than silently “repaired.” The same rule applies when the Release is only a draft: a closed Milestone cannot be used to justify publishing that draft automatically.

Recommended process exit codes for automation/readback scripts: `0` = `COMPLETE` or idempotent `NOOP`; `2` = preflight `BLOCKED`; `3` = unmanaged/duplicate `CONFLICT`; `4` = `PARTIAL_UNVERIFIED`; `5` = transport/API/permission failure. The exact mapping belongs in the runbook and should be covered by fixture tests.

Use stable machine-readable reason codes independent of prose: `AUTH_REQUIRED`, `REPO_MISMATCH`, `LOCAL_DIRTY`, `LOCAL_REF_MISMATCH`, `TAG_MISSING`, `TAG_NOT_ANNOTATED`, `TAG_TARGET_MISMATCH`, `REF_MISMATCH`, `PROTECTION_DRIFT`, `CI_NOT_READY`, `CI_SOURCE_MISMATCH`, `RELEASE_CONFLICT`, `RELEASE_AMBIGUOUS`, `MILESTONE_CONFLICT`, `MILESTONE_AMBIGUOUS`, `PARTIAL_STATE`, `PARTIAL_OR_UNCERTAIN`, and `COMPLETE`. Every non-complete preflight result must include `mutations:0`; an uncertain write must retain that distinction until readback resolves it.

Preflight is read-only. It must finish with a single immutable `ReleaseSnapshot` containing the target, reviewed-content hash, tag object, branch protection, CI runs/jobs/check runs, and current Release/Milestone classifications.

### Mode Semantics

| Mode | Allowed actions | Required confirmation | Result |
|---|---|---|---|
| `verify` | GET/list reads only; no CI rerun, tag write, Release write, or Milestone write | None | Remote `COMPLETE`, `INCOMPLETE`, `CONFLICT`, or `UNVERIFIABLE`; always `mutations:0`. |
| `plan` | `verify` plus normalized action table and content hashes | None | Human-readable plan and machine-readable JSON; always `mutations:0`. |
| `apply` | Guarded Release/Milestone reconciliation after the same preflight | `--yes` and reviewed notes/record | Ordered remote writes plus a mandatory secret-free evidence envelope; an operator may redirect it to the optional JSONL path. |
| `historical`/`resume` | Read-only audit, or continuation only when the pinned target/prior partial state is proven | Explicit flag and `--yes` for any mutation | Never a generic old-commit bypass; current-main divergence is reported rather than silently ignored. |

### Gate 0 — Operator, repository, and tool safety

1. Require an explicit host and repository (`github.com` + `ldsampaio/sgrf` for this project); do not silently operate on an arbitrary Git remote or inherited `GH_REPO`/`GH_HOST`.
2. Verify `gh auth status --hostname github.com --active` succeeds. For `apply`, obtain a token in memory from `GH_TOKEN`, `GITHUB_TOKEN`, or `gh auth token`; read the authenticated actor and repository `full_name`, but never record the token.
3. Use built-in `fetch` with `Accept: application/vnd.github+json`, a pinned `X-GitHub-Api-Version` constant (the current official REST documentation recommends `2026-03-10`), and a non-secret User-Agent. Keep the chosen contract in one function and test it during implementation; do not depend on undocumented `gh` defaults.
4. Load and hash the reviewed notes/description inputs. Record the tool source revision and input hashes, but do not use local `HEAD` as the release target. `apply` requires a clean local `main` checkout at the reviewed tool revision; `verify`/`plan` remain usable from a dirty audit checkout.
5. For `apply`, acquire an atomic local lock keyed by repository + version before the mutation preflight, then run the full read-only preflight under that lock. `verify`/`plan` do not need a mutation lock. A stale lock is an explicit operator decision, not an automatic deletion.
6. Validate the version against a narrow release-name grammar such as `^v[0-9]+\.[0-9]+\.[0-9]+(?:-[0-9A-Za-z.-]+)?$`; reject slashes, whitespace, shell metacharacters, and branch-like values.
7. `verify` and `plan` execute every read and print the transition table without any POST/PATCH. `apply` refuses to mutate unless the same preflight passes, the plan is shown, and `--yes` is supplied.

### Gate 1 — Remote repository and branch protection

Read:

- `GET /repos/{owner}/{repo}` — confirm `full_name`, public/private state, default branch `main`, and actor permissions. The v0.1.2 tool has no arbitrary `--base-ref`; any other branch/ref is rejected unless the historical record explicitly pins the target.
- `GET /repos/{owner}/{repo}/branches/main/protection` — require `strict:false`, `enforce_admins.enabled:true`, and required contexts that include both `backend` and `frontend` (with the existing GitHub Actions app binding where present). The tool does not update this object.
- Optionally read repository rulesets/tags-protection state and record it. A tag-protection rule is a useful hardening layer, but its absence is not silently changed by the tool in v0.1.2.

If the required check contract is missing or a different workflow has claimed the same context, block. Because the current protection is `strict:false`, GitHub branch protection alone does not prove that the tag target is still the current `main` head; the tool's explicit ref equality is load-bearing. Do not fall back to “CI looked green in the UI.”

### Gate 2 — Resolve the target and annotated tag

Read remote refs, not local refs:

```text
GET /repos/ldsampaio/sgrf/git/ref/heads/main
GET /repos/ldsampaio/sgrf/git/ref/tags/v0.1.1
GET /repos/ldsampaio/sgrf/git/tags/{tag-object-sha}   # only if ref object.type == tag
GET /repos/ldsampaio/sgrf/commits/10c62ac85fd3ab275b8926c89f5f34ba4116e2cf
```

Then assert:

- tag name is exactly the requested version;
- tag ref object type is `tag` (annotated), not `commit` (lightweight);
- tag object's `object.type` is `commit` and its SHA is the expected full SHA;
- the target commit's GitHub verification is `verified:true` for a new close; historical/resume mode records the commit and tag verification layers separately and may rely only on previously recorded evidence for the pinned historical target;
- `main` resolution is the same SHA in normal `apply`/new-close mode;
- in `historical`/`resume` mode, the pinned target is the same tag target and is reachable from `main` using a compare/readback API call; the mode is only for a reviewed historical record or a prior partial attempt, never a generic bypass for publishing an arbitrary old or branch-only commit;
- the tag's message/timestamp/verification are recorded for audit but are not rewritten.

The API's `target_commitish` field is not proof of the target when a tag already exists. The peeled tag and the branch ref are the proof. Conversely, a Release POST with `target_commitish` is dangerous if the tag disappears between reads because the Release endpoint can create a missing tag. The tool rechecks the tag immediately before POST, verifies it again immediately afterward, and treats any change as a critical partial state.

### Gate 3 — Reviewed release/milestone content inputs

The plan input supplies, at minimum:

```json
{
  "version": "v0.1.1",
  "tag": "v0.1.1",
  "targetSha": "10c62ac85fd3ab275b8926c89f5f34ba4116e2cf",
  "release": {
    "name": "v0.1.1",
    "body": "Human-reviewed factual milestone notes.",
    "prerelease": false,
    "makeLatest": false
  },
  "milestone": {
    "title": "v0.1.1",
    "description": "Human-reviewed completion record with target and Release URL."
  }
}
```

`makeLatest` is an explicit operator choice, not part of the terminal milestone invariant. The v0.1.1 plan may set it after reviewing `v0.1.0`; if omitted/false, the tool must not demote an existing newer latest Release.

The exact v0.1.1 body should be reviewed from the existing tag message/PROJECT record and must not be auto-generated. It should state only facts that the project can evidence: milestone completion, target commit, test/build evidence, and the preserved tag. The Milestone description should repeat the target, link to the published Release, and state the completion record; neither body should contain credentials or mutable claims about deployment. The expected SHA is required for `historical`/`resume` mode and is strongly recommended for every historical close; in a normal future close it may be omitted only when the tool records the freshly resolved remote `main`/tag SHA as part of the marker. The tool calculates a marker such as:

```text
sha256(repository + "\n" + version + "\n" + targetSha + "\n" + canonical(contentInputs))
```

The marker is appended as an HTML comment to the Release body and Milestone description. It is a deterministic ownership/idempotency marker, not a secret. A changed content input produces a different marker and therefore a conflict rather than an overwrite.

### Gate 4 — Canonical CI evidence

Do not use `GET /commits/{sha}/status` as the gate. In the live repository it returned `pending` with zero legacy statuses even though both GitHub Actions check runs were successful. The Actions Checks API is the source of truth for these job conclusions.

For each required ref (`main` and the version tag), read the workflow run by exact SHA:

```text
GET /repos/ldsampaio/sgrf/actions/workflows/ci.yml
GET /repos/ldsampaio/sgrf/actions/workflows/ci.yml/runs?head_sha=<target>&event=push&per_page=100
GET /repos/ldsampaio/sgrf/actions/runs/<run-id>/jobs
```

Select a candidate only when all of these match:

- workflow name/path is the existing `CI` / `.github/workflows/ci.yml`;
- event is `push` (not an unrelated PR or manually triggered run with a different head SHA);
- `head_sha` is exactly the resolved target;
- `head_branch` is `main` for the branch run and exactly the version tag for the tag run;
- the current run attempt is `completed` with conclusion `success`;
- jobs include exactly the required `backend` and `frontend` conclusions `success` (duplicates within the selected attempt are an ambiguity, not an implicit pass).

Then cross-check the Checks API using the selected run's `check_suite_id`:

```text
GET /repos/ldsampaio/sgrf/commits/<target>/check-runs?per_page=100&app_id=15368&filter=all
```

Require a completed/successful check named `backend` and one named `frontend`, with the same `head_sha` and `check_suite.id` as the selected workflow run. App ID 15368 is the currently observed GitHub Actions app; recording the workflow path and run ID remains mandatory if the app ID changes. GitHub branch protection may allow a neutral or skipped required check, but this release gate intentionally requires an explicit `success` conclusion for both jobs so a skipped test cannot close a release.

The v0.1.1 expected tuple is:

| Ref | Run | Run attempt | Backend | Frontend |
|---|---:|---:|---:|---:|
| `main` | `36095855139` | 1 | `107947861905` | `107947862082` |
| `v0.1.1` | `36095872529` | 1 | `107947914083` | `107947914272` |

(The exact job IDs are captured from GitHub at execution time; the tool must not hard-code them. The live snapshot used to establish the baseline had successful jobs for both runs.)

A red run for `0943c60...` is not a failure of target `10c62ac...`; the filter is exact-SHA. Conversely, a failed latest attempt for the target blocks publication even if an older attempt for the same SHA passed.

### Gate 5 — Existing remote publication objects

Read all pages:

```text
GET /repos/ldsampaio/sgrf/releases?per_page=100
GET /repos/ldsampaio/sgrf/milestones?state=all&per_page=100
```

Do not rely only on `GET /releases/tags/{tag}`: that endpoint is primarily for a published release, while recovery must also see a tool-created draft. Classify by exact tag/title and marker:

- no matching Release → create a draft;
- one exact published Release → no-op for Release;
- one exact draft with the current marker **and exact body hash** → continue publication;
- any other Release (wrong tag, wrong body/name, unmanaged draft, duplicate) → conflict;
- no matching Milestone → create open;
- one exact closed Milestone → no-op only if the Release is already published and exact; otherwise classify the state as inconsistent and block;
- one exact open Milestone with marker **and exact description hash**, and `open_issues == 0` → close;
- an exact Milestone with associated open issues, an unmanaged open object, or duplicate exact titles → conflict, with no deletion and no issue mutation.

## CI Race Barrier and Race Windows

### Known Late-Run Race

Pushing a tag after the release merge creates a second `push` run for the same commit. A tool that sees the green `main` run can publish before the tag run appears, and that late tag run can then fail. This is the race the v0.1.2 layer must close; the historical v0.1.1 red run shows why a global “there was a red run somewhere” rule is also wrong.

Use a two-stage wait/fence:

1. Wait for the tag push run to **exist**, not merely for a check with the target SHA to exist.
2. Wait for the latest main and tag run attempts and their `backend`/`frontend` jobs to be terminal successful.
3. Query all target-SHA runs again. A new run ID, new attempt, queued/in-progress run, or changed job conclusion resets the stability timer.
4. Require the same complete fingerprint for a configurable settle period (recommended default: 30 seconds, with a bounded CI timeout such as 10 minutes).
5. Immediately before the first mutation, re-read main, the tag ref/tag object, the run list, and the selected job/check results. If the fingerprint or target changed, abort without a write and restart from preflight.

The fingerprint must include, at minimum:

```text
main ref SHA
tag ref object SHA
tag object SHA
each selected run ID + run_attempt + status + conclusion
each selected job ID + status + conclusion
selected check-suite ID and check-run IDs
```

Polling is not a distributed lock. A human can manually rerun CI after the fence, and GitHub has no atomic “create Release only if this tag still exists and all future CI runs are green” operation. The architecture therefore defines the guarantee as **green at the final fence**, records exact run IDs, and makes later reruns visible in the audit. A future milestone that requires an eternal guarantee should publish inside a dedicated workflow job or introduce a formal release lock; neither belongs in this brownfield recovery.

### Other Race Windows and Mitigations

| Window | Failure | Mitigation |
|---|---|---|
| Tag push → tag run registration | Tool sees only the green main run | Require tag run existence, settle window, final snapshot |
| Main advances after preflight | Release would refer to a commit no longer at the protected tip | Re-read immediately before each mutation; abort on mismatch; never move the tag |
| API response lost after POST/PATCH | Client cannot know whether the object was created | Re-read by natural key; treat exact object as success; bounded retry only after readback |
| Two operators run the tool | Duplicate Milestones or conflicting release attempts | Local lock, 409/422 readback, duplicate detection; never delete remotely |
| Tag is deleted/moved in the tiny REST create window | Release API could create a new tag | Recheck tag before/after; no tag mutation code; record critical partial state and require manual recovery |
| CI is manually rerun after publication | A later failure cannot be undone automatically | Record the fence, do not retag/delete, and treat the release as an incident requiring human review |

## Mutation Order

All writes are conditional on a fresh preflight, lock, and CI fence. The fence is refreshed immediately before each transition (draft POST, publish PATCH, Milestone POST, and close PATCH), not only once at process start. The order is intentional:

```text
lock + final fence
       │
       ├─ reconcile Release
       │    ├─ POST draft Release (only when absent)
       │    ├─ GET/list readback: draft + marker + tag
       │    └─ PATCH draft=false + make_latest (only owned draft)
       │
       ├─ readback Release: published + exact tag
       │
       ├─ recheck target/CI fence
       │
       ├─ reconcile Milestone
       │    ├─ POST open Milestone (only when absent)
       │    ├─ GET/list readback: open + marker + title
       │    └─ PATCH state=closed (only owned open object)
       │
       └─ final readback: tag + main/target + CI + Release + Milestone
```

### Release Reconciliation

Use the script's direct REST client rather than `gh release create` as the mutation primitive. The CLI can create a missing tag by default, which violates the repository policy. `--verify-tag` is a useful human recovery guard, but the reconciler needs its own readback, marker, and state machine. `gh` remains available for authentication and emergency readback, not as the per-request API parser.

**Decision:** use a draft Release even though v0.1.1 has no assets. The extra transition creates a recoverable, non-public checkpoint between the tag/CI gate and the Milestone mutation; a direct published POST remains a possible future simplification only after the state machine is proven and the product explicitly accepts that tradeoff. This milestone uploads no assets and never uses an overwrite/clobber path.

For an absent Release:

```json
{
  "tag_name": "v0.1.1",
  "target_commitish": "10c62ac85fd3ab275b8926c89f5f34ba4116e2cf",
  "name": "v0.1.1",
  "body": "<reviewed notes>\n\n<!-- sgrf-release-close:v1:<marker> -->",
  "draft": true,
  "prerelease": false,
  "generate_release_notes": false
}
```

`target_commitish` is included for audit, but the invariant is the separately verified remote tag. After the POST, list/read the Release and verify `tag_name`, `draft`, `name`, `prerelease`, body/marker, and the tag ref. Then PATCH only the owned draft to `draft:false` (and `make_latest:true` when the reviewed input requests it). Before setting a release latest, read the current latest published release and block if that would silently demote a newer version; the operator/input must make that choice explicit. Never PATCH `tag_name` or `target_commitish` on an existing published object.

A published Release with every semantic field matching the reviewed content is already complete and is left untouched. A draft without the current marker is a conflict, not an object to “fix”; a published object with a different body is also a conflict. GitHub immutable-release protection, if enabled later, reinforces this rule: the tool never attempts to edit a published release.

### Milestone Reconciliation

Create the Milestone open, never directly closed:

```json
{
  "title": "v0.1.1",
  "state": "open",
  "description": "<completion record + Release URL>\n\n<!-- sgrf-release-close:v1:<marker> -->"
}
```

Read back all milestones with `state=all`, select the exact title, and verify the marker/description plus `open_issues == 0`. Leave `due_on` null unless the operator explicitly supplies a real date; never invent a deadline. Only then PATCH `state=closed`. If an exact closed Milestone already exists, treat it as complete after the Release readback; if an open one has no matching marker or has open issues, stop rather than closing a human-owned object or mutating issues. Duplicate titles are a conflict even when their descriptions look similar.

This order gives the safe partial states:

- **Release draft exists, Milestone absent:** rerun can publish the owned draft, then continue.
- **Release published, Milestone open/absent:** rerun creates/closes only the Milestone.
- **Both complete:** rerun is a no-op after full readback.
- **Milestone closed but Release absent:** inconsistent remote state; stop for manual recovery.

There is no cross-object GitHub transaction. The state machine and readback are the recovery mechanism.

## Readback Verification

The final success record must be based on fresh GitHub reads, not the mutation response:

| Object | Read endpoint | Assertions |
|---|---|---|
| Commit | `GET /commits/<target>` | Target SHA and required commit verification policy are recorded; historical mode records the prior proof rather than inferring it. |
| Main | `GET /git/ref/heads/main` | Still matches the close target, or the historical/resume target remains an ancestor of current main. |
| Tag ref | `GET /git/ref/tags/<version>` | Same ref object SHA as preflight; annotated object path unchanged. |
| Tag object | `GET /git/tags/<tag-object-sha>` | Same target commit; no unexpected tag object replacement. |
| CI | Actions runs + jobs and Checks API | Both canonical refs still have the recorded latest successful run attempt and no queued/in-progress run at the fence. |
| Release | `GET /releases/tags/<version>` plus list for draft recovery | `draft:false`, `prerelease:false`, non-null `published_at`, recorded `immutable` state, exact tag/name/body marker, and tag ref still maps to target. |
| Milestone | `GET /milestones?state=all` / `GET /milestones/<number>` | Exact title, `state=closed`, non-null `closed_at`, `open_issues=0`, description/marker, and completion record. |

The final output should include URLs, object IDs/numbers, tag object SHA, target SHA, run IDs/attempts, job IDs, operation UUID, content hash, and every readback timestamp. It should not print auth headers or tokens. The local evidence log is supplemental; GitHub's current objects remain authoritative. A stable machine-readable result should have this shape (the exact schema may evolve):

```json
{
  "schemaVersion": 1,
  "mode": "apply",
  "status": "COMPLETE",
  "repository": "ldsampaio/sgrf",
  "version": "v0.1.1",
  "expectedSha": "10c62ac85fd3ab275b8926c89f5f34ba4116e2cf",
  "observed": {
    "mainSha": "10c62ac85fd3ab275b8926c89f5f34ba4116e2cf",
    "tagObjectSha": "0a68d6f0c55e7be07d13a0bbc4ed36d4af772630",
    "peeledCommitSha": "10c62ac85fd3ab275b8926c89f5f34ba4116e2cf"
  },
  "ci": [{ "name": "backend", "runId": 0, "jobId": 0, "conclusion": "success", "url": "..." }],
  "release": { "id": 0, "url": "...", "draft": false, "prerelease": false, "publishedAt": "..." },
  "milestone": { "number": 0, "state": "closed", "closedAt": "...", "url": "..." },
  "actions": ["create-draft-release", "publish-release", "create-open-milestone", "close-milestone"],
  "mutations": 4
}
```

`verify`, `plan`, and every preflight failure use the same envelope with `mutations:0` and a stable reason code.

## Idempotency, Concurrency, and Retry Boundaries

GitHub's Release and Milestone endpoint references do not document a general `Idempotency-Key` parameter. Implement idempotency as reconciliation:

| Concern | Key/mechanism | Behavior |
|---|---|---|
| Release natural key | Repository + exact `tag_name` | Read all Releases; one exact published match is a no-op; one owned draft is publishable; anything else conflicts. |
| Milestone natural key | Repository + exact `title`, plus marker | Read `state=all`; zero/one/multiple exact matches have explicit transitions. |
| Ownership marker | SHA-256 of repository, version, target SHA, and canonical content inputs | Required to mutate a draft/open object; changed content cannot accidentally take over an old object. |
| Run fence | Target SHA + run IDs + attempts + job/check IDs | New runs/attempts reset the settle timer; the exact tuple is written to the audit log. |
| Operation identity | Random UUID (`operationId`) | Correlates one invocation and its log events; it is not a remote idempotency key. |
| Local concurrency | Atomic lock file for repo + version | Prevents two invocations on one workstation; it is advisory across workstations. |
| Remote concurrency | Natural-key readback and 409/422 handling | If a concurrent create wins, the loser reads and continues only if the object matches; duplicates are never deleted automatically. |

Mutation retry policy:

- Retry GETs on transport errors and documented rate-limit responses with bounded exponential backoff and at least a one-second gap between mutative requests.
- Never retry a POST/PATCH solely because the process did not receive a response. First re-read the object.
- On `409`/`422`, read the natural key and classify `created`, `already-matching`, or `conflict`.
- On an uncertain final state, exit `PARTIAL_UNVERIFIED`; preserve the evidence log and let the same operator rerun with the same reviewed content.

## Failure Boundaries and Recovery

| Failure point | Remote state | Safe behavior | Recovery |
|---|---|---|---|
| Input/auth/content preflight | No tool mutation | Stop with `BLOCKED`; do not infer a version or repo from local state. | Fix input/credentials and rerun. |
| `apply` local checkout dirty/off `main` | No tool mutation | Stop with `LOCAL_DIRTY`/`LOCAL_REF_MISMATCH`; use a clean operator checkout. | `verify`/`plan` remain available; do not stash/reset unrelated planning state automatically. |
| Missing, lightweight, or mismatched tag | No tool mutation | Stop; never create, move, or delete a tag. | Human creates/reviews the annotated tag in the existing manual process, then reruns. |
| CI absent, pending, failed, ambiguous, or still late | No tool mutation | Wait only within the bounded timeout; then stop. | Fix/rerun the exact target CI or inspect the conflicting run; never use a different SHA. |
| Main/tag ref changes before first write | No tool mutation | Abort and restart preflight with the new snapshot. | Re-review the release target; do not retarget an existing object automatically. |
| Release POST returns timeout/5xx | Object may or may not exist | Read all Releases by tag before any retry. | Continue if exact owned draft exists; otherwise retry only within policy or report uncertain. |
| Release exists with a conflicting body/tag/draft marker | Existing public/draft object | `CONFLICT`; no PATCH or DELETE. | Human decides whether to preserve, edit, or remove the object outside this tool. |
| Release publish PATCH times out | Draft or published object | Read Release and classify current state. | Continue if exact published object exists; otherwise bounded retry. |
| Main advances after draft creation | Owned draft may exist | Stop before Milestone mutation. | Re-review target and rerun with the same reviewed content; do not move the tag. |
| Milestone POST returns timeout/5xx or duplicate race | Milestone may exist | Read `state=all`, filter exact title/marker, and detect duplicates. | Continue one exact owned open object; block on multiple/unmanaged objects. |
| Milestone close PATCH times out | Open or closed object | Read Milestone by number. | Treat exact closed state as success; otherwise bounded retry. |
| Final readback disagrees with the planned state | Mixed/partial remote state | Return `PARTIAL_UNVERIFIED`; never auto-delete or unpublish. | Archive evidence, inspect GitHub manually, rerun reconciliation with the same reviewed content. |
| Local lock is stale or another operator is active | Unknown concurrent progress | Stop without writes. | Verify the other process and remote state; remove the local lock only by explicit operator action. |

There is no safe automatic rollback for a published Release or closed Milestone. The recovery contract is “read, classify, continue exact state,” not “undo and try again.”

## Permissions and Security Boundaries

### Operator Permissions

Before the first write, verify that the authenticated actor can read the repository and that the write surface is limited to the two intended resource types.

Logical minimum permissions:

- repository metadata, contents/refs, commits/tags: read;
- Actions workflow runs/jobs and Checks: read;
- Releases: read/write;
- Milestones (Issues API): read/write;
- branch protection/Administration: read only;
- workflow files: read only; no workflow mutation.

| Operation | Minimum logical permission | Current operator path |
|---|---|---|
| Read repository/refs/commit/tag | Contents: read | Existing authenticated `gh` account |
| Read workflow runs/jobs | Actions: read | Existing `gh` credential |
| Read Check Runs | Checks: read or credential equivalent | Smoke-test any replacement credential |
| Read branch protection | Administration: read where required | Do not substitute CI `GITHUB_TOKEN` |
| Create/update Release | Contents: write | Existing `repo`/OAuth scope; add Workflows write if target changes workflow files |
| Create/update Milestone | Issues: write | Existing `repo`/OAuth scope |

A classic PAT may require `repo` and, when the resolved target changes workflow files, `workflow`; the current workstation reports `repo` and `workflow`. A fine-grained token should be evaluated separately for Contents, Issues, Actions, Checks, Metadata, and the workflow permission required by the resolved target. The tool should fail with a clear permission diagnostic before any POST/PATCH, rather than discovering a 403 halfway through publication. GitHub has no safe dry-run write endpoint: the preflight proves repository identity, actor permissions/scopes, and all required reads; it must not send a dummy Release/Milestone mutation merely to test authorization.

Use `gh`'s credential store/keyring or an environment variable supplied by the operator's secret manager. Do not accept a token as a command-line argument, print it in errors, or write it to the audit log. A new GitHub App is not justified for this milestone; the authenticated operator identity and existing `gh` surface are sufficient and more auditable.

### Repository Safety Controls

- Keep `main` protection unchanged; the tool reads `backend`/`frontend` and never changes the required-check list.
- Keep tag creation/deletion under the existing manual, operator-controlled process. A tag ruleset or tag-protection rule is a recommended future hardening option, not a mutation hidden in this tool.
- Treat the release body/record as untrusted input for logging: redact control characters and never log full request headers. Create the local lock/evidence directory with owner-only permissions and the JSONL file with mode `0600`.
- Validate repository slug, version syntax, and reviewed-content schema before making a request. A version is a release identifier, not an arbitrary branch name or shell fragment.
- Use `child_process.execFile`/argument arrays for `gh`, never `shell: true` string interpolation.

## Test and Negative-Control Matrix

The implementation must use a fake `GitHubClient` or a disposable repository; normal tests must never mutate `ldsampaio/sgrf`.

| Fixture | Expected result | Required negative assertion |
|---|---|---|
| Missing tag or lightweight tag | `TAG_MISSING`/`TAG_NOT_ANNOTATED` | Zero Release/Milestone/ref writes |
| Annotated tag peeling to wrong SHA | `TAG_TARGET_MISMATCH` | Zero writes |
| Historical red run on another SHA + green target | Target preflight passes | Historical run is not selected |
| Pending, skipped, neutral, wrong-app, or wrong-workflow check | `CI_NOT_READY`/`CI_SOURCE_MISMATCH` | No “latest run” shortcut |
| No Release | One create, then ID-based readback | No automatic tag creation |
| Matching draft Release | Publish only that ID if content matches | No second Release |
| Two Releases with same tag | `RELEASE_AMBIGUOUS` | No create/edit/delete |
| No Milestone | Create open once, close by persisted number after Release readback | No close-by-title |
| Closed Milestone only on page two | Found with `state=all` + pagination | No duplicate create |
| Duplicate exact-title Milestones | `MILESTONE_AMBIGUOUS` | No arbitrary-number close |
| POST commits then connection drops | Readback adopts exact object | No blind second POST |
| 403/404 permission response | Permission/unverifiable diagnosis | Never interpret as object absence |
| Main advances after preflight | Abort before next mutation | No retarget or tag write |
| New run appears during settle | Reset fence and wait | No publication against unstable evidence |
| Malicious version/title/notes string | Validation rejects or passes as JSON data | No shell side effect |
| 429/secondary limit | Honor `Retry-After`, bounded backoff | No unbounded mutation retry |

## Data Flow

### Request/Run Flow

```text
operator command
    ↓
argument + input validation
    ↓
acquire apply lock (verify/plan remain read-only)
    ↓
remote repository/ref/policy reads
    ↓
remote Release/Milestone classification
    ↓
CI run/job/check snapshot
    ↓
wait for main + tag runs and stable fingerprint
    ↓
final fence
    ↓
Release draft create/readback → publish/readback
    ↓
recheck target/CI
    ↓
Milestone open create/readback → close/readback
    ↓
final remote readback + JSONL audit + result
```

The process is intentionally single-writer and sequential. It does not parallelize Release and Milestone mutations because their ordering is a safety invariant.

### Key Data Flows

1. **Target flow:** remote `main` ref → peeled annotated tag → expected target SHA; the same SHA is carried into CI selection and every mutation audit event.
2. **Evidence flow:** Actions workflow runs → job results → Checks API/check-suite cross-check → stable CI fingerprint → final readback.
3. **Publication flow:** reviewed notes/record → Release natural-key reconciliation → published Release readback → Milestone natural-key reconciliation → closed Milestone readback.
4. **Recovery flow:** uncertain response → fresh remote natural-key read → exact-match continuation or explicit conflict/partial result; never a blind mutation retry.

### State Ownership

| State | Owner | Durability |
|---|---|---|
| Source commit and tag | GitHub Git database | Remote authoritative; never rewritten by the tool. |
| CI evidence | GitHub Actions/Checks | Remote authoritative; run IDs and attempts are immutable evidence. |
| Release/Milestone desired content | Reviewed notes/record files or stdin | Hashed into the invocation; not a substitute for remote readback. |
| Current publication progress | GitHub objects | Read fresh on every invocation; no trusted progress database. |
| Operation trace | Local JSONL + stdout | Supplemental audit; archive outside Git if required. |
| Concurrency hint | Local lock | Advisory only; remote conflict handling remains mandatory. |

## Architectural Patterns

### Pattern 1: Remote-truth reconciliation, not a one-shot release command

**What:** Model publication as `observe → decide → mutate one guarded transition → observe again`. The process may be interrupted anywhere; the next run reconstructs state from GitHub.

**When to use:** Whenever more than one remote object is involved or a request can succeed without a response.

**Trade-offs:** More API reads and a slightly longer operation than `gh release create`; in exchange, retries are safe, conflicts are visible, and partial success is recoverable.

### Pattern 2: Natural-key idempotency with an ownership marker

**What:** Use the exact tag as the Release key and exact title as the Milestone lookup key, then require a deterministic marker before transitioning a draft/open object.

**When to use:** GitHub resources that do not provide a project-owned uniqueness constraint or server-side idempotency key.

**Trade-offs:** A manually created exact object may be accepted as a no-op only when all semantic fields match; otherwise it is deliberately left for human review. This is safer than silently adopting or overwriting a human publication.

### Pattern 3: Canonical CI fence

**What:** Bind the gate to the exact target SHA, workflow path, expected push ref, latest attempt, and required job/check IDs; observe a stable fingerprint before writing.

**When to use:** Any repository where pushes trigger more than one CI run for the same commit, especially when a tag is pushed after `main`.

**Trade-offs:** The tag run can take longer than the main run and the settle interval adds delay. Requiring it prevents the known late-run race; a future manual rerun remains an external event and is recorded rather than hidden.

### Pattern 4: Two-phase Release/Milestone publication

**What:** Publish a draft only after preflight, then create/open and close the Milestone only after the Release is publicly readable.

**When to use:** Two remote publication objects must represent one coherent milestone closure.

**Trade-offs:** There are more requests and a recoverable draft intermediate state. The alternative—closing the Milestone first or publishing both without readback—can leave a closed milestone with no release or an unverifiable public object.

## Scaling Considerations

This milestone scales the number of release operations, not the SGRF application.

| Scale/concurrency | Approach |
|---|---|
| A few releases, one operator | The local Node tool, local lock, and GitHub natural keys are sufficient. No service, database, queue, or webhook receiver. |
| Several operators on separate workstations | Keep conflict-on-mismatch and duplicate detection; consider a future GitHub App/environment lock only if duplicate Milestones become a real operational problem. |
| More than 100 Releases/Milestones | Use paginated list reads and exact filters; never stop at the first page. The current repository is far below this threshold. |
| Many CI runs for one SHA | Filter by `head_sha`, workflow path, event, ref, and attempt; fingerprint all relevant runs instead of relying on list order. |
| Enterprise/centralized operators | Re-evaluate fine-grained token/GitHub App permissions, but do not introduce a hosted publisher in v0.1.2. |
| Application scale | Unchanged. The tool never connects to Express, Prisma, PostgreSQL, or Docker. |

### Scaling Priorities

1. First bottleneck: GitHub API consistency/latency and a late CI run; solve with bounded polling, exact-SHA selection, and readback.
2. Second bottleneck: concurrent operators or duplicate milestone titles; solve with conflict detection before considering a remote lock service.
3. Not a current bottleneck: local script execution time or application resources.

## Anti-Patterns to Avoid

### Anti-Pattern 1: Using `gh release create` without `--verify-tag`

**What people do:** Run `gh release create v0.1.1` and assume the tag already exists.

**Why it's wrong:** The CLI can create a tag from the default branch when the requested tag is absent. A tag race could then publish the wrong commit or move a previously reviewed ref.

**Do this instead:** Use the script's direct REST client only after a remote annotated-tag read, send the existing tag in the Release body request, recheck the tag, and never implement a tag mutation path.

### Anti-Pattern 2: Trusting local `HEAD`, a local tag, or a branch name

**What people do:** Derive the target from `git rev-parse HEAD`, `git describe`, or `origin/main` without querying GitHub at execution time.

**Why it's wrong:** The operator can be on a planning commit, a stale fetch, a dirty tree, or a different clone. In this repository the local planning commit is already ahead of remote `main`.

**Do this instead:** Resolve `refs/heads/main`, `refs/tags/<version>`, and the target commit through GitHub; record local data only as tool/content provenance.

### Anti-Pattern 3: Treating the combined commit status as CI proof

**What people do:** Call `/commits/{sha}/status` and require `state == success`.

**Why it's wrong:** The current repository has successful Actions check runs while the legacy combined status endpoint returns zero statuses. Required checks are represented by Checks API objects in this setup.

**Do this instead:** Select Actions workflow runs by exact SHA/ref, inspect their jobs, and cross-check the corresponding check runs and check-suite ID.

### Anti-Pattern 4: Searching for any green run

**What people do:** Find a successful run for the commit somewhere in a paginated list and proceed.

**Why it's wrong:** It may be a different workflow, a PR merge run, a different attempt, or a run whose required job was skipped/failed. It also ignores a late tag run.

**Do this instead:** Require the `CI` workflow path, `push` event, exact target SHA, both expected refs, latest attempt, and both required jobs.

### Anti-Pattern 5: Overwriting or adopting conflicting objects

**What people do:** `PATCH` an existing Release body, close any Milestone with the same title, or delete duplicates to make the command succeed.

**Why it's wrong:** It destroys human publication decisions and can make the milestone look complete while pointing at the wrong object.

**Do this instead:** exact semantic match is a no-op; marker-owned draft/open objects may transition; all other objects are conflicts requiring human resolution.

### Anti-Pattern 6: Creating a closed Milestone before a Release

**What people do:** POST the Milestone with `state:"closed"` first because it is one call.

**Why it's wrong:** A network failure or Release permission error leaves a closed milestone with no published release, violating the milestone contract.

**Do this instead:** create open, verify Release first, then close the owned Milestone.

### Anti-Pattern 7: Blindly retrying POST/PATCH after a timeout

**What people do:** Reissue the same mutation because the command returned no response.

**Why it's wrong:** The first request may have succeeded; a retry can create a duplicate or overwrite a human's object.

**Do this instead:** classify as uncertain, read the natural key, and continue only if the remote object matches.

### Anti-Pattern 8: Adding a daemon, webhook receiver, or hosted publisher

**What people do:** Build a release service because the GitHub API has many edge cases.

**Why it's wrong:** It expands the trust boundary and operational surface for a small, operator-invoked, low-frequency operation.

**Do this instead:** use a local script, the existing GitHub CLI authentication, deterministic readback, and a local audit log.

## Integration Points

### Existing Repository Surfaces

| Boundary | Communication | Change |
|---|---|---|
| `scripts/github-release-close.mjs` ↔ GitHub REST | Built-in `fetch` with `GH_TOKEN`/`GITHUB_TOKEN` or an in-memory `gh auth token` value | New; token stays in memory/gh credential store. |
| Release tool ↔ `.github/workflows/ci.yml` | Read Actions runs/jobs/check suites; no checkout/build | New read-only gate; workflow file unchanged. |
| Release tool ↔ branch protection | REST read of required contexts | New read-only policy check; no PUT. |
| Release tool ↔ Git refs/tags | Git database REST reads | New read-only tag verification; no ref writes. |
| Release tool ↔ Releases | REST list/get/create/patch | New guarded Release reconciliation. |
| Release tool ↔ Milestones | REST list/get/create/patch | New guarded Milestone reconciliation. |
| Release tool ↔ local notes/evidence | Filesystem | Hash reviewed input files, write optional evidence/lock output; no local state is treated as remote truth. |
| Operator docs ↔ `AGENTS.md`/`README.md` | Human procedure | Modified links and guardrails. |

### External Services

| Service | Integration pattern | Failure boundary |
|---|---|---|
| GitHub Git database | REST ref/tag-object reads | Missing/lightweight/moved tag blocks with no write. |
| GitHub Actions | REST workflow-run/job reads and Checks API | Pending/failed/ambiguous evidence blocks; never fall back to a global green scan. |
| GitHub Releases | REST list/get/create/patch | POST uncertainty is resolved by readback; published object is immutable to this tool. |
| GitHub Milestones/Issues | REST list/get/create/patch | Duplicate/unmanaged title conflicts; no deletion. |
| GitHub CLI (`gh`) | Local authenticated subprocess | Missing auth/permissions stops before mutation; no token logging. |

## Safe Build Order and Roadmap Implications

The downstream `REQUIREMENTS.md` and `ROADMAP.md` should preserve this dependency order. The labels below are candidate requirement/phase seams, not new application features. If the roadmap calls the one-time v0.1.1 recovery “P1,” that priority describes the business objective, not permission to mutate before the contract, read-only preflight, and fixture gates below.

### Phase 1 — Contract, fixtures, and pure state machine

**Build:** `docs/17-github-release-close.md` draft, `verify`/`plan`/`apply` command contract, stable reason codes/evidence schema, reviewed-notes input rules, marker/hash rules, state classifications, and pure preflight/reconcile fixtures.

**Depends on:** Existing `PROJECT.md`, `AGENTS.md`, `ci.yml`, live tag evidence.

**Blocks:** All remote mutation code.

**Do not:** Run a live POST/PATCH or create a tag.

### Phase 2 — Read-only REST client and live verification

**Build:** `scripts/github-release-close.mjs` client/auth boundary, API-version/permission checks, pagination, exact ref/workflow/run/check/release/milestone reads, commit/tag signature readback, and `verify`/`plan` commands.

**Depends on:** Phase 1.

**Verification:** `verify` v0.1.1 reports tag object `0a68...`, target `10c62...`, verified commit, main/tag run tuple, Release `MISSING`, Milestone `MISSING`, and `mutations=0`.

### Phase 3 — Idempotent apply, evidence, and recovery tests

**Build:** `apply` state machine, draft Release → publish, open Milestone → close, marker/conflict handling, local lock, evidence output, timeout/429/409 fixtures, and final readback.

**Depends on:** Phases 1–2.

**Verification:** Fake-client tests prove every partial state, that no code path contains delete/ref mutation, and that a lost POST response converges on rerun without a second POST.

### Phase 4 — CI fence rehearsal and operator runbook

**Build:** Settle/fence implementation, delayed-tag-run fixture, permissions checklist, stable exit codes, recovery matrix, and AGENTS/README updates.

**Depends on:** Phase 3.

**Verification:** A simulated late tag run resets the fence; a late failure blocks; a stable green tuple permits only the next guarded step; a historical mode remains read-only unless an explicit prior partial state is proven.

### Phase 5 — Live v0.1.1 recovery

**Build:** No code changes unless rehearsal finds a defect. An operator runs `apply` against `ldsampaio/sgrf` with the pinned expected SHA and reviewed notes.

**Depends on:** Phases 1–4 and an explicit operator confirmation.

**Mutation order:** draft Release → readback → publish → readback → open Milestone → readback → close → final readback.

**Verification:** Fresh GitHub reads show the preserved tag, verified commit, published Release, closed Milestone, and exact successful run/job/check IDs.

### Phase 6 — Closeout and future policy decision

**Build:** Archive the evidence externally if required, update milestone/requirements evidence, and decide separately whether tag protection or a publisher workflow is needed for later releases.

**Depends on:** Phase 5 complete.

**Do not:** Rewrite the v0.1.1 tag, historical release notes, CI evidence, or application code as part of closeout.

### Dependency Graph

```text
contract/content contract
    ↓
pure evaluator + state tests
    ↓
read-only REST client + verify/plan
    ↓
guarded apply + evidence/lock
    ↓
CI-fence rehearsal + runbook
    ↓
operator-confirmed v0.1.1 recovery
    ↓
final readback + milestone closeout
```

This ordering ensures a failed or interrupted implementation cannot accidentally mutate GitHub, and a successful implementation can recover a prior partial publication without relying on local progress state.

## Acceptance Invariants for Downstream Requirements

The downstream requirements should be testable in these terms:

- A missing, lightweight, moved, or mismatched tag causes **zero** remote mutations.
- A local branch/HEAD different from the remote target cannot change the target SHA.
- A new close requires the intended commit's GitHub verification; the tag-object signature is recorded independently and is not silently substituted.
- A green run for another SHA/workflow/ref cannot satisfy the gate.
- A pending, failed, canceled, ambiguous, or late tag run cannot satisfy the gate.
- The tool never intentionally creates, moves, or deletes a tag; Release creation is guarded by before/after tag reads, and any tag drift is a critical conflict rather than an accepted shortcut.
- A Release timeout/connection failure is followed by a readback before any retry.
- A published Release is never overwritten; an exact match is a no-op and a mismatch is a conflict.
- A Milestone is never closed before the Release is published and read back.
- A Milestone with associated open issues is not silently closed or repaired; the tool reports a conflict.
- A duplicate/unmanaged Milestone is never deleted or silently adopted.
- Re-running a complete v0.1.1 close produces `COMPLETE/NOOP` with no duplicate Release or Milestone.
- A partial v0.1.1 close is `PARTIAL_UNVERIFIED` and can be continued with the same reviewed content after inspection.
- The final result is backed by GitHub API readback, not local Git or a local success message.
- The audit log contains no token, authorization header, or secret value.

## Sources

### In-repository evidence — HIGH

- `.planning/PROJECT.md` — v0.1.2 goal, tag preservation, operator-invoked boundary, required CI/ref/release/milestone invariants, and v0.1.1 target `10c62ac`.
- `.github/workflows/ci.yml` — push/PR triggers, exact `backend`/`frontend` jobs, Node 22, PostgreSQL service, and no release mutation permissions.
- `AGENTS.md` — CI gate, required contexts, no lint/typecheck, manual GitHub operation context, and repository danger zones.
- `.gitignore`, `README.md`, `.planning/ROADMAP.md`, and `.planning/STATE.md` — existing documentation/runtime boundaries and current milestone context.
- Live Git/GitHub readback on 2026-09-25: `refs/heads/main=10c62ac...`; annotated `v0.1.1` tag object `0a68...` peeling to `10c62ac...`; target commit verification green while tag-object verification is unsigned; v0.1.1 Release and Milestone absent; main/tag CI runs and jobs successful; historical release-branch red runs (including root incident `36095528423` on `826953c...`) are on other SHAs; branch protection contexts `backend`/`frontend`, `strict:false`, admin enforcement enabled; local `HEAD=14f3da6...` and dirty planning state.

### GitHub official documentation — MEDIUM (endpoint behavior cross-checked against live reads)

- [REST API: Releases](https://docs.github.com/en/rest/releases/releases) — release fields, existing-tag behavior, list/get/create/patch semantics.
- [REST API: Milestones](https://docs.github.com/en/rest/issues/milestones) — milestone fields, `state=all`, create/update/readback semantics.
- [REST API: Check runs](https://docs.github.com/en/rest/checks/runs) — commit-ref check-run listing, status/conclusion, and check-suite association.
- [REST API: Workflow runs](https://docs.github.com/en/rest/actions/workflow-runs) — exact `head_sha`, event, branch, status, attempt, and job readback.
- [REST API: Git references](https://docs.github.com/en/rest/git/refs) — ref reads and the difference between writable ref endpoints and the tool's read-only use.
- [REST API: Git tags](https://docs.github.com/en/rest/git/tags) — annotated tag objects and peeling to commits.
- [GitHub CLI: `gh release create`](https://cli.github.com/manual/gh_release_create) — automatic tag creation and `--verify-tag`; reason the reconciler uses direct REST instead.
- [GitHub Actions events that trigger workflows](https://docs.github.com/en/actions/using-workflows/events-that-trigger-workflows) — multiple `push` events can create multiple runs and `workflow_dispatch`/tag behavior.
- [Protected branches](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-protected-branches/about-protected-branches) — required check conclusions and branch-protection behavior.
- [REST API quickstart/authentication](https://docs.github.com/en/rest/using-the-rest-api/getting-started-with-the-rest-api) — `gh api` authentication, API headers, request IDs, and token handling.

### Research seam notes

The GSD research plan selected Brave-backed web research, but Brave was unavailable because `BRAVE_API_KEY` is not configured. The relevant claims were therefore checked against the official GitHub documentation and live GitHub API reads. The seam classified the documentation provider as **LOW** without cross-check; the architecture marks API edge behavior **MEDIUM** and relies most strongly on the direct repository/live-GitHub evidence above.

---

*Architecture research for: SGRF v0.1.2 GitHub Release Reliability*
*Researched: 2026-09-25*
*Recommended terminal state: GitHub Release and Milestone exist for the preserved annotated target tag, with a fresh CI/ref/remote readback proving coherence.*
