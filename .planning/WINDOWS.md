---
schema_version: 1
open_count: 3
waived_count: 0
fixed_count: 0
total_count: 3
last_updated: 2026-09-25T17:21:24.441Z
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
  }
]
````
