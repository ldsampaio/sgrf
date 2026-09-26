# Pitfalls Research

**Domain:** Reliable, operator-invoked GitHub Release and Milestone publication for SGRF v0.1.2
**Researched:** 2026-09-25
**Confidence:** MEDIUM overall (HIGH for the current repository state and documented API primitives; MEDIUM where GitHub does not document an atomicity, uniqueness, or visibility guarantee)

> **Scope.** This research covers the publication path only: existing tags, required Actions checks, protected `main`, GitHub Releases, GitHub Milestones, and safe recovery after partial success. It does not change application code, the CI test/build commands, or the valid `v0.1.1` tag.
>
> **Confidence note.** GitHub's REST, Git, and CLI documentation was cross-checked against read-only API/CLI evidence from `ldsampaio/sgrf`. The live repository evidence is HIGH confidence for this repository on the research date. Claims that an API is *not* idempotent, that milestone titles are not unique, or that a read-after-write may be temporarily incomplete are deliberately treated as **not promised by the documentation**, not as claims that GitHub will always behave badly. The mitigation in every case is read-before-write, fail-closed preconditions, and readback.

## Repository Baseline (read-only evidence)

The following is the starting state the roadmap must preserve, not a list of things to recreate:

- `origin` is `https://github.com/ldsampaio/sgrf.git`; the remote default branch is `main`.
- Remote `refs/tags/v0.1.1` points to annotated tag object `0a68d6f0c55e7be07d13a0bbc4ed36d4af772630`; its peeled commit is `10c62ac85fd3ab275b8926c89f5f34ba4116e2cf`, the same SHA as remote `main`.
- The commit at `10c62ac…` has a GitHub-verified commit signature. The annotated tag object itself is currently unsigned. A valid signed commit is not the same claim as a signed tag object.
- The repository has a Release for `v0.1.0`, but no `v0.1.1` Release and no GitHub Milestones (the `state=all` listing is empty).
- The historical failed CI run `36095528423` is a `pull_request` run for `release/v0.1.1` at head SHA `826953c209a6ba12c8b7b8cc6e7fe0cd96461bb8`; it is not the target merge SHA. Its fresh-database failure was root-caused to a missing `DepartmentSettings.default` row, and `b50dc94` changed the test setup to upsert that row. The target SHA has green CI runs `36095855139` (`main` push) and `36095872529` (`v0.1.1` push), with `backend` and `frontend` successful.
- The combined commit-status endpoint for the target SHA is `pending` with zero commit statuses. That is expected for Actions: GitHub Actions creates Checks, not legacy commit statuses. A publication gate that reads only `/commits/{sha}/status` will falsely reject a green target.
- `main` branch protection currently requires contexts `backend` and `frontend` from the GitHub Actions app (app id `15368`), with `strict:false` and `enforce_admins:true`; no pull-request review requirement or push restriction is configured. `strict:false` relaxes up-to-date branch requirements, not the requirement that the named checks pass.
- The working tree is currently ahead of `origin/main` by one local commit and has a modified `.planning/state.json`. Local refs and planning files therefore cannot be publication proof; GitHub remote refs/API readback must be authoritative.

### Roadmap phase labels used below

The current `.planning/ROADMAP.md` still describes the prior hardening milestone. For v0.1.2, the findings below recommend this order; the orchestrator may rename the phases but should preserve the dependencies:

1. **P1 — Recover `v0.1.1` publication:** one-time, operator-reviewed recovery of the missing Release and Milestone without touching the tag.
2. **P2 — Preflight and invariant gate:** read-only proof of repository, refs, signatures, permissions, branch protection, and exact target-SHA checks.
3. **P3 — Idempotent operator close:** deterministic, serialized publication/reconciliation, negative controls, partial-success recovery, and final readback.
4. **P4 — Future publication hardening:** tag rules, release immutability, least-privilege automation, and an operational runbook for future milestones.

## Critical Pitfalls

### Pitfall 1: Annotated tag dereferencing is confused with commit identity

**What goes wrong:**

`git rev-parse v0.1.1` resolves the tag object (`0a68d6f0…` in this repository), not the commit that the release should contain. Comparing that object ID with the expected commit, or trusting a Release's `target_commitish` field, can either fail a valid release or make a publication check compare unrelated values. The Release API explicitly says `target_commitish` is unused when the tag already exists, while the CLI/API may display a branch name such as `main` rather than the peeled commit.

**Why it happens:**

Git refs, annotated tag objects, commits, and Release metadata are different layers. A UI that displays a tag name or `target_commitish` makes them look like one identity.

**How to avoid:**

- Accept a strict version/tag allowlist and the expected full 40-character commit SHA as explicit operator inputs.
- Read the remote ref, not only the local cache. For an annotated tag, resolve both `refs/tags/<tag>` and its peeled `refs/tags/<tag>^{}` line, or use `git rev-parse --verify --end-of-options "$tag^{commit}"` after fetching only as a convenience.
- Confirm the remote `main` ref, the peeled tag commit, and the expected commit are byte-for-byte equal before any mutation. Re-read all three immediately before the first write.
- Use the GitHub Git database endpoints (`git/ref/tags/...`, then `git/tags/<tag-object-sha>`) when API readback is required. Never use a Release's `target_commitish` as the commit identity.
- Prohibit `git tag -f`, `git push --force`, Git ref `PATCH`, and any automatic tag recreation for this path. A mismatch is an incident to investigate, not a reason to repair the tag.

**Warning signs:**

- A script compares `git rev-parse "$tag"` to the expected commit instead of using `^{commit}`.
- The Release response says `target_commitish: "main"` and someone treats that as proof of the release commit.
- Only one `ls-remote` line is present, or `--refs` was used even though peeling is required.
- A short SHA, local-only tag, or a tag that changed during the run appears in logs.

**Phase to address:** P1 for the existing recovery; P2 for every future close.

**Negative control:** A fixture with an annotated tag whose object is `A` and peeled commit is `B` must pass only when `B` equals the expected commit. A lightweight tag, missing peeled ref, and wrong peeled SHA must produce zero write calls.

---

### Pitfall 2: A release command silently creates or targets the wrong tag

**What goes wrong:**

`gh release create` automatically creates a tag from the latest state of the default branch when the tag is missing. The Releases API also defaults `target_commitish` to the default branch when a new tag is needed. A typo, stale local view, or failed preflight can therefore create `v0.1.1` at a new `main` commit even though the intended annotated tag already exists elsewhere. Supplying `--target` is not a substitute for proving that the tag exists: the API ignores `target_commitish` once the tag exists.

**Why it happens:**

Release creation combines tag creation and release publication in one command. It is easy to treat the command as a pure metadata write even when its first side effect is a Git ref write.

**How to avoid:**

- Make remote tag existence and peeled-SHA equality a hard precondition before invoking any create command.
- Use `gh release create ... --verify-tag` for the one-time recovery; `--verify-tag` is the CLI's explicit guard against automatic tag creation.
- Do not use `gh release edit --tag` or `--target` to “fix” an existing Release. A tag rename/retarget is a different and destructive operation.
- Use an explicit `--repo owner/name` or an absolute API path so a command run from the wrong directory cannot publish to a fork.
- If the tag is absent, stop. The operator must decide whether a new version is intended; this milestone does not authorize creating a replacement `v0.1.1` tag.

**Warning signs:**

