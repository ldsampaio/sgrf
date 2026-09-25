# Phase 1: CI Regression Gate - Research

**Researched:** 2026-09-23
**Domain:** GitHub Actions CI for a two-package (non-workspace) Node monorepo; branch-protection required checks
**Confidence:** HIGH

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| CI-01 | Two-job pipeline runs on every push/PR as a required check — backend `npx vitest run` + frontend `npm run build` (Node 22, per-package `working-directory`, per-lockfile npm cache); no workspace tooling, no invented lint/typecheck commands; landed **first** as the regression gate for every other fix | Full workflow skeleton in Code Examples (verified action tags via `git ls-remote`, official `setup-node` README for `cache-dependency-path`); clean-checkout green proven empirically this session (17/17 tests + build, no DB); branch-protection REST payload from official GitHub docs; `gh` CLI already authenticated with ADMIN on the repo |
</phase_requirements>

*No CONTEXT.md exists for this phase (user chose to continue without context) — no locked decisions section to copy. The closest thing to locked decisions is `.planning/ROADMAP.md`'s Phase 1 plan descriptions and `.planning/STATE.md`'s Decisions log, both honored below.*

## Project Constraints (from AGENTS.md)

Actionable directives extracted from `./AGENTS.md` — treat with the same authority as locked decisions:

1. **Two packages, no workspace** — "Dois pacotes **sem workspace** — rode comandos dentro de `backend/` ou `frontend/`" [VERIFIED: AGENTS.md:3] → every CI job needs its own `working-directory`; never hoist to a root install.
2. **Backend test command is exactly** `` `cd backend && npx vitest run` `` with suites `batch`, `unit`, `voting` [VERIFIED: AGENTS.md:16, quoted verbatim] → the backend job runs `npx vitest run` and nothing else.
3. **Frontend has no tests** — "Frontend **não tem testes** (`npm test` falha de propósito) — verifique com `npm run build`" [VERIFIED: AGENTS.md:17, quoted verbatim]; `frontend/package.json:7` is `"test": "echo \"Error: no test specified\" && exit 1",` [VERIFIED: frontend/package.json:7] → CI must never invoke frontend `npm test`.
4. **No invented commands** — "Sem lint/typecheck/CI configurados; não invente esses comandos" [VERIFIED: AGENTS.md:18, quoted verbatim] → no lint, no typecheck, no coverage gates in the workflow. CI-01 repeats this in REQUIREMENTS.md ("no invented lint/typecheck commands").
5. **Prisma migrations are local-only** — after schema changes run `npx prisma migrate dev` against the local Docker Postgres [VERIFIED: AGENTS.md:22] → CI runs **no migrations, no seeds, no DB service** (matches success criterion 2: "no database service").
6. **Never commit** `backend/.env`, `*.db*`, `backend/uploads/*` [VERIFIED: AGENTS.md:24] → CI must not generate or require a real `.env`; env comes from job-level dummy vars only.
7. REQUIREMENTS.md Out of Scope also forbids "TypeScript / ESLint / typecheck" and mandates "`npm run build` in CI instead" of an E2E harness [VERIFIED: REQUIREMENTS.md:73-74].

## Summary

Phase 1 adds one file — `.github/workflows/ci.yml` — with two parallel jobs (backend vitest, frontend vite build) on Node 22, each with its own `working-directory` and its own lockfile-keyed npm cache, then proves the gate catches regressions (broken test → red), then marks both job checks required on `main` and records CI in AGENTS.md. The repo is a public GitHub repository (`ldsampaio/sgrf`, GitHub Free), Actions are enabled, `gh` is authenticated with **ADMIN**, `main` is currently unprotected, and no `.github/` directory exists yet — all verified live this session.

The critical finding is empirical: **success criterion 2 is already proven before any code is written.** A clean clone with `npm ci` + `npx prisma generate` (no `.env`, no `DATABASE_URL`, no database) runs all 17 tests green, and the frontend builds green — I ran exactly that this session. The one hard dependency the clean run exposed: without an explicit `npx prisma generate` after `npm ci`, importing `@prisma/client` crashes (`Cannot find module '.prisma/client/default'`) because the generated client lives in gitignored `node_modules` — so the generate step in plan 01-01 is load-bearing, not cargo-cult. Second key finding: `actions/checkout@v7` and `actions/setup-node@v7` (the STATE.md-locked versions) both exist as live tags on the official `actions` org repos, verified via `git ls-remote`, and setup-node's official README confirms `cache-dependency-path` is mandatory here — there is no root lockfile, and auto-caching only activates when a `packageManager` field exists, which this repo doesn't have.

