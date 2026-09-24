---
phase: 05-session-refresh
plan: 02
subsystem: auth
tags: [axios, interceptor, session-refresh, manual-protocol, draft-restore, vue]

# Dependency graph
requires:
  - phase: 05-session-refresh
    provides: 05-01 single-flight 401 interceptor + draft lifecycle + Login notice/redirect round-trip
  - phase: 05-session-refresh
    provides: 05-04 WR-01/WR-02/WR-03 fixes (regex auth bypass, same-page bounce guard, TYPES allowlist)
  - phase: 05-session-refresh
    provides: 05-03 structural regression evidence (single-instance interceptor, 401-strict gate, navigation-free service)
provides:
  - Phase DoD evidence: all Part A + Part B protocol checks PASS with observed facts (SES-01 proven in a live browser)
  - Bounce-loop defect found during protocol, fixed by 56526f2 (doBounce early-return on /login)
affects: [phase-08-forced-password-change, session-refresh verification]

# Actuals (#2632) — pairs with the plan's `estimate` to calibrate future estimates.
actuals:
  tokens: 3015
  tasks: 2
  commits: 1

# Tech tracking
tech-stack:
  added: []
  patterns: [manual-protocol-as-DoD, temporary-TTL-rig-with-unconditional-revert]

key-files:
  created: [.planning/phases/05-session-refresh/05-02-SUMMARY.md]
  modified: []

key-decisions:
  - "Protocol ran against 05-01 + 05-04 + loop-fix 56526f2 code; operator observations are valid for the final tree"
  - "TTL 10s rig edit reverted unconditionally; backend/src verified clean at sign-off"

patterns-established:
  - "Temporary TTL rig: LOCAL-ONLY backend edit, unconditional revert, clean `git status` on backend paths before sign-off"

requirements-completed: [SES-01]

# Coverage metadata (#1602)
coverage:
  - id: D1
    description: "Silent single-flight refresh: exactly one POST /auth/refresh per expiry, view stable, N parallel 401s collapse to one refresh with all originals succeeding"
    requirement: "SES-01"
    verification:
      - kind: manual_procedural
        ref: "TTL-10s rig: 401 on expiry, 200 refresh, 401 without cookie; network tab one refresh per expiry; N-parallel 401s one refresh"
        status: pass
    human_judgment: true
    rationale: "The frontend has no test runner by design (AGENTS.md); single-flight timing and network-tab request counts are observable only in a live browser"
  - id: D2
    description: "Dead-cookie bounce: exactly one navigation to /login?reason=session-expired&redirect=<origin> with locked notice in .alert.warn[role=status]"
    requirement: "SES-01"
    verification:
      - kind: manual_procedural
        ref: "Operator browser check (3): one bounce, locked copy verbatim, role=status"
        status: pass
    human_judgment: true
    rationale: "Bounce count, notice copy, and ARIA roles require human observation in a live browser"
  - id: D3
    description: "Notice/error role separation, refresh-after-notice URL cleanup, login return-to-origin with draft restore"
    requirement: "SES-01"
    verification:
      - kind: manual_procedural
        ref: "Operator browser checks (4)(5)(6): warn preserved + error stacked, query cleaned, origin landing + draft restored"
        status: pass
    human_judgment: true
    rationale: "Role separation and draft round-trip behavior require live observation"
  - id: D4
    description: "Redirect validation (off-origin fallback to /), corrupt-snapshot resilience, plain /login shows no notice"
    requirement: "SES-01"
    verification:
      - kind: manual_procedural
        ref: "Operator browser checks (7)(8)(9): fallback to /, empty form unblocked, no notice on plain visit"
        status: pass
    human_judgment: true
    rationale: "Open-redirect fallback and tampered-slot behavior require live probing"

# Metrics
duration: 25min
completed: 2026-09-24
status: complete
---

# Phase 05 Plan 02: Manual Verification Protocol Summary

**SES-01 proven in a live browser: single-flight silent refresh, bounce-once with locked notice, validated return-to-origin with draft restore — all 11 checks PASS, TTL rig reverted, build green**

