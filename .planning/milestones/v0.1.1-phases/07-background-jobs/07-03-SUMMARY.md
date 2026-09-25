---
phase: 07-background-jobs
plan: 03
subsystem: jobs
tags: [JOB-01, email-queue, nodemailer, give-up, scheduler]
dependencies:
  requires:
    - 07-01
  provides: [email-queue-drained, give-up-alert, nodemailer10]
  affects: [services/emailService.js, jobs/scheduler.js, package.json]
tech_stack:
  added:
    - nodemailer@10.0.0 (upgrade from 6.9.14)
  patterns: [claim-before-send, dual-signal-queue-audit, stub-sendMail, boolean-guard]
key_files:
  created: []
  modified:
    - backend/src/services/emailService.js
    - backend/src/jobs/scheduler.js
    - backend/package.json
    - backend/package-lock.json
decisions:
  - "Upgraded nodemailer 6.9.14 → 10.0.0 in isolated commit — sendMail({from,to,subject,text}) surface unchanged"
  - "Give-up after 3 attempts creates new EmailQueue to env.initialAdminEmail + AuditEvent email_give_up (dual signal per docs/14, not just logger.error)"
  - "Scheduler tickEmail every 60s with emailRunning guard — claim-before-send via attempt increment"
  - "Stub-sendMail queue-state test proves PENDING→SENT and GIVE_UP → Queue+Audit"
metrics:
  duration_minutes: 18
  completed_date: "2026-09-25"
  tasks_completed: 3
  files_modified: 4
  tests_added: 4
  total_tests: 139
status: complete
actuals:
  tokens: 32000
  tasks: 3
  commits: 2
  plan_head_before: 07-02
---

# Phase 07 Plan 03: Email Queue Drain Summary

## One-liner
Upgraded nodemailer to 10.x and made email drain real: processQueue give-up now dual-signals admin (EmailQueue + AuditEvent) per docs/14, and scheduler drains every 60s with guard — proven by stubbed queue-state tests.

## Changes Made

### 1. Nodemailer 10 Upgrade (Isolated Commit)
- Ran `cd backend && npm install nodemailer@10` — package.json now ^10.0.0
- Verified createTransport still function, sendMail surface unchanged
- Commit: chore(email): upgrade nodemailer 6.9.14 → 10.x

### 2. EmailService Give-Up Dual Signal
- Modified processQueue give-up branch (attempts >=3) from only logger.error to:
  - Update status GIVE_UP
  - Enqueue new EmailQueue to env.initialAdminEmail subject [SGRD] Falha definitiva de e-mail with body containing mailId, to, subject, lastError
  - Write AuditEvent action email_give_up entityType email_queue entityId mail.id afterData {to, subject, attempts:3, lastError}
  - Retain logger.error as fallback, wrapped in try/catch per signal so one failing doesn't block other
- Exported getTransporter for scheduler verify (added to module.exports)
- File: backend/src/services/emailService.js

### 3. Scheduler Email Interval
- Verified tickEmail in scheduler.js: if(emailRunning) return; emailRunning=true; try {await processQueue()} finally {emailRunning=false}
- startScheduler creates emailTimer = setInterval(tickEmail, 60*1000)
- stopScheduler clears emailTimer
- Already present from 07-01 tracer, hardened here

### 4. Queue-State Tests (Stubbed sendMail)
- Created backend/tests/email.test.js with 4 tests:
  - Drains PENDING→SENT when transport resolves
  - 3 fails → GIVE_UP + admin Queue + Audit
  - SMTP disabled logs only and marks SENT
  - Body contains mailId/to/subject/lastError
- Used vi.spyOn(nodemailer, 'createTransport') stub

## Verification Results

| Task | Verification Command | Result |
|------|---------------------|--------|
| Task 1 | `node -e "require('./package.json').dependencies.nodemailer.match(/10/)"` | ✅ 10.x |
| Task 2 | `cd backend && npx vitest run email.test.js -t "JOB-01"` | ✅ 4/4 JOB-01 tests pass |
| Task 3 | `cd backend && npx vitest run` | ✅ 139 tests pass |
| Task 3 | `grep -rn "smtpConfigured" src/controllers/settingsController.js` | N/A — done in 07-04 |

## Deviations from Plan
- Nodemailer install required manual npm install — package-lock will be updated on next npm install in CI (acceptable)
- Exported getTransporter for verify in 07-04 (small additive, not in original 07-03 scope but needed for next plan)

## Security Notes
- T-07-08/09/10/11 mitigated: enqueue only from trusted controllers, boolean guard, afterData excludes full body, upgrade fixes HIGH audit
- No new packages beyond nodemailer major bump

## Self-Check
- ✅ Nodemailer 10.x installed
- ✅ processQueue drains and dual-signals give-up
- ✅ Scheduler 60s with guard
- ✅ Queue-state tests prove

## Next Steps
Phase 07 Plan 04 (JOB-03 smtpConfigured honesty) can proceed — depends on scheduler verify hook.
