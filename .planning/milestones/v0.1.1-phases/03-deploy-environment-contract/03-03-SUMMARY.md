---
phase: 03-deploy-environment-contract
plan: 03
completed_at: 2026-09-24T14:25:00Z
human_verification: confirmed by operator 2026-09-24 (both manual steps pass locally)
---

# Plan 03-03 Summary

## Objective Completed (docs + env notes; manual verification confirmed)

Documented the environment contract (SEC-02 + SEC-04) as a validatable checklist plus production-noted `.env.example`. The two manual-only behaviors (public-URL login round-trip, dev flow intact) were **confirmed working locally by the operator on 2026-09-24** — see Human Checkpoint below.

## Changes Made

### 1. docs/16-contrato-deploy.md (new)

Validatable checklist with three steps, each carrying its run command plus exact expected result:

- **Step 1 — boot refuses insecure secret:** boots with `NODE_ENV=production` plus placeholder-shaped values, records the `SEC-02` refusal naming offenders (never real secret values).
- **Step 2 — public-URL login:** logs in through the public https hostname with `COOKIE_SECURE=true`, records Secure cookie issuance (`HttpOnly`, `Secure`, `SameSite=Lax`) plus logout deletion; records the login button `Entrando` loading state and the existing error-alert behavior.
- **Step 3 — dev intact:** boots `./start-dev.sh`, records localhost login working without `Secure` and no production gate trip.

Also records:

- Edge-to-app topology path (Cloudflare edge → cloudflared → server entry port → app port 3000) with Tunnel as the only TLS termination; no Caddy path documented or tested.
- Plain-HTTP LAN-IP login as an **expected failure** by Secure-cookie design (browsers exempt only localhost), never a supported path or a bug.
- Exact-match CORS origin rule: public https host with no trailing slash.
- Trust-proxy and rate-limit work explicitly owned by Phase 8 (SEC-03); nothing to configure here.
- Renderer-safe markdown: no raw HTML, tables capped at three columns.

### 2. backend/.env.example

- Added one active `COOKIE_SECURE="false"` entry (dev default; production uses `"true"`), with a SEC-04 production comment.
- Added SEC-02 refusal-rule comments on the JWT and admin lines (blocked `change-me` substring / `dev-` prefix; institutional `@utfpr.edu.br` suffix for admin email).
- Added SEC-04 public-https-host shape comment on `FRONTEND_URL`.
- All dev default values byte-identical (verified via `git diff` — only comment lines plus the new entry).

## Verification

- Doc checklist greps pass: `NODE_ENV=production`, `COOKIE_SECURE=true`, `start-dev` all present.
- Exactly one active `COOKIE_SECURE` line in `.env.example`.
- Full backend suite green: 32/32 tests, 4 files.
- Frontend build green (`vite build`, 106 modules).
- `git status` shows only the two listed files changed (plus this summary).

## Human Checkpoint — CONFIRMED PASS (operator, 2026-09-24)

| Step | Status | Detail |
|------|--------|--------|
| Step 2 — public-URL login round-trip + logout deletion | **PASS** | Operator confirmed working locally. |
| Step 3 — dev script boot + localhost login | **PASS** | Operator confirmed working locally. |

Both manual-only behaviors are human-confirmed; no gaps remain open. (Neither step required code edits — edge TLS plus real secrets cannot be automated in CI, so operator confirmation is the verification.)

## Acceptance Criteria Status

- ✅ Contract documented as executable checklist (command + expected result per step).
- ✅ Example env teaches the production shape without altering dev defaults.
- 🟢 Public-URL login and dev flow human-verified — **confirmed pass by operator 2026-09-24**.
- ✅ No code behavior changed by this plan (docs + comments only).
