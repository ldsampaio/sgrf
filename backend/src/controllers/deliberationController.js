const prisma = require('../config/db');
const { audit } = require('../services/auditService');
const { canViewRequest } = require('../middlewares/visibility');

function suspended(r) {
  return r && r.status === 'SUSPENSO_REUNIAO_ORDINARIA';
}

async function enrichMessages(msgs) {
  const ids = [...new Set(msgs.map((m) => m.authorId).filter(Boolean))];
  const users = ids.length
    ? await prisma.user.findMany({ where: { id: { in: ids } }, select: { id: true, name: true, role: true } })
    : [];
  const map = new Map(users.map((u) => [u.id, u]));
  return msgs.map((m) => {
    const u = map.get(m.authorId);
    let edited = false;
    try { edited = (JSON.parse(m.history || '[]') || []).length > 0; } catch { edited = false; }
    return {
      ...m,
      authorName: u?.name || 'Usuário removido',
      authorRole: u?.role || null,
      edited,
    };
  });
}

async function list(req, res, next) {
  try {
    // D-08: mensagens seguem o escopo de visão do pedido pai (404 se invisível).
    const r = await prisma.resourceRequest.findUnique({ where: { id: req.params.id } });
    if (!r || !canViewRequest(req.user, r)) return res.status(404).json({ error: 'Não encontrado' });
    const msgs = await prisma.deliberationMessage.findMany({
      where: { requestId: req.params.id, deletedAt: null },
      orderBy: { createdAt: 'asc' },
    });
    res.json({ messages: await enrichMessages(msgs) });
  } catch (e) { next(e); }
}

async function post(req, res, next) {
  try {
    const r = await prisma.resourceRequest.findUnique({ where: { id: req.params.id } });
    if (!r) return res.status(404).json({ error: 'Não encontrado' });
    if (suspended(r)) return res.status(423).json({ error: 'Suspensa — somente leitura' });
    // Papel de post vive no mapa (messages:post exclui ALUNO); sem branch inline.
    if (!req.body.content) return res.status(400).json({ error: 'Conteúdo obrigatório' });
    const m = await prisma.deliberationMessage.create({
      data: { requestId: r.id, authorId: req.user.id, parentMessageId: req.body.parentMessageId || null, content: req.body.content },
    });
    await audit({ actorId: req.user.id, action: 'message_created', entityType: 'message', entityId: m.id, afterData: m, req });
    res.status(201).json({ message: (await enrichMessages([m]))[0] });
  } catch (e) { next(e); }
}

async function patch(req, res, next) {
  try {
    const m = await prisma.deliberationMessage.findUnique({ where: { id: req.params.mid } });
    if (!m || m.deletedAt) return res.status(404).json({ error: 'Não encontrada' });
    const r = await prisma.resourceRequest.findUnique({ where: { id: m.requestId } });
    if (suspended(r)) return res.status(423).json({ error: 'Suspensa — somente leitura' });
    if (String(m.authorId) !== String(req.user.id)) return res.status(403).json({ error: 'Só o autor edita' });
    const history = JSON.parse(m.history || '[]');
    history.push({ content: m.content, at: new Date().toISOString() });
    const up = await prisma.deliberationMessage.update({
      where: { id: m.id }, data: { content: req.body.content, history: JSON.stringify(history) },
    });
    await audit({ actorId: req.user.id, action: 'message_edited', entityType: 'message', entityId: m.id, beforeData: m, afterData: up, req });
    res.json({ message: up });
  } catch (e) { next(e); }
}

async function remove(req, res, next) {
  try {
    const m = await prisma.deliberationMessage.findUnique({ where: { id: req.params.mid } });
    if (!m) return res.status(404).json({ error: 'Não encontrada' });
    // D-07: autor + ADMINISTRADOR/CHEFE_DEPARTAMENTO, sem janela de tempo.
    // Inserido antes da guarda de suspensão para que 423 mantenha precedência.
    const isAuthor = String(m.authorId) === String(req.user.id);
    const isLeader = ['ADMINISTRADOR', 'CHEFE_DEPARTAMENTO'].includes(req.user.role);
    if (!isAuthor && !isLeader) return res.status(403).json({ error: 'Sem permissão' });
    const r = await prisma.resourceRequest.findUnique({ where: { id: m.requestId } });
    if (suspended(r)) return res.status(423).json({ error: 'Suspensa — somente leitura' });
    const up = await prisma.deliberationMessage.update({ where: { id: m.id }, data: { deletedAt: new Date() } });
    await audit({ actorId: req.user.id, action: 'message_deleted', entityType: 'message', entityId: m.id, req });
    res.json({ ok: true, message: up });
  } catch (e) { next(e); }
}

module.exports = { list, post, patch, remove };
