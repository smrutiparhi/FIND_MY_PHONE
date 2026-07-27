import type {
  CaseStatus,
  DeviceId,
  IncidentType,
  RecoveryActionId,
  RecoveryCase,
  RecoveryCaseId,
  RiskLevel,
  SimAccessStatus,
  TriStateAnswer,
  UserId,
} from '@recoverai/shared';
import type { Queryable } from '../queryable';

/** Statuses that mean the case is finished and should sort after active cases (Part 4 dashboard requirement). */
const TERMINAL_STATUSES: CaseStatus[] = ['RECOVERED', 'ERASED', 'CLOSED'];

interface RecoveryCaseRow {
  id: string;
  user_id: string;
  device_id: string;
  incident_type: IncidentType;
  status: CaseStatus;
  risk_level: RiskLevel | null;
  occurred_at: string | null;
  last_seen_at: string | null;
  last_seen_description: string | null;
  account_access_status: TriStateAnswer | null;
  sim_access_status: SimAccessStatus | null;
  location_capability: TriStateAnswer | null;
  current_recommended_action_id: string | null;
  created_at: string;
  updated_at: string;
  closed_at: string | null;
}

function toRecoveryCase(row: RecoveryCaseRow): RecoveryCase {
  return {
    id: row.id as RecoveryCaseId,
    userId: row.user_id as UserId,
    deviceId: row.device_id as DeviceId,
    incidentType: row.incident_type,
    status: row.status,
    riskLevel: row.risk_level,
    occurredAt: row.occurred_at,
    lastSeenAt: row.last_seen_at,
    lastSeenDescription: row.last_seen_description,
    accountAccessStatus: row.account_access_status,
    simAccessStatus: row.sim_access_status,
    locationCapability: row.location_capability,
    currentRecommendedActionId: row.current_recommended_action_id as RecoveryActionId | null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    closedAt: row.closed_at,
  };
}

export interface CreateRecoveryCaseInput {
  userId: UserId;
  deviceId: DeviceId;
  incidentType: IncidentType;
  occurredAt?: string | null;
  lastSeenAt?: string | null;
  lastSeenDescription?: string | null;
  accountAccessStatus?: TriStateAnswer | null;
  simAccessStatus?: SimAccessStatus | null;
  locationCapability?: TriStateAnswer | null;
}

export interface UpdateRecoveryCaseInput {
  status?: CaseStatus;
  riskLevel?: RiskLevel | null;
  lastSeenAt?: string | null;
  lastSeenDescription?: string | null;
  accountAccessStatus?: TriStateAnswer | null;
  simAccessStatus?: SimAccessStatus | null;
  locationCapability?: TriStateAnswer | null;
}

/**
 * Every method is scoped by ownerUserId (IDOR prevention - see
 * docs/DATABASE.md). Callers creating a case must have already verified the
 * referenced device belongs to the same user; the database enforces the FK
 * exists but not that it's the same owner as userId (a cross-table CHECK
 * can't express that in Postgres), so that invariant is a service-layer
 * responsibility from Part 5 onward.
 */
export class RecoveryCaseRepository {
  constructor(private readonly db: Queryable) {}

  async create(input: CreateRecoveryCaseInput): Promise<RecoveryCase> {
    const result = await this.db.query<RecoveryCaseRow>(
      `INSERT INTO recovery_cases
         (user_id, device_id, incident_type, occurred_at, last_seen_at, last_seen_description,
          account_access_status, sim_access_status, location_capability)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING *`,
      [
        input.userId,
        input.deviceId,
        input.incidentType,
        input.occurredAt ?? null,
        input.lastSeenAt ?? null,
        input.lastSeenDescription ?? null,
        input.accountAccessStatus ?? null,
        input.simAccessStatus ?? null,
        input.locationCapability ?? null,
      ],
    );
    const row = result.rows[0];
    if (!row) throw new Error('Insert into recovery_cases returned no row');
    return toRecoveryCase(row);
  }

  async findById(id: RecoveryCaseId, ownerUserId: UserId): Promise<RecoveryCase | null> {
    const result = await this.db.query<RecoveryCaseRow>(
      'SELECT * FROM recovery_cases WHERE id = $1 AND user_id = $2',
      [id, ownerUserId],
    );
    const row = result.rows[0];
    return row ? toRecoveryCase(row) : null;
  }

  /** Active cases first (per Part 4 dashboard requirement), newest first within each group. */
  async listByUser(ownerUserId: UserId): Promise<RecoveryCase[]> {
    const result = await this.db.query<RecoveryCaseRow>(
      `SELECT * FROM recovery_cases
       WHERE user_id = $1
       ORDER BY (status = ANY($2::case_status[])) ASC, created_at DESC`,
      [ownerUserId, TERMINAL_STATUSES],
    );
    return result.rows.map(toRecoveryCase);
  }

  async update(
    id: RecoveryCaseId,
    ownerUserId: UserId,
    patch: UpdateRecoveryCaseInput,
  ): Promise<RecoveryCase | null> {
    const result = await this.db.query<RecoveryCaseRow>(
      `UPDATE recovery_cases SET
         status = COALESCE($3, status),
         risk_level = CASE WHEN $4::boolean THEN $5 ELSE risk_level END,
         last_seen_at = CASE WHEN $6::boolean THEN $7 ELSE last_seen_at END,
         last_seen_description = CASE WHEN $8::boolean THEN $9 ELSE last_seen_description END,
         account_access_status = CASE WHEN $10::boolean THEN $11 ELSE account_access_status END,
         sim_access_status = CASE WHEN $12::boolean THEN $13 ELSE sim_access_status END,
         location_capability = CASE WHEN $14::boolean THEN $15 ELSE location_capability END,
         closed_at = CASE WHEN $3 = ANY($16::case_status[]) AND closed_at IS NULL THEN now() ELSE closed_at END
       WHERE id = $1 AND user_id = $2
       RETURNING *`,
      [
        id,
        ownerUserId,
        patch.status ?? null,
        'riskLevel' in patch,
        patch.riskLevel ?? null,
        'lastSeenAt' in patch,
        patch.lastSeenAt ?? null,
        'lastSeenDescription' in patch,
        patch.lastSeenDescription ?? null,
        'accountAccessStatus' in patch,
        patch.accountAccessStatus ?? null,
        'simAccessStatus' in patch,
        patch.simAccessStatus ?? null,
        'locationCapability' in patch,
        patch.locationCapability ?? null,
        TERMINAL_STATUSES,
      ],
    );
    const row = result.rows[0];
    return row ? toRecoveryCase(row) : null;
  }

  async setCurrentRecommendedAction(
    id: RecoveryCaseId,
    ownerUserId: UserId,
    actionId: RecoveryActionId | null,
  ): Promise<RecoveryCase | null> {
    const result = await this.db.query<RecoveryCaseRow>(
      `UPDATE recovery_cases SET current_recommended_action_id = $3 WHERE id = $1 AND user_id = $2 RETURNING *`,
      [id, ownerUserId, actionId],
    );
    const row = result.rows[0];
    return row ? toRecoveryCase(row) : null;
  }
}
