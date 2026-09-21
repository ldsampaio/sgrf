const prisma = require('../config/db');
const { audit } = require('../services/auditService');
const { enqueue } = require('../services/emailService');
const { annualTotalCents, getSettings, getBalance, calcAmount } = require('../services/requestService');

async function list(req, res, next) {
  try {
    const where = {};
    // aluno só vê próprias; demais veem próprias + em votação (06-permissoes)
    if (req.user.role === 'ALUNO') where.requesterId = req.user.id;
    else if (req.query.mine === '1') where.requesterId = req.user.id;
    if (req.query.status) where.status = req.query.status;
    if (req.query.type) where.type = req.query.type;
    const requests = await prisma.resourceRequest.findMany({ where, orderBy: { createdAt: 'desc' }, take: 100 });
    res.json({ requests });
  } catch (e) { next(e); }
}

async function create(req, res, next) {
  try {
    const { type, title, justification, referenceYear, payload } = req.body;
    if (!title || !type) return res.status(400).json({ error: 'Título e tipo obrigatórios' });
    const settings = await getSettings();
    let calc;
    try {
      calc = calcAmount(type, payload || {}, settings.currentExchangeRate);
    } catch (e) {
      return res.status(400).json({ error: e.message });
    }
    // RN-006: especificação equipamento obrigatória
    if (type === 'EQUIPAMENTO' && !(payload?.technicalSpecification)) {
      return res.status(400).json({ error: 'Especificação técnica obrigatória' });
    }
    const r = await prisma.resourceRequest.create({
      data: {
        requesterId: req.user.id, type, title, justification: justification || '',
        status: 'RASCUNHO', referenceYear: Number(referenceYear || new Date().getFullYear()),
        requestedAmountCents: calc.requestedAmountCents,
        originalCurrency: calc.originalCurrency || 'BRL',
        exchangeRate: calc.exchangeRate || null,
        convertedAmountCents: calc.convertedAmountCents || null,
        payload: JSON.stringify(payload || {}),
      },
    });
    await audit({ actorId: req.user.id, action: 'request_created', entityType: 'request', entityId: r.id, afterData: r, req });
    res.status(201).json({ request: r });
  } catch (e) { next(e); }
}

async function submit(req, res, next) {
  try {
    const r = await prisma.resourceRequest.findUnique({ where: { id: req.params.id } });
    if (!r) return res.status(404).json({ error: 'Não encontrado' });
    if (r.requesterId !== req.user.id && !['ADMINISTRADOR', 'CHEFE_DEPARTAMENTO'].includes(req.user.role)) {
      return res.status(403).json({ error: 'Só o solicitante submete' });
    }
    if (r.status !== 'RASCUNHO') return res.status(400).json({ error: 'Só rascunho pode ser submetido' });

    const settings = await getSettings();
    const annual = await annualTotalCents(r.requesterId, r.referenceYear, r.id);
    const totalWithNew = annual + r.requestedAmountCents;
    const balance = await getBalance(r.referenceYear);

    let status = 'EM_VOTACAO';
    let approvedCents = 0;
    if (totalWithNew <= settings.automaticApprovalLimitCents) {
      if (balance.availableCents < r.requestedAmountCents) {
        return res.status(400).json({ error: 'Saldo disponível insuficiente (RN-005)' });
      }
      status = 'APROVADO_AUTOMATICAMENTE';
      approvedCents = r.requestedAmountCents;
    }

    // transação atômica: status + provisionamento + saldo
    const updated = await prisma.$transaction(async (tx) => {
      const up = await tx.resourceRequest.update({
        where: { id: r.id },
        data: {
          status, approvedAmountCents: approvedCents, submittedAt: new Date(),
          votingDeadlineAt: status === 'EM_VOTACAO' ? new Date(Date.now() + settings.votingDurationHours * 3600 * 1000) : null,
          decidedAt: status === 'APROVADO_AUTOMATICAMENTE' ? new Date() : null,
        },
      });
      if (status === 'APROVADO_AUTOMATICAMENTE') {
        await tx.fundBalance.update({
          where: { referenceYear: r.referenceYear },
          data: { availableCents: { decrement: approvedCents }, provisionedCents: { increment: approvedCents }, version: { increment: 1 } },
        });
        await tx.financialTransaction.create({
          data: { requestId: r.id, type: 'PROVISION', amountCents: approvedCents, fromState: 'DISPONIVEL', toState: 'PROVISIONADO', performedBy: 'system', metadata: JSON.stringify({ rule: 'auto', limit: settings.automaticApprovalLimitCents }) },
        });
      }
      return up;
    });

    await audit({ actorId: req.user.id, action: 'request_submitted', entityType: 'request', entityId: r.id, beforeData: { status: 'RASCUNHO' }, afterData: updated, req });
    const requester = await prisma.user.findUnique({ where: { id: r.requesterId } });
    await enqueue(requester.email, `[SGRD] Solicitação ${status}`, `Pedido ${r.title} (${r.id}) valor ${(r.requestedAmountCents / 100).toFixed(2)} status ${status}. Dúvidas: dirplad-cp@utfpr.edu.br`);

    res.json({ request: updated, annualTotalCents: totalWithNew, limit: settings.automaticApprovalLimitCents });
  } catch (e) { next(e); }
}

async function getOne(req, res, next) {
  try {
    const r = await prisma.resourceRequest.findUnique({ where: { id: req.params.id }, include: { files: true, transactions: true } });
    if (!r) return res.status(404).json({ error: 'Não encontrado' });
    res.json({ request: r });
  } catch (e) { next(e); }
}

async function cancel(req, res, next) {
  try {
    const r = await prisma.resourceRequest.findUnique({ where: { id: req.params.id } });
    if (!r) return res.status(404).json({ error: 'Não encontrado' });
    await prisma.resourceRequest.update({ where: { id: r.id }, data: { status: 'CANCELADO' } });
    await audit({ actorId: req.user.id, action: 'request_cancelled', entityType: 'request', entityId: r.id, req });
    res.json({ ok: true });
  } catch (e) { next(e); }
}

module.exports = { list, create, submit, getOne, cancel };
