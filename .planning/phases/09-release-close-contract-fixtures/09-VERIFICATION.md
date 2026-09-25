---
phase: 09-release-close-contract-fixtures
verified: 2026-09-25T19:04:32Z
status: gaps_found
score: 19/22 must-haves verified
covered_digest: "v1:sha256:906919729e15e7a170514e6bc840ffe9715e8ca9473602ad47437dfb033a4939"
covered_files:
  - .github/workflows/ci.yml
  - .planning/REQUIREMENTS.md
  - .planning/ROADMAP.md
  - .planning/WINDOWS.md
  - .planning/phases/09-release-close-contract-fixtures/09-01-PLAN.md
  - .planning/phases/09-release-close-contract-fixtures/09-01-SUMMARY.md
  - .planning/phases/09-release-close-contract-fixtures/09-02-PLAN.md
  - .planning/phases/09-release-close-contract-fixtures/09-02-SUMMARY.md
  - .planning/phases/09-release-close-contract-fixtures/09-03-PLAN.md
  - .planning/phases/09-release-close-contract-fixtures/09-03-SUMMARY.md
  - .planning/phases/09-release-close-contract-fixtures/09-04-PLAN.md
  - .planning/phases/09-release-close-contract-fixtures/09-04-SUMMARY.md
  - .planning/phases/09-release-close-contract-fixtures/09-05-PLAN.md
  - .planning/phases/09-release-close-contract-fixtures/09-05-SUMMARY.md
  - .planning/phases/09-release-close-contract-fixtures/09-06-PLAN.md
  - .planning/phases/09-release-close-contract-fixtures/09-06-SUMMARY.md
  - .planning/phases/09-release-close-contract-fixtures/09-07-PLAN.md
  - .planning/phases/09-release-close-contract-fixtures/09-07-SUMMARY.md
  - .planning/phases/09-release-close-contract-fixtures/09-08-PLAN.md
  - .planning/phases/09-release-close-contract-fixtures/09-08-SUMMARY.md
  - .planning/phases/09-release-close-contract-fixtures/09-09-PLAN.md
  - .planning/phases/09-release-close-contract-fixtures/09-09-SUMMARY.md
  - .planning/phases/09-release-close-contract-fixtures/09-CONTEXT.md
  - .planning/phases/09-release-close-contract-fixtures/09-DISCUSSION-LOG.md
  - .planning/phases/09-release-close-contract-fixtures/09-PATTERNS.md
  - .planning/phases/09-release-close-contract-fixtures/09-RESEARCH.md
  - .planning/phases/09-release-close-contract-fixtures/09-REVIEW.md
  - .planning/phases/09-release-close-contract-fixtures/09-SECURITY.md
  - .planning/phases/09-release-close-contract-fixtures/09-UI-REVIEW.md
  - .planning/phases/09-release-close-contract-fixtures/09-VALIDATION.md
  - .planning/phases/09-release-close-contract-fixtures/COVERAGE.md
  - tools/release-close/apply-gate.js
  - tools/release-close/canary.test.js
  - tools/release-close/classify.js
  - tools/release-close/classify.test.js
  - tools/release-close/client.js
  - tools/release-close/eligibility.js
  - tools/release-close/eligibility.test.js
  - tools/release-close/evidence.test.js
  - tools/release-close/failure.test.js
  - tools/release-close/fake-client.js
  - tools/release-close/fixtures/complete.json
  - tools/release-close/fixtures/concurrent.json
  - tools/release-close/fixtures/conflicting.json
  - tools/release-close/fixtures/duplicate.json
  - tools/release-close/fixtures/failed.json
  - tools/release-close/fixtures/missing.json
  - tools/release-close/fixtures/partial.json
  - tools/release-close/fixtures/reference.json
  - tools/release-close/fixtures/reviewed.json
  - tools/release-close/fixtures/unrelated.json
  - tools/release-close/gh-client.js
  - tools/release-close/nowrite.test.js
  - tools/release-close/package.json
  - tools/release-close/reconcile.js
  - tools/release-close/release-close.js
  - tools/release-close/safe04.test.js
behavior_unverified: 0
overrides_applied: 0
re_verification:
  previous_status: gaps_found
  previous_score: 6/13
  gaps_closed:
    - "Strict annotated-tag peel (was gap 1) — four identity proofs close before any equality; 17/17 adversarial cases refused with distinct EN codes."
    - "Exact-target green CI evidence (was gap 2) — eleven named failure families replaced the failure-only check; absent or malformed ci is a TypeError, never a default green."
    - "Target-scoped reconciliation and full evidence (was gap 3) — all five reads run in fixed order through the production seam; unrelated records are partitioned and can no longer cause DUPLICATE or CONFLICTING."
    - "Measured mutation counter and exact client surface (was gap 4) — closure-backed counter, exact surface refuses extra callables by name, and the forbidden-write canary is a real child-process escape."
    - "Human-visible apply and reviewed content (was gap 5) — the original pty-stdin-redirected-stdout attack now refuses in PT-BR with a byte-empty redirected file; eight locks, zero writes before the content lock."
  gaps_remaining:
    - "Scripted failure scenarios (was gap 6) — partially closed: the reconciliation seam is real and correct for all six families across all five reads, but two of the five reads crash the decision layer before the seam exists. Tracked as gap G-2 below."
  regressions: []
