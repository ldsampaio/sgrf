# Feature Research

**Domain:** GitHub Release and Milestone publication reliability for SGRF milestone closure
**Researched:** 2026-09-25
**Confidence:** MEDIUM overall. Platform behavior was cross-checked against current first-party GitHub documentation and read-only GitHub API/CLI evidence; the research seam classifies verified web research as MEDIUM. GitHub does not document Milestone-title uniqueness, so the recommended workflow treats titles as non-unique and refuses ambiguity.

## Confidence by Evidence Class

| Finding class | Confidence | Basis |
|---|---|---|
| GitHub platform constraints and object behavior | MEDIUM | Current first-party GitHub REST/help/CLI documentation, cross-referenced across independent endpoints; research seam rates verified web research MEDIUM |
| SGRF-specific release-close requirements | HIGH | Directly anchored in `.planning/PROJECT.md`, `AGENTS.md`, `.github/workflows/ci.yml`, and the user's quality gate |
| Observed v0.1.1 remote baseline | HIGH | Direct read-only GitHub API/CLI readback on 2026-09-25; time-sensitive by definition |
| Milestone-title uniqueness | UNDOCUMENTED / treated as unsafe | GitHub documents lookup by Milestone number, not title uniqueness; the workflow therefore refuses zero/one/multiple ambiguity rather than relying on an unstated guarantee |

## Executive Decision

A reliable milestone-close workflow is a **fail-closed, operator-invoked reconciler**, not a one-shot pair of `create` commands. It must prove the repository, exact annotated tag, peeled commit, current `main` SHA, and required CI checks before any write; publish and read back the GitHub Release; then create or close and read back the GitHub Milestone; finally emit a remote-evidence bundle.

GitHub Release and GitHub Milestone are separate objects with separate jobs:

| Object | Operator meaning | Identity used for idempotency | Required final evidence |
|---|---|---|---|
| Annotated tag | Immutable version pointer used to build the release | `refs/tags/<version>` → tag object → commit | Exact tag-object SHA and peeled full commit SHA; never changed by this workflow |
| GitHub Release | Consumer-facing package of the tagged version, notes, and optional assets | `tag_name`, then stable Release `id` | `draft=false`, intended prerelease flag, non-null `published_at`, stable ID/URL, and the tag independently resolves to the target commit |
| GitHub Milestone | Planning/progress record for issues and pull requests | Milestone `number`; exact title is a discovery key, not a documented unique key | Exactly one unambiguous exact-title object, `state=closed`, non-null `closed_at`, no open associated issues, and the expected completion record |
| Required CI checks | Quality gate for the exact release commit | Check-run name + producing app + full `head_sha` | `backend` and `frontend` are completed with conclusion `success` on the same target SHA and compatible workflow run |

A tag does not prove a Release exists, and a closed Milestone does not prove a Release was published. GitHub defines Releases around tags and Milestones around groups of issues or pull requests; neither object creates or closes the other. [G1][G4]

## Feature Landscape

### Table Stakes (Operators Expect These)

