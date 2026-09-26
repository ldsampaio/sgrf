# Phase 9: Release-Close Contract & Fixtures - Pattern Map

**Mapped:** 2026-09-25
**Files analyzed:** 10 (7 code/config + 7 fixtures counted as one group + test suites)
**Analogs found:** 6 / 10 (4 with no analog — all expected: `tools/` is a greenfield dir, confirmed absent on disk)

## File Classification

| New File | Role | Data Flow | Closest Analog | Match Quality |
|----------|------|-----------|----------------|---------------|
| `tools/release-close/package.json` | config | static | `backend/package.json` | role-match |
| `tools/release-close/release-close.js` | controller (CLI entry) | request-response | `start-dev.sh` | partial (operator-script precedent; different language/runtime) |
| `tools/release-close/eligibility.js` | service (pure) | transform | `backend/src/services/votingService.js` (`canVote`/`tally`) | exact |
| `tools/release-close/classify.js` | service (pure) | transform | `backend/src/services/votingService.js` (`tally`) | exact |
| `tools/release-close/client.js` | utility (interface contract) | request-response | *(none — first interface-seam file in repo)* | no-analog |
| `tools/release-close/fake-client.js` | utility (test double) | request-response | *(none — zero mocking precedent per TESTING.md)* | no-analog |
| `tools/release-close/gh-client.js` (stub) | service (stub) | request-response | *(none — no `child_process` usage anywhere in `backend/src`)* | no-analog |
| `tools/release-close/fixtures/*.json` (7 files) | config (test data) | static | *(none — no `fixtures/` dir anywhere in repo)* | no-analog |
| `tools/release-close/*.test.js` | test | batch | `backend/tests/unit.test.js` + `backend/tests/voting.test.js` | role-match (runner differs: `node:test` vs vitest) |

All analog paths verified git-tracked via `git ls-files` this session. No mirror paths emitted.

## Pattern Assignments

### `tools/release-close/package.json` (config, static)

**Analog:** `backend/package.json` (lines 1-13)

**Package declaration pattern** (lines 1-13):
```json
{
  "name": "sgrd-backend",
  "version": "0.1.1",
  "private": true,
  "type": "commonjs",
  "scripts": {
    "dev": "node src/server.js",
    "start": "node src/server.js",
    "migrate": "prisma migrate dev",
    "seed": "node prisma/seed.js",
    "seed:dev": "node prisma/seed.dev.js",
    "test": "vitest run"
  },
```

**What to copy:** Minimal top-level keys (`name`, `private: true`, `type`, `scripts`); scripts invoke `node` directly on a file path (no wrappers). **Invert** the `type` value: tool uses `"type": "module"` (D-02) vs backend's `"type": "commonjs"` (line 5). Zero `dependencies` key entirely — do not copy the backend dependency list (lines 14-31); D-02 forbids it. Suggested: `{ "name": "release-close", "private": true, "type": "module" }` with no `scripts` as primary contract (D-03: direct `node` invocation, no npm-script wrapper).

---

### `tools/release-close/release-close.js` (controller/CLI entry, request-response)

**Analog:** `start-dev.sh` (lines 1-24) — closest operator-facing precedent (fail-fast script, explicit `--flag` parsing, PT-BR messages).

**Shebang + fail-fast header pattern** (`start-dev.sh` lines 1-5):
```bash
#!/usr/bin/env bash
# SGRD — sobe backend (:3000) + frontend (:5173) para teste manual.
# Uso: ./start-dev.sh [--seed-dev] [--no-frontend] [--no-backend]
set -euo pipefail
```

**Hand-rolled flag parser pattern** (`start-dev.sh` lines 9-19):
```bash
for arg in "$@"; do
  case "$arg" in
    --seed-dev) SEED_DEV=1 ;;
    --no-backend) NO_BACKEND=1 ;;
    --no-frontend) NO_FRONTEND=1 ;;
    *) echo "Opção desconhecida: $arg (use --seed-dev, --no-backend, --no-frontend)"; exit 1 ;;
  esac
done
```

**Precondition-guard pattern** (`start-dev.sh` line 21):
```bash
need() { command -v "$1" >/dev/null 2>&1 || { echo "Faltando: $1"; exit 1; }; }
```

**What to copy:** Hand-rolled `case`-style flag parsing over `--help/--json/--yes/--repo/--version/--sha` (no arg library — D-02); unknown-flag → usage message on stderr + non-zero exit; precondition checks before action; PT-BR user-facing messages (D-12). Translate to Node ESM (`process.argv.slice(2)`, `process.exitCode`), preserving the fail-fast shape. No `child_process` analog exists in `backend/src` (grep confirmed zero matches) — the `execFile('gh', argvArray)` form and the `node:readline` TTY double-lock come from RESEARCH.md Code Examples, not from codebase precedent; mark as such in PLAN.md.

