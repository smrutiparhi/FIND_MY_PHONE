import type { Pool } from 'pg';
import type {
  CloseRecoveryCaseInput,
  DeviceRecoveryState,
  FinalCaseSummary,
  RecoveryCaseId,
  UpdateDeviceRecoveryChecklistInput,
  UserId,
} from '@recoverai/shared';
import { createRepositories } from '../../db/repositories';
import { NotFoundError, ValidationError } from '../../lib/errors';
import { recalculateRecoveryCase } from '../recoveryEngine/recalculateRecoveryCase';
import { toRecoveryPlan } from '../recoveryEngine/toRecoveryPlan';
import { buildFinalCaseSummary } from './buildFinalCaseSummary';

const UNRESOLVED_EXCLUDED_TYPES = new Set(['MONITOR']);
const RESOLVED_STATUSES = new Set(['COMPLETED', 'SKIPPED']);

async function loadState(pool: Pool, userId: UserId, caseId: RecoveryCaseId): Promise<DeviceRecoveryState> {
  const repos = createRepositories(pool);
  const checklist = await repos.deviceRecoveryChecklists.getOrCreateForCase(caseId);
  const { recoveryCase, engineResult, actionIdByType } = await recalculateRecoveryCase(pool, userId, caseId);
  const recoveryPlan = toRecoveryPlan(engineResult, actionIdByType);
  const unresolvedActions = recoveryPlan.orderedActions.filter(
    (a) => !RESOLVED_STATUSES.has(a.status) && !UNRESOLVED_EXCLUDED_TYPES.has(a.type),
  );

  return { checklist, recoveryCase, recoveryPlan, unresolvedActions };
}

/** Read-only aside from the same lazy getOrCreate + cheap recalculation every other GET in this app does. */
export async function getDeviceRecoveryState(pool: Pool, userId: UserId, caseId: RecoveryCaseId): Promise<DeviceRecoveryState> {
  const repos = createRepositories(pool);
  const recoveryCase = await repos.recoveryCases.findById(caseId, userId);
  if (!recoveryCase) throw new NotFoundError('Recovery case not found');
  return loadState(pool, userId, caseId);
}

/**
 * "When the user selects 'I found my phone', do not immediately close the
 * case" (master spec) - confirmed here means CONFIRM_POSSESSION entering
 * completedItems for the first time, which is the one moment that actually
 * changes state: recovery_cases.status moves to RECOVERED, a
 * DEVICE_RECOVERED timeline event is logged, and recoveredAt is stamped for
 * the final summary. Every other checklist item is pure bookkeeping - no
 * state change, since each already has its own dedicated flow elsewhere in
 * the app (SIM Protection, CEIR, ...) that this checklist only reminds the
 * user to go visit.
 */
export async function updateDeviceRecoveryChecklist(
  pool: Pool,
  userId: UserId,
  caseId: RecoveryCaseId,
  input: UpdateDeviceRecoveryChecklistInput,
): Promise<DeviceRecoveryState> {
  const repos = createRepositories(pool);
  const recoveryCase = await repos.recoveryCases.findById(caseId, userId);
  if (!recoveryCase) throw new NotFoundError('Recovery case not found');

  const existing = await repos.deviceRecoveryChecklists.getOrCreateForCase(caseId);
  const wasPossessionConfirmed = existing.completedItems.includes('CONFIRM_POSSESSION');
  const isPossessionConfirmed = (input.completedItems ?? existing.completedItems).includes('CONFIRM_POSSESSION');
  const firstConfirmation = !wasPossessionConfirmed && isPossessionConfirmed;

  const updated = await repos.deviceRecoveryChecklists.update(existing.id, userId, {
    ...(input.completedItems !== undefined ? { completedItems: input.completedItems } : {}),
    ...('notes' in input ? { notes: input.notes } : {}),
    ...(firstConfirmation ? { recoveredAt: new Date().toISOString() } : {}),
  });
  if (!updated) throw new NotFoundError('Device recovery checklist not found');

  if (firstConfirmation) {
    await repos.timelineEvents.create({
      caseId,
      type: 'DEVICE_RECOVERED',
      title: 'Device recovered',
      source: 'USER',
      verificationStatus: 'USER_REPORTED',
      createdByUserId: userId,
    });
    if (!['RECOVERED', 'CLOSED', 'ERASED'].includes(recoveryCase.status)) {
      await repos.recoveryCases.update(caseId, userId, { status: 'RECOVERED' });
    }
  }

  return loadState(pool, userId, caseId);
}

/**
 * "Allow the user to close the case only after reviewing unresolved
 * actions" - `confirmedUnresolvedActionsReviewed` must be explicitly true;
 * the frontend shows the unresolved-actions list right above the button
 * that sets it, the same "explicit confirmation" pattern as every other
 * consequential action in this app.
 */
export async function closeRecoveryCase(
  pool: Pool,
  userId: UserId,
  caseId: RecoveryCaseId,
  input: CloseRecoveryCaseInput,
): Promise<DeviceRecoveryState> {
  if (!input.confirmedUnresolvedActionsReviewed) {
    throw new ValidationError('You must confirm you have reviewed any unresolved actions before closing the case.');
  }

  const repos = createRepositories(pool);
  const recoveryCase = await repos.recoveryCases.findById(caseId, userId);
  if (!recoveryCase) throw new NotFoundError('Recovery case not found');

  const checklist = await repos.deviceRecoveryChecklists.getOrCreateForCase(caseId);
  const updated = await repos.deviceRecoveryChecklists.update(checklist.id, userId, {
    closedAt: new Date().toISOString(),
  });
  if (!updated) throw new NotFoundError('Device recovery checklist not found');

  await repos.recoveryCases.update(caseId, userId, { status: 'CLOSED' });
  await repos.timelineEvents.create({
    caseId,
    type: 'CASE_CLOSED',
    title: 'Case closed',
    source: 'USER',
    verificationStatus: 'USER_REPORTED',
    createdByUserId: userId,
  });

  return loadState(pool, userId, caseId);
}

export async function getFinalCaseSummary(pool: Pool, userId: UserId, caseId: RecoveryCaseId): Promise<FinalCaseSummary> {
  const repos = createRepositories(pool);
  const recoveryCase = await repos.recoveryCases.findById(caseId, userId);
  if (!recoveryCase) throw new NotFoundError('Recovery case not found');

  const [checklist, recoveryPlanResult, timelineEvents, locationObservations, policeReports, ceirRecord] = await Promise.all([
    repos.deviceRecoveryChecklists.getOrCreateForCase(caseId),
    recalculateRecoveryCase(pool, userId, caseId),
    repos.timelineEvents.listByCase(caseId, 'ASC'),
    repos.locationObservations.listByCase(caseId),
    repos.policeReports.listByCase(caseId),
    repos.ceirRecords.getOrCreateForCase(caseId),
  ]);

  return buildFinalCaseSummary({
    recoveryCase,
    checklist,
    recoveryPlan: toRecoveryPlan(recoveryPlanResult.engineResult, recoveryPlanResult.actionIdByType),
    timelineEvents,
    locationObservations,
    latestPoliceReport: policeReports[0] ?? null,
    ceirStatus: ceirRecord.status,
  });
}
