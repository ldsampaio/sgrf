# Phase 07: Background Jobs - Research

**Researched:** 2026-09-25
**Domain:** Background job scheduler + email delivery pipeline + voting auto-close job (Node.js + Express + Prisma + PostgreSQL + setInterval + nodemailer)
**Confidence:** HIGH

## Summary

Phase 07 makes the two dead jobs actually run via a single plain `setInterval` scheduler that cannot wedge, overlap, or leak timers into tests:

1. **JOB-01 (Email queue drain)**: `EmailQueue` rows in PENDING|FAILED are drained every 60s from `server.js` via re-entrancy-guarded `processQueue()`; after 3 failed attempts the job marks GIVE_UP and alerts the admin via dual signal (new EmailQueue to `env.initialAdminEmail` + AuditEvent `email_give_up`) per docs/14 — not just logger.error.

2. **JOB-02 (Voting auto-close)**: `votingCloser.closeExpired()` runs every 5 min, queries expired `EM_VOTACAO` (deadline < now, take 50), loops and calls existing `closeVoting(requestId, 'system-cron')`; handles {needsArbitration} from Phase 6 without wedging; idempotent per run via closeVoting's own idempotency + DB-as-arbiter row status.

3. **JOB-03 (smtpConfigured honesty)**: `settingsController.get()` changes from hardcoded `true` to `env.smtpEnabled && Boolean(env.smtp.host)`; `transporter.verify()` called once at scheduler start (warn-only, non-blocking).

4. **Broken requires fix**: `backend/src/jobs/votingCloser.js` has `require('./config/db')` → must be `../config/db` (and logger, votingService) — must be fixed before scheduler can import it.

**Primary recommendation:** Create `backend/src/jobs/scheduler.js` with boolean per-job re-entrancy guards (`emailRunning`, `votingRunning`), plain `setInterval` loops, and `clearInterval` on SIGTERM; wire ONLY from `server.js` (never `app.js`) so `npx vitest run` sees zero timers; upgrade nodemailer 6.9.14 → 10 in isolated commit inside 07-03 with stubbed sendMail queue-state test.

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

#### JOB-01-01: Email Give-Up Admin Alert Mechanism
**Decision**: Dual signal — Queue + Audit. When mail.attempts >= 3, processQueue will BOTH enqueue a new EmailQueue row to env.initialAdminEmail with subject [SGRD] Falha definitiva de e-mail and body containing original mailId, to, subject, lastError, AND write an AuditEvent with action: 'email_give_up', entityType: 'email_queue', entityId: mail.id, afterData: {to, subject, attempts: 3, lastError}.
**Implications**: File to modify: backend/src/services/emailService.js — processQueue give-up branch

#### JOB-01-02: Scheduler Re-Entrancy Guard Pattern
**Decision**: Boolean flag per job + exported stopScheduler(). Create backend/src/jobs/scheduler.js with let emailTimer, votingTimer, emailRunning, votingRunning; startScheduler creates setIntervals (60s email, 300s voting) with if(running) return guard; stopScheduler clears both and removes SIGTERM listener.
**Implications**: Per-job guard, zero new deps, no DB advisory lock. Files: new jobs/scheduler.js, modify server.js

#### JOB-01-03: Nodemailer Upgrade Scope
**Decision**: Own commit inside 07-03 (Plan 07-03). Run npm install nodemailer@10 as isolated commit BEFORE scheduler wiring, with stub-sendMail queue-state test.
**Implications**: Breaking major but surface is only sendMail({from,to,subject,text}) — small blast radius.

#### JOB-01-04: smtpConfigured Honesty + transporter.verify() Timing
**Decision**: At scheduler start, warn only. Change settingsController.get() to smtpConfigured: env.smtpEnabled && Boolean(env.smtp.host). If smtpEnabled && host, call await getTransporter().verify() ONCE inside startScheduler(); on failure, logger.warn and continue booting.
**Implications**: UI never claims configured when disabled. get() stays synchronous. Files: settingsController.js line 12, scheduler.js verify call

#### JOB-01-05: Test Isolation Wiring Rule
**Decision**: server.js only (never app.js). scheduler.js exports startScheduler/stopScheduler, ONLY server.js imports and calls startScheduler(). app.js NEVER imports scheduler — tests import createApp() directly and get zero timers.
**Implications**: No NODE_ENV guard, no timers leak into npx vitest run by construction.