## Performance

- **Duration:** ~25 min (continuation: verify + revert + build/greps + summary)
- **Started:** 2026-09-24T20:45:00Z
- **Completed:** 2026-09-24T21:10:00Z
- **Tasks:** 2 (Part A scripted half + Part B human checkpoint, approved)
- **Files modified:** 0 source files (protocol-only plan; SUMMARY only)

## Code Under Test (record explicitly)

The operator observations below ran AGAINST the tree at `56526f2` = **05-01 + 05-04 (commits `7adc567`, `dda9127`, `d0487dd`) + loop fix `56526f2`** (`fix(05-02): stop bounce loop — doBounce returns early when already on /login`). That loop fix was a defect found during this protocol's own execution: `window.location.assign()` is a full reload that resets the module-level `isRedirecting` flag, so bouncing from `/login` re-triggered itself forever (router `beforeEach` → `auth.me()` → 401 → failed refresh → `doBounce()` again). The fix returns early from `doBounce()` when already on `/login` and hardens the same-page guard to `origin.startsWith('/login')`. All 9 operator checks below were observed with this fix in place, so they are valid for the final tree.

## Accomplishments

- **Part A PASS (scripted half):** with the LOCAL-ONLY TTL-10s rig, backend behavior proven — 401 on expiry, 200 on refresh, 401 without cookie; network tab showed exactly one `POST /auth/refresh` per expiry with the view stable (no spinner, banner, navigation, or lost form state); N parallel 401s collapsed to exactly one refresh with all original requests succeeding
- **Part B PASS (9/9 operator browser checks):** dead-cookie bounce, notice, role separation, URL cleanup, return-to-origin + draft restore, off-origin fallback, corrupt-slot resilience, plain-login silence — zero FAILs, zero new defects
- **Rig hygiene:** temporary TTL edit (`15m` → `10s` in `backend/src/utils/tokens.js`) unconditionally reverted; `git diff -- backend/src/` empty at sign-off
- **Post-protocol structural proof:** `cd frontend && npm run build` green (106 modules, ~563ms) + all 05-03 regression greps + all 05-04 structural greps resolve (observed outputs below)

## Protocol Evidence

### Part A — silent refresh + single-flight (scripted half, prior session)

| Check | Observed | Result |
|-------|----------|--------|
| Build green before rig | `cd frontend && npm run build` green | PASS |
| TTL-10s expiry | authenticated call after expiry → 401 | PASS |
| Refresh round-trip | `POST /auth/refresh` → 200, original retried OK | PASS |
| No-cookie refresh | `POST /auth/refresh` without cookie → 401 | PASS |
| One refresh per expiry | network tab: exactly one `POST /auth/refresh` per 10s expiry, view stays put, no spinner/banner/navigation, form state preserved | PASS |
| N parallel 401s | exactly one refresh in network tab, all original requests succeed | PASS |
| Structural greps match | single-flight `??=`, 401-strict gate, bypass regex (05-04 state) | PASS |

### Part B — bounce, notice, return-to-origin, draft restore (operator, approved)

| # | Check | Observed | Result |
|---|-------|----------|--------|
| 1 | One refresh per expiry | one `POST /auth/refresh` per 10s expiry, view stable | PASS |
| 2 | Concurrency collapse | N-parallel 401s → one refresh, originals succeed | PASS |
| 3 | Dead-cookie bounce | exactly one bounce to `/login?reason=session-expired&redirect=<origin>` with locked notice `Sua sessão expirou. Entre novamente para continuar.` in `.alert.warn[role=status]` | PASS |
| 4 | Role separation | typing preserves notice; wrong-password stacks credential error in `div.alert.error[role=alert]` without touching warn | PASS |
| 5 | URL cleanup | refresh-after-notice cleans query from URL | PASS |
| 6 | Return + restore | login lands back on origin with draft restored | PASS |
| 7 | Off-origin fallback | crafted off-origin redirect → falls back to `/`, no off-origin navigation | PASS |
| 8 | Corrupt slot | corrupt `sgrf:pending-draft` slot → empty form, login/redirect unblocked | PASS |
| 9 | Plain login silence | plain `/login` shows no notice | PASS |