**Primary recommendation:** follow the roadmap's plan order exactly (01-01 workflow → 01-02 red-proof → 01-03 mark required). The red-proof must happen **before** branch protection is enabled, because GitHub's documented GH006 behavior can block direct pushes to a branch whose required checks are currently failing — proving red first and requiring checks second avoids ever fighting that deadlock.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Workflow definition (triggers, jobs, steps) | CI/CD (GitHub Actions) | — | No app tier runs CI; the workflow file is the single source of truth |
| Test execution (17 unit tests) | Backend package (`backend/`) | — | Tests import backend services only; run with backend's lockfile and Prisma client |
| Build verification (vite build) | Frontend package (`frontend/`) | — | Build consumes frontend's own `package.json`/lockfile; proxy config is dev-only and irrelevant to build |
| Prisma client generation | Backend package (build step) | — | Generated client is gitignored; must be regenerated per clean checkout before any import of `config/db.js` |
| Required-check enforcement | GitHub branch protection (repo settings) | — | Repo-level settings, not code; configured via REST API/UI after the workflow has run green |
| Recording CI as the regression gate | Repo docs (`AGENTS.md`) | — | Human-facing contract; AGENTS.md already owns verification commands |

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `actions/checkout` | `v7` (tag `3d3c42e5aac5ba805825da76410c181273ba90b1` verified) | Clone the repo | Universal first step; STATE.md locked v7 over ARCHITECTURE.md's illustrative v4 [VERIFIED: git ls-remote github.com/actions/checkout; .planning/STATE.md:57 "CI action versions: `checkout@v7`/`setup-node@v7` (registry-verified STACK.md wins); ARCHITECTURE.md's v4 snippet is illustrative"] |
| `actions/setup-node` | `v7` (tag `820762786026740c76f36085b0efc47a31fe5020` verified) | Install Node 22 + key npm cache per lockfile | Official action; `cache: npm` + `cache-dependency-path` is the documented monorepo pattern [VERIFIED: git ls-remote github.com/actions/setup-node; CITED: raw.githubusercontent.com/actions/setup-node/v7/README.md] |
| Node.js | `22` (LTS) | Runtime for both jobs | Locked by CI-01/success criteria; all pinned deps declare compatibility: vitest 2.1.9 `engines: ^18.0.0 \|\| >=20.0.0`, vite 5.4.21 `^18.0.0 \|\| >=20.0.0`, prisma/@prisma/client 5.22.0 `>=16.13` [VERIFIED: backend/package-lock.json + frontend/package-lock.json engines fields, read this session] |
| npm (`npm ci`) | runner-bundled (Node 22 → npm 10.x) | Deterministic lockfile install | Both `package-lock.json` files exist and are in sync (clean-clone `npm ci` exited 0 in both packages this session) [VERIFIED: local clean-clone experiment] |
| Prisma CLI (`npx prisma generate`) | 5.22.0 (lockfile-pinned) | Generate `@prisma/client` into gitignored `node_modules` | Empirically required — see Pitfall 2 [VERIFIED: backend/package-lock.json; local experiment] |
| vitest | 2.1.9 (lockfile-pinned; registry latest is 5.0.1 — **do not upgrade in this phase**) | Backend test runner | Already the project's test runner; `backend/package.json:12` is `"test": "vitest run"` [VERIFIED: backend/package.json:12] |
| vite | 5.4.21 (lockfile-pinned; registry latest is 8.3.0 — **do not upgrade in this phase**) | Frontend production build | `frontend/package.json:9` is `"build": "vite build",` [VERIFIED: frontend/package.json:9] |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `gh` CLI | installed (`/usr/bin/gh`), authenticated as `ldsampaio` (github.com, keyring) | Set branch protection in plan 01-03; watch runs in 01-02 | Every step of plans 01-02/01-03; `viewerPermission: ADMIN` verified on `ldsampaio/sgrf` [VERIFIED: `gh auth status` + `gh repo view --json viewerPermission`, run this session] |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `actions/checkout@v7` / `setup-node@v7` | v4 (ARCHITECTURE.md snippet) | STATE.md explicitly resolved this: v7 wins, v4 snippet is illustrative [VERIFIED: .planning/STATE.md:57] — do not reopen |
| Two explicit jobs (roadmap) | One matrix job over `working-directory` | Matrix saves lines but produces composite check names (`backend (22)`) that complicate required-check contexts; roadmap locked two jobs [CITED: ROADMAP.md:36] |
| `cache: npm` + `cache-dependency-path` | manual `actions/cache` with `hashFiles` | setup-node's input is the documented, key-maintaining path; hand-rolled keys drift [CITED: setup-node README] |
| Explicit `npx prisma generate` step | commit the generated client to git | Client lands in gitignored `node_modules/` [VERIFIED: .gitignore:15 `node_modules/`]; committing it invites drift — generate per checkout instead |
| GitHub native branch protection | custom webhook/status bot | Native is free for public repos, zero code, impossible to drift [CITED: docs.github.com REST branch-protection] |

**Installation:** none — no new npm packages are added by this phase. The workflow installs only lockfile-pinned deps via `npm ci`.

**Version verification:** performed this session — `git ls-remote --tags` confirmed `v7` exists on both official action repos; `npm view vitest` → 5.0.1 and `npm view vite` → 8.3.0 (registry-current versions recorded to prove the lockfile-pinned 2.1.9/5.4.21 are deliberate, not stale ignorance; upgrading them is out of scope for a regression-gate phase).

