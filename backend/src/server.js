const createApp = require('./app');
const env = require('./config/env');
const logger = require('./config/logger');
const { startScheduler } = require('./jobs/scheduler');

const app = createApp();
app.listen(env.port, () => {
  logger.info(`SGRD backend on :${env.port}`);
  startScheduler();
});
