const prisma = require('./config/db');
const logger = require('./config/logger');
const { closeVoting } = require('./services/votingService');

// Encerra votações vencidas (pula suspensas). Chamado por cron e manualmente.
async function closeExpired() {
  const expired = await prisma.resourceRequest.findMany({
    where: { status: 'EM_VOTACAO', votingDeadlineAt: { lt: new Date() } },
    select: { id: true },
    take: 50,
  });
  for (const r of expired) {
    try {
      await closeVoting(r.id, 'system-cron');
      logger.info({ requestId: r.id }, 'voting auto-closed');
    } catch (e) {
      logger.error({ requestId: r.id, err: e.message }, 'auto-close failed');
    }
  }
  return expired.length;
}

if (require.main === module) {
  closeExpired().then((n) => { console.log(`closed ${n}`); process.exit(0); });
}

module.exports = { closeExpired };
