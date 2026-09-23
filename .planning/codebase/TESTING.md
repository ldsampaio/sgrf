---
last_mapped_commit: b3837b7e16bf00622f1be01d8316a0290affc7f6
last_mapped_at: 2026-09-23
---
# Testing Patterns

**Analysis Date:** 2026-09-22

## Test Framework

**Runner:**

- Vitest `^2.1.1` — **backend only** (devDependency in `backend/package.json`)
- Config: **none** — zero-config Vitest (no `vitest.config.*` or `vite.config.*` in `backend/`); defaults apply (files matching `tests/*.test.js`, Node environment)
- Assertion library: Vitest's built-in `expect` (`describe`/`it`/`expect` imported from `vitest`)
- Also installed but **unused**: `supertest ^7.0.0` in `backend/package.json` — no import of it exists anywhere in `backend/tests/`

**Run Commands:**

```bash
cd backend && npx vitest run    # run all tests (canonical command, per AGENTS.md)
cd backend && npm test          # same thing — script is "vitest run"
cd backend && npx vitest        # watch/interactive (no npm script defined)
cd backend && npx vitest run tests/unit.test.js   # single file
```

- Suites recognized by file: `unit`, `voting`, `batch` (the three files below).
- **Frontend has no tests**: `frontend/package.json` `"test"` is `echo "Error: no test specified" && exit 1` (fails on purpose). Verify frontend changes with `npm run build` (Vite build) instead.
- Coverage: **not configured** — `@vitest/coverage-*` is not installed, no `coverage` config. `npx vitest run --coverage` will prompt to install; treat coverage as unavailable unless the dependency is added first.
- There is no CI (`.github/workflows` absent) and no lint/typecheck step — tests are the only automated gate.

## Test File Organization

**Location:**

- Separate directory `backend/tests/` (not co-located with source). Frontend has no test directory.

**Naming:**

- `<topic>.test.js`, lowercase: `backend/tests/unit.test.js`, `backend/tests/voting.test.js`, `backend/tests/batch.test.js`

**Structure:**

```
backend/
├── src/            # production code (CommonJS require)
└── tests/          # flat — one file per domain topic
    ├── unit.test.js    # auth domain + financial calculation
    ├── voting.test.js  # vote tally rules
    └── batch.test.js   # bulk user import parsing/validation
```

## Test Structure

**Suite Organization:** One `describe` per domain concept, written in Portuguese; one `it` per rule from `docs/03-regras-de-negocio.md` / `docs/12-testes.md`, terse one-liners with arrange-act-assert inline:

```javascript
import { describe, it, expect } from 'vitest';
import { isInstitutionalEmail, normalizeEmail, toCents } from '../src/utils/helpers.js';
import { calcAmount } from '../src/services/requestService.js';

describe('auth domain', () => {
  it('aceita @utfpr.edu.br', () => expect(isInstitutionalEmail('A@UTFPR.EDU.BR')).toBe(true));
  it('rejeita externo', () => expect(isInstitutionalEmail('a@gmail.com')).toBe(false));
});
describe('financeiro', () => {
  it('viagem USD congela taxa', () => {
    const r = calcAmount('VIAGEM', { dailyCount: 1, dailyRate: 100, passageAmount: 0, currency: 'USD' }, 5.0);
    expect(r.requestedAmountCents).toBe(50000);
    expect(r.exchangeRate).toBe(5.0);
  });
});
```

(`backend/tests/unit.test.js:1-21`)

**Patterns:**

- Tests are **ESM `import`** even though `backend/src` is CommonJS — Vitest transpiles; import source with explicit relative paths and `.js` extension: `import { tally } from '../src/services/votingService.js'` (`backend/tests/voting.test.js:2`).
- Test names are the acceptance criteria in Portuguese (`'empate detectado'`, `'rejeita JSON inválido'`, `'detecta duplicado do banco'`) — mirror the bullet list in `docs/12-testes.md` when adding tests.
- **No setup/teardown** — there are zero `beforeEach`/`afterEach`/`beforeAll` hooks in `backend/tests/`. Only pure, DB-free functions are tested, so nothing needs resetting.

## Mocking

**Framework:** None in use — no `vi.mock`, no stubs, no spies anywhere in `backend/tests/`.

**Patterns:**

```javascript
// Current approach: pick testable pure functions so no mocking is needed.
import { tally } from '../src/services/votingService.js';
it('sem votos', () => expect(tally([]).outcome).toBe('SEM_VOTOS'));
```

(`backend/tests/voting.test.js:14-16`)

**What to Mock:**

