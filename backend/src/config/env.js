require('dotenv').config();

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
};
