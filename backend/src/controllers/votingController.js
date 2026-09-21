const prisma = require('../config/db');
const { audit } = require('../services/auditService');
const { enqueue } = require('../services/emailService');
const { canVote, validateVoteInput, closeVoting, isSuspended } = require('../services/votingService');

function suspendedGuard(r) {
  if (r && r.status === 'SUSPENSO_REUNIAO_ORDINARIA') {
    return true;
  }
  return false;
}

async function enrichVotes(votes) {
  const ids = [...new Set(votes.map((v) => v.voterId).filter(Boolean))];
  const users = ids.length
    ? await prisma.user.findMany({ where: { id: { in: ids } }, select: { id: true, name: true, role: true } })
    : [];
  const map = new Map(users.map((u) => [u.id, u]));
  return votes.map((v) => {
    const u = map.get(v.voterId);
    return { ...v, voterName: u?.name || 'Usuário removido', voterRole: u?.role || null };
  });
}

async function listVotes(req, res, next) {
  try {
    const votes = await prisma.vote.findMany({ where: { requestId: req.params.id }, orderBy: { createdAt: 'asc' } });
    res.json({ votes: await enrichVotes(votes) });
  } catch (e) { next(e); }
}

async function castVote(req, res, next) {
  try {
    const r = await prisma.resourceRequest.findUnique({ where: { id: req.params.id } });
    if (!r) return res.status(404).json({ error: 'Não encontrado' });
    if (suspendedGuard(r)) return res.status(423).json({ error: 'Suspensa — somente leitura até liberação do chefe' });
    const check = canVote(req.user, r);
    if (!check.ok) return res.status(check.code).json({ error: check.error });
    try {
      validateVoteInput(req.body);
    } catch (e) {
      return res.status(400).json({ error: e.message });
    }
    const { voteType, comment, approvedAmountCents } = req.body;
    // desempate: chefe vota 1x com tieBreak
    const isTie = r.status === 'AGUARDANDO_DESEMPATE';
    try {
      const v = await prisma.vote.create({
        data: {
          requestId: r.id, voterId: req.user.id, voteType,
          comment: comment || '', approvedAmountCents: Math.round(Number(approvedAmountCents || 0)),
          tieBreak: isTie,
        },
      });
      await audit({ actorId: req.user.id, action: isTie ? 'tiebreak_vote' : 'vote_cast', entityType: 'vote', entityId: v.id, afterData: v, req });
      // se desempate, fecha imediatamente
      if (isTie) {
        const closed = await closeVoting(r.id, req.user.id);
        return res.status(201).json({ vote: (await enrichVotes([v]))[0], request: closed });
      }
      res.status(201).json({ vote: (await enrichVotes([v]))[0] });
    } catch (e) {
      if (String(e.message).includes('Unique')) {
        // alteração antes do fechamento: PUT /votes/me
        return res.status(409).json({ error: 'Já votou — use PUT /votes/me para alterar' });
      }
      throw e;
    }
  } catch (e) { next(e); }
}

async function changeMyVote(req, res, next) {
  try {
    const r = await prisma.resourceRequest.findUnique({ where: { id: req.params.id } });
    if (!r) return res.status(404).json({ error: 'Não encontrado' });
    if (suspendedGuard(r)) return res.status(423).json({ error: 'Suspensa — somente leitura' });
    if (r.status !== 'EM_VOTACAO') return res.status(400).json({ error: 'Alteração só durante votação aberta' });
    if (r.votingDeadlineAt && new Date(r.votingDeadlineAt) < new Date()) {
      return res.status(400).json({ error: 'Prazo encerrado' });
    }
    try { validateVoteInput(req.body); } catch (e) { return res.status(400).json({ error: e.message }); }
    const v = await prisma.vote.update({
      where: { requestId_voterId: { requestId: r.id, voterId: req.user.id } },
      data: { voteType: req.body.voteType, comment: req.body.comment || '', approvedAmountCents: Math.round(Number(req.body.approvedAmountCents || 0)) },
    });
    await audit({ actorId: req.user.id, action: 'vote_changed', entityType: 'vote', entityId: v.id, afterData: v, req });
    res.json({ vote: (await enrichVotes([v]))[0] });
  } catch (e) {
    if (String(e.message).includes('Record to update not found')) return res.status(404).json({ error: 'Voto não encontrado' });
    next(e);
  }
}