gaps:
  - truth: "A red signal the classifier's own contract validates must block the plan; today the production evidence builder drops it without error, warning or field, and the plan reports applyLiberado true."
    status: failed
    reason: "failedRunIds is validated by assertContract and given precedence above CONCURRENT, but buildCloseEvidence has no such key and no parameter for it. A snapshot whose only red signal is failedRunIds classifies MISSING with applyLiberado true and bloqueio null, and three suites pin that value as the expected outcome of the frozen failed.json scenario. This is a fail-open in the field the phase's goal names, and it is load-bearing as a pinned expectation: removing the drop would turn three suites red."
    artifacts:
      - path: tools/release-close/release-close.js
        issue: "buildCloseEvidence (lines 210-224) emits exactly five keys, hard-codes closeMarkers to [] and has no failedRunIds key or parameter."
      - path: tools/release-close/classify.js
        issue: "assertContract validates failedRunIds when present (lines 158-160) and execucoesVermelhos gives it precedence above CONCURRENT (lines 419-426), so the contract advertises a trigger the only producer cannot carry."
      - path: tools/release-close/evidence.test.js
        issue: "Line 811 pins { nome: 'failed', classificacao: 'MISSING' } and line 878-886 asserts MISSING as the reachable value; the test is explicit that this is a declared boundary, which makes the fail-open an expectation, not an oversight."
      - path: tools/release-close/safe04.test.js
        issue: "Lines 96-104 pin the same value and derive applyLiberado true at line 851."
      - path: tools/release-close/fixtures/failed.json
        issue: "Line 9 declares failedRunIds [36095855139] — a red run — over an otherwise green ci block, so the fixture named 'failed' does not produce FAILED through the production seam."
    missing:
      - "Make the evidence constructor carry the red trigger or refuse the input; an absent source must be declared, never silently omitted."
      - "Either thread failedRunIds from camadaDeDecisao so a Phase 10 client can supply it, or delete the key from the classifier's contract, its precedence table and fixtures/failed.json so the taxonomy stops advertising a trigger it cannot carry."
      - "Update the three suites that pin MISSING for the failed and concurrent scenarios so the expected value follows the fix instead of resisting it."
  - truth: "Every declared read failure is reported as a PT-BR refusal in the phase's own family vocabulary; two of the five reads instead crash the process with an English stack trace."
    status: failed
    reason: "camadaDeDecisao awaits getReleaseByTag and listMilestones with no guard, while checkTagEligibility guards the other three and reconcile.js guards all five inside its seam. The rejection escapes decide before the seam exists, tratarRecusa re-throws any non-TypeError, the verb runner's promise rejects, and the top-level process.exitCode assignment never runs. Measured end to end: all three verbs print an English stack trace and exit 1, with no PT-BR refusal and no --json. It still fails closed with respect to remote state (nothing is written, exit is non-zero), but it is a crash where the phase's own vocabulary promises an operator-readable refusal — and it is the exact path Phase 10 exercises with a real gh client."
    artifacts:
      - path: tools/release-close/release-close.js
        issue: "Lines 320-321 await the two evidence reads unguarded; lines 612-622 re-throw every non-TypeError; line 859 assigns process.exitCode from an await that never resolves."
      - path: tools/release-close/reconcile.js
        issue: "Lines 190-226 already implement the correct answer — tentar captures the throw and returns the TRANSPORT family — but the seam runs after the layer returns, so it never sees this failure."
      - path: tools/release-close/failure.test.js
        issue: "Lines 427-429 document the defect in a test comment and route around it by taking the base decision from a clean client, so no test reaches the crash."
    missing:
      - "Guard the two reads in camadaDeDecisao and turn the failure into data with the same typed family the eligibility predicate and the seam already use, so the plan blocks on it by rule."
      - "Add a catch-all family in tratarRecusa so an internal fault is reported as an internal fault with distinct text and exit code, instead of being re-thrown into a crash; the same re-throw currently mislabels an internal TypeError as 'Entrada inválida'."
      - "Add the regression test that does not exist today: script { getReleaseByTag: ['timeout'] } and { listMilestones: ['lost-response'] } on the decide seam and assert (i) no rejection escapes, (ii) plan.applyLiberado === false, (iii) the reason names the read and says the remote state is unknown, not absent."
  - truth: "The operator's approval is bound to evidence the classifier already declared valid for this target; today the reviewed content is selected by a weaker rule than the one the classifier enforces."
    status: failed
    reason: "montarConteudoRevisado re-partitions the raw evidence with two find calls and never consults classificacao, which already carries the partitioned records, unrelatedReleases and targetShaValidates. A milestone that is still open, or a release whose targetSha diverges from expectedSha, therefore supplies the text the operator approves while the plan reports applyLiberado true. Measured: a snapshot with a diverging-SHA release produces reviewed notes from that release and a real digest; a snapshot whose first target milestone is open with a completionRecord produces a digest bound to that open milestone's record. The digest machinery itself is sound — it is the selection rule that is weaker than the decision it is supposed to bind."
    artifacts:
      - path: tools/release-close/release-close.js
        issue: "Lines 443-454 select with evidencia.releases.find(tagName === version) and evidencia.milestones.find(title === version); line 471-474 falls back to expectedSha for commitSha when no tagObject envelope exists, so the digest can cover a value no read proved."
      - path: tools/release-close/classify.js
        issue: "Lines 326-342 retention helpers drop notes and completionRecord, which is why the plan builder was pushed into re-partitioning; the same decision object already exposes releases, milestones, unrelatedReleases and targetShaValidates."
    missing:
      - "Build the reviewed object from the classified evidence, not from a second partition: require exactly one target release and one target milestone, and require targetShaValidates, refusing to build content from anything ambiguous."
      - "Carry notes and completionRecord through the classifier's retention helpers so the plan builder does not need its own weaker selection rule."
      - "Add the negative cases: two target milestones, a target milestone still open, and a single target release whose targetSha diverges from expectedSha — each must yield no reviewed object and therefore refuse on the content lock."
