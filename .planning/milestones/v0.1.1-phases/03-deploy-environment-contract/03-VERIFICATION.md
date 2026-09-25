---
phase: 03-deploy-environment-contract
verified: 2026-09-24T15:40:00Z
status: passed
score: 13/13 must-haves verified
covered_files: [".github/workflows/ci.yml", ".planning/REQUIREMENTS.md", ".planning/phases/03-deploy-environment-contract/03-01-PLAN.md", ".planning/phases/03-deploy-environment-contract/03-01-SUMMARY.md", ".planning/phases/03-deploy-environment-contract/03-02-PLAN.md", ".planning/phases/03-deploy-environment-contract/03-02-SUMMARY.md", ".planning/phases/03-deploy-environment-contract/03-03-PLAN.md", ".planning/phases/03-deploy-environment-contract/03-03-SUMMARY.md", ".planning/phases/03-deploy-environment-contract/03-PHASE-SUMMARY.md", ".planning/phases/03-deploy-environment-contract/03-REVIEW.md", "backend/.env.example", "backend/src/config/env.js", "backend/src/controllers/authController.js", "backend/src/utils/tokens.js", "backend/tests/env-gate.test.js", "compose.yaml", "docs/16-contrato-deploy.md"]
covered_digest: "v1:sha256:939ae571d1a3b6938079f4f737053052afd85fd2ea7d93e6cb1185e1c245d414"
behavior_unverified: 0
overrides_applied: 0
re_verification: false
---

# Phase 03: Deploy & Environment Contract Verification Report

