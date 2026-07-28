import type { Pool } from 'pg';
import type { CreateRecoveryCaseWizardInput, RecoveryAction, RecoveryActionId, RecoveryActionType, RecoveryCase, UserId } from '@recoverai/shared';
import { createRepositories } from '../../db/repositories';
import { NotFoundError } from '../../lib/errors';
import { computeInitialAssessment } from './computeInitialAssessment';

/**
 * Everything the incident wizard (Part 5) needs to happen atomically: create
 * (or reuse) the device, create the case, run the initial risk/action
 * calculation, persist it, wire up the first recommended action, and record
 * the opening timeline events - all in one transaction, so a failure partway
 * through never leaves an orphaned case with no assessment or actions.
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

    const assessment = computeInitialAssessment({
      incidentType: input.incidentType,
      platform: device.platform,
      accountAccessStatus: input.accountAccessStatus,
      simAccessStatus: input.simAccessStatus,
      screenLockEnabled: input.screenLockEnabled,
      sensitiveApps: input.sensitiveApps,
      deviceFindingAvailable: input.deviceFindingAvailable,
    });

    await repos.incidentAssessments.create({
      caseId: recoveryCase.id,
      screenLockEnabled: input.screenLockEnabled,
      sensitiveApps: input.sensitiveApps,
      deviceFindingAvailable: input.deviceFindingAvailable,
      riskLevel: assessment.riskLevel,
      riskReasons: assessment.riskReasons,
    });

    const createdIdByType = new Map<RecoveryActionType, RecoveryActionId>();
    let firstAction: RecoveryAction | undefined;
    for (const proposed of assessment.actions) {
      const dependsOnActionIds = (proposed.dependsOnTypes ?? [])
        .map((type) => createdIdByType.get(type))
        .filter((id): id is RecoveryActionId => id !== undefined);

      const created = await repos.recoveryActions.create({
        caseId: recoveryCase.id,
        type: proposed.type,
        priority: proposed.priority,
        title: proposed.title,
        reason: proposed.reason,
        instructions: proposed.instructions,
        officialExternalAction: proposed.officialExternalAction ?? null,
        dependsOnActionIds,
      });
      createdIdByType.set(proposed.type, created.id);
      if (!firstAction) firstAction = created;
    }

    await repos.recoveryCases.update(recoveryCase.id, userId, { riskLevel: assessment.riskLevel });
    const finalCase = firstAction
      ? await repos.recoveryCases.setCurrentRecommendedAction(recoveryCase.id, userId, firstAction.id)
      : await repos.recoveryCases.findById(recoveryCase.id, userId);

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
    await repos.timelineEvents.create({
      caseId: recoveryCase.id,
      type: 'RISK_ASSESSED',
      title: `Risk assessed as ${assessment.riskLevel}`,
      source: 'SYSTEM',
      verificationStatus: 'SYSTEM_VERIFIED',
    });

    await client.query('COMMIT');

    if (!finalCase) throw new Error('Recovery case vanished immediately after creation');
    return finalCase;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}
