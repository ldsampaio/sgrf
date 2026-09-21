const prisma = require('../config/db');

// Aprovação automática: totalAnual(requester, referenceYear) + nova <= limite
async function annualTotalCents(requesterId, referenceYear, excludeId) {
  const rows = await prisma.resourceRequest.findMany({
    where: {
      requesterId,
      referenceYear,
      status: { in: ['SUBMETIDO', 'EM_VOTACAO', 'APROVADO', 'APROVADO_AUTOMATICAMENTE', 'APROVADO_PARCIALMENTE'] },
      ...(excludeId ? { id: { not: excludeId } } : {}),
    },
    select: { requestedAmountCents: true },
  });
  return rows.reduce((s, r) => s + r.requestedAmountCents, 0);
}

async function getSettings() {
  let s = await prisma.departmentSettings.findUnique({ where: { id: 'default' } });
  if (!s) s = await prisma.departmentSettings.create({ data: { id: 'default' } });
  return s;
}

async function getBalance(referenceYear) {
  let b = await prisma.fundBalance.findUnique({ where: { referenceYear } });
  if (!b) b = await prisma.fundBalance.create({ data: { referenceYear } });
  return b;
}

// Cálculo por tipo — retorna requestedAmountCents + campos normalizados
function calcAmount(type, payload, exchangeRate) {
  if (type === 'EQUIPAMENTO') {
    const v = Math.round(Number(payload.estimatedValue) * 100);
    if (!Number.isFinite(v) || v <= 0) throw new Error('Valor estimado inválido');
    return { requestedAmountCents: v, originalCurrency: 'BRL' };
  }
  if (type === 'PUBLICACAO') {
    const v = Math.round(Number(payload.publicationFee) * 100);
    if (!Number.isFinite(v) || v <= 0) throw new Error('Taxa de publicação inválida');
    return { requestedAmountCents: v, originalCurrency: 'BRL' };
  }
  if (type === 'VIAGEM') {
    const dailyCount = Number(payload.dailyCount || 0);
    const dailyRateCents = Math.round(Number(payload.dailyRate || 0) * 100);
    const passageCents = Math.round(Number(payload.passageAmount || 0) * 100);
    if (payload.consultedOtherSources && !payload.consultedSources) {
      throw new Error('Informe quais fontes foram consultadas');
    }
    if (payload.currency === 'USD') {
      const totalUSD = dailyCount * Number(payload.dailyRate || 0) + Number(payload.passageAmount || 0);
      const converted = Math.round(totalUSD * 100 * Number(exchangeRate));
      return { requestedAmountCents: converted, originalCurrency: 'USD', exchangeRate: Number(exchangeRate), convertedAmountCents: converted };
    }
    const total = dailyCount * dailyRateCents + passageCents;
    if (total <= 0) throw new Error('Total da viagem inválido');
    return { requestedAmountCents: total, originalCurrency: 'BRL' };
  }
  if (type === 'AUXILIO_ESTUDANTIL') {
    const v = Math.round(Number(payload.estimatedAmount) * 100);
    if (!Number.isFinite(v) || v <= 0) throw new Error('Valor do auxílio inválido');
    return { requestedAmountCents: v, originalCurrency: 'BRL' };
  }
  throw new Error('Tipo desconhecido');
}

module.exports = { annualTotalCents, getSettings, getBalance, calcAmount };
