# Phase 07 CONTEXT: Decisions Clear Enough for Downstream Agents

**Phase:** Background Jobs
**Date:** 2026-09-25
**Status:** Context captured — ready for planning

---

## Goals (from ROADMAP.md)

Make the two dead jobs actually run — the email queue drains with a give-up admin alert, and expired votings auto-close on a scheduler that cannot wedge, overlap, or leak timers into tests.

### Success Criteria

1. With SMTP enabled, invites/resets/notifications actually send — the queue drains on an interval started from `server.js`, and after 3 failed attempts the admin gets an alert per `docs/14` (not just a log line)
2. An expired `EM_VOTACAO` request concludes automatically (tally → provision → notify) with no manual action — and tied requests from Phase 6 cannot wedge the job
3. `smtpConfigured` reports reality (`env.smtpEnabled && host`), so the UI never claims email is configured when it isn't
4. Jobs are re-entrancy-guarded, idempotent per run, and cleared on SIGTERM — no double-runs, no timers leaking into backend tests

---

## Canonical Refs (MANDATORY)

- .planning/ROADMAP.md — Phase 7 definition, 4 success criteria, 4 plans (07-01 … 07-04), scheduler tech: setInterval over node-cron
- .planning/REQUIREMENTS.md — JOB-01, JOB-02, JOB-03
- docs/14-decisoes-em-aberto.md — "E-mails falhos: três tentativas e alerta ao administrador"
- backend/src/services/emailService.js — processQueue(limit=10) with GIVE_UP at 3 attempts, only logger.error on give-up
- backend/src/jobs/votingCloser.js — broken requires './config/db' → '../config/db', closeExpired queries EM_VOTACAO take 50
- backend/src/config/env.js — smtpEnabled, smtp.host, initialAdminEmail
- backend/src/controllers/settingsController.js — get() hardcodes smtpConfigured: true
- backend/src/server.js — only createApp().listen, must become ONLY place that starts jobs

---

## Decisions Captured

### JOB-01-01: Email Give-Up Admin Alert Mechanism

**Decision**: Dual signal — Queue + Audit. When mail.attempts >= 3, processQueue will BOTH enqueue a new EmailQueue row to env.initialAdminEmail with subject [SGRD] Falha definitiva de e-mail and body containing original mailId, to, subject, lastError, AND write an AuditEvent with action: 'email_give_up', entityType: 'email_queue', entityId: mail.id, afterData: {to, subject, attempts: 3, lastError}.

**Implications**: Admin receives inbox alert and audit survives even if email channel failing. Uses env.initialAdminEmail (validated @utfpr.edu.br). File: backend/src/services/emailService.js

---

### JOB-01-02: Scheduler Re-Entrancy Guard Pattern

**Decision**: Boolean flag per job + exported stopScheduler(). Create backend/src/jobs/scheduler.js with let emailTimer, votingTimer, emailRunning, votingRunning; startScheduler creates setIntervals (60s email, 300s voting) with if(running) return guard; stopScheduler clears both and removes SIGTERM listener.

**Implications**: Per-job guard, zero new deps, no DB advisory lock. Files: new jobs/scheduler.js, modify server.js

---

### JOB-01-03: Nodemailer Upgrade Scope

**Decision**: Own commit inside 07-03 (Plan 07-03). Run npm install nodemailer@10 as isolated commit BEFORE scheduler wiring, with stub-sendMail queue-state test proving send surface still works.

**Implications**: Breaking major but surface is only sendMail({from,to,subject,text}) — small blast radius. Do NOT defer to Phase 8.

---

### JOB-01-04: smtpConfigured Honesty + transporter.verify() Timing

**Decision**: At scheduler start, warn only. Change settingsController.get() to smtpConfigured: env.smtpEnabled && Boolean(env.smtp.host). If smtpEnabled && host, call await getTransporter().verify() ONCE inside startScheduler(); on failure, logger.warn and continue booting.

**Implications**: UI never claims configured when disabled. get() stays synchronous. Files: settingsController.js line 12, scheduler.js verify call

---

### JOB-01-05: Test Isolation Wiring Rule

**Decision**: server.js only (never app.js). scheduler.js exports startScheduler/stopScheduler, ONLY server.js imports and calls startScheduler(). app.js NEVER imports scheduler — tests import createApp() directly and get zero timers.

**Implications**: No NODE_ENV guard, no timers leak into npx vitest run by construction. SIGTERM via process.once in startScheduler, removed in stopScheduler.

---

### Fixed Decisions (Already Locked)

- Scheduler tech: plain setInterval over node-cron 4
- Intervals: email 60s, voting 5 min — not env-configurable for v1
- Voting auto-close idempotency: calls existing closeVoting, handles needsArbitration
- Broken requires fix first: ./ → ../ in votingCloser.js

---

## Deferred Ideas (Not in Scope)

- Job last-run / failure telemetry / metrics endpoint
- External rate-limit store, email templating, SMTP pool optimization
- Exponential backoff retry schedule

---

## Next Steps for Downstream Agent

1. Fix votingCloser.js requires (./ → ../) (07-01)
2. Create jobs/scheduler.js with setInterval loops, boolean guard, SIGTERM cleanup (07-01)
3. Wire scheduler from server.js only and verify npx vitest run zero timers (07-01)
4. Schedule closeExpired every 5 min (07-02)
5. Schedule processQueue every 60s + nodemailer 10 upgrade + stub test (07-03)
6. Make smtpConfigured honest + verify at scheduler start (07-04)
7. Verify four success criteria

---

*Phase context captured: 2026-09-25 — ready for planning*
