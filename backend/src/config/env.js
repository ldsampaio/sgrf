require('dotenv').config();

// Production gate (SEC-02): o sgrf NÃO autentica credencial — ele verifica a
// sessão compartilhada do saga. Não existem mais segredos de JWT próprios nem
// senha de admin: o que precisa ser seguro é o acesso ao Redis (ACL read-only)
// e o JWKS do saga.
function isInsecureSecret(value) {
  const trimmed = (value || '').trim();
  // Empty or whitespace-only
  if (trimmed === '') return true;
  // Contains blocked placeholder substring
  if (trimmed.includes('change-me')) return true;
  // Starts with blocked dev prefix
  if (trimmed.toLowerCase().startsWith('dev-')) return true;
  return false;
}

// Skip production gate when SKIP_GW_ENV is true (used for testing)
const skipProductionGate = process.env.SKIP_GW_ENV === 'true';
const isProduction = !skipProductionGate && process.env.NODE_ENV === 'production';

if (isProduction) {
  const offenders = [];

  for (const key of ['REDIS_URL', 'SAGA_JWKS_URL', 'SAGA_LOGIN_URL', 'PORTAL_ALLOWED_REDIRECT_HOSTS']) {
    if (isInsecureSecret(process.env[key])) offenders.push(key);
  }

  // A ACL read-only é parte do contrato: o sgrf não pode escrever no store de
  // sessões. Em produção o REDIS_URL precisa usar o usuário saga_readonly.
  const redisUrl = (process.env.REDIS_URL || '').trim();
  if (redisUrl && !redisUrl.includes('saga_readonly')) offenders.push('REDIS_URL (ACL)');

  if (offenders.length > 0) {
    throw new Error(
      `SEC-02: Production boot refused - insecure or invalid value(s) found in: ${offenders.join(', ')}. ` +
      `REDIS_URL must use the read-only ACL user (saga_readonly) — the sgrf never writes session state. ` +
      `SAGA_JWKS_URL and SAGA_LOGIN_URL must be the real saga endpoints (no 'change-me', no 'dev-' prefix). ` +
      `PORTAL_ALLOWED_REDIRECT_HOSTS is the explicit allowlist for login_url redirects; without it the ` +
      `middleware refuses to build a redirect (open redirect). ` +
      `Set proper values in your production .env before starting with NODE_ENV=production.`
    );
  }
}

function parseHosts(value) {
  return String(value || '')
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
}

module.exports = {
  port: parseInt(process.env.PORT || '3000', 10),
  frontendUrl: process.env.FRONTEND_URL || 'http://localhost:5173',
  dbUrl: process.env.DATABASE_URL || 'postgresql://sgrd:sgrd@localhost:5432/sgrd',
  serveFrontend: process.env.SERVE_FRONTEND === 'true',
  frontendDist: process.env.FRONTEND_DIST || '/app/frontend-dist',

  // ── Contrato de sessão (docs/session-contract.md) ──
  redisUrl: process.env.REDIS_URL || 'redis://saga_readonly:saga-dev-ro@localhost:6379/0',
  sagaJwksUrl: process.env.SAGA_JWKS_URL || 'http://localhost:8000/.well-known/jwks.json',
  sagaLoginUrl: process.env.SAGA_LOGIN_URL || 'http://localhost:8000/login',
  // Allowlist explícita de hosts que podem aparecer em login_url. Sem allowlist
  // o middleware não monta redirect (open redirect).
  portalAllowedRedirectHosts: parseHosts(process.env.PORTAL_ALLOWED_REDIRECT_HOSTS),
  // Cookie compartilhado do saga. O sgrf nunca define cookie próprio.
  sessionCookieName: process.env.SESSION_COOKIE_NAME || 'saga_session',
  heartbeatKey: 'saga:heartbeat',

  smtpEnabled: process.env.SMTP_ENABLED === 'true',
  smtp: {
    host: process.env.SMTP_HOST || '',
    port: parseInt(process.env.SMTP_PORT || '587', 10),
    secure: process.env.SMTP_SECURE === 'true',
    user: process.env.SMTP_USER || '',
    pass: process.env.SMTP_PASS || '',
    from: process.env.SMTP_FROM || 'SGRD <nao-responder@utfpr.edu.br>',
  },

  // Seed: só o papel do admin. A identidade (login) é criada pelo saga no
  // primeiro login — o sgrf não cria usuário nem credencial.
  initialAdminLogin: (process.env.INITIAL_ADMIN_LOGIN || 'ldsampaio').toLowerCase(),
};
