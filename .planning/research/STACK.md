# Stack Research

**Domain:** Reliable, operator-invoked GitHub Release and Milestone publication for SGRF v0.1.2
**Project:** SGRF/SGRD (`ldsampaio/sgrf`)
**Researched:** 2026-09-25
**Confidence:** MEDIUM-HIGH. GitHub behavior was checked against current first-party documentation and read-only live API/CLI evidence; the research seam classifies the verified web provider as MEDIUM. Repository-specific facts are HIGH because they were read directly from this checkout and GitHub.

## Decision

Add **one checked-in Node.js 22 ESM reconciler** at `scripts/github-release-close.mjs`, with built-in `fetch`, `node:test`, and no npm dependency. Use the GitHub CLI as the operator's authentication/recovery surface ([`gh auth status`](https://cli.github.com/manual/gh_auth_status), [`gh auth token`](https://cli.github.com/manual/gh_auth_token), and the existing `gh` credential), and use the GitHub REST API as the only remote source of truth.

Do **not** add a release workflow, release action, Octokit, `semantic-release`, Changesets, a second state file, or a new root package. The existing `.github/workflows/ci.yml` remains the regression gate. If a hosted `workflow_dispatch` wrapper is wanted later, it must call this same script rather than reimplementing publication logic.

This is deliberately a tooling-only addition. Express, Prisma, PostgreSQL, Vue, Vite, the two npm packages, and the backend/frontend verification commands do not change.

This is a stack recommendation, not an executed publication. No GitHub object was mutated during research; the Node client, fixture tests, and one live read-only `verify` pass are implementation-phase acceptance work.

## Repository Fit and Current Baseline

| Observation | Consequence for the stack |
|-------------|-----------------------------|
| The repo is brownfield: Node 22, Ubuntu-hosted Actions, two independent npm packages, and no root workspace | A root-level `scripts/` tool is appropriate; do not add a workspace or alter either `package.json`. |
| `gh` 2.101.0 is installed locally (released 2026-09-15) and GitHub documents it as preinstalled on hosted runners | Use `gh` for local auth and manual recovery; do not package it as an npm dependency. |
| The current local operator credential has `repo` and `workflow` scopes | The existing `gh` login is sufficient for the normal release/milestone path; tokens must never be printed or committed. |
| `main` is `10c62ac85fd3ab275b8926c89f5f34ba4116e2cf`; annotated `v0.1.1` resolves `refs/tags/v0.1.1` → tag object `0a68d6f0c55e7be07d13a0bbc4ed36d4af772630` → that commit | The tool must dereference the tag object. It must not infer the target from `release.target_commitish`. |
| `v0.1.1` Release is absent; no `v0.1.1` Milestone exists; the latest `v0.1.0` Release does exist | The first apply must inventory by exact tag/title, create only missing objects, and never assume the first/latest object is the target. |
| Target-SHA `backend` and `frontend` check runs and CI workflow runs are successful; required contexts are app-bound to GitHub Actions, with `strict:false` and admin enforcement enabled | Gate on exact-SHA check runs/jobs, not on the branch name or the latest run. `strict:false` is not a reason to skip the explicit main/tag equality guard. |
| The combined commit-status endpoint is empty/pending for this SHA even though the Actions check runs are green | Do not use `/commits/{sha}/status` as the release gate. Read Check Runs and the target workflow's jobs. |
| The research checkout is currently ahead of `origin/main` and has an uncommitted planning-state file | The remote checks remain authoritative, but an apply must additionally require a clean checkout on `main` at the expected SHA. Use a clean clone/worktree for the real publication. |

## Recommended Stack

### Core Technologies

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|------------------|
| Node.js | Existing Node 22 runtime | ESM release-close CLI, JSON/state validation, REST client, and tests | Already present in both packages and CI; built-in `fetch` and `node:test` cover this tool without a dependency or root workspace. It is more reliable than embedding multiline JSON and HTTP-status logic in Bash. |
| GitHub CLI (`gh`) | 2.101.0 is the current tested local version; do not pin a local package | Operator authentication, `gh auth status`/`gh auth token`, one-off readback, and recovery | GitHub's current manual documents the required commands and hosted runners already provide `gh`. It avoids a second credential store and gives the operator a familiar audit trail. |
| GitHub REST API | Pin the client headers to `Accept: application/vnd.github+json`, `X-GitHub-Api-Version: 2026-03-10` (the version shown in the current docs), and a non-secret `User-Agent` | Release, Milestone, ref, annotated-tag, commit, Check Run, workflow-run, job, and branch-protection reads/writes | The API exposes the exact fields and permissions needed. Direct `fetch` gives the reconciler HTTP status codes, pagination, and structured JSON without shelling out for every request. |
| Git | Existing Git 2.x | Local clean-checkout/branch/SHA safety check and human recovery commands | Local Git is useful evidence, but the script must compare the remote `main` and peeled tag SHAs; it must never use local refs as publication proof or mutate the tag. |
| GitHub Actions `ci.yml` | Existing workflow; jobs `backend` and `frontend` | Required CI evidence for the target SHA | This is already the project's regression gate. The release tool reads its Check Runs/jobs; it must not add publication to the normal push/PR path. |

