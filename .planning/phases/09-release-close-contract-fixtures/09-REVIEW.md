---
phase: "09-release-close-contract-fixtures"
reviewed: 2026-09-25T14:56:46Z
depth: standard
files_reviewed: 12
files_reviewed_list:
  - tools/release-close/package.json
  - tools/release-close/client.js
  - tools/release-close/fake-client.js
  - tools/release-close/eligibility.js
  - tools/release-close/release-close.js
  - tools/release-close/classify.js
  - tools/release-close/gh-client.js
  - tools/release-close/apply-gate.js
  - tools/release-close/eligibility.test.js
  - tools/release-close/classify.test.js
  - tools/release-close/nowrite.test.js
  - tools/release-close/safe04.test.js
findings:
  critical: 4
  warning: 8
  info: 0
  total: 12
status: issues_found
---

# Phase 09: Code Review Report

**Reviewed:** 2026-09-25T14:56:46Z  
**Depth:** standard  
**Files Reviewed:** 12  
**Status:** issues_found

## Narrative Findings (AI reviewer)

The scoped suite passes (`node --test tools/release-close/`: 57/57), but passing tests do not establish the advertised fail-closed contract. The review reproduced a confirmation with redirected plan output, an indefinitely pending TTY prompt on EOF, a non-commit peel being accepted as eligible, and malformed/cancelled CI evidence being classified as apply-ready.

### Critical

#### CR-01: Redirected output bypasses the human-visible-plan lock

**Classification:** BLOCKER  
**Files:** `tools/release-close/release-close.js:373-379`; `tools/release-close/apply-gate.js:48-77`; `tools/release-close/safe04.test.js:383-395`  
**Issue:** The gate checks only `process.stdin.isTTY` and writes the plan to `process.stdout`. If stdin is a TTY but stdout is redirected to a file or pipe, the operator can answer `sim` without ever seeing the plan or prompt on their terminal. The gate still returns `confirmed: true` and claims confirmation occurred “após o plano.” I reproduced this locally with a pseudo-TTY, `apply --yes`, stdout redirected, and scripted `sim`; the confirmation branch was reached. The existing CLI tests only cover non-TTY stdin, so they miss this bypass. Before Phase 11 adds writes, this turns the plan-review lock into an ordering assertion rather than a human-visibility guarantee.

**Fix:** Require a live output TTY in addition to the input TTY, or render the plan and prompt through the controlling terminal rather than redirectable stdout. Add a regression case with `stdin.isTTY=true`, `stdout.isTTY=false` that must refuse before `ask()`.

```js
const gate = await confirmApply({
  yesFlag: yes,
  isTTY: io.stdin.isTTY === true,
  outputIsTTY: io.stdout.isTTY === true,
  // ...
});

// In confirmApply, reject before write/ask when outputIsTTY !== true.
```

#### CR-02: Missing or non-green CI evidence is classified as apply-ready

**Classification:** BLOCKER  
**Files:** `tools/release-close/classify.js:41-49`; `tools/release-close/classify.js:68-78`; `tools/release-close/release-close.js:158-170`; `tools/release-close/release-close.js:209-224`  
**Issue:** `checksFailed` treats only the exact string `failure` as red. Missing `checks`, malformed run records, `cancelled`, `timed_out`, `action_required`, pending, and unknown outcomes all return `false`. The classifier then commonly returns `MISSING`, which is not in `BLOCKING_CODES`; with an eligible tag, `buildClosePlan` consequently sets `applyLiberado: true`. This was reproduced with missing checks, a cancelled run, and an empty run record. The production adapter makes the issue worse by hard-coding `checks.state` to `success` at line 167. A corrupt or non-green check result can therefore cross the mutation fence as a valid missing state.

**Fix:** Validate the complete evidence schema and use an allowlist: only explicit, required `backend`/`frontend` successes at the expected SHA qualify. Treat missing, malformed, pending, cancelled, timed-out, action-required, contradictory, or unknown evidence as `FAILED`/blocked. Do not synthesize `state: 'success'` from bare run IDs. Add negative tests for each non-green outcome and an integration assertion that such evidence forces `applyLiberado === false`.

#### CR-03: SAFE-02 accepts an unproven non-commit peel

**Classification:** BLOCKER  
**Files:** `tools/release-close/eligibility.js:47-68`; `tools/release-close/eligibility.js:70-88`  
**Issue:** The first hop requires `refObject.type === 'tag'`, but the second hop reads only `tagObject.data.object.sha`; it never requires `object.type === 'commit'`. It also does not verify that the returned tag object's `data.sha` is the tag SHA from the ref, that the ref name is the requested `refs/tags/<version>`, or that the tag SHA itself is a full 40-hex SHA. I reproduced `object.type: 'tree'` with the expected SHA being accepted as `ELIGIBLE`. Thus the function does not actually prove “annotated tag peeled to the commit” as required by SAFE-02; it proves only that an untyped SHA string equals two other strings.

