const { verifyAccess } = require('../utils/tokens');
const prisma = require('../config/db');

async function authJwt(req, res, next) {
  const token = req.cookies?.access_token;
  if (!token) return res.status(401).json({ error: 'Não autenticado' });
  try {
    const payload = verifyAccess(token);
    const user = await prisma.user.findUnique({ where: { id: payload.sub } });
    if (!user || user.status !== 'ATIVO') return res.status(401).json({ error: 'Usuário inválido' });
    if (user.mustChangePassword) {
      const allowPaths = ['/api/auth/change-password', '/api/auth/me', '/api/auth/refresh', '/api/auth/logout'];
      const url = req.originalUrl || req.path || '';
      const isAllowlisted = allowPaths.some((p) => url.startsWith(p));
      if (!isAllowlisted) {
        return res.status(403).json({ error: 'Troca de senha obrigatória' });
      }
    }
    req.user = user;
    next();
  } catch {
    return res.status(401).json({ error: 'Sessão expirada' });
  }
}

function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user) return res.status(401).json({ error: 'Não autenticado' });
    if (!roles.includes(req.user.role)) return res.status(403).json({ error: 'Sem permissão' });
    next();
  };
}

// Chefe pode gerenciar usuários exceto admin (RF-005)
function canManageUsers(actor, target) {
  if (actor.role === 'ADMINISTRADOR') return true;
  if (actor.role === 'CHEFE_DEPARTAMENTO' && target.role !== 'ADMINISTRADOR') return true;
  return false;
}

module.exports = { authJwt, requireRole, canManageUsers };
