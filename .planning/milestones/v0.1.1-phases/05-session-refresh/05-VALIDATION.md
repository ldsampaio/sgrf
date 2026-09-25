---
phase: "05"
slug: "session-refresh"
# status lifecycle: draft (seeded by plan-phase) → validated (set by validate-phase §6)
# audit-milestone §5.5 distinguishes NOT-VALIDATED (draft) from PARTIAL (validated + nyquist_compliant: false) (#2117)
status: draft
nyquist_compliant: false
wave_0_complete: true
created: "2026-09-24"
---

# Phase 05 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | none — frontend has no tests (`npm test` exits 1 by design per AGENTS.md) |
| **Config file** | none — Wave 0 installs nothing |
| **Quick run command** | `cd frontend && npm run build` |
| **Full suite command** | `cd frontend && npm run build` (same; build IS the gate) |
| **Estimated runtime** | ~60 seconds |

---

## Sampling Rate

- **After every task commit:** Run `cd frontend && npm run build`
- **After every plan wave:** Run `cd frontend && npm run build`
- **Before `/gsd-verify-work`:** Build green + manual protocol 05-02 evidence recorded
- **Max feedback latency:** 60 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 05-01-01 | 01 | 1 | SES-01 | T-05-01 (refresh storm) | Single shared refresh promise; N parallel 401s → 1 refresh | manual | `cd frontend && npm run build` | ✅ | ⬜ pending |
| 05-01-02 | 01 | 1 | SES-01 | T-05-02 (retry loop) | `_retry` once-only; refresh bypasses interceptor; redirect-once flag | manual | `cd frontend && npm run build` | ✅ | ⬜ pending |
| 05-02-01 | 02 | 2 | SES-01 | — | Manual protocol: TTL 10s → 1 refresh/expiry; N parallel 401s → 1 refresh; dead cookie → 1 bounce + notice | manual | `cd frontend && npm run build` | ✅ | ⬜ pending |
| 05-03-01 | 03 | 3 | SES-01 | T-05-05 (open redirect) | `?redirect` internal-path-only; invalid → `/`; no router import in api.js | manual | `cd frontend && npm run build` | ✅ | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

Existing infrastructure covers all phase requirements — no test scaffolding (frontend has no test runner by design; verification is build + manual protocol).

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Silent refresh past 15m TTL, view stays put, no spinner/banner | SES-01 | No frontend test runner by design | Drop access TTL to ~10s → work continuously → network tab shows exactly one `POST /auth/refresh` per expiry, original request succeeds |
| Single-flight under concurrency | SES-01 | No frontend test runner by design | Fire N parallel 401s → exactly one refresh in network tab |
| Dead-cookie bounce once + notice + return-to-origin | SES-01 | No frontend test runner by design | Delete refresh cookie → exactly one navigation to `/login?reason=session-expired&redirect=…` showing `Sua sessão expirou. Entre novamente para continuar.`; login returns to origin; invalid `redirect` falls back to `/`; malformed snapshot opens empty form without blocking |
| No router import, 401-only, 403 passthrough | SES-01 | No frontend test runner by design | `grep` api.js for router import (absent); 403 `PASSWORD_CHANGE_REQUIRED` rejects untouched; network/5xx/429 never bounce |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 60s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