---

### `tools/release-close/eligibility.js` (service/pure, transform)

**Analog:** `backend/src/services/votingService.js` — `canVote` (lines 10-26) + `tally` (lines 29-49) + `validateVoteInput` (lines 51-57).

**Pure-guard returning data, not throwing** (lines 10-26):
```js
function canVote(user, request, existingVotes) {
  if (isSuspended(request)) return { ok: false, code: 423, error: 'Solicitação suspensa — somente leitura' };
  if (request.status !== 'EM_VOTACAO' && request.status !== 'AGUARDANDO_DESEMPATE') {
    return { ok: false, code: 400, error: 'Votação não está aberta' };
  }
  ...
  if (!ELIGIBLE.includes(user.role)) return { ok: false, code: 403, error: 'Sem elegibilidade para votar' };
  ...
  return { ok: true };
}
```

**Pure classifier with stable string outcome codes** (lines 29-49):
```js
// Maioria simples dos válidos, sem quórum. Abstenção ignora.
function tally(votes) {
  const valid = votes.filter((v) => v.voteType !== 'ABSTER_SE');
  ...
  if (total === 0) return { outcome: 'SEM_VOTOS', defer, indefer, parcial };
  if (defer > indefer + parcial) return { outcome: 'DEFERIDO', defer, indefer, parcial };
  ...
  return { outcome: 'EMPATE', defer, indefer, parcial };
}
```

**Throw reserved for invalid input only** (lines 51-57):
```js
function validateVoteInput({ voteType, comment, approvedAmountCents }) {
  if (!VALID.includes(voteType)) throw new Error('Tipo de voto inválido');
  if (voteType === 'DEFERIR_PARCIALMENTE') {
    if (!comment) throw new Error('Voto parcial exige comentário');
    ...
  }
}
```

**What to copy:** Early-return guard chain, each branch returning a data object `{ ok/eligible, code, reason/error }` with PT-BR reason strings; stable EN string codes as the machine surface; `throw` only in input validators (`TypeError` on bad shapes — D-11). Adapt shape to D-11: `{ eligible, code, reason, writeAction: null }` — note the deliberate divergence from backend's `Object.assign(new Error(...), { status })` domain-error style (CONTEXT explicitly forbids it here). ESM `export` instead of `module.exports` (line 144). Small focused functions, one decision per function (D-09).

---

### `tools/release-close/classify.js` (service/pure, transform)

**Analog:** `backend/src/services/votingService.js` — `tally` (lines 29-49, excerpt above).

**What to copy:** Same pure-classifier shape as `tally`: filter → count/compare → return `{ outcome/code, ...counts }` with the code drawn from a closed string set. Here the closed set is the six state codes (`MISSING`, `PARTIAL`, `DUPLICATE`, `CONFLICTING`, `FAILED`, `CONCURRENT` — D-10), mirroring `tally`'s outcome vocabulary (`SEM_VOTOS`/`DEFERIDO`/`INDEFERIDO`/`PARCIAL`/`EMPATE`). Keep `classify` independent of `eligibility` (separate module, separate import in tests — D-09), exactly as `tally` is independently imported in tests (`backend/tests/voting.test.js` line 3 imports `tally` standalone). Return-data contract identical to `eligibility.js` (`{ eligible, code, reason, writeAction: null }` family).

**Validator precedent for input checks:** `backend/src/utils/helpers.js` (lines 9-13):
```js
function toCents(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) throw new Error('Valor monetário inválido');
  return Math.round(n * 100);
}
```
Copy this shape for the full-40-hex SHA / `owner/repo` / `vX.Y.Z` validators RESEARCH.md requires: coerce → strict check → `throw new Error` with PT-BR message on invalid. These are the only sanctioned `throw` sites (D-11).

---

### `tools/release-close/*.test.js` (test, batch)

**Analog:** `backend/tests/unit.test.js` (lines 1-28) for pure-function suites + `backend/tests/voting.test.js` (lines 1-24) for naming convention.

**Imports + suite shape** (`unit.test.js` lines 1-9):
```js
import { describe, it, expect } from 'vitest';
import { isInstitutionalEmail, normalizeEmail, toCents } from '../src/utils/helpers.js';
import { calcAmount } from '../src/services/requestService.js';

describe('auth domain', () => {
  it('aceita @utfpr.edu.br', () => expect(isInstitutionalEmail('A@UTFPR.EDU.BR')).toBe(true));
  it('rejeita externo', () => expect(isInstitutionalEmail('a@gmail.com')).toBe(false));
  it('normaliza', () => expect(normalizeEmail('A@Utfpr.Edu.Br ')).toBe('a@utfpr.edu.br'));
});
```

