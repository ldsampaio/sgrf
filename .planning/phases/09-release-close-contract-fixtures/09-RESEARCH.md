# Phase 9: Release-Close Contract & Fixtures - Research

**Researched:** 2026-09-25
**Domain:** Deterministic Node.js operator CLI (verify/plan/apply) over `gh` CLI subprocess + pure eligibility/classification contract proven by `node:test` fixtures
**Confidence:** HIGH

## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-01:** Tool lives in `tools/release-close/` (new top-level directory), invoked directly as `node tools/release-close/release-close.js <verify|plan|apply> ...` with `--help` — **Reversibility:** costly — Fase 12 runbook, docs, and any CI references will quote this path; moving it later means updating the operator procedure
- **D-02:** The tool directory carries its own `package.json` with `"type": "module"` and zero `dependencies` — keeps the ESM tool isolated from the CommonJS backend (`backend/package.json` is `type: commonjs`) with no new npm package, workspace, or hosted publisher
- **D-03:** No npm-script wrapper as the primary contract — the documented invocation is the direct `node` path so the contract is explicit and versionable
- **D-04:** The tool talks to GitHub exclusively by shelling out to the `gh` CLI subprocess, reusing the operator's existing login/token/permissions — no direct HTTPS client, no new secret handling, no `GH_TOKEN` plumbing in this phase
- **D-05:** Scenario fixtures are versioned JSON files under `tools/release-close/fixtures/` (one per state: missing, partial, duplicate, conflicting, failed, concurrent), not inline literals — **Reversibility:** costly — downstream phases and tests will import these files by path; restructuring means rewriting the fixture suite
- **D-06:** The tool's suite runs on `node:test` (`node --test`), never on the backend's vitest — zero dependencies, runs on any Node 22 checkout, per the roadmap success criteria
- **D-07:** GitHub API is mocked with a programmable in-memory fake client (scripted response sequences: timeouts, lost responses, `409`/`422`/`429`, server failures) rather than per-function stubs, so retry / re-read / ordering behavior is observable without network
- **D-08:** Determinism rule: everything frozen — fixed timestamps, full SHAs, canned run/job/check IDs in fixtures; no real clock or network in the suite
- **D-09:** The pure contract is split into focused pure functions (ref eligibility check, state classification — not one monolithic evaluator), each independently testable — **Reversibility:** costly — the module split becomes the planner's file structure and the tests' import surface
- **D-10:** The six states are represented as stable string codes (`MISSING`, `PARTIAL`, `DUPLICATE`, `CONFLICTING`, `FAILED`, `CONCURRENT`) carried in the decision object and referenced by output and tests — never loose booleans
- **D-11:** Domain mismatches (SHA divergence, absent tag, failed checks) are returned as data in the decision object (`{ eligible, reason, writeAction: null }` shape family); `throw` is reserved for invalid inputs only — keeps the tool fail-closed without accidental try/catch swallowing
- **D-12:** Human-facing reasons in PT-BR (matching repo convention: tests and controller errors are Portuguese); machine codes in EN (`MISSING`, `SAFE-02`, …) for stability and runbook reference
- **D-13:** `verify` and `plan` print human-readable text by default with a `--json` flag for machine/runbook evidence (the full structured-evidence shape of OPS-03 lands in Phase 12; Phase 9 only fixes text-default + `--json` availability)
- **D-14:** `apply` requires BOTH a `--yes` flag AND an interactive TTY confirmation prompt with the plan visible; non-TTY without `--yes` refuses — two independent locks, so a stray `--yes` in a script can never approve an unseen plan — **Reversibility:** costly — Phase 13's live procedure depends on this double-lock; weakening it later invalidates the safety case
- **D-15:** The displayed plan lists ordered steps (what will be created vs. adopted, in which order, against which SHAs/IDs) — the operator reviews exactly what `apply` would do, previewing the Phase 11 recovery order
- **D-16:** Every `verify`/`plan` output carries a `mutations: 0` counter, and the fixture suite asserts zero writes escaped (fails if any write path executes) — the no-mutation guarantee is executable proof, not a code convention

### the agent's Discretion
- Internal module/file split inside `tools/release-close/` (e.g. `eligibility.js`, `classify.js`, `fake-client.js`, CLI arg parsing style), exact `--json` field names beyond `mutations`, exit-code numbering, and fixture JSON schema details — researcher/planner decide, guided by the decisions above
- Whether the fake client also records a call log for ordering assertions (recommended) vs. state-only — planner's choice

### Deferred Ideas (OUT OF SCOPE)
None — discussion stayed within phase scope.

## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| OPS-01 | Checked-in Node 22 ESM release-close tool with `verify`, `plan`, `apply` modes, existing `gh` auth, no npm package/hosted service | Standard Stack (zero-dep ESM layout, `gh api` subprocess seam); Architecture Patterns (CLI skeleton, execFile argv, TTY double-lock); Environment Availability (gh 2.101.0 + Node present) |
| OPS-02 | Pure reconciliation logic covered by deterministic `node:test` fixtures + mocked API scenarios for missing/partial/duplicate/conflicting/failed/concurrent states | Standard Stack (node:test discovery + ESM probe); Architecture Patterns (fake-client DI seam, six-code taxonomy, fixture layout); Validation Architecture (Wave 0 suite map) |
| SAFE-02 | Requires existing annotated tag whose peeled commit equals remote `main` and supplied full target SHA; no ref-write path | Architecture Patterns (peel algorithm via `gh api` git refs+tags endpoints); Code Examples (eligibility skeleton); Pitfalls (lightweight-vs-annotated, no POST/PATCH/DELETE in tool surface) |
| SAFE-04 | `verify`/`plan` mutation-free; `apply` requires reviewed content, displayed plan, explicit confirmation | Architecture Patterns (mutations counter, double-lock); Code Examples (apply gate); Pitfalls (TTY spoofing, `--yes` in scripts) |