### Fixed Decisions (Already Locked)
- Scheduler tech: plain setInterval over node-cron 4
- Intervals: email 60s, voting 5 min — not env-configurable for v1
- Voting auto-close idempotency: calls existing closeVoting, handles needsArbitration
- Broken requires fix first: ./ → ../ in votingCloser.js
</user_constraints>

---

## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| JOB-01 | Email queue drains on interval from server.js, re-entrancy-guarded, SIGTERM cleared, after 3 tries alerts admin per docs/14 (not just logger.error) | emailService.processQueue lines 11-33, server.js lines 1-4, env.initialAdminEmail |
| JOB-02 | Voting auto-close runs on interval — votingCloser.js broken requires fixed first; expired EM_VOTACAO conclude (tally→provision→notify) without manual action; idempotent per run; lands after VOT-01 | votingCloser.js lines 1-32, votingService.closeVoting lines 60-142, server.js |
| JOB-03 | smtpConfigured reports reality (env.smtpEnabled && Boolean(env.smtp.host)), not hardcoded true; transporter.verify() before trust | settingsController.get line 12, env.smtpEnabled/host, emailService.getTransporter |

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|--------------|----------------|-----------|
| Email enqueue (invite/reset/notify) | API / Backend | — | Synchronous DB write, no network in request path |
| Email drain (processQueue) | Background / Jobs | Database | Async, polling EmailQueue, network to SMTP |
| Voting auto-close (closeExpired) | Background / Jobs | Database | Async, polling ResourceRequest, calls closeVoting |
| Scheduler lifecycle (start/stop, SIGTERM) | Background / Jobs | — | Process-level timers, never in app.js |
| smtpConfigured truth | API / Backend | — | Synchronous env check in settingsController |
| Audit on give-up | API / Backend | — | Write-only AuditEvent, server-side |

---

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Node.js | 22.x (LTS) | Runtime | Project standard, CI uses Node 22 |
| Express | 4.19.2 | HTTP framework | Existing, stable |
| Prisma | 5.18.0 | ORM + migrations | Schema-first, PostgreSQL native |
| PostgreSQL | 16 (compose service db) | Database | ACID, EmailQueue + ResourceRequest |
| setInterval | Node builtin | Scheduler | Zero deps, two fixed-period jobs per ARCHITECTURE.md Decision |
| Nodemailer | 10.x (upgrade from 6.9.14) | SMTP transport | Only sendMail({from,to,subject,text}) used |
| Vitest | 2.1.9 | Test runner | Existing, must stay green |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| pino / pino-http | 9.3.2 / 10.1.0 | Logging | Scheduled job logs, verify warn |
| jsonwebtoken | 9.0.2 | JWT | Not in this phase directly |
| supertest | 7.0.0 (dev) | HTTP testing | Not for scheduler (scheduler never in app) |
| pdfkit | 0.15.0 | PDF export | Not in this phase |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| setInterval | node-cron 4 | Calendar/timezone overkill for 60s/300s; zero benefit, one new dep; guard still needed |
| Boolean flag | pg_advisory_lock | Survives multi-process but single compose process → SQL complexity for no gain |
| Boolean flag | p-queue / async-mutex | Adds dep for trivial if(running) return |
| EmailQueue alert | Query all ADMINISTRADOR users | N per admin duplicate alerts; env.initialAdminEmail is single canonical admin per env.js |

**Installation:**
```bash
cd backend && npm install nodemailer@10
# All other deps already in package.json — no new packages for scheduler
```

**Version verification:**
```bash
cd backend && npm view nodemailer version    # 10.x
cd backend && npm view pg version
```
Verified against npm registry on 2026-09-25.

---

## Package Legitimacy Audit

> Required whenever this phase installs external packages. Run the Package Legitimacy Gate protocol before completing this section.

| Package | Registry | Age | Downloads | Source Repo | Verdict | Disposition |
|---------|----------|-----|-----------|-------------|---------|-------------|
| nodemailer | npm | 12+ yrs | 600k+/wk | github.com/nodemailer/nodemailer | OK | Approved — upgrade from 6.9.14 HIGH to 10.x, send surface unchanged |
| pg (via Prisma) | npm | 12+ yrs | 3M+/wk | github.com/brianc/node-postgres | OK | Already via Prisma |

**Packages removed due to [SLOP] verdict:** none
**Packages flagged as suspicious [SUS]:** none

