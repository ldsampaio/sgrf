const prisma = require('../config/db');

const ELIGIBLE = ['CHEFE_DEPARTAMENTO', 'CONSELHEIRO'];
const VALID = ['DEFERIR', 'INDEFERIR', 'DEFERIR_PARCIALMENTE', 'ABSTER_SE'];

function isSuspended(r) {
  return r.status === 'SUSPENSO_REUNIAO_ORDINARIA';
}

function canVote(user, request, existingVotes) {
  if (isSuspended(request)) return { ok: false, code: 423, error: 'Solicitação suspensa — somente leitura' };
  if (request.status !== 'EM_VOTACAO' && request.status !== 'AGUARDANDO_DESEMPATE') {
    return { ok: false, code: 400, error: 'Votação não está aberta' };
  }
  if (request.votingDeadlineAt && new Date(request.votingDeadlineAt) < new Date() && request.status === 'EM_VOTACAO') {
    return { ok: false, code: 400, error: 'Prazo encerrado' };
  }
  if (!ELIGIBLE.includes(user.role)) return { ok: false, code: 403, error: 'Sem elegibilidade para votar' };
  if (String(request.requesterId) === String(user.id)) {
    return { ok: false, code: 403, error: 'Solicitante não vota na própria solicitação' };
  }
  if (request.status === 'AGUARDANDO_DESEMPATE' && user.role !== 'CHEFE_DEPARTAMENTO') {
    return { ok: false, code: 403, error: 'Aguardando desempate do chefe' };
  }
  return { ok: true };
}

// Maioria simples dos válidos, sem quórum. Abstenção ignora.
function tally(votes) {
  const valid = votes.filter((v) => v.voteType !== 'ABSTER_SE');
  let defer = 0, indefer = 0, parcial = 0;
  for (const v of valid) {
    if (v.voteType === 'DEFERIR') defer++;
    else if (v.voteType === 'INDEFERIR') indefer++;
    else if (v.voteType === 'DEFERIR_PARCIALMENTE') parcial++;
  }
  const total = defer + indefer + parcial;
  if (total === 0) return { outcome: 'SEM_VOTOS', defer, indefer, parcial };
  if (defer > indefer + parcial) return { outcome: 'DEFERIDO', defer, indefer, parcial };
  if (indefer > defer + parcial) return { outcome: 'INDEFERIDO', defer, indefer, parcial };
  // parcial só vence com maioria própria; senão empate se topo empatado
  const top = Math.max(defer, indefer, parcial);
  const winners = ['DEFERIDO', 'INDEFERIDO', 'PARCIAL'].filter((_, i) => [defer, indefer, parcial][i] === top);
  if (winners.length === 1) {
    const m = { DEFERIDO: 'DEFERIDO', INDEFERIDO: 'INDEFERIDO', PARCIAL: 'PARCIAL' };
    return { outcome: m[winners[0]], defer, indefer, parcial };
  }
  return { outcome: 'EMPATE', defer, indefer, parcial };
}

function validateVoteInput({ voteType, comment, approvedAmountCents }) {
  if (!VALID.includes(voteType)) throw new Error('Tipo de voto inválido');
  if (voteType === 'DEFERIR_PARCIALMENTE') {
    if (!comment) throw new Error('Voto parcial exige comentário');
    if (!approvedAmountCents || Number(approvedAmountCents) <= 0) throw new Error('Voto parcial exige valor aprovado');
  }
}

