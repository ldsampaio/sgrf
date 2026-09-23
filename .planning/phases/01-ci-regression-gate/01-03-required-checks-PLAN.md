---
phase: 01-ci-regression-gate
plan: "03"
type: execute
wave: 3
depends_on:
  - 01-02
files_modified:
  - AGENTS.md
autonomous: true
requirements:
  - CI-01
requirements_addressed:
  - CI-01
estimate:
  tokens: 25000
  raw_tokens: 12500
  tasks: 2
  confidence: high
must_haves:
  truths:
    - "Branch protection on main lists required status check contexts exactly [backend, frontend], verified by gh api readback (not just the PUT response) per D-03"
    - "required_status_checks strict is false in the readback (per D-01), and required_pull_request_reviews and restrictions are null (per D-04, D-05)"
    - "enforce_admins is true in the same readback (per D-10, D-12) — admin pushes are also blocked when red"
    - "AGENTS.md records CI as the regression gate in Portuguese voice with the exact commands cd backend && npx vitest run and cd frontend && npm run build"
    - "AGENTS.md note records the strict:false choice with a revisit note (per D-02), the enforce_admins:true choice (per D-13), and the GH006 recovery path (per D-11)"
    - "No .vue file, stylesheet, or src file is created or modified by this plan"
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
    - AGENTS.md (regression-gate note appended/updated)
  key_links:
    - "Protection PUT requires a green workflow run in the past 7 days (plans 01-01/01-02 satisfy this) or GitHub rejects the contexts (RESEARCH Pitfall 3)"
    - "Contexts backend + frontend must equal the explicit job name: fields from 01-01, otherwise PRs show no required checks (RESEARCH Pitfall 7)"
    - "enforce_admins true means a red main blocks even admin pushes — the AGENTS.md note must document the GH006 recovery path (D-11)"
---

<objective>
**As a** solo developer with a proven-but-optional CI gate, **I want to** mark the backend and frontend checks required on main and record CI as the regression gate in AGENTS.md, **so that** no later fix in this milestone ships unverified — including admin hotfixes (per CI-01 and D-01..D-13).

Purpose: Enforcement — convert the proven workflow into a blocking required check, then write the human-facing contract into AGENTS.md.
Output: Branch protection active on main (verified by API readback) plus an AGENTS.md regression-gate note, committed and pushed.
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
</context>

<tasks>

<task type="auto">
  <name>Task 1: Enable branch protection with exact locked payload, verify by readback</name>
  <files>AGENTS.md</files>
  <read_first>.planning/phases/01-ci-regression-gate/01-CONTEXT.md (D-01 strict false, D-03 readback rule, D-04 reviews null, D-05 restrictions null, D-10 enforce_admins true, D-12 enforce_admins readback), .planning/phases/01-ci-regression-gate/01-RESEARCH.md (Mark the checks required — gh api payload and verify command)</read_first>
  <action>Precondition check first: require that plan 01-02 completed (red-proof done and reverted) and that gh run list --limit 1 shows a success run on main within the past 7 days; if not, stop and report instead of setting protection. Then run gh api -X PUT repos/ldsampaio/sgrf/branches/main/protection with exactly these body fields: required_status_checks strict false plus contexts backend and frontend (two contexts entries, exact lowercase, matching the job name: fields from 01-01), enforce_admins true, required_pull_request_reviews null, restrictions null. Then verify with a fresh readback (not the PUT response): gh api repos/ldsampaio/sgrf/branches/main/protection with jq showing .required_status_checks.contexts equals ["backend","frontend"], .required_status_checks.strict equals false, .enforce_admins indicates enabled true, .required_pull_request_reviews is null, and .restrictions is null. If the gh token lacks scope, stop and report the documented UI fallback path instead of improvising a different payload. This task makes no file edit; AGENTS.md is listed because the readback outputs are recorded there in Task 2.</action>
  <reversibility rating="reversible">Branch protection is a repo setting, not code; it can be relaxed or removed later via the same gh api PUT or the Settings UI.</reversibility>
  <acceptance_criteria>PUT exits 0; readback gh api repos/ldsampaio/sgrf/branches/main/protection --jq '.required_status_checks.contexts' prints exactly ["backend","frontend"]; readback --jq '.required_status_checks.strict' prints false; readback --jq '.enforce_admins' shows enabled true; readback --jq '.required_pull_request_reviews' prints null; readback --jq '.restrictions' prints null; all five readback outputs pasted into the plan SUMMARY.</acceptance_criteria>
  <verify>
    <automated>gh api repos/ldsampaio/sgrf/branches/main/protection --jq '.required_status_checks.contexts | join(",")'</automated>
    <fails_when>Output is anything other than backend,frontend, or gh exits non-zero printing Branch not protected or Not Found</fails_when>
    <automated>gh api repos/ldsampaio/sgrf/branches/main/protection --jq '"\(.required_status_checks.strict) \(.enforce_admins.enabled // .enforce_admins)"'</automated>
    <fails_when>Output is not false true, or gh exits non-zero</fails_when>
  </verify>
  <done>Main requires backend + frontend checks with strict false and enforce_admins true; reviews and restrictions null; all proven by readback.</done>
</task>