## Summary

Phase 9 builds a brand-new, zero-dependency Node 22 ESM CLI at `tools/release-close/` that shells out to the operator's existing `gh` CLI and proves — entirely against versioned JSON fixtures and a programmable in-memory fake client — that `verify`/`plan` never mutate and `apply` cannot proceed without reviewed content, a displayed ordered plan, and two independent operator confirmations. The pure decision contract (tag-eligibility + six-state classification) is split into small independently testable functions that return domain mismatches as data and expose no ref-write or destructive tag path whatsoever.

All building blocks were verified hands-on this session: `node:test` with ESM `import` syntax and JSON fixtures passes under a zero-dependency `{"type": "module"}` package (local probe green); `gh` 2.101.0 is installed and its `api` subcommand supports the exact flags the tool needs (`--method`, `--jq`, `--paginate`, `--input`); `gh` has **no** `milestone` subcommand so Milestone reads must go through `gh api repos/{owner}/{repo}/milestones`; and the local `v0.1.1` tag is confirmed annotated peeling to the canonical commit. The single most consequential design finding is the client-seam shape: pure functions must accept an injected `client` object and never parse `gh` stderr text, so Phase 10 can swap fake → real `gh` subprocess without touching any pure logic.

**Primary recommendation:** Build `tools/release-close/` as zero-dependency ESM with an injected async `client` seam (fake in Phase 9, `gh`-backed in Phase 10), pure `eligibility.js` + `classify.js` returning `{ eligible, code, reason, writeAction: null }` data objects, six JSON fixtures under `fixtures/`, a `mutations: 0`-carrying text-default/`--json` output, and a double-locked `apply` (`--yes` AND TTY prompt) — all proven by scoped `node --test "tools/release-close/*.test.js"` runs.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Tag-peel eligibility decision (SAFE-02) | API / Backend (pure logic in tool) | — | Pure function over snapshot data; no UI, no server |
| Six-state classification (OPS-02) | API / Backend (pure logic in tool) | — | Deterministic mapping from evidence snapshot → code |
| `verify` / `plan` / `apply` CLI UX | Operator workstation (CLI tool) | — | Locally invoked Node script, not a service |
| GitHub state reads (future Phase 10) | Operator workstation → GitHub API via `gh` subprocess | — | `gh` CLI owns auth; tool owns parsing/decisions |
| Fixture + fake-client suite | Operator workstation (node:test) | — | Zero-network deterministic tests |
| Secret handling | `gh` CLI (existing auth surface) | — | Tool must never read, log, or plumb tokens |

## Project Constraints (from AGENTS.md)

