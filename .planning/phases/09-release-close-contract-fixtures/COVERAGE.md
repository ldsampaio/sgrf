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

One residual seam in the same area, narrower and also real: a transport throw
from `getReleaseByTag` or `listMilestones` escapes `camadaDeDecisao` as an
unhandled rejection, because those two reads are the only ones the layer does
not guard (`checkTagEligibility` guards the other three). The failure is
surfaced to the operator as a crash rather than as a PT-BR refusal. The six
scripted families are exercised on the first read, so this plan's verification
does not hit it; it is reported in `09-09-SUMMARY.md` as a Threat Flag rather
than fixed, because changing those two reads is outside this plan's declared
behaviour for the decision layer.

## Failure families: where they are reachable from

Since 09-09, every scripted failure family passes through a production seam
(`tools/release-close/reconcile.js`), but **not through the operator surface**:
the failure plan is a programmatic parameter of the exported `decide` and there
is no command-line flag, environment variable or usage-text entry that reaches
it, so `verify`, `plan` and `apply` always run the seam with no plan and with an
empty observed read sequence. The families are proven through the exported
decision and the exported seam; they are not, and this phase does not claim
they are, reachable from a command line.


## Zero dependencies and zero network

`tools/release-close/package.json` declares `"type": "module"` with no
`dependencies`, and the suite runs on `node --test tools/release-close/` — no
install step, no clock, no database, no subprocess. The tool never reads a
credential environment variable, and the secret-hygiene proof in
`safe04.test.js` fails if any source or captured output ever carries
credential-shaped material.

## Milestone for live calls

Phase 10 (Read-Only Exact-SHA Preflight) is where the real `gh api` reads are
wired behind the unchanged interface, and it is the first phase allowed to talk
to GitHub at all. Because the production path now runs the full five-read seam,
that swap is a transport change only: no decision logic and no evidence builder
call site has to move. Phase 11 adds reconciliation, Phase 12 the CI/race
rehearsal and runbook, and Phase 13 the operator-confirmed live recovery.

---
*Phase: 09-release-close-contract-fixtures*