- The preflight `ls-remote` has no `refs/tags/v0.1.1` line.
- A command log says it created a tag, or `gh release create` was run without `--verify-tag`.
- The requested tag differs by whitespace, case, or a leading `refs/` prefix.
- A new ref appears between preflight and mutation.

**Phase to address:** P1 and P3.

**Negative control:** Run the command builder against an absent tag and assert it exits before any `POST /releases`, `POST /git/refs`, or `git push` operation.

---

### Pitfall 3: Commit signature and tag signature are treated as the same fact

**What goes wrong:**

The current `v0.1.1` tag object is unsigned, while the commit it points to has a verified signature. Running `git verify-tag v0.1.1` therefore fails even though the release commit is valid. Conversely, a signed tag object says nothing by itself about whether the referenced commit is the intended commit. An operator may reject a valid recovery, or may claim “signed tag” when only the commit was signed.

**Why it happens:**

Git stores signatures on the object being signed. The phrase “signed merge commit” and “signed release tag” are often used interchangeably, but they are different assertions.

**How to avoid:**

- State the policy explicitly: for this milestone, verify the **commit** signature and the exact peeled commit; record the tag-object signature separately.
- Use `git verify-commit`/GitHub commit verification for the commit and `git verify-tag` only when the tag object itself is required to be signed.
- Record `verified`, `reason`, and `verified_at` in the operator evidence, but do not treat a tag-object signature as a substitute for SHA equality.
- If the policy later requires signed tags, create a new version under the new policy; do not rewrite the valid `v0.1.1` tag.

**Warning signs:**

- A “signature failure” report cites `git verify-tag` while the release requirement only says signed commit.
- A log says “tag signed” without showing the object type and SHA.
- The expected commit is correct but the tag object is lightweight or unsigned.

**Phase to address:** P2.

**Negative control:** The unsigned-tag/verified-commit fixture must pass the commit-signature policy; a verified-tag/wrong-commit fixture must fail on SHA, not on the tag signature.

---

### Pitfall 4: Local state or the wrong repository is mistaken for remote truth

**What goes wrong:**

This working tree is ahead of `origin/main` and contains a modified planning file. A script that trusts local `main`, a local tag, `HEAD`, or an unqualified `gh` placeholder can publish from a stale commit or a different checkout. `gh` can resolve `{owner}/{repo}` from the current directory or `GH_REPO`; running from a fork, worktree, or wrong host can redirect the entire operation.

**Why it happens:**

Local Git state is convenient and fast, but Git is distributed and a clone is only a cache. Operators often assume the checkout they invoked the command from is the canonical remote state.

**How to avoid:**

- Pin the expected `owner/repository` and GitHub host in the operator command/configuration; assert them before authentication and again before mutation.
- Query remote refs and GitHub API objects for the release decision. A `git fetch` may refresh a cache but is not publication evidence.
- Treat local cleanliness as an operational hygiene check, not as a substitute for remote equality. Do not require or publish uncommitted `.planning` state.
- Use full remote URLs only for human diagnostics; do not infer the target repository from a mutable directory name.

**Warning signs:**

- `git status --branch` shows ahead/behind or a dirty worktree and the script continues without an explicit policy.
- `GH_REPO`, current directory, or `origin` differs from the expected `ldsampaio/sgrf`.
- Local `main`/tag equals the expected value but the GitHub API returns another SHA.

**Phase to address:** P1 and P2.

**Negative control:** Execute the preflight from a temporary directory with a wrong `GH_REPO`; it must refuse before any API mutation.

---

### Pitfall 5: The preflight is invalidated by a main/tag race

**What goes wrong:**

A script proves that `main` and `v0.1.1` both point to `10c62ac…`, then another push or tag update occurs before the Release or Milestone write. The script can publish a Release for a commit that is no longer the current `main`, or close a Milestone after the branch has moved. There is no cross-object transaction spanning a Git ref, Release, Milestone, and Actions check query.

**Why it happens:**

A preflight is a snapshot, not a lock. GitHub API calls are independent, and the operator may take seconds between them.

**How to avoid:**

- Acquire a repository/tag-scoped publication lock before the first preflight and keep it through final readback.
- Treat the expected main SHA and peeled tag SHA as immutable inputs. Re-read both immediately before each mutation and again at final verification; if either changes, stop without “retrying against the new main.”
- Record the lock owner, invocation ID, expected SHA, and operation timestamps in a non-authoritative local journal. The journal helps recovery; remote readback remains the proof.
- If no distributed lock is available for the chosen operator surface, fail closed for concurrent invocations rather than assuming a local `flock` protects multiple hosts.

**Warning signs:**

- Remote `main` or tag SHA differs between two preflight logs.
- Two publication logs overlap for the same tag.
- A retry silently changes the requested SHA or target branch.

**Phase to address:** P2 and P3.

**Negative control:** Simulate a main advance after the first read; the test must assert no Release/Milestone mutation and a clear `PRECONDITION_CHANGED` result.

---

### Pitfall 6: Historical or wrong-SHA CI runs are selected as the release gate

**What goes wrong:**

The failed run `36095528423` belongs to the superseded `release/v0.1.1` head `826953c…`, not the signed merge commit `10c62ac…`. A script that scans `gh run list` by time, takes the first/last run, checks the release branch, or uses a PR synthetic merge SHA can either block a valid release or accept a green run for the wrong code. The target SHA also has two green push runs (`main` and tag), so “latest run” is not a stable identity.

**Why it happens:**

GitHub retains historical runs and creates separate run/check-suite objects for pushes, tags, and pull requests. A human sees “CI failed” or “CI passed” in a branch/PR view and assumes it describes the release commit.

**How to avoid:**

- Resolve the expected full commit SHA first; query workflow runs and check runs with `head_sha=<expected SHA>` and the expected workflow path/id, event, and ref.
- Use the Checks API for the exact commit and require completed `success` for the policy-required `backend` and `frontend` jobs from the expected GitHub Actions app. Do not use the legacy combined status endpoint as the sole signal: Actions checks do not appear there.
- If multiple check suites/runs exist for one SHA, define and record the selection rule (current run attempt, target ref/event, and app identity) and reject contradictory selected results. Do not require every historical run to be green.
- Treat a rerun as evidence for its original SHA/ref, not as a new commit. Preserve the root-caused failed run as historical evidence; do not delete or rewrite it to make the history look clean.

**Warning signs:**

- A selected run's `headSha` is not the expected commit.
- A check is green for `main` but the operator intended a tag, or green for a PR head while the release uses a merge commit.
- `/commits/{sha}/status` says `pending` while Checks API shows successful jobs.
- A new run appears while the preflight is being assembled.

**Phase to address:** P2.

**Negative control:** A fixture must contain the real incident shape: red run on `826953c…`, green runs on `10c62ac…`; the target gate passes and the historical red run does not block it.

---

### Pitfall 7: Check names, app sources, and conclusions are not identity-checked

**What goes wrong:**

`backend` and `frontend` are required context names, but a name alone is not a sufficient identity. GitHub warns that job names should be unique across workflows; multiple Actions suites can contain the same names. Any write-capable integration can create legacy commit statuses, and branch protection can optionally require a particular app source. A skipped or neutral check is treated as successful by branch protection, but it is not evidence that the release commands actually ran.

**Why it happens:**

The UI presents a small list of named checks, while the API exposes app, suite, run, attempt, status, and conclusion separately. A simple `grep backend` or a boolean “required checks passed” loses those dimensions.

**How to avoid:**