| ID | Operator-observable capability | Why expected | Complexity | Testable acceptance rule |
|---|---|---|---|---|
| TS-01 | **Repository and authorization preflight** | A release must never be written to the wrong GitHub repository or with an unproven token. Release management requires push access; milestone mutation also needs issue-write authority. | LOW | Read back repository identity/default branch, authenticate, and prove read access to refs/check-runs plus write access to Releases and Milestones. A wrong repo, 401, or 403 exits before POST/PATCH/DELETE. |
| TS-02 | **Existing-tag guard** | The milestone explicitly preserves the valid annotated `v0.1.1` tag. A release tool that can auto-create a tag can silently publish the wrong commit. | LOW | Require exactly `refs/tags/<version>`; if it is annotated, dereference its tag object to a commit. Missing, lightweight, ambiguous, or differently targeted tags block publication. Never create, move, or delete the tag. |
| TS-03 | **Exact `main`/tag SHA guard** | A version may not be advertised as the current release while pointing at a different commit. The current close must be coherent at mutation time. | LOW | Before each mutation, read current remote `main` and the peeled tag commit. They must be identical full 40-character SHAs. `strict:false` branch protection is acceptable, but does not replace this guard. |
| TS-04 | **Required-CI proof for the target SHA** | Historical red runs can coexist with a later green release commit. The gate must inspect the release SHA, not whichever run appears first in a list. | MEDIUM | Read branch-protection required checks and verify the expected `backend` and `frontend` jobs are completed with conclusion exactly `success`, emitted by the expected GitHub Actions app, on the same full target SHA. Missing, queued, failed, cancelled, timed out, neutral, or skipped blocks. Record run IDs and URLs. |
| TS-05 | **Separate read-only verification mode** | Operators need to audit a version without risking publication or cleanup. It is also the safe first step of recovery. | MEDIUM | A `verify`-only operation performs GET/list reads only; it never creates, updates, deletes, reruns CI, or touches refs. It prints a per-invariant PASS/FAIL table and returns non-zero unless tag, Release, Milestone, and captured CI evidence all prove the requested close state. |
| TS-06 | **GitHub Release reconciliation** | v0.1.1 has a valid tag but no Release. The operator needs a published, factual, non-draft Release bound to that existing tag. | MEDIUM | Discover exact-tag Releases, including drafts visible to the operator. Zero matches → create from the existing tag with tag auto-creation disabled. One exact match → adopt it only if its declared state/content matches; an unambiguous expected draft may be published. More than one or a materially different published Release → conflict, no automatic overwrite. |
| TS-07 | **GitHub Milestone reconciliation** | Closing the GSD milestone in local docs does not create GitHub planning history. The GitHub Milestone must separately exist and be closed. | MEDIUM | Search all Milestone pages with `state=all`. Zero exact-title matches → create after the Release is verified. One open match with the correct identity → update its completion record and close it. One already-closed matching object → adopt as no-op. Duplicate exact titles or a closed object with materially different content → conflict. |
| TS-08 | **Ordered, explicit mutation path** | Release publication is the consumer-facing proof; Milestone closure is planning history. Closing the Milestone first can leave the repository claiming completion without a Release. | MEDIUM | Expose a dry-run/plan, then require an explicit operator apply action. Sequence: preflight → revalidate refs/CI → publish/read back Release → reconcile/read back Milestone → final evidence. There is no cross-object transaction, so a partial state must be reported rather than hidden. |
| TS-09 | **Idempotent rerun after partial or ambiguous success** | A timeout does not prove a write failed, and a second run must not duplicate Releases or Milestones. | MEDIUM | Every rerun inventories remote state first. A matching object is adopted by stable ID/number; actions are reported as `create`, `update`, `adopt`, or `no-op`. After any timeout/422/5xx, read back before retrying. Concurrent duplicate POST failures resolve by readback, not blind retry. |
| TS-10 | **Final remote readback and evidence manifest** | Command exit text and local GSD files are not publication proof; GitHub API/CLI readback is authoritative. | MEDIUM | Completion requires fresh readback of tag/ref, CI run/job conclusions, Release fields, and Milestone fields. Emit a secret-free evidence record with repository, version, close-time `main_sha`, tag-object and peeled SHAs, run IDs/URLs, Release ID/URL, Milestone number/URL, timestamps, and action result. |
| TS-11 | **Stable, actionable failure messages** | Operators must know whether nothing changed, what remains partial, or what requires manual conflict resolution. | LOW | Use stable reason codes and include observed/expected values and object IDs/URLs. Every preflight failure states `no GitHub objects changed`; an ambiguous write reports `PARTIAL_OR_UNCERTAIN` until readback resolves it. |
| TS-12 | **Forward recovery, never tag rollback** | Deleting or moving the valid tag is explicitly out of scope and can break an already consumed version. GitHub object deletion is not a safe transaction rollback. | MEDIUM | Default recovery is readback, repair of mutable draft/open state, and rerun. Never invoke tag deletion or force-update. A published Release or closed Milestone conflict requires manual review; only an object proven to belong to the current failed run may be explicitly removed or corrected without touching the tag. |

### Read-Only Verification Contract

A verifier should answer one question: **“Does remote GitHub currently prove that this version was closed safely?”** It should not need write permission merely to audit.

It must test these invariants independently:

1. Repository and default branch resolve to the intended repository.
2. The requested tag exists; an annotated tag is dereferenced to its commit.
3. For a **close-preflight audit**, remote `main` currently equals the peeled tag commit. For a **historical audit after later work has landed**, current-`main` divergence is informational; the historical close must instead rely on the recorded close-time SHA and a coherent tag/Release/Milestone. This prevents old releases from becoming permanently “invalid” merely because `main` advances.
4. The required check names, producing app, and successful conclusions are evidenced for the target SHA.
5. Exactly one unambiguous Release is associated with the tag, is published, is not a draft, has the intended prerelease state, and resolves through the tag to the target commit.
6. Exactly one unambiguous exact-title Milestone exists, has no open associated issues, has the expected completion record, is closed, and has `closed_at`.
7. The final result is `COMPLETE` only when all applicable invariants pass.