advisory:
  - finding: "No production module calls the side-effect trap, so in Phase 9 the measured counter is structurally zero because no write path exists at all — not because a measurement happened to come back clean."
    category: architectural
    reason: "The boundary, the invariant and the escape-proving canary are all real, so this is a coverage observation rather than a defect; it becomes meaningful only when Phase 10/11 adds a first write. What would resolve it is either a production import guard for subprocess/network capabilities (the 09-06 fix text asked for one and none exists) or a Phase 11 note that the first write must be counted through this same trap."
    evidence_status: "none provided"
  - finding: "CONCURRENT remains in the production BLOCKING_CODES list while being unreachable in Phase 9, so a Phase 11 reader can mistake a blocking code for a detected condition."
    category: other
    reason: "Documented boundary in COVERAGE.md lines 51-98 and proven executably by failure.test.js, not a fail-open: no snapshot can carry a close marker today. What would resolve it is removing CONCURRENT from the list until a marker source exists, or a Phase 11 note on the same code."
    evidence_status: "none provided"
  - finding: "assertClientShape accepts a prototype method and an array-shaped member, because Object.keys sees only own enumerable properties."
    category: other
    reason: "The fake is frozen and a push to writes is a TypeError, and an array of strings is data that only becomes dangerous through a callable, which the check does refuse; the original argv-array concern from the prior gap is therefore addressed. What would resolve it is an Object.getOwnPropertyNames plus prototype scan if a hand-built client ever reaches this check in production."
    evidence_status: "none provided"
  - finding: "WINDOWS.md ledger entry 6 renders as the garbled literal TESTE-PLAO in the markdown table while the canonical JSON block below it carries the full 23-mutation description."
    category: other
    reason: "A data defect in the register itself, not in the phase; the JSON is the machine-readable source and is intact. workflow.windows_enforce is false, so none of the six open deviations blocks ship. What would resolve it is rewriting the table cell from the JSON."
    evidence_status: "none provided"
human_verification: []
---

# Phase 9: Release-Close Contract & Fixtures Verification Report

**Phase Goal:** Operators and the implementer share one deterministic, fail-closed release-close contract before any remote client or mutation can exist.
**Verified:** 2026-09-25T19:04:32Z
**Status:** `gaps_found`
**Verification mode:** Re-verification after the second gap-closure round (plans 09-04 … 09-09 executed). Prior `09-VERIFICATION.md` was `gaps_found` at 6/13 with 6 gaps.
**Verifier stance:** Every SUMMARY, COVERAGE.md claim and the code review's three open items were treated as leads. Each finding below was re-derived by reading the current source and exercised with an independent probe or a real CLI invocation. No GitHub or network mutation was performed.

## Headline

**All six original gaps are genuinely closed.** Not one of them was closed cosmetically: I re-probed every guard with adversarial input and every one of them bit. The strict peel now refuses 17 of 17 adversarial cases with distinct codes, the CI allowlist refuses 14 of 14 non-green shapes, the reviewed-content digest is bound to a canonical serialization that changes with a single character, and the original "live TTY + redirected stdout + `sim`" attack — which the prior pass reproduced as an accepted confirmation — now refuses in PT-BR and leaves the redirected file byte-empty.

**The phase goal is nevertheless not achieved**, for reasons that are not the original six. The goal is a *fail-closed contract*, and the fail-closed property has two holes the second round knew about and left open, plus one selection rule weaker than the decision it binds. The decisive fact is that the largest of the three is no longer an oversight: three suites now pin `applyLiberado: true` as the expected result of the snapshot whose only red signal is a declared failed run. That is a fail-open certified as correct by the suite that would otherwise catch it.

## Per-gap verdict — the original six

| # | Original gap | Verdict | Independent evidence |
|---|--------------|---------|----------------------|
| 1 | Strict annotated-tag peel | **CLOSED** | `eligibility.js:173-240` runs four identity proofs (exact ref, full 40-hex tag SHA, cross-hop identity match, second hop typed `commit`) before any equality. My 17-case probe: control eligible; foreign ref / abbreviated tag SHA / lightweight / tree peel / blob peel / tag peel / identity mismatch / abbreviated peeled SHA all `TAG-IDENTITY` or `LIGHTWEIGHT`; peeled≠main and main≠expected both `SAFE-02`; 403 `PERMISSION`, 429 and 503 `UNAVAILABLE`, 404 `MISSING`, non-record envelope `MALFORMED`, throwing read `TRANSPORT`. `writeAction` null in all 18. |
| 2 | Exact-target green CI evidence | **CLOSED** (with residue → G-1) | `classify.js` replaced failure-only detection with a positive allowlist and 11 named families. My 15-case probe: cancelled, timed_out, failure, action_required, neutral, skipped, contradictory, queued, unknown job, wrong record SHA, wrong `ci.targetSha`, wrong run identity, extra run, missing frontend job — every one `FAILED` with a distinct `ciCode`; a genuine same-slot contradiction returns `CI-CONTRADICTORY`; `event != push` and an absent `ci` block both throw `TypeError`, which `tratarRecusa` renders as a PT-BR `Entrada inválida`. No green is synthesized from bare run IDs. |
| 3 | Target-scoped reconciliation, all five reads, preserved evidence | **CLOSED** | `camadaDeDecisao` awaits all five reads in the fixed order and hands the raw envelopes to the exported `buildCloseEvidence`, which retains whole arrays. My 9-case probe: two same-target releases `DUPLICATE`, two same-target releases with distinct SHAs `CONFLICTING`, two same-target milestones and a diverging-SHA release `PARTIAL` with the divergence named, and — the original defect — releases/milestones of another version are partitioned into `unrelatedReleases`/`unrelatedMilestones` and can no longer produce a conflict or a duplicate for the requested target. All stable identifiers survive. `evidence.test.js` drives the eight frozen fixtures through the production seam with an exact 8-row table. |
| 4 | Measured mutation counter, exact surface, forbidden-write canary | **CLOSED** | `client.js:52-66` refuses any own callable outside the five reads — my probe confirms refusal of `createRelease`, of a non-obvious name `xRule`, and of a spread copy, while non-callable accounting members stay allowed. `fake-client.js` keeps the tally and the effect log in a closure: `f.writes.push(...)` is a `TypeError` and the accessor returns a fresh frozen array. `assertNoMutation` refuses 1, −1, 0.5, `"zero"`, `null`, `undefined` and `{}`, accepting only integer 0. `canary.test.js:700-757` writes a real escape spec, spawns a child, and asserts a non-zero status plus that the child's output names the detected capability — the escape genuinely executes `fake.trap(...)` and the invariant genuinely throws. |
| 5 | Human-visible apply, reviewed content bound to a digest | **CLOSED** (with residue → G-3) | Reproduced the exact prior attack: `script -qec 'node release-close.js apply --yes > file' /dev/null <<< "sim"` now prints `Apply recusa: o plano não foi mostrado em um terminal vivo…` and the redirected file is **0 lines**. Driving `confirmApply` directly, all eight locks fire in the exported order `plan, flag, tty, output, sink, content, prompt, answer`, with zero sink calls before the content lock, the render exactly at the content boundary, and the prompt only after it. The digest is a real SHA-256 over five `name/length/value` triples; adding one space to the approved notes changes it. |
| 6 | Scripted failure scenarios through the production retry/re-read contract | **PARTIALLY CLOSED** (→ G-2) | The seam itself is real and correct: 6 families × 5 reads all re-read by natural identity (verified identical `identidade` on both attempts), and a persistent failure refuses with `TRANSPORT` for timeout/lost-response and `UNAVAILABLE` for 409/422/429/5xx, `writeProposed` false throughout, and no rejection escapes the seam. **But** plan 09-09's must-have is that each family *reaches the production decision seam*, and it does for 3 of the 5 reads. On `getReleaseByTag` and `listMilestones` the rejection escapes `decide()` **before** the seam is ever constructed, because `camadaDeDecisao` is the only layer that does not guard those two. Tracked as G-2. |

