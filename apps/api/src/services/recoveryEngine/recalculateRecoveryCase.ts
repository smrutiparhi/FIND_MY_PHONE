import type { Pool } from 'pg';
import type {
  RecoveryActionId,
  RecoveryActionType,
  RecoveryCase,
  RecoveryCaseId,
  SensitiveAppType,
  SimAccessStatus,
  TriStateAnswer,
  UserId,
} from '@recoverai/shared';
import { createRepositories } from '../../db/repositories';
import { NotFoundError } from '../../lib/errors';
import { applyEngineResult } from './applyEngineResult';
import { deriveSensitiveAppFlags } from './sensitiveAppFlags';
import { evaluateRecoveryDecision } from './evaluateRecoveryDecision';
import { gatherEngineInputForExistingCase } from './gatherEngineInputForExistingCase';
import type { RecoveryEngineResult } from './types';

/**
 * A correction to one of the wizard's original answers - surfaced today only
 * by the Recovery Agent's `record_incident_details` tool (Part 7), so a user
 * telling the agent something the wizard got wrong or never asked (like "I
 * have UPI apps on it") actually changes the next evaluation, not just the
 * conversation. `addSensitiveApps` is additive (union with what's already on
 * file) since a chat message reports one more fact, not a replacement
 * checklist.
 */
export interface RecalculateRecoveryCaseOverrides {
  accountAccessStatus?: TriStateAnswer;
  simAccessStatus?: SimAccessStatus;
  screenLockEnabled?: TriStateAnswer;
  deviceFindingAvailable?: TriStateAnswer;
  addSensitiveApps?: SensitiveAppType[];
}

export interface RecalculateRecoveryCaseResult {
  recoveryCase: RecoveryCase;
  engineResult: RecoveryEngineResult;
  actionIdByType: Map<RecoveryActionType, RecoveryActionId>;
}

/**
 * Re-runs the Recovery Decision Engine against a case's current live state
 * and persists the outcome - the "recalculate whenever a recovery action
 * changes state" half of the master spec's Part 6 requirement. Runs in its
 * own transaction so a concurrent read never sees a partially-applied
 * result.
 */
export async function recalculateRecoveryCase(
  pool: Pool,
  userId: UserId,
  caseId: RecoveryCaseId,
  overrides?: RecalculateRecoveryCaseOverrides,
): Promise<RecalculateRecoveryCaseResult> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const repos = createRepositories(client);

    let recoveryCase = await repos.recoveryCases.findById(caseId, userId);
    if (!recoveryCase) throw new NotFoundError('Recovery case not found');
    const device = await repos.devices.findById(recoveryCase.deviceId, userId);
    if (!device) throw new NotFoundError('Device not found');

    if (overrides?.accountAccessStatus || overrides?.simAccessStatus) {
      const updated = await repos.recoveryCases.update(caseId, userId, {
        ...(overrides.accountAccessStatus ? { accountAccessStatus: overrides.accountAccessStatus } : {}),
        ...(overrides.simAccessStatus ? { simAccessStatus: overrides.simAccessStatus } : {}),
      });
      if (!updated) throw new NotFoundError('Recovery case not found');
      recoveryCase = updated;
    }

    const { input, existingDbActions, sensitiveApps } = await gatherEngineInputForExistingCase(repos, recoveryCase, device);

    if (overrides?.screenLockEnabled) input.screenLockStatus = overrides.screenLockEnabled;
    if (overrides?.deviceFindingAvailable) input.deviceFindingAvailability = overrides.deviceFindingAvailable;
    const effectiveSensitiveApps =
      overrides?.addSensitiveApps && overrides.addSensitiveApps.length > 0
        ? Array.from(new Set([...sensitiveApps, ...overrides.addSensitiveApps]))
        : sensitiveApps;
    Object.assign(input, deriveSensitiveAppFlags(effectiveSensitiveApps));

    const engineResult = evaluateRecoveryDecision(input);
    const { recoveryCase: updatedCase, actionIdByType } = await applyEngineResult(
      repos,
      userId,
      caseId,
      input,
      engineResult,
      existingDbActions,
      effectiveSensitiveApps,
    );

    await client.query('COMMIT');
    return { recoveryCase: updatedCase, engineResult, actionIdByType };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}