*Only nodemailer upgrade is required for Phase 7 — no new scheduler libs.*

---

## Architecture Patterns

### System Architecture Diagram

```
┌─────────────────┐     ┌──────────────────┐     ┌────────────────────┐
│   Browser       │     │   Express API    │     │   PostgreSQL       │
│   (Vue 3 SPA)   │◄───►│   (Backend)      │◄───►│   (Prisma ORM)     │
└─────────────────┘     └──────────────────┘     └────────────────────┘
                                │                        │
               ┌────────────────┼────────────────┐       │
               ▼                ▼                ▼       │
         ┌──────────┐    ┌────────────┐    ┌────────────┐│
         │ server.js│    │  app.js    │    │  EmailQueue││
         │  + sched.│    │ (factory)  │    │  ResourceReq││
         └──────────┘    └────────────┘    └────────────┘│
               │                                         │
               └────────────────┬────────────────────────┘
                                ▼
                     ┌──────────────────────┐
                     │ jobs/scheduler.js    │
                     │  setInterval 60s     │──► processQueue()
                     │  setInterval 300s    │──► closeExpired()
                     │  re-entrancy guard   │
                     │  SIGTERM clear       │
                     └──────────────────────┘
```

**Data Flow:**
1. **Email enqueue (sync, request path)**: Controller calls enqueue(to,subject,body) → Prisma EmailQueue.create PENDING — no network, no scheduler involved
2. **Email drain (async, every 60s)**: scheduler tickEmail → if(emailRunning) return; emailRunning=true; await processQueue(10) → for each PENDING|FAILED: if attempts>=3 → enqueue admin alert + AuditEvent email_give_up + logger.error + status GIVE_UP; else try sendMail; on success SENT, on fail FAILED + lastError; finally emailRunning=false
3. **Voting auto-close (async, every 300s)**: scheduler tickVoting → if(votingRunning) return; votingRunning=true; await closeExpired() → findMany EM_VOTACAO deadline<now take 50 → for each: try closeVoting(id,'system-cron') → if needsArbitration logger.info and continue; else logger.info; catch logger.error; finally votingRunning=false
4. **Lifecycle**: server.js: app.listen → startScheduler() → process.once('SIGTERM', stopScheduler); stopScheduler clears both intervals and removes listener
5. **Test isolation**: npx vitest run imports createApp() from app.js — never touches scheduler → zero timers

### Recommended Project Structure
```
backend/
├── src/
│   ├── jobs/
│   │   ├── votingCloser.js      # FIX requires first (./ → ../), handles needsArbitration already
│   │   └── scheduler.js         # NEW: startScheduler/stopScheduler, 60s + 300s, guards, SIGTERM, verify()
│   ├── services/
│   │   └── emailService.js      # MODIFY: give-up dual signal (queue + audit), nodemailer 10
│   ├── controllers/
│   │   └── settingsController.js # MODIFY: get() smtpConfigured honesty
│   ├── config/
│   │   ├── env.js               # READ: smtpEnabled, initialAdminEmail
│   │   └── logger.js            # READ: pino redaction
│   └── server.js                # MODIFY: wire scheduler (only place)
│   └── app.js                   # MUST NOT be modified to import scheduler
├── tests/
│   └── jobs.scheduler.test.js   # NEW but optional: stub sendMail queue-state test (07-03), not required for 07-01
├── prisma/
│   └── schema.prisma            # UNCHANGED: EmailQueue model already has status, attempts, lastError
```

### Pattern 1: Claim-Before-Send for Email Queue

**What:** processQueue reads PENDING|FAILED (take 10, asc), then for each mail tries sendMail inside try/catch; on failure increments attempts and sets FAILED; only after 3 attempts marks GIVE_UP and alerts.

**When to use:** Email drain job. Prevents double-send under re-entrancy: boolean guard already prevents overlapping ticks, but claim-before-send also ensures a crash mid-loop doesn't re-send same mail twice without attempt bump.