Expected read-only outputs:

- `COMPLETE version=v0.1.1 sha=<40-char> release=<id> milestone=<number>`
- `INCOMPLETE version=v0.1.1 release=missing milestone=missing next=publish-release`
- `INCOMPLETE version=v0.1.1 release=<id> milestone=#N(state=open) next=close-milestone`
- `CONFLICT version=v0.1.1 object=release reason=published-content-differs`
- `BLOCKED version=v0.1.1 reason=CI_NOT_READY backend=in_progress`
- `UNVERIFIABLE version=v0.1.1 endpoint=check-runs status=403`

In every non-complete result, the verifier must state `mutations=0`.

## Preconditions and Failure Semantics

### All Preflight Conditions

No Release or Milestone mutation may begin until all of these are true:

- The intended repository, default branch, version, and expected factual notes are explicit.
- GitHub authentication is valid and the credential can read refs/check-runs and write Releases/Milestones.
- The remote tag exists exactly once, is an annotated tag, and peels to a commit.
- Current remote `main` and the peeled tag commit are the same full SHA.
- Branch protection contains required `backend` and `frontend` checks, admin enforcement remains enabled, and the checks come from the expected app. `strict:false` is not a release failure.
- At least one completed CI workflow run for that exact full SHA has a latest attempt in which both required jobs succeeded. Record the chosen run and any additional target-SHA runs as evidence.
- The Release and Milestone inventories contain no ambiguous or materially conflicting object.
- The planned mutations are shown to the operator, who explicitly invokes apply mode.

GitHub documents that required checks must succeed on the latest commit SHA, while older-commit checks do not satisfy protection. Its Checks API exposes per-SHA jobs and the Actions API exposes runs by full `head_sha`. [G8][G9][G10]

### Stable Failure Message Contract

| Reason code | Example operator message | Required mutation behavior |
|---|---|---|
| `AUTH_REQUIRED` | `AUTH_REQUIRED endpoint=releases write access could not be verified` | Stop; no writes |
| `REPO_MISMATCH` | `REPO_MISMATCH expected=ldsampaio/sgrf actual=<other>; no GitHub objects changed` | Stop; no writes |
| `TAG_MISSING` | `TAG_MISSING ref=refs/tags/v0.1.1; automatic tag creation is disabled` | Stop; no writes |
| `TAG_NOT_ANNOTATED` | `TAG_NOT_ANNOTATED ref=refs/tags/v0.1.1 type=commit expected=tag` | Stop; no writes |
| `TAG_TARGET_MISMATCH` | `TAG_TARGET_MISMATCH expected=<sha> actual=<sha>; no GitHub objects changed` | Stop; no writes |
| `REF_MISMATCH` | `REF_MISMATCH main=<sha> tag=<sha>; publication blocked before mutation` | Stop; no writes |
| `PROTECTION_DRIFT` | `PROTECTION_DRIFT required=[backend,frontend] enforce_admins=false` | Stop; no writes |
| `CI_NOT_READY` | `CI_NOT_READY sha=<sha> backend=failure(run=<id>) frontend=success(run=<id>)` | Stop; no writes |
| `CI_SOURCE_MISMATCH` | `CI_SOURCE_MISMATCH check=backend expected_app=github-actions actual_app=<slug>` | Stop; no writes |
| `RELEASE_CONFLICT` | `RELEASE_CONFLICT tag=v0.1.1 id=<id> published=true prerelease=true expected=false` | Stop; do not overwrite |
| `RELEASE_AMBIGUOUS` | `RELEASE_AMBIGUOUS tag=v0.1.1 matches=<count>` | Stop; do not choose one |
| `MILESTONE_CONFLICT` | `MILESTONE_CONFLICT title=v0.1.1 number=<n> state=closed content_differs` | Stop; manual review |
| `MILESTONE_AMBIGUOUS` | `MILESTONE_AMBIGUOUS title=v0.1.1 matches=#<n1>,#<n2>` | Stop; do not choose one |
| `REMOTE_UNVERIFIABLE` | `REMOTE_UNVERIFIABLE endpoint=milestones status=403; publication blocked` | Stop; fail closed |
| `PARTIAL_STATE` | `PARTIAL_STATE version=v0.1.1 release=published milestone=missing; rerun is safe` | No automatic cleanup; report next action |
| `PARTIAL_OR_UNCERTAIN` | `PARTIAL_OR_UNCERTAIN mutation=create-release; reading back before any retry` | Read back; then adopt/conflict/retry |
| `COMPLETE` | `COMPLETE version=v0.1.1 sha=<sha> release=<id> milestone=#<n>` | Success with evidence |

