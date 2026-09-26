---
schema_version: 1
open_count: 6
waived_count: 0
fixed_count: 0
total_count: 6
last_updated: 2026-09-25T18:46:18.174Z
---

# Broken Windows Ledger

> Cross-phase defect register. With `workflow.windows_enforce` enabled, `/gsd-ship` blocks while `open_count > 0`.
> Waive with `gsd-tools windows waive <id> "<reason>"` (reason required).
> Mark fixed with `gsd-tools windows fixed <id>`.

| id | phase | kind | file | line | description | status | reason | recorded_at | resolved_at |
|----|-------|------|------|------|-------------|--------|--------|-------------|-------------|
| 1 | 09 | deviation | tools/release-close/eligibility.test.js |  | 09-04 task 3 is test-only consolidation: no intentional RED was producible because all 19 matrix behaviors were already implemented by this plan's own task 1 and task 2 RED/GREEN cycles; load-bearing proof was a 3-mutation probe instead | open |  | 2026-09-25T16:50:35.301Z |  |
| 2 | 09 | deviation | tools/release-close/classify.test.js |  | 09-05 task 3 is test-only consolidation: no intentional RED was producible because all of its behaviors were already implemented by this plan's own task 1 and task 2 RED/GREEN cycles; load-bearing proof was a 6-mutation probe instead, which itself exposed one escaping probe (the ci.targetSha-vs-target guard) that the matrix row was rewritten to isolate | open |  | 2026-09-25T17:05:58.642Z |  |
| 3 | 09 | deviation | tools/release-close/canary.test.js |  | 09-06 task 3 is test-only: no intentional RED was producible because every behavior it asserts was already implemented by this plan's own task 1 and task 2 RED/GREEN cycles; load-bearing proof was a 15-mutation probe instead, which itself exposed one escaping probe (the integer/non-negative measurement guard, masked because both refusal paths throw TypeError) and one real defect (a grandchild that inherited NODE_TEST_CONTEXT exited zero regardless of the escape, making the canary a permanent false green) | open |  | 2026-09-25T17:21:24.441Z |  |
| 4 | 09 | deviation | tools/release-close/evidence.test.js |  | Tarefa 3 do plano 09-07 e somente-teste: nenhum RED intencional era produzivel, porque todo comportamento que ela afirma foi implementado pelas tarefas 1 e 2 do mesmo plano (verificado por sonda). A guarda foi provada load-bearing por uma sonda de 14 mutacoes de release-close.js, 14/14 pegas, fonte restaurada byte-identical. | open |  | 2026-09-25T17:41:45.043Z |  |
| 5 | 09 | deviation | tools/release-close/safe04.test.js |  | 09-08 task 3 is test-only: no intentional RED was producible because every behavior it asserts was already implemented by this plan's own task 1 and task 2 RED/GREEN cycles; load-bearing proof was an 18-mutation probe instead (11 in apply-gate.js, 7 in release-close.js), 18/18 caught, both sources restored byte-identical. M18 removes the rl.once('close') prompt listener and is caught by hang, which is exactly defect T-09-08-04. The first pass leaked one mutation (the CLI sink adapter returning a boolean instead of a character count), which is unreachable by behavior because runApply always serves the no-reviewed-content reference baseline; a source guard was added and M17 then caught. | open |  | 2026-09-25T18:26:51.489Z |  |
| 6 | 09 | deviation | tools/release-close/failure.test.js |  | TESTE-PLAO | open |  | 2026-09-25T18:46:18.174Z |  |