## Observable Truths

22 consolidated truths: the four ROADMAP success criteria plus the deduplicated truth set of plans 09-04 … 09-09, plus the three properties the second round's own coverage declaration admits are open.

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Zero-dependency Node 22 ESM tool, `verify`/`plan`/`apply`/`--help`, no npm package, workspace or hosted publisher | ✓ VERIFIED | `package.json` is `private` + `type: module` with no `dependencies`/`scripts`; `--help` exits 0 and lists all three verbs |
| 2 | Annotated-tag predicate proves ref identity, full tag-object SHA, cross-hop identity and a commit second hop before any equality | ✓ VERIFIED | `eligibility.js:173-240`; probe row-by-row above |
| 3 | Non-commit peels, foreign ref, identity mismatch and abbreviated SHA at either hop are refused with `writeAction` null | ✓ VERIFIED | 9 refusal cases, all `TAG-IDENTITY`/`LIGHTWEIGHT`, `writeAction` null |
| 4 | Absent / denied / throttled / 5xx / malformed / transport reads each normalize to their own stable EN code | ✓ VERIFIED | 6 distinct codes observed; only 404 yields `MISSING` |
| 5 | Only an explicit allowlist of backend+frontend `success` at the exact full target SHA on both required runs unblocks; absent or malformed `ci` is a `TypeError` | ✓ VERIFIED | control green; 14 mutations all blocked; missing `ci` throws |
| 6 | Eleven CI failure families each classify `FAILED` with a distinct EN code and a PT-BR reason | ✓ VERIFIED | `CI-CANCELLED`, `CI-TIMED-OUT`, `CI-UNKNOWN`, `CI-ACTION-REQUIRED`, `CI-NEUTRAL`, `CI-PENDING`, `CI-MISSING`, `CI-WRONG-SHA`, `CI-WRONG-RUN`, `CI-CONTRADICTORY` observed |
| 7 | No code path derives a green CI state from bare run identifiers | ✓ VERIFIED | no `state: 'success'` literal in any non-test source; `evidence.test.js` scans code with comments stripped |
| 8 | Classification is target-scoped: unrelated records cannot block or unblock a target | ✓ VERIFIED | unrelated release pair → `PARTIAL`, not `CONFLICTING`; both versions land in `unrelated*` |
| 9 | All partitioned records retained with stable identifiers; no array collapsed to its first element | ✓ VERIFIED | `DUPLICATE` retains `[9001, 9002]`; `CONFLICTING` retains `[9001, 9003]` |
| 10 | The production decision path executes all five declared reads in the fixed order | ✓ VERIFIED | `evidence.test.js` asserts the method list and sequence numbers 1–5 on all eight scenarios |
| 11 | A completed target reports `MISSING` + `outcome COMPLETE_NOOP`, with no seventh code | ✓ VERIFIED | `classify.js:465-477`; asserted through the production seam in two suites |
| 12 | Client surface is exact and the counter is closure-measured and unfalsifiable from outside | ✓ VERIFIED | probe: 3 escape shapes refused, 1 frozen array, tally in closure |
| 13 | A deliberately injected forbidden-write canary makes a scoped test run exit non-zero | ✓ VERIFIED | `canary.test.js` spawns a real child that executes the escape and asserts non-zero status plus the named capability |
| 14 | Reported `mutations` is the measured count, never a literal, and a non-zero count is refused | ✓ VERIFIED | `assertNoMutation` refuses 6 corrupt measurements; every renderer prints the measured value; `plan --json` matches the client's tally |
| 15 | The eight apply locks fire in the fixed order with zero writes before the content lock, and redirected output refuses | ✓ VERIFIED | all 8 locks probed with the right lock name and the right write/prompt observable; the prior attack now refuses with a byte-empty file |
| 16 | Confirmation is bound to a canonical digest over five reviewed fields, recomputed at prompt time | ✓ VERIFIED | one added space changes the digest; the gate recomputes and compares before the prompt |
| 17 | All six scripted families normalize and re-read by natural identity, proposing no write | ✓ VERIFIED | 30 combinations probed; identical `identidade` on both attempts; `writeProposed` false |
| 18 | No ref-write path, no network/subprocess/credential read in non-test source; importing the CLI runs no verb | ✓ VERIFIED | scan of all 8 production modules: zero hits; `ehScriptDeEntrada()` guards the top level |
| 19 | The suite is deterministic, zero-dependency, and needs no network or database | ✓ VERIFIED | 214/214 three consecutive runs, exit 0 each; `verify --json` and `plan --json` byte-identical across runs |
| 20 | A red signal the classifier's own contract validates must block the plan | ✗ FAILED | `failedRunIds` validated and given precedence, absent from the only evidence producer; red-only snapshot → `MISSING`, `applyLiberado: true`, `bloqueio: null`; pinned by three suites. **G-1** |
| 21 | Every declared read failure is reported as a PT-BR refusal in the phase's family vocabulary | ✗ FAILED | `getReleaseByTag` and `listMilestones` are unguarded; all three verbs print an English stack trace and exit 1; `process.exitCode` never runs. **G-2** |
| 22 | The operator's approval is bound to evidence the classifier declared valid for this target | ✗ FAILED | `montarConteudoRevisado` re-partitions with `find` and ignores `classificacao` and `targetShaValidates`; a diverging-SHA release and an open milestone both supply approved text. **G-3** |