<task type="auto">
  <name>Task 2: Record CI as the regression gate in AGENTS.md</name>
  <files>AGENTS.md</files>
  <read_first>AGENTS.md (full file — preserve the existing Portuguese voice, the exact verify commands, and the never-commit list; only extend the Testes/verificacao section and add the gate note)</read_first>
  <action>Edit AGENTS.md with two changes and nothing else. First, update the line Sem lint/typecheck/CI configurados; não invente esses comandos so it no longer claims CI is unconfigured — new wording states CI lives in .github/workflows/ci.yml (backend job plus frontend job, required on main) while keeping the ban on inventing lint/typecheck commands. Second, add a short regression-gate note in the existing Portuguese voice containing all of: the exact commands cd backend && npx vitest run and cd frontend && npm run build; the required contexts backend and frontend on main; the strict:false choice with a revisit note for when PRs become the norm (per D-02); the enforce_admins:true choice (per D-13); and the GH006 recovery path — re-run the failed workflow, or open a PR with the fix, or temporarily disable the rule (per D-11). Do not touch any .vue, CSS, backend/src, or frontend/src file; do not invent lint/typecheck commands; keep every existing AGENTS.md line not covered above byte-identical.</action>
  <acceptance_criteria>AGENTS.md contains the exact string cd backend && npx vitest run and the exact string cd frontend && npm run build; grep -c 'enforce_admins' prints at least 1; grep -c 'GH006' prints at least 1; grep -ci 'strict' prints at least 1 alongside a revisit/PR wording; grep for the old claim Sem lint/typecheck/CI configurados prints nothing; git diff --stat shows only AGENTS.md modified; cd backend && npx vitest run still prints Tests 17 passed (17) after the docs edit.</acceptance_criteria>
  <verify>
    <automated>grep -c 'enforce_admins' AGENTS.md && grep -c 'GH006' AGENTS.md</automated>
    <fails_when>Either printed count is 0, meaning the enforce_admins record or the GH006 recovery path is missing from the note</fails_when>
    <automated>grep -c 'Sem lint/typecheck/CI configurados' AGENTS.md; test $? -eq 1</automated>
    <fails_when>The test exits non-zero, meaning the stale no-CI claim is still present</fails_when>
    <automated>cd backend && npx vitest run</automated>
    <fails_when>Output lacks the string Tests 17 passed (17), or the command exits non-zero</fails_when>
  </verify>
  <done>AGENTS.md documents CI as the required regression gate with all five locked record items (D-02, D-11, D-13 plus exact commands); commit the docs edit and push to origin main (protection now requires green — the push itself re-verifies the gate).</done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| Any push to main → required checks | Unverified code must not land; enforce_admins closes the admin-bypass hole |
| Docs note → future developer behavior | A stale or missing note lets someone disable the gate without understanding GH006 recovery |

## STRIDE Threat Register

| Threat ID | Category | Component | Severity | Disposition | Mitigation Plan |
|-----------|----------|-----------|----------|-------------|-----------------|
| T-01-06 | Tampering | direct push to main bypassing CI | high | mitigate | enforce_admins true (D-10) so admin pushes are blocked when red; verified by readback in Task 1 |
| T-01-07 | Repudiation | gate silently disabled later | medium | mitigate | AGENTS.md note records who-chose-what (strict false, enforce_admins true) with rationale, so a future change is deliberate and reviewed |
| T-01-08 | Denial of Service | GH006 lockout (red main blocks the fix push) | medium | mitigate | GH006 recovery path documented in AGENTS.md (re-run workflow, PR the fix, or temporarily disable the rule) per D-11 |
| T-01-SC | Tampering | npm/pip/cargo installs | low | accept | No package installs in this plan; nothing to audit |
</threat_model>

<verification>
API: gh api readback shows contexts ["backend","frontend"], strict false, enforce_admins enabled, reviews null, restrictions null. Docs: AGENTS.md contains exact verify commands, enforce_admins, GH006, and strict revisit wording; stale no-CI claim gone. Suite: cd backend && npx vitest run prints Tests 17 passed (17). Push of the docs commit passes the newly required checks.
</verification>

<success_criteria>
CI-01 fully holds: the two-job pipeline runs on every push/PR as a required check on main (strict false, admins enforced, no reviews/restrictions per D-01..D-13), and CI is recorded as the regression gate in AGENTS.md — so no later fix in this milestone ships unverified.
</success_criteria>

## Artifacts this phase produces

| Artifact | Produced by | State after this plan |
|----------|-------------|----------------------|
| `.github/workflows/ci.yml` (workflow CI, jobs backend + frontend) | 01-01 | Created, pushed, green |
| Red-proof evidence (`gh run list` showing backend failure + revert to green) | 01-02 | Produced; unit.test.js ends unchanged |
| Branch protection on main (required contexts backend, frontend; strict false; enforce_admins true) | 01-03 (this plan) | Active, verified by readback |
| `AGENTS.md` regression-gate note (Portuguese voice, exact commands, strict revisit note, enforce_admins, GH006 recovery) | 01-03 (this plan) | Committed and pushed |

<output>
Create `.planning/phases/01-ci-regression-gate/01-03-required-checks-SUMMARY.md` when done
</output>