**Fix:** Validate the full ref identity and both object links before comparing commits:

```js
if (ref.data.ref !== `refs/tags/${version}` || !FULL_SHA.test(refObject.sha)) {
  return ineligible('MISSING', 'Referência da tag inválida.');
}
if (tagObject.data.sha !== refObject.sha || tagObject.data.object?.type !== 'commit') {
  return ineligible('MISSING', 'Objeto da tag não faz peel para um commit válido.');
}
```

Add tests for a tree/blob/tag peel, mismatched tag-object identity, abbreviated tag SHA, and a ref for another tag.

#### CR-04: The zero-mutation proof is inert and the emitted counter is hard-coded

**Classification:** BLOCKER  
**Files:** `tools/release-close/client.js:30-39`; `tools/release-close/fake-client.js:75-124`; `tools/release-close/release-close.js:221-226`; `tools/release-close/release-close.js:250-269`; `tools/release-close/nowrite.test.js:86-113`  
**Issue:** `writes` is initialized to an array that no code can ever push to, and `mutations` is only its length. `assertClientShape` permits extra methods, so it does not enforce a read-only capability surface. The CLI does not retain the fake or pass its counter into the plan; it emits literal `0` in every renderer. Consequently, a write introduced anywhere outside this inert array would still produce `mutations: 0` and the existing assertions would remain green. The static token scan is not an executable capability proof and misses natural argv-array forms such as `execFile('gh', ['release', 'create'])` because the source does not contain the contiguous text `release create`. This is the central SAFE-04 claim, but it is currently a convention and a tautology.

**Fix:** Put enforcement at the actual side-effect boundary. Reject unexpected callable members in the read-client contract, propagate the real counter into all outputs, and add a canary test that deliberately attempts a forbidden write and proves the harness fails. Until Phase 11, also reject any production import of subprocess/network capabilities rather than relying on a small denylist. Never render a literal mutation count.

```js
const plan = buildClosePlan({ ..., mutations: client.mutations });
// Render plan.mutations; assert the real client counter, not a hard-coded value.
```

### Warnings

#### WR-01: Permission and transport failures are mislabeled as missing remote objects

**Classification:** WARNING  
**Files:** `tools/release-close/eligibility.js:42-75`  
**Issue:** All unsuccessful envelopes are collapsed into `MISSING`; the implementation ignores `status`. A reproduced `500` response is reported as “Tag ausente,” while `403` would likewise be presented as absence and `429`/5xx as a missing tag object or head. Timeout/lost-response exceptions instead escape without a normalized decision. This hides permission and availability failures and will defeat the Phase 10 requirement to distinguish absent objects from permission failures.

**Fix:** Branch on exact statuses: only `404` maps to absence; `401/403` maps to a permission code; `409/422/429/5xx` and transport errors map to a distinct unavailable/indeterminate result or a typed error that callers handle explicitly. Add one test per status family.

#### WR-02: The CLI bypasses the five-read seam and discards duplicate/target identity evidence

**Classification:** WARNING  
**Files:** `tools/release-close/release-close.js:158-170`; `tools/release-close/release-close.js:181-197`; `tools/release-close/release-close.js:272-283`; `tools/release-close/classify.test.js:60-71`  
**Issue:** `decide` invokes only the three eligibility reads through the client. Release and milestone evidence is read directly from the raw snapshot; `evidenceFromSnapshot` always sets `releases: []` and selects only `milestones[0]`. No production path calls `getReleaseByTag` or `listMilestones`, despite the test manually invoking those methods to claim full read ordering. Consequently, multiple conflicting milestones and duplicate releases cannot reach the classifier, and an unrelated first milestone can be marked as “present/adopted.” The advertised fake-to-real client swap will not work without rewriting this orchestration.

**Fix:** Execute all five read methods through the injected client, preserve the full normalized arrays, and derive evidence from those responses. Filter by exact target tag/title before presence classification, while retaining all matching objects for duplicate/conflict detection. Test the production adapter, not a manually assembled call log.

#### WR-03: SAFE-04 fixture tests collapse the states they claim to cover

**Classification:** WARNING  
**Files:** `tools/release-close/safe04.test.js:108-127`; `tools/release-close/safe04.test.js:175-186`  
**Issue:** `clientSnapshotFor` converts `releases` to only its first element, so duplicate and conflicting fixtures become ordinary partial snapshots. The all-fixtures test then checks only that `classificacao.code` is a string, not that it equals `DUPLICATE`/`CONFLICTING` or any expected state. The test can therefore pass while exercising the wrong state. This undermines test reliability for the central OPS-02/SAFE-04 fixture claim.