**Failures: none. No FAILs, no new defects.**

## Task Commits

No source commits — this is a protocol-only plan (`files_modified: []`). The only defect found during execution (bounce loop) was fixed and committed as `56526f2` during the protocol run, before the operator's 9 checks.

1. **Task 1: Protocol part A** — COMPLETE (scripted half, prior session; TTL rig since reverted)
2. **Task 2: Protocol part B** — COMPLETE (human checkpoint approved, 9/9 PASS)

**Plan metadata:** this commit (docs: complete plan)

## Files Created/Modified

- `.planning/phases/05-session-refresh/05-02-SUMMARY.md` - this file (protocol evidence record)
- `backend/src/utils/tokens.js` - LOCAL-ONLY TTL edit applied and **fully reverted**; zero net diff
- `frontend/src/services/api.js` - loop fix `56526f2` (committed during protocol, before operator checks)

## Decisions Made

- Operator observations recorded as valid for the final tree because they ran against 05-01 + 05-04 + loop-fix code (recorded explicitly per resume instructions).
- Commit made directly on `main`: project config sets `git.branching_strategy: "none"` and every prior phase commit in this milestone sits on `main`; no worktree in play.

## Deviations from Plan

None - plan executed exactly as written. The bounce-loop defect found mid-protocol was fixed (`56526f2`) and the operator checks ran against the fixed code; the fix itself is tracked as the protocol doing its job (failures route back to fixes, per the plan objective), not as a scope deviation.

## Post-Protocol Verification (observed outputs, 2026-09-24T20:45Z)

Build green (`106 modules transformed`, `✓ built in 563ms`):

- 05-03 regression: `grep -rln "interceptors" src` → `src/services/api.js` only; `grep -rln "_retry" src` → `src/services/api.js` only; `grep -rn "status.*401|_retry|interceptors" src/views/ src/stores/ src/router/` → no hits; no router import in service (only the never-import-router comment + bounce-loop comment)
- 05-04 structural: bypass regex line 40 `/\/auth\/(login|refresh|register)/`; `/login` early-return line 24 + `startsWith('/login')` guard; `TYPES` allowlist lines 71-72 in Requests.vue; 401-strict gate line 37; `??=` single-flight line 43; single `interceptors.response.use`

Rig hygiene:

- `git checkout -- backend/src/utils/tokens.js` → `git diff -- backend/src/` empty ✓
- Pre-existing ambient dirt left untouched and uncommitted: `backend/package-lock.json`, `compose.yaml`, `start-dev.sh` (modified before this plan; not by it)

## Threat Flags

None beyond the plan's threat model. Threat dispositions resolved by this protocol: T-05-02-P1 (TTL edit reverted, backend/src clean — verified, not assumed); T-05-02-P2 (each check recorded with observed facts above, not bare PASS marks); T-05-03 (off-origin probe exercised live, fallback to `/` observed). No new network endpoints, auth paths, file access, or schema changes — zero source files modified by this plan.

## Issues Encountered

- Bounce loop (`window.location.assign` resets module flag → infinite self-bounce from `/login`): found during protocol execution, fixed in `56526f2`, operator checks ran against the fix. See "Code Under Test" above.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Phase DoD complete: ROADMAP success criteria 1–3 (build green + manual protocol evidence) are proven here, not by screenshots but by observed network-tab and navigation facts.
- SES-01 requirement ready to mark complete by the orchestrator.
- Phase re-verification (`/gsd-verify-work`) unblocked.

---
*Phase: 05-session-refresh*
*Completed: 2026-09-24*

## Self-Check: PASSED
- SUMMARY file exists on disk (this file)
- Prior commits verified in history: `7adc567`, `dda9127`, `d0487dd`, `56526f2` (all via `git log --oneline`)
- TTL revert verified: `git diff -- backend/src/` empty
- Build green + all structural greps recorded above
