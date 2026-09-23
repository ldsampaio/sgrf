---
phase: 01-ci-regression-gate
plan: "02"
type: execute
wave: 2
depends_on:
  - 01-01
files_modified:
  - backend/tests/unit.test.js
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
    - "Flipping backend/tests/unit.test.js line 8 to expect 'WRONG' and pushing to main turns the backend check red (failure visible in gh run list CLI output per D-09)"
    - "Running git revert HEAD plus push restores main to green with no amend and no force-push (per D-08)"
    - "After the revert, backend/tests/unit.test.js is byte-identical to its pre-break state and cd backend && npx vitest run passes 17/17 locally"
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
    - backend/tests/unit.test.js (temporary break, reverted — ends unchanged)
  key_links:
    - "Break targets line 8 only (normalizeEmail assertion flipped to 'WRONG' per D-07) — no other assertion is touched"
    - "Direct break-push-revert on main per D-06 (branching_strategy none) — protection must NOT be enabled yet or GH006 blocks the revert push (RESEARCH Pitfall 4)"
    - "Undo is git revert HEAD plus push per D-08 — amend or force-push would rewrite main history"
---

<objective>
**As a** solo developer who just landed an unproven CI workflow, **I want to** deliberately break one test on main, watch the backend check go red, then revert to green, **so that** the gate is proven to actually catch regressions before it becomes required (per CI-01 success criterion 3 and D-06..D-09).

Purpose: Negative proof — a gate that has never gone red is unproven. Must run BEFORE plan 01-03 enables protection (GH006 ordering is load-bearing).
Output: `gh run list` CLI evidence of backend failure on the break commit, followed by a green run on the revert commit; unit.test.js ends unchanged.
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
@backend/tests/unit.test.js
</context>

<tasks>

<task type="auto">
  <name>Task 1: Break line 8, push, confirm the backend check goes red</name>
  <files>backend/tests/unit.test.js</files>
  <read_first>backend/tests/unit.test.js (line 8 is the break target per D-07), .planning/phases/01-ci-regression-gate/01-CONTEXT.md (D-06 direct break-push-revert on main, D-07 exact break, D-09 CLI evidence rule)</read_first>
  <action>Edit only line 8 of backend/tests/unit.test.js, changing the expected value from 'a@utfpr.edu.br' to 'WRONG' so the line reads expect(normalizeEmail('A@Utfpr.Edu.Br ')).toBe('WRONG'); touch no other line and no other file. Run cd backend && npx vitest run locally and require exactly 1 failed test. Then git add backend/tests/unit.test.js, commit with message ci: deliberate break to prove the gate, push to origin main. Then poll gh run list --limit 2 until a run for the break commit shows the backend job failed, and record the run id and URL as the red evidence.</action>
  <reversibility rating="reversible">Single-assertion flip on one test file; fully undone by git revert HEAD plus push in Task 2, which is part of this same plan.</reversibility>
  <acceptance_criteria>Line 8 of backend/tests/unit.test.js contains the exact string toBe('WRONG'); local vitest output contains 1 failed and 16 passed; git log --oneline -1 on main shows the deliberate-break commit; gh run list --limit 2 shows a run on the break commit whose backend job conclusion is failure (CLI output saved as evidence in the plan SUMMARY).</acceptance_criteria>
  <verify>
    <automated>grep -c "toBe('WRONG')" backend/tests/unit.test.js</automated>
    <fails_when>Printed count is not 1, meaning the break is missing or applied more than once</fails_when>
    <automated>gh run list --limit 2 --json conclusion,headBranch,status --jq '[.[] | select(.conclusion=="failure")] | length'</automated>
    <fails_when>Printed length is 0 (no failed run visible yet), or gh exits non-zero printing Could not resolve to a Repository</fails_when>
  </verify>
  <done>Break commit is on main and the backend check is red in CI; red evidence captured.</done>
</task>

