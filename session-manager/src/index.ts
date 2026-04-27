import express from 'express';
import pino from 'pino';
import { SessionPool } from './SessionPool';
import { HealthServer } from './HealthServer';
import { QRServer } from './QRServer';
import { InboundHandler } from './InboundHandler';

const logger = pino({
  level: process.env.LOG_LEVEL ?? 'info',
  transport:
    process.env.NODE_ENV !== 'production'
      ? { target: 'pino-pretty', options: { singleLine: true } }
      : undefined,
});

const SESSIONS_PATH = process.env.SESSION_FILES_PATH ?? './sessions';
const PORT = parseInt(process.env.SESSION_MANAGER_PORT ?? '3002', 10);
const REDIS_URL = process.env.REDIS_URL ?? 'redis://localhost:6379';

async function main() {
  logger.info('Starting session-manager...');

  const inboundHandler = new InboundHandler(logger, REDIS_URL);
  const pool = new SessionPool(SESSIONS_PATH, logger, inboundHandler);
  const qrServer = new QRServer(pool, logger);
  const healthServer = new HealthServer(pool);

  const app = express();
  app.use(express.json());
  app.use(qrServer.router);
  app.use(healthServer.router);

  app.listen(PORT, () => {
    logger.info(`Session-manager listening on port ${PORT}`);
  });
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