Failure messages should report observed values without exposing tokens. A 404 for a missing Release is a normal creation precondition, not itself an error during apply; in read-only mode it is an incomplete state.

## Idempotency, Recovery, and Rollback Rules

### Reconciliation Semantics

**Release**

- Discover all exact `tag_name` matches, including drafts visible to the authenticated operator. The documented get-by-tag endpoint is for a published Release, so list/readback must not rely on that endpoint alone when detecting drafts.
- Zero: create a published Release from the existing tag. Use a tag-verification option such as `gh release create --verify-tag`; do not allow automatic tag creation. [G3]
- One matching draft: if its content and flags match the declared desired state, update/publish that Release by ID and read it back.
- One matching published Release: adopt it without a write only when title/tag, draft/prerelease flags, and the declared factual notes match. A material difference is a conflict, not permission to overwrite.
- More than one: conflict.
- `target_commitish` is not commit proof when the tag already exists; GitHub documents that this input is unused in that case. Resolve the tag ref and annotated tag object separately. [G2][G6][G7]

**Milestone**

- List with `state=all` and paginate every page. GitHub identifies a Milestone by number and does not document title uniqueness. [G5]
- Zero exact title: after the Release passes readback, create the Milestone with the concise completion record and `state=closed`. Do not invent a due date when none was supplied.
- One exact open title: update only the declared record, require `open_issues=0`, close it, and read it back.
- One exact closed title whose record matches: adopt/no-op. This permits safe recovery when the Milestone was closed first but its factual record already matches.
- One exact closed title whose record materially differs: conflict.
- More than one exact title: conflict; never choose “the first open” or “the newest.”

**Ambiguous responses and races**

- After timeout, connection reset, 422, or 5xx from a write, read remote state before any retry.
- If another operator won the race and the resulting object matches, adopt it. If it conflicts, stop. GitHub does not provide a cross-endpoint transaction or a release-close idempotency key, so readback is the recovery boundary.

### Rollback Position

There is no safe automatic rollback across a tag, Release, and Milestone. Treat recovery as forward reconciliation:

1. Never delete, recreate, force-move, or retag the valid version tag.
2. Never use a Release deletion mode that also cleans up the tag.
3. A draft Release or open Milestone created by the current run may be corrected/reclosed after explicit operator review.
4. A published Release or closed Milestone with unexpected content is a user-visible historical object. Stop and report its ID/URL for manual remediation; do not silently rewrite history.
5. If a just-created object is demonstrably wrong and mutable, explicit deletion of that object alone may be allowed, followed by a full read-only verification and rerun. Tag preservation remains mandatory.
6. If immutable releases are enabled, published tags/assets cannot be changed or deleted, while title/notes and prerelease/latest flags remain editable. The close tool must surface immutability rather than promising rollback. [G3][G13]

## Concrete Completion Scenarios

