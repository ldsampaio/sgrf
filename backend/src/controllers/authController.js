const prisma = require('../config/db');
const env = require('../config/env');
const { normalizeEmail, isInstitutionalEmail, randomTempPassword } = require('../utils/helpers');
const { hashPassword, verifyPassword } = require('../utils/password');
const { signAccess, signRefresh, verifyRefresh, cookieOpts } = require('../utils/tokens');
const { audit } = require('../services/auditService');
const { enqueue } = require('../services/emailService');

async function login(req, res, next) {
  try {
    const email = normalizeEmail(req.body.email);
    const password = String(req.body.password || '');
    if (!isInstitutionalEmail(email)) return res.status(400).json({ error: 'Use e-mail @utfpr.edu.br' });

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) return res.status(401).json({ error: 'Credenciais inválidas' });
    if (user.status !== 'ATIVO') return res.status(403).json({ error: 'Usuário inativo' });
    if (user.lockedUntil && new Date(user.lockedUntil) > new Date()) {
      await audit({ actorId: user.id, action: 'login_blocked', entityType: 'user', entityId: user.id, req });
      return res.status(423).json({ error: 'Conta temporariamente bloqueada' });
    }

    const ok = await verifyPassword(user.passwordHash, password);
    if (!ok) {
      const attempts = user.failedLoginAttempts + 1;
      const data = { failedLoginAttempts: attempts };
      if (attempts >= 5) data.lockedUntil = new Date(Date.now() + 15 * 60 * 1000);
      await prisma.user.update({ where: { id: user.id }, data });
      await audit({ actorId: user.id, action: 'login_failed', entityType: 'user', entityId: user.id, req });
      return res.status(401).json({ error: 'Credenciais inválidas' });
    }

    await prisma.user.update({
      where: { id: user.id },
      data: { failedLoginAttempts: 0, lockedUntil: null, lastLoginAt: new Date() },
    });
    await audit({ actorId: user.id, action: 'login_success', entityType: 'user', entityId: user.id, req });

    res.cookie('access_token', signAccess(user), { ...cookieOpts, maxAge: 15 * 60 * 1000 });
    res.cookie('refresh_token', signRefresh(user), { ...cookieOpts, maxAge: 7 * 24 * 3600 * 1000 });
    res.json({
      user: { id: user.id, name: user.name, email: user.email, role: user.role, mustChangePassword: user.mustChangePassword },
    });
  } catch (e) { next(e); }
}

async function me(req, res) {
  const u = req.user;
  res.json({ user: { id: u.id, name: u.name, email: u.email, role: u.role, mustChangePassword: u.mustChangePassword } });
}

async function refresh(req, res) {
  try {
    const t = req.cookies?.refresh_token;
    if (!t) return res.status(401).json({ error: 'Sem refresh' });
    const p = verifyRefresh(t);
    const user = await prisma.user.findUnique({ where: { id: p.sub } });
    if (!user || user.status !== 'ATIVO') return res.status(401).json({ error: 'Inválido' });
    res.cookie('access_token', signAccess(user), { ...cookieOpts, maxAge: 15 * 60 * 1000 });
    res.json({ ok: true });
  } catch {
    res.status(401).json({ error: 'Refresh expirado' });
  }
}

async function logout(req, res) {
  res.clearCookie('access_token', { ...cookieOpts, path: '/' });
  res.clearCookie('refresh_token', { ...cookieOpts, path: '/' });
  res.json({ ok: true });
}

async function changePassword(req, res, next) {
  try {
    const { currentPassword, newPassword } = req.body;
    if (!newPassword || String(newPassword).length < 8) {
      return res.status(400).json({ error: 'Nova senha deve ter ao menos 8 caracteres' });
    }
    const user = await prisma.user.findUnique({ where: { id: req.user.id } });
    const ok = await verifyPassword(user.passwordHash, String(currentPassword || ''));
    // senha temporária: permite troca mesmo sem saber? Não — exige a temporária como current
    if (!ok) return res.status(400).json({ error: 'Senha atual incorreta' });
    if (user.temporaryPasswordExpiresAt && new Date(user.temporaryPasswordExpiresAt) < new Date() && user.mustChangePassword) {
      return res.status(400).json({ error: 'Senha temporária expirada, peça redefinição' });
    }
    await prisma.user.update({
      where: { id: user.id },
      data: { passwordHash: await hashPassword(String(newPassword)), mustChangePassword: false, temporaryPasswordExpiresAt: null },
    });
    await audit({ actorId: user.id, action: 'password_changed', entityType: 'user', entityId: user.id, req });
    res.json({ ok: true });
  } catch (e) { next(e); }
}

async function forgotPassword(req, res, next) {
  try {
    const email = normalizeEmail(req.body.email);
    if (!isInstitutionalEmail(email)) return res.status(400).json({ error: 'Use e-mail @utfpr.edu.br' });
    const user = await prisma.user.findUnique({ where: { email } });
    if (user) {
      const temp = randomTempPassword();
      await prisma.user.update({
        where: { id: user.id },
        data: {
          passwordHash: await hashPassword(temp),
          mustChangePassword: true,
          temporaryPasswordExpiresAt: new Date(Date.now() + 24 * 3600 * 1000),
        },
      });
      await enqueue(email, '[SGRD] Redefinição de senha', `Sua senha temporária: ${temp}\nVálida por 24h. Troque no primeiro login.`);
      await audit({ actorId: user.id, action: 'password_reset_requested', entityType: 'user', entityId: user.id, req });
    }
    res.json({ ok: true, message: 'Se o e-mail existir, uma senha temporária foi enviada' });
  } catch (e) { next(e); }
}

module.exports = { login, me, refresh, logout, changePassword, forgotPassword };
