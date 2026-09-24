---
phase: 05-session-refresh
verified: 2026-09-24T20:15:00Z
status: gaps_found
score: 1/7 must-haves verified
covered_files:
  - .planning/phases/05-session-refresh/05-01-PLAN.md
  - .planning/phases/05-session-refresh/05-01-SUMMARY.md
  - .planning/phases/05-session-refresh/05-02-PLAN.md
  - .planning/phases/05-session-refresh/05-03-PLAN.md
  - .planning/phases/05-session-refresh/05-03-SUMMARY.md
  - .planning/phases/05-session-refresh/05-REVIEW.md
  - frontend/src/services/api.js
  - frontend/src/views/Login.vue
  - frontend/src/views/Requests.vue
  - frontend/src/stores/auth.js
covered_digest: "unavailable — gsd-tools runtime not present in this environment; file list above is authoritative"
behavior_unverified: 5
overrides_applied: 0
gaps:
  - truth: "Failed login shows the credential error alert in place (no spurious refresh, no self-bounce wiping the form)"
    status: failed
    reason: "WR-01 (05-REVIEW.md, verified real): auth.login uses the shared api instance (stores/auth.js:12) and bad credentials answer 401 (authController.js:16,30), but the interceptor bypasses only /auth/refresh (api.js:31). Every wrong-password submit fires a spurious POST /auth/refresh and, with no live refresh cookie, doBounce() full-reloads /login onto /login?reason=session-expired&redirect=%2Flogin — wiping typed input and showing a misleading session-expired notice instead of the credential error alert."
    artifacts:
      - path: "frontend/src/services/api.js"
        issue: "Bypass gate at line 31 covers only /auth/refresh; /auth/login 401s enter the refresh/bounce path"
    missing:
      - "Bypass auth endpoints that legitimately 401 outside a session (e.g. match /auth/(login|refresh|register) or a per-request _skipRefresh flag) so login 401s reject straight to Login.vue err alert"
  - truth: "Bounce from the login page itself never nests a stale /login redirect (post-login lands on / or the true origin)"
    status: failed
    reason: "WR-02 (05-REVIEW.md): doBounce() (api.js:16-21) unconditionally encodes pathname+search as redirect with no same-page guard. Any 401 raised while on /login (WR-01 is a live trigger) yields /login?reason=session-expired&redirect=/login%3F..., which isInternalPath legitimately accepts — post-login router.push lands back on a stale login URL instead of /."
    artifacts:
      - path: "frontend/src/services/api.js"
        issue: "doBounce() has no same-page guard; nested redirect accepted by the validator"
    missing:
      - "Same-page guard in doBounce() (e.g. origin falls back to / when pathname is /login)"
  - truth: "Draft restore never injects an arbitrary type string into the enum select"
    status: failed
    reason: "WR-03 (05-REVIEW.md, confirmed in code Requests.vue:71): title/justification/spec/valueCents are shape-checked but type is restored from any string. A tampered slot e.g. {type:FOO} leaves the select blank and the next submit posts an invalid type."
    artifacts:
      - path: "frontend/src/views/Requests.vue"
        issue: "Line 71 restores form.value.type from any string without allowlist check"
    missing:
      - "Allowlist-check restored type against the four valid options, falling back to the current default"
behavior_unverified_items:
  - truth: "A user working continuously past the 15-minute TTL never sees login — one silent POST /auth/refresh per expiry, view stays put, form state preserved (SC1)"
    test: "Per 05-02 Part A: local rig with ~10s access TTL, work continuously, watch network tab per expiry"
    expected: "Exactly one POST /auth/refresh per expiry; no spinner/banner/navigation; form state intact"
    why_human: "Runtime network-tab observation; no frontend test runner by design. Code structure (shared promise api.js:34, replay api.js:41) verified statically only."
  - truth: "N parallel 401s trigger exactly one refresh (SC2)"
    test: "Per 05-02 Part A: force N parallel authenticated calls right after expiry, count refresh posts"
    expected: "Exactly one POST /auth/refresh; all original requests succeed"
    why_human: "Concurrency behavior needs a live browser rig; statically the ??= single-flight shape is present but unexercised."
  - truth: "Dead refresh cookie bounces exactly once to /login?reason=session-expired&redirect=<origin>; refresh itself never retried (SC3)"
    test: "Per 05-02 Part B: delete refresh cookie in DevTools, trigger an authenticated call"
    expected: "Exactly one full-reload navigation to the extended bounce query; no stacked navigations; no /login loop"
    why_human: "Navigation counting needs a live browser. Structure (isRedirecting set before assign api.js:17-20, _retry guard api.js:29) verified statically — but WR-01/WR-02 mean the bounce path is currently reachable from non-session 401s, so the live check must run after the gaps are fixed."
  - truth: "Locked notice renders verbatim with role=status and validated return-to-origin lands back on the origin (incl. off-origin fallback to /, plain /login shows no notice)"
    test: "Per 05-02 Part B: observe bounce copy/roles, typing persistence, wrong-password stacking, refresh cleanup, off-origin probe, plain-/login visit"
    expected: "Locked copy verbatim, warn above error with roles never mixed, return-to-origin after login, off-origin falls back to /, plain /login shows no notice"
    why_human: "Visual/DOM-in-browser observations by a real operator. Code (Login.vue:7-8,29-50,56) verified statically only."
  - truth: "Requests draft survives a forced-logout bounce (persist on input, restore on mount, clear on submit, corrupt slot opens empty)"
    test: "Per 05-02 Part B: type a recognizable draft, force bounce, re-login, verify restore; corrupt the slot and verify empty form"
    expected: "Draft restored after return-to-origin; submit clears slot; corrupt slot opens empty without blocking"
    why_human: "Cross-navigation sessionStorage round-trip needs a live browser. Code lifecycle (Requests.vue:44-79,89-92) verified statically only."
