import type { Request, Response } from 'express';
import type { ApiSuccessResponse, EmergencyModeResult, RecoveryCaseId } from '@recoverai/shared';
import { getPool } from '../db/pool';
import { UnauthorizedError } from '../lib/errors';
import { getEmergencyModeForCase } from '../services/emergencyMode/getEmergencyModeForCase';

export async function getEmergencyMode(
  req: Request<{ caseId: string }>,
  res: Response<ApiSuccessResponse<EmergencyModeResult>>,
): Promise<void> {
  if (!req.user) throw new UnauthorizedError();
  const pool = getPool();
  if (!pool) throw new Error('DATABASE_URL must be configured to use Emergency Recovery Mode.');

  const caseId = req.params.caseId as RecoveryCaseId;
  const result = await getEmergencyModeForCase(pool, req.user.id, caseId);
  res.status(200).json({ success: true, data: result });
}