## Package Legitimacy Audit

No npm/PyPI/crates packages are installed by this phase, so the npm-registry legitimacy gate has no npm packages to evaluate (`gsd-tools query package-legitimacy check` targets registry packages; feeding it GitHub action names would produce a meaningless "not found on registry" verdict). The two external dependencies this phase adds are GitHub Actions from the first-party `actions` org, verified by a stronger method than registry lookup — tags read directly from the official repositories:

| Package | Registry/Source | Age | Downloads/Status | Source Repo | Verdict | Disposition |
|---------|-----------------|-----|------------------|-------------|---------|-------------|
| `actions/checkout@v7` | GitHub Actions (not npm) | actions org, ~10 yrs | official default in GH docs | github.com/actions/checkout | OK | Approved |
| `actions/setup-node@v7` | GitHub Actions (not npm) | actions org, ~10 yrs | official default in GH docs | github.com/actions/setup-node | OK | Approved |

**Packages removed due to [SLOP] verdict:** none
**Packages flagged as suspicious [SUS]:** none

*No packages were discovered via WebSearch or training data in this phase; both action tags were confirmed against their official repositories with `git ls-remote` this session.*

## Architecture Patterns

### System Architecture Diagram

```
  git push / open pull request
            │
            ▼
┌─────────────────────────────────────────────────────────┐
│ .github/workflows/ci.yml   on: [push, pull_request]     │
│ permissions: contents: read                             │
└─────────────────────────────────────────────────────────┘
            │
     ┌──────┴──────────────────────────┐  (parallel)
     ▼                                 ▼
┌──────────────────────┐     ┌──────────────────────┐
│ job: backend         │     │ job: frontend        │
│ working-dir: backend │     │ working-dir: frontend│
│ env: DATABASE_URL    │     │                      │
│  (dummy)             │     │                      │
├──────────────────────┤     ├──────────────────────┤
│ checkout@v7          │     │ checkout@v7          │
│ setup-node@v7        │     │ setup-node@v7        │
│  Node 22             │     │  Node 22             │
│  cache: npm          │     │  cache: npm          │
│  cache-dependency-   │     │  cache-dependency-   │
│   path: backend/     │     │   path: frontend/    │
│   package-lock.json  │     │   package-lock.json  │
│ npm ci               │     │ npm ci               │
│ npx prisma generate  │     │ npm run build        │
│ npx vitest run       │     │  (vite → dist/)      │
│  (17 tests)          │     │                      │
└──────────┬───────────┘     └──────────┬───────────┘
           ▼                            ▼
   check run "backend"          check run "frontend"
           └────────────┬───────────────┘
                        ▼
┌─────────────────────────────────────────────────────────┐
│ branch protection (main):                               │
│ required_status_checks = ["backend", "frontend"]        │
│ → red run ⇒ merge blocked; green ⇒ gate passes          │
└─────────────────────────────────────────────────────────┘
```

Decision point: a deliberately broken test (plan 01-02) makes the `backend` check report `failure` before branch protection exists, proving the gate; protection is only enabled afterwards (plan 01-03).

### Recommended Project Structure

```
.github/
└── workflows/
    └── ci.yml        # the only file this phase creates (plus AGENTS.md edit in 01-03)
```

No src/ changes. The rest of the repo is untouched — this phase's footprint is intentionally one workflow file + one docs edit.

### Pattern 1: Two-Job Per-Package CI in a Non-Workspace Repo

**What:** two independent jobs, each pinned to its package directory, each caching against its own lockfile.
**When to use:** any repo with multiple `package-lock.json` files and no root workspace (this repo: `test -e package.json` at root → "no root package.json" [VERIFIED: run this session]).
**Example:** see Code Examples below. Source shape: `.planning/research/STACK.md:71-103` (registry-verified workflow) + official setup-node README.

Key mechanics:
- `defaults: run: working-directory:` scopes every `run:` step (it does **not** affect `uses:` steps — irrelevant here since checkout/setup-node always run at repo root).
- `cache-dependency-path` is resolved relative to the **repository root**, not the job's working-directory — pass `backend/package-lock.json`, not `package-lock.json` [CITED: raw.githubusercontent.com/actions/setup-node/v7/README.md ("Caching npm dependencies in monorepos" example uses `subdir/package-lock.json`)].
- `env.DATABASE_URL` at job level: the current 17 tests empirically pass with **no** `DATABASE_URL` at all (Prisma 5.22 defers env resolution until first query, and tests never query) — keep the dummy per roadmap plan 01-01 anyway as cheap insurance against a Prisma upgrade changing validation timing and for Phase 4's DB spike [VERIFIED: local clean-clone experiment; CITED: ROADMAP.md:36 "dummy `DATABASE_URL` at job level"].

### Pattern 2: Prove-Then-Enforce Sequencing

