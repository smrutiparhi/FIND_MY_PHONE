import type {
  CeirRecordId,
  EvidenceId,
  LocationObservationId,
  PoliceReportId,
  RecoveryActionId,
  RecoveryCaseId,
  TimelineEvent,
  TimelineEventId,
  TimelineEventSource,
  TimelineEventType,
  UserId,
  VerificationStatus,
} from '@recoverai/shared';
import type { Queryable } from '../queryable';

interface TimelineEventRow {
  id: string;
  case_id: string;
  type: TimelineEventType;
  title: string;
  description: string | null;
  source: TimelineEventSource;
  verification_status: VerificationStatus;
  recovery_action_id: string | null;
  location_observation_id: string | null;
  evidence_id: string | null;
  police_report_id: string | null;
  ceir_record_id: string | null;
  created_by_user_id: string | null;
  created_at: string;
}

function toTimelineEvent(row: TimelineEventRow): TimelineEvent {
  return {
    id: row.id as TimelineEventId,
    caseId: row.case_id as RecoveryCaseId,
    type: row.type,
    title: row.title,
    description: row.description,
    source: row.source,
    verificationStatus: row.verification_status,
    recoveryActionId: row.recovery_action_id as RecoveryActionId | null,
    locationObservationId: row.location_observation_id as LocationObservationId | null,
    evidenceId: row.evidence_id as EvidenceId | null,
    policeReportId: row.police_report_id as PoliceReportId | null,
    ceirRecordId: row.ceir_record_id as CeirRecordId | null,
    createdByUserId: row.created_by_user_id as UserId | null,
    createdAt: row.created_at,
  };
}

export interface CreateTimelineEventInput {
  caseId: RecoveryCaseId;
  type: TimelineEventType;
  title: string;
  description?: string | null;
  source: TimelineEventSource;
  verificationStatus?: VerificationStatus;
  recoveryActionId?: RecoveryActionId | null;
  locationObservationId?: LocationObservationId | null;
  evidenceId?: EvidenceId | null;
  policeReportId?: PoliceReportId | null;
  ceirRecordId?: CeirRecordId | null;
  createdByUserId?: UserId | null;
}

/**
 * Every significant case change (Part 16's list: case created, risk
 * assessed, location recorded, ...) gets a row here. Only USER_NOTE-type
 * rows are ever user-editable/deletable - updateUserNote/deleteUserNote
 * enforce that with `type = 'USER_NOTE'` in the WHERE clause itself, not
 * just at the call site, so a system event can never be altered even by a
 * future bug in calling code.
 */
export class TimelineEventRepository {
  constructor(private readonly db: Queryable) {}

  async create(input: CreateTimelineEventInput): Promise<TimelineEvent> {
    const result = await this.db.query<TimelineEventRow>(
      `INSERT INTO timeline_events
         (case_id, type, title, description, source, verification_status,
          recovery_action_id, location_observation_id, evidence_id, police_report_id, ceir_record_id, created_by_user_id)
       VALUES ($1, $2, $3, $4, $5, COALESCE($6::verification_status, 'SYSTEM_VERIFIED'), $7, $8, $9, $10, $11, $12)
       RETURNING *`,
      [
        input.caseId,
        input.type,
        input.title,
        input.description ?? null,
        input.source,
        input.verificationStatus ?? null,
        input.recoveryActionId ?? null,
        input.locationObservationId ?? null,
        input.evidenceId ?? null,
        input.policeReportId ?? null,
        input.ceirRecordId ?? null,
        input.createdByUserId ?? null,
      ],
    );
    const row = result.rows[0];
    if (!row) throw new Error('Insert into timeline_events returned no row');
    return toTimelineEvent(row);
  }

  async listByCase(
    caseId: RecoveryCaseId,
    order: 'ASC' | 'DESC' = 'DESC',
  ): Promise<TimelineEvent[]> {
    const result = await this.db.query<TimelineEventRow>(
      `SELECT * FROM timeline_events WHERE case_id = $1 ORDER BY created_at ${order === 'ASC' ? 'ASC' : 'DESC'}`,
      [caseId],
    );
    return result.rows.map(toTimelineEvent);
  }

  async findByIdForUser(id: TimelineEventId, ownerUserId: UserId): Promise<TimelineEvent | null> {
    const result = await this.db.query<TimelineEventRow>(
      `SELECT te.* FROM timeline_events te
       JOIN recovery_cases rc ON rc.id = te.case_id
       WHERE te.id = $1 AND rc.user_id = $2`,
      [id, ownerUserId],
    );
    const row = result.rows[0];
    return row ? toTimelineEvent(row) : null;
  }

  async updateUserNote(
    id: TimelineEventId,
    ownerUserId: UserId,
    patch: { title: string; description?: string | null },
  ): Promise<TimelineEvent | null> {
    const result = await this.db.query<TimelineEventRow>(
      `UPDATE timeline_events te SET title = $3, description = $4
       FROM recovery_cases rc
       WHERE te.id = $1 AND te.case_id = rc.id AND rc.user_id = $2 AND te.type = 'USER_NOTE'
       RETURNING te.*`,
      [id, ownerUserId, patch.title, patch.description ?? null],
    );
    const row = result.rows[0];
    return row ? toTimelineEvent(row) : null;
  }

  async deleteUserNote(id: TimelineEventId, ownerUserId: UserId): Promise<boolean> {
    const result = await this.db.query(
      `DELETE FROM timeline_events te
       USING recovery_cases rc
       WHERE te.id = $1 AND te.case_id = rc.id AND rc.user_id = $2 AND te.type = 'USER_NOTE'`,
      [id, ownerUserId],
    );
    return (result.rowCount ?? 0) > 0;
  }
}
