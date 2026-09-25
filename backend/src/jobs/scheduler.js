const env = require('../config/env');
const logger = require('../config/logger');
const { processQueue } = require('../services/emailService');
const { closeExpired } = require('./votingCloser');

let emailTimer = null;
let votingTimer = null;
let emailRunning = false;
let votingRunning = false;

async function tickEmail() {
  if (emailRunning) return;
  emailRunning = true;
  try {
    await processQueue();
  } catch (e) {
    logger.error({ err: e.message }, 'tickEmail failed');
  } finally {
    emailRunning = false;
  }
}

async function tickVoting() {
  if (votingRunning) return;
  votingRunning = true;
  try {
    await closeExpired();
  } catch (e) {
    logger.error({ err: e.message }, 'tickVoting failed');
  } finally {
    votingRunning = false;
  }
}

function startScheduler() {
  if (env.smtpEnabled && env.smtp.host) {
    try {
      const svc = require('../services/emailService');
      const transporter = svc.getTransporter ? svc.getTransporter() : null;
      if (transporter && typeof transporter.verify === 'function') {
        transporter.verify().catch((e) => logger.warn({ err: e.message }, 'SMTP verify failed — queue will retry'));
      }
    } catch (_) {}
  }
  emailTimer = setInterval(tickEmail, 60 * 1000);
  votingTimer = setInterval(tickVoting, 5 * 60 * 1000);
  process.once('SIGTERM', stopScheduler);
  logger.info('scheduler started (email 60s, voting 300s)');
  // Allow process to exit naturally if only timers remain (important for tests that import scheduler directly)
  if (emailTimer && typeof emailTimer.unref === 'function') emailTimer.unref();
  if (votingTimer && typeof votingTimer.unref === 'function') votingTimer.unref();
}

function stopScheduler() {
  clearInterval(emailTimer);
  clearInterval(votingTimer);
  emailTimer = null;
  votingTimer = null;
  process.removeListener('SIGTERM', stopScheduler);
  logger.info('scheduler stopped');
}

module.exports = { startScheduler, stopScheduler, tickEmail, tickVoting };
