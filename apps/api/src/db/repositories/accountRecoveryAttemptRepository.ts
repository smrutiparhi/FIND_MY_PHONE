import type { AccountAccessSignal, AccountRecoveryAttempt, AccountRecoveryAttemptId, AccountRecoveryStatus, RecoveryCaseId, UserId } from '@recoverai/shared';
import type { Queryable } from '../queryable';

interface AccountRecoveryAttemptRow {
  id: string;
  case_id: string;
  status: AccountRecoveryStatus;
  available_signals: AccountAccessSignal[];
  notes: string | null;
  created_at: string;
  updated_at: string;
}

function toAccountRecoveryAttempt(row: AccountRecoveryAttemptRow): AccountRecoveryAttempt {
  return {
    id: row.id as AccountRecoveryAttemptId,
    caseId: row.case_id as RecoveryCaseId,
    status: row.status,
    availableSignals: row.available_signals,
    notes: row.notes,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export interface UpdateAccountRecoveryAttemptPatch {
  status?: AccountRecoveryStatus;
  availableSignals?: AccountAccessSignal[];
  notes?: string | null;
}

/**
 * One attempt per case (see 0017_account_recovery_attempts.sql) - mirrors
 * CeirRecordRepository's getOrCreateForCase pattern exactly.
 */
export class AccountRecoveryAttemptRepository {
  constructor(private readonly db: Queryable) {}

  async getOrCreateForCase(caseId: RecoveryCaseId): Promise<AccountRecoveryAttempt> {
    const existing = await this.findByCase(caseId);
    if (existing) return existing;

    const result = await this.db.query<AccountRecoveryAttemptRow>(
      `INSERT INTO account_recovery_attempts (case_id) VALUES ($1)
       ON CONFLICT (case_id) DO UPDATE SET case_id = EXCLUDED.case_id
       RETURNING *`,
      [caseId],
    );
    const row = result.rows[0];
    if (!row) throw new Error('Insert into account_recovery_attempts returned no row');
    return toAccountRecoveryAttempt(row);
  }

  async findByCase(caseId: RecoveryCaseId): Promise<AccountRecoveryAttempt | null> {
    const result = await this.db.query<AccountRecoveryAttemptRow>(
      'SELECT * FROM account_recovery_attempts WHERE case_id = $1',
      [caseId],
    );
    const row = result.rows[0];
    return row ? toAccountRecoveryAttempt(row) : null;
  }

  async findByIdForUser(id: AccountRecoveryAttemptId, ownerUserId: UserId): Promise<AccountRecoveryAttempt | null> {
    const result = await this.db.query<AccountRecoveryAttemptRow>(
      `SELECT ara.* FROM account_recovery_attempts ara
       JOIN recovery_cases rc ON rc.id = ara.case_id
       WHERE ara.id = $1 AND rc.user_id = $2`,
      [id, ownerUserId],
    );
    const row = result.rows[0];
    return row ? toAccountRecoveryAttempt(row) : null;
  }

  async update(
    id: AccountRecoveryAttemptId,
    ownerUserId: UserId,
    patch: UpdateAccountRecoveryAttemptPatch,
  ): Promise<AccountRecoveryAttempt | null> {
    const result = await this.db.query<AccountRecoveryAttemptRow>(
      `UPDATE account_recovery_attempts ara SET
         status = COALESCE($3, ara.status),
         available_signals = COALESCE($4, ara.available_signals),
         notes = CASE WHEN $5::boolean THEN $6 ELSE notes END
       FROM recovery_cases rc
       WHERE ara.id = $1 AND ara.case_id = rc.id AND rc.user_id = $2
       RETURNING ara.*`,
      [id, ownerUserId, patch.status ?? null, patch.availableSignals ?? null, 'notes' in patch, patch.notes ?? null],
    );
    const row = result.rows[0];
    return row ? toAccountRecoveryAttempt(row) : null;
  }
}