````json
[
  {
    "id": 1,
    "kind": "deviation",
    "phase": "09",
    "file": "tools/release-close/eligibility.test.js",
    "line": null,
    "description": "09-04 task 3 is test-only consolidation: no intentional RED was producible because all 19 matrix behaviors were already implemented by this plan's own task 1 and task 2 RED/GREEN cycles; load-bearing proof was a 3-mutation probe instead",
    "status": "open",
    "reason": "",
    "recorded_at": "2026-09-25T16:50:35.301Z",
    "resolved_at": null,
    "milestone": "v0.1.2"
  },
  {
    "id": 2,
    "kind": "deviation",
    "phase": "09",
    "file": "tools/release-close/classify.test.js",
    "line": null,
    "description": "09-05 task 3 is test-only consolidation: no intentional RED was producible because all of its behaviors were already implemented by this plan's own task 1 and task 2 RED/GREEN cycles; load-bearing proof was a 6-mutation probe instead, which itself exposed one escaping probe (the ci.targetSha-vs-target guard) that the matrix row was rewritten to isolate",
    "status": "open",
    "reason": "",
    "recorded_at": "2026-09-25T17:05:58.642Z",
    "resolved_at": null,
    "milestone": "v0.1.2"
  },
  {
    "id": 3,
    "kind": "deviation",
    "phase": "09",
    "file": "tools/release-close/canary.test.js",
    "line": null,
    "description": "09-06 task 3 is test-only: no intentional RED was producible because every behavior it asserts was already implemented by this plan's own task 1 and task 2 RED/GREEN cycles; load-bearing proof was a 15-mutation probe instead, which itself exposed one escaping probe (the integer/non-negative measurement guard, masked because both refusal paths throw TypeError) and one real defect (a grandchild that inherited NODE_TEST_CONTEXT exited zero regardless of the escape, making the canary a permanent false green)",
    "status": "open",
    "reason": "",
    "recorded_at": "2026-09-25T17:21:24.441Z",
    "resolved_at": null,
    "milestone": "v0.1.2"
  },
  {
    "id": 4,
    "kind": "deviation",
    "phase": "09",
    "file": "tools/release-close/evidence.test.js",
    "line": null,
    "description": "Tarefa 3 do plano 09-07 e somente-teste: nenhum RED intencional era produzivel, porque todo comportamento que ela afirma foi implementado pelas tarefas 1 e 2 do mesmo plano (verificado por sonda). A guarda foi provada load-bearing por uma sonda de 14 mutacoes de release-close.js, 14/14 pegas, fonte restaurada byte-identical.",
    "status": "open",
    "reason": "",
    "recorded_at": "2026-09-25T17:41:45.043Z",
    "resolved_at": null,
    "milestone": "v0.1.2"
  },
  {
    "id": 5,
    "kind": "deviation",
    "phase": "09",
    "file": "tools/release-close/safe04.test.js",
    "line": null,
    "description": "09-08 task 3 is test-only: no intentional RED was producible because every behavior it asserts was already implemented by this plan's own task 1 and task 2 RED/GREEN cycles; load-bearing proof was an 18-mutation probe instead (11 in apply-gate.js, 7 in release-close.js), 18/18 caught, both sources restored byte-identical. M18 removes the rl.once('close') prompt listener and is caught by hang, which is exactly defect T-09-08-04. The first pass leaked one mutation (the CLI sink adapter returning a boolean instead of a character count), which is unreachable by behavior because runApply always serves the no-reviewed-content reference baseline; a source guard was added and M17 then caught.",
    "status": "open",
    "reason": "",
    "recorded_at": "2026-09-25T18:26:51.489Z",
    "resolved_at": null,
    "milestone": "v0.1.2"
  },
  {
    "id": 6,
    "kind": "deviation",
    "phase": "09",
    "file": "tools/release-close/failure.test.js",
    "line": null,
    "description": "09-09 task 3 is test-only and adds no production source: no intentional RED was producible because every behavior it asserts was already implemented by this plan's own task 1 and task 2 RED/GREEN cycles. Load-bearing proof is a 23-mutation probe of reconcile.js (14) and release-close.js (9), 23/23 caught, both sources restored byte-identical (sha256 verified). The first pass leaked three mutations as VACUOUS, each for a different and real reason: M02 because the PERMISSION family (401/403) had no test at all; M18 because the reported bloqueio precedence is only observable when a blocking classification AND a seam refusal coincide; M20 because no failure family can reach runVerify on the CLI at all, since the CLI never passes a failure plan and the seam performs no read without one. Three probes were added for those families (a 403 state declared in the suite, a DUPLICATE-plus-refusal case, and a declared source guard for verify's exit code) and the re-run caught 23/23 with zero vacuous. The test-only task additionally needs no RED commit, which the commit log does not show.",
    "status": "open",
    "reason": "",
    "recorded_at": "2026-09-25T18:46:18.174Z",
    "resolved_at": null,
    "milestone": "v0.1.2"
  }
]
````
