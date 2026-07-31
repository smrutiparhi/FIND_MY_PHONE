import type { Request, Response } from 'express';
import type {
  ApiSuccessResponse,
  CreatePoliceReportInput,
  MarkPoliceReportSubmittedInput,
  PoliceReport,
  PoliceReportId,
  PoliceReportState,
  RecoveryCaseId,
  RegeneratePoliceReportDraftInput,
  UpdatePoliceReportDraftInput,
} from '@recoverai/shared';
import { getPool } from '../db/pool';
import { UnauthorizedError } from '../lib/errors';
import {
  approvePoliceReport,
  createPoliceReport,
  getPoliceReportState,
  listPoliceReportsForCase,
  markPoliceReportSubmitted,
  regeneratePoliceReportDraft,
  updatePoliceReportDraftManually,
} from '../services/policeReport/policeReportService';

function requirePool() {
  const pool = getPool();
  if (!pool) throw new Error('DATABASE_URL must be configured to use the Police Complaint Assistant.');
  return pool;
}

export async function listPoliceReports(
  req: Request<{ caseId: string }>,
  res: Response<ApiSuccessResponse<PoliceReport[]>>,
): Promise<void> {
  if (!req.user) throw new UnauthorizedError();
  const caseId = req.params.caseId as RecoveryCaseId;
  const reports = await listPoliceReportsForCase(requirePool(), req.user.id, caseId);
  res.status(200).json({ success: true, data: reports });
}

export async function getPoliceReport(
  req: Request<{ caseId: string; reportId: string }>,
  res: Response<ApiSuccessResponse<PoliceReportState>>,
): Promise<void> {
  if (!req.user) throw new UnauthorizedError();
  const caseId = req.params.caseId as RecoveryCaseId;
  const reportId = req.params.reportId as PoliceReportId;
  const state = await getPoliceReportState(requirePool(), req.user.id, caseId, reportId);
  res.status(200).json({ success: true, data: state });
}

export async function postPoliceReport(
  req: Request<{ caseId: string }, unknown, CreatePoliceReportInput>,
  res: Response<ApiSuccessResponse<PoliceReportState>>,
): Promise<void> {
  if (!req.user) throw new UnauthorizedError();
  const caseId = req.params.caseId as RecoveryCaseId;
  const state = await createPoliceReport(requirePool(), req.user.id, caseId, req.body);
  res.status(201).json({ success: true, data: state });
}

export async function postRegeneratePoliceReportDraft(
  req: Request<{ caseId: string; reportId: string }, unknown, RegeneratePoliceReportDraftInput>,
  res: Response<ApiSuccessResponse<PoliceReportState>>,
): Promise<void> {
  if (!req.user) throw new UnauthorizedError();
  const caseId = req.params.caseId as RecoveryCaseId;
  const reportId = req.params.reportId as PoliceReportId;
  const state = await regeneratePoliceReportDraft(requirePool(), req.user.id, caseId, reportId, req.body);
  res.status(200).json({ success: true, data: state });
}

export async function patchPoliceReportDraft(
  req: Request<{ caseId: string; reportId: string }, unknown, UpdatePoliceReportDraftInput>,
  res: Response<ApiSuccessResponse<PoliceReportState>>,
): Promise<void> {
  if (!req.user) throw new UnauthorizedError();
  const caseId = req.params.caseId as RecoveryCaseId;
  const reportId = req.params.reportId as PoliceReportId;
  const state = await updatePoliceReportDraftManually(requirePool(), req.user.id, caseId, reportId, req.body);
  res.status(200).json({ success: true, data: state });
}

export async function postApprovePoliceReport(
  req: Request<{ caseId: string; reportId: string }>,
  res: Response<ApiSuccessResponse<PoliceReportState>>,
): Promise<void> {
  if (!req.user) throw new UnauthorizedError();
  const caseId = req.params.caseId as RecoveryCaseId;
  const reportId = req.params.reportId as PoliceReportId;
  const state = await approvePoliceReport(requirePool(), req.user.id, caseId, reportId);
  res.status(200).json({ success: true, data: state });
}

export async function postMarkPoliceReportSubmitted(
  req: Request<{ caseId: string; reportId: string }, unknown, MarkPoliceReportSubmittedInput>,
  res: Response<ApiSuccessResponse<PoliceReportState>>,
): Promise<void> {
  if (!req.user) throw new UnauthorizedError();
  const caseId = req.params.caseId as RecoveryCaseId;
  const reportId = req.params.reportId as PoliceReportId;
  const state = await markPoliceReportSubmitted(requirePool(), req.user.id, caseId, reportId, req.body);
  res.status(200).json({ success: true, data: state });
}