**Score: 19/22** verified. `behavior_unverified: 0` — every truth above was settled by executing it, not by grepping for it, so nothing is being carried on symbol presence.

## The three open items — independent verdicts

### G-1 / H-01 — `failedRunIds` dropped by the evidence builder: **CONFIRMED, and it is a fail-open**

The review's chain reproduces exactly. `classifySnapshot` treats `failedRunIds` as a first-class member of its validated contract (`assertContract` throws a `TypeError` if present and not an array) and gives it precedence above `CONCURRENT`. `buildCloseEvidence` is the only producer of evidence in the repository and has no such key and no such parameter, so the key is **absent, silently** — not defaulted, not warned. Measured through the real seam on the frozen `fixtures/failed.json`, which declares `failedRunIds: [36095855139]` over an otherwise green `ci` block:

```
[failed] eligibility=ELIGIBLE classification=MISSING
[failed] applyLiberado=true  bloqueio=null
[failed] closeMarkers na evidencia = []  failedRunIds presente=false
```

Feeding the *same* evidence to the classifier with the key present returns `FAILED` with the reason naming the red run. So the classifier refuses and the production path releases.

**Severity judgement against the phase goal, not the plan text.** The goal names a *fail-closed contract*. A validated red signal that the production path drops, producing `applyLiberado: true` with `bloqueio: null` on the field Phase 11 will gate remote writes on, is the archetypal fail-open. Three factors raise it above a latent note:

1. The suite now **pins the wrong value**. `evidence.test.js:811` and `:878-886`, `safe04.test.js:96-104` (with `applyLiberado` derived true at line 851) all assert `MISSING` as the reachable outcome of the fixture named `failed`. Removing the defect turns three suites red. A fail-open that is also an expectation cannot be caught by the suite that would catch it.
2. The only other guard — the `ci` allowlist — has **no declared mapping** anywhere in this phase from "a run failed" to a non-`success` conclusion. That mapping is Phase 10's job, so the hole must not be inherited silently.
3. The phase goal says "one contract". Here the classifier's contract has six keys and the constructor has five, and the silent direction is the unsafe one.

I do not raise it above blocker: the tool cannot write anything in Phase 9, so nothing remote changes today, and no operator input currently reaches the key. But "latent" is not "closed", and the prompt's own test — *pinned to a value the goal forbids* — is met squarely. **Blocker.**

`closeMarkers` I judge differently and **do not** raise as a gap: it is an accepted, documented, executably-proven Phase 11 boundary (`COVERAGE.md:51-98`, `failure.test.js:899-925`), and no snapshot can carry a marker today. It is recorded as advisory because `CONCURRENT` still sits in the production `BLOCKING_CODES`, which is a trap for a Phase 11 reader rather than a fail-open.

### G-2 / H-02 — two unguarded reads crash the process: **CONFIRMED end to end**

I reproduced it against the real entry point rather than by reading. Copying the tool to a scratch directory and injecting a single `timeout` on `getReleaseByTag` (production logic otherwise untouched):

```
$ node release-close.js verify
Error: Tempo esgotado na leitura getReleaseByTag (cenário roteirizado).
    at serve (fake-client.js:123:13)
    at Object.getReleaseByTag (fake-client.js:154:14)
    at camadaDeDecisao (release-close.js:320:40)
    at async decide (release-close.js:389:16)
    at async runVerify (release-close.js:628:16)
    at async file:///.../release-close.js:859:22
exit=1
```

`plan` and `apply` produce the same English stack trace. The reconciliation seam's own guard (`tentar` → `familiaTransporte`) is correct and never runs, because `decide` awaits `camadaDeDecisao` first. `tratarRecusa` re-throws any non-TypeError, so the rejection unwinds past `runReleaseClose` and past the `process.exitCode` assignment at line 859 — Node reports an unhandled module-evaluation rejection.

**Severity.** It does fail closed with respect to remote state: nothing is written and the exit code is non-zero. But the goal names a *deterministic contract shared with the operator*, and this path is neither a refusal nor a report. The phase already owns the correct answer (`TRANSPORT` family, PT-BR reason, "o estado remoto é desconhecido, não ausente") and applies it to the other three reads inside `checkTagEligibility` and to all five inside the seam. Leaving two reads outside it means the contract is not one. The recorded reason for not fixing it — "not obviously local" — does not hold: `reconcile.js:190-226` is the local fix, already written. **Blocker.**

This also means gap 6 is not fully closed, which is why I recorded it as partially closed above rather than closed.

### G-3 / M-01 — reviewed content selected by a weaker rule: **CONFIRMED on two of three variants**

`montarConteudoRevisado` re-derives the target partition with two `find` calls and never consults `classificacao` — which already carries `releases`, `milestones`, `unrelatedReleases` and `targetShaValidates`. Measured:

- A single target release whose `targetSha` is `'b'*40` while `expectedSha` is the frozen commit → `PARTIAL`, `applyLiberado: true`, `bloqueio: null`, and **reviewed notes = "Notas de uma release de outro commit."** with a real digest. The classifier's own reason says the divergence prevents treating the target as closed, and the plan hands that record to the operator for approval.
- Two target milestones where the first is `state: 'open'` and carries a `completionRecord` → `PARTIAL`, `applyLiberado: true`, and **the approved completion record is the open milestone's.**
- A release of another tag → `reviewed: null`, so the gate refuses. That variant fails closed by luck of the `find`, not by rule.

The digest machinery is sound; the selection rule is weaker than the decision it is meant to bind. SAFE-04 requires that apply have "reviewed Release/Milestone content" — content that is present but may be the wrong content, with the operator's approval bound to it, is a defect in the same fail-closed direction. Latent today (the CLI always serves the no-reviewed-content `reference.json`, so the gate refuses on `content` before the prompt — a coverage hole the review documents and I confirmed), but local to fix: the classified evidence already has every field needed. **Blocker, lower blast radius than G-1/G-2.**

