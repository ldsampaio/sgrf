---
phase: 01-ci-regression-gate
plan: "01"
type: execute
wave: 1
depends_on: []
files_modified:
  - .github/workflows/ci.yml
autonomous: true
requirements:
  - CI-01
requirements_addressed:
  - CI-01
estimate:
  tokens: 30000
  raw_tokens: 15000
  tasks: 2
  confidence: high
must_haves:
  truths:
    - "Pushing to main (or opening a PR) triggers a workflow named CI with two jobs whose reported check names are exactly backend and frontend (lowercase)"
    - "The backend job runs on Node 22 with working-directory backend and passes all 17 existing tests via npx vitest run on a clean checkout"
    - "The frontend job runs on Node 22 with working-directory frontend and compiles the unchanged SPA green via npm run build"
    - "No .vue file, stylesheet, or backend/src or frontend/src file is created or modified by this plan"
    - "Login.vue mounts with empty email/password refs ('') and placeholders voce@utfpr.edu.br / placeholder mask showing the expected format"
    - "While auth is in flight the submit button is :disabled and its label reads Entrando… (loading ? 'Entrando…' : 'Entrar'); finally resets loading=false"
    - "Failed auth renders div.alert.error[role=alert] (v-if=err) with the server message (e.response?.data?.error) or fallback 'Falha no login'"
    - "No client-side required/validation blocks submission — incomplete or invalid credentials surface only after the server round-trip via the error alert"
    - "The error alert renders the server message verbatim as block text inside the 440px card (max-width:440px); no truncation directive exists in Login.vue"
    - "Requests form mounts with defaults type EQUIPAMENTO, empty title, empty justification, valueCents 0 (MoneyInput displays the BRL mask at 0)"
    - "While creating, the submit button is :disabled and reads Salvando… (loading ? 'Salvando…' : 'Criar rascunho')"
    - "Create failure renders div.alert.error[role=alert] (v-if=err) with server error or fallback 'Falha'"
    - "Only Titulo carries required; Justificativa/Especificacao accept empty (spec falls back to 'n/a' in the payload) — a partially filled draft is a valid submit state"
    - "Each v-for row renders r.title, StatusBadge with status, formatBRL(r.requestedAmountCents), and a Submeter button gated v-if r.status RASCUNHO"
    - "Title cell renders r.title verbatim — no truncation, ellipsis, or title attribute is set at the call site in Requests.vue"
    - "At zero items the table renders its thead over an empty tbody — no empty-state message exists in the template; list starts empty and rows appear linearly (no pagination)"
    - "Titulo is a single-line input (long text stays on one line, scrolling inside the input); Justificativa is a textarea rows=2 that wraps"
    - "DateInput mounts showing modelValue (default empty) with placeholder dd/mm/aaaa; MoneyInput mounts showing formatCentsInput(0)"
    - "No async state exists in Date/Money inputs — mask formatting is synchronous in the input handler, so no loading/skeleton state can occur inside these controls"
    - "DateInput has no validation UI; MoneyInput renders an optional hint div (v-if=hint) — validation messaging is parent-controlled, none is intrinsic"
    - "Progressive masks: MoneyInput accepts digits only, slice(0, 12), reformatting centavos on each keystroke; DateInput applies maskDateDigits incrementally"
    - "Input values are length-bounded by the masks (12 digits / date mask); label and hint are block elements that wrap"
    - "Reports: no in-flight indicator exists — load() awaits the API without a loading ref, buttons stay enabled during the request, no spinner/skeleton declared"
    - "Reports load() catches nothing — a failed api.get leaves the previous pre output (or none) and surfaces no error message; Reports.vue has no err alert"
    - "Reports output renders in pre with inline overflow:auto — long JSON scrolls horizontally within the card"
    - "Reports output is hard-truncated at 3000 characters: JSON.stringify(data, null, 1).slice(0, 3000)"
    - "docs/DESIGN.md contains no raw HTML or fenced width constraints — markdown tables (max 6 columns) and prose wrap or scroll per the consuming renderer; horizontal overflow cannot originate from the file itself"
    - "docs/DESIGN.md prose is single long markdown lines (renderer wraps); longest atomic tokens are hex/gradient literals that must stay unbroken on a line"
    - "StatusBadge renders status verbatim in span.badge with no truncation/nowrap declared — the full status word (longest known: SUSPENSO_REUNIAO_ORDINARIA) always displays"
    - "StatusBadge fixed vocabulary maps to classes (APROVADO/CONCLUIDO to ok, EM_VOTACAO/AGUARDANDO_DESEMPATE to pending, SUSPENSO_REUNIAO_ORDINARIA to dark); any other value falls to .muted — unknown or long values render fully, never hidden"
  artifacts:
    - .github/workflows/ci.yml
  key_links:
    - "cache-dependency-path is repo-root-relative (backend/package-lock.json) — bare package-lock.json breaks npm caching (RESEARCH Pitfall 1)"
    - "npx prisma generate runs between npm ci and npx vitest run — without it the backend job dies importing @prisma/client (RESEARCH Pitfall 2)"
    - "Explicit job name: backend / name: frontend must equal the required-check contexts used in plan 01-03 (RESEARCH Pitfall 7)"
