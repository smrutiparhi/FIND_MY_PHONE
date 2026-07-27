import type { AuditEvent, AuditEventId, UserId } from '@recoverai/shared';
import type { Queryable } from '../queryable';

interface AuditEventRow {
  id: string;
  user_id: string | null;
  action: string;
  resource_type: string | null;
  resource_id: string | null;
  ip_address: string | null;
  user_agent: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
}

function toAuditEvent(row: AuditEventRow): AuditEvent {
  return {
    id: row.id as AuditEventId,
    userId: row.user_id as UserId | null,
    action: row.action,
    resourceType: row.resource_type,
    resourceId: row.resource_id,
    ipAddress: row.ip_address,
    userAgent: row.user_agent,
    metadata: row.metadata,
    createdAt: row.created_at,
  };
}

export interface RecordAuditEventInput {
  userId?: UserId | null;
  /** Free-text action identifier (e.g. "auth.login.success") - see 0014_audit_events.sql for why this isn't an enum. */
  action: string;
  resourceType?: string | null;
  resourceId?: string | null;
  ipAddress?: string | null;
  userAgent?: string | null;
  /** Must never contain tokens, passwords, precise location, IMEI, OTPs, or financial data - enforced by callers (Part 20). */
  metadata?: Record<string, unknown> | null;
}

/**
 * Security/compliance audit trail (Part 20, Part 24's "Admin/security
 * monitoring") - distinct from TimelineEvent, which is the user-facing case
 * narrative. This is write-heavy and rarely read outside of admin tooling or
 * an investigation, so it intentionally has no update/delete methods.
 */
export class AuditEventRepository {
  constructor(private readonly db: Queryable) {}

  async record(input: RecordAuditEventInput): Promise<AuditEvent> {
    const result = await this.db.query<AuditEventRow>(
      `INSERT INTO audit_events (user_id, action, resource_type, resource_id, ip_address, user_agent, metadata)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [
        input.userId ?? null,
        input.action,
        input.resourceType ?? null,
        input.resourceId ?? null,
        input.ipAddress ?? null,
        input.userAgent ?? null,
        input.metadata ?? null,
      ],
    );
    const row = result.rows[0];
    if (!row) throw new Error('Insert into audit_events returned no row');
    return toAuditEvent(row);
  }

  async listByUser(userId: UserId, limit = 100): Promise<AuditEvent[]> {
    const result = await this.db.query<AuditEventRow>(
      'SELECT * FROM audit_events WHERE user_id = $1 ORDER BY created_at DESC LIMIT $2',
      [userId, limit],
    );
    return result.rows.map(toAuditEvent);
  }

  async listByResource(
    resourceType: string,
    resourceId: string,
    limit = 100,
  ): Promise<AuditEvent[]> {
    const result = await this.db.query<AuditEventRow>(
      'SELECT * FROM audit_events WHERE resource_type = $1 AND resource_id = $2 ORDER BY created_at DESC LIMIT $3',
      [resourceType, resourceId, limit],
    );
    return result.rows.map(toAuditEvent);
  }
}
