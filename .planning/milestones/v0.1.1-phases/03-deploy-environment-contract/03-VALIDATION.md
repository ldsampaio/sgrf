---
phase: "03"
slug: "deploy-environment-contract"
# status lifecycle: draft (seeded by plan-phase) → validated (set by validate-phase §6)
# audit-milestone §5.5 distinguishes NOT-VALIDATED (draft) from PARTIAL (validated + nyquist_compliant: false) (#2117)
status: draft
nyquist_compliant: false
wave_0_complete: false
created: "2026-09-23"
---

# Phase 03 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest (backend; suites `batch`, `unit`, `voting` per AGENTS.md) |
| **Config file** | none — convention via `package.json` script |
| **Quick run command** | `cd backend && npx vitest run` |
| **Full suite command** | `cd backend && npx vitest run` (same; single suite < 30s expected) |
| **Estimated runtime** | ~30 seconds |

---

## Sampling Rate

- **After every task commit:** Run `cd backend && npx vitest run`
- **After every plan wave:** Run `cd backend && npx vitest run` + `cd frontend && npm run build` (frontend untouched, build as regression guard)
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 60 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 03-01-01 | 01 | 1 | SEC-02 | Placeholder secret deployed to prod (Spoofing) | `NODE_ENV=production` + insecure values → `throw` listing offending vars | unit | `cd backend && npx vitest run tests/env-gate.test.js` | ❌ W0 | ⬜ pending |
| 03-01-02 | 01 | 1 | SEC-02 | Same as above | Non-production keeps dev fallbacks (no throw) | unit | `cd backend && npx vitest run tests/env-gate.test.js` | ❌ W0 | ⬜ pending |
| 03-02-01 | 02 | 1 | SEC-04 | Session cookie stolen over plaintext (Info disclosure) | `COOKIE_SECURE` absent follows `NODE_ENV`; explicit `'false'` wins in prod | unit | `cd backend && npx vitest run tests/env-gate.test.js` | ❌ W0 | ⬜ pending |
| 03-02-02 | 02 | 2 | SEC-04 | Same as above | Login round-trip on public `https://` URL (manual — needs Tunnel + secrets) | manual | Human checklist on operator host | manual | ⬜ pending |
| 03-03-01 | 03 | 2 | Contract | — | `./start-dev.sh` dev flow intact (manual smoke per checklist) | manual | `./start-dev.sh` boot + login on `localhost:5173` | manual | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `backend/tests/env-gate.test.js` — stubs for SEC-02 throw/no-throw matrix + COOKIE_SECURE parse (needs `NODE_ENV` save/restore + module registry reset with dynamic `require`, since gate runs at load)
- [ ] CI dummy env: `JWT_ACCESS_SECRET`/`JWT_REFRESH_SECRET` (+ `INITIAL_ADMIN_*`) in backend job `env:` of `.github/workflows/ci.yml` — one-line belt-and-braces per plan 03-01

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Login round-trip on public `https://` URL | SEC-04 | Requires real edge TLS + real secrets; cannot automate in CI | Human checklist on operator host through Cloudflare Tunnel |
| `./start-dev.sh` dev flow intact | Contract | Shell orchestration | `./start-dev.sh` boot + login on `localhost:5173` per checklist doc |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 60s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
