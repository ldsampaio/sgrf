// Verificador de sessão compartilhada — contrato de docs/session-contract.md.
//
// O sgrf NÃO autentica credencial: ele confirma no Redis que a sessão do saga
// está viva. Passos 1 e 4 não têm fallback (decisão 10 — falha fechada).
// Nenhum cache de sessão em processo: o cache de JWKS evita uma chamada de rede,
// mas nunca concede acesso sozinho.
const env = require('../config/env');
const redis = require('../config/redis');
const { verifyAccessToken } = require('../utils/tokens');
const { findRoleRow } = require('../services/identityRepository');

const RETRY_AFTER = 30;

// Copy comum dos três sistemas. Não revela claims, `sid`, nem se um login existe.
const UNAVAILABLE_MESSAGE = 'Não foi possível confirmar sua identidade. Acesso negado. O serviço de autenticação não está respondendo.';
const NO_SESSION_MESSAGE = 'Não foi possível confirmar sua identidade. Acesso negado.';

// `sid` é opaco. Restringir o charset evita montar chave Redis com conteúdo do token.
const SID_RE = /^[A-Za-z0-9_-]{8,64}$/;

function buildLoginUrl(req, envOverride = env) {
  const base = envOverride.sagaLoginUrl;
  // Allowlist por HOST, sem porta: em dev o header vem `localhost:5174` e a
  // allowlist declara `localhost` (mesma convenção do sgoa).
  const host = String((req.headers && req.headers.host) || '').split(':')[0].toLowerCase();
  // Sem allowlist para o host de origem, não se monta redirect (open redirect).
  if (!envOverride.portalAllowedRedirectHosts.includes(host)) return base;
  const path = req.originalUrl || req.path || '/';
  return `${base}?redirect=${encodeURIComponent(path)}`;
}

function identityUnavailable(res) {
  res.set('Retry-After', String(RETRY_AFTER));
  return res.status(503).json({
    code: 'IDENTITY_UNAVAILABLE',
    message: UNAVAILABLE_MESSAGE,
    retry_after: RETRY_AFTER,
  });
}

function unauthorized(res, req, code, message) {
  return res.status(401).json({ code, message, login_url: buildLoginUrl(req) });
}

// Dependências injetáveis para teste; em produção vêm de env/config.
function createAuthMiddleware(deps = {}) {
  const client = deps.redis || redis;
  const verify = deps.verifyAccessToken || verifyAccessToken;
  const resolveRole = deps.resolveRole || findRoleRow;
  const loginUrlFor = deps.buildLoginUrl || buildLoginUrl;

  return async function authJwt(req, res, next) {
    // 1. saga:heartbeat ausente → 503. Sem fallback de cache.
    let heartbeat;
    try {
      heartbeat = await client.get(env.heartbeatKey);
    } catch {
      return identityUnavailable(res);
    }
    if (!heartbeat) return identityUnavailable(res);

    // 2. cookie saga_session ausente → 401.
    const token = req.cookies ? req.cookies[env.sessionCookieName] : undefined;
    if (!token) return unauthorized(res, req, 'NO_SESSION', NO_SESSION_MESSAGE);

    // 3. assinatura/exp/kid inválidos → 401.
    let claims;
    try {
      claims = await verify(token);
    } catch {
      return unauthorized(res, req, 'BAD_TOKEN', NO_SESSION_MESSAGE);
    }
    if (!SID_RE.test(String(claims.sid))) {
      return unauthorized(res, req, 'BAD_TOKEN', NO_SESSION_MESSAGE);
    }

    // 4. meta vazio → 401; gen divergente → 401. Sem fallback.
    let meta;
    try {
      meta = await client.hgetall(`saga:sess:${claims.sid}:meta`);
    } catch {
      return identityUnavailable(res);
    }
    if (!meta || !Object.keys(meta).length) {
      return unauthorized(res, req, 'SESSION_DEAD', NO_SESSION_MESSAGE);
    }
    if (Number(meta.gen) !== Number(claims.gen)) {
      return unauthorized(res, req, 'SESSION_STALE', NO_SESSION_MESSAGE);
    }

    // 5. req.user vem do Redis, não do banco.
    req.user = {
      id: String(meta.user_id),
      login: meta.login,
      name: meta.name,
      email: meta.email,
      roleBase: meta.role_base,
    };

    // 6. papel por sistema: sgrf.user_roles — nunca o claim `role` do JWT.
    let roleRow = null;
    try {
      roleRow = await resolveRole(req.user.id);
    } catch (e) {
      return next(e);
    }
    req.user.role = roleRow ? roleRow.role : null;
    req.user.status = roleRow ? roleRow.status : null;

    next();
  };
}

const authJwt = createAuthMiddleware();

function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user) return res.status(401).json({ error: 'Não autenticado' });
    // Papel lido de sgrf.user_roles (resolvido pelo middleware), nunca do JWT.
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

module.exports = { authJwt, createAuthMiddleware, requireRole, canManageUsers, buildLoginUrl };
