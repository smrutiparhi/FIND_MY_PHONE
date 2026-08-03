import type { Request, Response } from 'express';
import type { AdvanceDemoInput, ApiSuccessResponse, DemoState, RecoveryCaseId } from '@recoverai/shared';
import { getPool } from '../db/pool';
import { UnauthorizedError } from '../lib/errors';
import { advanceDemoCase, getDemoState, resetDemoCase, startOrResumeDemoCase } from '../services/demo/demoService';

function requirePool() {
  const pool = getPool();
  if (!pool) throw new Error('DATABASE_URL must be configured to use Demo Mode.');
  return pool;
}

export async function postStartDemo(req: Request, res: Response<ApiSuccessResponse<DemoState>>): Promise<void> {
  if (!req.user) throw new UnauthorizedError();
  const state = await startOrResumeDemoCase(requirePool(), req.user.id);
  res.status(200).json({ success: true, data: state });
}

export async function getDemo(
  req: Request<{ caseId: string }>,
  res: Response<ApiSuccessResponse<DemoState>>,
): Promise<void> {
  if (!req.user) throw new UnauthorizedError();
  const caseId = req.params.caseId as RecoveryCaseId;
  const state = await getDemoState(requirePool(), req.user.id, caseId);
  res.status(200).json({ success: true, data: state });
}

export async function postAdvanceDemo(
  req: Request<{ caseId: string }, unknown, AdvanceDemoInput>,
  res: Response<ApiSuccessResponse<DemoState>>,
): Promise<void> {
  if (!req.user) throw new UnauthorizedError();
  const caseId = req.params.caseId as RecoveryCaseId;
  const state = await advanceDemoCase(requirePool(), req.user.id, caseId, req.body.stage);
  res.status(200).json({ success: true, data: state });
}

export async function deleteDemo(req: Request<{ caseId: string }>, res: Response): Promise<void> {
  if (!req.user) throw new UnauthorizedError();
  const caseId = req.params.caseId as RecoveryCaseId;
  await resetDemoCase(requirePool(), req.user.id, caseId);
  res.status(204).send();
}