// Fecha votação: idempotente. Retorna request atualizado ou arbitration indicator.
async function closeVoting(requestId, performedBy = 'system') {
  const r = await prisma.resourceRequest.findUnique({ where: { id: requestId } });
  if (!r) throw Object.assign(new Error('Não encontrado'), { status: 404 });
  if (['APROVADO', 'APROVADO_PARCIALMENTE', 'INDEFERIDO'].includes(r.status)) return r; // idempotente
  if (r.status === 'SUSPENSO_REUNIAO_ORDINARIA') {
    throw Object.assign(new Error('Suspensa — aguarde liberação do chefe'), { status: 423 });
  }
  if (r.status !== 'EM_VOTACAO' && r.status !== 'AGUARDANDO_DESEMPATE') {
    throw Object.assign(new Error('Votação não aberta'), { status: 400 });
  }
  const votes = await prisma.vote.findMany({ where: { requestId } });
  // exclui solicitante-conselheiro por segurança
  const validVotes = votes.filter((v) => String(v.voterId) !== String(r.requesterId));
  
  // VOT-03: Check for any DEFERIR_PARCIALMENTE vote - triggers arbitration
  const hasPartialVote = validVotes.some((v) => v.voteType === 'DEFERIR_PARCIALMENTE');
  if (hasPartialVote) {
    // AGUARDANDO_ARBITRAGEM is a logical state using APROVADO_PARCIALMENTE + metadata
    const arbitrationResult = {
      needsArbitration: true,
      status: 'APROVADO_PARCIALMENTE',
      arbitration: true,
      requestId: r.id,
    };
    
    await prisma.$transaction(async (tx) => {
      await tx.resourceRequest.update({
        where: { id: r.id },
        data: {
          status: 'APROVADO_PARCIALMENTE',
          approvedAmountCents: 0, // no provision until arbitration
          decidedAt: null,
          decidedBy: performedBy,
          decisionReason: 'AGUARDANDO_ARBITRAGEM',
          collegiateMinutes: 'Aguardando arbitragem do chefe — voto parcial detectado',
        },
      });
      await tx.vote.updateMany({ where: { requestId }, data: { finalizedAt: new Date() } });
    });
    
    return arbitrationResult;
  }
  
  const t = tally(validVotes);

  let status = r.status;
  let approvedCents = 0;
  if (t.outcome === 'EMPATE') {
    status = 'AGUARDANDO_DESEMPATE';
  } else if (t.outcome === 'DEFERIDO') {
    status = 'APROVADO'; approvedCents = r.requestedAmountCents;
  } else if (t.outcome === 'PARCIAL') {
    status = 'APROVADO_PARCIALMENTE';
    // This should not be reached since partial votes are handled above
    // but keeping for safety - should not happen
    const p = validVotes.find((v) => v.voteType === 'DEFERIR_PARCIALMENTE');
    approvedCents = p ? p.approvedAmountCents : 0;
  } else if (t.outcome === 'INDEFERIDO' || t.outcome === 'SEM_VOTOS') {
    status = 'INDEFERIDO';
  }

  return prisma.$transaction(async (tx) => {
    const up = await tx.resourceRequest.update({
      where: { id: r.id },
      data: { status, approvedAmountCents: approvedCents, decidedAt: status.startsWith('APROVADO') || status === 'INDEFERIDO' ? new Date() : null, decidedBy: performedBy },
    });
    if (status === 'APROVADO' || status === 'APROVADO_PARCIALMENTE') {
      // GA-VOT-05: conditional updateMany - check availableCents >= approvedCents
      const result = await tx.fundBalance.updateMany({
        where: { referenceYear: r.referenceYear, availableCents: { gte: approvedCents } },
        data: { availableCents: { decrement: approvedCents }, provisionedCents: { increment: approvedCents }, version: { increment: 1 } },
      });
      if (result.count === 0) {
        throw Object.assign(new Error('Saldo insuficiente'), { status: 400 });
      }
      await tx.financialTransaction.create({
        data: { requestId: r.id, type: 'PROVISION', amountCents: approvedCents, fromState: 'DISPONIVEL', toState: 'PROVISIONADO', performedBy, metadata: JSON.stringify({ tally: t }) },
      });
    }
    await tx.vote.updateMany({ where: { requestId }, data: { finalizedAt: new Date() } });
    return up;
  });
}

module.exports = { canVote, tally, validateVoteInput, closeVoting, isSuspended, ELIGIBLE };
