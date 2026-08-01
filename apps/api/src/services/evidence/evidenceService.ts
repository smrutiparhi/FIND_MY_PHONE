import { createHash } from 'node:crypto';
import type { Pool } from 'pg';
import type {
  Evidence,
  EvidenceAccessResult,
  EvidenceCategory,
  EvidenceId,
  RecoveryCaseId,
  UserId,
} from '@recoverai/shared';
import { createRepositories } from '../../db/repositories';
import { NotFoundError } from '../../lib/errors';
import { recalculateRecoveryCase } from '../recoveryEngine/recalculateRecoveryCase';
import { validateEvidenceFile } from './evidenceValidation';
import { scanForMalware } from './malwareScan';
import { buildEvidenceObjectKey, uploadEvidenceObject } from './evidenceStorage';
import { resolveEvidenceAccess } from './resolveEvidenceAccess';

interface AuditContext {
  ipAddress: string | null;
  userAgent: string | null;
}

const CATEGORY_LABELS: Record<EvidenceCategory, string> = {
  PURCHASE_INVOICE: 'purchase invoice',
  DEVICE_PHOTO: 'device photograph',
  IMEI_SERIAL_DOCUMENT: 'IMEI/serial documentation',
  LOCATION_SCREENSHOT: 'location screenshot',
  POLICE_COMPLAINT: 'police complaint',
  POLICE_ACKNOWLEDGEMENT: 'police acknowledgement',
  CEIR_ACKNOWLEDGEMENT: 'CEIR acknowledgement',
  CARRIER_SIM_DOCUMENT: 'carrier/SIM documentation',
  OTHER: 'evidence',
};

export async function listEvidenceForCase(pool: Pool, userId: UserId, caseId: RecoveryCaseId): Promise<Evidence[]> {
  const repos = createRepositories(pool);
  const recoveryCase = await repos.recoveryCases.findById(caseId, userId);
  if (!recoveryCase) throw new NotFoundError('Recovery case not found');
  return repos.evidence.listByCase(caseId);
}

/**
 * "Secure upload... malware-scanning integration point... audit logging"
 * (master spec). Order matters: validate -> scan -> upload the bytes to
 * private object storage -> only then create the DB row that references
 * them, so a failure partway through never leaves a database row pointing
 * at an object that was never actually written.
 */
export async function uploadEvidence(
  pool: Pool,
  userId: UserId,
  caseId: RecoveryCaseId,
  input: {
    category: EvidenceCategory;
    description?: string | null;
    file: { buffer: Buffer; originalName: string; mimeType: string };
  },
  audit: AuditContext,
): Promise<Evidence> {
  const repos = createRepositories(pool);
  const recoveryCase = await repos.recoveryCases.findById(caseId, userId);
  if (!recoveryCase) throw new NotFoundError('Recovery case not found');

  validateEvidenceFile({ mimeType: input.file.mimeType, sizeBytes: input.file.buffer.length });

  const scan = await scanForMalware({ buffer: input.file.buffer, mimeType: input.file.mimeType });
  const malwareScanStatus = scan.status === 'success' ? scan.data.scanStatus : 'PENDING';

  const objectKey = buildEvidenceObjectKey(caseId);
  await uploadEvidenceObject(objectKey, input.file.buffer, input.file.mimeType);
  const checksumSha256 = createHash('sha256').update(input.file.buffer).digest('hex');

  const evidence = await repos.evidence.create({
    caseId,
    uploadedByUserId: userId,
    category: input.category,
    description: input.description ?? null,
    storageKey: objectKey,
    originalFileName: input.file.originalName,
    mimeType: input.file.mimeType,
    fileSizeBytes: input.file.buffer.length,
    checksumSha256,
    malwareScanStatus,
  });

  await repos.timelineEvents.create({
    caseId,
    type: 'EVIDENCE_UPLOADED',
    title: `Evidence uploaded: ${CATEGORY_LABELS[input.category]}`,
    source: 'USER',
    verificationStatus: 'USER_REPORTED',
    evidenceId: evidence.id,
    createdByUserId: userId,
  });

  await repos.auditEvents.record({
    userId,
    action: 'evidence.upload',
    resourceType: 'evidence',
    resourceId: evidence.id,
    ipAddress: audit.ipAddress,
    userAgent: audit.userAgent,
    metadata: { caseId, category: input.category, mimeType: input.file.mimeType, fileSizeBytes: input.file.buffer.length },
  });

  // "Preserve evidence about the incident" (Part 6's EVIDENCE_COLLECTION action) is satisfied by
  // the first real item, not "every category" the way Financial Security's checklist is - there's
  // no fixed required set here, so no reopen-on-regression logic either.
  const actions = await repos.recoveryActions.listByCase(caseId);
  const evidenceAction = actions.find((a) => a.type === 'EVIDENCE_COLLECTION');
  if (evidenceAction && evidenceAction.status !== 'COMPLETED') {
    await repos.recoveryActions.updateStatus(evidenceAction.id, userId, 'COMPLETED');
  }
  await recalculateRecoveryCase(pool, userId, caseId);

  return evidence;
}

/** Every access - a real signed URL or an inline-text resolution - is audit-logged, not just uploads and deletes. */
export async function getEvidenceAccess(
  pool: Pool,
  userId: UserId,
  caseId: RecoveryCaseId,
  evidenceId: EvidenceId,
  audit: AuditContext,
): Promise<EvidenceAccessResult> {
  const repos = createRepositories(pool);
  const evidence = await repos.evidence.findByIdForUser(evidenceId, userId);
  if (!evidence || evidence.caseId !== caseId) throw new NotFoundError('Evidence not found');

  const result = await resolveEvidenceAccess(repos, evidence);

  await repos.auditEvents.record({
    userId,
    action: 'evidence.access',
    resourceType: 'evidence',
    resourceId: evidence.id,
    ipAddress: audit.ipAddress,
    userAgent: audit.userAgent,
    metadata: { caseId, category: evidence.category, kind: result.kind },
  });

  return result;
}

/**
 * Soft delete only (repos.evidence.softDelete) - "evidence can carry legal/
 * audit significance even after a user removes it from their active view"
 * (0009_evidence.sql). The underlying object stays in storage; only its
 * visibility in the Vault changes.
 */
export async function deleteEvidence(
  pool: Pool,
  userId: UserId,
  caseId: RecoveryCaseId,
  evidenceId: EvidenceId,
  audit: AuditContext,
): Promise<void> {
  const repos = createRepositories(pool);
  const evidence = await repos.evidence.findByIdForUser(evidenceId, userId);
  if (!evidence || evidence.caseId !== caseId) throw new NotFoundError('Evidence not found');

  const deleted = await repos.evidence.softDelete(evidenceId, userId);
  if (!deleted) throw new NotFoundError('Evidence not found');

  await repos.auditEvents.record({
    userId,
    action: 'evidence.delete',
    resourceType: 'evidence',
    resourceId: evidenceId,
    ipAddress: audit.ipAddress,
    userAgent: audit.userAgent,
    metadata: { caseId, category: evidence.category },
  });
}