---

<objective>
**As a** solo developer shipping fixes directly to main, **I want to** land a two-job CI workflow (backend tests + frontend build) that goes green on the current codebase, **so that** every later fix in this milestone ships verified (per CI-01 and D-09 evidence rule).

Purpose: Create the only file this phase adds (`.github/workflows/ci.yml`), prove it green locally and in CI. This is the leading vertical slice — the workflow itself is the infrastructure under test.
Output: `.github/workflows/ci.yml` committed on main with a green CI run (both jobs success).
</objective>

<execution_context>
@/home/lucas/.config/opencode/gsd-core/workflows/execute-plan.md
@/home/lucas/.config/opencode/gsd-core/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/ROADMAP.md
@.planning/STATE.md
@.planning/phases/01-ci-regression-gate/01-RESEARCH.md
@.planning/phases/01-ci-regression-gate/01-CONTEXT.md
@AGENTS.md
@backend/package.json
@frontend/package.json
</context>

<tasks>

<task type="tracer">
  <name>Task 1: Create .github/workflows/ci.yml per RESEARCH skeleton</name>
  <files>.github/workflows/ci.yml</files>
  <read_first>.planning/phases/01-ci-regression-gate/01-RESEARCH.md (Code Examples — Complete workflow deliverable), backend/package.json (test script is vitest run), frontend/package.json (build script is vite build; test script exits 1 by design and must never be referenced)</read_first>
  <action>Create new file .github/workflows/ci.yml with exactly this shape: top-level name CI; on push and pull_request (YAML list form); top-level permissions contents read; job key backend with explicit name backend, runs-on ubuntu-latest, job-level env DATABASE_URL set to the dummy value postgresql://user:pass@localhost:5432/sgrd, defaults run working-directory backend, steps in order actions/checkout@v7, actions/setup-node@v7 with node-version 22 plus cache npm plus cache-dependency-path backend/package-lock.json (repo-root-relative, not bare package-lock.json), then run npm ci, run npx prisma generate, run npx vitest run; job key frontend with explicit name frontend, runs-on ubuntu-latest, defaults run working-directory frontend, steps in order actions/checkout@v7, actions/setup-node@v7 with node-version 22 plus cache npm plus cache-dependency-path frontend/package-lock.json, then run npm ci, run npm run build. Include nothing else: no lint, no typecheck, no coverage, no postgres service block, no path filters, no concurrency group, no frontend npm test, no prisma migrate, no seed step, and no ${{ }} interpolation of any GitHub context inside any run step.</action>
  <reversibility rating="reversible">New untracked file; removable with git rm plus a revert commit, no side effects outside the repo.</reversibility>
  <acceptance_criteria>File .github/workflows/ci.yml exists; grep -c 'name: CI' prints 1; grep -c 'checkout@v7' prints 2; grep -c 'setup-node@v7' prints 2; grep -c 'node-version: 22' prints 2; grep -c 'cache-dependency-path: backend/package-lock.json' prints 1; grep -c 'cache-dependency-path: frontend/package-lock.json' prints 1; grep -c 'npx prisma generate' prints 1; grep -c 'npx vitest run' prints 1; grep -c 'npm run build' prints 1; case-insensitive grep for lint, typecheck, eslint, tsc, or a services: block prints nothing; git status --short shows no modified file under backend/src, frontend/src, backend/tests, or frontend root.</acceptance_criteria>
  <verify>
    <automated>grep -c 'checkout@v7' .github/workflows/ci.yml && grep -c 'setup-node@v7' .github/workflows/ci.yml && grep -c 'node-version: 22' .github/workflows/ci.yml</automated>
    <fails_when>Any printed count is not 2, or grep exits 1 printing no match for one of the three patterns</fails_when>
    <automated>grep -ci 'lint\|typecheck\|eslint\|services:' .github/workflows/ci.yml; test $? -eq 1</automated>
    <fails_when>The test exits non-zero, meaning a forbidden lint/typecheck/service string was found in the workflow</fails_when>
  </verify>
  <done>Workflow file on disk matches the RESEARCH skeleton in every load-bearing field; ready to commit.</done>
</task>

