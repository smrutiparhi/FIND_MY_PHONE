import type { Request, Response } from 'express';
import type {
  ApiSuccessResponse,
  Evidence,
  EvidenceAccessResult,
  EvidenceCategory,
  EvidenceId,
  RecoveryCaseId,
} from '@recoverai/shared';
import { getPool } from '../db/pool';
import { UnauthorizedError, ValidationError } from '../lib/errors';
import { deleteEvidence, getEvidenceAccess, listEvidenceForCase, uploadEvidence } from '../services/evidence/evidenceService';

function requirePool() {
  const pool = getPool();
  if (!pool) throw new Error('DATABASE_URL must be configured to use the Evidence Vault.');
  return pool;
}

function auditContext(req: Request): { ipAddress: string | null; userAgent: string | null } {
  return { ipAddress: req.ip ?? null, userAgent: req.get('user-agent') ?? null };
}

export async function listEvidence(
  req: Request<{ caseId: string }>,
  res: Response<ApiSuccessResponse<Evidence[]>>,
): Promise<void> {
  if (!req.user) throw new UnauthorizedError();
  const caseId = req.params.caseId as RecoveryCaseId;
  const items = await listEvidenceForCase(requirePool(), req.user.id, caseId);
  res.status(200).json({ success: true, data: items });
}

export async function postEvidence(
  req: Request<{ caseId: string }, unknown, { category: EvidenceCategory; description?: string }>,
  res: Response<ApiSuccessResponse<Evidence>>,
): Promise<void> {
  if (!req.user) throw new UnauthorizedError();
  if (!req.file) throw new ValidationError('A file is required.');
  const caseId = req.params.caseId as RecoveryCaseId;

  const evidence = await uploadEvidence(
    requirePool(),
    req.user.id,
    caseId,
    {
      category: req.body.category,
      description: req.body.description ?? null,
      file: { buffer: req.file.buffer, originalName: req.file.originalname, mimeType: req.file.mimetype },
    },
    auditContext(req),
  );
  res.status(201).json({ success: true, data: evidence });
}

export async function getEvidenceAccessHandler(
  req: Request<{ caseId: string; evidenceId: string }>,
  res: Response<ApiSuccessResponse<EvidenceAccessResult>>,
): Promise<void> {
  if (!req.user) throw new UnauthorizedError();
  const caseId = req.params.caseId as RecoveryCaseId;
  const evidenceId = req.params.evidenceId as EvidenceId;
  const result = await getEvidenceAccess(requirePool(), req.user.id, caseId, evidenceId, auditContext(req));
  res.status(200).json({ success: true, data: result });
}

export async function deleteEvidenceHandler(
  req: Request<{ caseId: string; evidenceId: string }>,
  res: Response<ApiSuccessResponse<{ deleted: true }>>,
): Promise<void> {
  if (!req.user) throw new UnauthorizedError();
  const caseId = req.params.caseId as RecoveryCaseId;
  const evidenceId = req.params.evidenceId as EvidenceId;
  await deleteEvidence(requirePool(), req.user.id, caseId, evidenceId, auditContext(req));
  res.status(200).json({ success: true, data: { deleted: true } });
}