**Phase Goal:** Production boots only with real secrets, and login works on non-localhost deployments — one coherent environment contract across env.js, cookies, and compose.
**Verified:** 2026-09-24T15:40:00Z
**Status:** passed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Booting with NODE_ENV=production and any of JWT_ACCESS_SECRET, JWT_REFRESH_SECRET, INITIAL_ADMIN_EMAIL, INITIAL_ADMIN_TEMPORARY_PASSWORD empty, containing change-me, or starting with dev- throws at env.js load naming the offending vars | ✓ VERIFIED | Live probes: placeholder JWT → throw at env.js:59; dev- prefix → throw; explicit empty ×4 → `SEC-02: Production boot refused … JWT_ACCESS_SECRET, JWT_REFRESH_SECRET, INITIAL_ADMIN_TEMPORARY_PASSWORD, INITIAL_ADMIN_EMAIL`; no-.env run from /tmp → same 4-offender throw. Gate sits before module.exports (env.js:25-67). |
| 2 | Booting with NODE_ENV unset, development, or test keeps dev fallbacks with no throw, and ./start-dev.sh works unchanged | ✓ VERIFIED | Live probes: NODE_ENV=development → loads, cookieSecure=false; unset NODE_ENV → loads, cookieSecure=false. Gate keyed on strict `NODE_ENV === 'production'` (env.js:23). Dev flow intact human-confirmed by operator 2026-09-24 (03-03-SUMMARY frontmatter + checkpoint table). |
| 3 | COOKIE_SECURE explicit true/false wins; absent follows NODE_ENV with production mapping to true | ✓ VERIFIED | Live probes: explicit true in dev → true; explicit false in production → false; absent in production → true. Code env.js:71-80. |
| 4 | CI backend job exports dummy JWT and admin values so the production gate can never trip CI regardless of implicit NODE_ENV | ✓ VERIFIED | ci.yml:13-16 holds non-placeholder JWT dummies (no `change-me`, no `dev-` prefix), institutional admin email, non-empty password. Backend suite green in CI shape. |
| 5 | cookieOpts.secure follows env.cookieSecure (explicit COOKIE_SECURE wins, absent tracks NODE_ENV) instead of reading raw process.env, while sameSite stays lax | ✓ VERIFIED | tokens.js:22 `secure: env.cookieSecure`; zero `process.env` reads in tokens.js (grep exit 1); sameSite 'lax' intact (line 23). Live probe: COOKIE_SECURE=true + production → cookieOpts = {httpOnly:true, secure:true, sameSite:'lax', path:'/'} — end-to-end wiring proven (covers REVIEW IN-02's unasserted path first-hand). |
| 6 | Logout deletes both session cookies with attributes matching how they were set, so Secure cookies are reliably removed | ✓ VERIFIED | authController.js:67-68 both clearCookie calls spread shared `...cookieOpts` (httpOnly/secure/sameSite mirrored, maxAge correctly omitted — clearCookie ignores lifetime). Set paths (lines 39-40, 59) use the same object; attributes cannot drift. |
| 7 | Compose wires COOKIE_SECURE with a production-true default while FRONTEND_URL stays operator-overridable | ✓ VERIFIED | compose.yaml:37 `COOKIE_SECURE: ${COOKIE_SECURE:-true}`; line 36 FRONTEND_URL overridable with localhost default; `:?` fail-fast guards on all four real secrets (lines 38-41). |
| 8 | Valid credentials submitted through the public https URL land on / with the Secure session cookie set | ✓ VERIFIED | Human-verified: operator confirmed public-URL login round-trip PASS 2026-09-24 (03-03-SUMMARY checkpoint). Code path supports it: Secure follows COOKIE_SECURE=true (truth 5), compose defaults it true (truth 7), CORS origin = FRONTEND_URL public host. |
| 9 | Cookie or prod-URL misconfiguration surfaces through the existing login error alert with the server message or Falha no login, never as a silent no-login | ✓ VERIFIED | Login failure paths return explicit JSON errors on every branch (authController 13/16/17/20/31); no code path swallows auth failure. Frontend untouched by phase (no silent-behavior change possible). Doc step 2 records the alert expectation; operator pass confirms no silent failure observed. |
| 10 | The login submit button still disables and reads Entrando while auth is in flight, resetting afterwards | ✓ VERIFIED | No frontend file touched by any plan in this phase (git log + status confirm); behavior locked unchanged by construction. Operator pass on the public-URL login flow observed the Entrando state per doc step 2. |
| 11 | A dedicated deploy doc exists as a validatable checklist with three steps (refuse insecure boot, public-URL login, dev intact), each carrying its command plus expected result | ✓ VERIFIED | docs/16-contrato-deploy.md: step 1 (NODE_ENV=production refusal command + SEC-02 expected error), step 2 (COOKIE_SECURE=true compose command + Set-Cookie expectations), step 3 (./start-dev.sh + localhost expectations). Greps for `NODE_ENV=production`, `COOKIE_SECURE=true`, `start-dev` all hit. Topology, CORS exact-match, LAN-IP expected-failure, and Phase 8 deferral notes all present. |
| 12 | backend/.env.example documents COOKIE_SECURE and the production FRONTEND_URL shape with refusal-rule notes | ✓ VERIFIED | .env.example:27 exactly one active COOKIE_SECURE line (`"false"` dev default + production-true comment line 26); refusal-rule comments on JWT lines (7,9), admin email suffix (19), admin password (21), FRONTEND_URL https shape (24). Dev defaults byte-identical (only comments + new entry added). |
| 13 | Each checklist step renders as a markdown checklist item; renderer-owned wrapping applies with no raw HTML and tables of at most six columns | ✓ VERIFIED | 3 `- [ ]` items; zero raw-HTML matches; widest table is 3 columns (topology table). |

**Score:** 13/13 truths verified (0 present, behavior-unverified)

*Note: plan must_haves also contain `[Flagged assumption — unverified]` entries (03-01 ×1, 03-02 ×3, 03-03 ×2). These are explicitly marked unverified in the plans themselves — edge-probe/TLS/browser-behavior assumptions, not asserted deliverables. They are excluded from the scored truths; the observable behaviors they hedge (gate refusal, cookie issuance, LAN-IP failure mode) are covered by truths 1, 5, 8, 11 above.*

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `backend/src/config/env.js` | isInsecureSecret predicate + production-only throw gate + cookieSecure parse | ✓ VERIFIED | Substantive (102 lines), gate before exports, wired (required by tokens.js, authController, app boot). |
| `backend/tests/env-gate.test.js` | Throw/no-throw matrix + cookieSecure cases | ✓ VERIFIED | 15 tests, all pass in 32/32 suite. REVIEW WR-04 notes env-leakage weakens 3 "absent" cases — code path itself proven correct first-hand (C3: absent+production → true). Test-quality nit, not a goal gap (see Gaps Summary). |
| `.github/workflows/ci.yml` | Dummy JWT/admin env in backend job | ✓ VERIFIED | Lines 13-16; workflow otherwise byte-identical (Node 22, working dirs, cache, prisma generate). |
| `backend/src/utils/tokens.js` | cookieOpts.secure from env.cookieSecure | ✓ VERIFIED | Single source of truth; no raw process.env; end-to-end value flow probed (C4). |
| `backend/src/controllers/authController.js` | Attribute-matched clearCookie in logout | ✓ VERIFIED | Lines 67-68; login/refresh/me handlers byte-identical. |
| `compose.yaml` | COOKIE_SECURE production-true default | ✓ VERIFIED | Line 37; FRONTEND_URL/guards/SMTP untouched; no proxy/rate-limit settings. |
| `docs/16-contrato-deploy.md` | Validatable 3-step checklist | ✓ VERIFIED | Commands + expected results per step; no real secrets (names + placeholder shapes only). |
| `backend/.env.example` | COOKIE_SECURE entry + production comments | ✓ VERIFIED | Exactly 1 active COOKIE_SECURE line; defaults unchanged. |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| env.js gate | module.exports | throw before exports built (lines 25-67 vs 82) | WIRED | No insecure value escapes; missing-value probe from /tmp confirms fail-closed. |
| env.cookieSecure | tokens.js cookieOpts.secure | `secure: env.cookieSecure` (tokens.js:22) | WIRED | Probed end-to-end (C4); no second source of truth. |
| cookieOpts set-path | clearCookie path | shared `...cookieOpts` spread (authController 39-40, 59, 67-68) | WIRED | Attributes cannot drift. |
| compose COOKIE_SECURE | app Secure decision | `${COOKIE_SECURE:-true}` → env.cookieSecure → cookieOpts | WIRED | Default true agrees with public-https FRONTEND_URL. |
| CI dummy env | production gate | Gate sees only safe values under any NODE_ENV | WIRED | Suite 32/32 green. |
| Checklist step 1 | plan 03-01 gate | Placeholder fixtures, never real secrets | WIRED | Doc command reproduces T1 probe exactly. |
| Checklist step 2 | plan 03-02 cookie wiring | Real Tunnel hostname + COOKIE_SECURE=true | WIRED | Operator-executed, PASS. |
| Checklist step 3 | dev flow | ./start-dev.sh localhost defaults | WIRED | Operator-executed, PASS. |
| Dockerfile | gate | `ENV NODE_ENV=production` (Dockerfile:12) | WIRED | Gate is live in the real deploy path, not dead code. |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|--------------------|--------|
| env.js cookieSecure | `cookieSecure` | COOKIE_SECURE env / NODE_ENV (lines 71-80) | ✓ FLOWING | Real env values, probed 3-way matrix. |
| tokens.js cookieOpts.secure | `secure` | env.cookieSecure (line 22) | ✓ FLOWING | Probed: true flows to cookieOpts. |
| authController cookies | Set-Cookie / clearCookie | shared cookieOpts | ✓ FLOWING | Same object on set and clear. |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Prod + placeholder JWT refuses, names offender | `NODE_ENV=production JWT_ACCESS_SECRET=change-me-… node -e require(env.js)` | throw at env.js:59 | ✓ PASS |
| Prod + dev- prefix refuses | `… JWT_ACCESS_SECRET=dev-access-xxx …` | throw at env.js:59 | ✓ PASS |
| Prod + all-empty refuses, names 4 offenders | `… JWT_ACCESS_SECRET="" …` (×4) | `SEC-02: Production boot refused … JWT_ACCESS_SECRET, JWT_REFRESH_SECRET, INITIAL_ADMIN_TEMPORARY_PASSWORD, INITIAL_ADMIN_EMAIL` | ✓ PASS |
| Prod + fully missing refuses (fail-closed) | `cd /tmp && NODE_ENV=production node -e require(…/env.js)` | Same 4-offender SEC-02 throw | ✓ PASS |
| Error never leaks secret values | throw-message includes check for planted canary value | `no-leak`; message holds names + fix hints only | ✓ PASS |
| Dev / unset NODE_ENV loads with fallbacks | `NODE_ENV=development …` / `env -u NODE_ENV …` | loads, cookieSecure=false both | ✓ PASS |
| cookieSecure: explicit true wins in dev | `NODE_ENV=development COOKIE_SECURE=true …` | cookieSecure=true | ✓ PASS |
| cookieSecure: explicit false wins in production | `NODE_ENV=production COOKIE_SECURE=false …` (+valid secrets) | cookieSecure=false | ✓ PASS |
| cookieSecure: absent tracks production | `NODE_ENV=production …` (+valid secrets, no COOKIE_SECURE) | cookieSecure=true | ✓ PASS |
| cookieOpts.secure follows env end-to-end | `… COOKIE_SECURE=true … node -e require(tokens.js)` | `{httpOnly:true, secure:true, sameSite:'lax', path:'/'}` | ✓ PASS |
| Backend suite green (Phase 1 regression gate) | `cd backend && npx vitest run` | 32/32 pass, 4 files | ✓ PASS |
| Frontend build green (Phase 1 regression gate) | `cd frontend && npm run build` | built in 548ms | ✓ PASS |

### Probe Execution

No phase-declared or conventional `scripts/*/tests/probe-*.sh` probes exist for this phase. Step 7c: NOT APPLICABLE (behavioral spot-checks above cover the contract).

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| SEC-02 | 03-01, 03-03 | Production boot fails fast when JWT_*/INITIAL_ADMIN_* missing or insecure; local dev fallbacks unchanged | ✓ SATISFIED | Fail-closed gate probed 4 ways (placeholder, dev-prefix, empty, fully missing); dev/unset loads probed; CI dummies; doc step 1 + .env.example refusal notes. |
| SEC-04 | 03-02, 03-03 | Cookie/HTTPS story resolved — secure follows COOKIE_SECURE; login works on non-localhost hosts | ✓ SATISFIED | 3-way cookieSecure matrix probed; tokens.js wiring probed end-to-end; logout attribute-match; compose default true; public-URL login operator-confirmed PASS. |

No orphaned requirements: REQUIREMENTS.md maps exactly SEC-02 + SEC-04 to Phase 3; both appear in plan frontmatter (03-01: SEC-02; 03-02: SEC-04; 03-03: SEC-02 + SEC-04). Coverage: every phase requirement ID accounted for.

### Scope Preservation

- **No trust-proxy / rate-limit configuration added** — grep across compose.yaml, env.js, tokens.js, authController.js returns nothing; Phase 8 (SEC-03) ownership explicitly recorded in doc line 18. Per D-11.
- **No frontend file touched** — login button/error-alert behaviors locked unchanged by construction.
- **Uncommitted working-tree changes** (`compose.yaml` DB_PORT ports mapping, `start-dev.sh` guards, `backend/package-lock.json`) are local dev ergonomics per orchestrator scope note — not phase scope, not gaps, not violations. Phase files themselves are committed (git log: 6b66724, 98cfbca).
- **Backend `.env` local file** exists with real-shaped values and is gitignored — correct local-dev practice, not a committed secret.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| (all 5 phase files + doc) | — | TBD/FIXME/XXX/TODO/HACK/PLACEHOLDER | none found | — |
| docs/16-contrato-deploy.md | — | raw HTML | none found | — |
| env.js / tokens.js / authController.js | — | console.log-only implementations | none found | — |

**Code-review findings disposition (03-REVIEW.md, advisory):** all 5 warnings + 3 infos assessed against the three phase success criteria — none violates them:

- **WR-01** (`@utfpr.edu.com` accepted by gate, rejected at login): gate still refuses every non-institutional domain (gmail probe covered by test); SC-1 concerns insecure/missing secrets failing fast, which holds. Undocumented-suffix inconsistency is a hardening nit for a later pass, not a goal gap.
- **WR-02** (`SKIP_GW_ENV` bypass): flag is absent from Dockerfile, compose.yaml, .env.example, and CI config (grep-verified) — test-only, not reachable in the deploy path. Operational-footgun hardening, not a goal gap.
- **WR-03** (case-sensitive `change-me`): in-repo placeholders are lowercase; documented refusal flow trips correctly (probed). Case-hardening nit, not a goal gap.
- **WR-04** (test env leakage in 3 "absent" cases): the underlying code branch is correct — proven first-hand (absent + production → cookieSecure=true, probe C3). Test-hygiene nit, not a goal gap.
- **WR-05 / IN-03** (explicit `COOKIE_SECURE=false` honored in production; `.env.example` defaults `"false"`): explicit-wins is the specified D-05 behavior required by plan 03-02's own acceptance criteria, and the dev-false default with production-true comment is exactly what plan 03-03's acceptance criteria ordered. Working as specified, not a gap.
- **IN-01** (dead `validateDevPrefix`): dead predicate, zero call sites; no behavioral effect.
- **IN-02** (`cookieOpts.secure` unasserted in tests): closed first-hand by this verification's C4 end-to-end probe.

### Human Verification Required

None remaining. Plan 03-03's `checkpoint:human-verify` steps (public-URL login round-trip + logout deletion; dev script boot + localhost login) carry frontmatter `human_verification: confirmed by operator 2026-09-24` with per-step PASS detail in 03-03-SUMMARY.md. Edge-TLS behaviors that cannot run in CI are covered by that confirmation; no re-demand of automation.

### Gaps Summary

No gaps. All 13 substantive must-haves verified against live code with first-hand behavioral evidence (12 probe commands, full suite 32/32, frontend build green). Both phase requirements (SEC-02, SEC-04) satisfied with every requirement ID cross-referenced. Phase 1 regression gate intact. Review findings are robustness nits that do not breach any success criterion. Phase goal achieved: production cannot boot on placeholder secrets, the Secure flag is operator-controlled per deploy with a production-safe default, and the contract is documented as an executable checklist.

---

_Verified: 2026-09-24T15:40:00Z_
_Verifier: the agent (gsd-verifier)_
