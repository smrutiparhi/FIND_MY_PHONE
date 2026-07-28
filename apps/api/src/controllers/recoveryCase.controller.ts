import type { Request, Response } from 'express';
import type { ApiSuccessResponse, CreateRecoveryCaseWizardInput, DashboardCaseSummary, RecoveryCase } from '@recoverai/shared';
import { getRepos } from '../db/repos';
import { getPool } from '../db/pool';
import { UnauthorizedError } from '../lib/errors';
import { createRecoveryCaseFromWizard } from '../services/wizardAssessment/createRecoveryCaseFromWizard';

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
