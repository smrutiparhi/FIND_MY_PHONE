import type { Pool } from 'pg';
import type { AccountRecoveryState, RecoveryCaseId, UpdateAccountRecoveryAttemptInput, UserId } from '@recoverai/shared';
import { createRepositories } from '../../db/repositories';
import { NotFoundError } from '../../lib/errors';
import { recalculateRecoveryCase } from '../recoveryEngine/recalculateRecoveryCase';
import { toRecoveryPlan } from '../recoveryEngine/toRecoveryPlan';
import { generateAccountRecoveryPath } from './generateAccountRecoveryPath';

async function loadState(pool: Pool, userId: UserId, caseId: RecoveryCaseId): Promise<AccountRecoveryState> {
  const repos = createRepositories(pool);
  const recoveryCase = await repos.recoveryCases.findById(caseId, userId);
  if (!recoveryCase) throw new NotFoundError('Recovery case not found');
  const device = await repos.devices.findById(recoveryCase.deviceId, userId);
  if (!device) throw new NotFoundError('Device not found');

  const attempt = await repos.accountRecoveryAttempts.getOrCreateForCase(caseId);
  const steps = generateAccountRecoveryPath(device.platform, attempt.availableSignals);
  const { engineResult, actionIdByType } = await recalculateRecoveryCase(pool, userId, caseId);

  return { attempt, steps, recoveryCase, recoveryPlan: toRecoveryPlan(engineResult, actionIdByType) };
}

/** Read-only (aside from the same lazy getOrCreate + cheap recalculation every other GET in this app does - see Part 8's location endpoints). */
export async function getAccountRecoveryState(pool: Pool, userId: UserId, caseId: RecoveryCaseId): Promise<AccountRecoveryState> {
  return loadState(pool, userId, caseId);
}

/**
 * Applies a checklist/status/notes update, then - only when the new status
 * is RECOVERED - does what the master spec explicitly requires: "When
 * account access is restored, recalculate the Recovery Decision Engine and
 * continue the case." That means completing the case's ACCOUNT_RECOVERY
 * action (if one exists - it usually does, since this mode is only relevant
 * when the engine already generated one) *and* persisting
 * accountAccessStatus='YES' via recalculateRecoveryCase's overrides, so the
 * engine sees the correction even on a case where no such action exists.
 */
export async function updateAccountRecoveryAttempt(
  pool: Pool,
  userId: UserId,
  caseId: RecoveryCaseId,
  input: UpdateAccountRecoveryAttemptInput,
): Promise<AccountRecoveryState> {
  const repos = createRepositories(pool);
  const recoveryCase = await repos.recoveryCases.findById(caseId, userId);
  if (!recoveryCase) throw new NotFoundError('Recovery case not found');
  const device = await repos.devices.findById(recoveryCase.deviceId, userId);
  if (!device) throw new NotFoundError('Device not found');

  const existing = await repos.accountRecoveryAttempts.getOrCreateForCase(caseId);
  const wasNotStarted = existing.status === 'NOT_STARTED';

  const updated = await repos.accountRecoveryAttempts.update(existing.id, userId, {
    status: input.status,
    availableSignals: input.availableSignals,
    notes: 'notes' in input ? input.notes : undefined,
  });
  if (!updated) throw new NotFoundError('Account recovery attempt not found');

  if (wasNotStarted && updated.status !== 'NOT_STARTED') {
    await repos.timelineEvents.create({
      caseId,
      type: 'ACCOUNT_RECOVERY_STARTED',
      title: 'Account recovery started',
      source: 'USER',
      verificationStatus: 'USER_REPORTED',
      createdByUserId: userId,
    });
  }

  if (updated.status === 'RECOVERED') {
    const actions = await repos.recoveryActions.listByCase(caseId);
    const accountRecoveryAction = actions.find((a) => a.type === 'ACCOUNT_RECOVERY');
    if (accountRecoveryAction && accountRecoveryAction.status !== 'COMPLETED') {
      await repos.recoveryActions.updateStatus(accountRecoveryAction.id, userId, 'COMPLETED');
    }
    await repos.timelineEvents.create({
      caseId,
      type: 'ACCOUNT_RECOVERY_COMPLETED',
      title: 'Account access restored',
      source: 'USER',
      verificationStatus: 'USER_REPORTED',
      recoveryActionId: accountRecoveryAction?.id ?? null,
      createdByUserId: userId,
    });
  } else if (input.status === 'WAITING' || input.status === 'FAILED') {
    await repos.timelineEvents.create({
      caseId,
      type: 'USER_NOTE',
      title: `Account recovery marked ${input.status.toLowerCase()}`,
      source: 'USER',
      verificationStatus: 'USER_REPORTED',
      createdByUserId: userId,
    });
  }

  const steps = generateAccountRecoveryPath(device.platform, updated.availableSignals);
  const { recoveryCase: finalCase, engineResult, actionIdByType } = await recalculateRecoveryCase(
    pool,
    userId,
    caseId,
    updated.status === 'RECOVERED' ? { accountAccessStatus: 'YES' } : undefined,
  );

  return { attempt: updated, steps, recoveryCase: finalCase, recoveryPlan: toRecoveryPlan(engineResult, actionIdByType) };
}