<task type="auto">
  <name>Task 2: Revert the break, push, confirm main is green</name>
  <files>backend/tests/unit.test.js</files>
  <read_first>backend/tests/unit.test.js (must return to pre-break state), .planning/phases/01-ci-regression-gate/01-CONTEXT.md (D-08 revert rule: git revert HEAD plus push, no amend or force-push)</read_first>
  <action>Run git revert HEAD with --no-edit, then push to origin main (plain git push; no --force, no amend anywhere in this plan). Then run cd backend && npx vitest run locally requiring Tests 17 passed (17), and poll gh run list --limit 1 plus gh run watch on the revert run until it completes with conclusion success and both backend and frontend jobs success. Finally confirm the file is restored: grep line 8 for toBe('a@utfpr.edu.br') and confirm git diff of backend/tests/unit.test.js against the pre-break commit is empty.</action>
  <acceptance_criteria>git log --oneline -2 shows a Revert commit on top of the break commit (history preserved, no rewrite); line 8 contains toBe('a@utfpr.edu.br') and no occurrence of WRONG remains in the file; local vitest output contains Tests 17 passed (17); gh run list --limit 1 shows conclusion success on the revert commit with backend and frontend jobs success.</acceptance_criteria>
  <verify>
    <automated>cd backend && npx vitest run</automated>
    <fails_when>Output lacks the string Tests 17 passed (17), or the command exits non-zero</fails_when>
    <automated>grep -c "WRONG" backend/tests/unit.test.js; test $? -eq 1</automated>
    <fails_when>The test exits non-zero, meaning the string WRONG still appears in the file after the revert</fails_when>
    <automated>gh run list --limit 1 --json conclusion,status,headBranch --jq '.[0] | "\(.headBranch) \(.status) \(.conclusion)"'</automated>
    <fails_when>Output is not main completed success, or gh exits non-zero printing Could not resolve to a Repository</fails_when>
  </verify>
  <done>Main is green again on the revert commit; unit.test.js byte-identical to pre-break; plan 01-03 is unblocked (green run within 7 days plus completed red-proof).</done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| main branch head → CI required-check future state | A red main must never be locked in by protection; prove-then-enforce ordering keeps the revert push unblocked |

## STRIDE Threat Register

| Threat ID | Category | Component | Severity | Disposition | Mitigation Plan |
|-----------|----------|-----------|----------|-------------|-----------------|
| T-01-02 | Tampering | backend/tests/unit.test.js break commit | medium | mitigate | Break is one assertion on line 8 only (D-07); no src file touched; revert restores byte-identical state verified by grep |
| T-01-04 | Denial of Service | revert push blocked (GH006) | high | mitigate | Red-proof runs entirely before plan 01-03 enables protection, so no required check exists to block the revert push (RESEARCH Pitfall 4) |
| T-01-05 | Tampering | always-green bypass (gate that never fails) | medium | mitigate | This plan is the mitigation itself: the red run proves the backend check runs the real npx vitest run, not a vacuous pass |
| T-01-SC | Tampering | npm/pip/cargo installs | low | accept | No package installs in this plan; nothing to audit |
</threat_model>

<verification>
Red: gh run list --limit 2 shows a failure run on the break commit with backend job failure (evidence pasted in SUMMARY). Green: gh run list --limit 1 shows success on the revert commit; local cd backend && npx vitest run prints Tests 17 passed (17); grep WRONG in unit.test.js prints nothing. Scope: git status shows only the two expected commits; no src or .vue file modified.
</verification>

<success_criteria>
Roadmap success criterion 3 holds: a deliberately broken test turned the check red — proven by gh run list CLI output showing backend failure — and the revert restored green, so the gate is proven non-vacuous before enforcement.
</success_criteria>

## Artifacts this phase produces

| Artifact | Produced by | State after this plan |
|----------|-------------|----------------------|
| `.github/workflows/ci.yml` (workflow CI, jobs backend + frontend) | 01-01 | Created, pushed, green |
| Red-proof evidence (`gh run list` showing backend failure + revert to green) | 01-02 (this plan) | Produced; unit.test.js ends unchanged |
| Branch protection on main (required contexts backend, frontend; strict false; enforce_admins true) | 01-03 | Not yet produced |
| `AGENTS.md` regression-gate note (Portuguese voice, exact commands, strict revisit note, enforce_admins, GH006 recovery) | 01-03 | Not yet produced |

<output>
Create `.planning/phases/01-ci-regression-gate/01-02-red-proof-SUMMARY.md` when done
</output>