---

# Phase 05: Session Refresh Verification Report

**Phase Goal:** Silent single-flight session refresh for SES-01; only true session death bounces exactly once with the locked notice, validated return-to-origin, and draft restore; build green.
**Verified:** 2026-09-24T20:15:00Z
**Status:** gaps_found
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Silent refresh past TTL: one `POST /auth/refresh` per expiry, original request succeeds, nothing new renders (SC1) | ⚠️ PRESENT_BEHAVIOR_UNVERIFIED | Structure present: shared `refreshPromise ??=` (api.js:34), replay with original config (api.js:41), no spinner/banner code. No live run — 05-02 Part A rig done but zero human browser observations, no 05-02-SUMMARY. |
| 2 | N parallel 401s collapse to exactly one refresh (SC2) | ⚠️ PRESENT_BEHAVIOR_UNVERIFIED | `??=` single-flight shape present (api.js:34-36); unexercised at runtime — pending 05-02 Part A observations. |
| 3 | Dead refresh cookie → exactly one bounce, refresh never retried (SC3) | ⚠️ PRESENT_BEHAVIOR_UNVERIFIED | Guards present: `_retry` + 401-only gate (api.js:29), refresh bypass (api.js:31), `isRedirecting` set before `assign()` (api.js:17-20). Runtime unobserved; WR-01/WR-02 pollute this path (see gaps). |
| 4 | Build green, no router import in service, no per-view 401 handling (SC4) | ✓ VERIFIED | `npm run build` re-run green (vite, 563–574ms); `interceptors`/`_retry` resolve to exactly `src/services/api.js`; views/stores/router sweep zero hits (re-run); api.js imports only axios (router mention is a comment). |
| 5 | Locked notice verbatim + validated return-to-origin (incl. off-origin fallback, plain /login clean) | ⚠️ PRESENT_BEHAVIOR_UNVERIFIED | Code exact: `.alert.warn[role=status]` locked copy (Login.vue:7) above `div.alert.error[role=alert]` (Login.vue:8); `isInternalPath` validator (Login.vue:29-36); `replaceState` cleanup (Login.vue:47-49). Rendering/navigation unobserved — pending 05-02 Part B. |
| 6 | Draft persist/restore/clear round-trip with corrupt-slot tolerance | ⚠️ PRESENT_BEHAVIOR_UNVERIFIED | Lifecycle exact: write on input (Requests.vue:59), read-and-unconditional-clear on mount with shape checks (Requests.vue:64-79), clear on submit (Requests.vue:89-92), all try/catch. Round-trip unobserved — pending 05-02 Part B. WR-03 (unvalidated `type`) is a gap below. |
| 7 | Failed login surfaces the credential error in place — no spurious refresh, no self-bounce | ✗ FAILED | WR-01 verified real (see gaps): `auth.login` → shared `api` (stores/auth.js:12) + backend login 401s (authController.js:16,30) + bypass covering only `/auth/refresh` (api.js:31) = wrong-password submit bounces `/login` onto itself. Breaks 05-01 must-haves on error-alert rendering and notice/credential separation. |

