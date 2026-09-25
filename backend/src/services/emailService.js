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
      // Dual signal per docs/14 — alert admin via queue + audit (not just logger.error)
      try {
        await prisma.emailQueue.create({
          data: {
            to: env.initialAdminEmail,
            subject: '[SGRD] Falha definitiva de e-mail',
            body: `Falha ao enviar para ${mail.to} — assunto: ${mail.subject} — mailId: ${mail.id} — tentativas: 3 — erro: ${(mail.lastError || '').slice(0, 500)}`,
          },
        });
      } catch (e) {
        logger.error({ err: e.message }, 'give-up alert enqueue failed');
      }
      try {
        const { audit } = require('./auditService');
        await audit({
          actorId: null,
          action: 'email_give_up',
          entityType: 'email_queue',
          entityId: mail.id,
          afterData: { to: mail.to, subject: mail.subject, attempts: 3, lastError: mail.lastError },
          req: null,
        });
      } catch (e) {
        logger.error({ err: e.message }, 'give-up audit failed');
      }
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

module.exports = { enqueue, processQueue, getTransporter };