- Two packages, **no workspaces** — `tools/release-close/package.json` must be standalone (zero `dependencies`); never add a root workspace that would rope it into backend/frontend installs.
- **No lint/typecheck configured** — do not invent `lint`/`typecheck` scripts or CI steps; verification is `node --test "tools/release-close/*.test.js"` (new) alongside existing `cd backend && npx vitest run` and `cd frontend && npm run build`.
- **Never commit** `backend/.env`, `*.db*`, `backend/uploads/*` — irrelevant to this phase (no backend changes), but new fixture/test files must not accidentally sweep secrets; fixtures contain only public GitHub IDs/SHAs.
- **Money-as-cents, UUID strings, no raw SQL** — not used by this tool; planner must not introduce backend conventions into the tool.
- **CI gate** (`.github/workflows/ci.yml` jobs `backend` + `frontend` required on `main`) — Phase 9 should avoid editing `ci.yml` (see Open Questions); at minimum it must not break or rename the two required jobs.
- **Docs of record** for voting/approval rules (`docs/`, `backend/openapi.yaml`) — untouched by this phase.

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Node.js built-in `node:test` | Node 22 (CI) / 26.10.0 (local) [VERIFIED: local `node --version`] | Test runner: `describe`/`it`/`beforeEach`, TAP/spec reporters, exit-code-1-on-failure | Zero-dependency runner, stable API (Stability 2) [CITED: https://nodejs.org/api/test.html]; ESM `import { describe, it } from 'node:test'` probed green this session [VERIFIED: local probe] |
| Node.js built-in `node:assert/strict` | same | Deep/strict assertions in tests | Pairs with `node:test`; no assertion library needed |
| Node.js built-in `node:child_process` (`execFile`/`execFileSync`) | same | Spawning `gh` with argv array (no shell) | Only subprocess API that avoids shell-injection when repo/version/SHA args are interpolated [ASSUMED — standard practice; planner must enforce argv-array form] |
| Node.js built-in `node:readline` | same | Interactive TTY confirmation prompt for `apply` | Zero-dep prompt; combined with `process.stdin.isTTY` double-lock |
| Node.js built-in `node:fs` + `node:path` + `import.meta.url` | same | Loading versioned JSON fixtures relative to the tool dir | Deterministic fixture resolution independent of CWD |
| `gh` CLI (`gh api` subcommand) | 2.101.0 locally [VERIFIED: `gh --version`]; CI runners pin their own | Authenticated GitHub reads (Phase 10 wiring); contract target in Phase 9 | Existing operator auth surface per D-04; `gh api` gives GET-by-default, `--method`, `-F/--field`, `--input`, `-q/--jq`, `--paginate` [VERIFIED: local `gh api --help`; CITED: https://cli.github.com/manual/gh_api] |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| Local `git` (read-only plumbing: `rev-parse`, `cat-file -t`) | system git | Cross-checking tag annotation/peel shape while authoring the reference fixture | Fixture authoring only — the tool itself uses `gh api`, never local git, as remote truth |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `node:test` | Backend's vitest | Rejected per D-06: vitest lives in `backend/` (CJS package, DB-backed suites); tool must run dependency-free on any Node 22 checkout |
| `gh api` subprocess | `gh release view/create` porcelain | Porcelain is human-formatted and lacks Milestones entirely (`gh milestone` does not exist [VERIFIED: local]); `gh api` returns stable JSON for both releases and milestones |
| `gh api` subprocess | Direct HTTPS (`fetch`) + `GH_TOKEN` | Rejected per D-04: duplicates auth handling, introduces secret plumbing and token-leak surface |
| Hand-rolled minimal arg parser | `commander`/`yargs` | Rejected: any arg library violates the zero-`dependencies` lock (D-02); the flag surface (`--help/--json/--yes/--repo/--version/--sha`) is small enough to parse by hand safely |
| `exec` (shell string) | `execFile` (argv array) | `exec` is a command-injection hole the moment `--repo`/`--version` values are interpolated — never use it |

**Installation:**
```bash
# Nothing to install. The tool is zero-dependency by design (D-02):
#   tools/release-close/package.json  ->  { "type": "module" } + zero "dependencies"
# Run directly:  node tools/release-close/release-close.js verify --help
# Test:          node --test "tools/release-close/*.test.js"
```

**Version verification:** No npm/PyPI/crates packages are recommended — the stack is Node builtins + the preinstalled `gh` CLI, so registry verification is inapplicable. Toolchain versions confirmed on this machine: Node `v26.10.0`, `gh` `2.101.0` [VERIFIED: local `node --version` / `gh --version`]; CI pins Node 22 [VERIFIED: .github/workflows/ci.yml:36-38].

## Package Legitimacy Audit

Not applicable — this phase installs **zero** external packages by locked decision (D-02: zero `dependencies`). No `npm install` runs, no new registry surface, no postinstall risk.

| Package | Registry | Age | Downloads | Source Repo | Verdict | Disposition |
|---------|----------|-----|-----------|-------------|---------|-------------|
| *(none — builtins + gh CLI only)* | — | — | — | — | — | — |

**Packages removed due to [SLOP] verdict:** none
**Packages flagged as suspicious [SUS]:** none

## Architecture Patterns

### System Architecture Diagram

```
Operator
   │  node tools/release-close/release-close.js <verify|plan|apply> [--json] [--yes]
   ▼
┌──────────────────────── tools/release-close/ ────────────────────────┐
│  release-close.js (CLI: parse args, --help, text/--json render,      │
│                   TTY double-lock for apply, exit codes)              │
│       │                                           │                   │
│       ▼ (reads only)                              ▼ (reads only)      │
│  eligibility.js (pure)                       classify.js (pure)       │
│   tagAnnotated? ──► peel==main? ──► peel==SHA?    snapshot ──► one of  │
│   returns { eligible, code,         MISSING|PARTIAL|DUPLICATE|        │
│             reason(PT-BR),          CONFLICTING|FAILED|CONCURRENT     │
│             writeAction: null }     + writeAction: null               │
│       │                                           │                   │
│       └───────────────┬───────────────────────────┘                   │
│                       ▼                                               │
│  client seam (injected): { getTagRef, getTagObject, getBranchHead,    │
│     getReleaseByTag, listMilestones, ... } → plain JSON data          │
│       ▲                                               │               │
│       │ Phase 9                        Phase 10 swaps │ without       │
│  fake-client.js                        touching pure  ▼               │
│   scripted sequences                     logic     gh-client.js       │
│   (timeouts, 409/422/429, \u2500────────── (execFile 'gh api …',      │
│    lost responses) + call log                      parse stdout JSON) │
│   + mutations counter                                                 │
└───────────────────────────────────────────────────────────────────────┘
   Phase 9: everything above runs on fixtures/fakes — NO network,
   NO gh spawn in the suite, every verify/plan output carries mutations: 0.
```

Trace the primary case: operator runs `verify` → CLI parses args → calls pure `eligibility` + `classify` with data from the injected client (fake in tests) → prints text (or `--json`), `mutations: 0`, exits 0/non-zero by code. `apply` additionally renders the ordered plan, demands `--yes` AND a TTY `sim/não` confirmation, and refuses otherwise — with zero write paths existing anywhere in Phase 9 code.

### Recommended Project Structure
```
tools/release-close/
├── package.json          # { "type": "module" }, zero dependencies (D-02)
├── release-close.js      # CLI entry: arg parse, --help, render, apply double-lock, exit codes
├── eligibility.js        # pure: annotated-tag peel == main == expected SHA (SAFE-02)
├── classify.js           # pure: snapshot -> MISSING|PARTIAL|DUPLICATE|CONFLICTING|FAILED|CONCURRENT
├── client.js             # client interface definition (shape + error contract for fakes/real)
├── fake-client.js        # programmable in-memory fake: scripted sequences + call log + write counter
├── gh-client.js          # STUB in Phase 9 (shape only / throws "not wired until Phase 10") [planner's choice: stub vs omit]
├── fixtures/
│   ├── reference.json    # happy-path: live v0.1.1 baseline (peeled==main==expected, green runs, missing Release/Milestone)
│   ├── missing.json
│   ├── partial.json
│   ├── duplicate.json
│   ├── conflicting.json
│   ├── failed.json
│   └── concurrent.json
└── *.test.js             # node:test suites (Portuguese it-names per repo convention)
```

### Pattern 1: Injected client seam (fake now, `gh` later)
**What:** Pure functions never spawn processes or touch network — they receive an async `client` object whose methods return plain data (`{ ok, status, data }` family) and record calls. Phase 9 ships `fake-client.js`; Phase 10 adds `gh-client.js` implementing the identical method shapes via `execFile('gh', ['api', ...])`.
**When to use:** Every read the contract needs (tag ref, tag object, branch head, release-by-tag, milestones list).
**Example:**
```js
// Source: pattern distilled from CONTEXT.md D-07/D-09 + gh api manual
// https://cli.github.com/manual/gh_api
export async function checkTagEligibility(client, { version, expectedSha }) {
  const ref = await client.getTagRef(version);          // 404 -> { ok:false, status:404 }
  if (!ref.ok) return { eligible: false, code: 'MISSING', reason: 'Tag ausente no remoto.', writeAction: null };
  // ... peel, compare, all returns carry writeAction: null
}
```

### Pattern 2: Return-data-not-throw for domain mismatches
**What:** Eligibility/classification return `{ eligible, code, reason, writeAction: null }`; `throw` only for programmer errors (invalid input shape, unknown fixture). Callers never wrap decisions in try/catch — fail-closed by data, not by exception.
**When to use:** All six state codes, SHA divergence, absent objects, failed checks.
**Example:**
```js
// Source: CONTEXT.md D-11
// { eligible: false, code: 'CONFLICTING', reason: '...', writeAction: null }
// throw new TypeError(...)  // reserved for: expectedSha is not a 40-hex string, etc.
```

### Pattern 3: Executable no-mutation proof (mutations counter + write-call trap)
**What:** Every decision/output object carries `mutations: <n>`; the fake client counts any write-method invocation (no write methods exist in Phase 9 — the counter exists to trap accidental ones) and `verify`/`plan` tests assert `mutations === 0` plus `fake.calls.write.length === 0`. A call log (recommended per agent's discretion) additionally asserts read ordering.
**When to use:** All `verify`/`plan` fixture runs; keep the counter in the `--json` shape so Phase 12 evidence inherits it.

### Pattern 4: Double-locked apply (flag AND TTY, plan visible)
**What:** `apply` proceeds only if `--yes` was passed AND `process.stdin.isTTY` is true AND the operator types confirmation at a prompt shown **after** the full ordered plan. Any missing lock → refuse with a PT-BR reason and a non-zero exit; non-TTY + `--yes` (piped script) refuses.
**When to use:** The `apply` path only. `verify`/`plan` never prompt.

### Anti-Patterns to Avoid
- **Parsing `gh` stderr text for control flow:** `gh` error wording is human-facing and version-dependent — the client seam must normalize to `{ ok, status, data }` (status from `--include` headers or exit mapping defined once in `gh-client.js`, Phase 10). Phase 9 fakes return the normalized shape directly.
- **`exec` with interpolated shell strings:** `exec(\`gh api ${repo}\`)` is command injection via `--repo`. Always `execFile('gh', ['api', path, ...])` [ASSUMED standard hardening — planner must enforce].
- **One monolithic evaluator:** forbidden by D-09 — split eligibility vs classification so tests import each independently.
- **Loose booleans / thrown domain errors:** forbidden by D-10/D-11 — codes and data objects only.
- **Real clock or network in the suite:** forbidden by D-08 — freeze timestamps/SHAs/IDs in fixtures; inject any "now" the logic needs.
- **Backend conventions leaking in:** no vitest imports, no CJS `require`, no Prisma — the tool dir is its own ESM island [VERIFIED: backend is `"type": "commonjs"` — backend/package.json:5].

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| GitHub auth + HTTP transport | Token handling, `fetch` wrapper, retry/backoff HTTP layer | `gh api` subprocess (existing login) | Auth, TLS, pagination, rate-limit headers already solved; custom HTTP adds secret-leak surface (D-04) |
| Test runner / assertions | Mini-framework, custom TAP emitter | `node:test` + `node:assert/strict` | Stable stdlib runner with exit-code-1-on-failure CI semantics [CITED: https://nodejs.org/api/test.html] |
| Interactive prompt | Raw `/dev/tty` handling | `node:readline` + `process.stdin.isTTY` | Handles non-TTY refusal and line input without native code |
| Tag peel math | Custom SHA/ref comparison logic beyond equality | Strict string equality: `peel === main && peel === expectedSha` (full 40-hex, reject abbreviations) | Any "closeness" logic reintroduces the abbreviated-SHA acceptance bug class; SAFE-01/Phase 10 owns validation detail |
| Milestone reads | Screen-scraping `gh` output | `gh api repos/{owner}/{repo}/milestones?state=all` JSON | No `milestone` subcommand exists in `gh` [VERIFIED: local `gh milestone --help` → unknown command] |
| Arg parsing library | `commander`/`yargs` dependency | ~40-line hand-rolled flag parser (allowed: it is not a *problem* library, it is the only zero-dep option) | D-02 forbids dependencies; surface is tiny (`--help/--json/--yes/--repo/--version/--sha`) |

**Key insight:** The zero-dependency lock inverts the usual advice: here hand-rolling the *small* things (flag parser, tiny validators) is mandatory, while hand-rolling the *hard* things (auth transport, test runner, HTTP retry) is forbidden — those stay with `gh` and the stdlib.

## Common Pitfalls

### Pitfall 1: Unscoped `node --test` sweeping backend vitest suites
**What goes wrong:** Running `node --test` from the repo root discovers `backend/tests/*.test.js`, which import `vitest` and need a database — they fail under the stdlib runner, looking like a Phase 9 regression.
**Why it happens:** `node --test <dir>` recursively runs test-pattern files; backend tests share the `*.test.js` suffix.
**How to avoid:** Always scope: `node --test "tools/release-close/*.test.js"`. Never add a root `test` script that sweeps. If CI ever runs the tool suite, point it at the tool dir only.
**Warning signs:** Failures mentioning `vitest` imports or `DATABASE_URL` when running tool tests.

### Pitfall 2: ESM/CJS boundary confusion
**What goes wrong:** `require()` in tool code, or a missing `tools/release-close/package.json`, silently resolves module system from the wrong `package.json` (repo root has none; `backend/` is CJS).
**Why it happens:** Node picks the nearest `package.json` — without the tool-local `{"type":"module"}`, `.js` defaults to CJS.
**How to avoid:** Ship `tools/release-close/package.json` first; use only `import`; resolve fixtures via `new URL('./fixtures/x.json', import.meta.url)`, never CWD-relative paths. Probe verified this exact layout green [VERIFIED: local probe].
**Warning signs:** `ReferenceError: require is not defined` or `__dirname is not defined` in tool code.

### Pitfall 3: Lightweight tag mistaken for annotated tag
**What goes wrong:** `getTagRef` returns `object.type === "commit"` (lightweight tag) and the tool treats `object.sha` as a peel — accepting a tag SAFE-02 forbids.
**Why it happens:** Both tag kinds resolve through `git/ref/tags/*`; only annotated tags have a second hop (`object.type === "tag"` → `GET git/tags/{sha}` → `object.sha`).
**How to avoid:** Eligibility requires the two-hop path: ref-type `tag` AND tag-object `object.sha` present; single-hop `commit` type → `eligible:false` with a dedicated reason (still `writeAction: null`). Reference fixture pins the annotated shape (tag object `0a68d6f0c55e7be07d13a0bbc4ed36d4af772630` → commit `10c62ac…` [VERIFIED: local `git cat-file -t v0.1.1` → `tag`, `git rev-parse 'v0.1.1^{commit}'` → `10c62ac85fd3ab275b8926c89f5f34ba4116e2cf`]).
**Warning signs:** Tests passing with a `type: "commit"` ref fixture and no tag-object hop.

### Pitfall 4: Ref-write or destructive tag path sneaking into the surface
**What goes wrong:** A `createTag`/`updateRef`/`delete` helper or `gh release delete`/`gh api -X PATCH/POST/DELETE` string appears anywhere in Phase 9 code, violating success criterion 3.
**Why it happens:** Copy-paste from Phase 11 rehearsal sketches or `gh` manual examples.
**How to avoid:** No write-method names on the client interface; no `POST/PATCH/PUT/DELETE` strings in `gh-client` arg construction (stub or omit it); add a grep-based test asserting banned tokens (`update-ref`, `delete`, `--method POST`, etc.) never appear in non-test sources. Planner decides exact token list.
**Warning signs:** Any `writeAction` value other than `null` in a fixture run.

### Pitfall 5: `--yes` in a script approving an unseen plan
**What goes wrong:** A cron/CI line with `--yes` auto-approves `apply` without a human seeing the plan.
**Why it happens:** Single-lock designs treat the flag as sufficient.
**How to avoid:** D-14 double-lock: `--yes` AND live TTY prompt with the plan printed above it; `!process.stdin.isTTY` → refuse even with `--yes`. In this sandbox `process.stdin.isTTY` is `undefined` (falsy) [VERIFIED: local probe] — the correct fail-closed behavior is refusal.
**Warning signs:** `apply` tests that pass `--yes` without stubbing a TTY and expect success.

### Pitfall 6: Fixture values drifting from the live baseline
**What goes wrong:** Hand-typed SHAs/IDs in fixtures diverge (truncated SHA, swapped run IDs), so the reference fixture no longer represents the real v0.1.1 evidence.
**Why it happens:** Manual transcription of 40-hex SHAs and 11-digit run IDs.
**How to avoid:** Canonical values (from CONTEXT/ROADMAP, cross-checked against local git this session): tag object `0a68d6f0c55e7be07d13a0bbc4ed36d4af772630`, commit `10c62ac85fd3ab275b8926c89f5f34ba4116e2cf`, green runs `36095855139` + `36095872529`, Release/Milestone absent. Freeze them verbatim in `reference.json`; full-SHA-only comparisons reject abbreviations.
**Warning signs:** Any 7-char SHA or mismatched run ID in a fixture diff.

### Pitfall 7: Token/secret leakage through output or logs
**What goes wrong:** Tool prints environment, `gh auth token` output, or `--verbose` traces containing `Authorization` headers.
**Why it happens:** Debug logging of raw subprocess results or env dumps.
**How to avoid:** Tool never reads `GH_TOKEN`/`GITHUB_TOKEN`, never passes `--verbose` to `gh`, never logs headers; follow the backend's pino-redaction precedent (`backend/src/config/logger.js` redacts cookie/password/token per CONTEXT). Keep a banned-token grep test for `GH_TOKEN`, `Authorization`, `--verbose`.
**Warning signs:** Any test snapshot containing `token`, `Bearer`, or `cookie`.

## Code Examples

Verified patterns from official sources:

### node:test ESM suite with JSON fixture (probed green this session)
```js
// Source: https://nodejs.org/api/test.html (describe/it aliases) + local ESM probe
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const fixture = (name) =>
  JSON.parse(readFileSync(new URL(`./fixtures/${name}.json`, import.meta.url)));

describe('elegibilidade de tag (SAFE-02)', () => {
  it('aceita tag anotada quando peel == main == SHA esperado', async (t) => {
    const snap = fixture('reference');
    const decisao = await checkTagEligibility(fakeClient(snap), {
      version: 'v0.1.1',
      expectedSha: '10c62ac85fd3ab275b8926c89f5f34ba4116e2cf',
    });
    assert.equal(decisao.eligible, true);
    assert.equal(decisao.writeAction, null);
  });
});
```

### Tag-peel read sequence via `gh api` (contract the fake mimics)
```bash
# Source: https://cli.github.com/manual/gh_api + https://docs.github.com/en/rest/git/refs
# 1. Resolve the ref. Annotated tag -> object.type == "tag"; lightweight -> "commit"; absent -> 404.
gh api 'repos/ldsampaio/sgrf/git/ref/tags/v0.1.1'
# 2. Only if type == "tag": peel to the commit. object.sha is the peeled commit.
gh api 'repos/ldsampaio/sgrf/git/tags/0a68d6f0c55e7be07d13a0bbc4ed36d4af772630' --jq '.object.sha'
# 3. Remote main head for comparison.
gh api 'repos/ldsampaio/sgrf/git/ref/heads/main' --jq '.object.sha'
# 4. Release-by-tag (404 == absent, no error): GET /repos/{owner}/{repo}/releases/tags/v0.1.1 [ASSUMED endpoint shape]
# 5. Milestones (gh has NO milestone subcommand [VERIFIED]): 
gh api 'repos/ldsampaio/sgrf/milestones?state=all' --jq '.[] | {number, title, state}'
```

### `gh`-backed client shape (Phase 10 target; Phase 9 fakes this interface)
```js
// Source: https://cli.github.com/manual/gh_api (GET default; --method override; --jq selection)
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
const runGh = promisify(execFile);

async function ghApi(path, { method = 'GET' } = {}) {
  const args = ['api', path, '--method', method];
  const { stdout } = await runGh('gh', args, { timeout: 30_000 }); // argv array, never shell string
  return JSON.parse(stdout);
}
// Phase 9 rule: only GET paths appear anywhere. No POST/PATCH/DELETE strings (see Pitfall 4).
```

### Apply double-lock gate (D-14)
```js
// Source: CONTEXT.md D-14 + node:readline docs pattern
import readline from 'node:readline';
async function confirmApply({ yesFlag, planText }) {
  console.log(planText); // plan ALWAYS visible before any prompt
  if (!yesFlag) return { confirmed: false, reason: 'Apply exige a flag --yes.' };
  if (!process.stdin.isTTY) return { confirmed: false, reason: 'Apply exige terminal interativo.' };
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  const answer = await new Promise((resolve) => rl.question('Confirmar apply? (sim/nao) ', resolve));
  rl.close();
  if (answer.trim().toLowerCase() !== 'sim') return { confirmed: false, reason: 'Apply cancelado pelo operador.' };
  return { confirmed: true };
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `node:test` experimental, TAP-only | Stable runner (Stability 2) with `describe`/`it`, spec/dot reporters, `--test-*` filters, mock timers | Stabilized across Node 20–22 | Safe to standardize the tool suite on it without a framework dep [CITED: https://nodejs.org/api/test.html] |
| Vitest-everything in repo | `node:test` for the zero-dep tool island, vitest stays for `backend/` | This phase (new convention, D-06) | Two runners coexist; invocations must stay scoped (Pitfall 1) |
| `gh release` porcelain for automation | `gh api` + `--jq` for machine reads | `gh` 2.x (long-standing) | Uniform JSON seam for releases AND milestones (which lack porcelain) |
| Single `--yes` approval gates | Flag + interactive TTY double-lock | This phase (D-14, costly reversibility) | Scripts cannot silently approve unseen plans |

**Deprecated/outdated:**
- `gh milestone *`: never existed — do not plan around it; Milestones go through `gh api .../milestones` [VERIFIED: local `gh milestone --help` → `unknown command "milestone"`].
- Backend `Object.assign(new Error(...), { status })` domain-error style: explicitly NOT followed here (D-11 return-data contract).

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `gh api` exits non-zero on HTTP 4xx/5xx with JSON-parseable or text stderr (so `gh-client.js` can map failures to `{ ok:false, status }`) | Architecture Patterns | MEDIUM — Phase 10 client must add `--include`-header parsing or status inference; Phase 9 unaffected (fakes return normalized shapes). Confirm by hitting one bad endpoint when network is available. |
| A2 | `GET /repos/{owner}/{repo}/releases/tags/{tag}` returns 404 when absent and the release object otherwise | Code Examples | LOW — endpoint is standard REST; Phase 10 verifies against live repo. Fixture encodes the assumed shape. |
| A3 | `GET /repos/{owner}/{repo}/git/tags/{sha}` returns `{ tag, sha, object: { sha, type } }` for annotated tags | Architecture Patterns (peel) | LOW — standard REST; the two-hop peel logic is correct regardless of extra fields. |
| A4 | CI runners (ubuntu-latest) preinstall `gh` with auth available, so a future CI-wired `node --test` + `gh --version` smoke step would work | Environment Availability | LOW — only matters if planner wires CI (Open Question 1); tool suite itself needs no network/auth. |
| A5 | Exact `--json` field names beyond `mutations`, exit-code numbering, and fixture JSON schema are planner's discretion (no upstream contract constrains them yet) | Architecture Patterns | LOW — Phase 12 runbook consumes whatever Phase 9 fixes; decision just needs recording. |
| A6 | `execFile('gh', [...])` argv-array form fully neutralizes `--repo`/`--version` injection (no shell involved) | Security Domain | LOW — standard Node semantics; still worth one negative test with `; rm -rf` style values. |

**If this table is empty:** n/a — six assumptions above need planner/disuss-phase disposition (A1–A3 by live verification in Phase 10; A4–A6 by planner decision now).

## Open Questions

1. **Should Phase 9 wire `node --test "tools/release-close/*.test.js"` into `.github/workflows/ci.yml`?**
   - What we know: AGENTS.md + PROJECT.md freeze existing CI commands; milestone constraint keeps `ci.yml` as regression authority with unchanged `backend`/`frontend` commands. A third job adds surface without changing existing commands, but any `ci.yml` edit risks the required-checks gate (`backend`, `frontend` contexts).
   - What's unclear: whether reviewers consider a new non-required job acceptable inside "CI unchanged".
   - Recommendation: Do NOT touch `ci.yml` in Phase 9 — verify via local `node --test` runs + commit evidence; revisit CI wiring in Phase 12 alongside the runbook. Planner: make this explicit in PLAN.md.

2. **Stub or omit `gh-client.js` in Phase 9?**
   - What we know: D-04/D-09 want the seam designed now so Phase 10 swaps fake → `gh` without touching pure logic; success criterion 3 forbids any ref-write/destructive path.
   - What's unclear: whether a checked-in stub (throwing "not wired until Phase 10") risks being mistaken for working code.
   - Recommendation: Check in `client.js` (interface + shape docs) + `fake-client.js`; make `gh-client.js` a stub that throws on any call with a `TODO(Phase 10)` marker, covered by a test asserting it throws. Explicit beats absent.

3. **Fake-client call log: ordering assertions or state-only?**
   - What we know: CONTEXT marks this planner's choice, recommends call log.
   - What's unclear: nothing material — low cost either way.
   - Recommendation: Record the call log (method + args + sequence number); assert read ordering (ref → tag-object → main → release → milestones) in at least the reference test. It costs ~15 lines and buys Phase 10/11 ordering guarantees.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js (ESM, `node:test`, `node:readline`) | Tool runtime + suite | ✓ | local 26.10.0; CI pins 22 [VERIFIED: local + ci.yml:36-38] | — (hard requirement; ubiquitous) |
| `gh` CLI | Contract target reads (Phase 10 wiring) | ✓ | 2.101.0 [VERIFIED: local] | None in-phase — Phase 9 needs no `gh` at all (fakes only); `gh auth status` check belongs to Phase 10/13 runbook |
| Network to api.github.com | None in Phase 9 | untested (deliberately unused) | — | Fixtures + fake client are the design, not a fallback |
| `git` local plumbing | Fixture authoring cross-checks | ✓ | system git (tag peel verified) | — |
| `jq` binary | Nothing (tool parses JSON in JS) | not checked | — | Not needed; never shell out to `jq` |

**Missing dependencies with no fallback:**
- None — Phase 9 is deliberately dependency-free (code, fixtures, and stdlib only).

**Missing dependencies with fallback:**
- None.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | `node:test` (stdlib, Node 22 per CI) + `node:assert/strict` |
| Config file | none — zero-dependency by design; invocation is the config |
| Quick run command | `node --test "tools/release-close/*.test.js"` |
| Full suite command | `node --test "tools/release-close/*.test.js"` (same; suite is seconds-scale, no DB/network) |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| OPS-01 | CLI exposes `verify`/`plan`/`apply` + `--help`; direct-`node` invocation; zero-dep package | CLI smoke (arg parse, help text, package.json asserts) | `node --test "tools/release-close/*.test.js"` | ❌ Wave 0 (no `tools/` dir yet [VERIFIED: local `ls`]) |
| OPS-02 | Six states classified from fixtures; scripted fake sequences (timeout/409/422/429) observable | unit (`node:test`, Portuguese `it` names) | `node --test "tools/release-close/*.test.js"` | ❌ Wave 0 |
| SAFE-02 | Annotated-tag peel == main == expected SHA accepted; every mismatch shape rejected; no ref-write path (grep test) | unit + negative static test | `node --test "tools/release-close/*.test.js"` | ❌ Wave 0 |
| SAFE-04 | `verify`/`plan` runs assert `mutations: 0` + zero write calls; `apply` refuses without `--yes`/TTY/plan-visible | unit (fake write-trap) + gate tests with stubbed TTY | `node --test "tools/release-close/*.test.js"` | ❌ Wave 0 |

### Sampling Rate
- **Per task commit:** `node --test "tools/release-close/*.test.js"`
- **Per wave merge:** `node --test "tools/release-close/*.test.js"` + `cd backend && npx vitest run` (prove no collateral damage; backend untouched)
- **Phase gate:** Full tool suite green + backend vitest green + `gh`-surface grep tests green before `/gsd-verify-work`

### Wave 0 Gaps
- [ ] `tools/release-close/package.json` — `{"type":"module"}`, zero deps (unblocks all ESM work)
- [ ] `tools/release-close/{release-close,eligibility,classify,client,fake-client}.js` — implementation surface
- [ ] `tools/release-close/fixtures/*.json` — reference + six state fixtures with frozen canonical values
- [ ] `tools/release-close/*.test.js` — `node:test` suites (PT-BR names) incl. banned-token grep test + mutations-zero assertions
- [ ] Framework install: none — stdlib only

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | Partial | No auth code in tool — delegates entirely to operator's `gh` login (D-04); tool must never read/require/emulate tokens |
| V3 Session Management | No | No sessions; single-shot CLI invocations |
| V4 Access Control | Partial | Double-lock `apply` (`--yes` + TTY) is the authorization gate for the future mutation path; insufficient-permission mapping deferred to Phase 10 (SAFE-01) |
| V5 Input Validation | Yes | Hand-rolled validators: full 40-hex SHA (reject abbreviations), `owner/repo` allowlist shape, `vX.Y.Z` version shape, `--yes` exact-match; `throw TypeError` on invalid inputs (only sanctioned `throw` site per D-11) |
| V6 Cryptography | No | No crypto code; tag-SHA comparisons are equality checks, not MAC verification |

### Known Threat Patterns for Node CLI + `gh` subprocess

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Command injection via `--repo`/`--version`/`--sha` into `gh` spawn | Tampering / Elevation | `execFile('gh', argvArray)` — never `exec` with string interpolation; negative test with metachar values (A6) |
| Silent auto-approval from scripts (`--yes` in cron/CI) | Elevation | Double-lock: `--yes` AND `isTTY` AND typed `sim` after visible plan; non-TTY refuses (D-14) |
| Credential/token disclosure in output or logs | Information disclosure | Never read `GH_TOKEN`/`GITHUB_TOKEN`, never pass `--verbose`, never log headers/env; banned-token grep test (Pitfall 7); follow `logger.js` redaction precedent |
| Accidental remote mutation from Phase 9 code | Tampering | No write methods on client interface; no POST/PATCH/DELETE strings; `mutations: 0` asserted on every `verify`/`plan` run; `writeAction: null` invariant |
| Fixture poisoning (malicious PR edits fixture SHAs to force a false eligible) | Tampering | Reference-fixture values reviewed against canonical baseline in PR; full-SHA equality means any edit fails closed unless it exactly matches live truth (which Phase 10+ re-reads live anyway) |

## Sources

### Primary (HIGH confidence)
- Local toolchain probes this session: `node --test` ESM + JSON-fixture probe (green), `node v26.10.0`, `gh 2.101.0`, `gh api --help` flags, `gh milestone` → `unknown command`, `process.stdin.isTTY` → falsy in pipe, `git cat-file -t v0.1.1` → `tag`, `git rev-parse 'v0.1.1^{commit}'` → `10c62ac85fd3ab275b8926c89f5f34ba4116e2cf`
- In-repo reads: `09-CONTEXT.md` (all D-decisions), `REQUIREMENTS.md` (OPS-01/02, SAFE-02/04 + traceability), `ROADMAP.md` (Phase 9 criteria + constraints), `PROJECT.md` (constraints/key decisions), `backend/package.json:5` (`"type": "commonjs"`), `.github/workflows/ci.yml` (jobs `backend`/`frontend`, Node 22)

### Secondary (MEDIUM confidence)
- https://nodejs.org/api/test.html — `describe`/`it` aliases, exit-code-1-on-failure, stability status [CITED]
- https://cli.github.com/manual/gh_api — `gh api` flags (`--method`, `-F/--field`, `--input`, `-q/--jq`, `--paginate`), `{owner}/{repo}` placeholders [CITED]
- https://docs.github.com/en/rest/git/refs — `GET git/ref/{ref}` shapes (`object.{type,sha}`, 404 on absent), create/update/delete ref endpoints (the write paths Phase 9 must NOT expose) [CITED]

### Tertiary (LOW confidence)
- `releases/tags/{tag}` 404-shape, `git/tags/{sha}` tag-object fields, `gh api` non-zero-exit-on-HTTP-error, ubuntu-runner `gh` preinstall — all [ASSUMED] (A1–A4), each with a named verification step in Phase 10.

## Metadata

**Confidence breakdown:**
- Standard Stack: HIGH — every tool probed locally or read from in-repo files + official docs fetched.
- Architecture: HIGH — driven by locked CONTEXT decisions; seam/fake/double-lock patterns follow directly from D-04/D-07/D-09/D-14.
- Pitfalls: HIGH — three verified hands-on (unscoped runner sweep risk, no-milestone-subcommand, isTTY-falsy fail-closed); rest derived from locked decisions.

**Research date:** 2026-09-25
**Valid until:** 2026-10-25 (stable domain: stdlib + `gh` CLI + frozen fixtures; re-check only if Node 22 CI pin or `gh` major changes)