- Read the branch-protection/ruleset configuration and capture required contexts plus expected app id/source. For this repository, verify `backend` and `frontend` from the GitHub Actions app (`15368`) unless the protection readback says otherwise.
- Match `head_sha`, check name, app/suite, workflow identity, and completed success together. Reject missing, pending, queued, cancelled, stale, timed-out, neutral, or skipped results for the release policy even if a merge would technically be allowed.
- Assert that the jobs came from the expected CI workflow and ran the documented commands; a skipped workflow can otherwise look green to a merge gate.
- Make the expected app id and job names configuration, not scattered hard-coded strings, and fail if protection changes unexpectedly.

**Warning signs:**

- Two checks share a name but have different app ids or suite ids.
- A required context is present only from a non-Actions source.
- A job is `skipped`/`neutral` or a workflow filter left a pending check.
- The current `main` protection contexts differ from the script's assumptions.

**Phase to address:** P2, with protection hardening in P4.

**Negative control:** Inject a successful `backend` check from a different app, a skipped expected job, and a duplicate-name suite; all must fail the release gate.

---

### Pitfall 8: `strict:false`, administrator enforcement, and tag protection are misunderstood

**What goes wrong:**

The current `main` protection has `strict:false`, so a branch need not be up to date with the base before merge, but the required checks still must pass. `enforce_admins:true` means an administrator cannot bypass the checks with a direct push. Conversely, protection of `main` does not itself protect `refs/tags/v0.1.1` from update or deletion. A release script that disables protection, force-pushes a tag, or treats a successful merge as permission to publish is unsafe.

**Why it happens:**

“Strict” and “protection” are often read as one switch, and branch rules are mistakenly assumed to cover tags. The current configuration also has no review requirement, which can make a green check look like the entire governance story.

**How to avoid:**

- Read protection at runtime and preserve `strict`, admin enforcement, and required contexts as explicit invariants. Do not temporarily disable branch protection to make a publication command succeed.
- If a code change is needed, use the normal protected-branch/PR flow; publication itself should not push application code.
- Add a tag ruleset targeting the release-tag pattern with update/delete/creation restrictions for future versions. Current branch protection cannot be treated as tag immutability.
- Make the no-force/no-delete policy explicit in code and review checks. Immutable releases and tag rules are defense in depth, not permission to rewrite `v0.1.1`.

**Warning signs:**

- `GH006` appears during a direct push.
- An administrator assumes `enforce_admins` does not apply.
- A tag can be deleted or force-updated by a normal write token.
- A recovery runbook says “disable protection, then retry.”

**Phase to address:** P2 and P4.

**Negative control:** In a disposable repository, a tag ruleset must reject update/delete/force operations while the release script can still read and associate the existing tag.

---

### Pitfall 9: The CI token has read permissions, while publication needs different write permissions

**What goes wrong:**

The current CI workflow declares `permissions: contents: read`; that is correct for the test/build gate but cannot create a Release or Milestone. Release/tag operations require repository Contents write, milestone operations require Issues write, and Actions/check inspection requires Actions read. Creating a Release whose resolved target changes workflow files can require workflow write; GitHub documents that the Actions `GITHUB_TOKEN` cannot be authorized for that permission. A missing permission can surface as 403 or as a misleading 404.

**Why it happens:**

Permissions are endpoint-specific, while a release script often inherits the token of the CI job that discovered the green checks. Public read access makes a read-only preflight look healthy even when the subsequent write cannot succeed.

**How to avoid:**

- Define a permission matrix before implementation: Contents read/write, Issues read/write, Actions read, Administration read for protection readback, and conditional Workflows write. Do not infer permissions from repository visibility.
- Keep the existing CI job read-only. Use a separate operator-invoked workflow/job or a least-privilege GitHub App/PAT for publication, with an environment/manual approval if the project wants a human checkpoint.
- Preflight authentication and permissions with read-only calls before mutation. Inspect `X-Accepted-GitHub-Permissions`/permission errors and stop on 403/404; never interpret them as “object absent.”
- Do not print tokens, run `set -x` around `GH_TOKEN`, or use a broad classic token when a scoped App/PAT is sufficient.

**Warning signs:**

- CI is green but the release job receives 403/404.
- The job YAML still has `contents: read` while attempting a release POST.
- A GitHub App installation lacks Issues or Actions read access.
- A classic PAT needs the `workflow` scope because the target commit introduced `.github/workflows` changes.

**Phase to address:** P2 and P3.

**Negative control:** Mock a read-only token and assert the preflight reports missing write permission before any POST; also mock a 404 and require permission diagnosis rather than object creation.

---

### Pitfall 10: Draft, prerelease, published, and latest states are conflated

**What goes wrong:**

A tag is not a published Release. A draft is invisible to the public release feed and may not be returned by the get-by-tag endpoint; a prerelease is excluded from the “latest” release; and a newly published Release defaults to `make_latest: true` unless the caller chooses otherwise. A release can therefore exist, be found by a maintainer, yet fail the milestone's public-completion contract.

**Why it happens:**

`draft`, `prerelease`, `published_at`, and latest are separate fields with different visibility and selection rules. The Release API's create defaults are easy to overlook.

**How to avoid:**

- Enumerate all Releases visible to the authenticated maintainer, including drafts, and find exact `tag_name` matches across all pages. Do not rely only on `/releases/latest` or a public get-by-tag response.
- Set state explicitly. For a stable v0.1.1 recovery, require `draft:false`, `prerelease:false`, non-null `published_at`, the exact tag, and the chosen latest policy; read all fields back.
- If assets will exist in a future release, create a draft, upload/verify assets, then publish. The current v0.1.1 recovery has no assets, but the state model should still be explicit.
- Never interpret a draft's existence as completed publication, and never infer commit identity from the latest-release endpoint.

**Warning signs:**

- `draft:true`, `published_at:null`, or a release visible only to maintainers.
- `prerelease:true` for a stable milestone.
- `GET /releases/latest` still points to `v0.1.0` after the intended publication.
- The script relied on the default `make_latest` without recording the decision.

**Phase to address:** P1 and P3.

**Negative control:** Fixtures for absent, draft, prerelease, published, and immutable Releases must produce distinct outcomes; only the exact stable state may pass.

---

### Pitfall 11: Release creation is mistaken for an idempotent operation

**What goes wrong:**

A retry after a timeout, a second operator, or a CLI command that believes no release exists can create a second Release object for the same tag. The GitHub CLI manual explicitly warns that repeated creation can produce the same or duplicate release. The REST create endpoint documents `201`, `422`, and other errors but does not provide an idempotency-key contract. A release list can then contain more than one object with the same `tag_name`, making “which one is the release?” ambiguous.

**Why it happens:**

The human mental model is “one tag equals one release,” but the safe implementation must verify that invariant remotely on every attempt. A failed HTTP response does not prove that the server did not commit the write.

**How to avoid:**

- Serialize by repository/tag, read all Releases (including drafts) with pagination, and require zero or one exact tag match before creating.
- Zero matches may proceed to one create call; one match must be read back and reconciled; more than one match is a hard stop for manual review.
- After any timeout, 409, 422, or connection reset, re-read before retrying. Never blindly repeat a POST.
- Use the returned release ID for subsequent PATCH/readback, not a guessed title or local cache.
- Keep the command's `--verify-tag` guard even when the preflight found a tag; it is a final defense against accidental tag creation.

**Warning signs:**

