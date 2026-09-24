const express = require('express');
const PDFDocument = require('pdfkit');
const prisma = require('../config/db');
const { audit } = require('../services/auditService');
const { authJwt } = require('../middlewares/auth');
const { requirePermission } = require('../middlewares/permissions');

const router = express.Router();
router.use(authJwt);

function scopeFilter(user, q) {
  const where = {};
  if (user.role === 'ALUNO' || user.role === 'PROFESSOR') where.requesterId = user.id;
  else if (q.mine === '1') where.requesterId = user.id;
  if (q.status) where.status = q.status;
  if (q.type) where.type = q.type;
  if (q.from || q.to) {
    where.createdAt = {};
    if (q.from) where.createdAt.gte = new Date(q.from);
    if (q.to) where.createdAt.lte = new Date(q.to);
  }
  return where;
}

function toCSV(rows, cols) {
  const esc = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  return [cols.join(','), ...rows.map((r) => cols.map((c) => esc(r[c])).join(','))].join('\n');
}

router.get('/requests', requirePermission('reports:requests'), async (req, res, next) => {
  try {
    const where = scopeFilter(req.user, req.query);
    const requests = await prisma.resourceRequest.findMany({ where, orderBy: { createdAt: 'desc' }, take: 500 });
    if (req.query.format === 'csv') {
      res.header('Content-Type', 'text/csv');
      return res.send(toCSV(requests, ['id', 'title', 'type', 'status', 'requestedAmountCents', 'approvedAmountCents', 'referenceYear']));
    }
    if (req.query.format === 'pdf') {
      res.header('Content-Type', 'application/pdf');
      const doc = new PDFDocument();
      doc.pipe(res);
      doc.fontSize(16).text('SGRD — Relatório de Solicitações');
      doc.fontSize(10);
      for (const r of requests.slice(0, 200)) {
        doc.text(`${r.title} [${r.status}] ${(r.requestedAmountCents / 100).toFixed(2)}`);
      }
      doc.end();
      await audit({ actorId: req.user.id, action: 'report_exported', entityType: 'report', entityId: 'requests-pdf', req });
      return;
    }
    res.json({ requests });
  } catch (e) { next(e); }
});

router.get('/financial', requirePermission('reports:financial'), async (req, res, next) => {
  try {
    if (!['ADMINISTRADOR', 'CHEFE_DEPARTAMENTO'].includes(req.user.role)) {
      return res.status(403).json({ error: 'Sem permissão' });
    }
    const txs = await prisma.financialTransaction.findMany({ orderBy: { createdAt: 'desc' }, take: 500 });
    const balances = await prisma.fundBalance.findMany({ orderBy: { referenceYear: 'desc' } });
    if (req.query.format === 'csv') {
      res.header('Content-Type', 'text/csv');
      return res.send(toCSV(txs, ['id', 'requestId', 'type', 'amountCents', 'fromState', 'toState']));
    }
    res.json({ transactions: txs, balances });
  } catch (e) { next(e); }
});

router.get('/voting', requirePermission('reports:voting'), async (req, res, next) => {
  try {
    const votes = await prisma.vote.findMany({ orderBy: { createdAt: 'desc' }, take: 500 });
    const vistas = await prisma.viewRequest.findMany({ orderBy: { createdAt: 'desc' }, take: 200 });
    res.json({ votes, vistas });
  } catch (e) { next(e); }
});

router.get('/accountability', requirePermission('reports:accountability'), async (req, res, next) => {
  try {
    const requests = await prisma.resourceRequest.findMany({
      where: { status: { in: ['APROVADO', 'APROVADO_AUTOMATICAMENTE', 'APROVADO_PARCIALMENTE', 'CONCLUIDO'] } },
      orderBy: { decidedAt: 'desc' }, take: 500,
    });
    if (req.query.format === 'pdf') {
      res.header('Content-Type', 'application/pdf');
      const doc = new PDFDocument();
      doc.pipe(res);
      doc.fontSize(16).text('SGRD — Prestação de Contas');
      doc.fontSize(10);
      for (const r of requests) {
        doc.text(`${r.title} solicitado ${(r.requestedAmountCents / 100).toFixed(2)} aprovado ${(r.approvedAmountCents / 100).toFixed(2)} status ${r.status}`);
      }
      doc.end();
      await audit({ actorId: req.user.id, action: 'report_exported', entityType: 'report', entityId: 'accountability-pdf', req });
      return;
    }
    res.json({ requests });
  } catch (e) { next(e); }
});

// Stub RPA Fase 7
router.get('/integration/provisioned', requirePermission('reports:integration'), async (req, res) => {
  res.json({ note: 'Fase 7 — stub', hint: 'usar /api/reports/financial por enquanto' });
});

