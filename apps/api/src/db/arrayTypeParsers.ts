import { types, type Pool } from 'pg';

/**
 * node-pg ships built-in parsers for standard array types (text[], int[], ...)
 * but has no way to know about custom Postgres enum types ahead of time -
 * their array OIDs are assigned per-database at CREATE TYPE time. Without
 * this, columns like incident_assessments.sensitive_apps or
 * ceir_records.checklist_completed_items come back as raw Postgres array
 * literals ("{BANKING,UPI}") instead of JS arrays. This looks up each enum's
 * dynamically-assigned array OID and registers a parser for it, once per
 * process.
 */
const ENUM_ARRAY_TYPE_NAMES = [
  'sensitive_app_type',
  'ceir_checklist_item',
  'account_access_signal',
  'device_recovery_checklist_item',
] as const;

function parsePostgresEnumArrayLiteral(raw: string): string[] {
  if (raw === '{}') return [];
  // Enum members are plain identifiers (letters/underscores) - no quoting or
  // escaping to worry about, unlike general text[] literals.
  return raw.slice(1, -1).split(',');
}

let initialized = false;

export async function initializeArrayTypeParsers(pool: Pool): Promise<void> {
  if (initialized) return;

  const result = await pool.query<{ typname: string; typarray: number }>(
    'SELECT typname, typarray FROM pg_type WHERE typname = ANY($1::text[])',
    [ENUM_ARRAY_TYPE_NAMES],
  );

  for (const row of result.rows) {
    types.setTypeParser(row.typarray, parsePostgresEnumArrayLiteral);
  }

  initialized = true;
}
