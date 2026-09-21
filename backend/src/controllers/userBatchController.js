const multer = require('multer');
const prisma = require('../config/db');
const { hashPassword } = require('../utils/password');
const { randomTempPassword } = require('../utils/helpers');
const { parseBatch, validateBatch } = require('../utils/batchUsers');
const { audit } = require('../services/auditService');
const { enqueue } = require('../services/emailService');

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 1024 * 1024 } });

async function existingEmailSet(emails) {
  const rows = await prisma.user.findMany({ where: { email: { in: emails } }, select: { email: true } });
  return new Set(rows.map((r) => r.email));
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
    for (const item of valid) {
      try {
        const temp = randomTempPassword();
        const u = await prisma.user.create({
          data: {
            name: item.name, email: item.email, role: item.role,
            passwordHash: await hashPassword(temp),
            mustChangePassword: true,
            temporaryPasswordExpiresAt: new Date(Date.now() + 24 * 3600 * 1000),
          },
        });
        await enqueue(item.email, '[SGRD] Convite de acesso', `Olá ${item.name}, sua senha temporária: ${temp}\nVálida por 24h.`);
        created.push({ email: u.email, id: u.id });
      } catch (e) {
        errors.push({ email: item.email, error: String(e.message).includes('Unique') ? 'E-mail já cadastrado' : 'Falha ao criar' });
      }
    }
    await audit({ actorId: req.user.id, action: 'users_batch_created', entityType: 'user_batch', afterData: { created: created.length, errors: errors.length }, req });
    res.status(201).json({ created, errors, summary: { total: arr.length, created: created.length, errors: errors.length } });
  } catch (e) { next(e); }
}

module.exports = { upload, preview, confirm };