// Dashboard agregados: 3 pizzas (docentes Top8, saldos, categorias)
router.get('/dashboard', requirePermission('reports:dashboard'), async (req, res, next) => {
  try {
    const year = Number(req.query.year || new Date().getFullYear());
    const where = scopeFilter(req.user, { ...req.query, mine: ['ALUNO', 'PROFESSOR'].includes(req.user.role) ? '1' : req.query.mine });
    where.referenceYear = year;
    const requests = await prisma.resourceRequest.findMany({ where, take: 2000, include: { requester: { select: { name: true } } } });
    const live = requests.filter((r) => r.status !== 'CANCELADO');
    // por docente (solicitado)
    const byUser = new Map();
    for (const r of live) {
      const k = r.requester?.name || r.requesterId;
      byUser.set(k, (byUser.get(k) || 0) + r.requestedAmountCents);
    }
    const sorted = [...byUser.entries()].sort((a, b) => b[1] - a[1]);
    const top = sorted.slice(0, 8).map(([name, totalCents]) => ({ name, totalCents }));
    const rest = sorted.slice(8).reduce((s, [, v]) => s + v, 0);
    if (rest > 0) top.push({ name: 'Outros', totalCents: rest });
    // por categoria (aprovados/gastos: usa approvedAmountCents quando >0 senão 0)
    // sempre os 4 tipos para legenda estável no frontend
    const cats = { EQUIPAMENTO: 0, PUBLICACAO: 0, VIAGEM: 0, AUXILIO_ESTUDANTIL: 0 };
    for (const r of live) {
      const v = r.approvedAmountCents > 0 ? r.approvedAmountCents : 0;
      cats[r.type] = (cats[r.type] || 0) + v;
    }
    const byCategoria = Object.entries(cats).map(([type, totalCents]) => ({ type, totalCents }));
    // saldos do ano
    const bal = await prisma.fundBalance.findUnique({ where: { referenceYear: year } });
    const bySaldo = {
      disponivel: bal?.availableCents || 0,
      provisionado: bal?.provisionedCents || 0,
      gasto: bal?.spentCents || 0,
    };
    const solicitado = live.reduce((s, r) => s + r.requestedAmountCents, 0);
    const aprovado = live.reduce((s, r) => s + (r.approvedAmountCents || 0), 0);
    res.json({ year, byDocente: top, byCategoria, bySaldo, totals: { solicitado, aprovado } });
  } catch (e) { next(e); }
});

function dataURLtoBuffer(dataURL) {
  const m = /^data:image\/png;base64,(.+)$/.exec(String(dataURL || ''));
  if (!m) throw Object.assign(new Error('Imagem PNG inválida'), { status: 400 });
  const buf = Buffer.from(m[1], 'base64');
  if (buf.length > 2 * 1024 * 1024) throw Object.assign(new Error('Imagem muito grande'), { status: 400 });
  return buf;
}

// PDF do dashboard com gráficos (imagens PNG vindas do frontend)
router.post('/dashboard-pdf', requirePermission('reports:dashboard'), async (req, res, next) => {
  try {
    const year = Number(req.body?.year || new Date().getFullYear());
    const images = req.body?.images || {};
    res.header('Content-Type', 'application/pdf');
    const doc = new PDFDocument();
    doc.pipe(res);
    doc.fontSize(18).text(`SGRD — Dashboard ${year}`);
    doc.moveDown();
    // tabelas resumo via dashboard JSON interno
    const dashReq = { user: req.user, query: { year: String(year) } };
    // reutiliza lógica: busca direta
    const where = scopeFilter(req.user, {});
    where.referenceYear = year;
    const requests = await prisma.resourceRequest.findMany({ where, take: 2000, include: { requester: { select: { name: true } } } });
    const live = requests.filter((r) => r.status !== 'CANCELADO');
    doc.fontSize(12).text(`Solicitações: ${live.length} | Total solicitado: R$ ${(live.reduce((s, r) => s + r.requestedAmountCents, 0) / 100).toFixed(2)}`);
    doc.moveDown();
    for (const [key, title] of [['docentes', 'Docentes × valores'], ['saldos', 'Disponível × Provisionado × Gasto'], ['categorias', 'Gastos por categoria']]) {
      doc.fontSize(14).text(title);
      if (images[key]) {
        try {
          doc.image(dataURLtoBuffer(images[key]), { fit: [450, 280] });
        } catch {
          doc.fontSize(10).text('(imagem inválida)');
        }
      } else {
        doc.fontSize(10).text('(sem imagem — exporte com gráficos renderizados)');
      }
      doc.moveDown();
    }
    doc.fontSize(10).text('Detalhamento por solicitação:');
    for (const r of live.slice(0, 300)) {
      doc.text(`${r.requester?.name || ''} — ${r.title} [${r.type}] solicitado ${(r.requestedAmountCents / 100).toFixed(2)} aprovado ${(r.approvedAmountCents / 100).toFixed(2)}`);
    }
    doc.end();
    await audit({ actorId: req.user.id, action: 'report_exported', entityType: 'report', entityId: `dashboard-pdf-${year}`, req });
  } catch (e) { next(e); }
});

module.exports = router;
