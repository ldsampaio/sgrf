---
phase: "09-release-close-contract-fixtures"
reviewed: 2026-09-25T21:40:00Z
depth: standard
review_pass: "post-gap-closure (plans 09-04..09-09 executed)"
files_reviewed: 26
files_reviewed_list:
  - tools/release-close/package.json
  - tools/release-close/client.js
  - tools/release-close/fake-client.js
  - tools/release-close/gh-client.js
  - tools/release-close/eligibility.js
  - tools/release-close/classify.js
  - tools/release-close/reconcile.js
  - tools/release-close/apply-gate.js
  - tools/release-close/release-close.js
  - tools/release-close/eligibility.test.js
  - tools/release-close/classify.test.js
  - tools/release-close/canary.test.js
  - tools/release-close/evidence.test.js
  - tools/release-close/failure.test.js
  - tools/release-close/nowrite.test.js
  - tools/release-close/safe04.test.js
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
findings:
  critical: 0
  high: 2
  medium: 7
  low: 5
  total: 14
status: high
---

# Phase 09: Code Review Report (post-gap-closure pass)

**Reviewed:** 2026-09-25
**Depth:** standard
**Files Reviewed:** 26
**Status:** high (2 high, 7 medium, 5 low, 0 critical)

This is a **fresh** review of the current tree, written over the earlier gap-closure
review (4 critical + 8 warning). It answers three things explicitly: which of the
earlier findings are now closed, which remain, and what the fixes themselves broke or
left half-built.

**Method and its limits, stated up front.** No shell/terminal tool is available in this
session, so I could **not** execute `node --test tools/release-close/` and the
"214 passing" baseline is taken from `09-09-SUMMARY.md:370` rather than re-measured.
Every finding below is derived from the source as it stands on disk, cited by file and
line, and each one is a claim about code I read rather than about a test result I
observed. Where a finding rests on a chain of calls, the whole chain is quoted.

---

## 1. Status of the previous review's twelve findings

| Old id | Subject | Verdict now | Evidence |
|--------|---------|-------------|----------|
| CR-01 | Redirected stdout bypasses the human-visible-plan lock | **RESOLVED** | `apply-gate.js:158-163` is a new fourth lock `output`, evaluated before any write; `release-close.js:773` reads the boolean from `io.stdout`, not `io.stdin`; `safe04.test.js:1384-1416` proves the read with a two-sided differential through the real entry. |
| CR-02 | Missing/non-green CI evidence classified apply-ready | **RESOLVED** | `classify.js:202-302` is a positive allowlist with eleven named families; the hard-coded `checks.state: 'success'` is gone; `evidence.test.js:773-783` scans code (comments stripped) for a synthesized green. |
| CR-03 | SAFE-02 accepted an unproven non-commit peel | **RESOLVED** | `eligibility.js:173-240` closes four identity proofs before any equality comparison (exact ref name, 40-hex tag SHA, cross-hop identity, second hop typed `commit`); the 19-row exact-code matrix at `eligibility.test.js:207-336` includes tree/blob/tag peels. |
| CR-04 | Zero-mutation proof inert / hard-coded counter | **RESOLVED IN ITS MAIN HALF, ONE REQUESTED GUARD STILL MISSING** | The counter is now closure-backed and measured (`fake-client.js:89-105`), the surface is exact (`client.js:60-66`), the canary executes a real escape in a child process (`canary.test.js:701-757`), and every renderer prints the measured value. The fix text also asked to "reject any production import of subprocess/network capabilities"; no such guard exists. See **M-04**. |
| WR-01 | Permission/transport failures mislabeled as missing | **RESOLVED** | `eligibility.js:74-97` branches per status family; only 404 yields `MISSING`; `reconcile.js:125-148` reuses the same vocabulary. |
| WR-02 | CLI bypassed the five-read seam, discarded duplicate identity | **RESOLVED** | `release-close.js:312-334` walks all five reads in the fixed order and hands the raw envelopes to the exported `buildCloseEvidence`, which retains the whole payload. |
| WR-03 | SAFE-04 fixture tests collapsed the states they claimed | **RESOLVED** | Exact expectation tables at `safe04.test.js:41-140` and `evidence.test.js:803-812` assert the literal code per scenario, and the release array is retained whole. |
| WR-04 | Importing the CLI terminated the host process | **RESOLVED** | `release-close.js:846-860`: entry guard via `realpathSync` + `pathToFileURL`, `process.exitCode` assignment, `main` exported as `runReleaseClose(argv, io)`. |
| WR-05 | TTY close left apply pending forever | **RESOLVED** | `release-close.js:694-728`: `makeAsk` settles exactly once on answer, `close` and stream error, each with its own PT-BR reason. |
| WR-06 | Completed Release/Milestone reported as PARTIAL | **RESOLVED BY DESIGN, RESIDUE REMAINS** | `classify.js:465-477` returns the pair `MISSING` + `outcome: 'COMPLETE_NOOP'`. The residue is in the plan object, not the classifier: see **M-07**. |
| WR-07 | Duplicate/conflict not scoped to one target version | **RESOLVED** | `classify.js:319-389` partitions by `tagName === version` / `title|label === version` and reports foreign records as `unrelated*`. |
| WR-08 | Apply gate had no reviewed-content lock | **RESOLVED** | `apply-gate.js:69-92,178-190` adds a five-field `canonicalReviewedDigest` and a `content` lock that recomputes it at prompt time. The residue found by this pass is **M-01** and **M-02**. |

