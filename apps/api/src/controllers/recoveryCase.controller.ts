import type { Request, Response } from 'express';
import type { ApiSuccessResponse, DashboardCaseSummary } from '@recoverai/shared';
import { getRepos } from '../db/repos';
import { UnauthorizedError } from '../lib/errors';

export async function listMyCases(
  req: Request,
  res: Response<ApiSuccessResponse<DashboardCaseSummary[]>>,
): Promise<void> {
  if (!req.user) throw new UnauthorizedError();
  const summaries = await getRepos().recoveryCases.listDashboardSummariesByUser(req.user.id);
  res.status(200).json({ success: true, data: summaries });
}
