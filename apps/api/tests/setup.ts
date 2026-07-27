import { afterAll, beforeAll, beforeEach } from 'vitest';
import { Pool } from 'pg';
import { env } from '../src/config/env';
import { runMigrations } from '../src/db/migrate';

if (!env.DATABASE_URL) {
  throw new Error(
    'DATABASE_URL must be configured to run the test suite - point apps/api/.env at a disposable test Postgres instance.',
  );
}
if (!env.ENCRYPTION_KEY) {
  throw new Error(
    'ENCRYPTION_KEY must be configured to run the test suite (Device repository tests encrypt IMEI values).',
  );
}

export const testPool = new Pool({ connectionString: env.DATABASE_URL });

/**
 * Truncating `users` cascades through every table in the schema, since every
 * other table's ownership chain ultimately traces back to it via foreign
 * keys - no need to enumerate or order the other 13 tables here, and new
 * tables added in later parts are covered automatically as long as they
 * chain back to users/recovery_cases.
 */
export async function resetDatabase(): Promise<void> {
  await testPool.query('TRUNCATE TABLE users CASCADE');
}

beforeAll(async () => {
  await runMigrations(testPool);
});

beforeEach(async () => {
  await resetDatabase();
});

afterAll(async () => {
  await testPool.end();
});