| Scenario | Initial remote state | Expected apply behavior | Expected result/evidence |
|---|---|---|---|
| Valid tag; Release and Milestone missing | Annotated tag peels to target; `main` equals target; required jobs succeed | Create published Release; read it back; create closed Milestone with completion record; read it back | `COMPLETE`; one Release ID, one Milestone number, exact SHA/run evidence |
| Valid tag; Release missing; matching Milestone already closed | Release absent; one exact closed Milestone has the expected record | Create missing Release only; adopt closed Milestone | `COMPLETE` with `actions=create-release,adopt-milestone` |
| Valid tag; Release missing; closed Milestone differs | Closed exact-title Milestone has materially different record | Refuse before mutation | `MILESTONE_CONFLICT`; `mutations=0` |
| Valid tag; published Release exists; Milestone missing | One matching published Release | Adopt Release; create closed Milestone | No duplicate Release; `COMPLETE` |
| Valid tag; published Release exists; Milestone open | One matching Release; one exact open Milestone, no open issues | Adopt Release; update/close same Milestone number | `COMPLETE`; same Milestone number retained |
| Valid tag; both objects already complete | One matching published Release; one matching closed Milestone | No writes | `COMPLETE`; all actions are `adopt/no-op` |
| Expected Release exists only as draft | One exact draft matching declared notes/flags | Update that Release by ID, publish, read back; then reconcile Milestone | No second Release; `COMPLETE` or safe partial state |
| Required checks not green | Tag/main match, but backend/frontend missing, pending, skipped, neutral, cancelled, or failed | Block before mutation | `CI_NOT_READY`; `mutations=0` |
| `main`/tag SHA mismatch | Remote `main` differs from peeled tag commit | Block before mutation | `REF_MISMATCH` with both full SHAs; `mutations=0` |
| Historical failure at another SHA | Old run is red; exact target SHA has a completed successful backend/frontend run | Ignore the old SHA; prove the target run | `COMPLETE` eligible; evidence lists target run IDs and explicitly does not treat old failure as target failure |
| Rerun after Release-only partial success | Matching Release published; Milestone absent | Adopt Release, then create/close Milestone | `COMPLETE`; no duplicate Release |
| Rerun after API timeout | POST outcome unknown | Read back by tag/ID; adopt if present or retry only if proven absent | No blind duplicate POST |
| Conflicting published Release | Same tag but prerelease/draft/content differs from desired state | Stop | `RELEASE_CONFLICT`; `mutations=0` |
| Duplicate exact-title Milestones | Two or more exact `v0.1.1` Milestones | Stop; do not guess which is canonical | `MILESTONE_AMBIGUOUS`; `mutations=0` |
| `main` advances after preflight | Preflight passed; remote `main` changes before the next mutation | Revalidate and abort before the next write; preserve any already-published Release and report partial state | `REF_MISMATCH`; operator resolves state and reruns |
| Read-only verification of incomplete state | Any missing/unpublished/open/conflicting object | Perform no writes and no CI reruns | Non-zero `INCOMPLETE`/`CONFLICT`/`BLOCKED`; `mutations=0` |

## Evidence That Proves the Release Close Is Complete

Completion is a conjunctive invariant. Any missing item means the milestone is not fully published:

1. **Repository identity:** `ldsampaio/sgrf` and default branch `main` are the intended targets.
2. **Version identity:** requested version `v0.1.1` is present as an annotated remote tag.
3. **Commit identity:** tag-object SHA and peeled commit SHA are recorded; the peeled commit equals the close-time `main_sha`.
4. **CI identity:** required-check policy names `backend` and `frontend`; one coherent target-SHA workflow run has both jobs completed successfully, with run/job URLs recorded.
5. **Release identity:** exactly one unambiguous Release is associated with `v0.1.1`; it has a stable ID/URL, `draft=false`, intended prerelease flag, non-null `published_at`, factual notes, and an independently resolved tag commit equal to the target.
6. **Milestone identity:** exactly one unambiguous Milestone titled `v0.1.1`; it has a stable number/URL, `state=closed`, non-null `closed_at`, no open associated issues, and a concise record naming the version, target commit, Release URL, CI evidence, and factual accomplishments.
7. **Operation result:** final output identifies every action (`create`, `update`, `adopt`, `no-op`) and confirms a fresh post-mutation readback.

A local tag, a successful command exit, a local `.planning/MILESTONES.md` entry, or one of the two GitHub objects alone is insufficient.

## Differentiators (Reliability Advantages)

| ID | Capability | Value proposition | Complexity | Boundary |
|---|---|---|---|---|
| D-01 | **Immutable close-plan preview** | Shows expected/observed refs, check conclusions, object matches, and exact planned writes before apply, reducing operator guesswork. | MEDIUM | Must remain read-only and must not imply that GitHub has reserved an object. |
| D-02 | **Time-of-check/time-of-use revalidation** | Re-reads `main`, tag, CI, and object identity immediately before each mutation and at final verification, closing a race that a one-shot script leaves open. | MEDIUM | If `main` advances, report partial state; never force the tag to follow it. |
| D-03 | **Machine-readable evidence manifest plus human summary** | Makes future audits reproducible and lets CI/operators compare two close attempts without scraping prose. | LOW–MEDIUM | Store no credentials and do not make the manifest a substitute for live GitHub readback. |
| D-04 | **State-aware recovery assistant** | Turns a failed run into a precise next action such as `rerun-safe`, `repair-draft`, `manual-release-conflict`, or `reconcile-open-milestone`. | LOW–MEDIUM | Advisory only; it must not broaden permissions or auto-delete published history. |
| D-05 | **Historical versus preflight verification modes** | Lets old releases remain auditable after `main` advances while still requiring exact equality during a new close. | MEDIUM | Historical mode must clearly distinguish recorded close-time proof from current-branch state. |