## Required Artifacts

| Artifact | Status | Level 1 / 2 / 3 / 4 |
|-----------|--------|------------------------|
| `package.json` | ✓ VERIFIED | private ESM, no dependencies |
| `client.js` | ✓ VERIFIED | exact surface; prototype/array routes noted as advisory |
| `fake-client.js` | ✓ VERIFIED | closure-backed tally, frozen accessor, programmable failures |
| `eligibility.js` | ✓ VERIFIED | four identity proofs; 17/17 adversarial cases |
| `classify.js` | ⚠️ PARTIAL | allowlist and scoping correct; advertises `failedRunIds` it cannot be handed (G-1) |
| `release-close.js` | ⚠️ HOLLOW at 3 points | five reads wired and measured count real; two reads unguarded (G-2) and reviewed content weakly selected (G-3) |
| `reconcile.js` | ✓ VERIFIED | guards all five reads, re-reads by natural identity, refuses on a repeat failure |
| `apply-gate.js` | ✓ VERIFIED | eight locks in order, zero writes before content, digest recomputed |
| `gh-client.js` | ✓ VERIFIED | throws on all five reads naming Phase 10; passes the exact surface |
| `fixtures/*.json` (10) | ⚠️ PARTIAL | all reachable and exact except `failed.json` and `concurrent.json`, whose declared signals the production seam cannot carry (G-1) |
| `COVERAGE.md` | ✓ VERIFIED | unusually honest: names both open residuals in prose and marks 09-09's own gap "still OPEN" |
| `09-REVIEW.md` | ✓ VERIFIED | 2 high findings independently reproduced |
| `WINDOWS.md` | ⚠️ PARTIAL | 6 open deviations, one class; ledger row 6 garbled in the markdown table (advisory) |

## Key Links

| From | To | Via | Status |
|------|----|-----|--------|
| `release-close.js` | `eligibility.js` | `checkTagEligibility` in `decide` | ✓ WIRED — same signature, stricter predicate internal |
| `release-close.js` | `fake-client.js` | `makeFakeClient` + five ordered reads | ✓ WIRED — sequence 1–5 asserted on all eight scenarios |
| `release-close.js` | `reconcile.js` | `reconciliar` with `decide: camadaDeDecisao` | ⚠️ PARTIAL — the seam is reached for 3 of 5 reads; 2 crash first (G-2) |
| `release-close.js` | `classify.js` | `classifySnapshot(evidence)` | ⚠️ PARTIAL — wired, but the evidence lacks a key the classifier validates (G-1) |
| `release-close.js` | `apply-gate.js` | `confirmApply` after the content lock | ✓ WIRED — sink reports characters, digest recomputed at prompt time |
| `release-close.js` | `classify.js` (reviewed content) | `montarConteudoRevisado` | ✗ NOT WIRED to the decision — re-partitions instead of consuming `classificacao` (G-3) |
| `classify.js` | `eligibility.js` | module independence | ✓ WIRED — zero imports, asserted by a test |

## Data-Flow Trace (Level 4)

| Value | Source | Real data? | Status |
|-------|--------|-----------|--------|
| eligibility decision | three fake reads → strict predicate | Yes | ✓ FLOWING |
| `releases` / `milestones` | real client envelopes → `buildCloseEvidence` | Yes — whole arrays retained | ✓ FLOWING |
| `ci` | frozen `reference.json` block, copied byte for byte | Yes | ✓ FLOWING |
| `mutations` | closure tally via `medirMutacoes` | Yes — measured, provably non-zero-capable | ✓ FLOWING |
| `applyLiberado` | `eligibility && !bloqueado && !recusou` | Yes — but the red trigger never reaches it | ⚠️ PARTIAL (G-1) |
| `reviewed` / `reviewedDigest` | `find` over raw evidence | Yes — but possibly the wrong record | ⚠️ PARTIAL (G-3) |
| a read failure on 2 of 5 reads | `lerEvidencia` (release-close.js:273) | Yes — as a PT-BR refusal, verified 2026-09-25 | ✓ FLOWING (G-2 closed) |

## Behavioral Spot-Checks

All local and non-mutating. No server, no GitHub, no network.

| Behavior | Result | Status |
|----------|--------|--------|
| `cd tools/release-close && node --test` | 214 tests, 214 pass, 0 fail, exit 0 | ✓ PASS |
| Same, three consecutive runs | 214/214/214, exit 0 each | ✓ PASS |
| `--help` | usage lists all three verbs, exit 0 | ✓ PASS |
| `verify` | `ELIGIBLE`, `mutations: 0`, exit 0 | ✓ PASS |
| `plan` | eight ordered steps, `MISSING`, exit 0 | ✓ PASS |
| `verify --sha` divergent | `INELEGÍVEL`, `SAFE-02`, PT-BR reason, exit 1 | ✓ PASS fail-closed |
| `verify --version` unknown | `INELEGÍVEL`, `TAG-IDENTITY`, PT-BR reason, exit 1 | ✓ PASS fail-closed |
| `verify --sha` malformed | `Entrada inválida: SHA esperado inválido…`, exit 1 | ✓ PASS fail-closed |
| unknown verb | `Verbo desconhecido…`, exit 2 | ✓ PASS |
| `apply --yes` in a pipe | `Apply recusa: … terminal interativo…`, exit 1 | ✓ PASS fail-closed |
| **`apply --yes`, live TTY stdin, stdout redirected, `sim` typed** | **`Apply recusa: o plano não foi mostrado em um terminal vivo…`; redirected file 0 lines** | ✓ PASS — the prior pass's reproduced attack now refuses |
| **transport throw on `getReleaseByTag`, all three verbs** | **English stack trace, exit 1, no PT-BR refusal** | ✗ **FAIL (G-2)** |
| **red-only snapshot through the production seam** | **`applyLiberado: true`, `bloqueio: null`** | ✗ **FAIL (G-1)** |
| **diverging-SHA release → reviewed notes + digest** | **approved text is from the invalid record** | ✗ **FAIL (G-3)** |
| `cd backend && npx vitest run` | 6 files, 131 tests, exit 0 | ✓ PASS |
| `cd frontend && npm run build` | 107 modules, built, exit 0 | ✓ PASS |

