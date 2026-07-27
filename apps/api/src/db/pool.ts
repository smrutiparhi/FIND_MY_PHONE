import { Pool } from 'pg';
import { env } from '../config/env';
import { logger } from '../lib/logger';

let pool: Pool | undefined;

/**
 * Lazily creates a shared PostgreSQL connection pool. Returns undefined when
 * DATABASE_URL isn't configured, which is expected until Part 2 (Database)
 * introduces the schema and repository layer that actually uses this.
 */
export function getPool(): Pool | undefined {
  if (!env.DATABASE_URL) {
    return undefined;
  }
  if (!pool) {
    pool = new Pool({ connectionString: env.DATABASE_URL, max: 10 });
    pool.on('error', (err) => {
      logger.error({ err }, 'Unexpected PostgreSQL pool error');
    });
  }
  return pool;
}

export async function checkDatabaseConnection(): Promise<boolean> {
  const activePool = getPool();
  if (!activePool) {
    return false;
  }
  try {
    await activePool.query('SELECT 1');
    return true;
  } catch (err) {
    logger.error({ err }, 'Database readiness check failed');
    return false;
  }
}