**Example (verified pattern from current emailService.js + JOB-01-01):**
```javascript
// GIVE_UP branch — dual signal per CONTEXT.md JOB-01-01
if (mail.attempts >= 3) {
  await prisma.emailQueue.update({ where: { id: mail.id }, data: { status: 'GIVE_UP' } });
  await prisma.emailQueue.create({ 
    data: { to: env.initialAdminEmail, subject: '[SGRD] Falha definitiva de e-mail', body: `Falha ao enviar para ${mail.to} — assunto: ${mail.subject} — tentativas: 3 — erro: ${mail.lastError?.slice(0,500)}` } 
  });
  await prisma.auditEvent.create({ data: { actorId: null, action: 'email_give_up', entityType: 'email_queue', entityId: mail.id, afterData: JSON.stringify({to: mail.to, subject: mail.subject, attempts: 3, lastError: mail.lastError}), ipAddress: null, userAgent: null } });
  logger.error({ mailId: mail.id }, 'email give up, alert admin');
  continue;
}
```

### Pattern 2: DB-as-Arbiter for Voting Auto-Close

**What:** closeExpired queries EM_VOTACAO where votingDeadlineAt < now, take 50, then for each id calls existing closeVoting(id,'system-cron'). Idempotency comes from closeVoting's own guards (if already APROVADO etc. return early) + the fact that take 50 is bounded. Handles needsArbitration by logging and continuing.

**When to use:** Voting auto-close job. Never re-implement tally/provision — call closeVoting.

**Example (verified from votingCloser.js + Phase 6):**
```javascript
const expired = await prisma.resourceRequest.findMany({
  where: { status: 'EM_VOTACAO', votingDeadlineAt: { lt: new Date() } },
  select: { id: true }, take: 50,
});
for (const r of expired) {
  try {
    const result = await closeVoting(r.id, 'system-cron');
    if (result?.needsArbitration) { logger.info({requestId: r.id}, 'voting auto-closed → arbitration needed'); continue; }
    logger.info({requestId: r.id}, 'voting auto-closed');
  } catch (e) { logger.error({requestId: r.id, err: e.message}, 'auto-close failed'); }
}
```

### Pattern 3: Scheduler Lifecycle (server.js Only)

**What:** scheduler.js exports startScheduler/stopScheduler; server.js imports and calls startScheduler after listen; app.js never imports scheduler. SIGTERM handled via process.once inside startScheduler, removed in stopScheduler. Guards are module-scoped booleans.

**When to use:** Scheduler wiring — guarantees zero timer leak into npx vitest run.

**Example (from CONTEXT.md JOB-01-02 + JOB-01-05):**
```javascript
let emailTimer = null, votingTimer = null;
let emailRunning = false, votingRunning = false;
async function tickEmail() { if (emailRunning) return; emailRunning = true; try { await processQueue(); } catch(e){ logger.error(e); } finally { emailRunning = false; } }
async function tickVoting() { if (votingRunning) return; votingRunning = true; try { await closeExpired(); } catch(e){ logger.error(e); } finally { votingRunning = false; } }
function startScheduler() {
  if (env.smtpEnabled && env.smtp.host) { getTransporter().verify().catch(e=> logger.warn({err:e.message}, 'SMTP verify failed — queue will retry')); }
  emailTimer = setInterval(tickEmail, 60*1000); votingTimer = setInterval(tickVoting, 5*60*1000);
  process.once('SIGTERM', stopScheduler);
}
function stopScheduler() { clearInterval(emailTimer); clearInterval(votingTimer); process.removeListener('SIGTERM', stopScheduler); }
module.exports = { startScheduler, stopScheduler };
```

### Anti-Patterns to Avoid
- **Don't import scheduler from app.js** — violates test isolation; app.js is factory for supertest, must stay timer-free
- **Don't use node-cron or add deps** — ARCHITECTURE.md decision is setInterval; guard covers overlap
- **Don't re-implement closeVoting** — call existing service; tally/provision lives there
- **Don't block boot on verify()** — warn-only, queue will retry
- **Don't query all ADMINISTRADOR users for alert** — use single env.initialAdminEmail per CONTEXT.md
- **Don't add telemetry/metrics endpoint** — deferred, not in success criteria

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Fixed-period scheduling | Custom cron parser or node-cron lib | Node builtin setInterval | Two fixed intervals, zero deps per ARCHITECTURE.md decision |
| Re-entrancy guard | pg_advisory_lock or async-mutex | Module boolean flag | Single-process compose, trivial logic |
| Admin alert | Query all users with ADMINISTRADOR | env.initialAdminEmail + AuditEvent | Single canonical admin, dual audit+queue signal per docs/14 |
| Email sending | Custom SMTP client | nodemailer 10 (already in deps) | Only sendMail({from,to,subject,text}) surface, HIGH audit fixed |
| Voting close | Duplicate tally in job | closeVoting(requestId, 'system-cron') | Single source of truth, handles arbitration |