- Two Releases share a tag, or a second Release ID appears after a “failed” retry.
- `gh release create` exits nonzero after the Release is visible in the API.
- A script selects a Release by title or “most recent” rather than exact tag and stable ID.

**Phase to address:** P1 and P3.

**Negative control:** Mock a server that commits the POST and then drops the response; a second invocation must discover the existing Release and issue no second POST.

---

### Pitfall 12: Milestone title, number, pagination, and open/closed state are confused

**What goes wrong:**

Milestone listing defaults to `state=open` and is paginated. A closed milestone can therefore look absent, while a milestone on page two can be missed. The API exposes a stable `number`, but the documentation does not declare titles unique; a human-edited title is not a safe durable key. Closing a Milestone is a separate PATCH by number and does not mean all associated issues are closed.

**Why it happens:**

The GitHub UI presents a title in a dropdown, while the REST API identifies update/delete operations by number. Automation that searches the default first page or updates by title has no reliable identity or completeness guarantee.

**How to avoid:**

- List with `state=all`, a bounded `per_page`, and complete pagination. Match the exact expected title and require exactly one candidate; if zero, create once; if more than one, stop for manual resolution.
- Persist the returned milestone `number` in the operator journal/manifest. Use the number for get/update/close; never parse a milestone URL to discover identity.
- Reconcile description/title without changing the stable number, then close by number only after Release and CI readback pass. Read back `state`, `closed_at`, `number`, and description.
- Treat `open_issues`/`closed_issues` as informational counts, not proof that the milestone state is closed.

**Warning signs:**

- `state=open` returns empty while a closed milestone exists.
- More than one milestone has the expected title.
- A close request is sent to a number that differs from the created milestone.
- The script treats `closed_issues == 0` as a closure condition.

**Phase to address:** P1 and P3.

**Negative control:** A fixture with 31 closed milestones on page two and one duplicate title must never cause a blind create; it must either find the exact number or abort.

---

### Pitfall 13: Release and Milestone writes are treated as one transaction

**What goes wrong:**

The tag, Release, and Milestone are separate remote objects. A process can succeed on the Release and fail before creating/closing the Milestone; it can create an open Milestone and fail before the final close; or a response can be lost after the server committed a write. A rerun that assumes “nothing was created” duplicates objects or closes the wrong object.

**Why it happens:**

The operator workflow looks like one conceptual “close milestone” action, but the implementation is a sequence of HTTP calls with no cross-object transaction or documented idempotency key.

**How to avoid:**

Use a small reconciliation state machine and make every step restartable:

1. Read-only preflight: repository, tag, main, signatures, protection, permissions, and exact-SHA checks.
2. Reconcile/create the Release (or resume a matching draft); read it back by ID and verify tag/state/body.
3. Reconcile/create the Milestone in `open` state; read it back and persist its number.
4. Close that exact Milestone by number only after the Release and checks are verified.
5. Perform a final all-object readback and record URLs/IDs/SHAs.

If a POST/PATCH response is ambiguous, stop and re-read. Never respond by deleting an object and starting over. Use a bounded, journaled retry policy; retry GETs with bounded backoff, but retry mutations only after reconciliation proves the mutation is absent.

**Warning signs:**

- Release exists but Milestone is absent/open; Milestone exists but Release is absent/draft.
- A process exits between API calls without a checkpoint.
- A timeout is followed immediately by another POST.
- The final report claims success from local state rather than remote readback.

**Phase to address:** P3.

**Negative control:** Run the full state matrix (neither object, Release only, draft Release, Milestone only, open/closed Milestone, published Release) and assert every state converges without duplicate creation.

---

### Pitfall 14: Concurrent operator/workflow invocations are not serialized

**What goes wrong:**

Two operators can both observe “Release absent” and “Milestone absent” and issue competing creates. A workflow concurrency group with the default pending-run behavior can replace a queued invocation; `cancel-in-progress:true` can cancel a run after it has created the Release but before it closes the Milestone. The result is duplicate objects or a half-published state even though both invocations looked correct in isolation.

**Why it happens:**

Actions concurrency controls workflow runs, not arbitrary local CLI processes, and cancellation is a normal scheduling feature rather than a transaction mechanism. A tag name is not automatically a distributed mutex.

**How to avoid:**

- Use one documented operator surface. If publication is an Actions workflow, use a repository/tag-scoped concurrency group, queue rather than cancel an in-progress close, and make inputs/ref explicit.
- For local/CLI publication, use a host-level lock only when all invocations share that host; otherwise require an external lock/approval mechanism or fail closed. Do not claim a local `flock` protects multiple operators.
- Re-run the complete preflight after acquiring the lock. The losing invocation should reconcile the winner's result, not race it.
- Never use `cancel-in-progress:true` for a publication workflow after the first mutation unless the workflow is explicitly restartable and has a tested recovery path.

**Warning signs:**

- Two run IDs overlap for one tag.
- A queued run is canceled and no final readback exists.
- Different operators report different release/milestone IDs.

**Phase to address:** P3.

**Negative control:** Start two invocations simultaneously against a mock API; assert one mutation owner and one reconciliation-only invocation.

---

### Pitfall 15: Shell injection turns version/ref/notes inputs into commands

**What goes wrong:**

GitHub treats branch names, titles, bodies, labels, and other event fields as untrusted input. A release script that interpolates an input into an inline `run` block, uses `eval`, builds a shell command string, or leaves variables unquoted can execute attacker-controlled text on a runner or operator machine. Even a valid-looking tag can contain shell metacharacters, and release notes can contain arbitrary Markdown/newlines.

**Why it happens:**

The publication inputs are usually supplied by a trusted operator today, which makes the command look safe; the same workflow may later accept a branch, issue title, or reusable-workflow input. The GitHub Actions security guidance treats contexts such as `ref`, `title`, and `head_ref` as untrusted.

**How to avoid:**

- Validate version and tag names against a narrow allowlist such as `^v[0-9]+\.[0-9]+\.[0-9]+$` before any shell/API operation; validate repository names and SHAs separately.
- Pass values through environment variables and quote them, or use arrays/argument-safe APIs. Never use `eval`, `sh -c` with concatenated data, or direct `${{ inputs.* }}` interpolation in an inline privileged script.
- Use `gh api --input` with a safely generated JSON body for structured fields, rather than constructing a shell-interpolated JSON document. `gh api` field values and filenames still require safe argument handling.
- Use `--`/`git rev-parse --end-of-options` where supported, and reject control characters/newlines in identifiers.
- Keep tokens out of command traces and logs; do not put release notes or environment values into a command that enables shell tracing.

**Warning signs:**

- A version/ref appears in a `run: echo ... ${{ ... }}` expression.
- `eval`, `bash -c`, or an unquoted `$TAG` appears in the publication script.
- A title/body containing `;`, quotes, `$(...)`, backticks, or newlines reaches a shell instead of an API field.

**Phase to address:** P2 and P3.

**Negative control:** Feed `v1.0.0"; touch /tmp/should-not-exist; #`, `$(...)`, newline, and a malicious branch name into every input path; assert no command marker is created and no mutation is attempted.

---

### Pitfall 16: Rollback deletes or rewrites evidence and can invalidate a valid tag

**What goes wrong:**

The intuitive rollback—delete the Release/Milestone, force-move the tag, and recreate everything—destroys stable IDs, audit history, notes, and the exact tag identity. GitHub immutable releases additionally lock the associated tag and assets after publication, while title/notes/prerelease/latest remain editable. A release deletion is not a transaction rollback of the underlying tag or of consumers that already fetched the version.