- If you must test controller/route code: mock the Prisma client `backend/src/config/db` with `vi.mock('../src/config/db', ...)` and stub `audit`/`enqueue` — but this pattern does not yet exist in the repo; introduce it carefully and keep it consistent across files.

**What NOT to Mock:**

- Pure domain helpers (`backend/src/utils/helpers.js`, `calcAmount` in `backend/src/services/requestService.js`, `tally` in `backend/src/services/votingService.js`, `parseBatch`/`validateBatch` in `backend/src/utils/batchUsers.js`) — test them directly, always.
- Do not mock the logger or env config for unit tests.

## Fixtures and Factories

**Test Data:**

```javascript
// Inline literals inside the it() block — no external fixture files
const arr = [
  { name: 'Ok', email: 'ok@utfpr.edu.br', role: 'PROFESSOR' },
  { name: 'X',  email: 'x@gmail.com',     role: 'PROFESSOR' },
];
const r = validateBatch(arr, new Set());
expect(r.summary.valid).toBe(1);
```

(`backend/tests/batch.test.js:11-20`)

Also used: buffers as input fixtures — `Buffer.from('nao json')` (`backend/tests/batch.test.js:6`), vote arrays — `[{ voteType: 'DEFERIR' }, ...]` (`backend/tests/voting.test.js:6`).

**Location:**

- No `fixtures/`, `factories/`, or `__mocks__/` directories exist. Keep building data inline; if a fixture grows past ~10 lines shared by multiple tests, add `backend/tests/fixtures/<name>.js` (new convention — no precedent yet).

## Coverage

**Requirements:** None enforced — no coverage threshold, no coverage tooling installed, no CI to gate on.

**View Coverage:**

```bash
cd backend && npx vitest run --coverage   # requires installing @vitest/coverage-v8 first
```

(Not currently runnable as-is; add the dev dependency before relying on this.)

**Current de-facto coverage** (what the 3 test files touch vs. what exists):

- Tested: `backend/src/utils/helpers.js`, `backend/src/services/requestService.js` (`calcAmount` only), `backend/src/services/votingService.js` (`tally` only), `backend/src/utils/batchUsers.js`
- Untested: all of `backend/src/controllers/`, `backend/src/routes/`, `backend/src/middlewares/`, `backend/src/services/auditService.js`, `backend/src/services/emailService.js`, `backend/src/jobs/votingCloser.js`, all Prisma/seed code, and **entirely** `frontend/src/`

## Test Types

**Unit Tests:**

- The only type present. Scope: pure functions with no I/O — email normalization, money-to-cents conversion, per-type amount calculation, vote tallying, batch JSON parsing/validation. Pattern: direct function call + `expect`, Portuguese rule-name `it`.

**Integration Tests:**

- Not implemented, but `supertest ^7.0.0` is already a devDependency — the intended pattern is `supertest(createApp())` against the exported Express app factory `backend/src/app.js` (`module.exports = createApp`), with `vi.mock('../src/config/db')` for Prisma. The scenario backlog lives in `docs/12-testes.md` ("Testes de integração": user creation + invite, request submission with attachments, auto-approval, voting, provisioning, reports, audit).

**E2E Tests:**

- Not used (no Playwright/Cypress anywhere). Planned scenarios are documented as manual scripts in `docs/12-testes.md` ("Testes end-to-end" — 5 scenarios, e.g. "Aluno solicita equipamento", "Solicitação parcialmente aprovada").

## Common Patterns

**Async Testing:**

```javascript
// Prefer testing the async core synchronously when possible (tally is sync).
// For promise-based code, return/await the expectation:
await expect(asyncFn()).resolves.toBe(x);   // not yet used in repo, valid Vitest idiom
```

No async tests exist today because every tested function is synchronous.

**Error Testing:**

```javascript
expect(() => parseBatch(Buffer.from('nao é json'))).toThrow();
expect(() => calcAmount('EQUIPAMENTO', { estimatedValue: -5 }, 5)).toThrow();
expect(() => calcAmount('VIAGEM', { ..., consultedOtherSources: true }, 5)).toThrow();
```

(`backend/tests/batch.test.js:5-9`, `backend/tests/unit.test.js:22-27`) — use bare `.toThrow()` (domain helpers throw `Error` with pt-BR messages; assert on message only if the text is part of the contract).

**Money assertions:** always compare integer cents — `expect(toCents(10.05)).toBe(1005)`, `expect(r.requestedAmountCents).toBe(25000)` (`backend/tests/unit.test.js:12-15`).

---

*Testing analysis: 2026-09-22*
