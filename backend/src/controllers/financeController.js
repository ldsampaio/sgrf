const prisma = require('../config/db');
const { audit } = require('../services/auditService');
const { enqueue } = require('../services/emailService');

function suspended(r) {
  return r && r.status === 'SUSPENSO_REUNIAO_ORDINARIA';
}

// POST /requests/:id/mark-spent — provisionado -> gasto (só admin/chefe)
async function markSpent(req, res, next) {
  try {
    if (!['ADMINISTRADOR', 'CHEFE_DEPARTAMENTO'].includes(req.user.role)) {
      return res.status(403).json({ error: 'Só admin/chefe' });
    }
    const r = await prisma.resourceRequest.findUnique({ where: { id: req.params.id } });
    if (!r) return res.status(404).json({ error: 'Não encontrado' });
    if (suspended(r)) return res.status(423).json({ error: 'Suspensa — somente leitura' });
    if (!['APROVADO', 'APROVADO_AUTOMATICAMENTE', 'APROVADO_PARCIALMENTE'].includes(r.status)) {
      return res.status(400).json({ error: 'Só pedido aprovado provisionado vira gasto' });
    }
    if (!r.approvedAmountCents || r.approvedAmountCents <= 0) return res.status(400).json({ error: 'Sem valor aprovado' });
    // idempotência: se já existe SPENT p/ este request, retorna ok
    const existing = await prisma.financialTransaction.findFirst({ where: { requestId: r.id, type: 'SPENT' } });
    if (existing) return res.json({ ok: true, idempotent: true });
    await prisma.$transaction(async (tx) => {
      // GA-VOT-05: conditional updateMany - check provisionedCents >= approvedAmountCents
      const result = await tx.fundBalance.updateMany({
        where: { referenceYear: r.referenceYear, provisionedCents: { gte: r.approvedAmountCents } },
        data: { provisionedCents: { decrement: r.approvedAmountCents }, spentCents: { increment: r.approvedAmountCents }, version: { increment: 1 } },
      });
      if (result.count === 0) {
        throw Object.assign(new Error('Provisionado insuficiente'), { status: 400 });
      }
      await tx.financialTransaction.create({
        data: { requestId: r.id, type: 'SPENT', amountCents: r.approvedAmountCents, fromState: 'PROVISIONADO', toState: 'GASTO', performedBy: req.user.id, metadata: JSON.stringify(req.body || {}) },
      });
      await tx.resourceRequest.update({ where: { id: r.id }, data: { status: 'CONCLUIDO' } });
    });
    await audit({ actorId: req.user.id, action: 'marked_spent', entityType: 'request', entityId: r.id, req });
    const requester = await prisma.user.findUnique({ where: { id: r.requesterId } });
    if (requester) await enqueue(requester.email, '[SGRD] Pedido marcado como gasto', `Pedido ${r.title} concluído.`);
    res.json({ ok: true });
  } catch (e) { next(e); }
}

// POST /requests/:id/reverse-provision — devolve provisionado p/ disponível (auditada)
async function reverseProvision(req, res, next) {
  try {
    if (!['ADMINISTRADOR', 'CHEFE_DEPARTAMENTO'].includes(req.user.role)) {
      return res.status(403).json({ error: 'Só admin/chefe' });
    }
    const r = await prisma.resourceRequest.findUnique({ where: { id: req.params.id } });
    if (!r) return res.status(404).json({ error: 'Não encontrado' });
    if (suspended(r)) return res.status(423).json({ error: 'Suspensa — somente leitura' });
    if (!r.approvedAmountCents) return res.status(400).json({ error: 'Nada a devolver' });
    await prisma.$transaction(async (tx) => {
      // GA-VOT-05: conditional updateMany - check provisionedCents >= approvedAmountCents
      const result = await tx.fundBalance.updateMany({
        where: { referenceYear: r.referenceYear, provisionedCents: { gte: r.approvedAmountCents } },
        data: { provisionedCents: { decrement: r.approvedAmountCents }, availableCents: { increment: r.approvedAmountCents }, version: { increment: 1 } },
      });
      if (result.count === 0) {
        throw Object.assign(new Error('Provisionado insuficiente'), { status: 400 });
      }
      await tx.financialTransaction.create({
        data: { requestId: r.id, type: 'REVERSE', amountCents: r.approvedAmountCents, fromState: 'PROVISIONADO', toState: 'DISPONIVEL', performedBy: req.user.id, metadata: JSON.stringify({ justification: req.body?.justification || '' }) },
      });
      await tx.resourceRequest.update({ where: { id: r.id }, data: { status: 'CANCELADO', approvedAmountCents: 0 } });
    });
    await audit({ actorId: req.user.id, action: 'provision_reversed', entityType: 'request', entityId: r.id, req });
    res.json({ ok: true });
  } catch (e) { next(e); }
}

module.exports = { markSpent, reverseProvision };