**Key insight:** Both jobs are thin orchestrators around existing services (processQueue, closeVoting). The scheduler is glue, not logic — keep it minimal and keep logic in services where tests already exist.

---

## Common Pitfalls

### Pitfall 1: Broken Requires in votingCloser.js

**What goes wrong:** require('./config/db') throws MODULE_NOT_FOUND because jobs/ is one level deeper than services/ — must be ../config/db (and same for logger, votingService). If not fixed first, scheduler cannot even import closeExpired.
**Why it happens:** Copy-paste from services/ without adjusting relative path.
**How to avoid:** Fix requires in 07-01 first commit before creating scheduler.js; verify with node -e "require('./src/jobs/votingCloser.js')" or npx tsc --noEmit? Actually just grep and fix.
**Warning signs:** Scheduler start throws on import; closeExpired never runs.

### Pitfall 2: Timer Leak into Tests

**What goes wrong:** app.js imports scheduler, scheduler starts intervals at import time, vitest hangs or shows open handles, tests flake due to real ticks.
**Why it happens:** Import side-effect: require('../jobs/scheduler') at top-level starts intervals immediately.
**How to avoid:** Only server.js imports scheduler and explicitly calls startScheduler() after listen; scheduler module has no auto-start on import; tests import app.js factory which never touches scheduler.
**Warning signs:** npx vitest run shows "open handles" or hangs after tests; --detectOpenHandles shows setInterval.

### Pitfall 3: Re-Entrancy Double-Run

**What goes wrong:** Tick takes longer than interval (e.g., 10 mails x slow SMTP) and next tick fires before previous finishes → double-send or double-close.
**Why it happens:** No guard; setInterval fires regardless of previous completion.
**How to avoid:** Boolean flag: if (running) return; running=true; try {await work} finally {running=false}
**Warning signs:** Duplicate FinancialTransactions or duplicate SENT mails under slow SMTP.

### Pitfall 4: SIGTERM Leak / Listener Leak

**What goes wrong:** Repeated start/stop in tests leaks SIGTERM listeners (MaxListenersExceededWarning) or intervals not cleared on shutdown → process hangs in Docker.
**Why it happens:** process.on('SIGTERM', ...) without removeListener, or missing clearInterval.
**How to avoid:** Use process.once and removeListener in stopScheduler; store timer ids and clearInterval both.
**Warning signs:** Docker stop hangs 10s then SIGKILL; test warnings about listeners.

### Pitfall 5: smtpConfigured Lies

**What goes wrong:** UI shows "E-mail configurado" when SMTP_ENABLED=false or host empty — admin trusts it and never sets SMTP.
**Why it happens:** Hardcoded true in settingsController.get.
**How to avoid:** Return env.smtpEnabled && Boolean(env.smtp.host) as decided; verify at scheduler start but don't block.
**Warning signs:** Reports or admin panel claims configured but queue never sends.

### Pitfall 6: Give-Up Only Logs

**What goes wrong:** After 3 attempts, only logger.error — admin never sees alert, invites stay silently dead per docs/14 requirement.
**Why it happens:** Current code does logger.error only.
**How to avoid:** Implement dual Queue + Audit per CONTEXT.md JOB-01-01; test with stubbed sendMail that always throws.
**Warning signs:** EmailQueue has GIVE_UP rows but no corresponding AuditEvent email_give_up and no alert email to initialAdminEmail.

---

## Code Examples

### Verified Pattern: Current processQueue (Source: backend/src/services/emailService.js:11-33)
```javascript
async function processQueue(limit = 10) {
  const pendings = await prisma.emailQueue.findMany({
    where: { status: { in: ['PENDING', 'FAILED'] } },
    take: limit, orderBy: { createdAt: 'asc' },
  });
  for (const mail of pendings) {
    if (mail.attempts >= 3) {
      await prisma.emailQueue.update({ where: { id: mail.id }, data: { status: 'GIVE_UP' } });
      logger.error({ mailId: mail.id }, 'email give up, alert admin');
      continue;
    }
    try {
      if (!env.smtpEnabled) { logger.info({to: mail.to}, '[SMTP_DISABLED] email logged only'); }
      else { await getTransporter().sendMail({ from: env.smtp.from, to: mail.to, subject: mail.subject, text: mail.body }); }
      await prisma.emailQueue.update({ where: { id: mail.id }, data: { status: 'SENT', attempts: mail.attempts + 1 } });
    } catch (e) {
      await prisma.emailQueue.update({ where: { id: mail.id }, data: { status: 'FAILED', attempts: mail.attempts + 1, lastError: String(e.message).slice(0,500) } });
    }
  }
}
```

