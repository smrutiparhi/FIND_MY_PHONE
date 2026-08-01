import type { Request, Response } from 'express';
import type {
  ApiSuccessResponse,
  CloseRecoveryCaseInput,
  DeviceRecoveryState,
  FinalCaseSummary,
  RecoveryCaseId,
  UpdateDeviceRecoveryChecklistInput,
} from '@recoverai/shared';
import { getPool } from '../db/pool';
import { UnauthorizedError } from '../lib/errors';
import {
  closeRecoveryCase,
  getDeviceRecoveryState,
  getFinalCaseSummary,
  updateDeviceRecoveryChecklist,
} from '../services/deviceRecovery/deviceRecoveryService';

function requirePool() {
  const pool = getPool();
  if (!pool) throw new Error('DATABASE_URL must be configured to use the Device Recovered workflow.');
  return pool;
}

export async function getDeviceRecovery(
  req: Request<{ caseId: string }>,
  res: Response<ApiSuccessResponse<DeviceRecoveryState>>,
): Promise<void> {
  if (!req.user) throw new UnauthorizedError();
  const caseId = req.params.caseId as RecoveryCaseId;
  const state = await getDeviceRecoveryState(requirePool(), req.user.id, caseId);
  res.status(200).json({ success: true, data: state });
}

export async function patchDeviceRecoveryChecklist(
  req: Request<{ caseId: string }, unknown, UpdateDeviceRecoveryChecklistInput>,
  res: Response<ApiSuccessResponse<DeviceRecoveryState>>,
): Promise<void> {
  if (!req.user) throw new UnauthorizedError();
  const caseId = req.params.caseId as RecoveryCaseId;
  const state = await updateDeviceRecoveryChecklist(requirePool(), req.user.id, caseId, req.body);
  res.status(200).json({ success: true, data: state });
}

export async function postCloseRecoveryCase(
  req: Request<{ caseId: string }, unknown, CloseRecoveryCaseInput>,
  res: Response<ApiSuccessResponse<DeviceRecoveryState>>,
): Promise<void> {
  if (!req.user) throw new UnauthorizedError();
  const caseId = req.params.caseId as RecoveryCaseId;
  const state = await closeRecoveryCase(requirePool(), req.user.id, caseId, req.body);
  res.status(200).json({ success: true, data: state });
}

export async function getDeviceRecoverySummary(
  req: Request<{ caseId: string }>,
  res: Response<ApiSuccessResponse<FinalCaseSummary>>,
): Promise<void> {
  if (!req.user) throw new UnauthorizedError();
  const caseId = req.params.caseId as RecoveryCaseId;
  const summary = await getFinalCaseSummary(requirePool(), req.user.id, caseId);
  res.status(200).json({ success: true, data: summary });
}
