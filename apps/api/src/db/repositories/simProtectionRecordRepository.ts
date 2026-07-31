import type { RecoveryCaseId, SimProtectionRecord, SimProtectionRecordId, SimStatus, UserId } from '@recoverai/shared';
import type { Queryable } from '../queryable';

interface SimProtectionRecordRow {
  id: string;
  case_id: string;
  status: SimStatus;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

function toSimProtectionRecord(row: SimProtectionRecordRow): SimProtectionRecord {
  return {
    id: row.id as SimProtectionRecordId,
    caseId: row.case_id as RecoveryCaseId,
    status: row.status,
    notes: row.notes,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export interface UpdateSimProtectionRecordPatch {
  status?: SimStatus;
  notes?: string | null;
}

/** One record per case (see 0018_sim_protection_records.sql) - mirrors AccountRecoveryAttemptRepository/CeirRecordRepository's getOrCreateForCase pattern exactly. */
export class SimProtectionRecordRepository {
  constructor(private readonly db: Queryable) {}

  async getOrCreateForCase(caseId: RecoveryCaseId): Promise<SimProtectionRecord> {
    const existing = await this.findByCase(caseId);
    if (existing) return existing;

    const result = await this.db.query<SimProtectionRecordRow>(
      `INSERT INTO sim_protection_records (case_id) VALUES ($1)
       ON CONFLICT (case_id) DO UPDATE SET case_id = EXCLUDED.case_id
       RETURNING *`,
      [caseId],
    );
    const row = result.rows[0];
    if (!row) throw new Error('Insert into sim_protection_records returned no row');
    return toSimProtectionRecord(row);
  }

  async findByCase(caseId: RecoveryCaseId): Promise<SimProtectionRecord | null> {
    const result = await this.db.query<SimProtectionRecordRow>(
      'SELECT * FROM sim_protection_records WHERE case_id = $1',
      [caseId],
    );
    const row = result.rows[0];
    return row ? toSimProtectionRecord(row) : null;
  }

  async findByIdForUser(id: SimProtectionRecordId, ownerUserId: UserId): Promise<SimProtectionRecord | null> {
    const result = await this.db.query<SimProtectionRecordRow>(
      `SELECT spr.* FROM sim_protection_records spr
       JOIN recovery_cases rc ON rc.id = spr.case_id
       WHERE spr.id = $1 AND rc.user_id = $2`,
      [id, ownerUserId],
    );
    const row = result.rows[0];
    return row ? toSimProtectionRecord(row) : null;
  }

  async update(
    id: SimProtectionRecordId,
    ownerUserId: UserId,
    patch: UpdateSimProtectionRecordPatch,
  ): Promise<SimProtectionRecord | null> {
    const result = await this.db.query<SimProtectionRecordRow>(
      `UPDATE sim_protection_records spr SET
         status = COALESCE($3, spr.status),
         notes = CASE WHEN $4::boolean THEN $5 ELSE notes END
       FROM recovery_cases rc
       WHERE spr.id = $1 AND spr.case_id = rc.id AND rc.user_id = $2
       RETURNING spr.*`,
      [id, ownerUserId, patch.status ?? null, 'notes' in patch, patch.notes ?? null],
    );
    const row = result.rows[0];
    return row ? toSimProtectionRecord(row) : null;
  }
}