**Pure-tally test naming** (`voting.test.js` lines 7-24):
```js
describe('votação tally (sem quórum, maioria simples)', () => {
  it('deferido vence', () => {
    expect(tally([...]).outcome).toBe('DEFERIDO');
  });
  it('abstenção ignora', () => { ... });
  it('empate detectado', () => { ... });
  it('sem votos', () => {
    expect(tally([]).outcome).toBe('SEM_VOTOS');
  });
```

**What to copy:** `describe('<domínio>', ...)` + short lowercase PT-BR `it` names (`'empate detectado'`, `'aceita @utfpr.edu.br'`); direct import of pure functions and assertion on the returned outcome/code field; throw-assertion style `expect(() => f(...)).toThrow('...')` for validator tests (`unit.test.js` lines 22-27). **Invert** the runner import: `import { describe, it } from 'node:test'` + `import assert from 'node:assert/strict'` (D-06) instead of `from 'vitest'`; assertions become `assert.equal(...)`. Do NOT copy DB-backed patterns (`voting.test.js` lines 26+: `PrismaClient`, `beforeAll` user creation, `supertest` app harness at lines 1208+) — the tool suite is fixture/fake-only with frozen data (D-07/D-08). Fixture loading pattern comes from RESEARCH.md (`readFileSync(new URL('./fixtures/x.json', import.meta.url))`), no codebase precedent.

---

## Shared Patterns

### Secret hygiene (applies to: `release-close.js`, `gh-client.js` stub, `fake-client.js`)
**Source:** `backend/src/config/logger.js` (lines 1-8)
```js
const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  redact: ['req.headers.cookie', 'password', 'pass', 'SMTP_PASS', 'token'],
});
```
Tool equivalent: never read `GH_TOKEN`/`GITHUB_TOKEN`, never pass `--verbose` to `gh`, never log headers/env (RESEARCH Pitfall 7). Enforce with a banned-token grep test (`GH_TOKEN`, `Authorization`, `--verbose`) — planner to fix exact token list.

### No-mutation / fail-closed posture (applies to: all tool modules + tests)
**Source:** `backend/src/services/votingService.js` — idempotent early-return (lines 60-63):
```js
async function closeVoting(requestId, performedBy = 'system') {
  const r = await prisma.resourceRequest.findUnique({ where: { id: requestId } });
  if (!r) throw Object.assign(new Error('Não encontrado'), { status: 404 });
  if (['APROVADO', 'APROVADO_PARCIALMENTE', 'INDEFERIDO'].includes(r.status)) return r; // idempotente
```
Copy the *posture* (terminal-state early return, refusal before action), not the mechanism: tool returns `{ eligible: false, code, reason, writeAction: null }` + `mutations: 0` instead of DB idempotency. Every `verify`/`plan` test asserts `mutations === 0` and zero write calls (D-16).

### PT-BR human / EN machine split (applies to: `eligibility.js`, `classify.js`, `release-close.js` output, test names)
**Source:** `votingService.js` PT-BR error strings (`'Solicitação suspensa — somente leitura'`, `'Sem elegibilidade para votar'`) + EN outcome codes (`'EMPATE'`, `'SEM_VOTOS'`); test names in PT-BR (`unit.test.js`, `voting.test.js`).
Tool rule (D-12): reasons in PT-BR, codes in EN (`MISSING`, `SAFE-02`, …).

## No Analog Found

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| `tools/release-close/client.js` | utility (interface) | request-response | First injected-client seam in repo; no interface-definition file exists. Planner: use RESEARCH.md Pattern 1 (`{ getTagRef, getTagObject, getBranchHead, getReleaseByTag, listMilestones }` returning `{ ok, status, data }`) |
| `tools/release-close/fake-client.js` | utility (test double) | request-response | Zero mocking precedent (TESTING.md); no in-memory fake exists. Planner: use RESEARCH.md Pattern 3 (scripted sequences + call log + write counter) |
| `tools/release-close/gh-client.js` (stub) | service (stub) | request-response | No `child_process`/`execFile` usage in `backend/src` (grep-verified). Planner: stub throws `TODO(Phase 10)`; real impl uses `execFile('gh', [...])` argv-array form per RESEARCH.md |
| `tools/release-close/fixtures/*.json` | config (test data) | static | No `fixtures/` dir; backend tests use inline literals. Planner: use RESEARCH.md fixture layout (reference + 6 state files, frozen canonical SHAs/IDs from CONTEXT §Integration Points) |

## Metadata

**Analog search scope:** `backend/src/services/`, `backend/src/config/`, `backend/src/utils/`, `backend/tests/`, `backend/package.json`, `start-dev.sh`, `backend/docker-entrypoint.sh`, `tools/` (confirmed nonexistent), grep for `child_process|execFile|readline|isTTY` across `backend/src` (zero hits)
**Files scanned:** ~12 candidates; 5 strong analogs read in full (one Read each, no re-reads)
**Pattern extraction date:** 2026-09-25
