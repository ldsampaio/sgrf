---
phase: "02"
slug: "rules-decisions-docs-14-close-out"
# status lifecycle: draft (seeded by plan-phase) → validated (set by validate-phase §6)
# audit-milestone §5.5 distinguishes NOT-VALIDATED (draft) from PARTIAL (validated + nyquist_compliant: false) (#2117)
status: draft
nyquist_compliant: false
wave_0_complete: false
created: "2026-09-23"
---

# Phase 02 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Docs-only phase: no requirement IDs, no code — validation is document verification, not test execution.
> Source: 02-RESEARCH.md ## Validation Architecture.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Backend vitest + frontend build — CI regression gate only (no phase tests) |
| **Config file** | none in this phase — markdown diff cannot break either job |
| **Quick run command** | `git diff --stat` (confirm only `docs/03-regras-de-negocio.md` + `docs/14-decisoes-em-aberto.md` changed) |
| **Full suite command** | N/A — no code changed; CI runs on the PR/push automatically |
| **Estimated runtime** | ~5 seconds |

---

## Sampling Rate

- **After every task commit:** Run `git diff --stat` — only the two doc files touched
- **After every plan wave:** N/A (single-commit phase)
- **Before `/gsd-verify-work`:** Reviewer read-through: each D-01…D-11 traceable to a doc sentence; D-09/D-10 deviations explicit; no `src/` in diff
- **Max feedback latency:** 5 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 02-01-01 | 02-01 | 1 | gate VOT-03 | — | N/A (docs) | manual | `grep -n "AGUARDANDO_ARBITRAGEM" docs/03-regras-de-negocio.md docs/14-decisoes-em-aberto.md` | ❌ W0 | ⬜ pending |
| 02-02-01 | 02-02 | 1 | gate VOT-04 | — | N/A (docs) | manual | `grep -n "request_cancelled\|provision_reversed\|REVERSE" docs/03-regras-de-negocio.md docs/14-decisoes-em-aberto.md` | ❌ W0 | ⬜ pending |
| 02-03-01 | 02-03 | 2 | gate VOT-03/VOT-04 | T-docs-01 | N/A (docs) | manual | `git diff --stat` — only docs/03 + docs/14 | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] None — no test infrastructure needed for a markdown-only commit. Characterization tests for the rules land in Phase 6 (06-03/06-04).

*Existing infrastructure covers all phase requirements.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| 4 docs/14 rows closed with date + rationale; docs/03 states 4+ rules prescriptively (D-01…D-11) | gate VOT-03/VOT-04 | Prose correctness, no executable assertion | Read-through: each D-01…D-11 traceable to a doc sentence; D-09 OVERRIDE + D-10 REJECT markers explicit with rationale; role strings match 5-role vocabulary exactly; no `src/` in diff; then `/gsd-verify-work` |
| Quorum/vista deviation recorded, not deferred (ROADMAP criterion #4 stale) | gate VOT-03/VOT-04 | Decision-record judgment | Confirm docs/14 quorum + vista rows marked closed/decided (not deferred to v2) with deviation rationale |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 5s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