## Test Quality Audit

| Test file | Req | Active | Skipped | Circular | Strongest assertion | Verdict |
|-----------|-----|--------|---------|----------|--------------------|---------|
| `eligibility.test.js` | SAFE-02, OPS-01 | 19-row exact-code matrix | 0 | none | Value (exact EN code) | ✓ ADEQUATE |
| `classify.test.js` | OPS-02 | 11 CI families + partition matrix | 0 | none | Value (exact `ciCode`) | ✓ ADEQUATE |
| `canary.test.js` | SAFE-02 | escape + surface + invariant | 0 | none | Behavioral (child exit status) | ✓ ADEQUATE |
| `evidence.test.js` | OPS-01, OPS-02 | 8-scenario exact table through the seam | 0 | none | Value (code + retained IDs) | ⚠️ two rows pin a forbidden value (G-1) |
| `failure.test.js` | OPS-02, SAFE-02 | 6 families × 5 reads, ordering, no-blind-write | 0 | none | Behavioral (call-log order) | ⚠️ reaches the seam for 3 of 5 reads (G-2) |
| `safe04.test.js` | SAFE-04 | 8 locks, digest, sink, prompt settlement | 0 | none | Behavioral | ⚠️ pins the same forbidden value (G-1) |
| `nowrite.test.js` | SAFE-02 | denylist + gh stub | 0 | none | Static | ⚠️ supplementary; the load-bearing proof moved to `canary.test.js` |

Disabled tests on requirements: **0**. Circular expectation generation: **0** — the only `writeFileSync` in a suite is `canary.test.js` writing its own temporary *input* spec, and the assertion is that the child *fails*.

**On the tautology question the prompt raised.** Plans 09-06 and 09-08 found probes that could not fail, so I checked the shipped assertions for the same shape. The prior tautology — the all-fixture SAFE-04 test that collapsed duplicate/conflict arrays and asserted only `typeof code === 'string'` — is gone: the array-collapsing helper is gone, the exact 8-row table replaces it, and the only remaining `typeof … === 'string'` at `safe04.test.js:443` is a supplementary guard in a test that asserts `writeAction === null` and, three lines later, `verify.code === 'ELIGIBLE'` and `plan.elegibilidade.code === 'ELIGIBLE'`. The `canary.test.js` escape is a real child-process run, not a text scan. The `apply-gate` locks each fire with the right lock name and the right write observable, verified independently rather than trusted. So the *mechanical* tautologies are closed.

What remains is a different and worse shape: three suites that are not tautological — they assert a specific value, they can fail, and they do — but the value they assert is one the fail-closed goal forbids. That is G-1, and it is why "the tests are strong" and "the contract is wrong" are both true at once.

## Requirements Coverage

All four IDs are accounted for; none is orphaned, and `REQUIREMENTS.md` maps exactly these four to Phase 9.

