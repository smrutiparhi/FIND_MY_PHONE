import { afterAll, describe, expect, it } from 'vitest';
import type { CreateRecoveryCaseWizardInput, RecoveryCaseId, UserId } from '@recoverai/shared';
import { createRecoveryCaseFromWizard } from '../../src/services/wizardAssessment/createRecoveryCaseFromWizard';
import {
  deleteEvidence,
  getEvidenceAccess,
  listEvidenceForCase,
  uploadEvidence,
} from '../../src/services/evidence/evidenceService';
import { createPoliceReport, approvePoliceReport } from '../../src/services/policeReport/policeReportService';
import { updateCeirRecord } from '../../src/services/ceir/ceirService';
import { NotFoundError, ValidationError } from '../../src/lib/errors';
import { getSupabaseAdmin } from '../../src/lib/supabaseAdmin';
import { repos, createTestUser } from '../factories';
import { testPool } from '../setup';

const noAudit = { ipAddress: null, userAgent: null };
const uploadedObjectKeys: string[] = [];

afterAll(async () => {
  if (uploadedObjectKeys.length === 0) return;
  await getSupabaseAdmin().storage.from('evidence').remove(uploadedObjectKeys);
});

async function setUpCase(userId: UserId) {
  const wizardInput: CreateRecoveryCaseWizardInput = {
    incidentType: 'STOLEN',
    device: { mode: 'new', nickname: 'Test Phone', manufacturer: 'Samsung', model: 'Galaxy S23', platform: 'ANDROID' },
    lastSeenAt: null,
    lastSeenDescription: null,
    accountAccessStatus: 'YES',
    simAccessStatus: 'ANOTHER_DEVICE_HAS_ACCESS',
    screenLockEnabled: 'YES',
    sensitiveApps: [],
    deviceFindingAvailable: 'YES',
  };
  return createRecoveryCaseFromWizard(testPool, userId, wizardInput);
}

function samplePdfBuffer(): Buffer {
  return Buffer.from('%PDF-1.4 test evidence file content for RecoverAI tests');
}

async function trackAndUpload(userId: UserId, caseId: RecoveryCaseId) {
  const evidence = await uploadEvidence(
    testPool,
    userId,
    caseId,
    {
      category: 'PURCHASE_INVOICE',
      description: 'Store receipt',
      file: { buffer: samplePdfBuffer(), originalName: 'receipt.pdf', mimeType: 'application/pdf' },
    },
    noAudit,
  );
  uploadedObjectKeys.push(evidence.storageKey);
  return evidence;
}

