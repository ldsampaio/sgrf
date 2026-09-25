const prisma = require('../config/db');
const { audit } = require('../services/auditService');
const { getSettings, getBalance } = require('../services/requestService');
const env = require('../config/env');

async function get(req, res, next) {
  try {
    const settings = await getSettings();
    const year = new Date().getFullYear();
    const balance = await getBalance(year);
    // nunca expor credenciais SMTP
    const { ...safe } = settings;
    res.json({ settings: { ...safe, smtpConfigured: env.smtpEnabled && Boolean(env.smtp.host) }, balance });
  } catch (e) { next(e); }
}

async function patchFinancial(req, res, next) {
  try {
    if (!['ADMINISTRADOR', 'CHEFE_DEPARTAMENTO'].includes(req.user.role)) {
      return res.status(403).json({ error: 'Sem permissão' });
    }
    const { automaticApprovalLimitCents, currentExchangeRate, votingDurationHours } = req.body;
    const before = await getSettings();
    const updated = await prisma.departmentSettings.update({
      where: { id: 'default' },
      data: {
        ...(automaticApprovalLimitCents !== undefined ? { automaticApprovalLimitCents: Math.round(Number(automaticApprovalLimitCents)) } : {}),
        ...(currentExchangeRate !== undefined ? { currentExchangeRate: Number(currentExchangeRate) } : {}),
        ...(votingDurationHours !== undefined ? { votingDurationHours: Number(votingDurationHours) } : {}),
        updatedBy: req.user.id,
      },
    });
    await audit({ actorId: req.user.id, action: 'settings_changed', entityType: 'settings', entityId: 'default', beforeData: before, afterData: updated, req });
    res.json({ ok: true });
  } catch (e) { next(e); }
}

async function patchBalance(req, res, next) {
  try {
    if (!['ADMINISTRADOR', 'CHEFE_DEPARTAMENTO'].includes(req.user.role)) {
      return res.status(403).json({ error: 'Sem permissão' });
    }
    const year = Number(req.body.referenceYear || new Date().getFullYear());
    const data = {};
    for (const k of ['availableCents', 'provisionedCents', 'spentCents']) {
      if (req.body[k] !== undefined) data[k] = Math.round(Number(req.body[k]));
    }
    data.updatedBy = req.user.id;
    data.version = { increment: 1 };

    // GA-VOT-05: version-based optimistic locking for balance adjustments
    const current = await prisma.fundBalance.findUnique({ where: { referenceYear: year } });
    const expectedVersion = current?.version ?? 0;

    const result = await prisma.fundBalance.updateMany({
      where: { referenceYear: year, version: expectedVersion },
      data,
    });

    if (result.count === 0) {
      throw Object.assign(new Error('Saldo modificado concorrentemente — tente novamente'), { status: 409 });
    }

    const b = await prisma.fundBalance.findUnique({ where: { referenceYear: year } });
    await prisma.financialTransaction.create({
      data: { type: 'BALANCE_ADJUST', amountCents: 0, fromState: 'ADMIN', toState: 'ADMIN', performedBy: req.user.id, metadata: JSON.stringify(req.body) },
    });
    await audit({ actorId: req.user.id, action: 'balance_changed', entityType: 'fund_balance', entityId: b.id, afterData: b, req });
    res.json({ ok: true, balance: b });
  } catch (e) { next(e); }
}

async function transactions(req, res, next) {
  try {
    const txs = await prisma.financialTransaction.findMany({ orderBy: { createdAt: 'desc' }, take: 100 });
    res.json({ transactions: txs });
  } catch (e) { next(e); }
}

module.exports = { get, patchFinancial, patchBalance, transactions };
