const prisma = require('../config/db');
const { canViewRequest, scopeWhere } = require('../middlewares/visibility');
const { audit } = require('../services/auditService');
const { enqueue } = require('../services/emailService');
const { annualTotalCents, getSettings, getBalance, calcAmount } = require('../services/requestService');

async function list(req, res, next) {
  try {
    // D-03/D-04: PROFESSOR/ALUNO/CONSELHEIRO veem próprios + tudo não-rascunho (scopeWhere).
    const where = scopeWhere(req.user, req.query);
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

    let status = 'EM_VOTACAO';
    let approvedCents = 0;
    if (totalWithNew <= settings.automaticApprovalLimitCents) {
      status = 'APROVADO_AUTOMATICAMENTE';
      approvedCents = r.requestedAmountCents;
    }

    // transação atômica: status + provisionamento + saldo (GA-VOT-05: conditional updateMany)
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
        const result = await tx.fundBalance.updateMany({
          where: { referenceYear: r.referenceYear, availableCents: { gte: approvedCents } },
          data: { availableCents: { decrement: approvedCents }, provisionedCents: { increment: approvedCents }, version: { increment: 1 } },
        });
        if (result.count === 0) {
          throw Object.assign(new Error('Saldo disponível insuficiente (RN-005)'), { status: 400 });
        }
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
    if (!r || !canViewRequest(req.user, r)) return res.status(404).json({ error: 'Não encontrado' });
    res.json({ request: r });
  } catch (e) { next(e); }
}

async function cancel(req, res, next) {
  try {
    const r = await prisma.resourceRequest.findUnique({ where: { id: req.params.id } });
    // D-08: fora de escopo esconde existência (404, não 403).
    if (!r || !canViewRequest(req.user, r)) return res.status(404).json({ error: 'Não encontrado' });
    // RN-010 (docs/14-decisoes-em-aberto.md:16): CONCLUIDO/CANCELADO imutáveis.
    if (['CONCLUIDO', 'CANCELADO'].includes(r.status)) return res.status(400).json({ error: 'Pedido imutável' });
    // D-06: justificativa obrigatória (auditada). Normaliza: só string não-vazia após trim passa.
    const justification = typeof req.body?.justification === 'string' ? req.body.justification.trim() : '';
    if (!justification) return res.status(400).json({ error: 'Justificativa obrigatória' });
    const isOwner = String(r.requesterId) === String(req.user.id);
    const role = req.user.role;
    const isLeader = ['ADMINISTRADOR', 'CHEFE_DEPARTAMENTO'].includes(role);
    // RN-010: status aprovado/provisionado (ramo com reversão compensatória).
    const approved = ['APROVADO', 'APROVADO_AUTOMATICAMENTE', 'APROVADO_PARCIALMENTE'].includes(r.status);
    if (approved) {
      if (!isLeader) return res.status(403).json({ error: 'Sem permissão' });
      // VOT-04 + GA-VOT-05: compensating REVERSE with conditional updateMany
      const approvedAmount = r.approvedAmountCents || 0;
      if (approvedAmount > 0) {
        await prisma.$transaction(async (tx) => {
          // GA-VOT-05: conditional updateMany - check provisionedCents >= approvedAmount
          const result = await tx.fundBalance.updateMany({
            where: { referenceYear: r.referenceYear, provisionedCents: { gte: approvedAmount } },
            data: {
              provisionedCents: { decrement: approvedAmount },
              availableCents: { increment: approvedAmount },
              version: { increment: 1 },
            },
          });
          if (result.count === 0) {
            throw Object.assign(new Error('Provisionado insuficiente para estorno'), { status: 400 });
          }
          await tx.financialTransaction.create({
            data: {
              requestId: r.id,
              type: 'REVERSE',
              amountCents: approvedAmount,
              fromState: 'PROVISIONADO',
              toState: 'DISPONIVEL',
              performedBy: req.user.id,
              metadata: JSON.stringify({
                justification,
                decidedBy: role,
                action: 'cancellation_reversal',
              }),
            },
          });
          await tx.auditEvent.create({
            data: {
              actorId: req.user.id,
              action: 'request_cancelled',
              entityType: 'request',
              entityId: r.id,
              beforeData: JSON.stringify({ status: r.status }),
              afterData: JSON.stringify({ status: 'CANCELADO', justification }),
              ipAddress: req.ip,
              userAgent: req.get('user-agent'),
            },
          });
          await tx.resourceRequest.update({
            where: { id: r.id },
            data: { status: 'CANCELADO' },
          });
        });
      } else {
        // Approved but no approvedAmountCents (edge case) — just status change + audit
        await prisma.resourceRequest.update({ where: { id: r.id }, data: { status: 'CANCELADO' } });
        await audit({ actorId: req.user.id, action: 'request_cancelled', entityType: 'request', entityId: r.id, beforeData: { status: r.status }, afterData: { status: 'CANCELADO', justification }, req });
      }
    } else if (role === 'ADMINISTRADOR') {
      // ADMIN: qualquer não-terminal (inclui INDEFERIDO como limpeza).
      const updated = await prisma.resourceRequest.update({ where: { id: r.id }, data: { status: 'CANCELADO' } });
      await audit({ actorId: req.user.id, action: 'request_cancelled', entityType: 'request', entityId: r.id, beforeData: { status: r.status }, afterData: { status: 'CANCELADO', justification }, req });
      return res.json({ ok: true, request: updated });
    } else if (role === 'CHEFE_DEPARTAMENTO') {
      // CHEFE: antes de CONCLUIDO (CONCLUIDO/CANCELADO já barrados acima).
      const updated = await prisma.resourceRequest.update({ where: { id: r.id }, data: { status: 'CANCELADO' } });
      await audit({ actorId: req.user.id, action: 'request_cancelled', entityType: 'request', entityId: r.id, beforeData: { status: r.status }, afterData: { status: 'CANCELADO', justification }, req });
      return res.json({ ok: true, request: updated });
    } else {
      // RN-010: dono somente RASCUNHO/EM_VOTACAO/SUBMETIDO.
      if (!isOwner) return res.status(403).json({ error: 'Sem permissão' });
      if (!['RASCUNHO', 'EM_VOTACAO', 'SUBMETIDO'].includes(r.status)) return res.status(403).json({ error: 'Sem permissão' });
      const updated = await prisma.resourceRequest.update({ where: { id: r.id }, data: { status: 'CANCELADO' } });
      await audit({ actorId: req.user.id, action: 'request_cancelled', entityType: 'request', entityId: r.id, beforeData: { status: r.status }, afterData: { status: 'CANCELADO', justification }, req });
      return res.json({ ok: true, request: updated });
    }
    const updated = await prisma.resourceRequest.findUnique({ where: { id: r.id } });
    res.json({ ok: true, request: updated });
  } catch (e) { next(e); }
}

module.exports = { list, create, submit, getOne, cancel };
