import type {
  PoliceReport,
  PoliceReportId,
  PoliceReportStatus,
  PoliceReportVersion,
  RecoveryCaseId,
  UserId,
} from '@recoverai/shared';
import type { Queryable } from '../queryable';

interface PoliceReportRow {
  id: string;
  case_id: string;
  created_by_user_id: string;
  status: PoliceReportStatus;
  owner_full_name: string;
  owner_contact: string;
  incident_date_time: string | null;
  last_known_place: string | null;
  incident_description: string;
  device_description_snapshot: string;
  draft_text: string;
  external_reference_number: string | null;
  approved_at: string | null;
  user_marked_submitted_at: string | null;
  created_at: string;
  updated_at: string;
}

interface PoliceReportVersionRow {
  id: string;
  police_report_id: string;
  version_number: number;
  draft_text: string;
  is_simulated: boolean;
  created_at: string;
}

function toPoliceReport(row: PoliceReportRow): PoliceReport {
  return {
    id: row.id as PoliceReportId,
    caseId: row.case_id as RecoveryCaseId,
    createdByUserId: row.created_by_user_id as UserId,
    status: row.status,
    ownerFullName: row.owner_full_name,
    ownerContact: row.owner_contact,
    incidentDateTime: row.incident_date_time,
    lastKnownPlace: row.last_known_place,
    incidentDescription: row.incident_description,
    deviceDescriptionSnapshot: row.device_description_snapshot,
    draftText: row.draft_text,
    externalReferenceNumber: row.external_reference_number,
    approvedAt: row.approved_at,
    userMarkedSubmittedAt: row.user_marked_submitted_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function toPoliceReportVersion(row: PoliceReportVersionRow): PoliceReportVersion {
  return {
    id: row.id,
    policeReportId: row.police_report_id as PoliceReportId,
    versionNumber: row.version_number,
    draftText: row.draft_text,
    isSimulated: row.is_simulated,
    createdAt: row.created_at,
  };
}

export interface CreatePoliceReportInput {
  caseId: RecoveryCaseId;
  createdByUserId: UserId;
  ownerFullName: string;
  ownerContact: string;
  incidentDateTime?: string | null;
  lastKnownPlace?: string | null;
  incidentDescription: string;
  deviceDescriptionSnapshot: string;
  draftText: string;
  isSimulated?: boolean;
}

/**
 * No status ever claims RecoverAI submitted the complaint - see
 * PoliceReportStatus in packages/shared: DRAFT / APPROVED /
 * USER_MARKED_SUBMITTED only. updateDraft always appends a new
 * police_report_versions row (Part 13: "Store complaint versions") rather
 * than overwriting draft_text in place.
 */
export class PoliceReportRepository {
  constructor(private readonly db: Queryable) {}

  async create(input: CreatePoliceReportInput): Promise<PoliceReport> {
    const result = await this.db.query<PoliceReportRow>(
      `INSERT INTO police_reports
         (case_id, created_by_user_id, owner_full_name, owner_contact, incident_date_time,
          last_known_place, incident_description, device_description_snapshot, draft_text)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING *`,
      [
        input.caseId,
        input.createdByUserId,
        input.ownerFullName,
        input.ownerContact,
        input.incidentDateTime ?? null,
        input.lastKnownPlace ?? null,
        input.incidentDescription,
        input.deviceDescriptionSnapshot,
        input.draftText,
      ],
    );
    const row = result.rows[0];
    if (!row) throw new Error('Insert into police_reports returned no row');

    await this.db.query(
      'INSERT INTO police_report_versions (police_report_id, version_number, draft_text, is_simulated) VALUES ($1, 1, $2, $3)',
      [row.id, row.draft_text, input.isSimulated ?? false],
    );

    return toPoliceReport(row);
  }

  async findByIdForUser(id: PoliceReportId, ownerUserId: UserId): Promise<PoliceReport | null> {
    const result = await this.db.query<PoliceReportRow>(
      `SELECT pr.* FROM police_reports pr
       JOIN recovery_cases rc ON rc.id = pr.case_id
       WHERE pr.id = $1 AND rc.user_id = $2`,
      [id, ownerUserId],
    );
    const row = result.rows[0];
    return row ? toPoliceReport(row) : null;
  }

  async listByCase(caseId: RecoveryCaseId): Promise<PoliceReport[]> {
    const result = await this.db.query<PoliceReportRow>(
      'SELECT * FROM police_reports WHERE case_id = $1 ORDER BY created_at DESC',
      [caseId],
    );
    return result.rows.map(toPoliceReport);
  }

  async updateDraft(
    id: PoliceReportId,
    ownerUserId: UserId,
    draftText: string,
    isSimulated = false,
  ): Promise<PoliceReport | null> {
    const existing = await this.findByIdForUser(id, ownerUserId);
    if (!existing) return null;

    const versionResult = await this.db.query<{ next_version: number }>(
      'SELECT COALESCE(MAX(version_number), 0) + 1 AS next_version FROM police_report_versions WHERE police_report_id = $1',
      [id],
    );
    const nextVersion = versionResult.rows[0]?.next_version ?? 1;

    await this.db.query(
      'INSERT INTO police_report_versions (police_report_id, version_number, draft_text, is_simulated) VALUES ($1, $2, $3, $4)',
      [id, nextVersion, draftText, isSimulated],
    );

    const result = await this.db.query<PoliceReportRow>(
      `UPDATE police_reports SET draft_text = $2, status = 'DRAFT' WHERE id = $1 RETURNING *`,
      [id, draftText],
    );
    const row = result.rows[0];
    return row ? toPoliceReport(row) : null;
  }

  /**
   * Regeneration (Part 13) can correct the underlying facts, not just the
   * prose - unlike updateDraft (a pure text replacement for manual edits),
   * this also updates the fact columns so they never drift from what the
   * latest draft actually says.
   */
  async regenerate(
    id: PoliceReportId,
    ownerUserId: UserId,
    patch: {
      ownerFullName: string;
      ownerContact: string;
      incidentDateTime: string | null;
      lastKnownPlace: string | null;
      incidentDescription: string;
      deviceDescriptionSnapshot: string;
      draftText: string;
      isSimulated: boolean;
    },
  ): Promise<PoliceReport | null> {
    const existing = await this.findByIdForUser(id, ownerUserId);
    if (!existing) return null;

    const versionResult = await this.db.query<{ next_version: number }>(
      'SELECT COALESCE(MAX(version_number), 0) + 1 AS next_version FROM police_report_versions WHERE police_report_id = $1',
      [id],
    );
    const nextVersion = versionResult.rows[0]?.next_version ?? 1;

    await this.db.query(
      'INSERT INTO police_report_versions (police_report_id, version_number, draft_text, is_simulated) VALUES ($1, $2, $3, $4)',
      [id, nextVersion, patch.draftText, patch.isSimulated],
    );

    const result = await this.db.query<PoliceReportRow>(
      `UPDATE police_reports SET
         owner_full_name = $2,
         owner_contact = $3,
         incident_date_time = $4,
         last_known_place = $5,
         incident_description = $6,
         device_description_snapshot = $7,
         draft_text = $8,
         status = 'DRAFT'
       WHERE id = $1
       RETURNING *`,
      [
        id,
        patch.ownerFullName,
        patch.ownerContact,
        patch.incidentDateTime,
        patch.lastKnownPlace,
        patch.incidentDescription,
        patch.deviceDescriptionSnapshot,
        patch.draftText,
      ],
    );
    const row = result.rows[0];
    return row ? toPoliceReport(row) : null;
  }

  async approve(id: PoliceReportId, ownerUserId: UserId): Promise<PoliceReport | null> {
    const result = await this.db.query<PoliceReportRow>(
      `UPDATE police_reports pr SET status = 'APPROVED', approved_at = now()
       FROM recovery_cases rc
       WHERE pr.id = $1 AND pr.case_id = rc.id AND rc.user_id = $2
       RETURNING pr.*`,
      [id, ownerUserId],
    );
    const row = result.rows[0];
    return row ? toPoliceReport(row) : null;
  }

  async markUserSubmitted(
    id: PoliceReportId,
    ownerUserId: UserId,
    externalReferenceNumber?: string | null,
  ): Promise<PoliceReport | null> {
    const result = await this.db.query<PoliceReportRow>(
      `UPDATE police_reports pr SET
         status = 'USER_MARKED_SUBMITTED',
         user_marked_submitted_at = now(),
         external_reference_number = COALESCE($3, pr.external_reference_number)
       FROM recovery_cases rc
       WHERE pr.id = $1 AND pr.case_id = rc.id AND rc.user_id = $2
       RETURNING pr.*`,
      [id, ownerUserId, externalReferenceNumber ?? null],
    );
    const row = result.rows[0];
    return row ? toPoliceReport(row) : null;
  }

  async listVersions(id: PoliceReportId): Promise<PoliceReportVersion[]> {
    const result = await this.db.query<PoliceReportVersionRow>(
      'SELECT * FROM police_report_versions WHERE police_report_id = $1 ORDER BY version_number DESC',
      [id],
    );
    return result.rows.map(toPoliceReportVersion);
  }
}
