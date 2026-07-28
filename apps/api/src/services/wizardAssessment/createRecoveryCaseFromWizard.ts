import type { Pool } from 'pg';
import type { CreateRecoveryCaseWizardInput, RecoveryCase, UserId } from '@recoverai/shared';
import { createRepositories } from '../../db/repositories';
import { NotFoundError } from '../../lib/errors';
import { applyEngineResult } from '../recoveryEngine/applyEngineResult';
import { buildEngineInputForNewCase } from '../recoveryEngine/buildEngineInputForNewCase';
import { evaluateRecoveryDecision } from '../recoveryEngine/evaluateRecoveryDecision';

/**
 * Everything the incident wizard (Part 5) needs to happen atomically: create
 * (or reuse) the device, create the case, run the Recovery Decision Engine
 * (Part 6) against the wizard's answers, persist the resulting risk
 * assessment and ordered actions, wire up the first recommended action, and
 * record the opening timeline events - all in one transaction, so a failure
 * partway through never leaves an orphaned case with no assessment or
 * actions.
 */
export async function createRecoveryCaseFromWizard(
  pool: Pool,
  userId: UserId,
  input: CreateRecoveryCaseWizardInput,
): Promise<RecoveryCase> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const repos = createRepositories(client);

    const device =
      input.device.mode === 'existing'
        ? await repos.devices.findById(input.device.deviceId, userId)
        : await repos.devices.create({
            userId,
            nickname: input.device.nickname,
            manufacturer: input.device.manufacturer,
            model: input.device.model,
            platform: input.device.platform,
          });

    if (!device) {
      throw new NotFoundError('Device not found');
    }

    const recoveryCase = await repos.recoveryCases.create({
      userId,
      deviceId: device.id,
      incidentType: input.incidentType,
      lastSeenAt: input.lastSeenAt,
      lastSeenDescription: input.lastSeenDescription,
      accountAccessStatus: input.accountAccessStatus,
      simAccessStatus: input.simAccessStatus,
      locationCapability: input.deviceFindingAvailable,
    });

    const engineInput = buildEngineInputForNewCase(input, device.platform);
    const engineResult = evaluateRecoveryDecision(engineInput);
    const { recoveryCase: finalCase } = await applyEngineResult(repos, userId, recoveryCase.id, engineInput, engineResult, []);

    const incidentLabel =
      input.incidentType === 'STOLEN' ? 'Stolen' : input.incidentType === 'LOST' ? 'Lost' : 'Missing';
    await repos.timelineEvents.create({
      caseId: recoveryCase.id,
      type: 'CASE_CREATED',
      title: 'Case created',
      description: `${incidentLabel}-device case opened for ${device.nickname}.`,
      source: 'USER',
      verificationStatus: 'USER_REPORTED',
      createdByUserId: userId,
    });

    await client.query('COMMIT');
    return finalCase;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}
