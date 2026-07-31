import type { Request, Response } from 'express';
import type { ApiSuccessResponse, RecoveryCaseId, SimProtectionState, UpdateSimProtectionRecordInput } from '@recoverai/shared';
import { getPool } from '../db/pool';
import { UnauthorizedError } from '../lib/errors';
import { getSimProtectionState, updateSimProtectionRecord } from '../services/simProtection/updateSimProtectionRecord';

export async function getSimProtection(
  req: Request<{ caseId: string }>,
  res: Response<ApiSuccessResponse<SimProtectionState>>,
): Promise<void> {
  if (!req.user) throw new UnauthorizedError();
  const pool = getPool();
  if (!pool) throw new Error('DATABASE_URL must be configured to use the SIM/eSIM Protection Center.');

  const caseId = req.params.caseId as RecoveryCaseId;
  const state = await getSimProtectionState(pool, req.user.id, caseId);
  res.status(200).json({ success: true, data: state });
}

export async function patchSimProtection(
  req: Request<{ caseId: string }, unknown, UpdateSimProtectionRecordInput>,
  res: Response<ApiSuccessResponse<SimProtectionState>>,
): Promise<void> {
  if (!req.user) throw new UnauthorizedError();
  const pool = getPool();
  if (!pool) throw new Error('DATABASE_URL must be configured to use the SIM/eSIM Protection Center.');

  const caseId = req.params.caseId as RecoveryCaseId;
  const state = await updateSimProtectionRecord(pool, req.user.id, caseId, req.body);
  res.status(200).json({ success: true, data: state });
}
