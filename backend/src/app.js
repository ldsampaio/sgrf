const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const pinoHttp = require('pino-http');
const env = require('./config/env');
const logger = require('./config/logger');
const { errorHandler } = require('./middlewares/validate');

function createApp() {
  const app = express();
  app.use(helmet());
  app.use(cors({ origin: env.frontendUrl, credentials: true }));
  app.use(express.json({ limit: '2mb' }));
  app.use(cookieParser());
  app.use(pinoHttp({ logger }));

  app.get('/health', (req, res) => res.json({ ok: true, service: 'sgrd-backend' }));
  app.use('/api/auth', require('./routes/auth.routes'));
  app.use('/api/users', require('./routes/users.routes'));
  app.use('/api/requests', require('./routes/requests.routes'));
  app.use('/api/settings', require('./routes/settings.routes'));
  app.use('/api/finance', require('./routes/settings.routes'));
  app.use('/api/messages', require('./routes/messages.routes'));
  app.use('/api/reports', require('./routes/reports.routes'));

  app.use(errorHandler);
  return app;
}

module.exports = createApp;