### Supporting Libraries and Tools

There are **no new npm libraries**. Use only Node built-ins (`fetch`, `URL`, `crypto` if needed for a plan digest, `child_process` for `gh auth`, and `node:test`) plus the operator's installed Git and GitHub CLI.

| Tool | Purpose | When to Use |
|------|---------|-------------|
| `gh auth status --hostname github.com --active` | Prove that an active account is usable before any API call | Every local `verify`, `plan`, and `apply`; fail before writes if auth is unhealthy. |
| `gh auth token --hostname github.com` | Supply a token to the Node client when `GH_TOKEN`/`GITHUB_TOKEN` is not already set | Capture in memory/environment only; never echo, log, or write it. |
| `gh api` | Manual readback and emergency inspection | Recovery and operator diagnosis; the canonical script may use direct `fetch`, but both must target the same repository and API contract. |
| `gh run list --commit <sha> --workflow ci.yml` and `gh run view --json jobs` | Human-readable exact-SHA evidence | Manual verification and troubleshooting; scripted gate should query the equivalent REST endpoints. |
| `git status --porcelain`, `git branch --show-current`, `git rev-parse HEAD` | Local apply safety | `apply` only; `verify` should remain usable from a clean or dirty audit checkout because it is remote-only. |
| `node --test scripts/github-release-close.test.mjs` | Fixture tests for reconciliation and failure semantics | Implementation/phase verification; it is not a replacement for the existing backend/frontend CI commands. |

`jq` and raw `curl` are not required dependencies. If a Bash implementation is chosen later, use `gh --jq` rather than assuming a separately installed `jq`; keep `curl` out of the canonical path so token/header handling stays in one client.

## Installation and Operator Setup

There is no package installation and no lockfile change.

```bash
# Existing runtime checks
node --version                 # Node 22
git --version                  # existing Git toolchain
gh --version                   # 2.101.0 was verified locally

# One-time operator authentication, if needed
gh auth login --hostname github.com --git-protocol https --web
gh auth status --hostname github.com --active

# Optional noninteractive form for the Node client; do not print this value
GH_TOKEN="$(gh auth token --hostname github.com)" \
  node scripts/github-release-close.mjs verify ...
```

The script should accept `GH_TOKEN` first, then `GITHUB_TOKEN`, and only then call `gh auth token` if neither is present. It must never persist a token or include one in an evidence record. GitHub documents fine-grained PATs as preferable for new credentials, but its general PAT guidance still lists a Checks API limitation while the Check Runs endpoint reference lists `Checks: read`; therefore, the already-authenticated `gh` OAuth credential is the safest current operator path. Smoke-test any future fine-grained PAT against the exact check-runs endpoint before making it a release dependency.

For the current v0.1.1 recovery, the reviewed notes and Milestone completion record are content inputs (files or standard input), not a second state store. The existing annotated tag message may be used as factual source material, but generated notes are not the default.

## Proposed Repository Shape and Integration Points

```text
scripts/
├── github-release-close.mjs       # CLI, API client, reconciler, evidence output
└── github-release-close.test.mjs  # node:test fixtures; no network in unit tests
.github/workflows/ci.yml           # unchanged regression gate
AGENTS.md                          # add the operator command/auth prerequisites
docs/                              # add release-close recovery/runbook documentation
```

No `backend/package.json`, `frontend/package.json`, workspace, database migration, application route, or CI test/build command changes are needed. The documentation should describe the command and recovery policy; GitHub API/CLI readback, not a GSD file or a local manifest, remains authoritative.

The script should be split internally into pure reconciliation functions and a small `GitHubClient` interface. Unit tests can feed the pure functions synthetic Release/Milestone/check-run inventories; integration verification performs read-only calls against the real repository. Do not make live mutation tests part of normal CI.

## Command and Data Contract

### Modes

Use explicit modes so a human can audit before mutating:

```bash
node scripts/github-release-close.mjs verify \
  --repo ldsampaio/sgrf --version v0.1.1 \
  --expected-sha 10c62ac85fd3ab275b8926c89f5f34ba4116e2cf

node scripts/github-release-close.mjs plan \
  --repo ldsampaio/sgrf --version v0.1.1 \
  --expected-sha 10c62ac85fd3ab275b8926c89f5f34ba4116e2cf \
  --notes-file /path/to/reviewed-release-notes.md \
  --milestone-description-file /path/to/reviewed-milestone-record.md

node scripts/github-release-close.mjs apply \
  --repo ldsampaio/sgrf --version v0.1.1 \
  --expected-sha 10c62ac85fd3ab275b8926c89f5f34ba4116e2cf \
  --notes-file /path/to/reviewed-release-notes.md \
  --milestone-description-file /path/to/reviewed-milestone-record.md \
  --yes
```

`verify` and `plan` must perform zero mutations. `apply` must refuse to run unless the same preflight passes, the plan is shown, and the operator supplies an explicit confirmation. A `--historical`/`--resume` mode may audit an already-started close when current `main` has advanced; it may finish only when the Release already exists or the operator supplies evidence of a prior partial attempt, and it must record that mode rather than pretend that a new close-time SHA is the historical proof.

### Inputs

| Input | Required | Contract |
|-------|----------|----------|
| `--repo` | Yes | Exact `owner/repo`; compare it to `GET /repos/{owner}/{repo}` before any write. |
| `--version` | Yes | Strict version such as `v0.1.1`; do not accept an arbitrary branch name. |
| `--expected-sha` | Yes | Full 40-character commit SHA supplied by the operator or close record. Never infer it from a moving local `HEAD`. |
| `--base-ref` | Defaults to `main` | Remote ref to compare during a new close; the current repository contract is `main`. |
| `--required-check` | Repeatable; defaults to `backend,frontend` | Names must match the protected contexts and the actual job names in `.github/workflows/ci.yml`. |
| `--notes-file` | Yes for apply; optional for verify | Reviewed factual Release body. The file is an input artifact, not a remote-state cache. |
| `--milestone-description-file` | Yes for apply; optional for verify | Concise completion record naming the version, target SHA, Release URL, CI evidence, and factual accomplishments. Leave `due_on` null unless the operator explicitly supplies a real date. |
| `--prerelease` | Optional, default `false` | Make the desired Release flag explicit rather than inheriting CLI defaults. |
| `--latest` | Optional/explicit | Do not make “latest” part of v0.1.2 completion unless the product decision is recorded. |
| `--historical` | Optional | For audit/resume only; current-main divergence is informational, but tag/CI/Release/Milestone evidence must remain coherent. |

### Outputs and exit behavior

