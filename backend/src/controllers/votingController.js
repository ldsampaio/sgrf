const prisma = require('../config/db');
const { audit } = require('../services/auditService');
const { enqueue } = require('../services/emailService');
const { canVote, validateVoteInput, closeVoting, isSuspended } = require('../services/votingService');
const { canViewRequest } = require('../middlewares/visibility');

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
    // D-01/D-02: votos são transparentes — quem vê o pedido vê cada voto
    // (identidade + valor) em detalhe total; fora de escopo lê 404 (D-08).
    const r = await prisma.resourceRequest.findUnique({ where: { id: req.params.id } });
    if (!r || !canViewRequest(req.user, r)) return res.status(404).json({ error: 'Não encontrado' });
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
        // VOT-03: handle arbitration return
        if (closed?.needsArbitration) {
          return res.status(201).json({ vote: (await enrichVotes([v]))[0], arbitration: closed });
        }
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

// VOT-01 grep audit (2026-09-24): status guards related to voting states
// ==== status === guards ====
// votingController.js:8   suspendedGuard - SUSPENSO_REUNIAO_ORDINARIA (read-only)
// votingController.js:51  castVote isTie - AGUARDANDO_DESEMPATE (allows chefe tie-break vote)
// votingController.js:83  changeMyVote isTieBreak - AGUARDANDO_DESEMPATE (VOT-01 fix)
// deliberationController.js:6 suspendedGuard - SUSPENSO_REUNIAO_ORDINARIA
// financeController.js:6    suspendedGuard - SUSPENSO_REUNIAO_ORDINARIA
// votingService.js:7        isSuspended - SUSPENSO_REUNIAO_ORDINARIA
// votingService.js:15       canVote deadline check - EM_VOTACAO only (correct)
// votingService.js:22       canVote tie-break eligibility - AGUARDANDO_DESEMPATE + chefe only (VOT-01 correct)
// votingService.js:64       closeVoting suspended check - SUSPENSO_REUNIAO_ORDINARIA
// requestController.js:77   submit deadline - EM_VOTACAO only (correct)
// ==== status !== guards ====
// votingController.js:84    changeMyVote - allows EM_VOTACAO || AGUARDANDO_DESEMPATE (VOT-01 fix)
// votingController.js:117   requestVista - EM_VOTACAO only (correct, no vista in tie-break)
// votingController.js:160   suspend - EM_VOTACAO only (correct, no suspend in tie-break)
// votingController.js:180   unsuspend - SUSPENSO_REUNIAO_ORDINARIA only (correct)
// votingController.js:199   collegiateDecision - SUSPENSO_REUNIAO_ORDINARIA only (correct)
// votingService.js:12       canVote - EM_VOTACAO || AGUARDANDO_DESEMPATE (VOT-01 correct)
// votingService.js:67       closeVoting - EM_VOTACAO || AGUARDANDO_DESEMPATE (correct)
// votingCloser.js:8         closeExpired - queries EM_VOTACAO only (correct, Phase 7 handles tie-break auto-close)
//
// No other guards need adjustment for VOT-01. Future plans (Phase 7) will handle votingCloser for AGUARDANDO_DESEMPATE.

