# Phase 1: CI Regression Gate - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-09-23
**Phase:** 1-CI Regression Gate
**Areas discussed:** Protection strictness, Red-proof method, Admin enforcement

---

## Gray-area selection

| Option | Description | Selected |
|--------|-------------|----------|
| Protection strictness | Require branches up-to-date before merge? | ✓ |
| Red-proof method | Direct break-push-revert vs PR-based proof? | ✓ |
| Admin enforcement | Admin pushes gated too? | ✓ |

**User's choice:** All three areas selected.

---

## Protection strictness

| Option | Description | Selected |
|--------|-------------|----------|
| strict: false | Single-dev direct-push flow, less churn | ✓ |
| strict: true | Re-test after every main push, stricter but more CI minutes | |

**User's choice:** strict: false
**Notes:** None.

| Option | Description | Selected |
|--------|-------------|----------|
| Record + revisit note | Note strict:false + revisit when PRs become norm in AGENTS.md | ✓ |
| Set silently | Just set it, no docs note | |

**User's choice:** Record + revisit note
**Notes:** None.

| Option | Description | Selected |
|--------|-------------|----------|
| Verify readback | Verify via gh api readback that strict is false | ✓ |
| No readback | Trust the PUT response, no readback | |

**User's choice:** Verify readback
**Notes:** None.

| Option | Description | Selected |
|--------|-------------|----------|
| No reviews required | No required reviews, checks alone gate merges | ✓ |
| Require 1 review | Require 1 review plus checks | |

**User's choice:** No reviews required
**Notes:** None.

| Option | Description | Selected |
|--------|-------------|----------|
| No push restrictions | Nobody restricted, any collaborator can push subject to checks | ✓ |
| Restrict pushes | Restrict pushes to specific users/teams | |

**User's choice:** No push restrictions
**Notes:** Asked after a "More questions" continuation; then moved to next area.

---

## Red-proof method

| Option | Description | Selected |
|--------|-------------|----------|
| Direct on main | Direct commit to main, push, watch red, revert, push (matches branching_strategy none) | ✓ |
| PR-based proof | Open a PR with the break, watch checks fail, close unmerged | |

**User's choice:** Direct on main
**Notes:** None.

| Option | Description | Selected |
|--------|-------------|----------|
| Break unit.test.js | Flip one assertion in backend/tests/unit.test.js line 8 to 'WRONG' | ✓ |
| Break voting test | Break a voting tally assertion instead | |
| Break frontend build | Break frontend build (e.g. bad import in a view) | |

**User's choice:** Break unit.test.js
**Notes:** None.

| Option | Description | Selected |
|--------|-------------|----------|
| git revert | git revert HEAD + push, watch green again | ✓ |
| Manual fix | Manual re-edit + amend + force push | |

**User's choice:** git revert
**Notes:** None.

| Option | Description | Selected |
|--------|-------------|----------|
| gh run evidence | gh run list showing backend: failure + post-revert green | ✓ |
| UI screenshots | GitHub UI screenshots of the red check | |
| Both | Both CLI output and UI links | |

**User's choice:** gh run evidence
**Notes:** None.

---

## Admin enforcement

| Option | Description | Selected |
|--------|-------------|----------|
| enforce_admins: true | Admin pushes also blocked when red — a real gate | ✓ |
| enforce_admins: false | Admin bypasses checks for hotfixes | |

**User's choice:** enforce_admins: true
**Notes:** None.

| Option | Description | Selected |
|--------|-------------|----------|
| Document recovery | Re-run failed workflow, or PR the fix, or temporarily disable rule | ✓ |
| No recovery note | Leave recovery to GitHub docs, no local note | |

**User's choice:** Document recovery
**Notes:** GH006 recovery path goes into AGENTS.md.

| Option | Description | Selected |
|--------|-------------|----------|
| Verify readback | Assert enforce_admins + contexts via protection readback | ✓ |
| Contexts only | Trust the PUT, verify contexts only | |

**User's choice:** Verify readback
**Notes:** None.

| Option | Description | Selected |
|--------|-------------|----------|
| Note in AGENTS.md | Lock it in 01-03's AGENTS.md note | ✓ |
| Silent | Set it silently, no note | |

**User's choice:** Note in AGENTS.md
**Notes:** None.

---

## the agent's Discretion

- Exact workflow YAML shape, commit messages for break/revert, exact AGENTS.md note wording — follow 01-RESEARCH.md Code Examples + repo Portuguese voice.

## Deferred Ideas

None — discussion stayed within phase scope.