Human-readable progress and stable reason codes go to stderr. A single secret-free JSON result goes to stdout so an operator can redirect it to a temporary evidence file or CI log:

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
  "ci": [
    { "name": "backend", "conclusion": "success", "url": "..." },
    { "name": "frontend", "conclusion": "success", "url": "..." }
  ],
  "release": { "id": 0, "url": "...", "draft": false, "prerelease": false, "immutable": false, "tagName": "v0.1.1" },
  "milestone": { "number": 0, "state": "closed", "url": "...", "closedAt": "..." },
  "actions": ["create-release", "create-milestone(closed)"],
  "mutations": 2
}
```

The exact schema can evolve, but it must include the repository, version, expected/observed SHAs, selected run/job IDs and URLs, Release ID/URL, Milestone number/URL, timestamps, action names, and `mutations`. It must not contain tokens, cookies, authorization headers, or unredacted local environment data. `verify`, preflight blocks, and conflicts must report `mutations: 0`.

Suggested exit categories are: `0` complete/no-op, non-zero blocked precondition, non-zero conflict, non-zero partial/uncertain after a write, and non-zero auth/transport failure. Keep the stable reason codes (`TAG_TARGET_MISMATCH`, `CI_NOT_READY`, `RELEASE_CONFLICT`, `MILESTONE_AMBIGUOUS`, `PARTIAL_STATE`, and so on) independent of prose.

## Reconciliation and Idempotency Model

The documented GitHub REST surface has no cross-object transaction or idempotency key spanning Release and Milestone. The correct model is **read-before-write, minimal mutation, read-after-write, and forward recovery**.

### Release

1. Inventory every page of `GET /repos/{owner}/{repo}/releases?per_page=100&page=N`, including drafts visible to the authenticated operator, and filter for exact `tag_name`. The documented get-by-tag endpoint returns a published Release and is not sufficient for draft discovery.
2. Zero matches: create a published Release with the existing tag, explicit `name`/`body`, `draft:false`, and `prerelease:false`. Send `target_commitish` only as a convenience; GitHub documents that it is ignored when the tag already exists, so the independent ref check remains the commit proof.
3. One matching draft with the declared content and flags: update that Release by its stable ID to publish it, then read it back. This is the only automatic repair of an existing Release state.
4. One matching published Release: adopt it as a no-op only when title/tag, body, draft/prerelease state, and independently resolved tag commit match the declared result.
5. More than one match, a materially different published object, or an immutable object that cannot satisfy the required state: stop with a conflict. Never overwrite notes or delete a Release to force convergence.

[`gh release create`](https://cli.github.com/manual/gh_release_create) `v0.1.1 --verify-tag` is safe for the one-off creation path because the flag prevents automatic tag creation, but it is not the future reconciler. Do not use `--fail-on-no-commits` as the idempotency mechanism: GitHub documents that it can reject a release when there are no new commits, which can block recovery of a missing Release for an already-valid tag. Do not use `--clobber`; it deletes existing assets before uploading.

### Milestone

1. List all pages with `state=all` and filter by exact title. GitHub identifies a Milestone by number and does not document title uniqueness, so exact-title ambiguity is a hard stop.
2. Zero matches: after Release readback succeeds, create the Milestone with the reviewed description and `state=closed` (or create open and immediately close only if the API/client contract requires the two-step form). Read it back by number.
3. One exact open match with the correct description and `open_issues=0`: PATCH that number to `state=closed`, then read it back. Retain the number; do not create a replacement.
4. One exact closed match with the expected record: adopt as a no-op.
5. A closed/open object with different content, or duplicate exact titles: conflict. Do not select the newest or first object.

### API Mutation Map

| Intent | Endpoint | Normal use |
|--------|----------|------------|
| Create a published Release | `POST /repos/{owner}/{repo}/releases` with `tag_name`, `name`, `body`, `draft=false`, `prerelease` | Only after the existing-tag/ref/CI preflight. |
| Publish/repair an expected draft | `PATCH /repos/{owner}/{repo}/releases/{release_id}` with the declared fields and `draft=false` | Only for one exact matching draft; never a published-content overwrite. |
| Create a closed Milestone | `POST /repos/{owner}/{repo}/milestones` with `title`, `description`, `state=closed` | Only after Release readback succeeds. |
| Close an expected open Milestone | `PATCH /repos/{owner}/{repo}/milestones/{milestone_number}` with `state=closed` | Retain the number and require the declared record/no open issues. |

There is no endpoint that atomically commits the Release and Milestone pair. The ordered calls plus fresh GETs are intentional.

### Ambiguous writes and partial state

A timeout, connection reset, `422`, `429`, or `5xx` from a POST/PATCH is not proof that the write failed. Honor `Retry-After` for bounded GET/rate-limit backoff, but before any write retry:

1. Re-read Releases by tag/list and Milestones by exact title.
2. If the expected object exists, adopt it and continue from the next ordered step.
3. If it is absent, report the original API failure or retry only with a bounded backoff.
4. If it exists but differs, stop with a conflict.

If Release publication succeeds and Milestone closure fails, leave the Release in place and report `PARTIAL_STATE` with the safe next action. A rerun must adopt the Release and continue. There is no safe automatic rollback across tag, Release, and Milestone; never delete, recreate, force-move, or retag `v0.1.1` as compensation.

## Preflight and Readback Implementation

| Order | API/read | Required assertion | Failure behavior |
|------:|---------|-------------------|------------------|
| 1 | `gh auth status` plus `GET /repos/{owner}/{repo}` and the credential's available scope/permission metadata | Active account can read the exact repository; default branch is `main`; the declared credential is eligible for the later write operations | `AUTH_REQUIRED`/`REPO_MISMATCH`/permission failure; no writes. `gh auth status` proves authentication, not every endpoint's write scope; do not mistake a successful read for write authorization. |
| 2 | Local `git status`, branch, and HEAD (apply only) | Clean checkout, branch `main`, and local HEAD equals `expected-sha` | `LOCAL_DIRTY`/`LOCAL_REF_MISMATCH`; no writes. Remote verification remains usable without this check. |
| 3 | `GET /repos/{owner}/{repo}/git/ref/heads/main` | Remote branch object resolves to the full expected commit | `REF_MISMATCH`; no writes. Revalidate immediately before each mutation. |
| 4 | `GET /repos/{owner}/{repo}/git/ref/tags/{version}`, then follow `GET /repos/{owner}/{repo}/git/tags/{tag_object_sha}` while `object.type=tag` (bounded depth) | Exactly one expected ref; annotated object; final object type `commit`; peeled SHA equals expected | `TAG_MISSING`, `TAG_NOT_ANNOTATED`, `TAG_TARGET_MISMATCH`, or a tag-object cycle/non-commit target; no tag write. |
| 5 | `GET /repos/{owner}/{repo}/commits/{sha}/check-runs?check_name=...&filter=latest` and `GET /repos/{owner}/{repo}/actions/workflows/ci.yml/runs?head_sha={sha}` plus `/actions/runs/{run_id}/jobs` | `backend` and `frontend` are completed with conclusion exactly `success`, on the full target SHA, from the protected GitHub Actions app, in one coherent target-SHA CI run | `CI_NOT_READY` or `CI_SOURCE_MISMATCH`; no writes. Do not scan latest branch runs. |
| 6 | `GET /repos/{owner}/{repo}/branches/main/protection` and `/branches/main/protection/required_status_checks` | Required contexts include `backend` and `frontend`; `enforce_admins=true`; `strict=false` is recorded, not changed | `PROTECTION_DRIFT`; no writes. This read requires a credential that can read branch protection. |
| 7 | `GET /repos/{owner}/{repo}/releases?per_page=100&page=N`, `GET /repos/{owner}/{repo}/milestones?state=all&per_page=100&page=N`, and stable-ID GETs | No ambiguous or materially conflicting object; classify `create`, `adopt`, `repair-draft`, `close`, or `no-op` | `RELEASE_CONFLICT`, `RELEASE_AMBIGUOUS`, `MILESTONE_CONFLICT`, or `MILESTONE_AMBIGUOUS`; no automatic overwrite. |
| 8 | Ordered mutations with revalidation | Release is read back before Milestone mutation; each write response is followed by a fresh GET | `PARTIAL_STATE`/`PARTIAL_OR_UNCERTAIN`; never blindly retry or clean up. |
| 9 | Final tag, check, Release, and Milestone GETs | Fresh remote evidence proves the requested state | `COMPLETE` only when all applicable invariants pass. |

The [Checks API](https://docs.github.com/en/rest/checks/runs) and [workflow-runs API](https://docs.github.com/en/rest/actions/workflow-runs) are the right CI evidence sources. The combined commit-status endpoint is useful diagnostics but is not a sufficient Actions gate: the live repository currently returns `pending` with zero legacy statuses while the exact-SHA `backend` and `frontend` Check Runs are successful. A recovery/audit mode may allow current `main` to differ after the close-time SHA, but it must still verify the historical tag, CI, Release, and Milestone and label the result `historical`.

## Permissions and Token Boundaries

| Operation | Minimum permission | Local `gh` path | Future Actions wrapper |
|-----------|--------------------|----------------|-----------------------|
| Read repository, refs, commits, tags | Repository **Contents: read** | Existing `gh` account | `contents: read` |
| Read Check Runs | Repository **Checks: read** (or the credential's equivalent) | Existing `gh` OAuth token; validate any fine-grained PAT | `checks: read` |
| Read workflow runs/jobs | Repository **Actions: read** | Existing `gh` token | `actions: read` |
| Read branch protection | Repository **Administration: read** where the endpoint permits it | Use the operator PAT/OAuth credential; do not silently skip drift | `GITHUB_TOKEN` is not a dependable substitute for this repository-policy read; use a PAT/GitHub App or pass an explicitly reviewed policy fixture if a wrapper is ever approved |
| Create/update Release | Repository **Contents: write** | `repo`/OAuth scope is sufficient for this repository | `contents: write` |
| Create/update Milestone | Repository **Issues: write** (GitHub also documents Pull requests: write as an alternative) | `repo` scope covers the repository's issue/milestone surface | `issues: write` |
| Release whose target changes `.github/workflows` | **Workflows: write** in addition to Contents: write; classic PAT/OAuth needs `workflow` | Current local token has `workflow` | `GITHUB_TOKEN` cannot be authorized for this documented edge; use a PAT or GitHub App or block the target |

The script should not issue a test POST/PATCH merely to prove permissions. `gh auth status` plus documented token scopes/permission metadata is the safe preflight; if the first required write returns `401`/`403`, stop, read back, and report the permission failure rather than retrying. A future non-human credential should be repository-scoped (fine-grained PAT or GitHub App) rather than a broad personal token.

A future workflow should declare least privilege at job level, for example:

```yaml
permissions:
  contents: write
  issues: write
  checks: read
  actions: read
