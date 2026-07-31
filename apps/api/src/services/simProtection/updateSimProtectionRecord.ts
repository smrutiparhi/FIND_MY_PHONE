import type { Pool } from 'pg';
import type { RecoveryCaseId, SimProtectionState, UpdateSimProtectionRecordInput, UserId } from '@recoverai/shared';
import { createRepositories } from '../../db/repositories';
import { NotFoundError } from '../../lib/errors';
import { recalculateRecoveryCase } from '../recoveryEngine/recalculateRecoveryCase';
import { toRecoveryPlan } from '../recoveryEngine/toRecoveryPlan';
import { findCarrierGuide } from './carrierDirectory';
import { generateSimGuidance } from './generateSimGuidance';

const SECURED_STATUSES = new Set(['BLOCKED', 'REPLACED']);

async function loadState(pool: Pool, userId: UserId, caseId: RecoveryCaseId): Promise<SimProtectionState> {
  const repos = createRepositories(pool);
  const recoveryCase = await repos.recoveryCases.findById(caseId, userId);
  if (!recoveryCase) throw new NotFoundError('Recovery case not found');
  const device = await repos.devices.findById(recoveryCase.deviceId, userId);
  if (!device) throw new NotFoundError('Device not found');

  const record = await repos.simProtectionRecords.getOrCreateForCase(caseId);
  const carrierGuide = findCarrierGuide(device.carrier);
  const guidanceSections = generateSimGuidance({ simType: device.simType, incidentType: recoveryCase.incidentType });
  const { engineResult, actionIdByType } = await recalculateRecoveryCase(pool, userId, caseId);

  return { record, carrierGuide, guidanceSections, recoveryCase, recoveryPlan: toRecoveryPlan(engineResult, actionIdByType) };
}

/** Read-only aside from the same lazy getOrCreate + cheap recalculation every other GET in this app does. */
export async function getSimProtectionState(pool: Pool, userId: UserId, caseId: RecoveryCaseId): Promise<SimProtectionState> {
  return loadState(pool, userId, caseId);
}

/**
 * "When status changes, create TimelineEvent and recalculate the Recovery
 * Decision Engine" (master spec, verbatim). BLOCKED and REPLACED both mean
 * the original SIM is no longer usable by anyone else - either one
 * completes the case's SIM_PROTECTION action and persists
 * simAccessStatus='SIM_ALREADY_BLOCKED' via recalculateRecoveryCase's
 * overrides (the same mechanism Part 7's Recovery Agent and Part 9's
 * account-recovery flow use), so simSecured flips for the next evaluation
 * even on a case where no SIM_PROTECTION action exists to complete.
 */
export async function updateSimProtectionRecord(
  pool: Pool,
  userId: UserId,
  caseId: RecoveryCaseId,
  input: UpdateSimProtectionRecordInput,
): Promise<SimProtectionState> {
  const repos = createRepositories(pool);
  const recoveryCase = await repos.recoveryCases.findById(caseId, userId);
  if (!recoveryCase) throw new NotFoundError('Recovery case not found');
  const device = await repos.devices.findById(recoveryCase.deviceId, userId);
  if (!device) throw new NotFoundError('Device not found');

  const existing = await repos.simProtectionRecords.getOrCreateForCase(caseId);
  const wasActive = existing.status === 'ACTIVE';

  const updated = await repos.simProtectionRecords.update(existing.id, userId, {
    status: input.status,
    notes: 'notes' in input ? input.notes : undefined,
  });
  if (!updated) throw new NotFoundError('SIM protection record not found');

  if (wasActive && updated.status !== 'ACTIVE') {
    await repos.timelineEvents.create({
      caseId,
      type: 'SIM_PROTECTION_STARTED',
      title: 'SIM protection started',
      source: 'USER',
      verificationStatus: 'USER_REPORTED',
      createdByUserId: userId,
    });
  }

  const nowSecured = SECURED_STATUSES.has(updated.status);
  if (nowSecured) {
    const actions = await repos.recoveryActions.listByCase(caseId);
    const simAction = actions.find((a) => a.type === 'SIM_PROTECTION');
    if (simAction && simAction.status !== 'COMPLETED') {
      await repos.recoveryActions.updateStatus(simAction.id, userId, 'COMPLETED');
    }
    await repos.timelineEvents.create({
      caseId,
      type: 'SIM_PROTECTION_COMPLETED',
      title: updated.status === 'REPLACED' ? 'SIM replaced' : 'SIM blocked by carrier',
      source: 'USER',
      verificationStatus: 'USER_REPORTED',
      recoveryActionId: simAction?.id ?? null,
      createdByUserId: userId,
    });
  } else if (input.status && input.status !== 'BLOCK_REQUESTED') {
    await repos.timelineEvents.create({
      caseId,
      type: 'USER_NOTE',
      title: `SIM status updated to ${input.status.toLowerCase().replace('_', ' ')}`,
      source: 'USER',
      verificationStatus: 'USER_REPORTED',
    });
  }

  const carrierGuide = findCarrierGuide(device.carrier);
  const guidanceSections = generateSimGuidance({ simType: device.simType, incidentType: recoveryCase.incidentType });
  const { recoveryCase: finalCase, engineResult, actionIdByType } = await recalculateRecoveryCase(
    pool,
    userId,
    caseId,
    nowSecured ? { simAccessStatus: 'SIM_ALREADY_BLOCKED' } : undefined,
  );

  return {
    record: updated,
    carrierGuide,
    guidanceSections,
    recoveryCase: finalCase,
    recoveryPlan: toRecoveryPlan(engineResult, actionIdByType),
  };
}
