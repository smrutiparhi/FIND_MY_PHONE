import { createRepositories, type Repositories } from './repositories';
import { getPool } from './pool';

let repos: Repositories | undefined;

/** Lazily-created singleton bound to the shared connection pool, for controllers to use. */
export function getRepos(): Repositories {
  const pool = getPool();
  if (!pool) {
    throw new Error('DATABASE_URL must be configured to access application data.');
  }
  if (!repos) {
    repos = createRepositories(pool);
  }
  return repos;
}