**What:** land the workflow and watch it go green → push a deliberate test break and watch it go red → revert → *then* enable required status checks.
**When to use:** any first-time CI rollout on a repo where developers push directly to `main` (this repo's `config.json` has `"branching_strategy": "none"` [VERIFIED: .planning/config.json:12]).
**Why the order is load-bearing:** GitHub documents that a required check "must have completed successfully in the chosen repository during the past seven days" before it can be required [CITED: docs.github.com/en/pull-requests/how-tos/merge-and-close-pull-requests/troubleshooting-required-status-checks], and that pushing to a protected branch with failing required checks returns `GH006: Protected branch update failed` [CITED: same page]. Requiring checks before the workflow has ever run yields a permanently "waiting" PR; enforcing them while `main` is red can block the revert push. The roadmap's plan order (01-01 → 01-02 → 01-03) already encodes this — research confirms it must not be reordered.

### Anti-Patterns to Avoid

- **Caching without `cache-dependency-path` (or relying on auto-cache):** setup-node hashes the repo-root lockfile by default — which doesn't exist here — and the v6+ auto-cache only activates when `package.json` declares `packageManager`, which neither package does [CITED: setup-node v7 README breaking-changes v6 + "cache-dependency-path" sections]. Result: hard error (`Some specified paths were not resolved`) or silently no cache.
- **Running frontend `npm test` in CI:** exits 1 by design [VERIFIED: frontend/package.json:7].
- **Adding a `postgres` service "for completeness":** violates success criterion 2 and adds minutes to every run; tests never query (proven — they pass with no DB and no env).
- **Path filters or job-level `if:` on required workflows:** a skipped workflow's checks stay Pending and block merges; a skipped *job* reports "Success" (false green) [CITED: docs.github.com status-checks + troubleshooting pages].
- **`cancel-in-progress: true` on the concurrency group while checks are required:** cancelled is not a passing conclusion (passing = `success`, `skipped`, `neutral`) [CITED: docs.github.com status-checks conclusions table] — a cancelled required run blocks merges. Defer concurrency tuning.
- **Inventing lint/typecheck/coverage steps:** directly forbidden [VERIFIED: AGENTS.md:18].

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Installing a specific Node version | rely on runner's default Node (drifts with image updates) | `actions/setup-node` with `node-version: 22` | Reproducible runtime; CI-01 mandates Node 22 |
| npm dependency caching | hand-computed `actions/cache` keys over `node_modules` | `setup-node` `cache: npm` + `cache-dependency-path` | Correct key derivation from lockfile hash is maintained upstream; `node_modules` itself must not be cached |
| Making checks mandatory | webhook bot posting commit statuses | GitHub branch protection `required_status_checks` | Native, free on public repos, enforced server-side, zero code to maintain [CITED: docs.github.com REST branch-protection] |
| Generating the Prisma client | committing generated `.prisma/client` to git | `npx prisma generate` in the job | Client belongs to `node_modules` (gitignored); regeneration is deterministic from `schema.prisma` |
| Proving the gate works | trusting the first green run | deliberate red-proof (plan 01-02) | A gate that has never gone red is unproven; success criterion 3 requires the red evidence |

**Key insight:** every mechanism this phase needs already exists as a managed GitHub/lockfile feature — the failure mode is *adding* cleverness (matrix jobs, custom caches, extra checks), not missing cleverness.

## Common Pitfalls

### Pitfall 1: `cache-dependency-path` omitted or wrong-scoped
**What goes wrong:** setup-node fails with `Some specified paths were not resolved, unable to cache dependencies`, or caches against a nonexistent root lockfile.
**Why it happens:** default cache key is the repo-root lockfile; this repo has none, and auto-caching needs a `packageManager` field that doesn't exist.
**How to avoid:** set `cache: npm` **and** `cache-dependency-path: backend/package-lock.json` / `frontend/package-lock.json` explicitly in each job; paths are repo-root-relative.
**Warning signs:** setup-node step logs an unresolved-paths error; cache never hits across runs.

### Pitfall 2: Missing `npx prisma generate` after `npm ci`
**What goes wrong:** the backend job dies during test collection.
**Why it happens:** `voting.test.js` → `votingService.js` → `config/db.js` → `new PrismaClient()` [VERIFIED: backend/src/config/db.js:1-5 `const { PrismaClient } = require('@prisma/client');`]; the generated client lives under gitignored `node_modules` and no project postinstall regenerates it (`package.json` has no `postinstall` script [VERIFIED: backend/package.json, read this session]).
**How to avoid:** explicit `npx prisma generate` between `npm ci` and `npx vitest run` — this is plan 01-01's shape for a reason.
**Warning signs (observed this session):** `import FAILS: Cannot find module '.prisma/client/default'` when running tests after a bare `npm ci` [VERIFIED: local clean-clone experiment].

### Pitfall 3: Requiring a check that has never run
**What goes wrong:** PRs sit at "Waiting for status to be reported" forever; or the UI won't even list the check for selection.
**Why it happens:** GitHub requires a required check to have completed **successfully within the past 7 days** in the repo before it can be required [CITED: docs.github.com troubleshooting-required-status-checks].
**How to avoid:** keep the roadmap order — merge/push the workflow (01-01), confirm a green run, run the red-proof (01-02), only then set protection (01-03).
**Warning signs:** branch-protection settings show no matching checks; PR checks panel empty.

### Pitfall 4: The red-proof itself gets blocked (GH006)
**What goes wrong:** after protection is on, pushing while `main`'s required checks are failing returns `GH006: Protected branch update failed... Required status check "..." is failing` [CITED: docs.github.com troubleshooting page] — the revert push can't land.
**Why it happens:** required checks gate the branch head state on direct pushes too, not only PR merges.
**How to avoid:** do the entire red-proof in 01-02 **before** 01-03 enables protection (roadmap order). Document the recovery path for later phases: re-run the failed workflow, or (if genuinely red) temporarily disable the rule / push the fix through a PR. Exact behavior for a brand-new failing commit followed by a fix push was not reproduced this session — treat as [ASSUMED].
**Warning signs:** `git push` rejected with GH006; `gh api .../protection` exists on `main`.

### Pitfall 5: Invented or wrong commands
**What goes wrong:** CI fails on a command that doesn't exist, or runs frontend `npm test` (exit 1 by design).
**Why it happens:** assuming a standard Node CI template (lint → test → build).
**How to avoid:** the workflow contains exactly: `npm ci`, `npx prisma generate`, `npx vitest run` (backend) and `npm ci`, `npm run build` (frontend) — nothing else. No lint, no typecheck, no `npm test` in frontend, no `prisma migrate` [VERIFIED: AGENTS.md:16-18; REQUIREMENTS.md CI-01].
**Warning signs:** any step name mentioning lint/format/typecheck/e2e.

### Pitfall 6: Adding a database service
**What goes wrong:** violates success criterion 2 ("no database service"), slows every run, introduces flaky startup ordering.
**Why it happens:** "Prisma is in the stack, tests must need Postgres."
**How to avoid:** they don't — verified: clean clone, no `.env`, no `DATABASE_URL`, no Docker → `Tests  17 passed (17)` [VERIFIED: local clean-clone experiment, output pasted under Code Examples]. Revisit only when Phase 4's supertest matrix lands (STATE.md already flags that spike).
**Warning signs:** a `services:` block in ci.yml.

### Pitfall 7: Job/check name ambiguity
**What goes wrong:** required-check contexts don't match any run; or two workflows share a job name and the merge box becomes ambiguous.
**Why it happens:** required contexts must equal the reported check name (the job's `name:` or job id) and job names must be unique across all workflows [CITED: docs.github.com about-protected-branches tip].
**How to avoid:** this repo has exactly one workflow; name jobs `backend` and `frontend` (explicitly, with `name:`), and use those exact strings as protection contexts.
**Warning signs:** `gh api` protection succeeds but PRs show no required checks.

## Code Examples

### Complete workflow (plan 01-01 deliverable)

```yaml
# .github/workflows/ci.yml
name: CI
on: [push, pull_request]
permissions:
  contents: read          # least privilege, per setup-node README recommendation
jobs:
  backend:
    name: backend
    runs-on: ubuntu-latest
    env:                                  # CI has no backend/.env — tests construct PrismaClient
      DATABASE_URL: postgresql://user:pass@localhost:5432/sgrd   # dummy: generate/tests never connect
    defaults: { run: { working-directory: backend } }
    steps:
      - uses: actions/checkout@v7
      - uses: actions/setup-node@v7
        with:
          node-version: 22
          cache: npm
          cache-dependency-path: backend/package-lock.json   # required: no root lockfile
      - run: npm ci
      - run: npx prisma generate          # generated client is gitignored; no project postinstall
      - run: npx vitest run               # AGENTS.md's exact backend command (17 tests)
  frontend:
    name: frontend
    runs-on: ubuntu-latest
    defaults: { run: { working-directory: frontend } }
    steps:
      - uses: actions/checkout@v7
      - uses: actions/setup-node@v7
        with:
          node-version: 22
          cache: npm
          cache-dependency-path: frontend/package-lock.json
      - run: npm ci
      - run: npm run build                 # frontend has no tests — build IS the check
```

Sources: shape from `.planning/research/STACK.md:71-103` (researched & registry-verified in a prior phase) and `.planning/research/ARCHITECTURE.md:250-273` (v4 snippet superseded by STATE.md's v7 decision); action versions verified via `git ls-remote` this session; `cache: npm` + `cache-dependency-path` semantics from [CITED: raw.githubusercontent.com/actions/setup-node/v7/README.md]; `permissions: contents: read` from the same README ("Recommended permissions").

### Mark the checks required (plan 01-03 deliverable)

```bash
# Preconditions: workflow has run green on main (past-7-days rule), red-proof already done + reverted.
gh api -X PUT repos/ldsampaio/sgrf/branches/main/protection \
  -F required_status_checks[strict]=false \
  -f 'required_status_checks[contexts][]=backend' \
  -f 'required_status_checks[contexts][]=frontend' \
  -f enforce_admins=true \
  -F required_pull_request_reviews=null \
  -F restrictions=null

# verify
gh api repos/ldsampaio/sgrf/branches/main/protection --jq '.required_status_checks.contexts'
# expected: ["backend","frontend"]
```

Source: [CITED: docs.github.com/en/rest/branches/branch-protection — "Update branch protection"]: body params `required_status_checks` (`strict` + `contexts`/`checks`, required), `enforce_admins` (required, nullable), `required_pull_request_reviews` (required, nullable), `restrictions` (required, nullable); protected branches are available in public repos on GitHub Free (same page). Repo is PUBLIC with `viewerPermission: ADMIN` and `main` currently returns 404 "Branch not protected" [VERIFIED: `gh repo view` + `gh api .../protection`, run this session]. Fallback if the token lacks scope: the documented UI path (Settings → Branches → Add classic branch protection rule → "Require status checks to pass before merging") [CITED: docs.github.com managing-a-branch-protection-rule]. `strict: false` / `enforce_admins: true` are recommendations (discretion), not roadmap-locked — see Open Questions.

### Red-proof mechanics (plan 01-02)

```bash
# 1. break one assertion, e.g. backend/tests/unit.test.js line 8:
#      it('normaliza', () => expect(normalizeEmail('A@Utfpr.Edu.Br ')).toBe('WRONG'));
git add backend/tests/unit.test.js && git commit -m "ci: deliberate break to prove the gate"
git push origin main
gh run list --limit 2                 # backend: failure ✓ (gate catches it)
# 2. revert, confirm green:
git revert HEAD && git push origin main
gh run watch $(gh run list --limit 1 --json databaseId --jq '.[0].datasetId // .[0].databaseId')
# main green again → safe to enable branch protection in 01-03
```

Do this **before** plan 01-03 (see Pitfall 4). Success criterion 3 is satisfied by the red run's UI/API evidence.

### Empirical evidence gathered this session (success criterion 2 pre-proof)

Clean clone to a temp dir, no `.env`, `DATABASE_URL` explicitly unset, no Docker/database:

```
--- generate:
✔ Generated Prisma Client (v5.22.0) to ./node_modules/@prisma/client in 35ms
--- vitest:
 Test Files  3 passed (3)
      Tests  17 passed (17)
--- frontend:
✓ built in 575ms
```

And the falsification attempt — same clean clone, `npm ci` but **no** generate:

```
import FAILS: Cannot find module '.prisma/client/default'
```

[VERIFIED: local clean-clone experiment, run this session — this is direct observation of the exact commands CI will run]

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `actions/checkout@v4` (ARCHITECTURE.md snippet) | `actions/checkout@v7` | v7 is current major (STATE.md decision) | node24 action runtime; snippet in ARCHITECTURE.md is illustrative only |
| `actions/setup-node@v4` | `actions/setup-node@v7` | v5: node24 runtime + default caching; v6: auto-cache only with `packageManager` field, `always-auth` removed; v7: ESM migration | Must pass `cache: npm` explicitly (this repo has no `packageManager` field) |
| Trusting "first run green" as proof | Deliberate red-proof before enforcement | standard gate-rollover practice | Success criterion 3 evidence; avoids GH006 deadlock |

**Deprecated/outdated:**
- `ARCHITECTURE.md`'s `checkout@v4`/`setup-node@v4` workflow: superseded — STATE.md:57 records "registry-verified STACK.md wins" [VERIFIED: .planning/STATE.md:57].
- Lockfile-current vs registry-current: vitest 2.1.9 (registry 5.0.1) and vite 5.4.21 (registry 8.3.0) are intentionally pinned [VERIFIED: `npm view vitest/vite version` + lockfile reads]; upgrades belong to a future milestone, not this gate.
- `npm install` in CI: always `npm ci` — lockfile-exact, no drift [CITED: setup-node README examples use `npm ci`].

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | The 17 tests pass on **Node 22** specifically (verified locally on Node v26.9.0; lockfile engines fields permit 18/20+/16+ but the exact 22 run only happens on the first CI run) | Standard Stack | Low — engines all allow 22; worst case the first CI run (plan 01-01) surfaces it immediately, which is exactly what the plan's verification step is for |
| A2 | GH006 push-blocking timing for "new failing commit → fix push" (docs show the error; exact sequence not reproduced) | Pitfall 4 | Medium — mitigated by doing the red-proof before enabling protection (roadmap order) |
| A3 | The authenticated `gh` token can `PUT` branch protection (ADMIN repo permission verified; token scopes not inspected) | Pattern 2 / Code Examples | Low — fallback is the documented branch-protection UI (link in Code Examples) |
| A4 | `argon2@0.41.1`'s install script succeeds on `ubuntu-latest` (prebuilt binary or toolchain compile); local npm 12 gated install scripts so the local `npm ci` did not exercise it the same way CI's npm 10 will | Environment Availability | Low — GH-hosted runners include build toolchain; failure would appear at `npm ci` in the first run and is not fixable by workflow shape anyway |
| A5 | Local npm 12's install-script gating differs from CI npm 10 (scripts run by default there); irrelevant for Prisma because of the explicit generate step | Pitfall 2 | Low — explicit `npx prisma generate` removes the dependency on postinstall behavior entirely |

**If this table is empty:** not applicable — five honest gaps recorded above.

## Open Questions

1. **`strict: true` (require branches up-to-date before merge)?**
   - What we know: roadmap doesn't specify; `strict` is a required body param in the REST payload [CITED: docs.github.com REST branch-protection].
   - What's unclear: whether the team wants the re-test-after-every-main-push churn.
   - Recommendation: start with `strict: false` (single developer, direct-push flow); revisit if PRs become the norm. Trivial to flip later.
2. **`enforce_admins: true`?**
   - What we know: without it, the sole admin's direct pushes bypass the gate, weakening "no later fix ships unverified."
   - What's unclear: how often hotfixes to `main` will need to land while red.
   - Recommendation: `enforce_admins: true` for a real gate; document the recovery path (re-run / PR / temporary rule disable) in AGENTS.md during 01-03.
3. **Duplicate runs on same-repo PR branches** (`push` + `pull_request` both fire → two runs per push to a PR branch).
   - What we know: both triggers are mandated by CI-01 ("every push/PR"); both event types are eligible for required checks [CITED: docs.github.com troubleshooting].
   - Recommendation: accept the duplicate minutes at this scale; add `concurrency` in a future milestone — and only with a non-cancelling strategy while checks are required (see anti-patterns).

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js (local) | local verification | ✓ | v26.9.0 (CI uses 22 via setup-node) | — |
| npm (local) | lockfile installs | ✓ | 12.0.2 | — |
| `gh` CLI | 01-02 run watching, 01-03 protection | ✓ | `/usr/bin/gh`, authed `ldsampaio`, ADMIN on repo | Branch-protection UI (docs link above) |
| `git` + remote `github.com/ldsampaio/sgrf` | pushing workflow + runs | ✓ | remote reachable (ls-remote/clone succeeded) | — |
| GitHub Actions on repo | the phase itself | ✓ | `{"enabled":true,"allowed_actions":"all"}` | — |
| Branch protection availability | 01-03 | ✓ | public repo → available on GitHub Free [CITED: REST branch-protection docs] | — |
| Docker / PostgreSQL | nothing in this phase | N/A | — | deliberately absent (success criterion 2) |

**Missing dependencies with no fallback:** none.

**Note:** local npm 12 gates install scripts (`npm warn install-scripts argon2/esbuild/prisma...` observed) — CI's npm 10 runs them by default; this does not affect the workflow because the Prisma step is explicit (A4/A5 in Assumptions Log).

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | vitest 2.1.9 (backend only; frontend has no tests by design) |
| Config file | none — no `vitest.config.*` exists [VERIFIED: glob this session], vitest runs on defaults |
| Quick run command | `cd backend && npx vitest run` (~137 ms local: 3 files, 17 tests) |
| Full suite command | `cd backend && npx vitest run` (the quick run *is* the full suite) |
| Build check | `cd frontend && npm run build` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|--------------|
| CI-01 | Two-job workflow triggers on push/PR, Node 22, per-package dirs, per-lockfile cache | manual/CI-observation | push workflow file → `gh run list --limit 1` shows 2 green jobs | ✅ created in 01-01 |
| CI-01 | Check passes on clean checkout (17 tests + build, no DB) | CI | same run as above (already pre-proven locally this session — pasted evidence) | ✅ existing `backend/tests/{batch,unit,voting}.test.js` |
| CI-01 | Broken test turns the check red | CI (negative proof) | break assertion → push → `gh run list` shows `backend: failure` → revert → green | ✅ uses existing tests, plan 01-02 |
| CI-01 | Check is *required* | manual/API | `gh api .../protection --jq '.required_status_checks.contexts'` → `["backend","frontend"]` | ✅ plan 01-03 |

### Sampling Rate

- **Per task commit:** `cd backend && npx vitest run` + `cd frontend && npm run build` locally (both < 5 s total) — and after 01-01 lands, the push itself runs both in CI.
- **Per wave merge:** the CI run on the merge/push commit (both jobs green).
- **Phase gate:** CI green on `main` **plus** the red-proof evidence (run URL showing `backend: failure`) **plus** the protection API verification output.

### Wave 0 Gaps

- None for the backend — existing infrastructure covers all phase requirements (the phase's "tests" are the workflow runs themselves; the 17 existing tests are the payload).
- Frontend: intentionally no tests (AGENTS.md:17) — `npm run build` is the designated check; do not add a test framework in this phase.
- CI-01's verification is observational (gh run states), not a new test file — no framework install needed.

## Security Domain

`security_enforcement: true` at `security_asvs_level: 1` [VERIFIED: .planning/config.json:48-49] — included per protocol. This phase changes no application code, so most ASVS categories are out of scope; the real controls are CI supply-chain controls.

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|------------------|
| V2 Authentication | no | no auth code touched |
| V3 Session Management | no | — |
| V4 Access Control | no | — |
| V5 Input Validation | no | workflow accepts no user input; no `${{ }}` interpolation of untrusted context into `run:` steps (nothing in the workflow needs it) |
| V6 Cryptography | no | no crypto added; dummy `DATABASE_URL` is not a secret |

### Known Threat Patterns for this stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Workflow script injection (untrusted `${{ }}` in `run:`) | Tampering | no untrusted expressions in the workflow at all — keep it that way; never interpolate PR titles/branch names into `run:` |
| Tampered third-party actions | Tampering | first-party `actions/*` only, major-tag pinned (`@v7`); SHA-pinning available later — repo setting `sha_pinning_required` is currently `false` [VERIFIED: `gh api repos/.../actions/permissions` this session] |
| Secrets leaking into CI logs | Information Disclosure | no real secrets in CI — only a dummy `DATABASE_URL`; `permissions: contents: read` limits the token; `.env` is gitignored and never checked out [VERIFIED: .gitignore:11-13] |
| Cache poisoning via fork PRs | Tampering | setup-node cache uses GitHub's default scoping (fork PRs get read-only cache) — no custom cache keys to bypass it [ASSUMED — default platform behavior, not re-verified this session] |
| Gate bypass via invented/always-green checks | Tampering | checks are the two real commands only (Pitfall 5); red-proof proves non-vacuousness (success criterion 3) |

## Sources

### Primary (HIGH confidence)
- [CITED: docs.github.com/en/rest/branches/branch-protection] — Update branch protection payload (`required_status_checks.strict/contexts/checks`, `enforce_admins`, nullable `required_pull_request_reviews`/`restrictions`), public-repo/Free availability
- [CITED: docs.github.com/en/repositories/.../managing-a-branch-protection-rule] — UI flow fallback for 01-03
- [CITED: docs.github.com/en/pull-requests/how-tos/merge-and-close-pull-requests/troubleshooting-required-status-checks] — past-7-days requirement, GH006 push error, eligible trigger events (`push`, `pull_request`), skipped-check semantics
- [CITED: docs.github.com/en/pull-requests/collaborating-with-pull-requests/collaborating-on-repositories-with-code-quality-features/about-status-checks] — passing conclusions (`success`/`skipped`/`neutral`), skipped-job = Success trap, Actions generate checks not commit statuses
- [CITED: raw.githubusercontent.com/actions/setup-node/v7/README.md] — `cache: npm`, `cache-dependency-path` monorepo semantics, root-lockfile default, `packageManager` auto-cache condition (v6 breaking change), `permissions: contents: read` recommendation
- [VERIFIED: git ls-remote github.com/actions/checkout + github.com/actions/setup-node] — `v7` tags exist: `3d3c42e5aac5ba805825da76410c181273ba90b1` / `820762786026740c76f36085b0efc47a31fe5020`
- [VERIFIED: local clean-clone experiment] — `npm ci` + `npx prisma generate` + `npx vitest run` = 17/17 green with no `.env`/`DATABASE_URL`/DB; bare `npm ci` without generate → `Cannot find module '.prisma/client/default'`; `npm run build` green
- [VERIFIED: gh repo view / gh api repos/.../protection / gh auth status] — repo PUBLIC, `main` unprotected (404), Actions enabled, `gh` authed ADMIN as `ldsampaio`
- In-repo reads this session: `AGENTS.md:16-24`, `backend/package.json:6-13`, `frontend/package.json:6-11`, `.planning/config.json:24,32,48-49`, `.planning/STATE.md:57`, `.planning/ROADMAP.md:24-38`, `.planning/REQUIREMENTS.md:42-44,63-77`, `.planning/research/STACK.md:42,71-105`, `.planning/research/ARCHITECTURE.md:248-275`, `backend/prisma/schema.prisma:1-10`, `backend/src/config/db.js:1-5`, `backend/src/config/env.js:1-22`, `backend/tests/{unit,batch,voting}.test.js`, `frontend/vite.config.js:1-7`, `.gitignore`, both `package-lock.json` engines fields

### Secondary (MEDIUM confidence)
- [WebSearch verified against official source] GitHub Changelog 2021-09-07 (setup-node `cache-dependency-path` introduction), GitHub community threads confirming required-check selection quirks

### Tertiary (LOW confidence)
- Cache-poisoning default-scoping claim in Security table (platform default, not re-verified) — marked [ASSUMED]

## Metadata

**Confidence breakdown:**
- Standard Stack: HIGH — action tags verified via `git ls-remote` on official repos; lockfile versions read directly; engines compatibility read from lockfiles; official setup-node README fetched
- Architecture: HIGH — workflow shape empirically executed end-to-end in a clean clone this session; branch-protection payload from official REST docs; repo state (public/ADMIN/unprotected/Actions-enabled) probed live
- Pitfalls: HIGH for Pitfalls 1,2,3,5,6,7 (each backed by an observed output or a doc quote); MEDIUM for Pitfall 4 (GH006 sequence cited from docs but not reproduced)

**Research date:** 2026-09-23
**Valid until:** 30 days (stable domain: GitHub Actions + lockfile-pinned deps; re-check only if action majors v8 appear or the repo's plan changes visibility/plan tier)
