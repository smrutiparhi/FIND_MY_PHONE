import type { Request, Response } from 'express';
import type {
  ApiSuccessResponse,
  CreateRecoveryCaseWizardInput,
  DashboardCaseSummary,
  RecoveryActionId,
  RecoveryCase,
  RecoveryCaseId,
  RecoveryPlan,
  SendAgentMessageInput,
  SendAgentMessageResult,
  UpdateRecoveryActionStatusInput,
  UpdateRecoveryActionStatusResult,
  UserId,
} from '@recoverai/shared';
import { getRepos } from '../db/repos';
import { getPool } from '../db/pool';
import { NotFoundError, UnauthorizedError } from '../lib/errors';
import { createRecoveryCaseFromWizard } from '../services/wizardAssessment/createRecoveryCaseFromWizard';
import { recalculateRecoveryCase } from '../services/recoveryEngine/recalculateRecoveryCase';
import { toRecoveryPlan } from '../services/recoveryEngine/toRecoveryPlan';
import { runAgentTurn } from '../services/recoveryAgent/runAgentTurn';

export async function listMyCases(
  req: Request,
  res: Response<ApiSuccessResponse<DashboardCaseSummary[]>>,
): Promise<void> {
  if (!req.user) throw new UnauthorizedError();
  const summaries = await getRepos().recoveryCases.listDashboardSummariesByUser(req.user.id);
  res.status(200).json({ success: true, data: summaries });
}

export async function getCase(
  req: Request<{ caseId: string }>,
  res: Response<ApiSuccessResponse<RecoveryCase>>,
): Promise<void> {
  if (!req.user) throw new UnauthorizedError();
  const caseId = req.params.caseId as RecoveryCaseId;
  const recoveryCase = await getRepos().recoveryCases.findById(caseId, req.user.id);
  if (!recoveryCase) throw new NotFoundError('Recovery case not found');
  res.status(200).json({ success: true, data: recoveryCase });
}

export async function createCase(
  req: Request<Record<string, string>, unknown, CreateRecoveryCaseWizardInput>,
  res: Response<ApiSuccessResponse<RecoveryCase>>,
): Promise<void> {
  if (!req.user) throw new UnauthorizedError();
  const pool = getPool();
  if (!pool) throw new Error('DATABASE_URL must be configured to create a recovery case.');

  const recoveryCase = await createRecoveryCaseFromWizard(pool, req.user.id, req.body);
  res.status(201).json({ success: true, data: recoveryCase });
}

/**
 * Recalculates and persists before responding (not a pure read) so that
 * every action in the returned plan - including one that only just became
 * relevant - always has a real id the client can act on. Cheap to repeat:
 * with no state change since the last call, this is a no-op write.
 */
export async function getRecoveryPlan(
  req: Request<{ caseId: string }>,
  res: Response<ApiSuccessResponse<RecoveryPlan>>,
): Promise<void> {
  if (!req.user) throw new UnauthorizedError();
  const pool = getPool();
  if (!pool) throw new Error('DATABASE_URL must be configured to compute a recovery plan.');

  const caseId = req.params.caseId as RecoveryCaseId;
  const { engineResult, actionIdByType } = await recalculateRecoveryCase(pool, req.user.id, caseId);
  res.status(200).json({ success: true, data: toRecoveryPlan(engineResult, actionIdByType) });
}

/**
 * LOCATE_DEVICE and SECURE_DEVICE have no dedicated flow anywhere else in
 * the app (unlike SIM_PROTECTION/ACCOUNT_RECOVERY/... which each log their
 * own timeline events from their own service) - this generic status-change
 * endpoint is the only place either one is ever actually completed, so it's
 * the only place Part 16's "device-finding workflow opened" / "device
 * secured" automatic events can be logged from. Gated on the specific
 * transition (not just "this type, any status") so a redundant PATCH to the
 * same status never double-logs.
 */
async function maybeLogAutomaticActionEvent(
  caseId: RecoveryCaseId,
  actionId: RecoveryActionId,
  previousStatus: string,
  action: { type: string },
  newStatus: string,
  userId: UserId,
): Promise<void> {
  if (previousStatus === newStatus) return;

  if (action.type === 'LOCATE_DEVICE' && newStatus === 'IN_PROGRESS') {
    await getRepos().timelineEvents.create({
      caseId,
      type: 'DEVICE_FINDING_OPENED',
      title: 'Device-finding workflow opened',
      source: 'USER',
      verificationStatus: 'USER_REPORTED',
      recoveryActionId: actionId,
      createdByUserId: userId,
    });
    return;
  }

  if (action.type === 'SECURE_DEVICE' && newStatus === 'COMPLETED') {
    await getRepos().timelineEvents.create({
      caseId,
      type: 'DEVICE_SECURED',
      title: 'Device secured',
      source: 'USER',
      verificationStatus: 'USER_REPORTED',
      recoveryActionId: actionId,
      createdByUserId: userId,
    });
  }
}

export async function updateActionStatus(
  req: Request<{ caseId: string; actionId: string }, unknown, UpdateRecoveryActionStatusInput>,
  res: Response<ApiSuccessResponse<UpdateRecoveryActionStatusResult>>,
): Promise<void> {
  if (!req.user) throw new UnauthorizedError();
  const pool = getPool();
  if (!pool) throw new Error('DATABASE_URL must be configured to update a recovery action.');

  const caseId = req.params.caseId as RecoveryCaseId;
  const actionId = req.params.actionId as RecoveryActionId;

  const existingAction = await getRepos().recoveryActions.findByIdForUser(actionId, req.user.id);
  if (!existingAction || existingAction.caseId !== caseId) {
    throw new NotFoundError('Recovery action not found');
  }

  await getRepos().recoveryActions.updateStatus(actionId, req.user.id, req.body.status);
  await maybeLogAutomaticActionEvent(caseId, actionId, existingAction.status, existingAction, req.body.status, req.user.id);
  const { recoveryCase, engineResult, actionIdByType } = await recalculateRecoveryCase(pool, req.user.id, caseId);
  res.status(200).json({ success: true, data: { recoveryCase, recoveryPlan: toRecoveryPlan(engineResult, actionIdByType) } });
}

/**
 * Ownership is enforced the same way every other case-scoped write is: the
 * case lookup inside runAgentTurn/recalculateRecoveryCase is scoped by
 * req.user.id, so a caseId belonging to another user resolves to
 * NotFoundError rather than leaking whether it exists (IDOR prevention, see
 * docs/DATABASE.md) - never checked separately here.
 */
export async function sendAgentMessage(
  req: Request<{ caseId: string }, unknown, SendAgentMessageInput>,
  res: Response<ApiSuccessResponse<SendAgentMessageResult>>,
): Promise<void> {
  if (!req.user) throw new UnauthorizedError();
  const pool = getPool();
  if (!pool) throw new Error('DATABASE_URL must be configured to use the Recovery Agent.');

  const caseId = req.params.caseId as RecoveryCaseId;
  const result = await runAgentTurn(pool, req.user.id, caseId, req.body.messages);
  res.status(200).json({ success: true, data: result });
}
