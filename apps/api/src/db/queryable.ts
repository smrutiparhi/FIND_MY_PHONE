import type { QueryResult, QueryResultRow } from 'pg';

/**
 * Structural interface satisfied by both `Pool` and `PoolClient`. Every
 * repository accepts this instead of `Pool` directly so callers can pass a
 * transaction client (`pool.connect()` + BEGIN/COMMIT) when an operation
 * needs to write across more than one table atomically - e.g. Part 5's
 * wizard creating a RecoveryCase, IncidentAssessment, and RecoveryActions
 * together.
 */
export interface Queryable {
  query<R extends QueryResultRow = QueryResultRow>(
    text: string,
    params?: unknown[],
  ): Promise<QueryResult<R>>;
}