**Why it happens:**

Operators treat publication as a reversible file write, but remote objects, notifications, consumers, and immutable protections make it append-only and identity-sensitive.

**How to avoid:**

- For this milestone, never delete, recreate, rename, or force-move `v0.1.1` or its tag. Fix forward by reconciling the missing Release/Milestone.
- If a Release is wrong, stop and escalate. Do not “repair” it by changing `tag_name` or `target_commitish`; a valid existing tag is the source of truth.
- If a future release is immutable, use the draft → assets → publish sequence and treat publication as final. Enable immutable releases for future releases only; the current setting does not retroactively protect `v0.1.1`.
- A Milestone can be reopened if a human confirms the close was premature, but that is a deliberate forward correction with an audit note, not an automatic rollback of a release.

**Warning signs:**

- `git push --force`, `git tag -f`, ref `PATCH`, `force:true`, `gh release delete`, or milestone deletion appears in a recovery command.
- A failed Release is “fixed” by recreating the tag.
- A rollback plan cannot state which remote IDs and evidence it preserves.

**Phase to address:** P1, P3, and P4.

**Negative control:** Static tests must reject any delete/force/tag-rename command in the v0.1.1 path, and an immutable-release fixture must reject tag/asset mutation after publish.

---

### Pitfall 17: Rate limits and blind retries turn a transient failure into duplicate state

**What goes wrong:**

Release creation triggers notifications, and GitHub warns that rapid content creation can cause secondary rate limits. Pagination and repeated polling consume the primary limit. A client that retries every non-2xx response can create duplicates, hammer a rate-limited endpoint, or receive a ban. A 404 can also mean authorization/private-resource access rather than an absent object.

**Why it happens:**

The publication is small enough that operators assume one-off requests cannot hit limits, and error handling often treats network failure as proof that no write occurred.

**How to avoid:**

- Serialize requests and pause between mutative calls; follow GitHub's guidance to wait at least one second between large batches and honor `Retry-After`/`x-ratelimit-reset`.
- Retry GETs with bounded backoff and authenticated conditional requests. For a mutation with an uncertain outcome, reconcile by exact tag/milestone number before any retry.
- Stop on repeated 4xx responses; do not turn a 403/404 into repeated create attempts. Use stable filters and pagination rather than repeatedly scanning full lists.
- Keep a request budget and an operation journal so a retry storm is visible and bounded.

**Warning signs:**

- HTTP 429, 403 secondary-limit messages, or a falling `x-ratelimit-remaining` value.
- Several POSTs within seconds for one tag.
- A 404 is immediately interpreted as “create it.”

**Phase to address:** P3.

**Negative control:** Mock 429 with `Retry-After`, a POST timeout after commit, and a repeated 404; the client must back off/read back and never issue an unreconciled duplicate POST.

## Moderate Pitfalls

### Moderate Pitfall 1: Release and CI trigger assumptions are wrong

**What goes wrong:**

The current CI workflow runs on every push and pull request, not because a Release or Milestone event exists. A future publication workflow may not run on tag creation, may be filtered by paths/branches, or may be invoked manually only from the default branch. A required check can remain pending when a workflow is skipped by a filter. Conversely, using `GITHUB_TOKEN` to create repository changes can suppress or require approval for follow-up workflow events.

**Why it happens:**

Developers infer CI coverage from the existence of a workflow rather than its event matrix, and assume a release event automatically proves the same checks ran on the release commit.

**How to avoid:**

Document the exact trigger and `GITHUB_SHA`/`GITHUB_REF` for the publication workflow. Keep publication operator-invoked (`workflow_dispatch` or an equivalent explicit surface), pin inputs, and independently query the existing target-SHA checks rather than relying on a release-triggered run. Avoid `pull_request_target`/`workflow_run` with untrusted checkout for a privileged publication job.

**Warning signs:** A manual release path has no corresponding CI run, a tag is filtered out, or a workflow is skipped but the required check is treated as satisfied.

**Phase to address:** P3; verify trigger behavior in P4.

### Moderate Pitfall 2: Generated notes and dates are not a factual publication record

**What goes wrong:**

Automatically generated notes can change as the comparison range/template changes, include commit-message text or mentions, and sort differently from the historical completion record. A tag date and Release publication date are different concepts, and “latest” is based on Release metadata rather than a semantic proof of the merge.

**Why it happens:**

Generated notes are convenient for new releases but are not a stable audit record for recovering a known milestone.

**How to avoid:**

Use a checked-in or operator-supplied factual completion note for v0.1.1, disable auto-generation for this recovery, and read back the exact body. Do not use `created_at`/tag date as a substitute for the verified commit SHA. Record the actual publication timestamp separately.

**Warning signs:** Notes differ between reruns, contain unintended mentions, or claim changes outside the verified range.

**Phase to address:** P1 and P3.

### Moderate Pitfall 3: Check retention and rerun limits make old evidence disappear or become non-reproducible

**What goes wrong:**

GitHub documents finite check retention and limits workflow re-runs. An old red run may no longer be available for inspection, while rerunning an old run preserves its original SHA/ref rather than proving the current tag. Deleting or ignoring the failed run destroys the explanation for a release incident.

**Why it happens:**

A recovery plan is written as if all historical checks are permanent and rerun means “run current code again.”

**How to avoid:**

Capture run IDs, target SHA, conclusion, and root-cause notes in the publication evidence while the data is available. Use current exact-SHA checks for the gate; preserve historical failures as superseded evidence rather than deleting them. Treat archived/missing old checks as a reason for caution, not permission to infer green.

**Warning signs:** A run is older than retention, rerun returns the original SHA, or a dashboard has no historical context.

**Phase to address:** P2 and P3.

### Moderate Pitfall 4: A clean local checkout is mistaken for a clean release candidate

**What goes wrong:**

A clean local tree can still be on the wrong branch, have a stale remote-tracking ref, lack the tag object locally, or point at a commit that was never pushed. Conversely, the current tree is dirty only in planning state; publication should not require rewriting or committing that unrelated state.

**Why it happens:**

Developers use local status as a proxy for remote provenance and conflate “working directory clean” with “release commit is correct.”

**How to avoid:**

Make remote SHA/ref/API equality the release invariant. Treat local state as diagnostic only; do not make the operator commit, stash, or reset planning files to satisfy a release gate.

**Warning signs:** `git status` is clean but `origin/main` differs, or the script tries to clean unrelated files before publishing.

**Phase to address:** P2.

## Technical Debt Patterns

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| `gh release create` without `--verify-tag` | One short command | Can create a new tag at the wrong default-branch commit | Never for this milestone |
| Trust `git rev-parse "$tag"` | Avoids peeling syntax | Compares a tag object to a commit and breaks valid recovery | Never; use `^{commit}` and remote peel |
| Trust `target_commitish` or `HEAD` | No extra ref query | Release can appear tied to the wrong commit | Never for publication proof |
| Use combined commit status as the CI gate | Simple legacy endpoint | Actions checks appear absent/pending even when green | Never for an Actions-based gate |
| Search the first 30 Releases/Milestones | Minimal API code | Misses page-two objects and creates duplicates | Never; paginate and use stable identity |
| Treat a Milestone title as a primary key | Human-readable lookup | Renames/duplicates make close/update ambiguous | Only as a discovery hint; use number after exact match |
| Retry every failed POST | “Eventually succeeds” | Duplicates, rate limits, and lost provenance | Never without read-after-uncertainty reconciliation |
| Delete/recreate on rollback | Quick cleanup | Loses IDs/history and can damage a valid tag | Never for v0.1.1; fix forward |
| Add publication permissions to the test CI job | Fewer workflows | Broadens the blast radius of every CI run | Only with a separate least-privilege operator surface |
| Hardcode `backend`, `frontend`, and a run ID | Simple fixture/code | Fails silently when protection or workflow changes | Never in production logic; assert configuration |

