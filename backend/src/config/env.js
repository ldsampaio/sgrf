require('dotenv').config();

// Production gate: fail fast if insecure secrets are configured (SEC-02)
// This gate runs before module.exports to prevent insecure values from escaping
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

function validateDevPrefix(value) {
  const lower = (value || '').toLowerCase();
  return lower.startsWith('dev-');
}

// Skip production gate when SKIP_GW_ENV is true (used for testing)
const skipProductionGate = process.env.SKIP_GW_ENV === 'true';
const isProduction = !skipProductionGate && process.env.NODE_ENV === 'production';

if (isProduction) {
  const offenders = [];

  // Check JWT_ACCESS_SECRET
  if (isInsecureSecret(process.env.JWT_ACCESS_SECRET)) {
    offenders.push('JWT_ACCESS_SECRET');
  }

  // Check JWT_REFRESH_SECRET
  if (isInsecureSecret(process.env.JWT_REFRESH_SECRET)) {
    offenders.push('JWT_REFRESH_SECRET');
  }

  // Check INITIAL_ADMIN_TEMPORARY_PASSWORD
  if (isInsecureSecret(process.env.INITIAL_ADMIN_TEMPORARY_PASSWORD)) {
    offenders.push('INITIAL_ADMIN_TEMPORARY_PASSWORD');
  }

  // Check INITIAL_ADMIN_EMAIL for institutional suffix
  const email = process.env.INITIAL_ADMIN_EMAIL;
  if (email) {
    if (isInsecureSecret(email)) {
      offenders.push('INITIAL_ADMIN_EMAIL');
    } else {
      const emailLower = email.toLowerCase().trim();
      if (!emailLower.endsWith('@utfpr.edu.br') && !emailLower.endsWith('@utfpr.edu.com')) {
        offenders.push('INITIAL_ADMIN_EMAIL (missing institutional suffix @utfpr.edu.br)');
      }
    }
  } else {
    offenders.push('INITIAL_ADMIN_EMAIL');
  }

  if (offenders.length > 0) {
    throw new Error(
      `SEC-02: Production boot refused - insecure or invalid value(s) found in: ${offenders.join(', ')}. ` +
      `For JWT_ACCESS_SECRET and JWT_REFRESH_SECRET: use secure random strings (no 'change-me' placeholder, no 'dev-' prefix). ` +
      `For INITIAL_ADMIN_TEMPORARY_PASSWORD: use 24+ character random strings (same rules). ` +
      `For INITIAL_ADMIN_EMAIL: use a UTF-PR email address (@utfpr.edu.br or @utfpr.edu.com). ` +
      `Set proper values in your production .env before starting with NODE_ENV=production.`
    );
  }
}

// Cookie secure flag parsing
// Explicit true/false wins; absent follows NODE_ENV production equality
const cookieSecureExplicit = process.env.COOKIE_SECURE;
let cookieSecure;
if (cookieSecureExplicit === 'true') {
  cookieSecure = true;
} else if (cookieSecureExplicit === 'false') {
  cookieSecure = false;
} else {
  // For tests, skip cookieSecure gate tracking too
  cookieSecure = skipProductionGate ? false : isProduction;
}

module.exports = {
  port: parseInt(process.env.PORT || '3000', 10),
  frontendUrl: process.env.FRONTEND_URL || 'http://localhost:5173',
  dbUrl: process.env.DATABASE_URL || 'postgresql://sgrd:sgrd@localhost:5432/sgrd',
  serveFrontend: process.env.SERVE_FRONTEND === 'true',
  frontendDist: process.env.FRONTEND_DIST || '/app/frontend-dist',
  jwtAccessSecret: process.env.JWT_ACCESS_SECRET || 'dev-access-secret-change-me-0123456789',
  jwtRefreshSecret: process.env.JWT_REFRESH_SECRET || 'dev-refresh-secret-change-me-0123456789',
  smtpEnabled: process.env.SMTP_ENABLED === 'true',
  smtp: {
    host: process.env.SMTP_HOST || '',
    port: parseInt(process.env.SMTP_PORT || '587', 10),
    secure: process.env.SMTP_SECURE === 'true',
    user: process.env.SMTP_USER || '',
    pass: process.env.SMTP_PASS || '',
    from: process.env.SMTP_FROM || 'SGRD <nao-responder@utfpr.edu.br>',
  },
  initialAdminEmail: (process.env.INITIAL_ADMIN_EMAIL || 'ldsampaio@utfpr.edu.br').toLowerCase(),
  initialAdminPassword: process.env.INITIAL_ADMIN_TEMPORARY_PASSWORD || '',
  cookieSecure: cookieSecure,
};
