import type {
  Evidence,
  EvidenceCategory,
  EvidenceId,
  MalwareScanStatus,
  RecoveryCaseId,
  UserId,
} from '@recoverai/shared';
import type { Queryable } from '../queryable';

interface EvidenceRow {
  id: string;
  case_id: string;
  uploaded_by_user_id: string;
  category: EvidenceCategory;
  description: string | null;
  storage_key: string;
  original_file_name: string;
  mime_type: string;
  file_size_bytes: string;
  checksum_sha256: string | null;
  malware_scan_status: MalwareScanStatus;
  deleted_at: string | null;
  created_at: string;
  updated_at: string;
}

function toEvidence(row: EvidenceRow): Evidence {
  return {
    id: row.id as EvidenceId,
    caseId: row.case_id as RecoveryCaseId,
    uploadedByUserId: row.uploaded_by_user_id as UserId,
    category: row.category,
    description: row.description,
    storageKey: row.storage_key,
    originalFileName: row.original_file_name,
    mimeType: row.mime_type,
    // BIGINT comes back as a string from `pg` to avoid precision loss beyond
    // Number.MAX_SAFE_INTEGER; real evidence file sizes never approach that.
    fileSizeBytes: Number(row.file_size_bytes),
    checksumSha256: row.checksum_sha256,
    malwareScanStatus: row.malware_scan_status,
    deletedAt: row.deleted_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export interface CreateEvidenceInput {
  caseId: RecoveryCaseId;
  uploadedByUserId: UserId;
  category: EvidenceCategory;
  description?: string | null;
  storageKey: string;
  originalFileName: string;
  mimeType: string;
  fileSizeBytes: number;
  checksumSha256?: string | null;
  malwareScanStatus?: MalwareScanStatus;
}

/**
 * Soft-deleted via deleted_at (see 0009_evidence.sql) rather than a hard
 * DELETE - evidence can carry legal/audit significance even after a user
 * removes it from their active view. storageKey is a private object-storage
 * path, never a public URL; Part 15 generates signed/temporary access URLs
 * from it on demand rather than this repository exposing one directly.
 */
export class EvidenceRepository {
  constructor(private readonly db: Queryable) {}

  async create(input: CreateEvidenceInput): Promise<Evidence> {
    const result = await this.db.query<EvidenceRow>(
      `INSERT INTO evidence
         (case_id, uploaded_by_user_id, category, description, storage_key, original_file_name,
          mime_type, file_size_bytes, checksum_sha256, malware_scan_status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, COALESCE($10::malware_scan_status, 'PENDING'))
       RETURNING *`,
      [
        input.caseId,
        input.uploadedByUserId,
        input.category,
        input.description ?? null,
        input.storageKey,
        input.originalFileName,
        input.mimeType,
        input.fileSizeBytes,
        input.checksumSha256 ?? null,
        input.malwareScanStatus ?? null,
      ],
    );
    const row = result.rows[0];
    if (!row) throw new Error('Insert into evidence returned no row');
    return toEvidence(row);
  }

  async listByCase(
    caseId: RecoveryCaseId,
    options: { includeDeleted?: boolean } = {},
  ): Promise<Evidence[]> {
    const result = await this.db.query<EvidenceRow>(
      options.includeDeleted
        ? 'SELECT * FROM evidence WHERE case_id = $1 ORDER BY created_at DESC'
        : 'SELECT * FROM evidence WHERE case_id = $1 AND deleted_at IS NULL ORDER BY created_at DESC',
      [caseId],
    );
    return result.rows.map(toEvidence);
  }

  /** Ownership-scoped via a join to recovery_cases - Evidence access is one of the master spec's named IDOR risks. */
  async findByIdForUser(id: EvidenceId, ownerUserId: UserId): Promise<Evidence | null> {
    const result = await this.db.query<EvidenceRow>(
      `SELECT e.* FROM evidence e
       JOIN recovery_cases rc ON rc.id = e.case_id
       WHERE e.id = $1 AND rc.user_id = $2 AND e.deleted_at IS NULL`,
      [id, ownerUserId],
    );
    const row = result.rows[0];
    return row ? toEvidence(row) : null;
  }

  async softDelete(id: EvidenceId, ownerUserId: UserId): Promise<boolean> {
    const result = await this.db.query(
      `UPDATE evidence e SET deleted_at = now()
       FROM recovery_cases rc
       WHERE e.id = $1 AND e.case_id = rc.id AND rc.user_id = $2 AND e.deleted_at IS NULL`,
      [id, ownerUserId],
    );
    return (result.rowCount ?? 0) > 0;
  }

  async updateMalwareScanStatus(id: EvidenceId, status: MalwareScanStatus): Promise<void> {
    await this.db.query('UPDATE evidence SET malware_scan_status = $2 WHERE id = $1', [id, status]);
  }
}