## Integration Gotchas

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| GitHub Releases REST/CLI | Create without checking for an existing Release/draft | Paginated exact-tag preflight, serialized create, ID-based readback, retry only after reconciliation |
| GitHub Git refs | PATCH/force a tag to make a Release match | Compare remote peeled SHA; stop on mismatch; preserve the tag |
| GitHub Milestones REST | Default `state=open`, first page, title-only update | `state=all` + pagination, exact candidate count, persist number, PATCH by number |
| GitHub Actions Checks | Read `/status` or scan runs by time | Exact `head_sha`, workflow/app/job identity, completed `success`; retain historical failure separately |
| Branch protection | Assume `strict:false` means optional checks or that tags are covered | Keep required contexts green; read enforcement; add a separate tag ruleset |
| `GITHUB_TOKEN`/PAT/App | Reuse CI `contents:read` or assume public reads imply write | Explicit endpoint permission matrix and a separate least-privilege operator credential |
| REST API | Fire concurrent mutations or poll first pages | Serialize mutations, honor rate-limit headers, paginate and use conditional GETs |
| GitHub CLI | Use `--target` as proof of an existing tag | `--verify-tag` plus remote peeled-SHA preflight; avoid tag/target edit flags |
| Shell/workflow runner | Inline untrusted ref/title/notes into `run` | Validate, pass via environment/arguments, quote, and use structured API input |

## Performance Traps

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| Listing only the default page | Missing old closed Milestones or Releases; duplicate create | Complete pagination with stable filters | More than 30 objects (endpoint default) |
| Repeated full-repository Actions scans | Rate-limit pressure and slow preflight | Query exact SHA/workflow and use `filter`/pagination deliberately | More than 1,000 runs/check suites for a search dimension |
| Unbounded polling after a write | API abuse, ban risk, operator uncertainty | Bounded backoff and a readback state machine | Any transient 5xx/timeout/secondary limit |
| Concurrent operators | Duplicate releases/milestones, cancellation half-state | One lock/queue per repository/tag | Two operators or two workflow dispatches |
| Large generated notes/assets | Slow API calls and notification/secondary-limit pressure | Keep v0.1.2 notes concise; use draft/assets only when needed | Future releases with large assets or generated history |
| Polling every check suite on every retry | Latency and rate-limit growth with historical runs | Select target SHA and current run attempt once; cache within one invocation | Repositories with many workflows/reruns |

## Security Mistakes

| Mistake | Risk | Prevention |
|---------|------|------------|
| Inline `${{ inputs.tag }}`, title, ref, or notes in a shell `run` block | Script injection with publication credentials | Strict allowlist, env/argument passing, quoting, no `eval`, structured JSON |
| Reuse a broad PAT or give the test job write permissions | Any compromised CI step can publish/delete remote objects | Separate operator credential; Contents/Issues/Actions least privilege; explicit workflow permissions |
| Log `GH_TOKEN`, `GITHUB_TOKEN`, or verbose HTTP headers | Credential disclosure in Actions logs | Disable tracing around secrets; redact and rotate if exposed |
| Force-update/delete a tag during recovery | Supply-chain/history rewrite and consumer divergence | No-force policy, tag ruleset, exact peeled-SHA invariant, fix-forward runbook |
| Accept a check name without app/suite identity | A different integration or duplicate workflow can satisfy the gate | Require expected app, context, SHA, and completed success |
| Treat untrusted event fields as shell text | Remote command execution on a privileged runner | Use GitHub's script-injection guidance and least privilege |
| Temporarily disable branch/tag protection to “unblock” release | Removes the regression/safety gate during a sensitive operation | Use PR flow; fail closed; require human recovery for protection changes |

## UX Pitfalls

| Pitfall | User Impact | Better Approach |
|---------|-------------|-----------------|
| “Tag exists” is shown as “Release published” | Consumers cannot install or auditors falsely believe closure is complete | Separate badges/states for tag, Release, and Milestone; require remote readback |
| A draft is reported as complete | Maintainers see a green local report while public state is absent | Show `draft`, `published_at`, and URL explicitly |
| A historical red run is displayed beside target green checks | Operator blocks a valid release or hides the real root cause | Label SHA/ref/run ID and mark superseded failures explicitly |
| Combined status says pending while Checks are green | Operator reruns or disables the gate unnecessarily | Display source-specific Checks results and explain Actions-vs-status |
| A 403/404 is rendered as “object missing” | Operator retries mutations and creates duplicates or hides a permission error | Preserve HTTP status, request ID, and permission diagnosis |
| A timeout is rendered as definitive failure | Operator deletes/recreates valid objects | Report “outcome unknown; reconcile” and re-read before action |
| Two milestones share a title | Close/update lands on the wrong completion record | Show milestone number and require an unambiguous exact match |

## Negative Controls and Test Matrix

These are the minimum tests/negative controls the roadmap should require before the operator path is called reliable. Tests should use a mocked GitHub API or a disposable repository; they must not mutate `ldsampaio/sgrf` as a test fixture.

### Unit and validation controls

1. **Version/ref parser:** accepts only the intended version grammar; rejects empty values, control characters, shell metacharacters, ambiguous short SHAs, and malformed `refs/` names.
2. **Tag resolver:** handles annotated tag object, peeled commit, lightweight tag, missing ref, and API object type `tag` versus `commit`; never falls back to `HEAD`.
3. **Signature policy:** verifies the commit layer and records the tag layer independently.
4. **State classifier:** distinguishes absent, draft, prerelease, published, immutable, wrong-tag, and conflicting Release states.
5. **Milestone matcher:** handles zero, one, and multiple exact-title matches; handles open-only, closed, and paginated listings.
6. **Check matcher:** requires exact SHA, expected app, workflow/job names, completed status, and `success`; rejects neutral/skipped/pending/cancelled/stale/timed-out and wrong-source checks.
7. **Shell-safety test:** malicious title/ref/notes values cannot execute a command or alter the argument vector.

### Mocked API scenario matrix

| Scenario | Expected behavior | Negative assertion |
|----------|-------------------|-------------------|
| No remote tag | Abort before mutation | Zero release/ref POSTs |
| Tag peels to wrong SHA | Abort | Zero Release/Milestone writes |
| Target checks green; historical run red on another SHA | Pass target preflight | Historical run is not selected |
| Target check pending or wrong app | Abort | No “latest run” shortcut |
| No Release | One serialized create, then readback | No automatic tag creation |
| Matching draft Release | Resume or publish only if policy allows | Do not create a second Release |
| Matching published immutable Release | Read back and reconcile metadata only | No tag/asset delete or force update |
| Two Releases with same tag | Abort for manual review | No create/edit/delete |
| No Milestone | Create once, persist number, close after Release readback | No close-by-title |
| Closed Milestone hidden by `state=open` | Find it with `state=all` | No duplicate create |
| Duplicate Milestone title | Abort | No arbitrary-number close |
| Release exists, Milestone absent | Create/reconcile only Milestone | No duplicate Release |
| Milestone exists, Release absent | Create/reconcile only Release | No duplicate Milestone |
| POST commits then connection drops | Re-read and converge | No blind second POST |
| 403/404 permission response | Stop with permission diagnosis | No “create because absent” fallback |
| Two invocations race | One mutates, other reconciles | Exactly one object per tag/number |
| Main advances after preflight | Abort before mutation | No publication against new SHA |
| 429/secondary limit | Back off/read journal | No unbounded retry or duplicate |