## Anti-Features (Commonly Requested, Deliberately Rejected)

| Anti-feature | Why requested | Why problematic | Required alternative |
|---|---|---|---|
| Recreate or force-move the tag | Makes a failed publication “start over” | Breaks version immutability and can redirect consumers to different code | Preserve the tag; verify or block |
| Use a Release as proof of Milestone closure | Both use the word “release/milestone” and a version title | They are independent GitHub objects with independent lifecycles | Verify and reconcile both separately |
| Use a closed Milestone as proof of a published Release | Planning completion may happen before consumer packaging | Consumers still have no Release page or notes | Publish/read back the Release first |
| Blind `gh release create` without tag verification | Fast and convenient | The CLI can create a tag from the default branch when none exists | Use `--verify-tag` after remote ref verification [G3] |
| Trust Release `target_commitish` as commit proof | The field looks like a SHA/branch pointer | GitHub ignores it as tag-target input when the tag already exists | Dereference the remote annotated tag and compare commit SHA |
| Delete/recreate a Milestone because it is closed or has the wrong text | Feels like a clean reset | Destroys planning history and can detach it from issues/PRs | Adopt matching closure; otherwise conflict/manual repair |
| Select the first open or newest Milestone by title | Avoids a list call | GitHub does not document title uniqueness | Paginate `state=all`; require exactly one exact match |
| Overwrite any existing Release/Milestone to force convergence | Makes convergence simple | Can overwrite user-authored notes or close/reopen the wrong planning object | No-op on match; narrow repair only for draft/open expected object; otherwise conflict |
| Scan “latest workflow runs” without the exact full SHA | Easy CLI invocation | A historical red or newer unrelated commit can be selected accidentally | Filter by full target SHA and inspect job conclusions [G9][G11] |
| Use only the combined commit-status endpoint | It is a familiar status API | It can report pending/empty while GitHub Actions check runs are green | Read the Checks API and workflow jobs |
| Treat `skipped` or `neutral` as green | GitHub branch protection may accept those conclusions | SGRF explicitly requires backend tests and frontend build to execute and pass | Require conclusion exactly `success` for both |
| Automatic release on any branch or commit | Removes operator ceremony | Can publish unreviewed or wrong code | Explicit version, exact refs/SHA, CI proof, and operator apply |
| Retrying a failed/ambiguous POST immediately | Simplifies error handling | Can duplicate side effects or overwrite a race winner | Read back first; adopt, conflict, or retry only when absence is proven |
| Cross-object “atomic” completion claim | Sounds robust | GitHub Release and Milestone use separate endpoints; partial state is unavoidable | Ordered reconciliation plus final readback |
| Fabricated Milestone due date | Makes the object look complete | Invents a commitment not present in project facts | Leave `due_on` null unless explicitly supplied |
| Automatically generated release notes without review | Saves authoring time | Can include noisy or misleading changes and obscure the factual milestone record | Use concise reviewed notes derived from GSD completion evidence |

## Feature Dependencies

```text
[Repository + auth identity]
          └──requires──> [Annotated tag dereference]
                              └──requires──> [main == peeled tag SHA]
                                                   └──requires──> [Exact-SHA CI proof]
[Remote object inventory] ───────────────────────────────┘
          └──requires──> [Explicit dry-run/apply operator action]
                               └──publishes──> [Release reconciliation + readback]
                                                    └──requires──> [Milestone reconciliation + readback]
                                                                         └──requires──> [Final evidence manifest]
```

### Dependency Notes

- **CI proof depends on resolved commit identity:** a green check on a different SHA is unusable.
- **Milestone closure depends on Release readback:** this ordering prevents the workflow from creating new closed Milestone history before its consumer-facing Release exists.
- **Evidence depends on both object IDs:** a successful mutation response alone is not the completion gate.
- **Idempotency depends on inventory before mutation:** create-by-default logic is unsafe after a timeout or partial run.
- **Rollback is subordinate to tag preservation:** object repair cannot justify tag deletion or force movement.