**Score:** 1/7 truths verified (5 present, behavior-unverified)

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `frontend/src/services/api.js` | Single-flight 401 interceptor, bounce-once | Substantive + wired, defective gate | Interceptor, shared promise, redirect-once flag all present and wired; bypass too narrow (WR-01) + no same-page guard (WR-02) |
| `frontend/src/views/Login.vue` | Locked notice, redirect validation | Substantive + wired | Notice/validator/cleanup/push all present, verbatim copy confirmed |
| `frontend/src/views/Requests.vue` | Draft persist/restore/clear | Substantive + wired | Watcher/restore/submit-clear present; `type` restore unvalidated (WR-03) |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| api.js interceptor | POST /auth/refresh (shared promise) → replay original config | `refreshPromise ??= api.post(...)`, `return api(config)` | WIRED | api.js:34-41 |
| api.js bounce | `/login?reason=session-expired&redirect=<origin>` exactly once | `isRedirecting` + `window.location.assign` | WIRED (unguarded) | api.js:16-21; exactly-once holds, same-page nesting does not (WR-02) |
| Login.vue | `?reason`/`?redirect` → `replaceState` cleanup → validated `router.push` | `URLSearchParams`, `isInternalPath` | WIRED | Login.vue:37-50,56 |
| Requests.vue mount | `sgrf:pending-draft` read-and-clear → restore | `restoreDraft()` onMounted | WIRED | Requests.vue:64-79,97; single owner confirmed by grep |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|--------------------|--------|
| api.js replay | original `config` + refreshed cookies | live axios retry, not a static return | ✓ FLOWING | Replay returns `api(config)` result |
| Login.vue notice | `?reason` query param | bounce URL written by `doBounce()` | ✓ FLOWING | End-to-end chain intact |
| Requests.vue form | `sgrf:pending-draft` slot | own form refs via sync-flush watcher | ✓ FLOWING | No hollow props; no static fallbacks |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Frontend build green | `cd frontend && npm run build` | exit 0, 106 modules | ✓ PASS |
| Single-instance hook | `grep -rln interceptors/_retry src` | exactly `src/services/api.js` each | ✓ PASS |
| No per-view 401 handling | `grep -rn "status.*401\|..._retry\|interceptors" src/views/ src/stores/ src/router/` | no hits | ✓ PASS |
| No router import in service | `grep -n "import.*router" src/services/api.js` | comment only | ✓ PASS |
| Silent-refresh runtime (SC1/SC2) | 05-02 Part A live rig | not observed (no operator run) | ? SKIP → human verification |
| Bounce/notice/return/draft runtime | 05-02 Part B live browser | not observed (checkpoint deferred) | ? SKIP → human verification |

### Probe Execution

None — no probe scripts declared by the plans; Step 7c not applicable.

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| SES-01 | 05-01, 05-03 | Single-flight 401 refresh + retry; bounce only on refresh failure; no router import | PARTIAL | Structure + SC4 verified; runtime (SC1–SC3, notice, return-to-origin, draft) pending 05-02 human protocol; WR-01/WR-02/WR-03 open against 05-01 |

REQUIREMENTS.md line 88 maps SES-01 → Phase 5 as "Complete" — that checkbox is premature: no orphaned IDs (all SES-01 claims are covered by 05-01/05-02/05-03), but the implementation has 3 open defects and the DoD protocol is unrun.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| Login.vue | 9–10 | `placeholder=` attributes | ℹ️ Info | Legitimate input placeholders (`voce@utfpr.edu.br`, `••••••••`), not stub text — not a finding |
| api.js / Login.vue / Requests.vue | — | TODO/FIXME/XXX/console.log/empty returns | — | None found — clean |

### Human Verification Required

05-02 is the phase DoD and sits at an operator-deferred `checkpoint:human-verify`: Part A automated rig evidence exists in the checkpoint return, but **no human browser observations and no 05-02-SUMMARY.md exist**. Per the phase instructions these are recorded here as pending human verification, **not** as implementation gaps. Each item is detailed in `behavior_unverified_items` frontmatter above (5 items: silent refresh, single-flight concurrency, bounce-once, notice + return-to-origin, draft round-trip). These must be executed **after** the WR-01/WR-02/WR-03 gaps are fixed, since the defects pollute exactly the paths the protocol observes.

### Gaps Summary

Three code defects from 05-REVIEW.md (status `issues-found`), all re-verified against the actual code and all against 05-01:

1. **WR-01 (real, blocking):** wrong-password 401s enter the refresh/bounce path — spurious `POST /auth/refresh` plus a full-page self-bounce that wipes the login form and shows a false "session expired" notice. Falsifies the 05-01 truth "failed auth renders `div.alert.error` with the server message" on the plain-login path. Fix: bypass `/auth/login` (and register) alongside `/auth/refresh`, or a `_skipRefresh` flag.
2. **WR-02 (warning):** `doBounce()` nests `redirect=/login?...` when the 401 originates on `/login`; post-login lands on a stale login URL. Fix: same-page guard falling back to `/`.
3. **WR-03 (warning):** draft restore accepts any `type` string into the enum select; tampered slot → blank control → invalid submit. Fix: allowlist-check against the four valid types.

IN-01/IN-02/IN-03 are info-only (documented, out of scope or by design) and are not gaps.

**What closes the phase:** (a) fix WR-01/WR-02/WR-03 in `api.js` + `Requests.vue`, (b) re-run `npm run build` + the 05-03 structural greps, (c) execute the 05-02 manual protocol with an operator and write 05-02-SUMMARY.md, (d) re-verify.

---

_Verified: 2026-09-24T20:15:00Z_
_Verifier: the agent (gsd-verifier)_