| Requirement | Source plans | Status | Evidence / blocking issue |
|-------------|--------------|--------|--------------------------|
| **OPS-01** — operator can run the checked-in Node 22 ESM tool with `verify`/`plan`/`apply`, no new package or hosted service | 09-01, 09-03, 09-07 | ⚠️ **PHASE-SCOPED, WITH A DEFECT** | CLI surface, ESM manifest, zero dependencies, import-safe entry, determinism and a measured counter all verified. `gh-client.js` is intentionally a throwing stub (live transport is Phase 10's declared milestone). The defect: on a read failure the tool produces an English crash rather than the operator-readable refusal OPS-01's "operator can run" implies — **G-2**. |
| **OPS-02** — pure reconciliation logic covered by deterministic `node:test` fixtures and mocked API scenarios for the six states | 09-02, 09-05, 09-09 | ⚠️ **MOSTLY MET, WITH A DEFECT** | All six codes reachable and exact at the pure classifier; 10 frozen fixtures; six scripted families × five reads with observed re-read ordering and no write proposed; zero disabled tests, zero circular generation. The defect: the fixture named `failed` does not produce `FAILED` through the production seam, and the fixture named `concurrent` does not produce `CONCURRENT` — both are pinned as `MISSING` with `applyLiberado: true` — **G-1**. |
| **SAFE-02** — annotated tag whose peeled commit equals remote `main` and the supplied full SHA; no ref-write path | 09-01, 09-02, 09-04 | ✓ **SATISFIED** | Four identity proofs, 17/17 adversarial cases, six failure families, `writeAction` null in every branch, no ref-write path in any source, exact read-only client surface with a real forbidden-write canary. |
| **SAFE-04** — `verify`/`plan` perform no mutations; `apply` requires reviewed content, a displayed plan and explicit confirmation | 09-03, 09-08 | ⚠️ **MOSTLY MET, WITH A DEFECT** | Measured count everywhere, the prior redirection attack refused in PT-BR with a byte-empty file, eight locks in order with zero writes before the content lock, digest real and recomputed. The defect: the reviewed content can be drawn from an open milestone or a diverging-SHA release, so the approval is not bound to validated evidence — **G-3**. |

**Coverage: 1/4 fully satisfied, 3/4 satisfied except for one named defect each.**

## Anti-Patterns

No `TBD`, `FIXME` or `XXX` debt markers, no `TODO`/`HACK`/`PLACEHOLDER`, no `console.*` in any production module, no credential or network access, no ref-write path. `git status` shows the tool tree fully committed. The `return null` occurrences in `release-close.js`, `classify.js` and `reconcile.js` are all control flow on a real refusal path, not empty implementations.

| File | Line(s) | Pattern | Severity | Impact |
|------|---------|---------|----------|--------|
| `release-close.js` | 210-224 | evidence builder omits a key the classifier validates | 🛑 Blocker | red signal dropped → fail-open, pinned by three suites (**G-1**) |
| `release-close.js` | 320-321 | two evidence reads unguarded | 🛑 Blocker | crash in English instead of a PT-BR refusal (**G-2**) |
| `release-close.js` | 443-454 | reviewed content selected by a weaker rule than the decision it binds | 🛑 Blocker | approval can bind to an open milestone or a diverging-SHA release (**G-3**) |
| `release-close.js` | 61 | `CONCURRENT` in `BLOCKING_CODES` while unreachable in Phase 9 | 📋 Advisory | a trap for a Phase 11 reader, not a fail-open |
| `client.js` | 52-66 | `Object.keys` misses prototype and array-shaped members | 📋 Advisory | the two routes have their own coverage; no exploitable path today |
| `WINDOWS.md` | 23 | ledger row 6 renders as `TESTE-PLAO` | 📋 Advisory | data defect in the register; the JSON block below is intact |

All six Windows entries are one class — a test-only plan task had no producible RED, so a mutation probe carried the proof. `workflow.windows_enforce` is `false`, so none blocks ship. My independent probes are consistent with the ledger's own claim of non-vacuity: every guard those probes claimed to cover does bite under adversarial input.

## Decision Coverage

```
gsd-tools query check.decision-coverage-verify .planning/phases/09-release-close-contract-fixtures \
  .planning/phases/09-release-close-contract-fixtures/09-CONTEXT.md
→ { skipped: false, blocking: false, total: 16, honored: 16, not_honored: [] }
```

All 16 trackable CONTEXT decisions are represented in shipped artifacts. Advisory only; it does not offset the failed truths.

## Deferred Items

None moved forward. ROADMAP phases 10–13 own live `gh` transport, live CI mapping, reconciliation writes and the live recovery. That boundary does **not** excuse G-1, G-2 or G-3: each is a defect in the Phase 9 contract itself, each is fixable inside files this phase already owns, and deferring any of them means Phase 10 inherits a decision layer that crashes on transport and an evidence contract whose silent direction is the unsafe one.

## Advisory (New Scope, Unevidenced)

| # | Finding | Category | Why Advisory |
|---|---------|----------|--------------|
| 1 | No production module calls the side-effect trap, so the counter is structurally zero because no write path exists | architectural | the boundary, invariant and canary are all real; resolves when Phase 11 adds the first write, or with a production import guard for subprocess/network |
| 2 | `CONCURRENT` unreachable yet present in `BLOCKING_CODES` | other | documented boundary in `COVERAGE.md:51-98`; no snapshot can carry a marker today |
| 3 | `assertClientShape` accepts prototype methods and array members | other | the fake is frozen and a callable is what matters; the prior argv-array concern is addressed |
| 4 | `WINDOWS.md` ledger row 6 garbled as `TESTE-PLAO` in the markdown table | other | the canonical JSON below it is intact; `windows_enforce` is false |

## Human Verification

N/A — infrastructure/CLI-contract phase with no user-facing elements. Every check was automated: the apply gate was driven directly with injected terminals and sinks, and the prior pass's human-adjacent pty attacks were reproduced with `script(1)` and a real pseudo-terminal. No truth is left ⚠️ PRESENT_BEHAVIOR_UNVERIFIED, so no behavioural item routes to a human checkpoint. The positive reviewed-content apply flow is not testable by a human either, because the CLI cannot reach its own render — that is a documented coverage hole, folded into G-3's blast radius, not an unresolved human question.

## Requirements Traceability Summary

| Requirement | Phase 9 evidence | Requirement status |
|-------------|------------------|--------------------|
| OPS-01 | 8 sources, 8 locks, measured count, import-safe entry, determinism; live transport deferred to Phase 10 by COVERAGE.md | ⚠️ phase-scoped, G-2 |
| OPS-02 | 10 fixtures, six states, 11 CI families, 30 failure×read combinations, 0 skipped, 0 circular | ⚠️ G-1 |
| SAFE-02 | strict predicate, 6 failure families, no ref-write, exact surface, real canary | ✓ satisfied |
| SAFE-04 | measured count, redirection attack refused, digest bound, 8 locks | ⚠️ G-3 |

## Gaps Summary

Three gaps block goal achievement. None of them is one of the original six — those are all genuinely closed, and I say so plainly. What blocks the phase is that the second round converted two latent defects into *documented* ones and, in one case, into *pinned expectations*:

1. **G-1 — a validated red signal is dropped and the fail-open is pinned.** `failedRunIds` is in the classifier's validated contract with precedence above `CONCURRENT`; `buildCloseEvidence` has no key or parameter for it. A red-only snapshot yields `MISSING`, `applyLiberado: true`, `bloqueio: null`, and three suites assert exactly that. The CI allowlist has no declared mapping from "a run failed" to a non-`success` conclusion. The fix is local and the review already drafted it: carry the trigger or refuse the input — and if Phase 9 genuinely has no source for it, say so out loud rather than shipping a keyless object that reads as clean. The alternative — deleting the key from the classifier's contract, its precedence table and `fixtures/failed.json` — is equally defensible. The silent third option is what shipped.
2. **G-2 — two of the five declared reads crash instead of refusing.** Measured end to end: all three verbs print an English stack trace and exit 1, with `process.exitCode` never assigned. The seam already implements the right answer; it is simply reached too late. Fix inside `camadaDeDecisao` plus a catch-all family in `tratarRecusa`, then add the regression test that does not exist today.
3. **G-3 — the reviewed content is selected by a weaker rule than the classifier enforces.** The classified decision already exposes `releases`, `milestones`, `unrelatedReleases` and `targetShaValidates`; `montarConteudoRevisado` ignores all of them and re-partitions with `find`. An open milestone and a diverging-SHA release both supply approved text under `applyLiberado: true`.

All three are inside files this phase already owns, all three are small, and none requires a decision the phase has not already made. The 214-test suite, the determinism, the zero-dependency surface, the strict peel, the CI allowlist, the target scoping, the exact client surface, the measured counter, the eight locks and the digest are all real and independently re-verified. This phase is one focused repair round away from `passed` — and shipping it as-is would hand Phase 10 a decision layer that crashes on the first real transport error and an evidence contract whose only silent path is the fail-open one.

---
_Verified: 2026-09-25T19:04:32Z_
_Verifier: the agent (gsd-verifier)_