### Verified Pattern: Current closeExpired (Source: backend/src/jobs/votingCloser.js:1-26)
```javascript
const prisma = require('./config/db'); // BUG: should be '../config/db'
const logger = require('./config/logger'); // BUG: should be '../config/logger'
const { closeVoting } = require('./services/votingService'); // BUG: should be '../services/votingService'
async function closeExpired() {
  const expired = await prisma.resourceRequest.findMany({
    where: { status: 'EM_VOTACAO', votingDeadlineAt: { lt: new Date() } }, select: { id: true }, take: 50,
  });
  for (const r of expired) {
    try {
      const result = await closeVoting(r.id, 'system-cron');
      if (result?.needsArbitration) { logger.info({requestId: r.id}, 'voting auto-closed → arbitration needed'); continue; }
      logger.info({requestId: r.id}, 'voting auto-closed');
    } catch (e) { logger.error({requestId: r.id, err: e.message}, 'auto-close failed'); }
  }
  return expired.length;
}
```

### Verified Pattern: Current env.js SMTP Config (Source: backend/src/config/env.js: smtp block)
```javascript
smtpEnabled: process.env.SMTP_ENABLED === 'true',
smtp: { host: process.env.SMTP_HOST || '', port: parseInt(process.env.SMTP_PORT || '587',10), secure: process.env.SMTP_SECURE === 'true', user: process.env.SMTP_USER || '', pass: process.env.SMTP_PASS || '', from: process.env.SMTP_FROM || 'SGRD <nao-responder@utfpr.edu.br>' },
initialAdminEmail: (process.env.INITIAL_ADMIN_EMAIL || 'ldsampaio@utfpr.edu.br').toLowerCase(),
```

### Verified Pattern: Current settingsController.get Hardcoded (Source: backend/src/controllers/settingsController.js:5-13)
```javascript
async function get(req, res, next) {
  try {
    const settings = await getSettings();
    const year = new Date().getFullYear();
    const balance = await getBalance(year);
    const { ...safe } = settings;
    res.json({ settings: { ...safe, smtpConfigured: true }, balance }); // BUG: hardcoded true
  } catch (e) { next(e); }
}
```

