# API Coverage — Phase 9 Release-Close Contract & Fixtures

No external API integration: Phase 9 runs the pure contract over the in-memory fake-client plus the throwing gh-client stub; no source or test issues a live `gh api` call, which lands in Phase 10.

## Declared surface

| Item | Decision | Reason |
|------|----------|--------|
| GitHub REST via `gh api` (live) | deferred to Phase 10 | Phase 9 is the contract and fixture phase; the seam exists so the pure logic is fixed before any transport. |
| Remote tag / `main` / Release / Milestone reads | deferred to Phase 10 | Served from frozen fixtures (`tools/release-close/fixtures/*.json`) through `fake-client.js`. |
| CI check evidence | frozen fixture block, not a live query | None of the five declared reads returns CI. The only CI source in the repository is the `ci` block of `fixtures/reference.json`, and the production evidence builder copies it byte for byte. |
| Remote writes of any kind | absent from Phase 9 | No write method exists on the client interface; `apply` fails closed after confirmation. |

## What actually runs in Phase 9

The five read methods of the client interface (`getTagRef`, `getTagObject`,
`getBranchHead`, `getReleaseByTag`, `listMilestones`) are served by exactly two
implementations in this phase:

- `tools/release-close/fake-client.js` — in-memory, programmable, with scripted
  failure sequences and a call log. Every run in the suite goes through it.
- `tools/release-close/gh-client.js` — a deliberate fail-closed stub. Each
  method throws an error naming Phase 10 as the wiring milestone.

Since plan 09-07 the CLI no longer bypasses its own contract: `decide` in
`release-close.js` builds the client once, walks **all five** declared reads in
the fixed order — the three eligibility reads through `checkTagEligibility`,
then `getReleaseByTag` and `listMilestones` — and hands the responses it
actually got to the exported `buildCloseEvidence` before classifying. The
production path is the one the suite drives; `evidence.test.js` calls the
exported seam rather than assembling a call log by hand.

## Why this is evidence, not a claim

- `gh-client.js` throws on all five methods, asserted by
  `tools/release-close/nowrite.test.js#o rascunho gh falha fechado em todos os métodos nomeando a Fase 10`.
- `nowrite.test.js` scans every non-test source for write routines, ref paths,
  write-method verbs and secret reads, so no write surface can be introduced
  without turning the suite red.
- The pure contracts never receive a transport: `checkTagEligibility` and
  `classifySnapshot` take an injected client, which is the seam Phase 10 swaps
  without touching the decision logic.
- `evidence.test.js` asserts the five reads in the fixed order with sequence
  numbers one through five on every scenario, that a blocked CI family forces
  the apply-release flag false, that a missing `ci` block refuses as invalid
  input instead of defaulting green, and that the reported mutation count is the
  client's measured count with a refusal when it is not zero.
- No non-test source under the tool directory contains a synthesized green CI
  state; the scan reads code and not the comment that documents the removal.

## Two states the production path cannot reach yet

`FAILED`-by-explicit-red-run and `CONCURRENT` are not reachable through the
production decision path in Phase 9, and the suite asserts this rather than
leaving it implied. `failedRunIds` and `closeMarkers` are not fields of the
five-key evidence, and no declared read returns either one — the builder's
`closeMarkers` is the empty list the phase has always used. Plan 09-09 wires the
reconciliation seam that consumes the scripted failure families, and the marker
vocabulary belongs to the Phase 11 reconciliation. The CI-blocked `FAILED`
outcome, in contrast, is production-reachable: it is the frozen `ci` block with
one conclusion changed.

### Plan 09-09 verdict on its own flagged gap: the gap is still OPEN