<task type="auto">
  <name>Task 2: Local pre-verify, commit, push, confirm CI green</name>
  <files>.github/workflows/ci.yml</files>
  <read_first>.github/workflows/ci.yml (the file created in Task 1), .planning/phases/01-ci-regression-gate/01-VALIDATION.md (Sampling Rate section)</read_first>
  <action>First run cd backend && npx vitest run locally and require Tests 17 passed (17); then run cd frontend && npm run build locally and require a successful built message. Then stage only the workflow file with git add .github/workflows/ci.yml, commit with message ci: add two-job regression gate (backend vitest + frontend build), push to origin main. Then poll gh run list --limit 1 and gh run watch on the new run until it completes, and inspect gh run view with jobs JSON to confirm one job named backend and one named frontend both with conclusion success. If the backend job fails with Cannot find module '.prisma/client/default', the npx prisma generate step is missing or misordered — fix ci.yml in a new commit (never amend pushed commits), push again, and re-watch.</action>
  <acceptance_criteria>Local backend output contains the string Tests 17 passed (17); local frontend build output contains the string built in; git log --oneline -1 on main shows the ci commit; gh run list --limit 1 shows a completed run with conclusion success for the ci commit; gh run view jobs JSON contains exactly one job named backend with conclusion success and one job named frontend with conclusion success.</acceptance_criteria>
  <verify>
    <automated>cd backend && npx vitest run</automated>
    <fails_when>Output lacks the string Tests 17 passed (17), or the command exits non-zero</fails_when>
    <automated>cd frontend && npm run build</automated>
    <fails_when>Output lacks the string built in, or the command exits non-zero</fails_when>
    <automated>gh run list --limit 1 --json conclusion,status,headBranch --jq '.[0] | "\(.headBranch) \(.status) \(.conclusion)"'</automated>
    <fails_when>Output is not main completed success, or gh exits non-zero printing Could not resolve to a Repository</fails_when>
  </verify>
  <done>CI run on the workflow commit is green (backend success + frontend success); the prove-then-enforce precondition (green run in the past 7 days) holds for plan 01-03.</done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| push/PR event → GitHub-hosted runner | Untrusted code checkout crosses into the CI runner; workflow must grant least privilege |
| CI runner → GitHub API (GITHUB_TOKEN) | Token scope crosses into repo permissions; must be read-only |

## STRIDE Threat Register

| Threat ID | Category | Component | Severity | Disposition | Mitigation Plan |
|-----------|----------|-----------|----------|-------------|-----------------|
| T-01-01 | Tampering | .github/workflows/ci.yml run steps | high | mitigate | No ${{ }} interpolation of untrusted contexts (PR titles, branch names) in any run step; verified by Task 1 negative grep |
| T-01-02 | Tampering | actions/checkout, actions/setup-node | medium | mitigate | First-party actions/* only, pinned to registry-verified major tags checkout@v7 and setup-node@v7; no third-party actions |
| T-01-03 | Information Disclosure | backend job env | low | accept | Only a dummy DATABASE_URL (postgresql://user:pass@localhost:5432/sgrd) exists in CI; no real secret is present, so there is nothing to leak |
| T-01-SC | Tampering | npm/pip/cargo installs | low | accept | No new registry packages installed; workflow runs npm ci against existing lockfiles only; the two action tags were verified via git ls-remote in RESEARCH (Package Legitimacy Audit, both OK) |
</threat_model>

<verification>
Local: cd backend && npx vitest run prints Tests 17 passed (17); cd frontend && npm run build prints built in. CI: gh run list --limit 1 shows conclusion success on main with jobs backend and frontend both success. Scope: git status shows no changes under backend/src, frontend/src, or any .vue/CSS file.
</verification>

<success_criteria>
Roadmap success criteria 1 and 2 hold: every push/PR triggers a two-job check on Node 22 with per-package working directories, and the check passes on a clean checkout of the current codebase with no database service and no invented lint/typecheck commands.
</success_criteria>

## Artifacts this phase produces

| Artifact | Produced by | State after this plan |
|----------|-------------|----------------------|
| `.github/workflows/ci.yml` (workflow CI, jobs backend + frontend) | 01-01 (this plan) | Created, pushed, green |
| Red-proof evidence (`gh run list` showing backend failure + revert to green) | 01-02 | Not yet produced |
| Branch protection on main (required contexts backend, frontend; strict false; enforce_admins true) | 01-03 | Not yet produced |
| `AGENTS.md` regression-gate note (Portuguese voice, exact commands, strict revisit note, enforce_admins, GH006 recovery) | 01-03 | Not yet produced |

<output>
Create `.planning/phases/01-ci-regression-gate/01-01-ci-workflow-SUMMARY.md` when done
</output>