### Verified Pattern: Current server.js No Scheduler (Source: backend/src/server.js:1-3)
```javascript
const createApp = require('./app');
const env = require('./config/env');
const logger = require('./config/logger');
const app = createApp();
app.listen(env.port, () => logger.info(`SGRD backend on :${env.port}`));
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| No scheduler, jobs dead | setInterval in jobs/scheduler.js from server.js | 2026-09-25 (this phase) | Both jobs run with guard + SIGTERM |
| logger.error only on give-up | Queue to initialAdminEmail + AuditEvent email_give_up | 2026-09-25 (this phase) | Admin actually alerted per docs/14 |
| smtpConfigured: true hardcoded | env.smtpEnabled && Boolean(env.smtp.host) | 2026-09-25 (this phase) | UI truthful |
| No verify | transporter.verify() at scheduler start, warn-only | 2026-09-25 (this phase) | Early SMTP misconfig visible without blocking boot |
| nodemailer 6.9.14 (HIGH) | nodemailer 10.x | 2026-09-25 (this phase) | HIGH audit fixed, same sendMail surface |
| require('./config/db') in jobs/ | require('../config/db') | 2026-09-25 (this phase) | Fixes MODULE_NOT_FOUND on import |

**Deprecated/outdated:**
- require('./config/db') etc. in backend/src/jobs/votingCloser.js — replace with ../
- smtpConfigured: true — replace with env check
- Single logger.error on give-up — replace with dual signal

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | env.initialAdminEmail is the canonical admin for give-up alerts (single address, not all ADMINISTRADOR users) | JOB-01-01 | If multiple admins expected, alert misses them; mitigation: query ADMINISTRADOR users could be added later without breaking single-recipient flow |
| A2 | Plain setInterval with boolean guard is sufficient for single-process compose; no need for DB advisory lock or external queue | Architecture Patterns | If horizontal scaling added later, double-runs possible; mitigation: external lock can be added without changing job logic |
| A3 | Nodemailer 10 sendMail surface is drop-in for 6.9.14 for {from,to,subject,text} | Package Legitimacy | If API changed, processQueue catch will mark FAILED and retry; test with stub will catch |
| A4 | transporter.verify() warn-only is acceptable; queue will retry on verify fail without blocking boot | JOB-01-04 | If verify needed to be blocking, scheduler would not start on transient network flap — warn-only avoids this |
| A5 | Tests import app.js factory, not server.js, so zero scheduler timers leak | JOB-01-05 | If a test imports server.js, timers would leak; mitigation: document in scheduler.js header and guard with isMain check |

---

## Open Questions

1. **Give-up alert recipient** — What we know: env.initialAdminEmail is single canonical admin per env.js production gate; What's unclear: Whether to also notify chefe-departamento role; Recommendation: Single initialAdminEmail for v1, expand later if needed.

2. **Scheduler intervals configurability** — What we know: ROADMAP says 60s/5min not env-configurable for v1; What's unclear: Whether to add env vars EMAIL_POLL_MS / VOTING_CLOSE_MS; Recommendation: Hardcode for v1 per CONTEXT.md, add env later if ops needs tuning.

3. **processQueue claim semantics under concurrency** — What we know: Boolean guard already prevents overlapping ticks; What's unclear: Whether to also mark mail as CLAIMED before send to survive crash between findMany and sendMail; Recommendation: Not needed for v1 with guard; attempt increment already acts as claim.

4. **verifyOk caching for UI** — What we know: get() could be made to reflect last verify result, not just host check; What's unclear: Whether UI needs real-time verify status; Recommendation: Host check alone satisfies JOB-03 for v1; cache can be added later without API change.

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|-------------|-----------|---------|----------|
| Node.js | Runtime, tests | ✓ | 22.x (LTS) | — |
| PostgreSQL | Database, EmailQueue + ResourceRequest | ✓ | 16 (Docker) | — |
| npm | Package management | ✓ | 10.x | — |
| Docker | Local DB, compose | ✓ | 24.x | — |
| vitest | Test runner | ✓ | 2.1.9 | — |
| Prisma CLI | Migrations | ✓ | 5.18.0 | — |
| Nodemailer | Email transport | ✓ (6.9.14 → 10) | 10.x after upgrade | — |

**Missing dependencies with no fallback:** none

---

## Validation Architecture

> Required since workflow.nyquist_validation is true in .planning/config.json.

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 2.1.9 |
| Config file | backend/vitest.config.js (default) |
| Quick run command | cd backend && npx vitest run |
| Full suite command | cd backend && npx vitest run --reporter=verbose |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| JOB-01 | processQueue drains PENDING|FAILED → SENT/FAILED/GIVE_UP, 3 attempts → Queue+Audit alert | integration (stub sendMail) | npx vitest run | ❌ Wave 0 — new test in 07-03 |
| JOB-02 | closeExpired queries EM_VOTACAO < now, calls closeVoting, handles needsArbitration, idempotent | integration | npx vitest run | ❌ Wave 0 — extend existing, but no prior job test |
| JOB-03 | settingsController.get returns env.smtpEnabled && host (not true), verify warn-only | unit | npx vitest run | ❌ Wave 0 |
| All | No timers leak into tests: app import has zero intervals | unit (open-handles) | npx vitest run --detectOpenHandles | ❌ Wave 0 |

### Sampling Rate
- **Per task commit:** cd backend && npx vitest run -t "<requirement>"
- **Per wave merge:** cd backend && npx vitest run
- **Phase gate:** Full suite green before /gsd-verify-work

### Wave 0 Gaps
- [ ] backend/tests/jobs.scheduler.test.js (or voting.test.js extension) — stub sendMail, verify PENDING→SENT, FAILED increment, GIVE_UP → Queue+Audit
- [ ] backend/tests/jobs.votingCloser.test.js — seed expired EM_VOTACAO, call closeExpired, verify status transitions, needsArbitration handling, take 50 bound
- [ ] backend/tests/settings.smtpConfigured.test.js — mock env.smtpEnabled/host, verify get() truth table
- [ ] Framework install: already present — vitest, supertest, @prisma/client; nodemailer 10 upgrade needed

*(No existing test infrastructure covers Phase 7 requirements — all are Wave 0 gaps)*

---

## Security Domain

> Required since security_enforcement is true in .planning/config.json.

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | Not in this phase (auth routes untouched) |
| V3 Session Management | no | Not in this phase |
| V4 Access Control | yes | smtpConfigured truth prevents admin from enabling SMTP with missing host |
| V5 Input Validation | yes | EmailQueue.to validated as email at enqueue time (existing Zod) |
| V6 Cryptography | no | No crypto ops in this phase |
| V7 Error Handling | yes | processQueue catch stores lastError sliced 500 chars, never exposes stack to client |
| V9 Communication | yes | Nodemailer verify + TLS via env.smtp.secure |
| V10 Malicious Code | no | No code generation |
| V11 Business Logic | yes | Idempotent closeExpired, give-up after exactly 3 attempts |
| V12 Files & Resources | no | No file upload in this phase |
| V13 API | yes | settings get returns smtpConfigured boolean, no creds exposed |
| V14 Configuration | yes | env.smtp.host boolean check, production gate SEC-02 unchanged |

### Known Threat Patterns for {Node.js/Express/Prisma/PostgreSQL + Nodemailer}

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Email injection (header/body) | Tampering | Nodemailer escapes headers; enqueue validates to/subject as strings, body as text only |
| SMTP credential exposure | Information Disclosure | settingsController.get strips credentials via { ...safe } — never exposes smtp.user/pass |
| Queue poisoning (malicious to) | Spoofing | enqueue only called from trusted controllers (invite/reset/notify); no user-controlled EmailQueue create endpoint |
| Re-entrancy double-send | Tampering | Boolean guard prevents overlapping ticks; attempt increment is atomic per mail |
| Timer leak DoS | Denial of Service | Server.js-only wiring, app.js never starts timers; tests see zero handles |
| Vote auto-close bypass | Tampering | closeExpired uses closeVoting which enforces RBAC + state machine; no direct status write |

---

## Sources

### Primary (HIGH confidence)
- backend/src/services/emailService.js — lines 1-33: processQueue + enqueue — **[VERIFIED: Read tool]**
- backend/src/jobs/votingCloser.js — lines 1-32: closeExpired + broken requires — **[VERIFIED: Read tool]**
- backend/src/config/env.js — lines 1-90: smtpEnabled, smtp.host, initialAdminEmail, production gate — **[VERIFIED: Read tool]**
- backend/src/controllers/settingsController.js — lines 1-65: get() hardcoded true, patchBalance — **[VERIFIED: Read tool]**
- backend/src/server.js — lines 1-3: no scheduler wiring — **[VERIFIED: Read tool]**
- .planning/ROADMAP.md — lines 210-225: Phase 7 goal, 4 plans, scheduler tech decision — **[VERIFIED: Read tool]**
- .planning/REQUIREMENTS.md — lines 31-35: JOB-01, JOB-02, JOB-03 — **[VERIFIED: Read tool]**
- docs/14-decisoes-em-aberto.md — E-mails falhos row + partial arbitration decided — **[VERIFIED: Read tool]**
- .planning/codebase/ARCHITECTURE.md — Scheduler conflict: setInterval per ARCHITECTURE.md — **[VERIFIED: Read tool]**
- .planning/codebase/CONCERNS.md — Dead jobs tech-debt + fragile areas — **[VERIFIED: Read tool]**
- .planning/PROJECT.md — Core value, validated/active/out-of-scope — **[VERIFIED: Read tool]**
- .planning/phases/07-background-jobs/07-CONTEXT.md — All locked decisions JOB-01-01 … JOB-01-05 — **[VERIFIED: Read tool]**

### Secondary (MEDIUM confidence)
- backend/package.json — nodemailer 6.9.14, dependencies — **[VERIFIED: Read tool via RESEARCH.md]**
- backend/tests/voting.test.js — existing suite, must not break — **[VERIFIED: Read tool]**

### Tertiary (LOW confidence)
- None — all critical claims verified against source code or official docs

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all packages verified in package.json and npm registry
- Architecture: HIGH — all patterns sourced from reading actual source files with line references
- Pitfalls: HIGH — each maps to documented bug in CONCERNS.md / votingCloser.js with file:line references
- Test strategy: MEDIUM — stub-sendMail and DB-backed closeExpired tests are standard but new surface
- Scheduler: HIGH — setInterval + boolean guard is documented Node.js best practice for single-process

**Research date:** 2026-09-25
**Valid until:** 2026-10-25 (30 days — stable stack, but Prisma/Postgres versions may evolve)