## MVP Definition

### Launch With (v0.1.2 required)

- [ ] Read-only verifier with zero mutations and a per-invariant result table.
- [ ] Repository/auth, annotated-tag, `main`/tag SHA, branch-protection, and exact-SHA CI preflight.
- [ ] Published GitHub Release v0.1.1 from the existing tag, with factual notes and no tag mutation.
- [ ] Closed GitHub Milestone v0.1.1 with a concise completion record and no open issues.
- [ ] Deterministic apply mode that publishes/verifies Release before Milestone.
- [ ] Idempotent adoption of existing objects and safe recovery after partial/ambiguous success.
- [ ] Stable conflict/failure messages and a final secret-free evidence manifest.
- [ ] Tests for every completion scenario in this document, especially CI-not-green, ref mismatch, partial rerun, conflict, and read-only verification.

### Add After Validation (differentiators)

- [ ] Time-of-check/time-of-use revalidation before each mutation.
- [ ] Historical audit mode that does not invalidate old Releases after `main` advances.
- [ ] Machine-readable evidence manifest consumed by future release-close automation.
- [ ] State-aware recovery output with one recommended next action.

### Future Consideration (not required for v0.1.2)

- [ ] Immutable Releases and release attestations after the recovery workflow is stable; evaluate before enabling immutability for a version that may still need repair.
- [ ] Release-asset verification when the project begins publishing binaries/images; v0.1.1 needs no uploaded asset.
- [ ] Automated draft-and-review pipeline only if a real need appears; keep the current boundary operator-invoked.

## Feature Prioritization Matrix

| Feature | Operator value | Implementation cost | Priority |
|---|---:|---:|---:|
| Read-only verification | HIGH | MEDIUM | P1 |
| Exact tag/main/CI preflight | HIGH | MEDIUM | P1 |
| Release publish/readback | HIGH | MEDIUM | P1 |
| Milestone close/readback | HIGH | MEDIUM | P1 |
| Ordered explicit apply path | HIGH | MEDIUM | P1 |
| Idempotent partial-state recovery | HIGH | MEDIUM | P1 |
| Conflict-safe, non-destructive failure policy | HIGH | MEDIUM | P1 |
| Final evidence manifest | HIGH | LOW–MEDIUM | P1 |
| TOCTOU revalidation | HIGH | MEDIUM | P2 |
| Historical audit mode | MEDIUM | MEDIUM | P2 |
| Immutable Releases/attestations | MEDIUM | MEDIUM | P3, separate decision |
| Release-asset verification | LOW now | MEDIUM | P3 |

**Priority key:** P1 = required for reliable v0.1.1 recovery and future close; P2 = valuable once the P1 workflow is correct; P3 = explicit future scope.

## Platform Object / Behavior Comparison

There is no external competitor product to benchmark. The relevant reference behavior is GitHub's own object model.

| Concern | GitHub Release | GitHub Milestone | SGRF recommendation |
|---|---|---|---|
| Primary audience | Users consuming a version | Maintainers tracking issues/PR work | Verify both audiences explicitly |
| Created from | A Git tag; may auto-create one if absent | Repository title/description/due date | Existing tag required; no auto tag creation |
| Identity | Release ID + `tag_name` | Milestone number; title not documented unique | Use stable ID/number after inventory |
| Mutable state | Draft/published, notes, prerelease/latest, assets | Open/closed, title, description, due date | Repair only expected draft/open objects; conflict on published/closed divergence |
| Completion signal | `draft=false` and `published_at` | `state=closed` and `closed_at` | Require both, plus independent tag/CI evidence |
| Rollback risk | Deleting a Release can also tempt tag cleanup | Deleting a Milestone loses planning record | Never roll back the tag; prefer forward reconciliation |
| Does it prove the other exists? | No | No | Neither substitutes for the other |

## Observed v0.1.1 Recovery Baseline

Read-only evidence collected on 2026-09-25 from `ldsampaio/sgrf`:

- Remote `main`: `10c62ac85fd3ab275b8926c89f5f34ba4116e2cf`.
- Annotated tag ref: `refs/tags/v0.1.1` → tag object `0a68d6f0c55e7be07d13a0bbc4ed36d4af772630` → commit `10c62ac85fd3ab275b8926c89f5f34ba4116e2cf`.
- GitHub Release lookup for `v0.1.1`: 404/absent.
- Exact-title Milestone `v0.1.1` across `state=all`: absent.
- Main-push CI run `36095855139`: completed/success on the full target SHA.
- Tag-push CI run `36095872529`: completed/success on the same full target SHA.
- Required check policy: `backend` and `frontend`, app-bound to GitHub Actions, `strict:false`; admin enforcement is enabled in `AGENTS.md`.
- The legacy combined commit-status endpoint reports `pending` with zero legacy statuses even though all four target-SHA check runs are successful. This is direct evidence that the workflow must inspect check-runs/workflow jobs, not combined statuses.

Therefore the normal v0.1.1 recovery is: preserve the tag, create/read back the published Release, create/read back the closed Milestone, then emit evidence. No CI rerun or tag mutation is needed for the observed state.

## Sources

### First-Party GitHub Documentation

- **[G1] About releases** — Releases package deployable software around Git tags and are separate from repository planning objects. https://docs.github.com/en/repositories/releasing-projects-on-github/about-releases
- **[G2] REST: Releases** — create/get/update/delete semantics, fields, published/draft behavior, and the rule that `target_commitish` is unused when the tag exists. https://docs.github.com/en/rest/releases/releases
- **[G3] GitHub CLI: `gh release create` and `gh release`** — tag auto-creation behavior, `--verify-tag`, release readback fields, and immutable-release constraints. https://cli.github.com/manual/gh_release_create and https://cli.github.com/manual/gh_release_view
- **[G4] About milestones** — Milestones track groups of issues or pull requests. https://docs.github.com/en/issues/using-labels-and-milestones-to-track-work/about-milestones
- **[G5] REST: Milestones** — list/create/get/update/delete, `state`, `closed_at`, counts, due date, and pagination. https://docs.github.com/en/rest/issues/milestones
- **[G6] REST: Git references** — remote ref identity and object type/SHA. https://docs.github.com/en/rest/git/refs
- **[G7] REST: Git tags** — annotated tag objects and dereferencing a tag object to its commit. https://docs.github.com/en/rest/git/tags
- **[G8] Troubleshooting required status checks** — latest target SHA requirement, app identity, and skipped/neutral semantics. https://docs.github.com/en/enterprise-cloud@latest/pull-requests/collaborating-with-pull-requests/collaborating-on-repositories-with-code-quality-features/troubleshooting-required-status-checks
- **[G9] REST: Check runs** — list check runs for a commit/ref and job conclusions. https://docs.github.com/en/rest/checks/runs
- **[G10] REST: Workflow runs** — list by full `head_sha`, event, status, conclusion, and attempt. https://docs.github.com/en/rest/actions/workflow-runs
- **[G11] GitHub CLI: `gh run list` / `gh run view`** — exact-SHA filtering and machine-readable run/job evidence. https://cli.github.com/manual/gh_run_list and https://cli.github.com/manual/gh_run_view
- **[G12] REST: Protected branches** — required contexts/checks, `strict`, and admin enforcement. https://docs.github.com/en/rest/branches/branch-protection
- **[G13] Managing and immutable releases** — published release edit/delete behavior and tag/asset immutability. https://docs.github.com/en/repositories/releasing-projects-on-github/managing-releases-in-a-repository and https://docs.github.com/en/code-security/concepts/supply-chain-security/immutable-releases
- **[G14] REST API best practices and `gh api`** — authenticated GET/list/pagination mechanics and response handling. https://docs.github.com/en/rest/using-the-rest-api/getting-started-with-the-rest-api and https://cli.github.com/manual/gh_api

### Project and Read-Only Repository Evidence

- `.planning/PROJECT.md` — v0.1.2 goal, active requirements, release-safety constraints, remote-truth rule, and explicit tag-preservation decision.
- `.planning/MILESTONES.md` — v0.1.1 completion record and historical CI incident.
- `AGENTS.md` — two required CI jobs, branch-protection shape, and operator constraints.
- `.github/workflows/ci.yml` — required job names and exact backend/frontend commands.
- Live read-only GitHub API/CLI readback for `ldsampaio/sgrf` on 2026-09-25 — tag, `main`, required checks, workflow runs, absent Release, absent Milestone, and combined-status/check-run contrast.

---

*Feature research for: SGRF v0.1.2 GitHub Release Reliability*
*Researched: 2026-09-25*
