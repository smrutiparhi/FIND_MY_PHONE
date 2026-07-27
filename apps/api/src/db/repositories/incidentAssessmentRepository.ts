import type {
  IncidentAssessment,
  IncidentAssessmentId,
  RecoveryCaseId,
  RiskLevel,
  SensitiveAppType,
  TriStateAnswer,
} from '@recoverai/shared';
import type { Queryable } from '../queryable';

interface IncidentAssessmentRow {
  id: string;
  case_id: string;
  screen_lock_enabled: TriStateAnswer | null;
  sensitive_apps: SensitiveAppType[];
  device_finding_available: TriStateAnswer | null;
  risk_level: RiskLevel;
  risk_reasons: string[];
  created_at: string;
}

function toIncidentAssessment(row: IncidentAssessmentRow): IncidentAssessment {
  return {
    id: row.id as IncidentAssessmentId,
    caseId: row.case_id as RecoveryCaseId,
    screenLockEnabled: row.screen_lock_enabled,
    sensitiveApps: row.sensitive_apps,
    deviceFindingAvailable: row.device_finding_available,
    riskLevel: row.risk_level,
    riskReasons: row.risk_reasons,
    createdAt: row.created_at,
  };
}

export interface CreateIncidentAssessmentInput {
  caseId: RecoveryCaseId;
  screenLockEnabled?: TriStateAnswer | null;
  sensitiveApps?: SensitiveAppType[];
  deviceFindingAvailable?: TriStateAnswer | null;
  riskLevel: RiskLevel;
  riskReasons: string[];
}

/**
 * Append-only history (see 0006_incident_assessments.sql): the Recovery
 * Decision Engine (Part 6) writes a new row every time it recalculates
 * rather than mutating a single row, so the case's risk trajectory stays
 * auditable. Callers are expected to have already verified case ownership
 * via RecoveryCaseRepository before reaching this repository.
 */
export class IncidentAssessmentRepository {
  constructor(private readonly db: Queryable) {}

  async create(input: CreateIncidentAssessmentInput): Promise<IncidentAssessment> {
    const result = await this.db.query<IncidentAssessmentRow>(
      `INSERT INTO incident_assessments
         (case_id, screen_lock_enabled, sensitive_apps, device_finding_available, risk_level, risk_reasons)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [
        input.caseId,
        input.screenLockEnabled ?? null,
        input.sensitiveApps ?? [],
        input.deviceFindingAvailable ?? null,
        input.riskLevel,
        input.riskReasons,
      ],
    );
    const row = result.rows[0];
    if (!row) throw new Error('Insert into incident_assessments returned no row');
    return toIncidentAssessment(row);
  }

  async listByCase(caseId: RecoveryCaseId): Promise<IncidentAssessment[]> {
    const result = await this.db.query<IncidentAssessmentRow>(
      'SELECT * FROM incident_assessments WHERE case_id = $1 ORDER BY created_at DESC',
      [caseId],
    );
    return result.rows.map(toIncidentAssessment);
  }

  async findLatestByCase(caseId: RecoveryCaseId): Promise<IncidentAssessment | null> {
    const result = await this.db.query<IncidentAssessmentRow>(
      'SELECT * FROM incident_assessments WHERE case_id = $1 ORDER BY created_at DESC LIMIT 1',
      [caseId],
    );
    const row = result.rows[0];
    return row ? toIncidentAssessment(row) : null;
  }
}
