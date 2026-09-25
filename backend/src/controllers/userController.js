const prisma = require('../config/db');
const { normalizeEmail, isInstitutionalEmail, randomTempPassword } = require('../utils/helpers');
const { hashPassword } = require('../utils/password');
const { audit } = require('../services/auditService');
const { enqueue } = require('../services/emailService');
const { canManageUsers } = require('../middlewares/auth');

async function list(req, res, next) {
  try {
    const users = await prisma.user.findMany({
      orderBy: { createdAt: 'desc' },
      select: { id: true, name: true, email: true, role: true, status: true, lastLoginAt: true, createdAt: true },
    });
    res.json({ users });
  } catch (e) { next(e); }
}

async function create(req, res, next) {
  try {
    const { name, email, role } = req.body;
    const norm = normalizeEmail(email);
    if (!isInstitutionalEmail(norm)) return res.status(400).json({ error: 'Use e-mail @utfpr.edu.br' });
    if (!name) return res.status(400).json({ error: 'Nome obrigatório' });
    const temp = randomTempPassword();
    const user = await prisma.user.create({
      data: {
        name, email: norm, role: role || 'PROFESSOR',
        passwordHash: await hashPassword(temp),
        mustChangePassword: true,
        temporaryPasswordExpiresAt: new Date(Date.now() + 24 * 3600 * 1000),
      },
    });
    await enqueue(norm, '[SGRD] Convite de acesso', `Olá ${name}, sua senha temporária: ${temp}\nVálida por 24h.`);
    await audit({ actorId: req.user.id, action: 'user_created', entityType: 'user', entityId: user.id, afterData: { email: norm, role }, req });
    res.status(201).json({ user: { id: user.id, email: user.email }, message: 'Convite enviado (senha temporária por e-mail, uso único)' });
  } catch (e) {
    if (String(e.message).includes('Unique')) return res.status(409).json({ error: 'E-mail já cadastrado' });
    next(e);
  }
}

async function patchRole(req, res, next) {
  try {
    const target = await prisma.user.findUnique({ where: { id: req.params.id } });
    if (!target) return res.status(404).json({ error: 'Usuário não encontrado' });
    if (!canManageUsers(req.user, target)) return res.status(403).json({ error: 'Chefe não pode alterar administrador (RF-005)' });
    if (req.body.role === 'ADMINISTRADOR' && req.user.role !== 'ADMINISTRADOR') {
      return res.status(403).json({ error: 'Só admin promove a admin' });
    }
    const before = { role: target.role };
    const updated = await prisma.user.update({ where: { id: target.id }, data: { role: req.body.role } });
    await audit({ actorId: req.user.id, action: 'role_changed', entityType: 'user', entityId: target.id, beforeData: before, afterData: { role: updated.role, justification: req.body.justification || null }, req });
    res.json({ ok: true, role: updated.role });
  } catch (e) { next(e); }
}

async function patch(req, res, next) {
  try {
    const target = await prisma.user.findUnique({ where: { id: req.params.id } });
    if (!target) return res.status(404).json({ error: 'Não encontrado' });
    if (!canManageUsers(req.user, target)) return res.status(403).json({ error: 'Sem permissão' });
    const updated = await prisma.user.update({ where: { id: target.id }, data: { status: req.body.status, name: req.body.name } });
    await audit({ actorId: req.user.id, action: 'user_updated', entityType: 'user', entityId: target.id, req });
    res.json({ ok: true, status: updated.status });
  } catch (e) { next(e); }
}

async function resendInvite(req, res, next) {
  try {
    const target = await prisma.user.findUnique({ where: { id: req.params.id } });
    if (!target) return res.status(404).json({ error: 'Não encontrado' });
    // D-11: chefe não alcança admin (matriz "Gerenciar usuários: Parcial") —
    // gate alvo-dependente no handler, além do requireRole/requirePermission da rota.
    if (!canManageUsers(req.user, target)) return res.status(403).json({ error: 'Chefe não pode alterar administrador (RF-005)' });
    const temp = randomTempPassword();
    await prisma.user.update({
      where: { id: target.id },
      data: { passwordHash: await hashPassword(temp), mustChangePassword: true, temporaryPasswordExpiresAt: new Date(Date.now() + 24 * 3600 * 1000) },
    });
    await enqueue(target.email, '[SGRD] Reenvio de convite', `Nova senha temporária: ${temp}\nVálida por 24h.`);
    // Auditoria distinta: reset forçado vs reenvio de convite.
    const viaForceReset = String(req.path || '').includes('force-password-reset');
    await audit({ actorId: req.user.id, action: viaForceReset ? 'password_reset_forced' : 'invite_resent', entityType: 'user', entityId: target.id, req });
    res.json({ ok: true });
  } catch (e) { next(e); }
}

module.exports = { list, create, patchRole, patch, resendInvite };
