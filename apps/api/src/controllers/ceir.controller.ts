import type { Request, Response } from 'express';
import type { ApiSuccessResponse, CeirState, RecoveryCaseId, UpdateCeirRecordInput } from '@recoverai/shared';
import { getPool } from '../db/pool';
import { UnauthorizedError } from '../lib/errors';
import { getCeirState, updateCeirRecord } from '../services/ceir/ceirService';

function requirePool() {
  const pool = getPool();
  if (!pool) throw new Error('DATABASE_URL must be configured to use the CEIR Assistant.');
  return pool;
}

export async function getCeir(
  req: Request<{ caseId: string }>,
  res: Response<ApiSuccessResponse<CeirState>>,
): Promise<void> {
  if (!req.user) throw new UnauthorizedError();
  const caseId = req.params.caseId as RecoveryCaseId;
  const state = await getCeirState(requirePool(), req.user.id, caseId);
  res.status(200).json({ success: true, data: state });
}

export async function patchCeir(
  req: Request<{ caseId: string }, unknown, UpdateCeirRecordInput>,
  res: Response<ApiSuccessResponse<CeirState>>,
): Promise<void> {
  if (!req.user) throw new UnauthorizedError();
  const caseId = req.params.caseId as RecoveryCaseId;
  const state = await updateCeirRecord(requirePool(), req.user.id, caseId, req.body);
  res.status(200).json({ success: true, data: state });
}
