import type { Pool } from 'pg';
import type { CeirState, EvidenceId, RecoveryCaseId, UpdateCeirRecordInput, UserId } from '@recoverai/shared';
import { createRepositories } from '../../db/repositories';
import { NotFoundError } from '../../lib/errors';
import { recalculateRecoveryCase } from '../recoveryEngine/recalculateRecoveryCase';
import { toRecoveryPlan } from '../recoveryEngine/toRecoveryPlan';
import { buildCeirChecklistHints } from './buildCeirChecklistHints';
import { generateCeirGuidance } from './generateCeirGuidance';
import { CEIR_OFFICIAL_LINKS } from './ceirOfficialLinks';
import { buildDeviceDescriptionSnapshot } from '../policeReport/buildDeviceDescriptionSnapshot';

/**
 * Statuses that mean "a request has actually been made" - the same set
 * evaluateRecoveryDecision.ts uses to decide whether CEIR_SUBMISSION is
 * still an open candidate action (see its `!['SUBMITTED', 'PROCESSING',
 * 'BLOCKED', 'UNBLOCKED'].includes(...)` check). Reused here so the action
 * completes at exactly the point the engine stops asking for it.
 */
const COMPLETING_STATUSES = new Set(['SUBMITTED', 'PROCESSING', 'BLOCKED', 'UNBLOCKED']);

function buildCeirEvidenceStorageKey(caseId: RecoveryCaseId): string {
  return `internal:ceir-record:${caseId}`;
}

async function loadState(pool: Pool, userId: UserId, caseId: RecoveryCaseId): Promise<CeirState> {
  const repos = createRepositories(pool);
  const recoveryCase = await repos.recoveryCases.findById(caseId, userId);
  if (!recoveryCase) throw new NotFoundError('Recovery case not found');
  const device = await repos.devices.findById(recoveryCase.deviceId, userId);
  if (!device) throw new NotFoundError('Device not found');

  const [record, policeReports, simRecord, evidence, deviceFacts] = await Promise.all([
    repos.ceirRecords.getOrCreateForCase(caseId),
    repos.policeReports.listByCase(caseId),
    repos.simProtectionRecords.getOrCreateForCase(caseId),
    repos.evidence.listByCase(caseId),
    buildDeviceDescriptionSnapshot(repos, device, userId),
  ]);

  const policeReportFiled = policeReports.some((r) => r.status === 'USER_MARKED_SUBMITTED');
  const guidanceSections = generateCeirGuidance({
    incidentType: recoveryCase.incidentType,
    policeReportStatus: policeReportFiled ? 'FILED' : policeReports.length > 0 ? 'DRAFTED' : 'NOT_STARTED',
  });
  const checklistHints = buildCeirChecklistHints({ device, policeReports, simRecord, evidence });

  const { engineResult, actionIdByType } = await recalculateRecoveryCase(pool, userId, caseId);

  return {
    record,
    deviceIdentifiers: { imei1: deviceFacts.imei1, imei2: deviceFacts.imei2, serialNumber: deviceFacts.serialNumber },
    checklistHints,
    guidanceSections,
    officialLinks: CEIR_OFFICIAL_LINKS,
    recoveryCase,
    recoveryPlan: toRecoveryPlan(engineResult, actionIdByType),
  };
}

/** Read-only aside from the same lazy getOrCreate + cheap recalculation every other GET in this app does. */
export async function getCeirState(pool: Pool, userId: UserId, caseId: RecoveryCaseId): Promise<CeirState> {
  return loadState(pool, userId, caseId);
}

/**
 * "When status changes, add CEIR events to the Timeline and Evidence Vault
 * where appropriate, and recalculate the Recovery Decision Engine" (master
 * spec). Only ever writes what the user reports - ceirRequestId, submission
 * date, and every status value come straight from the request body, never
 * generated or inferred, so RecoverAI can never appear to have blocked an
 * IMEI itself.
 */
export async function updateCeirRecord(
  pool: Pool,
  userId: UserId,
  caseId: RecoveryCaseId,
  input: UpdateCeirRecordInput,
): Promise<CeirState> {
  const repos = createRepositories(pool);
  const recoveryCase = await repos.recoveryCases.findById(caseId, userId);
  if (!recoveryCase) throw new NotFoundError('Recovery case not found');

  const existing = await repos.ceirRecords.getOrCreateForCase(caseId);

  // Built with conditional spreads, not `key: 'key' in input ? input.key : undefined` -
  // an object literal that always assigns the key (even to `undefined`) would always
  // satisfy the repository's own `'key' in patch` presence check below, silently
  // wiping ceirRequestId/submissionDate/notes to null on every update that doesn't
  // happen to touch them.
  const updated = await repos.ceirRecords.update(existing.id, userId, {
    ...(input.status !== undefined ? { status: input.status } : {}),
    ...('ceirRequestId' in input ? { ceirRequestId: input.ceirRequestId } : {}),
    ...('submissionDate' in input ? { submissionDate: input.submissionDate } : {}),
    ...('notes' in input ? { notes: input.notes } : {}),
    ...(input.checklistCompletedItems !== undefined ? { checklistCompletedItems: input.checklistCompletedItems } : {}),
  });
  if (!updated) throw new NotFoundError('CEIR record not found');

  const statusTransitioned = input.status !== undefined && input.status !== existing.status;

  if (statusTransitioned) {
    if (updated.status === 'SUBMITTED') {
      let createdEvidenceId: EvidenceId | null = null;
      if (updated.ceirRequestId) {
        const evidence = await repos.evidence.create({
          caseId,
          uploadedByUserId: userId,
          category: 'CEIR_ACKNOWLEDGEMENT',
          description: `CEIR request submitted - Request ID ${updated.ceirRequestId}`,
          storageKey: buildCeirEvidenceStorageKey(caseId),
          originalFileName: `ceir-request-${updated.ceirRequestId}.txt`,
          mimeType: 'text/plain',
          fileSizeBytes: Buffer.byteLength(updated.ceirRequestId, 'utf8'),
          malwareScanStatus: 'SKIPPED',
        });
        createdEvidenceId = evidence.id;
      }

      await repos.timelineEvents.create({
        caseId,
        type: 'CEIR_SUBMITTED',
        title: 'CEIR request submitted',
        source: 'USER',
        verificationStatus: 'USER_REPORTED',
        ceirRecordId: updated.id,
        evidenceId: createdEvidenceId,
        createdByUserId: userId,
      });
    } else {
      await repos.timelineEvents.create({
        caseId,
        type: 'CEIR_STATUS_UPDATED',
        title: `CEIR status updated to ${updated.status.replaceAll('_', ' ').toLowerCase()}`,
        source: 'USER',
        verificationStatus: 'USER_REPORTED',
        ceirRecordId: updated.id,
        createdByUserId: userId,
      });
    }

    const wasCompleting = COMPLETING_STATUSES.has(existing.status);
    const isCompleting = COMPLETING_STATUSES.has(updated.status);
    if (!wasCompleting && isCompleting) {
      const actions = await repos.recoveryActions.listByCase(caseId);
      const ceirAction = actions.find((a) => a.type === 'CEIR_SUBMISSION');
      if (ceirAction && ceirAction.status !== 'COMPLETED') {
        await repos.recoveryActions.updateStatus(ceirAction.id, userId, 'COMPLETED');
      }
    }
  }

  return loadState(pool, userId, caseId);
}
