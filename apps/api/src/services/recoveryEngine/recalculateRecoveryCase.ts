import type { Pool } from 'pg';
import type { RecoveryActionId, RecoveryActionType, RecoveryCase, RecoveryCaseId, UserId } from '@recoverai/shared';
import { createRepositories } from '../../db/repositories';
import { NotFoundError } from '../../lib/errors';
import { applyEngineResult } from './applyEngineResult';
import { evaluateRecoveryDecision } from './evaluateRecoveryDecision';
import { gatherEngineInputForExistingCase } from './gatherEngineInputForExistingCase';
import type { RecoveryEngineResult } from './types';

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
): Promise<RecalculateRecoveryCaseResult> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const repos = createRepositories(client);

    const recoveryCase = await repos.recoveryCases.findById(caseId, userId);
    if (!recoveryCase) throw new NotFoundError('Recovery case not found');
    const device = await repos.devices.findById(recoveryCase.deviceId, userId);
    if (!device) throw new NotFoundError('Device not found');

    const { input, existingDbActions } = await gatherEngineInputForExistingCase(repos, recoveryCase, device);
    const engineResult = evaluateRecoveryDecision(input);
    const { recoveryCase: updatedCase, actionIdByType } = await applyEngineResult(
      repos,
      userId,
      caseId,
      input,
      engineResult,
      existingDbActions,
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
