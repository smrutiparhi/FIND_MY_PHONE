import type { Request, Response } from 'express';
import type { AccountRecoveryState, ApiSuccessResponse, RecoveryCaseId, UpdateAccountRecoveryAttemptInput } from '@recoverai/shared';
import { getPool } from '../db/pool';
import { UnauthorizedError } from '../lib/errors';
import { getAccountRecoveryState, updateAccountRecoveryAttempt } from '../services/accountRecovery/updateAccountRecoveryAttempt';

export async function getAccountRecovery(
  req: Request<{ caseId: string }>,
  res: Response<ApiSuccessResponse<AccountRecoveryState>>,
): Promise<void> {
  if (!req.user) throw new UnauthorizedError();
  const pool = getPool();
  if (!pool) throw new Error('DATABASE_URL must be configured to use Account Recovery Mode.');

  const caseId = req.params.caseId as RecoveryCaseId;
  const state = await getAccountRecoveryState(pool, req.user.id, caseId);
  res.status(200).json({ success: true, data: state });
}

export async function patchAccountRecovery(
  req: Request<{ caseId: string }, unknown, UpdateAccountRecoveryAttemptInput>,
  res: Response<ApiSuccessResponse<AccountRecoveryState>>,
): Promise<void> {
  if (!req.user) throw new UnauthorizedError();
  const pool = getPool();
  if (!pool) throw new Error('DATABASE_URL must be configured to use Account Recovery Mode.');

  const caseId = req.params.caseId as RecoveryCaseId;
  const state = await updateAccountRecoveryAttempt(pool, req.user.id, caseId, req.body);
  res.status(200).json({ success: true, data: state });
}
