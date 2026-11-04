const multer = require('multer');
const { audit } = require('../services/auditService');
const { parseBatch, validateBatch } = require('../utils/batchUsers');
const { findIdentitiesByEmails } = require('../services/identityRepository');
const prisma = require('../config/db');

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 1024 * 1024 } });

// Lido, nunca escrito: `auth.users` é do saga. O lote do sgrf não cria usuário —
// ele atribui papel por sistema em `sgrf.user_roles` a quem já existe no saga.
async function existingEmailSet(emails) {
  const identities = await findIdentitiesByEmails(emails);
  return new Set(identities.filter((u) => u.role).map((u) => u.email));
}

async function preview(req, res, next) {
  try {
    if (!req.file) return res.status(400).json({ error: 'Envie o arquivo .json no campo file' });
    const arr = parseBatch(req.file.buffer);
    const norm = arr.map((r) => ({ ...r, email: String(r?.email || '').toLowerCase().trim() }));
    const existing = await existingEmailSet(norm.map((r) => r.email));
    const result = validateBatch(arr, existing);
    await audit({ actorId: req.user.id, action: 'users_batch_preview', entityType: 'user_batch', afterData: result.summary, req });
    res.json(result);
  } catch (e) { next(e); }
}

async function confirm(req, res, next) {
  try {
    if (!req.file) return res.status(400).json({ error: 'Envie o arquivo .json no campo file' });
    const arr = parseBatch(req.file.buffer);
    const norm = arr.map((r) => ({ ...r, email: String(r?.email || '').toLowerCase().trim() }));
    const existing = await existingEmailSet(norm.map((r) => r.email));
    const { valid, invalid } = validateBatch(arr, existing);
    const created = [];
    const errors = [...invalid];

    const byEmail = new Map((await findIdentitiesByEmails(valid.map((r) => r.email))).map((u) => [u.email, u]));
    for (const item of valid) {
      const identity = byEmail.get(item.email);
      if (!identity) {
        // O sgrf não cria identidade: ela nasce no primeiro login pelo saga.
        errors.push({ email: item.email, error: 'Usuário ainda não existe no saga (faça o primeiro login)' });
        continue;
      }
      try {
        const row = await prisma.userRole.upsert({
          where: { userId: identity.id },
          update: { role: item.role },
          create: { userId: identity.id, role: item.role, status: 'ATIVO' },
        });
        created.push({ email: item.email, id: identity.id, role: row.role });
      } catch {
        errors.push({ email: item.email, error: 'Falha ao atribuir papel' });
      }
    }

    await audit({ actorId: req.user.id, action: 'users_batch_created', entityType: 'user_batch', afterData: { created: created.length, errors: errors.length }, req });
    res.status(201).json({ created, errors, summary: { total: arr.length, created: created.length, errors: errors.length } });
  } catch (e) { next(e); }
}

module.exports = { upload, preview, confirm };
