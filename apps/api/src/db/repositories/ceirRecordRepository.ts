import type {
  CeirChecklistItem,
  CeirRecord,
  CeirRecordId,
  CeirStatus,
  RecoveryCaseId,
  UserId,
} from '@recoverai/shared';
import type { Queryable } from '../queryable';

interface CeirRecordRow {
  id: string;
  case_id: string;
  status: CeirStatus;
  ceir_request_id: string | null;
  submission_date: string | null;
  notes: string | null;
  checklist_completed_items: CeirChecklistItem[];
  created_at: string;
  updated_at: string;
}

function toCeirRecord(row: CeirRecordRow): CeirRecord {
  return {
    id: row.id as CeirRecordId,
    caseId: row.case_id as RecoveryCaseId,
    status: row.status,
    ceirRequestId: row.ceir_request_id,
    submissionDate: row.submission_date,
    notes: row.notes,
    checklistCompletedItems: row.checklist_completed_items,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export interface UpdateCeirRecordInput {
  status?: CeirStatus;
  ceirRequestId?: string | null;
  submissionDate?: string | null;
  notes?: string | null;
  checklistCompletedItems?: CeirChecklistItem[];
}

/**
 * One record per case (unique constraint on case_id - see
 * 0011_ceir_records.sql), lazily created the first time a case's CEIR
 * Assistant screen (Part 14) is opened. ceirRequestId is purely user-entered
 * (the id issued by the real CEIR/Sanchar Saathi portal) - this repository
 * never generates or fabricates one.
 */
export class CeirRecordRepository {
  constructor(private readonly db: Queryable) {}

  async getOrCreateForCase(caseId: RecoveryCaseId): Promise<CeirRecord> {
    const existing = await this.findByCase(caseId);
    if (existing) return existing;

    const result = await this.db.query<CeirRecordRow>(
      `INSERT INTO ceir_records (case_id) VALUES ($1)
       ON CONFLICT (case_id) DO UPDATE SET case_id = EXCLUDED.case_id
       RETURNING *`,
      [caseId],
    );
    const row = result.rows[0];
    if (!row) throw new Error('Insert into ceir_records returned no row');
    return toCeirRecord(row);
  }

  async findByCase(caseId: RecoveryCaseId): Promise<CeirRecord | null> {
    const result = await this.db.query<CeirRecordRow>(
      'SELECT * FROM ceir_records WHERE case_id = $1',
      [caseId],
    );
    const row = result.rows[0];
    return row ? toCeirRecord(row) : null;
  }

  async findByIdForUser(id: CeirRecordId, ownerUserId: UserId): Promise<CeirRecord | null> {
    const result = await this.db.query<CeirRecordRow>(
      `SELECT cr.* FROM ceir_records cr
       JOIN recovery_cases rc ON rc.id = cr.case_id
       WHERE cr.id = $1 AND rc.user_id = $2`,
      [id, ownerUserId],
    );
    const row = result.rows[0];
    return row ? toCeirRecord(row) : null;
  }

  async update(
    id: CeirRecordId,
    ownerUserId: UserId,
    patch: UpdateCeirRecordInput,
  ): Promise<CeirRecord | null> {
    const result = await this.db.query<CeirRecordRow>(
      `UPDATE ceir_records cr SET
         status = COALESCE($3, cr.status),
         ceir_request_id = CASE WHEN $4::boolean THEN $5 ELSE ceir_request_id END,
         submission_date = CASE WHEN $6::boolean THEN $7::date ELSE submission_date END,
         notes = CASE WHEN $8::boolean THEN $9 ELSE notes END,
         checklist_completed_items = COALESCE($10, checklist_completed_items)
       FROM recovery_cases rc
       WHERE cr.id = $1 AND cr.case_id = rc.id AND rc.user_id = $2
       RETURNING cr.*`,
      [
        id,
        ownerUserId,
        patch.status ?? null,
        'ceirRequestId' in patch,
        patch.ceirRequestId ?? null,
        'submissionDate' in patch,
        patch.submissionDate ?? null,
        'notes' in patch,
        patch.notes ?? null,
        patch.checklistCompletedItems ?? null,
      ],
    );
    const row = result.rows[0];
    return row ? toCeirRecord(row) : null;
  }
}