Plan 09-07 flagged that `closeMarkers` and `failedRunIds` have no source among
the five declared reads, named two candidate fixes (a sixth declared read, or
09-09's reconciliation seam), and this section is the answer. **Routing the
scripted failure families through the seam does not close it**, and the reason
is a vocabulary mismatch that is worth stating plainly rather than leaving for
someone to rediscover:

- The six scripted failure families are the READ vocabulary: `TRANSPORT`
  (timeout, lost response) and `UNAVAILABLE` (409, 422, 429, 5xx), plus
  `PERMISSION`, `MISSING` and `MALFORMED` from the frozen envelopes. None of
  them is `CONCURRENT` and none is `FAILED`.
- The seam is the seam's consumer, not its source. It receives `evidence`,
  `eligibility` and `classification` as DATA and delegates re-derivation to an
  injected decision layer; it performs no read that could produce a close
  marker, and it has no way to carry `failedRunIds` into the classifier, because
  that key is not one of the five the evidence contract declares.
- The only producer of that evidence in this phase is `buildCloseEvidence`, and
  it still hardcodes `closeMarkers: []` and has no `failedRunIds` key at all.

`failure.test.js` now proves the gap executably rather than asserting it in
prose: driving the production path over `fixtures/concurrent.json` — which
declares two in-progress close markers — yields `evidence.closeMarkers === []`
and `classification.code === 'MISSING'`, never `CONCURRENT`, and the seam
repasses that classification unchanged without inventing a family. So the seam
is `CONCURRENT`-**transport**-safe (it would carry such a classification
faithfully if one ever arrived) and it is not `CONCURRENT`-**reachable**.

Closing the gap therefore still needs one of: a sixth declared read (a new
client capability, which has to pass 09-06's exact-surface check), or a Phase 11
close-marker source that the evidence builder can draw on. Adding a sixth read
was explicitly outside 09-09's declared files and is not attempted here. The
regression-recording point is that the classification itself is fully covered —
`CONCURRENT` and the explicit-red `FAILED` are proven at the classifier — and
only the *transport* of those states into the production evidence is missing.

### The unguarded evidence reads — RESOLVED 2026-09-25

An earlier revision of this file reported a "residual seam" here and classified it
as a Threat Flag rather than a fix, on the grounds that changing those two reads
was outside plan 09-09's declared behaviour. **That classification was wrong, and
the residual seam was two defects, not one.** Both were confirmed by execution and
both are now fixed in `release-close.js`.

The cause was a single one: `camadaDeDecisao` did not guard the two evidence reads
(`getReleaseByTag`, `listMilestones`), while the three eligibility reads were
guarded by `checkTagEligibility`, which captures a throw and turns it into a
family verdict. Two consequences followed from the same unguarded pair:

1. **A throw reached the operator as a crash.** The fake's transport failures
   raise a plain `Error`, and `tratarRecusa` recognised only `RecusaDoInvariante`,
   `RecusaDeIntegridade` and `TypeError` — so it rethrew. Reproduced on the real
   `runVerify` path: `CRASH|Error|Tempo esgotado na leitura getReleaseByTag`.

2. **A non-`ok` envelope reached the operator as fail-OPEN.** This was the
   serious one. `normalizarLista` converted *any* envelope that was not `ok` into
   an empty list, so a 5xx or a 429 became "no release exists": classification
   `MISSING`, `applyLiberado: true`, and a plan byte-for-byte identical to the
   honest case (`IDENTICOS|true`). The tool answered "the close does not exist"
   when it had in fact never managed to ask. That is fail-OPEN in a release
   preflight, and it is the exact class of bug this phase exists to prevent —
   which is why "outside the plan's declared behaviour" was the wrong call: the
   behaviour the phase *did* declare is that a transport failure becomes a PT-BR
   refusal, and the six scripted families are that contract. Two of them were
   not being honoured.

The fix keeps the existing pattern rather than inventing a new one. `lerEvidencia`
guards the throw as a `RecusaDeLeitura` and returns the envelope **intact**, so
the status that distinguishes absence from failure survives to
`normalizarLista`; that function now produces an empty list only for 404, the
single status that proves absence, and refuses for everything else.
`tratarRecusa` learned the fourth class. The invariant measurement moved ahead of
evidence construction, so a client that cannot be measured is refused as a
*corrupted client* — the correct family — rather than as a malformed read, which
is what the suite requires (`evidence.test.js:710`).

Verified by execution, not by inspection: the scripted outcomes `timeout`,
`lost-response`, `status-409`, `status-422`, `status-429` and `status-5xx` on both
evidence reads all produce a PT-BR refusal with exit 1; none of them kills the
process; a genuine 404 still yields `releases: []` with `MISSING` and
`applyLiberado: true`; and a 200 still retains the record whole (`PARTIAL`). The
absence rule is unchanged in the direction that matters — absence is still absence,
but now only when it is proven. Suite 214/214, backend 131/131, frontend build
green.

### The two states the production path still cannot reach

## Failure families: where they are reachable from

Since 09-09, every scripted failure family passes through a production seam
(`tools/release-close/reconcile.js`). The failure plan remains a programmatic
parameter of the exported `decide` and there is still no command-line flag,
environment variable or usage-text entry that reaches it, so `verify`, `plan`
and `apply` run the seam with no plan and with an empty observed read sequence.
That is deliberate and unchanged: a test that needs a new CLI option is asking
for a production backdoor.

What the 2026-09-25 fix changed here is narrower and worth stating precisely.
The scripted outcomes can no longer be exercised *through the CLI*, but the
**rule they encode** now governs both evidence reads on every real run, because
`lerEvidencia` applies it unconditionally: a throw becomes a `TRANSPORT`
refusal, 401/403 becomes `PERMISSION`, 404 is the only absence, and every other
status is an indeterminate-state refusal. When Phase 10 replaces the fake with
live `gh api` reads, the failure modes stop being test artifacts and become the
live ones — and the handling for them is already in place and already proven.


## Zero dependencies and zero network

`tools/release-close/package.json` declares `"type": "module"` with no
`dependencies`, and the suite runs on no install step, no clock, no database, no
subprocess. The tool never reads a credential environment variable, and the
secret-hygiene proof in `safe04.test.js` fails if any source or captured output
ever carries credential-shaped material.

**The suite command needs the glob form on Node 26.** `node --test
tools/release-close/` — the form the plan summaries used — fails with
`MODULE_NOT_FOUND` on Node v26.7.0, because that argument is resolved as a module
entry point rather than as a test directory. The working invocation is:

```
node --test "tools/release-close/*.test.js"
```

which reports 214 passing tests. Recorded in `09-UAT.md` as a minor gap against
the summaries; the fix is a documentation correction, not a code change.

## Milestone for live calls

Phase 10 (Read-Only Exact-SHA Preflight) is where the real `gh api` reads are
wired behind the unchanged interface, and it is the first phase allowed to talk
to GitHub at all. Because the production path now runs the full five-read seam,
that swap is a transport change only: no decision logic and no evidence builder
call site has to move. Phase 11 adds reconciliation, Phase 12 the CI/race
rehearsal and runbook, and Phase 13 the operator-confirmed live recovery.

---
*Phase: 09-release-close-contract-fixtures*
