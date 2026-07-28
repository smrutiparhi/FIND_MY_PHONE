import type { Request, Response } from 'express';
import type {
  ApiSuccessResponse,
  CreateRecoveryCaseWizardInput,
  DashboardCaseSummary,
  RecoveryActionId,
  RecoveryCase,
  RecoveryCaseId,
  RecoveryPlan,
  UpdateRecoveryActionStatusInput,
  UpdateRecoveryActionStatusResult,
} from '@recoverai/shared';
import { getRepos } from '../db/repos';
import { getPool } from '../db/pool';
import { NotFoundError, UnauthorizedError } from '../lib/errors';
import { createRecoveryCaseFromWizard } from '../services/wizardAssessment/createRecoveryCaseFromWizard';
import { recalculateRecoveryCase } from '../services/recoveryEngine/recalculateRecoveryCase';
import { toRecoveryPlan } from '../services/recoveryEngine/toRecoveryPlan';

export async function listMyCases(
  req: Request,
  res: Response<ApiSuccessResponse<DashboardCaseSummary[]>>,
): Promise<void> {
  if (!req.user) throw new UnauthorizedError();
  const summaries = await getRepos().recoveryCases.listDashboardSummariesByUser(req.user.id);
  res.status(200).json({ success: true, data: summaries });
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
  const { recoveryCase, engineResult, actionIdByType } = await recalculateRecoveryCase(pool, req.user.id, caseId);
  res.status(200).json({ success: true, data: { recoveryCase, recoveryPlan: toRecoveryPlan(engineResult, actionIdByType) } });
}