describe('uploadEvidence', () => {
  it(
    'stores the file in private object storage, persists metadata, logs a timeline event and an audit event, and completes EVIDENCE_COLLECTION',
    async () => {
      const user = await createTestUser();
      const recoveryCase = await setUpCase(user.id);

      const actionsBefore = await repos.recoveryActions.listByCase(recoveryCase.id);
      const evidenceActionBefore = actionsBefore.find((a) => a.type === 'EVIDENCE_COLLECTION');
      expect(evidenceActionBefore?.status).not.toBe('COMPLETED');

      const evidence = await trackAndUpload(user.id, recoveryCase.id);

      expect(evidence.category).toBe('PURCHASE_INVOICE');
      expect(evidence.originalFileName).toBe('receipt.pdf');
      expect(evidence.mimeType).toBe('application/pdf');
      expect(evidence.malwareScanStatus).toBe('PENDING'); // no scanning provider configured
      expect(evidence.checksumSha256).toHaveLength(64);
      expect(evidence.storageKey.startsWith(`${recoveryCase.id}/`)).toBe(true);

      const events = await repos.timelineEvents.listByCase(recoveryCase.id);
      expect(events.some((e) => e.type === 'EVIDENCE_UPLOADED' && e.evidenceId === evidence.id)).toBe(true);

      const auditEvents = await repos.auditEvents.listByResource('evidence', evidence.id);
      expect(auditEvents.some((a) => a.action === 'evidence.upload')).toBe(true);

      const actionsAfter = await repos.recoveryActions.listByCase(recoveryCase.id);
      expect(actionsAfter.find((a) => a.type === 'EVIDENCE_COLLECTION')?.status).toBe('COMPLETED');
    },
    30000,
  );

  it('rejects a disallowed mime type before ever touching storage', async () => {
    const user = await createTestUser();
    const recoveryCase = await setUpCase(user.id);

    await expect(
      uploadEvidence(
        testPool,
        user.id,
        recoveryCase.id,
        {
          category: 'OTHER',
          file: { buffer: Buffer.from('not a real exe'), originalName: 'virus.exe', mimeType: 'application/x-msdownload' },
        },
        noAudit,
      ),
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it('rejects a caseId belonging to another user', async () => {
    const user = await createTestUser();
    const recoveryCase = await setUpCase(user.id);
    const other = await createTestUser();

    await expect(
      uploadEvidence(
        testPool,
        other.id,
        recoveryCase.id,
        { category: 'OTHER', file: { buffer: samplePdfBuffer(), originalName: 'x.pdf', mimeType: 'application/pdf' } },
        noAudit,
      ),
    ).rejects.toBeInstanceOf(NotFoundError);
  });
});

describe('getEvidenceAccess', () => {
  it(
    'returns a real signed URL for an uploaded file, and logs an audit event',
    async () => {
      const user = await createTestUser();
      const recoveryCase = await setUpCase(user.id);
      const evidence = await trackAndUpload(user.id, recoveryCase.id);

      const result = await getEvidenceAccess(testPool, user.id, recoveryCase.id, evidence.id, noAudit);
      expect(result.kind).toBe('signed_url');
      if (result.kind === 'signed_url') {
        expect(result.url).toContain('http');
        expect(result.url).not.toContain('/object/public/'); // never a public URL
      }

      const auditEvents = await repos.auditEvents.listByResource('evidence', evidence.id);
      expect(auditEvents.some((a) => a.action === 'evidence.access')).toBe(true);
    },
    30000,
  );

  it(
    'resolves an approved police complaint (internal storageKey, never a real upload) to its actual text',
    async () => {
      const user = await createTestUser();
      const recoveryCase = await setUpCase(user.id);
      const created = await createPoliceReport(testPool, user.id, recoveryCase.id, {
        ownerFullName: 'Test Owner',
        ownerContact: 'owner@example.com',
        incidentDateTime: null,
        lastKnownPlace: null,
        incidentDescription: 'Phone taken from my bag.',
      });
      await approvePoliceReport(testPool, user.id, recoveryCase.id, created.report.id);

      const evidence = (await repos.evidence.listByCase(recoveryCase.id)).find((e) => e.category === 'POLICE_COMPLAINT');
      expect(evidence).toBeDefined();

      const result = await getEvidenceAccess(testPool, user.id, recoveryCase.id, evidence!.id, noAudit);
      expect(result.kind).toBe('inline_text');
      if (result.kind === 'inline_text') {
        expect(result.text.length).toBeGreaterThan(0);
      }
    },
    30000,
  );

  it(
    'resolves a submitted CEIR record (internal storageKey) to a text summary',
    async () => {
      const user = await createTestUser();
      const recoveryCase = await setUpCase(user.id);
      await updateCeirRecord(testPool, user.id, recoveryCase.id, { ceirRequestId: 'REQ-TEST-1' });
      await updateCeirRecord(testPool, user.id, recoveryCase.id, { status: 'SUBMITTED' });

      const evidence = (await repos.evidence.listByCase(recoveryCase.id)).find((e) => e.category === 'CEIR_ACKNOWLEDGEMENT');
      expect(evidence).toBeDefined();

      const result = await getEvidenceAccess(testPool, user.id, recoveryCase.id, evidence!.id, noAudit);
      expect(result.kind).toBe('inline_text');
      if (result.kind === 'inline_text') {
        expect(result.text).toContain('REQ-TEST-1');
      }
    },
    30000,
  );

  it('rejects a caseId/evidenceId belonging to another user', async () => {
    const user = await createTestUser();
    const recoveryCase = await setUpCase(user.id);
    const evidence = await trackAndUpload(user.id, recoveryCase.id);
    const other = await createTestUser();

    await expect(getEvidenceAccess(testPool, other.id, recoveryCase.id, evidence.id, noAudit)).rejects.toBeInstanceOf(NotFoundError);
  });
});

describe('deleteEvidence', () => {
  it(
    'soft-deletes so the item disappears from listings but an audit event is recorded',
    async () => {
      const user = await createTestUser();
      const recoveryCase = await setUpCase(user.id);
      const evidence = await trackAndUpload(user.id, recoveryCase.id);

      await deleteEvidence(testPool, user.id, recoveryCase.id, evidence.id, noAudit);

      const items = await listEvidenceForCase(testPool, user.id, recoveryCase.id);
      expect(items.find((e) => e.id === evidence.id)).toBeUndefined();

      const auditEvents = await repos.auditEvents.listByResource('evidence', evidence.id);
      expect(auditEvents.some((a) => a.action === 'evidence.delete')).toBe(true);
    },
    30000,
  );

  it('rejects deleting evidence belonging to another user', async () => {
    const user = await createTestUser();
    const recoveryCase = await setUpCase(user.id);
    const evidence = await trackAndUpload(user.id, recoveryCase.id);
    const other = await createTestUser();

    await expect(deleteEvidence(testPool, other.id, recoveryCase.id, evidence.id, noAudit)).rejects.toBeInstanceOf(NotFoundError);
  });
});
