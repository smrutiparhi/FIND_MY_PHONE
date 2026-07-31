import type { Request, Response } from 'express';
import type {
  ApiSuccessResponse,
  CreateFinancialProtectionItemInput,
  FinancialProtectionItemId,
  FinancialSecurityState,
  RecoveryCaseId,
  UpdateFinancialProtectionItemInput,
} from '@recoverai/shared';
import { getPool } from '../db/pool';
import { UnauthorizedError } from '../lib/errors';
import {
  createFinancialProtectionItem,
  deleteFinancialProtectionItem,
  getFinancialSecurityState,
  updateFinancialProtectionItem,
} from '../services/financialSecurity/updateFinancialSecurity';

function requirePool() {
  const pool = getPool();
  if (!pool) throw new Error('DATABASE_URL must be configured to use the Financial Security Center.');
  return pool;
}

export async function getFinancialSecurity(
  req: Request<{ caseId: string }>,
  res: Response<ApiSuccessResponse<FinancialSecurityState>>,
): Promise<void> {
  if (!req.user) throw new UnauthorizedError();
  const caseId = req.params.caseId as RecoveryCaseId;
  const state = await getFinancialSecurityState(requirePool(), req.user.id, caseId);
  res.status(200).json({ success: true, data: state });
}

export async function postFinancialProtectionItem(
  req: Request<{ caseId: string }, unknown, CreateFinancialProtectionItemInput>,
  res: Response<ApiSuccessResponse<FinancialSecurityState>>,
): Promise<void> {
  if (!req.user) throw new UnauthorizedError();
  const caseId = req.params.caseId as RecoveryCaseId;
  const state = await createFinancialProtectionItem(requirePool(), req.user.id, caseId, req.body);
  res.status(201).json({ success: true, data: state });
}

export async function patchFinancialProtectionItem(
  req: Request<{ caseId: string; itemId: string }, unknown, UpdateFinancialProtectionItemInput>,
  res: Response<ApiSuccessResponse<FinancialSecurityState>>,
): Promise<void> {
  if (!req.user) throw new UnauthorizedError();
  const caseId = req.params.caseId as RecoveryCaseId;
  const itemId = req.params.itemId as FinancialProtectionItemId;
  const state = await updateFinancialProtectionItem(requirePool(), req.user.id, caseId, itemId, req.body);
  res.status(200).json({ success: true, data: state });
}

export async function deleteFinancialProtectionItemHandler(
  req: Request<{ caseId: string; itemId: string }>,
  res: Response<ApiSuccessResponse<FinancialSecurityState>>,
): Promise<void> {
  if (!req.user) throw new UnauthorizedError();
  const caseId = req.params.caseId as RecoveryCaseId;
  const itemId = req.params.itemId as FinancialProtectionItemId;
  const state = await deleteFinancialProtectionItem(requirePool(), req.user.id, caseId, itemId);
  res.status(200).json({ success: true, data: state });
}