No previously reported defect is still open in the form it was reported. The two
high findings below are not regressions of old findings: one is a **latent fail-open
that the gap-closure work made explicit by pinning it as a test expectation**, and one
is a **crash path the executing agents found, documented as a threat flag, and left
unfixed** (as they asked me to check).

---

## 2. The three items flagged as still open — independent verdicts

### 2.1 `closeMarkers` / `failedRunIds`: still true — and the two halves have different verdicts

**Confirmed by reading the current code.** `buildCloseEvidence` emits exactly five keys,
hard-codes `closeMarkers: []` and has no `failedRunIds` key at all
(`release-close.js:210-224`). `classifySnapshot` nevertheless treats `failedRunIds` as a
first-class member of its *validated* contract (`classify.js:158-160`) and gives it
precedence above `CONCURRENT` (`classify.js:419-426`). Tracing a red-only snapshot through
the production path:

1. `decide` → `camadaDeDecisao` → `buildCloseEvidence` returns `{target, ci, releases, milestones, closeMarkers}` — no `failedRunIds`, so the key is **absent, silently**.
2. `classifySnapshot(evidence)`: `assertContract` skips the optional red trigger (`snapshot.failedRunIds !== undefined` is false), so no TypeError; `execucoesVermelhos` returns `[]` (`classify.js:304-307`).
3. Green `ci`, no in-flight markers, empty partition → **`MISSING`**.
4. `buildClosePlan`: `bloqueado === false` (MISSING is not in `BLOCKING_CODES`), `recusou === false` → **`applyLiberado: true`, `bloqueio: null`** (`release-close.js:545-546`).

That exact value is now pinned as the expected outcome of the frozen `failed.json`
scenario in three suites (`evidence.test.js:878-886`, `safe04.test.js:96-104` with
`applyLiberado` derived true at line 851, and `CENARIOS` in `evidence.test.js:811`).

**Verdict, split:**

- **`closeMarkers` → `CONCURRENT`: an accepted, documented boundary.** No declared read
  returns a close marker, the vocabulary belongs to Phase 11 reconciliation, and
  `COVERAGE.md:51-61` plus `failure.test.js:899-925` state it executably. There is no
  wrong answer here because nothing in Phase 9 claims to detect concurrency. The residual
  trap is that `CONCURRENT` still sits in the production `BLOCKING_CODES`
  (`release-close.js:61`), where a Phase 11 reader can mistake a blocking code for a
  detected condition. Reported below as **M-06**.
- **`failedRunIds`: a real defect, not a boundary.** The field is validated by the
  classifier's own contract, appears in the precedence table, and lives in a fixture
  (`fixtures/failed.json:9`) that declares a failed run with an otherwise green `ci`
  block. The production evidence builder drops a validated red signal **without error,
  warning or field**, and the suite pins the resulting fail-open as the correct value.
  The only fail-closed defence is a *different* mechanism — the `ci` allowlist — whose
  ability to catch a red run depends entirely on Phase 10 mapping a failed run into a
  non-`success` conclusion, which does not exist yet. Reported as **H-01**.

### 2.2 `camadaDeDecisao` reads two envelopes without a try/catch — CONFIRMED, and it crashes the process

**Confirmed.** `release-close.js:320-321`:

```js
const release = await resolvedClient.getReleaseByTag(resolvedVersion);
const milestones = await resolvedClient.listMilestones();
```

No guard. The three tag/main reads are guarded inside `checkTagEligibility`
(`eligibility.js:102-143`), and all five are guarded inside the seam's `tentar`
(`reconcile.js:190-226`) — but the seam runs *after* the layer returns, so it never sees
this. The failure path, end to end:

1. A read throws (the programmable fake produces exactly this with
   `{ getReleaseByTag: ['timeout'] }`, `fake-client.js:122-124`; a real `gh` client will
   too in Phase 10).
2. `decide` rejects → `runVerify`/`runPlan`/`runApply` `catch` (`release-close.js:627-631`,
   `644-658`, `733-747`) → `tratarRecusa`.
3. `tratarRecusa` handles only `RecusaDoInvariante`, `RecusaDeIntegridade` and
   `TypeError`, and **re-throws everything else** (`release-close.js:612-622`). A
   transport error is a plain `Error`.
4. The `catch` block itself throws, so the verb runner's promise rejects, so
   `runReleaseClose` rejects, so the top-level `process.exitCode = await runReleaseClose(...)`
   (`release-close.js:859`) never executes. Node reports an unhandled module-evaluation
   rejection: an English stack trace on stderr, exit 1, no PT-BR refusal, no `--json`.

**Judgement:** a real defect, high severity. It is not critical by my rubric because
nothing mutates and the exit code is still non-zero, so it fails closed with respect to
remote state — but it is a crash where the phase's own vocabulary promises an operator-
readable refusal ("é a diferença entre uma falha que o operador vê e um processo que
morre", `reconcile.js:186-189`), it is the exact path Phase 10 will exercise, and no test
reaches it (the suite routes scripted timeouts on these two reads away, see
`failure.test.js:427-434`). Reported as **H-02**.

### 2.3 The CLI cannot reach its own render — CONFIRMED, and it is fail-closed

**Confirmed by construction.** `runApply` always loads `fixtures/reference.json`
(`release-close.js:731`), whose release is `404` and whose milestone list is empty
(`fixtures/reference.json:33-42`) → `buildCloseEvidence` yields empty lists →
`montarConteudoRevisado` returns `null` at `release-close.js:446` → the gate refuses on
the `content` lock (`apply-gate.js:178-183`), which sits **before** the render position at
`apply-gate.js:194`. So on every path the CLI can currently be given, `write(...)` is
never called, `makeAsk`'s `createInterface` is never reached, and no prompt is opened.

**Judgement: fail-closed and acceptable to ship — the CLI refuses rather than confirms —
but it is a real coverage hole with a named consequence, and it must not be cited as
end-to-end coverage of the reviewed-content apply.** Three consequences follow: (a) the
character-counting sink adapter and `makeAsk` have behavioural proof only through
injected seams, with one source-text guard covering the adapter
(`safe04.test.js:1725-1789`) that itself states the limitation; (b) the operator-visible
flow of reading reviewed content on a live terminal before the prompt does not exist yet
in production; (c) Phase 10/11 inherits the obligation to serve a baseline that carries
reviewed content before that flow can be claimed. This is documented in three places
(`09-08-SUMMARY.md:397,434`, `safe04.test.js:1730-1739`, `COVERAGE.md`), which is the right
kind of documentation. Reported as **M-06**.

---

## 3. Findings

### High

#### H-01: The production evidence builder silently discards a validated red signal, and the suite pins the fail-open as correct

**Severity:** high
**Files:** `tools/release-close/release-close.js:210-224`; `tools/release-close/classify.js:158-160,304-307,419-426`; `tools/release-close/fixtures/failed.json:9`

**Issue:** `buildCloseEvidence` is the only producer of the five-key evidence in the
repository, and it has no `failedRunIds` key. `classifySnapshot` treats that key as part
of its validated contract — `assertContract` throws a `TypeError` if it is present and not
an array — and applies it *after* the CI allowlist and *before* the concurrency check
(`classify.js:419-426`). The result is that a snapshot whose only red signal is a declared
failed run is classified `MISSING` and the plan reports `applyLiberado: true` with
`bloqueio: null` (full trace in §2.1). `MISSING` is deliberately non-blocking, so the
one field Phase 11 will gate remote writes on says "go" for an input the phase's own
fixture family labels red. The three suites that drive the frozen `failed` scenario all
assert this value as the expected one, so the defect is now load-bearing *as a pinned
expectation* — removing the drop would turn three suites red.

**Why high and not medium:** the tool cannot write anything in Phase 9, so nothing remote
changes today. But the object carrying the wrong value is the plan object, the field is
the apply gate, and the only other guard (the `ci` allowlist) has no declared mapping from
"a run failed" to a non-`success` conclusion anywhere in this phase. That mapping is
Phase 10's job, so the gap must not be inherited silently.

**Fix:** make the evidence constructor carry the signal or refuse the input — not drop it.
Cheapest correct version: accept the red trigger explicitly and default it to a state that
cannot release the plan.

```js
export function buildCloseEvidence({ version, expectedSha, ci, release, milestones, failedRunIds }) {
  // ...
  const evidence = { target: { version, expectedSha }, ci, releases: ..., milestones: ..., closeMarkers: [] };
  // Sem fonte nomeada para o gatilho vermelho, a ausência é uma recusa de contrato —
  // nunca um "não há vermelho" silencioso.
  if (failedRunIds === undefined) {
    evidence.failedRunIds = [];            // declarado, não omitido
  } else if (!Array.isArray(failedRunIds)) {
    throw new TypeError('Entrada inválida: failedRunIds deve ser uma lista de identificadores de execução.');
  } else {
    evidence.failedRunIds = [...failedRunIds];
  }
  return evidence;
}
```

and thread it from `camadaDeDecisao` (`resolvedCi`, `resolvedFailedRuns`) so a Phase 10
client that knows about a failed run can supply it. If the honest answer is "Phase 9 has
no source for it", then the constructor should say so out loud rather than ship a keyless
object that reads as clean — the alternative fix is to delete `failedRunIds` from the
classifier's contract, from the precedence table and from `fixtures/failed.json`, so the
taxonomy stops advertising a trigger it cannot carry. Either is defensible; the silent
third option is not.

---

#### H-02: A transport failure on either evidence read escapes as an unhandled rejection, before the reconciliation seam can run

**Severity:** high
**Files:** `tools/release-close/release-close.js:320-321,612-622,858-860`

**Issue:** §2.2 gives the full chain. Two unguarded `await`s sit in the only production
decision layer; `tratarRecusa` re-throws any non-`TypeError`; the rejection therefore
unwinds past the verb runner, past `runReleaseClose`, and past the top-level
`process.exitCode` assignment, so the operator gets an English stack trace instead of the
PT-BR refusal the phase's whole failure vocabulary promises. Two aggravating details:
(a) the same re-throw means an *internal* bug that happens to throw a `TypeError` is
reported as "Entrada inválida: …", pointing the operator at their own input; (b) the
`await ask()` in `runApply` (`release-close.js:777`) sits outside any `try`, so a rejecting
prompt factory takes the same crash route.

This was found by the executing agents, recorded in `09-09-SUMMARY.md:356,388` and
`COVERAGE.md:100-108` as a threat flag rather than fixed. The recorded reason — that
"the fix is not obviously local" — does not hold: the phase has already answered the
question. Emptying the evidence on a failed read is a fail-open and the phase forbids it;
the correct answer is the one `reconcile.js` already implements, a typed family that
refuses the run.

**Fix:** guard the two reads in the layer and turn the failure into data the same way the
eligibility predicate and the seam do, then let the plan block on it by rule.

```js
async function lerEvidencia(client, metodo, argumentos) {
  try {
    return { envelope: await client[metodo](...argumentos) };
  } catch {
    return {
      falha: {
        code: 'TRANSPORT',
        reason: `Leitura de ${metodo} não completou: a resposta não chegou e o estado remoto é desconhecido, não ausente.`,
      },
    };
  }
}

// em camadaDeDecisao: as duas leituras viram dados; a falha entra no plano como
// bloqueio próprio, ao lado de `recusou` — "não sei" nunca é "está tudo bem".
```

and add a catch-all family in `tratarRecusa` so an internal fault is reported as an
internal fault (distinct text and exit code) rather than re-thrown to become a crash.

**Regression test to add (none exists today):** script
`{ getReleaseByTag: ['timeout'] }` and `{ listMilestones: ['lost-response'] }` on the
`decide` seam and assert (i) no rejection escapes, (ii) `plan.applyLiberado === false`,
(iii) the reason names the read and says the remote state is unknown, not absent.

---

### Medium

#### M-01: Reviewed content is selected by a weaker rule than the one the classifier enforces, and the digest binds the operator to it

**Severity:** medium
**Files:** `tools/release-close/release-close.js:443-454`

**Issue:** `montarConteudoRevisado` re-derives the target partition with two `find` calls
(`release.tagName === version`, `milestone.title === version`) and never consults
`classificacao` or the `expectedSha` it is handed. Three consequences, all reachable:

- **Uniqueness is not required.** The classifier's no-op guard demands *exactly one*
  target record (`classify.js:465-471`); with two target milestones the classification is
  `PARTIAL`, which is **non-blocking**, so `applyLiberado: true`, and the reviewed content
  is taken from whichever milestone happens to come first in the client's list order — the
  evidence array is never sorted before it reaches this function. A milestone that is
  still `open` can therefore supply the `milestoneCompletionRecord` the operator approves
  while plan step 7 says "fechar a Milestone v0.1.1".
- **The target-SHA validation is not required.** A single target release whose
  `targetSha` diverges from `expectedSha` classifies `PARTIAL` with the reason "a
  divergência impede tratar o alvo como concluído" — and still produces reviewed content
  from that release's `notes`, binding the operator's approval to evidence the classifier
  has already declared not valid for this target.
- **`commitSha` is a fallback, not a fact.** `release-close.js:471-474` uses
  `expectedSha` when the snapshot carries no `tagObject` envelope, and the digest then
  covers a value no read ever proved.

The lossless evidence the classifier builds cannot be reused because `retidoRelease` /
`retidoMilestone` (`classify.js:326-342`) drop `notes` and `completionRecord` — so the
plan builder was pushed into re-partitioning with a weaker rule than the one the phase spent
09-05 and 09-07 proving.

**Fix:** make the reviewed object a function of the *classified* evidence, and refuse to
build one from anything ambiguous. Extend the two retention helpers to carry the two text
fields, then:

```js
function montarConteudoRevisado({ classificacao, evidencia, version, expectedSha, commitSha }) {
  const releases = classificacao.releases;      // já particionado, validado e ordenado
  const milestones = classificacao.milestones;
  if (releases.length !== 1 || milestones.length !== 1) return null;  // ambiguidade não vira aprovação
  if (releases[0].targetSha !== expectedSha) return null;            // alvo não validado não aprova
  const releaseNotes = releases[0].notes;
  const milestoneCompletionRecord = milestones[0].completionRecord;
  if (typeof releaseNotes !== 'string' || releaseNotes.trim().length === 0) return null;
  if (typeof milestoneCompletionRecord !== 'string' || milestoneCompletionRecord.trim().length === 0) return null;
  return Object.freeze({ version, expectedSha, commitSha, releaseNotes, milestoneCompletionRecord });
}
```

Add three cases to the `safe04` expectation table: two target milestones, one target
release with a diverging `targetSha`, and a target release with blank `notes` — each must
assert `plan.reviewed === null` and `plan.reviewedDigest === null`.

---

#### M-02: The CLI writes the reviewed content and its digest to a destination the gate just declared unreviewable

**Severity:** medium
**Files:** `tools/release-close/release-close.js:749-786`

**Issue:** the comment at `release-close.js:749-755` states the rule plainly — emitting the
JSON before the terminal and content locks "colocaria o texto que o operador deveria ler
num destino que ninguém revisou" — and then the code does exactly that on the refusal
paths:

```js
const gate = await confirmApply({ ... });
if (json) renderJson(plan, io.stdout);      // plan.reviewed + plan.reviewedDigest
if (!gate.confirmed) { io.stderr.write(...); return 1; }
```

`renderJson` serializes the whole plan, which carries `reviewed` (both PT-BR sentences) and
`reviewedDigest`. It runs after a gate that refused at `tty` ("entrada redirecionada ou
pipe não confirma nada"), at `output` ("o plano não foi mostrado em um terminal vivo") and
at `content`. So `apply --json` piped writes the review text to a pipe the gate just
declared unreviewed. The existing piped test only covers the non-`--json` invocation
(`safe04.test.js:1201-1208`, `assert.equal(piped.stdout, '')`), which is why the hole is
invisible today, and on the current reference baseline `reviewed` is `null` so nothing
leaks — but structurally the invariant the comment claims to uphold is not upheld.

**Fix:** emit the JSON only where the gate actually rendered, or fold it into the gate's
single render position so the CLI has no post-gate write at all.

```js
if (!gate.confirmed) {
  if (json && gate.lock === 'answer') renderJson(plan, io.stdout); // o operador leu
  io.stderr.write(`${gate.reason} ...`);
  return 1;
}
if (json) renderJson(plan, io.stdout);
```

Add a probe: `apply --yes --json` through a fully piped child must assert `stdout === ''`,
which is the same invariant the non-`--json` row already states.

---

#### M-03: The exported plan surface validates nothing and falls back silently

**Severity:** medium
**Files:** `tools/release-close/release-close.js:456-474,552-586`

**Issue:** `buildClosePlan` and `renderPlanText` are the exported seam Phase 11 will use,
and they accept anything:

- `release-close.js:466` — `evidence ?? buildCloseEvidence({ version, expectedSha, ci: snapshot.ci })`. The fallback **rebuilds evidence from the raw snapshot**, which is precisely the second normalization path that plans 09-08 and 09-09 deleted from the test suites, and it omits `release`/`milestones`, so it always yields empty lists. A caller that forgets `evidence` gets a plan whose `releasePresente`/`milestonePresente` markers and `steps` contradict the `classificacao` it passed in. The tests exercise this fallback rather than catching it: `evidence.test.js:435-444` (`planoDo`) never passes `evidence`.
- `mutations` is not validated. Omit it and `renderPlanText` emits the literal string `mutations: undefined` (`release-close.js:584`). `assertNoMutation`'s own stated philosophy — "uma medição ausente ou corrompida é falha do contrato de leitura, não um passe" (`client.js:79-92`) — is not applied at the point where the count is actually rendered.
- `plan.elegibilidade.code` and `plan.classificacao.code` are dereferenced unguarded (`release-close.js:559-560`), so omitting either throws a raw `TypeError` out of a renderer.

**Fix:** make the plan builder refuse rather than guess. Require `evidence`, `eligibility`,
`classificacao` and `mutations` with PT-BR `TypeError`s, delete the `??` fallback, and
route `mutations` through `assertNoMutation` at the point of rendering so an absent
measurement is a refusal and not a word. Then fix `planoDo` in `evidence.test.js` to pass
the real evidence, so the fallback is gone from the suite as well as from the code.

---

#### M-04: No guard against a production source importing subprocess or network capability — the residual half of old CR-04

**Severity:** medium
**Files:** `tools/release-close/nowrite.test.js:17-53`; `tools/release-close/release-close.js:23-31`

**Issue:** the previous review's CR-04 fix text asked for two things: put enforcement at
the side-effect boundary, **and** "until Phase 11, also reject any production import of
subprocess/network capabilities rather than relying on a small denylist". The first was
done. The second was not. `nowrite.test.js` still scans for a denylist of routine names
(`createRelease`, `updateRef`, …) and contiguous porcelain strings (`release create`,
`update-ref`, …). A future non-test source could write:

```js
import { execFile } from 'node:child_process';
execFile('gh', ['release', 'create', 'v0.1.1', '--notes-file', '/tmp/x']);
```

and turn the suite **green**: none of the nine banned routine names appears, the
contiguous text `release create` does not appear (argv is an array literal), no
`POST|PATCH|PUT|DELETE` word appears, and no credential shape appears. The only
capability-import ban in the island is scoped to `reconcile.js` alone
(`failure.test.js:244`). The project rule is that only the local Node binary may be
spawned, and nothing in the suite enforces it on the tool's production sources.

**Fix:** invert the check — allowlist the capability imports a read-only tool may have,
and fail on any other `node:` specifier in a non-test source.

```js
const IMPORTS_PERMITIDOS = new Set(['node:fs', 'node:readline', 'node:url', 'node:crypto']);
// plus './client.js' & friends (relative specifiers), asserted separately.
for (const achado of codigo.matchAll(/from\s+'([^']+)'/g)) {
  const spec = achado[1];
  if (spec.startsWith('.')) continue;
  assert.ok(IMPORTS_PERMITIDOS.has(spec), `${fonte} importa a capacidade ${spec}`);
}
```

This is strictly stronger than the name denylist, survives a rename, and needs no
allowlist churn as long as the tool stays read-only.

---

#### M-05: The declared Phase 10 adapter cannot satisfy the phase's own decision entry point, and the counter requirement is undocumented

**Severity:** medium
**Files:** `tools/release-close/gh-client.js:42-50`; `tools/release-close/client.js:13-18`; `tools/release-close/release-close.js:269-275,338`; `tools/release-close/reconcile.js:240`

**Issue:** the client contract documents exactly five read methods and nothing else
(`client.js:13-18`), and `assertClientShape` enforces exactly that. But the decision path
calls `assertNoMutation(client)` on the client **object itself** in two places
(`release-close.js:271` via `medirMutacoes`, `reconcile.js:240` in `montar`), so a client
used with `decide` needs a sixth, non-callable member: a measured `mutations` integer.
`gh-client.js` has none. Swap the fake for the declared production adapter and the run does
not reach a transport failure — it dies at the invariant with
"Medição de mutações inválida: … veio undefined". So the COVERAGE claim that the Phase 10
swap is "a transport change only" (`COVERAGE.md:135-138`) is false as shipped for the
adapter the phase itself ships, and the contract a Phase 10 implementer reads does not
mention the requirement they will hit.

**Fix:** declare it in the contract, and give the gh draft the shape now.

```js
// client.js — o contrato real, e não só o que assertClientShape consegue ver
export const READ_COUNTER = 'mutations'; // inteiro medido, não chamável, exigido por decide()

// gh-client.js
export const ghClient = {
  getTagRef, getTagObject, getBranchHead, getReleaseByTag, listMilestones,
  get mutations() { return contador; },   // medido no ponto de efeito, nunca literal
};
assertClientShape(ghClient);
assertNoMutation(ghClient);               // recusa já na importação, não no primeiro operator
```

---

#### M-06: `CONCURRENT` is advertised as a blocking code and can never be produced (the accepted half of §2.1)

**Severity:** medium
**Files:** `tools/release-close/release-close.js:61,203-205`; `tools/release-close/classify.js:30,428-435`

**Issue:** `closeMarkers` is hard-coded empty, so `CONCURRENT` is unreachable through the
production path, yet `BLOCKING_CODES` still lists it and the classifier's header still
publishes it as the second state in the precedence order. The state itself is correctly
absent from the CLI (no fixture carries a marker, nothing claims to detect concurrency)
and the boundary is documented in `COVERAGE.md:51-98`. What is not documented anywhere is
the trap this leaves for Phase 11: a reader of `release-close.js:61` can reasonably infer
"concurrent closes are blocked by this tool", and the only thing that says otherwise is a
test's expected-value table and a COVERAGE section. The taxonomy also means five of six
codes are production-reachable, not six, and nothing in the code says so.

**Fix:** keep the state, mark it as unproduced in the code rather than only in prose — a
named constant with a comment next to `BLOCKING_CODES`, and a `CLASSIFY_REACHABLE` export
(or an explicit `unreachable: ['CONCURRENT']` note in the classifier header) that Phase 11
must remove when the sixth read lands. A reader should not have to open a planning
document to learn that a blocking code has no producer.

---

#### M-07: A completed no-op yields `applyLiberado: true` with eight write steps and nothing machine-readable saying "nothing to do"

**Severity:** medium
**Files:** `tools/release-close/classify.js:465-477`; `tools/release-close/release-close.js:475-492,545`

**Issue:** old WR-06 asked for an explicit completed/no-op state, and the fix chose
`code: MISSING` + `outcome: COMPLETE_NOOP` (no seventh code — a defensible design). The
residue is at the plan level: `MISSING` is not a blocking code, so a target that is
**already published with its milestone already closed** produces `applyLiberado: true`,
`bloqueio: null`, and eight recovery steps marked `adotar`/`ler` (`resolveMarker` at
`release-close.js:408-412` sees a present release and milestone). The reason text is
honest ("Fechamento já concluído…"), and the seam's `writeProposed: false` is honest, but
the plan object — the artifact a Phase 11 executor will gate remote writes on — carries no
field that says "do not execute the steps". A consumer that switches on `applyLiberado`
runs the full recovery flow against a finished release. No test asserts the plan-level
consequence; `evidence.test.js:631-645` asserts `applyLiberado === true` as correct and
stops there.

**Fix:** derive the plan's own gate from the outcome, not from the taxonomy:

```js
const jaConcluido = classificacao.outcome === 'COMPLETE_NOOP';
const applyLiberado = eligibility.eligible === true && bloqueado === false
  && recusou === false && !jaConcluido;
// e o texto passa a dizer o que o operador precisa ler:
const bloqueioPorNoOp = jaConcluido ? 'nada a fazer: o alvo já está fechado (COMPLETE_NOOP)' : null;
```

If the phase wants `applyLiberado: true` to keep meaning "eligible tag, no blocking
state", then add the separate plan field (`executavel: false`) and state in the plan's
header that Phase 11 must consult it. Either way the no-op must be visible in the field
the executor reads, not only in a reason string.

---

### Low

#### L-01: `apply --json` emits human text on the blocked path, unlike every other verb/flag combination

**Files:** `tools/release-close/release-close.js:756-764,785`

The `!plan.applyLiberado` branch writes `planText` to stdout and returns 1 **before** the
`if (json)` block, so a machine consumer that asks for JSON gets prose; `verify` and `plan`
always honour `--json`. The usage text promises "apply: plano antes do texto humano", which
cannot hold when no JSON is emitted at all. Pick one and make it consistent: either render
the JSON in the blocked path too, or state in `USAGE` that a blocked `apply --json` writes
human text.

#### L-02: The usage text still carries a literal `mutations: 0`, and the guard that forbids literals starts after it

**Files:** `tools/release-close/release-close.js:44`; `tools/release-close/evidence.test.js:668-676`

`USAGE` says `plan … (somente leitura, mutations: 0)`, while the whole point of plan 09-07
was that the count is measured, never literal. The anti-literal guard slices
`fonte.slice(fonte.indexOf('function usageError'))`, and `USAGE` is declared ~100 lines
*before* `usageError` — so the only literal zero in the source sits outside the guard's
window by construction. Drop the literal from the prose ("com a contagem medida de
mutações"), or move the guard's window to the whole file.

#### L-03: The fake's call log is a mutable oracle, unlike the effect register

**Files:** `tools/release-close/fake-client.js:86,107-110,131-132`; `canary.test.js:365-379`

Plan 09-06 correctly moved the effect register and the counter into a closure and froze the
exposed copy, with a probe proving a `push` into `writes` is a `TypeError`. The call log
got none of that: `client.calls` is a live array, and `Object.freeze(client)` freezes the
property, not the array. The log is the *independent* oracle that `evidence.test.js:522-536`
and `failure.test.js:440-445` use to cross-check the seam's own sequence — a caller that
pushes a fabricated entry rewrites the evidence the ordering proof rests on. Return a
frozen copy from an accessor, exactly as `writes` does.

#### L-04: A NUL sentinel can reach an operator-facing reason, and number-shaped retained values sort lexicographically

**Files:** `tools/release-close/classify.js:344-352,394-400,446,452`

`alvosDistintos` builds its sentinel as `` `\u0000sem-targetSha:${id}` `` and both the
`DUPLICATE` and `CONFLICTING` reasons interpolate the set values verbatim
(`classify.js:446,452`), so a payload with two same-version releases and no `targetSha`
renders a raw NUL byte into `plan.bloqueio` and into `verify --json`. Separately,
`ordenar('number')` compares `String(a.number)`, so milestone `10` sorts before `9004` —
harmless at four digits, wrong the moment a milestone number crosses a digit boundary. Use a
printable sentinel (or omit the field from the message) and a numeric comparator for numeric
keys.

#### L-05: Two test-hygiene guards can pass vacuously or over-constrain

**Files:** `tools/release-close/evidence.test.js:668-676`; `tools/release-close/canary.test.js:332-341`

`evidence.test.js:669` computes `fonte.slice(fonte.indexOf('function usageError'))`; if that
function is ever renamed, `indexOf` returns `-1`, `slice(-1)` yields the last character, and
both `doesNotMatch` assertions pass while inspecting nothing. `safe04.test.js:1694-1723` has
the same slicer with the `assert.ok(inicio >= 0)` guard that `evidence.test.js` lacks — use
it. Separately, `canary.test.js:336-341` pins `Object.keys(client.js)` to an exact
three-name list: adding any export, including a benign documented constant such as the
`READ_COUNTER` proposed in M-05, fails the suite. Assert that no *new callable* with a
forgiving name appears, or move the closed-surface assertion to a place where it is not
tripped by an additive change.

---

## 4. What is genuinely solid

Stated because a review that only lists defects misrepresents the work:

- **SAFE-02's identity proof order is correct and load-bearing.** Four proofs close before
  any equality comparison, and the two failure taxonomies (`eligibility.js` and
  `reconcile.js`) are genuinely one vocabulary, not two dialects.
- **The zero-mutation claim is now a measurement, not a convention.** The counter lives in
  a closure, the surface is exact, the canary performs a real escape in a child process and
  the parent requires a non-zero exit. The old CR-04 was right that the previous proof was a
  tautology; that specific defect is gone.
- **The gate's refusal families are told apart by their write-observable, not by their
  name**, and the fully-piped case asserts the *absence* of the output-lock phrase, which is
  the kind of negative that keeps two terminal families from merging later.
- **The suites drive the exported production seam rather than re-normalizing evidence
  themselves**, and the mutation probes (3 / 14 / 18 / 23, all reported with vacuous
  candidates named) are a stronger artifact than a green count. The honest self-reporting in
  `09-09-SUMMARY.md` about vacuous mutations is the behaviour I want to see repeated.
- **Zero dependencies, no network, no subprocess, no credential env read, no clock** — all
  verified by scans that read code rather than prose.

---

_Reviewed: 2026-09-25_
_Reviewer: the agent (gsd-code-reviewer), post-gap-closure pass_
_Depth: standard (static: no shell available to re-run `node --test`)_
