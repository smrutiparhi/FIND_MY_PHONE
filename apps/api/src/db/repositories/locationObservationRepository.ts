import type {
  LocationObservation,
  LocationObservationId,
  LocationSource,
  RecoveryCaseId,
  UserId,
  VerificationStatus,
} from '@recoverai/shared';
import type { Queryable } from '../queryable';

interface LocationObservationRow {
  id: string;
  case_id: string;
  latitude: string;
  longitude: string;
  accuracy_meters: string | null;
  observed_at: string;
  source: LocationSource;
  verification_status: VerificationStatus;
  notes: string | null;
  recorded_by_user_id: string | null;
  created_at: string;
}

function toLocationObservation(row: LocationObservationRow): LocationObservation {
  return {
    id: row.id as LocationObservationId,
    caseId: row.case_id as RecoveryCaseId,
    // pg returns NUMERIC as string to avoid float precision loss; coordinates
    // are safe to convert back to number here since they're display/map data,
    // not used in further arithmetic that would compound rounding error.
    latitude: Number(row.latitude),
    longitude: Number(row.longitude),
    accuracyMeters: row.accuracy_meters === null ? null : Number(row.accuracy_meters),
    observedAt: row.observed_at,
    source: row.source,
    verificationStatus: row.verification_status,
    notes: row.notes,
    recordedByUserId: row.recorded_by_user_id as UserId | null,
    createdAt: row.created_at,
  };
}

export interface CreateLocationObservationInput {
  caseId: RecoveryCaseId;
  latitude: number;
  longitude: number;
  accuracyMeters?: number | null;
  observedAt: string;
  source: LocationSource;
  verificationStatus?: VerificationStatus;
  notes?: string | null;
  recordedByUserId?: UserId | null;
}

/**
 * Append-only log of individual observations - never a continuous track
 * (master spec: "Never assume LocationObservation represents continuous
 * live tracking"). No update/delete methods: an observation is a historical
 * record of what was seen and when, not a mutable "current location" field.
 */
export class LocationObservationRepository {
  constructor(private readonly db: Queryable) {}

  async create(input: CreateLocationObservationInput): Promise<LocationObservation> {
    const result = await this.db.query<LocationObservationRow>(
      `INSERT INTO location_observations
         (case_id, latitude, longitude, accuracy_meters, observed_at, source, verification_status, notes, recorded_by_user_id)
       VALUES ($1, $2, $3, $4, $5, $6, COALESCE($7::verification_status, 'UNVERIFIED'), $8, $9)
       RETURNING *`,
      [
        input.caseId,
        input.latitude,
        input.longitude,
        input.accuracyMeters ?? null,
        input.observedAt,
        input.source,
        input.verificationStatus ?? null,
        input.notes ?? null,
        input.recordedByUserId ?? null,
      ],
    );
    const row = result.rows[0];
    if (!row) throw new Error('Insert into location_observations returned no row');
    return toLocationObservation(row);
  }

  async listByCase(caseId: RecoveryCaseId): Promise<LocationObservation[]> {
    const result = await this.db.query<LocationObservationRow>(
      'SELECT * FROM location_observations WHERE case_id = $1 ORDER BY observed_at DESC',
      [caseId],
    );
    return result.rows.map(toLocationObservation);
  }

  async findLatestByCase(caseId: RecoveryCaseId): Promise<LocationObservation | null> {
    const result = await this.db.query<LocationObservationRow>(
      'SELECT * FROM location_observations WHERE case_id = $1 ORDER BY observed_at DESC LIMIT 1',
      [caseId],
    );
    const row = result.rows[0];
    return row ? toLocationObservation(row) : null;
  }

  /** Ownership-scoped via a join to recovery_cases - defense in depth for the Recovery Map (Part 8). */
  async findByIdForUser(
    id: LocationObservationId,
    ownerUserId: UserId,
  ): Promise<LocationObservation | null> {
    const result = await this.db.query<LocationObservationRow>(
      `SELECT lo.* FROM location_observations lo
       JOIN recovery_cases rc ON rc.id = lo.case_id
       WHERE lo.id = $1 AND rc.user_id = $2`,
      [id, ownerUserId],
    );
    const row = result.rows[0];
    return row ? toLocationObservation(row) : null;
  }
}
