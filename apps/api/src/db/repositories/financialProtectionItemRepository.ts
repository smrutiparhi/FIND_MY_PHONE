import type {
  FinancialItemCategory,
  FinancialProtectionItem,
  FinancialProtectionItemId,
  FinancialProtectionStatus,
  RecoveryCaseId,
  UserId,
} from '@recoverai/shared';
import type { Queryable } from '../queryable';

interface FinancialProtectionItemRow {
  id: string;
  case_id: string;
  category: FinancialItemCategory;
  label: string | null;
  status: FinancialProtectionStatus;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

function toFinancialProtectionItem(row: FinancialProtectionItemRow): FinancialProtectionItem {
  return {
    id: row.id as FinancialProtectionItemId,
    caseId: row.case_id as RecoveryCaseId,
    category: row.category,
    label: row.label,
    status: row.status,
    notes: row.notes,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export interface CreateFinancialProtectionItemInput {
  caseId: RecoveryCaseId;
  category: FinancialItemCategory;
  label?: string | null;
  status?: FinancialProtectionStatus;
}

export interface UpdateFinancialProtectionItemPatch {
  status?: FinancialProtectionStatus;
  label?: string | null;
  notes?: string | null;
}

/**
 * Many rows per case (Part 12) - unlike CeirRecordRepository/
 * AccountRecoveryAttemptRepository's one-per-case pattern, this is a
 * user-built list, so there's a real create/delete surface here instead of
 * a single getOrCreateForCase.
 */
export class FinancialProtectionItemRepository {
  constructor(private readonly db: Queryable) {}

  async create(input: CreateFinancialProtectionItemInput): Promise<FinancialProtectionItem> {
    const result = await this.db.query<FinancialProtectionItemRow>(
      `INSERT INTO financial_protection_items (case_id, category, label, status)
       VALUES ($1, $2, $3, COALESCE($4::financial_protection_status, 'NOT_STARTED'))
       RETURNING *`,
      [input.caseId, input.category, input.label ?? null, input.status ?? null],
    );
    const row = result.rows[0];
    if (!row) throw new Error('Insert into financial_protection_items returned no row');
    return toFinancialProtectionItem(row);
  }

  async listByCase(caseId: RecoveryCaseId): Promise<FinancialProtectionItem[]> {
    const result = await this.db.query<FinancialProtectionItemRow>(
      'SELECT * FROM financial_protection_items WHERE case_id = $1 ORDER BY created_at ASC',
      [caseId],
    );
    return result.rows.map(toFinancialProtectionItem);
  }

  async findByIdForUser(id: FinancialProtectionItemId, ownerUserId: UserId): Promise<FinancialProtectionItem | null> {
    const result = await this.db.query<FinancialProtectionItemRow>(
      `SELECT fpi.* FROM financial_protection_items fpi
       JOIN recovery_cases rc ON rc.id = fpi.case_id
       WHERE fpi.id = $1 AND rc.user_id = $2`,
      [id, ownerUserId],
    );
    const row = result.rows[0];
    return row ? toFinancialProtectionItem(row) : null;
  }

  async update(
    id: FinancialProtectionItemId,
    ownerUserId: UserId,
    patch: UpdateFinancialProtectionItemPatch,
  ): Promise<FinancialProtectionItem | null> {
    const result = await this.db.query<FinancialProtectionItemRow>(
      `UPDATE financial_protection_items fpi SET
         status = COALESCE($3, fpi.status),
         label = CASE WHEN $4::boolean THEN $5 ELSE label END,
         notes = CASE WHEN $6::boolean THEN $7 ELSE notes END
       FROM recovery_cases rc
       WHERE fpi.id = $1 AND fpi.case_id = rc.id AND rc.user_id = $2
       RETURNING fpi.*`,
      [id, ownerUserId, patch.status ?? null, 'label' in patch, patch.label ?? null, 'notes' in patch, patch.notes ?? null],
    );
    const row = result.rows[0];
    return row ? toFinancialProtectionItem(row) : null;
  }

  async delete(id: FinancialProtectionItemId, ownerUserId: UserId): Promise<boolean> {
    const result = await this.db.query(
      `DELETE FROM financial_protection_items fpi
       USING recovery_cases rc
       WHERE fpi.id = $1 AND fpi.case_id = rc.id AND rc.user_id = $2`,
      [id, ownerUserId],
    );
    return (result.rowCount ?? 0) > 0;
  }
}