```

That block is illustrative only; **do not add this workflow in v0.1.2**. `GITHUB_TOKEN` is repository-scoped, job-scoped, and does not trigger most events caused by its own writes. GitHub documents `workflow_dispatch` and `repository_dispatch` as exceptions, but a release wrapper should still be manually invoked and should not trigger another CI/release loop. The workflow file must be on the default branch for `workflow_dispatch` to be available, and manual runs require repository write access.

Use `GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}` only inside a future workflow. Never put a PAT, `gh auth token` output, or API response containing credentials in the repository, command history documentation, or evidence JSON. GitHub recommends fine-grained PATs for new credentials, but the current general PAT documentation and Check Runs endpoint documentation disagree about fine-grained Checks API support; keep the existing `gh` OAuth path as the tested baseline and smoke-test any replacement.

## Why This Is the Brownfield Fit

- **Small surface:** the app already has a reliable CI contract with two named jobs; publication should consume that contract, not introduce a second build/test system.
- **No new authority:** the script runs outside the Express process, does not change deployment, and cannot accidentally deploy application code.
- **Operator-visible:** the same command can be run from a clean checkout, inspected in a terminal, and rerun after a partial failure.
- **Testable without a live repository:** pure reconciliation functions can be fixture-tested with Node's built-in runner; live API calls are isolated behind one client.
- **No second source of truth:** GitHub refs, Check Runs, Release, and Milestone are queried for every decision. Notes and evidence are inputs/outputs only.
- **Recovery-forward:** a rerun discovers the Release/Milestone by stable remote identity and continues, which is safer than delete-and-recreate semantics.
- **No application regression:** no changes to the backend/frontend packages, database, routes, build, or test commands.

## Alternatives Considered

| Recommended | Alternative | When to Use Alternative |
|-------------|-------------|-------------------------|
| Node 22 `.mjs` reconciler using built-in `fetch`; `gh` supplies auth | **Bash + `gh` wrapper** | Use only if the roadmap strongly prefers a shell-only operator experience. It is viable on Ubuntu, but HTTP status handling, multiline JSON, pagination, and deterministic unit tests are more fragile. Keep the same input/output contract if chosen. |
| Node 22 `.mjs` reconciler using built-in `fetch`; `gh` supplies auth | **Direct ad hoc `gh release create` + `gh api` milestone commands** | Acceptable for a one-time v0.1.1 recovery after a read-only preflight, especially `gh release create --verify-tag`. It is not the future close path: it duplicates ordering, race handling, readback, and evidence logic on every invocation. |
| Node reconciler run locally | **`workflow_dispatch` release workflow** | Consider later if the team needs a hosted audit trail or non-local operator access. The workflow should only invoke the same script, use `cancel-in-progress:false` for a version-specific concurrency group, and solve the `GITHUB_TOKEN`/branch-protection/workflow-file permission limits. It is not needed to recover the current release and would otherwise become a second implementation path. |
| Built-in REST client | **Octokit or another GitHub SDK** | Do not add it for four REST resource families. It would add a dependency and version surface without removing the need for explicit ref/check/readback logic. |
| Reviewed notes input | **`gh release create --generate-notes` or an unreviewed changelog generator** | Do not use for this factual milestone record. Generated notes can change with repository history and may obscure the exact completion claim. Use a reviewed file/stdin input; `--notes-from-tag` is an acceptable explicit source when the tag annotation is the intended record. |
| Direct API reconciliation | **Marketplace release action, `softprops/action-gh-release`, `semantic-release`, Changesets** | Do not add. They introduce external action/code supply-chain dependencies and their own tag/changelog/version state model, which conflicts with the existing tag and the requirement not to create a second release-state authority. |

## What NOT to Add or Do

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| `gh release create` without `--verify-tag` | GitHub CLI can auto-create a tag from the default branch when the requested tag is absent. | Remote ref preflight plus `gh release create --verify-tag` or the Node API reconciler. |
| `target_commitish` as the release's commit proof | GitHub documents that the field is unused when the tag already exists; a response may contain a branch name such as `main`. | Dereference `refs/tags/<version>` and compare the peeled commit SHA. |
| `gh release upload --clobber` | It deletes existing assets before upload; a failed upload can lose the original. | No assets are needed for v0.1.1. If assets are added later, upload to a draft, verify each asset, then publish. |
| Release deletion, tag deletion, force tag update, or `git push --force` | A valid version pointer is explicitly preserved; destructive recovery can break consumers and history. | Forward reconciliation and manual conflict review. |
| Automatic publication on tag push, merge to `main`, or every CI success | It violates the explicit operator boundary and can publish unreviewed or wrong code. | `verify`/`plan`/`apply` with an explicit version and SHA. |
| `pull_request_target` or an untrusted PR as a release trigger | It would expose a write-capable workflow context to code or input that has not passed the operator's publication boundary. | Manual dispatch or the local reconciler with an exact version/SHA. |
| A local `.release-state.json`, GSD milestone file, or CI artifact as the source of truth | It can diverge from GitHub and cannot prove remote state after a crash/race. | Fresh GitHub API/CLI readback; emit an evidence snapshot only as an output. |
| Automatic overwrite of a published Release or closed Milestone | It destroys user-authored history and can close/repair the wrong object. | Adopt exact matches; repair only an expected draft/open object; conflict otherwise. |
| Blind retry after a timed-out/422/5xx write | The first request may have succeeded; retrying can duplicate a Milestone or create a second Release. | Read back by stable tag/title/number before retrying. |
| `GET /commits/{sha}/status` as the only CI gate | This repository's Actions checks are not represented by legacy combined statuses. | Check Runs plus the target workflow run/jobs, filtered by full SHA. |
| Broad workflow permissions or a PAT in repository secrets for convenience | A release job needs only narrow repository scopes; workflow-file changes have a special `GITHUB_TOKEN` limitation. | Local `gh` now; least-privilege job permissions or a GitHub App/PAT only if a hosted wrapper is approved. |
| New npm dependencies, root workspace, or a release service | There is no application need and it increases supply-chain/maintenance surface. | Node built-ins + `gh` + REST. |
| Immutable-release enablement in this milestone | It changes rollback/edit behavior and is not required for the missing v0.1.1 objects. | Revisit after the reconciler and recovery policy are proven. |

## Stack Patterns by Variant

**If recovering the missing v0.1.1 objects now:**
- Run read-only `verify`/`plan` against the exact tag and SHA.
- Apply from a clean `main` checkout with a reviewed notes file and Milestone record.
- Expect `create-release` followed by `create/close-milestone`; do not touch the tag.

**If the Release exists but the Milestone does not:**
- Reuse the same script and expected SHA; inventory/adopt the matching published Release.
- Create/close only the Milestone, then perform the final combined readback.
- If `main` has advanced, use the explicit historical/resume mode rather than inventing a new tag target.

**If a write times out or returns 422:**
- Do not rerun the POST blindly.
- Re-read the Release by tag/list and Milestone by exact title; adopt, conflict, or report partial state.

**If a later team wants an Actions button:**
- Add a `workflow_dispatch` wrapper only after the local reconciler is tested.
- Use the same Node script and contract, `GH_TOKEN`, `concurrency.group=release-close-${{ inputs.version }}`, and `cancel-in-progress:false`; do not duplicate release logic in YAML.
- Keep it out of `push`/`pull_request`; the existing `ci.yml` remains the only automatic CI workflow.

**If release assets are introduced later:**
- Extend the same Release reconciliation with a draft → asset upload → asset readback → publish sequence.
- Do not enable `--clobber` by default and do not claim atomic rollback.

## Version Compatibility

| Package/tool | Compatible with | Notes |
|--------------|-----------------|-------|
| Node.js `22.x` | `.mjs`, built-in `fetch`, `node:test` | Matches the existing backend/frontend and Actions runtime; no package installation. Keep the script independent of either package's CommonJS/ESM configuration. |
| GitHub CLI `2.101.0` | `gh auth`, `gh api`, `gh release`, `gh run` | Current upstream release observed 2026-09-15 and installed locally. The script should check the required flags/help or fail with an upgrade message rather than assume every operator has this exact build. |
| GitHub REST API `2026-03-10` | Node `fetch` client | Current docs use this version in examples. Set the header explicitly in the client; do not accidentally rely on a CLI default. The installed `gh` currently selected `2022-11-28` by default in a read-only header check, so mixing implicit versions is a maintenance hazard. |
| GitHub-hosted `ubuntu-latest` runner | `gh` and the optional wrapper | GitHub documents `gh` as preinstalled. If the wrapper is added, use a minimal/sparse checkout for the script; no backend/frontend checkout, dependency install, or application build is needed. |
| `.github/workflows/ci.yml` jobs `backend` and `frontend` | Exact-SHA Check Runs | These names and the app-bound required contexts are the script's default contract; changing them requires updating branch protection and the release preflight together. |

## Roadmap Integration Points

1. **Contract and fixtures:** define `verify`/`plan`/`apply`, stable reason codes, JSON evidence schema, and pure reconciliation fixtures. No remote writes.
2. **Client and preflight:** add the Node 22 script/client, `gh` auth handling, repository/ref/tag/check/branch-protection reads, and read-only verification of the live v0.1.1 baseline.
3. **Release recovery:** implement Release inventory/create-or-adopt/publish-readback with `--verify-tag` semantics and no tag mutation; publish the missing v0.1.1 object.
4. **Milestone and recovery:** implement paginated exact-title Milestone reconciliation, close/readback, partial-state handling, and the final evidence manifest. Add the documented manual commands for conflicts.
5. **Optional hosted wrapper:** only if requirements explicitly ask for a UI-dispatched run, add a `workflow_dispatch` wrapper around the tested script. Do not duplicate the state machine or change the existing required CI contexts.

## Sources

### Current first-party GitHub sources

- [GitHub CLI v2.101.0 release](https://github.com/cli/cli/releases/tag/v2.101.0) — current CLI release observed 2026-09-15.
- [`gh release create`](https://cli.github.com/manual/gh_release_create), [`gh release edit`](https://cli.github.com/manual/gh_release_edit), [`gh release view`](https://cli.github.com/manual/gh_release_view), [`gh release upload`](https://cli.github.com/manual/gh_release_upload) — tag verification/auto-creation, notes, state, JSON fields, and asset overwrite behavior.
- [`gh api`](https://cli.github.com/manual/gh_api), [`gh auth status`](https://cli.github.com/manual/gh_auth_status), [`gh auth token`](https://cli.github.com/manual/gh_auth_token), [`gh run list`](https://cli.github.com/manual/gh_run_list), [`gh run view`](https://cli.github.com/manual/gh_run_view) — authenticated API, auth, exact-commit run filters, and machine-readable evidence.
- [REST Releases](https://docs.github.com/en/rest/releases/releases) — Release fields, `target_commitish` semantics, draft/published state, permissions, 422 behavior, and workflow-file permission caveat.
- [REST Milestones](https://docs.github.com/en/rest/issues/milestones) — list/create/get/update, `open`/`closed`, descriptions, pagination, and permissions.
- [REST Git references](https://docs.github.com/en/rest/git/refs), [REST Git tags](https://docs.github.com/en/rest/git/tags), and [REST commits](https://docs.github.com/en/rest/commits/commits) — annotated-tag dereferencing and ref resolution.
- [REST Check Runs](https://docs.github.com/en/rest/checks/runs), [REST commit statuses](https://docs.github.com/en/rest/commits/statuses), and [protected branches](https://docs.github.com/en/rest/branches/branch-protection) — exact-SHA checks, conclusions, combined-status limitations, and required contexts.
- [REST workflow runs](https://docs.github.com/en/rest/actions/workflow-runs) — filtering by `head_sha`, attempts, conclusions, and job URLs.
- [Workflow syntax](https://docs.github.com/en/actions/reference/workflow-syntax-for-github-actions), [workflow triggers](https://docs.github.com/en/actions/reference/events-that-trigger-workflows), [manual workflow runs](https://docs.github.com/en/actions/managing-workflow-runs/manually-running-a-workflow), [GITHUB_TOKEN authentication](https://docs.github.com/en/actions/reference/authentication-in-a-workflow), [GITHUB_TOKEN concepts](https://docs.github.com/en/actions/concepts/security/github_token), and [concurrency](https://docs.github.com/en/actions/writing-workflows/choosing-what-your-workflow-does/control-the-concurrency-of-workflows-and-jobs) — optional wrapper behavior, trigger security, and token limits.
- [Managing Releases](https://docs.github.com/en/repositories/releasing-projects-on-github/managing-releases-in-a-repository) and [immutable Releases](https://docs.github.com/en/code-security/concepts/supply-chain-security/immutable-releases) — draft/asset sequencing and rollback limitations.
- [Managing personal access tokens](https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/managing-your-personal-access-tokens) and [fine-grained token permissions](https://docs.github.com/en/rest/authentication/permissions-required-for-fine-grained-personal-access-tokens) — least privilege, token storage, and the documented Checks API compatibility caveat.

### Repository evidence

- `.planning/PROJECT.md`, `.github/workflows/ci.yml`, and `AGENTS.md` — v0.1.2 scope, exact CI job names, protected contexts, tag-preservation rule, and existing verification commands.
- Read-only GitHub API/CLI evidence for `ldsampaio/sgrf` on 2026-09-25 — remote `main`, annotated tag/object/commit, absent v0.1.1 Release and Milestone, green target-SHA Actions checks/runs, branch-protection policy, and the combined-status/check-run contrast.

Context7 was not available in this subagent environment; first-party GitHub documentation and live read-only API/CLI evidence were used instead. The web research seam cached the eight source digests under MEDIUM confidence; platform claims above are cross-checked against those official pages, while the current repository observations are direct evidence.

---

*Stack research for: SGRF v0.1.2 GitHub Release Reliability*
*Researched: 2026-09-25*