**Fix:** Add an expected-code table and assert the exact result for every fixture. Preserve all release objects through the client-shaped evidence and add a milestone-list representation capable of exposing multiple matching milestones.

#### WR-04: Importing the CLI terminates the host process

**Classification:** WARNING  
**Files:** `tools/release-close/release-close.js:181-230`; `tools/release-close/release-close.js:394-419`  
**Issue:** `buildClosePlan` and `renderPlanText` are exported, but importing the module immediately runs `main` and calls `process.exit`. I verified that `await import('./tools/release-close/release-close.js')` prints help and exits with status 0 before the importing statement can continue. The exported plan helpers are consequently untestable and unusable by downstream modules.

**Fix:** Guard the CLI entrypoint with an `import.meta.url === pathToFileURL(process.argv[1]).href` check, export `main` for tests, and set `process.exitCode` rather than terminating importers. Inject stdout/stderr into `main` and renderer functions.

#### WR-05: Closing the TTY before answering leaves apply pending forever

**Classification:** WARNING  
**Files:** `tools/release-close/release-close.js:327-337`  
**Issue:** `makeAsk` resolves only from the `rl.question` line callback. It has no `close` or `error` handler. Under a real pseudo-TTY, EOF/Ctrl-D after the prompt leaves the promise unresolved; I reproduced a process that remained alive until an external five-second timeout. A real operator can therefore hang the tool indefinitely instead of receiving a clean refusal.

**Fix:** Resolve once on either an answer or `close`, and reject/return a refusal on stream error. Add a pty or injected readline EOF regression test.

```js
let settled = false;
const finish = (value) => {
  if (settled) return;
  settled = true;
  rl.close();
  resolve(value);
};
rl.question('Confirmar o apply? (sim/nao) ', finish);
rl.once('close', () => finish(''));
```

#### WR-06: A fully completed Release/Milestone state is reported as PARTIAL

**Classification:** WARNING  
**Files:** `tools/release-close/classify.js:103-119`; `tools/release-close/release-close.js:209-224`  
**Issue:** Any record-valued release or milestone is PARTIAL; the classifier never checks publication state, milestone state/title, or open issues. A published matching release plus a closed matching milestone was reproduced as `PARTIAL`, and PARTIAL is intentionally non-blocking, so an already complete target remains eligible for the recovery flow. That is unsafe for an idempotent reconciliation tool and contradicts the reason text (“sem fechamento completo”).

**Fix:** Represent the completed/no-op state explicitly (or add a validated `complete`/`adoptNoop` result outside the six-state code) and test published-release + closed-matching-milestone separately from draft/open partial states.

#### WR-07: Duplicate/conflict classification is not scoped to one target version

**Classification:** WARNING  
**Files:** `tools/release-close/classify.js:59-66`; `tools/release-close/classify.js:88-100`  
**Issue:** Every record in `releases` participates in the comparison. Two unrelated releases from different tags are reported as `CONFLICTING` with the reason “da mesma tag,” even though the reason output visibly lists different tag names. The function has no target version input with which to filter evidence. A valid target can therefore be blocked by unrelated repository history.

**Fix:** Pass the target version/tag into classification, filter or partition by that natural key, and only compare matching target objects. Validate that duplicate candidates share the same tag and have the expected target SHA; add unrelated-version fixtures.

#### WR-08: The reusable apply gate has no reviewed-content lock

**Classification:** WARNING  
**Files:** `tools/release-close/release-close.js:181-251`; `tools/release-close/release-close.js:373-379`; `tools/release-close/apply-gate.js:33-84`  
**Issue:** The plan contains operation IDs, SHAs, and run IDs but no Release notes, Milestone completion record, or digest of either. `confirmApply` receives only `planText` and the operational locks, so it can return `confirmed: true` without any reviewed content ever having been supplied or bound to the future write. Phase 9 currently fails closed after confirmation, but this gate is explicitly positioned for later live reconciliation; extending it as-is would weaken the roadmap requirement that apply require reviewed Release/Milestone content.

**Fix:** Before Phase 11, add an immutable reviewed-content object (or canonical digest), render the relevant content before the prompt, require it as an explicit lock, and bind the later executor to the same digest so content cannot change after approval.

## Summary

The implementation is readable and the current 57 tests are deterministic, but four core safety claims are not enforced: the plan need not be visible on a human TTY, non-green CI evidence can unlock apply, the peel contract does not require a commit, and the mutation counter cannot observe a write. The remaining findings would cause incorrect classifications, lost milestone/release identity, an importable module that exits its host, and an indefinitely hanging TTY flow. These defects should be fixed before this contract is used as the foundation for remote reconciliation.

---

_Reviewed: 2026-09-25T14:56:46Z_  
_Reviewer: the agent (gsd-code-reviewer)_  
_Depth: standard_
