// O sgrf não cria usuário nem credencial — identidade é do saga (`auth.users`,
// lido pelo repositório de identidade). O que o sgrf guarda é o papel por
// sistema, em `sgrf.user_roles`.
const prisma = require('../config/db');
const { normalizeEmail, isInstitutionalEmail } = require('../utils/helpers');
const { audit } = require('../services/auditService');
const { canManageUsers } = require('../middlewares/auth');
const { listUsers, findIdentity } = require('../services/identityRepository');

async function list(req, res, next) {
  try {
    const users = await listUsers();
    res.json({ users });
  } catch (e) { next(e); }
}

// Papel por sistema. O alvo precisa existir em auth.users (leitura); o sgrf só
// escreve na própria tabela.
async function patchRole(req, res, next) {
  try {
    const target = await findIdentity(req.params.id);
    if (!target) return res.status(404).json({ error: 'Usuário não encontrado' });
    if (!canManageUsers(req.user, target)) return res.status(403).json({ error: 'Chefe não pode alterar administrador (RF-005)' });
    if (req.body.role === 'ADMINISTRADOR' && req.user.role !== 'ADMINISTRADOR') {
      return res.status(403).json({ error: 'Só admin promove a admin' });
    }
    const before = { role: target.role };
    const row = await prisma.userRole.upsert({
      where: { userId: target.id },
      update: { role: req.body.role },
      create: { userId: target.id, role: req.body.role, status: 'ATIVO' },
    });
    await audit({ actorId: req.user.id, action: 'role_changed', entityType: 'user', entityId: target.id, beforeData: before, afterData: { role: row.role, justification: req.body.justification || null }, req });
    res.json({ ok: true, role: row.role });
  } catch (e) { next(e); }
}

async function patch(req, res, next) {
  try {
    const target = await findIdentity(req.params.id);
    if (!target) return res.status(404).json({ error: 'Não encontrado' });
    if (!canManageUsers(req.user, target)) return res.status(403).json({ error: 'Sem permissão' });
    // `name` é campo de identidade (auth.users, dono: saga) — o sgrf não escreve
    // em auth. Aqui só o status do papel por sistema muda.
    const row = await prisma.userRole.update({
      where: { userId: target.id },
      data: { status: req.body.status },
    });
    await audit({ actorId: req.user.id, action: 'user_updated', entityType: 'user', entityId: target.id, req });
    res.json({ ok: true, status: row.status });
  } catch (e) { next(e); }
}

module.exports = { list, patchRole, patch };
