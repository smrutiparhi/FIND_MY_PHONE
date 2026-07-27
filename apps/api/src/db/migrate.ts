import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Pool } from 'pg';
import { env } from '../config/env';
import { logger } from '../lib/logger';
import { initializeArrayTypeParsers } from './arrayTypeParsers';

const currentDir = path.dirname(fileURLToPath(import.meta.url));
const MIGRATIONS_DIR = path.join(currentDir, 'migrations');

async function ensureMigrationsTable(pool: Pool): Promise<void> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      filename TEXT PRIMARY KEY,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `);
}

async function getAppliedMigrations(pool: Pool): Promise<Set<string>> {
  const result = await pool.query<{ filename: string }>('SELECT filename FROM schema_migrations');
  return new Set(result.rows.map((row) => row.filename));
}

/** Applies every migration in apps/api/src/db/migrations that hasn't run yet, in filename order. */
export async function runMigrations(pool: Pool): Promise<string[]> {
  await ensureMigrationsTable(pool);
  const applied = await getAppliedMigrations(pool);
  const files = (await readdir(MIGRATIONS_DIR)).filter((file) => file.endsWith('.sql')).sort();

  const newlyApplied: string[] = [];

  for (const file of files) {
    if (applied.has(file)) continue;

    const sql = await readFile(path.join(MIGRATIONS_DIR, file), 'utf8');
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query(sql);
      await client.query('INSERT INTO schema_migrations (filename) VALUES ($1)', [file]);
      await client.query('COMMIT');
      newlyApplied.push(file);
      logger.info({ file }, 'Applied migration');
    } catch (err) {
      await client.query('ROLLBACK');
      logger.error({ err, file }, 'Migration failed - rolled back');
      throw err;
    } finally {
      client.release();
    }
  }

  // Enum types only exist once their migration has run, so this must happen
  // after the loop above, not before it.
  await initializeArrayTypeParsers(pool);

  return newlyApplied;
}

const isMainModule =
  process.argv[1] !== undefined && fileURLToPath(import.meta.url) === path.resolve(process.argv[1]);

if (isMainModule) {
  if (!env.DATABASE_URL) {
    logger.error('DATABASE_URL must be configured to run migrations.');
    process.exit(1);
  }

  const pool = new Pool({ connectionString: env.DATABASE_URL });
  runMigrations(pool)
    .then((applied) => {
      logger.info(
        { count: applied.length },
        applied.length > 0 ? 'Migrations complete' : 'Already up to date',
      );
      return pool.end();
    })
    .then(() => process.exit(0))
    .catch(() => {
      void pool.end().finally(() => process.exit(1));
    });
}
