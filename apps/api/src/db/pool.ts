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

/**
 * Closes the shared pool and clears the singleton so a subsequent getPool()
 * lazily opens a fresh one. Exists for tests/http and tests/scenarios: those
 * exercise the app through createApp(), which pulls from this pool - a
 * second, separate one from tests/setup.ts's own testPool - and left open
 * for the rest of a long suite run, the two together can exceed Supabase's
 * session-mode pooler connection limit. Never called by the running server
 * itself, only by test teardown.
 */
export async function closePool(): Promise<void> {
  if (pool) {
    await pool.end();
    pool = undefined;
  }
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
