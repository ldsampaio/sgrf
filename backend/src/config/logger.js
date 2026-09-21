const pino = require('pino');

const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  redact: ['req.headers.cookie', 'password', 'pass', 'SMTP_PASS', 'token'],
});

module.exports = logger;