### Live acceptance readback (P1/P3)

For the real repository, record and compare:

- `GET /repos/ldsampaio/sgrf/git/ref/tags/v0.1.1` plus the peeled tag object/commit.
- `GET /repos/ldsampaio/sgrf/commits/10c62ac85fd3ab275b8926c89f5f34ba4116e2cf/check-runs` and the selected workflow run IDs/attempts.
- `GET /repos/ldsampaio/sgrf/branches/main/protection` (contexts, app IDs, `strict`, `enforce_admins`).
- `GET /repos/ldsampaio/sgrf/releases?per_page=100` with pagination, then Release-by-ID and Release-by-tag readback.
- `GET /repos/ldsampaio/sgrf/milestones?state=all&per_page=100` with pagination, then Milestone-by-number readback.
- Final URLs/IDs/SHAs in the operator evidence. A local `git status`, a GSD file, or a successful CLI exit code alone is not acceptance proof.

## "Looks Done But Isn't" Checklist

- [ ] **Tag:** remote annotated ref exists; peeled commit is the full expected SHA; no tag was created, moved, deleted, or force-updated.
- [ ] **Signature:** the intended commit signature and tag-object signature are reported separately; the policy's required layer is verified.
- [ ] **Repository:** `owner/repo`, host, default branch, and remote URL are the intended values; local drift is not used as proof.
- [ ] **Main:** remote `main` still equals the expected SHA at the final readback.
- [ ] **Protection:** required contexts/apps, `strict`, and `enforce_admins` were read back; no protection was disabled or bypassed.
- [ ] **CI:** exact target SHA has completed successful `backend` and `frontend` Checks from the expected Actions app; historical/superseded runs are not conflated.
- [ ] **Checks source:** the combined commit-status endpoint was not used as the sole Actions gate.
- [ ] **Release uniqueness:** all pages were searched; exactly one matching Release exists, or an intentional create was followed by ID-based readback.
- [ ] **Release state:** `tag_name` is exact, `draft`/`prerelease` are deliberate, `published_at` is non-null, and latest policy is explicit.
- [ ] **Release target:** peeled tag SHA, not only `target_commitish`, is recorded and matches `main`/the expected commit.
- [ ] **Milestone identity:** all states/pages were searched; exactly one title candidate maps to a persisted number; title/description are factual.
- [ ] **Milestone closure:** `PATCH` used the persisted number; final `state=closed` and `closed_at` were read back.
- [ ] **Partial success:** every intermediate object state is restartable; ambiguous responses reconcile before retry.
- [ ] **Concurrency:** one repository/tag lock or workflow queue governed the mutation; no canceling run was left half-published.
- [ ] **Permissions:** the actual endpoint permissions were proven; the CI `contents:read` token was not reused accidentally for publication.
- [ ] **Shell safety:** all inputs were validated and passed as data; no `eval`, unquoted interpolation, or secret logging exists.
- [ ] **Rate limits:** mutations were serialized and retry behavior honored `Retry-After`/rate-limit headers.
- [ ] **Rollback:** the runbook contains no delete/force/recreate path for the valid `v0.1.1` tag; recovery is fix-forward.
- [ ] **Evidence:** final proof is remote API/CLI readback with URLs, IDs, SHA, conclusions, and operator timestamp.

## Recovery Strategies

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| Wrong/missing tag or peeled SHA | HIGH | Freeze publication; preserve the tag; investigate ref history and operator inputs; do not recreate/force; issue a new version only by explicit decision |
| Unsigned tag object but valid signed commit | LOW | Record the distinction; verify the commit; do not rewrite the tag merely to satisfy `verify-tag` |
| Local/remote drift or wrong repo | MEDIUM | Re-run read-only preflight against the pinned remote/API; discard local cache assumptions; no mutation until exact equality |
| Main/tag race | MEDIUM | Acquire lock, compare current refs to the expected SHA, abort if changed; rerun from a fresh operator invocation after human review |
| Historical/wrong CI run selected | LOW | Discard the selection; query exact target SHA/workflow/app; retain the failed run as superseded evidence |
| Check name/app mismatch or skipped job | MEDIUM | Fix workflow/protection configuration; rerun the correct jobs; do not fabricate a status or bypass protection |
| Missing permission | LOW–MEDIUM | Inspect accepted permissions and token scopes; switch to the approved least-privilege operator credential; rerun preflight |
| Draft/prerelease/partial Release | MEDIUM | Read by tag/list and ID; resume the exact draft only if mutable and policy permits; publish only after final checks; never create a duplicate |
| Duplicate Release or ambiguous Milestone | HIGH | Stop automation; inventory all pages/IDs; human-select or repair the correct object; do not delete blindly; record incident |
| Partial Release/Milestone write or lost response | MEDIUM | Follow the reconciliation state machine; re-read by exact tag/number; complete only the missing step; final readback |
| Concurrent/canceled publication | MEDIUM | Serialize future invocations; inspect all remote objects and run evidence; reconcile the surviving partial state; do not cancel a run mid-mutation without a journal |
| Rate limit during retry | LOW | Honor `Retry-After`/reset, wait, then GET/reconcile; never blindly repeat a POST |
| Shell-injection or token exposure | HIGH | Stop the job, rotate exposed credentials, review audit/logs and remote objects, preserve evidence, rebuild the invocation with safe input handling |
| Rollback attempted too far | HIGH | Do not delete/force the valid tag; preserve IDs/audit evidence, escalate, and publish a new version only through the approved path |

## Pitfall-to-Phase Mapping

| Pitfall | Prevention Phase | Verification |
|---------|------------------|--------------|
| 1. Tag object vs commit; `target_commitish` | P1, P2 | Remote peeled-SHA test; no ref mutation; final exact-SHA readback |
| 2. Automatic tag creation | P1, P3 | `--verify-tag` static check; absent-tag negative control |
| 3. Commit vs tag signature | P2 | Unsigned-tag/verified-commit and wrong-commit fixtures |
| 4. Local/remote/wrong repository | P1, P2 | Wrong-directory/`GH_REPO` negative control; remote API equality |
| 5. Main/tag TOCTOU race | P2, P3 | Lock plus simulated main advance; zero writes after mismatch |
| 6. Historical/wrong-SHA CI | P2 | Incident-shaped fixture; exact target SHA/app/job readback |
| 7. Check identity and conclusion | P2, P4 | Wrong-app, duplicate-name, skipped/neutral fixtures; protection readback |
| 8. `strict:false`, admin enforcement, tag protection | P2, P4 | Protected disposable-repo test; tag ruleset verification; no bypass |
| 9. Token/endpoint permissions | P2, P3 | Read-only-token/403/404 negative controls; least-privilege matrix |
| 10. Draft/prerelease/latest states | P1, P3 | State-classifier fixtures and final Release readback |
| 11. Duplicate Release/CLI retries | P1, P3 | Timeout-after-create and two-operator race tests; exact-tag inventory |
| 12. Milestone title/number/pagination | P1, P3 | Page-two, closed-only, and duplicate-title fixtures; number-based close |
| 13. Partial writes/no transaction | P3 | Full partial-state matrix; restartable journal and final readback |
| 14. Concurrent invocations/cancellation | P3 | Simultaneous mock invocations; one mutation owner |
| 15. Shell injection | P2, P3 | Metacharacter/newline payloads; no command execution or API mutation |
| 16. Destructive rollback/immutability | P1, P3, P4 | Static delete/force ban; immutable-release and tag-ruleset tests |
| 17. Rate limits/blind retries | P3 | 429/`Retry-After`/lost-response fixtures; bounded retry/readback |
| Moderate trigger/visibility assumptions | P3, P4 | Trigger matrix and skipped/filtered workflow test |
| Moderate notes/date drift | P1, P3 | Fixed factual body and readback; generated-notes disabled for recovery |
| Moderate check retention/rerun | P2, P3 | Evidence journal and original-SHA rerun assertion |
| Moderate local cleanliness proxy | P2 | Remote-only acceptance test with dirty local planning state |