async function changeMyVote(req, res, next) {
  try {
    const r = await prisma.resourceRequest.findUnique({ where: { id: req.params.id } });
    if (!r) return res.status(404).json({ error: 'Não encontrado' });
    if (suspendedGuard(r)) return res.status(423).json({ error: 'Suspensa — somente leitura' });
    // VOT-01: allow change during AGUARDANDO_DESEMPATE for chefe only
    const isTieBreak = r.status === 'AGUARDANDO_DESEMPATE';
    if (!isTieBreak && r.status !== 'EM_VOTACAO') {
      return res.status(400).json({ error: 'Alteração só durante votação aberta ou desempate' });
    }
    if (isTieBreak && req.user.role !== 'CHEFE_DEPARTAMENTO') {
      return res.status(403).json({ error: 'Apenas o chefe pode alterar voto no desempate' });
    }
    if (r.votingDeadlineAt && new Date(r.votingDeadlineAt) < new Date() && !isTieBreak) {
      return res.status(400).json({ error: 'Prazo encerrado' });
    }
    try { validateVoteInput(req.body); } catch (e) { return res.status(400).json({ error: e.message }); }
    const v = await prisma.vote.update({
      where: { requestId_voterId: { requestId: r.id, voterId: req.user.id } },
      data: { voteType: req.body.voteType, comment: req.body.comment || '', approvedAmountCents: Math.round(Number(req.body.approvedAmountCents || 0)), tieBreak: isTieBreak },
    });
    await audit({ actorId: req.user.id, action: isTieBreak ? 'tiebreak_vote_change' : 'vote_changed', entityType: 'vote', entityId: v.id, afterData: v, req });
    // VOT-01: if tie-break, close voting immediately after chefe changes vote
    if (isTieBreak) {
      const closed = await closeVoting(r.id, req.user.id);
      return res.json({ vote: (await enrichVotes([v]))[0], request: closed });
    }
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
    // VOT-03: handle arbitration return
    if (closed?.needsArbitration) {
      await audit({ actorId: req.user.id, action: 'voting_closed_arbitration', entityType: 'request', entityId: r.id, afterData: closed, req });
      return res.json({ arbitration: closed });
    }
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

// VOT-03: Arbitragem de aprovação parcial — chefe define valor final com justificativa
async function partialArbitration(req, res, next) {
  try {
    if (req.user.role !== 'CHEFE_DEPARTAMENTO') {
      return res.status(403).json({ error: 'Apenas o chefe do departamento pode arbitrar' });
    }
    const r = await prisma.resourceRequest.findUnique({ where: { id: req.params.id } });
    if (!r) return res.status(404).json({ error: 'Não encontrado' });
    // Must be in arbitration state
    if (r.status !== 'APROVADO_PARCIALMENTE' || r.decisionReason !== 'AGUARDANDO_ARBITRAGEM') {
      return res.status(400).json({ error: 'Solicitação não está em estado de arbitragem' });
    }
    const { approvedAmountCents, justification } = req.body;
    const amount = Math.round(Number(approvedAmountCents || 0));
    if (!amount || amount <= 0 || amount > r.requestedAmountCents) {
      return res.status(400).json({ error: 'Valor deve estar entre 1 e o valor solicitado' });
    }
    if (!justification || !String(justification).trim()) {
      return res.status(400).json({ error: 'Justificativa obrigatória para arbitragem' });
    }

    const up = await prisma.$transaction(async (tx) => {
      // Conditional FundBalance update (GA-VOT-05 pattern - to be hardened in Wave 4)
      const bal = await tx.fundBalance.findUnique({ where: { referenceYear: r.referenceYear } });
      if (!bal || bal.availableCents < amount) {
        throw Object.assign(new Error('Saldo insuficiente'), { status: 400 });
      }
      await tx.fundBalance.update({
        where: { referenceYear: r.referenceYear },
        data: { availableCents: { decrement: amount }, provisionedCents: { increment: amount }, version: { increment: 1 } },
      });
      await tx.financialTransaction.create({
        data: {
          requestId: r.id,
          type: 'PROVISION',
          amountCents: amount,
          fromState: 'DISPONIVEL',
          toState: 'PROVISIONADO',
          performedBy: req.user.id,
          metadata: JSON.stringify({ decidedBy: 'CHEFE_DEPARTAMENTO', action: 'partial_arbitration', justification }),
        },
      });
      const u = await tx.resourceRequest.update({
        where: { id: r.id },
        data: {
          status: 'APROVADO_PARCIALMENTE',
          approvedAmountCents: amount,
          decidedAt: new Date(),
          decidedBy: req.user.id,
          decisionReason: null,
          collegiateMinutes: justification,
        },
      });
      return u;
    });
    await audit({
      actorId: req.user.id,
      action: 'partial_arbitration',
      entityType: 'request',
      entityId: r.id,
      afterData: { status: 'APROVADO_PARCIALMENTE', approvedAmountCents: amount, justification },
      req,
    });
    const requester = await prisma.user.findUnique({ where: { id: r.requesterId } });
    await enqueue(requester.email, `[SGRD] Arbitragem parcial concluída`, `Pedido ${r.title}: valor aprovado ${(amount / 100).toFixed(2)}. Justificativa: ${justification}`);
    res.json({ request: up });
  } catch (e) { next(e); }
}

module.exports = { listVotes, castVote, changeMyVote, requestVista, closeManual, suspend, unsuspend, collegiateDecision, partialArbitration };
