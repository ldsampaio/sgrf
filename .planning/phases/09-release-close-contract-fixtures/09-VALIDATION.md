---
phase: "09"
slug: "release-close-contract-fixtures"
# status lifecycle: draft (seeded by plan-phase) → validated (set by validate-phase §6)
# audit-milestone §5.5 distinguishes NOT-VALIDATED (draft) from PARTIAL (validated + nyquist_compliant: false) (#2117)
status: validated
nyquist_compliant: true
wave_0_complete: true
created: "2026-09-25"
---

# Phase 09 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Seeded from 09-RESEARCH.md ## Validation Architecture (Nyquist enabled).

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | `node:test` stdlib (Node 22 per CI) + `node:assert/strict` |
| **Config file** | none — zero-dependency by design; invocation is the config |
| **Quick run command** | `node --test "tools/release-close/*.test.js"` |
| **Full suite command** | `node --test "tools/release-close/*.test.js"` (same; suite is seconds-scale, no DB/network) |
| **Estimated runtime** | ~5 seconds |

---

## Sampling Rate

- **After every task commit:** Run `node --test "tools/release-close/*.test.js"`
- **After every plan wave:** Run `node --test "tools/release-close/*.test.js"` + `cd backend && npx vitest run` (prove no collateral damage; backend untouched)
- **Before `/gsd-verify-work`:** Full tool suite green + backend vitest green + `gh`-surface grep tests green
- **Max feedback latency:** 60 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 09-01-* | 01 | 1 | OPS-01 | — | CLI exposes verify/plan/apply + --help; zero-dep package.json | CLI smoke | `node --test "tools/release-close/*.test.js"` | ✅ | ✅ green |
| 09-02-* | 02 | 1-2 | OPS-02 | — | Six states classified from fixtures; fake scripted sequences observable | unit (PT-BR names) | `node --test "tools/release-close/*.test.js"` | ✅ | ✅ green |
| 09-02-* | 02 | 2 | SAFE-02 | T-eligibility | Annotated-tag peel == main == expected SHA accepted; mismatches rejected; no ref-write path | unit + negative static test | `node --test "tools/release-close/*.test.js"` | ✅ | ✅ green |
| 09-03-* | 03 | 2-3 | SAFE-04 | T-apply-gate | verify/plan assert mutations:0 + zero writes; apply refuses without --yes/TTY/plan-visible | unit (write-trap) + gate tests | `node --test "tools/release-close/*.test.js"` | ✅ | ✅ green |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [x] `tools/release-close/package.json` — `{"type":"module"}`, zero deps (unblocks all ESM work)
- [x] `tools/release-close/{release-close,eligibility,classify,client,fake-client}.js` — implementation surface
- [x] `tools/release-close/fixtures/*.json` — reference + six state fixtures with frozen canonical values
- [x] `tools/release-close/*.test.js` — `node:test` suites (PT-BR names) incl. banned-token grep test + mutations-zero assertions
- [x] Framework install: none — stdlib only

*Planner refines task IDs per PLAN.md waves; this table is the requirement-level contract.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| None | — | The non-TTY refusal is automated, and the positive TTY path was additionally smoke-tested under a real pty during 09-03 | Automated coverage remains authoritative in `safe04.test.js` and `node --test "tools/release-close/*.test.js"` |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references
- [x] No watch-mode flags
- [x] Feedback latency < 60s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** approved 2026-09-25

## Validation Audit 2026-09-25

| Metric | Count |
|--------|-------|
| Gaps found | 0 |
| Resolved | 0 |
| Escalated | 0 |

Automated result: `node --test "tools/release-close/*.test.js"` — 57 passed, 0 failed.