### Research flags by phase

- **P1:** No broad ecosystem research is needed, but the human operator must perform a live read-only preflight and approve the exact Release body/Milestone description. Do not let a recovery script infer them.
- **P2:** Needs the most research/verification: the implementation must pin the API version, define deterministic selection among multiple check suites/reruns, and test Actions Checks versus legacy statuses against the exact repository shape.
- **P3:** Needs a concurrency/recovery spike in a disposable repository or a high-fidelity API mock. The unresolved question is not whether the endpoint exists; it is how the chosen operator surface serializes two invocations and handles a lost response without duplicate writes.
- **P4:** Confirm repository-owner availability/eligibility for immutable releases and tag rulesets. The setting applies only to future immutable releases; it must not be represented as retroactive protection for `v0.1.1`.

## Sources

### Primary GitHub/Git/CLI documentation

Documentation was checked on 2026-09-25. The current Git manual pages identify the 2.55.0 line and the installed GitHub CLI manual was 2.101.0; API references use the explicit `2022-11-28` version parameter for reproducibility while the rendered docs also show the current API version header.
- [GitHub Releases REST API](https://docs.github.com/en/rest/releases/releases?apiVersion=2022-11-28) — release fields, create/update/delete, draft/prerelease/latest, target behavior, status codes, and workflow permission note.
- [GitHub Milestones REST API](https://docs.github.com/en/rest/issues/milestones?apiVersion=2022-11-28) — pagination, `state=all`, stable milestone number, create/update/close.
- [GitHub Check runs REST API](https://docs.github.com/en/rest/checks/runs?apiVersion=2022-11-28) — `head_sha`, check names/apps/suites, conclusions, list-by-ref and `filter` behavior.
- [GitHub Actions workflow runs REST API](https://docs.github.com/en/rest/actions/workflow-runs?apiVersion=2022-11-28) — `head_sha`, workflow/run identity, rerun behavior, and cancellation endpoints.
- [GitHub status checks reference](https://docs.github.com/en/pull-requests/reference/status-checks) — Actions Checks versus commit statuses, conclusions, skipped jobs, and check retention.
- [GitHub protected branches](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-protected-branches/about-protected-branches) — required checks, `strict`/loose behavior, admin enforcement, and bypass semantics.
- [GitHub available ruleset rules](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-rulesets/available-rules-for-rulesets) and [About rulesets](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-rulesets/about-rulesets) — tag targeting, status checks, update/delete restrictions, and rule layering.
- [GitHub App permissions](https://docs.github.com/en/rest/authentication/permissions-required-for-github-apps) and [fine-grained PAT permissions](https://docs.github.com/rest/authentication/permissions-required-for-fine-grained-personal-access-tokens) — endpoint-specific Contents, Issues, and Actions permissions.
- [GitHub Actions workflow syntax: permissions](https://docs.github.com/en/actions/writing-workflows/workflow-syntax-for-github-actions#permissions) and [`GITHUB_TOKEN` authentication](https://docs.github.com/en/actions/tutorials/authenticate-with-github_token) — least privilege and token limitations.
- [GitHub Actions concurrency](https://docs.github.com/en/actions/how-tos/write-workflows/choose-when-workflows-run/control-workflow-concurrency) — one running run per group, pending replacement, queueing, and cancellation.
- [GitHub REST best practices](https://docs.github.com/en/rest/using-the-rest-api/best-practices-for-using-the-rest-api) and [pagination](https://docs.github.com/en/rest/using-the-rest-api/using-pagination-in-the-rest-api) — conditional requests, rate limits, serial mutations, Link headers, and page size.
- [GitHub CLI `gh release create`](https://cli.github.com/manual/gh_release_create), [`gh release view`](https://cli.github.com/manual/gh_release_view), [`gh release edit`](https://cli.github.com/manual/gh_release_edit), and [`gh api`](https://cli.github.com/manual/gh_api) — automatic tag creation, `--verify-tag`, state flags, JSON readback, and safe structured requests.
- [GitHub managing Releases](https://docs.github.com/en/repositories/releasing-projects-on-github/managing-releases-in-a-repository) and [immutable releases](https://docs.github.com/en/code-security/concepts/supply-chain-security/immutable-releases) — draft/publish sequence, editing/deletion, tag/asset locking, and future-only enforcement.
- [GitHub script-injection guidance](https://docs.github.com/en/actions/concepts/security/script-injections) — untrusted contexts, shell interpolation, and safe data flow.
- [Git `rev-parse`](https://git-scm.com/docs/git-rev-parse), [`ls-remote`](https://git-scm.com/docs/git-ls-remote), [`tag`](https://git-scm.com/docs/git-tag), [`verify-tag`](https://git-scm.com/docs/git-verify-tag), and [`verify-commit`](https://git-scm.com/docs/git-verify-commit) — tag-object peeling, remote refs, annotated tags, and signature layers.

### Read-only repository evidence (2026-09-25; HIGH for current state)

- [Repository Releases API](https://api.github.com/repos/ldsampaio/sgrf/releases) — only `v0.1.0` was present; `v0.1.1` was absent.
- [Repository Milestones API](https://api.github.com/repos/ldsampaio/sgrf/milestones?state=all&per_page=100) — no Milestones were present.
- [Remote v0.1.1 ref](https://api.github.com/repos/ldsampaio/sgrf/git/ref/tags/v0.1.1) and [annotated tag object](https://api.github.com/repos/ldsampaio/sgrf/git/tags/0a68d6f0c55e7be07d13a0bbc4ed36d4af772630) — tag object and peeled commit evidence.
- [Target commit Checks](https://api.github.com/repos/ldsampaio/sgrf/commits/10c62ac85fd3ab275b8926c89f5f34ba4116e2cf/check-runs) and [workflow runs](https://api.github.com/repos/ldsampaio/sgrf/actions/runs?head_sha=10c62ac85fd3ab275b8926c89f5f34ba4116e2cf&per_page=100) — green target runs and historical red run distinction.
- [Main branch protection](https://api.github.com/repos/ldsampaio/sgrf/branches/main/protection) — current contexts/app, `strict:false`, and administrator enforcement.

---
*Pitfalls research for: SGRF/SGRD v0.1.2 GitHub Release Reliability*
*Researched: 2026-09-25*
