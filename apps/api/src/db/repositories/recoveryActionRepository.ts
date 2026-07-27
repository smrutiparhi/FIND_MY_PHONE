import type {
  OfficialExternalAction,
  RecoveryAction,
  RecoveryActionId,
  RecoveryActionStatus,
  RecoveryActionType,
  RecoveryCaseId,
  UserId,
} from '@recoverai/shared';
import type { Queryable } from '../queryable';

interface RecoveryActionRow {
  id: string;
  case_id: string;
  type: RecoveryActionType;
  priority: number;
  title: string;
  reason: string;
  instructions: string;
  status: RecoveryActionStatus;
  official_external_action: OfficialExternalAction | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
  completed_at: string | null;
}

function toRecoveryAction(
  row: RecoveryActionRow,
  dependsOnActionIds: RecoveryActionId[],
): RecoveryAction {
  return {
    id: row.id as RecoveryActionId,
    caseId: row.case_id as RecoveryCaseId,
    type: row.type,
    priority: row.priority,
    title: row.title,
    reason: row.reason,
    instructions: row.instructions,
    status: row.status,
    dependsOnActionIds,
    officialExternalAction: row.official_external_action,
    metadata: row.metadata,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    completedAt: row.completed_at,
  };
}

export interface CreateRecoveryActionInput {
  caseId: RecoveryCaseId;
  type: RecoveryActionType;
  priority: number;
  title: string;
  reason: string;
  instructions: string;
  status?: RecoveryActionStatus;
  dependsOnActionIds?: RecoveryActionId[];
  officialExternalAction?: OfficialExternalAction | null;
  metadata?: Record<string, unknown> | null;
}

/**
 * The generic unit the Recovery Decision Engine (Part 6) sequences - see
 * 0007_recovery_actions.sql. Dependencies are stored in a self-referential
 * join table rather than a JSON array so referential integrity is enforced
 * by the database; this repository hides that behind a plain
 * `dependsOnActionIds` array on the returned domain object.
 */
export class RecoveryActionRepository {
  constructor(private readonly db: Queryable) {}

  private async fetchDependencies(actionIds: string[]): Promise<Map<string, RecoveryActionId[]>> {
    if (actionIds.length === 0) return new Map();
    const result = await this.db.query<{ action_id: string; depends_on_action_id: string }>(
      'SELECT action_id, depends_on_action_id FROM recovery_action_dependencies WHERE action_id = ANY($1::uuid[])',
      [actionIds],
    );
    const map = new Map<string, RecoveryActionId[]>();
    for (const row of result.rows) {
      const list = map.get(row.action_id) ?? [];
      list.push(row.depends_on_action_id as RecoveryActionId);
      map.set(row.action_id, list);
    }
    return map;
  }

  async create(input: CreateRecoveryActionInput): Promise<RecoveryAction> {
    const result = await this.db.query<RecoveryActionRow>(
      `INSERT INTO recovery_actions
         (case_id, type, priority, title, reason, instructions, status, official_external_action, metadata)
       VALUES ($1, $2, $3, $4, $5, $6, COALESCE($7::recovery_action_status, 'PENDING'), $8, $9)
       RETURNING *`,
      [
        input.caseId,
        input.type,
        input.priority,
        input.title,
        input.reason,
        input.instructions,
        input.status ?? null,
        input.officialExternalAction ?? null,
        input.metadata ?? null,
      ],
    );
    const row = result.rows[0];
    if (!row) throw new Error('Insert into recovery_actions returned no row');

    const dependsOn = input.dependsOnActionIds ?? [];
    for (const dependsOnActionId of dependsOn) {
      await this.db.query(
        'INSERT INTO recovery_action_dependencies (action_id, depends_on_action_id) VALUES ($1, $2)',
        [row.id, dependsOnActionId],
      );
    }

    return toRecoveryAction(row, dependsOn);
  }

  async findById(id: RecoveryActionId): Promise<RecoveryAction | null> {
    const result = await this.db.query<RecoveryActionRow>(
      'SELECT * FROM recovery_actions WHERE id = $1',
      [id],
    );
    const row = result.rows[0];
    if (!row) return null;
    const dependencies = await this.fetchDependencies([row.id]);
    return toRecoveryAction(row, dependencies.get(row.id) ?? []);
  }

  /** Ownership-scoped via a join to recovery_cases - defense in depth for direct action-by-id routes (Parts 9-12). */
  async findByIdForUser(id: RecoveryActionId, ownerUserId: UserId): Promise<RecoveryAction | null> {
    const result = await this.db.query<RecoveryActionRow>(
      `SELECT ra.* FROM recovery_actions ra
       JOIN recovery_cases rc ON rc.id = ra.case_id
       WHERE ra.id = $1 AND rc.user_id = $2`,
      [id, ownerUserId],
    );
    const row = result.rows[0];
    if (!row) return null;
    const dependencies = await this.fetchDependencies([row.id]);
    return toRecoveryAction(row, dependencies.get(row.id) ?? []);
  }

  async listByCase(caseId: RecoveryCaseId): Promise<RecoveryAction[]> {
    const result = await this.db.query<RecoveryActionRow>(
      'SELECT * FROM recovery_actions WHERE case_id = $1 ORDER BY priority ASC',
      [caseId],
    );
    const dependencies = await this.fetchDependencies(result.rows.map((row) => row.id));
    return result.rows.map((row) => toRecoveryAction(row, dependencies.get(row.id) ?? []));
  }

  async updateStatus(
    id: RecoveryActionId,
    ownerUserId: UserId,
    status: RecoveryActionStatus,
  ): Promise<RecoveryAction | null> {
    const result = await this.db.query<RecoveryActionRow>(
      `UPDATE recovery_actions ra SET
         status = $3::recovery_action_status,
         completed_at = CASE WHEN $3::recovery_action_status = 'COMPLETED' THEN now() ELSE ra.completed_at END
       FROM recovery_cases rc
       WHERE ra.id = $1 AND ra.case_id = rc.id AND rc.user_id = $2
       RETURNING ra.*`,
      [id, ownerUserId, status],
    );
    const row = result.rows[0];
    if (!row) return null;
    const dependencies = await this.fetchDependencies([row.id]);
    return toRecoveryAction(row, dependencies.get(row.id) ?? []);
  }
}
