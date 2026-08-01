import type {
  DeviceRecoveryChecklist,
  DeviceRecoveryChecklistId,
  DeviceRecoveryChecklistItem,
  RecoveryCaseId,
  UserId,
} from '@recoverai/shared';
import type { Queryable } from '../queryable';

interface DeviceRecoveryChecklistRow {
  id: string;
  case_id: string;
  completed_items: DeviceRecoveryChecklistItem[];
  notes: string | null;
  recovered_at: string | null;
  closed_at: string | null;
  created_at: string;
  updated_at: string;
}

function toDeviceRecoveryChecklist(row: DeviceRecoveryChecklistRow): DeviceRecoveryChecklist {
  return {
    id: row.id as DeviceRecoveryChecklistId,
    caseId: row.case_id as RecoveryCaseId,
    completedItems: row.completed_items,
    notes: row.notes,
    recoveredAt: row.recovered_at,
    closedAt: row.closed_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export interface UpdateDeviceRecoveryChecklistInput {
  completedItems?: DeviceRecoveryChecklistItem[];
  notes?: string | null;
  /** Set exactly once, by the service layer, the moment CONFIRM_POSSESSION first appears. */
  recoveredAt?: string;
  /** Set exactly once, by the service layer, when the case is actually closed. */
  closedAt?: string;
}

/**
 * One checklist per case (mirrors ceir_records - see ceirRecordRepository.ts),
 * lazily created the first time a case's "I found my phone" flow is opened.
 */
export class DeviceRecoveryChecklistRepository {
  constructor(private readonly db: Queryable) {}

  async getOrCreateForCase(caseId: RecoveryCaseId): Promise<DeviceRecoveryChecklist> {
    const existing = await this.findByCase(caseId);
    if (existing) return existing;

    const result = await this.db.query<DeviceRecoveryChecklistRow>(
      `INSERT INTO device_recovery_checklists (case_id) VALUES ($1)
       ON CONFLICT (case_id) DO UPDATE SET case_id = EXCLUDED.case_id
       RETURNING *`,
      [caseId],
    );
    const row = result.rows[0];
    if (!row) throw new Error('Insert into device_recovery_checklists returned no row');
    return toDeviceRecoveryChecklist(row);
  }

  async findByCase(caseId: RecoveryCaseId): Promise<DeviceRecoveryChecklist | null> {
    const result = await this.db.query<DeviceRecoveryChecklistRow>(
      'SELECT * FROM device_recovery_checklists WHERE case_id = $1',
      [caseId],
    );
    const row = result.rows[0];
    return row ? toDeviceRecoveryChecklist(row) : null;
  }

  async update(
    id: DeviceRecoveryChecklistId,
    ownerUserId: UserId,
    patch: UpdateDeviceRecoveryChecklistInput,
  ): Promise<DeviceRecoveryChecklist | null> {
    const result = await this.db.query<DeviceRecoveryChecklistRow>(
      `UPDATE device_recovery_checklists dc SET
         completed_items = COALESCE($3, dc.completed_items),
         notes = CASE WHEN $4::boolean THEN $5 ELSE notes END,
         recovered_at = COALESCE($6::timestamptz, dc.recovered_at),
         closed_at = COALESCE($7::timestamptz, dc.closed_at)
       FROM recovery_cases rc
       WHERE dc.id = $1 AND dc.case_id = rc.id AND rc.user_id = $2
       RETURNING dc.*`,
      [
        id,
        ownerUserId,
        patch.completedItems ?? null,
        'notes' in patch,
        patch.notes ?? null,
        patch.recoveredAt ?? null,
        patch.closedAt ?? null,
      ],
    );
    const row = result.rows[0];
    return row ? toDeviceRecoveryChecklist(row) : null;
  }
}
