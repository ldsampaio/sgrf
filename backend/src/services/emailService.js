const prisma = require('../config/db');
const env = require('../config/env');
const nodemailer = require('nodemailer');
const logger = require('../config/logger');

let transporter = null;
function getTransporter() {
  if (transporter) return transporter;
  transporter = nodemailer.createTransport({
    host: env.smtp.host,
    port: env.smtp.port,
    secure: env.smtp.secure,
    auth: env.smtp.user ? { user: env.smtp.user, pass: env.smtp.pass } : undefined,
  });
  return transporter;
}

async function enqueue(to, subject, body) {
  return prisma.emailQueue.create({ data: { to, subject, body } });
}

async function processQueue(limit = 10) {
  const pendings = await prisma.emailQueue.findMany({
    where: { status: { in: ['PENDING', 'FAILED'] } },
    take: limit,
    orderBy: { createdAt: 'asc' },
  });
  for (const mail of pendings) {
    if (mail.attempts >= 3) {
      await prisma.emailQueue.update({ where: { id: mail.id }, data: { status: 'GIVE_UP' } });
      logger.error({ mailId: mail.id }, 'email give up, alert admin');
      continue;
    }
    try {
      if (!env.smtpEnabled) {
        logger.info({ to: mail.to, subject: mail.subject }, '[SMTP_DISABLED] email logged only');
      } else {
        await getTransporter().sendMail({ from: env.smtp.from, to: mail.to, subject: mail.subject, text: mail.body });
      }
      await prisma.emailQueue.update({ where: { id: mail.id }, data: { status: 'SENT', attempts: mail.attempts + 1 } });
    } catch (e) {
      await prisma.emailQueue.update({
        where: { id: mail.id },
        data: { status: 'FAILED', attempts: mail.attempts + 1, lastError: String(e.message).slice(0, 500) },
      });
    }
  }
}

module.exports = { enqueue, processQueue };