// Vista: máx 1 por conselheiro por solicitação
async function requestVista(req, res, next) {
  try {
    const r = await prisma.resourceRequest.findUnique({ where: { id: req.params.id } });
    if (!r) return res.status(404).json({ error: 'Não encontrado' });
    if (suspendedGuard(r)) return res.status(423).json({ error: 'Suspensa — somente leitura' });
    if (r.status !== 'EM_VOTACAO') return res.status(400).json({ error: 'Vista só durante votação' });
    if (!['ADMINISTRADOR', 'CHEFE_DEPARTAMENTO', 'CONSELHEIRO', 'PROFESSOR'].includes(req.user.role)) {
      return res.status(403).json({ error: 'Sem permissão para vista' });
    }
    if (!req.body.justification) return res.status(400).json({ error: 'Justificativa obrigatória' });
    const settings = await prisma.departmentSettings.findUnique({ where: { id: 'default' } });
    const extH = settings?.viewExtensionHours ?? 24;
    const before = r.votingDeadlineAt ? new Date(r.votingDeadlineAt) : new Date();
    const after = new Date(before.getTime() + extH * 3600 * 1000);
    try {
      const v = await prisma.viewRequest.create({
        data: { requestId: r.id, requestedBy: req.user.id, justification: req.body.justification, deadlineBefore: before, deadlineAfter: after },
      });
      await prisma.resourceRequest.update({ where: { id: r.id }, data: { votingDeadlineAt: after } });
      await audit({ actorId: req.user.id, action: 'vista_requested', entityType: 'view_request', entityId: v.id, afterData: v, req });
      await enqueue('conselho@utfpr.edu.br', `[SGRD] Vista em ${r.title}`, `Vista de ${req.user.name}. Novo prazo: ${after.toISOString()}`);
      res.status(201).json({ vista: v, newDeadline: after });
    } catch (e) {
      if (String(e.message).includes('Unique')) return res.status(409).json({ error: 'Você já usou sua vista nesta solicitação (máx 1 por conselheiro)' });
      throw e;
    }
  } catch (e) { next(e); }
}

async function closeManual(req, res, next) {
  try {
    const r = await prisma.resourceRequest.findUnique({ where: { id: req.params.id } });
    if (!r) return res.status(404).json({ error: 'Não encontrado' });
    if (!['ADMINISTRADOR', 'CHEFE_DEPARTAMENTO'].includes(req.user.role)) {
      return res.status(403).json({ error: 'Só admin/chefe' });
    }
    const closed = await closeVoting(r.id, req.user.id);
    await audit({ actorId: req.user.id, action: 'voting_closed', entityType: 'request', entityId: r.id, afterData: closed, req });
    res.json({ request: closed });
  } catch (e) { next(e); }
}

// Suspensão: só chefe. Read-only até liberação.
async function suspend(req, res, next) {
  try {
    if (req.user.role !== 'CHEFE_DEPARTAMENTO') return res.status(403).json({ error: 'Só o chefe suspende' });
    const r = await prisma.resourceRequest.findUnique({ where: { id: req.params.id } });
    if (!r) return res.status(404).json({ error: 'Não encontrado' });
    if (r.status !== 'EM_VOTACAO') return res.status(400).json({ error: 'Só suspende EM_VOTACAO' });
    if (!req.body.justification) return res.status(400).json({ error: 'Justificativa obrigatória' });
    const up = await prisma.resourceRequest.update({
      where: { id: r.id },
      data: {
        status: 'SUSPENSO_REUNIAO_ORDINARIA', suspendedAt: new Date(), suspendedBy: req.user.id,
        suspensionReason: req.body.justification, meetingDate: req.body.meetingDate ? new Date(req.body.meetingDate) : null,
        deadlineFrozenAt: r.votingDeadlineAt,
      },
    });
    await audit({ actorId: req.user.id, action: 'voting_suspended', entityType: 'request', entityId: r.id, afterData: up, req });
    res.json({ request: up });
  } catch (e) { next(e); }
}

