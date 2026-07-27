import { createApp } from './app';
import { env } from './config/env';
import { logger } from './lib/logger';
import { getPool } from './db/pool';
import { initializeArrayTypeParsers } from './db/arrayTypeParsers';

// Best-effort: a database might not be configured or reachable yet at boot
// (Part 1's health check is designed to work either way). Failure here only
// means enum-array columns come back as raw Postgres literals until it
// eventually succeeds - it must never block the server from starting.
const pool = getPool();
if (pool) {
  initializeArrayTypeParsers(pool).catch((err: unknown) => {
    logger.warn({ err }, 'Could not initialize array-type parsers at startup');
  });
}

const app = createApp();

const server = app.listen(env.PORT, () => {
  logger.info({ port: env.PORT, env: env.NODE_ENV }, 'RecoverAI API listening');
});

function shutdown(signal: string): void {
  logger.info({ signal }, 'Shutting down RecoverAI API');
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(1), 10_000).unref();
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
