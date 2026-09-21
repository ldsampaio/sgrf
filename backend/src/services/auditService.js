const prisma = require('../config/db');

async function audit({ actorId, action, entityType, entityId, beforeData, afterData, req }) {
  try {
    await prisma.auditEvent.create({
      data: {
        actorId: actorId || null,
        action,
        entityType,
        entityId: entityId || null,
        beforeData: JSON.stringify(beforeData || {}),
        afterData: JSON.stringify(afterData || {}),
        ipAddress: req?.ip || null,
        userAgent: req?.headers?.['user-agent'] || null,
      },
    });
  } catch (e) {
    // auditoria nunca deve quebrar o fluxo
    require('../config/logger').error({ err: e }, 'audit failed');
  }
}

module.exports = { audit };