async function unsuspend(req, res, next) {
  try {
    if (req.user.role !== 'CHEFE_DEPARTAMENTO') return res.status(403).json({ error: 'Só o chefe libera' });
    const r = await prisma.resourceRequest.findUnique({ where: { id: req.params.id } });
    if (!r) return res.status(404).json({ error: 'Não encontrado' });
    if (r.status !== 'SUSPENSO_REUNIAO_ORDINARIA') return res.status(400).json({ error: 'Não está suspensa' });
    const frozen = r.deadlineFrozenAt ? new Date(r.deadlineFrozenAt) : new Date();
    const suspendedMs = Date.now() - new Date(r.suspendedAt).getTime();
    const newDeadline = new Date(frozen.getTime() + suspendedMs);
    const up = await prisma.resourceRequest.update({
      where: { id: r.id },
      data: { status: 'EM_VOTACAO', votingDeadlineAt: newDeadline, suspendedAt: null, deadlineFrozenAt: null },
    });
    await audit({ actorId: req.user.id, action: 'voting_unsuspended', entityType: 'request', entityId: r.id, afterData: up, req });
    res.json({ request: up });
  } catch (e) { next(e); }
}

// Decisão colegiada inserida pelo chefe (direto do suspenso)
async function collegiateDecision(req, res, next) {
  try {
    if (req.user.role !== 'CHEFE_DEPARTAMENTO') return res.status(403).json({ error: 'Só o chefe' });
    const r = await prisma.resourceRequest.findUnique({ where: { id: req.params.id } });
    if (!r) return res.status(404).json({ error: 'Não encontrado' });
    if (r.status !== 'SUSPENSO_REUNIAO_ORDINARIA') return res.status(400).json({ error: 'Só decide do estado suspenso' });
    const { result, approvedAmountCents, approvedItems, ataText, meetingDate } = req.body;
    if (!['DEFERIDO', 'INDEFERIDO', 'PARCIAL'].includes(result)) return res.status(400).json({ error: 'result DEFERIDO|INDEFERIDO|PARCIAL' });
    if (!ataText) return res.status(400).json({ error: 'Ata obrigatória' });
    const approved = Math.round(Number(approvedAmountCents || 0));
    if (result === 'PARCIAL' && (!approved || approved <= 0 || approved > r.requestedAmountCents)) {
      return res.status(400).json({ error: 'Valor parcial inválido' });
    }
    const status = result === 'DEFERIDO' ? 'APROVADO' : result === 'PARCIAL' ? 'APROVADO_PARCIALMENTE' : 'INDEFERIDO';
    const finalApproved = result === 'DEFERIDO' ? r.requestedAmountCents : result === 'PARCIAL' ? approved : 0;
    const up = await prisma.$transaction(async (tx) => {
      const u = await tx.resourceRequest.update({
        where: { id: r.id },
        data: {
          status, approvedAmountCents: finalApproved, decidedAt: new Date(), decidedBy: req.user.id,
          decisionReason: `Decisão colegiada ${result}`, collegiateMinutes: ataText,
          approvedItems: JSON.stringify(approvedItems || []),
          ...(meetingDate ? { meetingDate: new Date(meetingDate) } : {}),
        },
      });
      if (finalApproved > 0) {
        const bal = await tx.fundBalance.findUnique({ where: { referenceYear: r.referenceYear } });
        if (!bal || bal.availableCents < finalApproved) throw Object.assign(new Error('Saldo insuficiente'), { status: 400 });
        await tx.fundBalance.update({
          where: { referenceYear: r.referenceYear },
          data: { availableCents: { decrement: finalApproved }, provisionedCents: { increment: finalApproved }, version: { increment: 1 } },
        });
        await tx.financialTransaction.create({
          data: { requestId: r.id, type: 'PROVISION', amountCents: finalApproved, fromState: 'DISPONIVEL', toState: 'PROVISIONADO', performedBy: req.user.id, metadata: JSON.stringify({ collegiate: result }) },
        });
      }
      return u;
    });
    await audit({ actorId: req.user.id, action: 'collegiate_decision', entityType: 'request', entityId: r.id, afterData: up, req });
    const requester = await prisma.user.findUnique({ where: { id: r.requesterId } });
    await enqueue(requester.email, `[SGRD] Decisão colegiada ${status}`, `Pedido ${r.title}: ${status}. Ata: ${ataText.slice(0, 200)}`);
    res.json({ request: up });
  } catch (e) { next(e); }
}

module.exports = { listVotes, castVote, changeMyVote, requestVista, closeManual, suspend, unsuspend, collegiateDecision };
