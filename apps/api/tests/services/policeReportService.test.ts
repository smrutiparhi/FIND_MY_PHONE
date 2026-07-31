import { describe, expect, it } from 'vitest';
import type { CreatePoliceReportInput, CreateRecoveryCaseWizardInput, UserId } from '@recoverai/shared';
import { createRecoveryCaseFromWizard } from '../../src/services/wizardAssessment/createRecoveryCaseFromWizard';
import {
  approvePoliceReport,
  createPoliceReport,
  getPoliceReportState,
  markPoliceReportSubmitted,
  regeneratePoliceReportDraft,
  updatePoliceReportDraftManually,
} from '../../src/services/policeReport/policeReportService';
import { NotFoundError } from '../../src/lib/errors';
import { repos, createTestUser } from '../factories';
import { testPool } from '../setup';

const baseComplaintInput: CreatePoliceReportInput = {
  ownerFullName: 'Priya Iyer',
  ownerContact: 'priya@example.com',
  incidentDateTime: null,
  lastKnownPlace: null,
  incidentDescription: 'I left my phone on a cafe table and it was gone when I came back a few minutes later.',
};

async function setUpCaseWithImei(userId: UserId) {
  const device = await repos.devices.create({
    userId,
    nickname: 'My Phone',
    manufacturer: 'Samsung',
    model: 'Galaxy S23',
    platform: 'ANDROID',
    imei1: '359876543212345',
  });
  const wizardInput: CreateRecoveryCaseWizardInput = {
    incidentType: 'STOLEN',
    device: { mode: 'existing', deviceId: device.id },
    lastSeenAt: null,
    lastSeenDescription: null,
    accountAccessStatus: 'YES',
    simAccessStatus: 'ANOTHER_DEVICE_HAS_ACCESS',
    screenLockEnabled: 'YES',
    sensitiveApps: [],
    deviceFindingAvailable: 'YES',
  };
  const recoveryCase = await createRecoveryCaseFromWizard(testPool, userId, wizardInput);
  return { device, recoveryCase };
}

describe('createPoliceReport', () => {
  it(
    'assembles device facts (including decrypted IMEI) into the snapshot and creates version 1',
    async () => {
      const user = await createTestUser();
      const { recoveryCase } = await setUpCaseWithImei(user.id);

      const state = await createPoliceReport(testPool, user.id, recoveryCase.id, baseComplaintInput);

      expect(state.report.status).toBe('DRAFT');
      expect(state.report.deviceDescriptionSnapshot).toContain('Samsung Galaxy S23');
      expect(state.report.deviceDescriptionSnapshot).toContain('359876543212345');
      expect(state.versions).toHaveLength(1);
      expect(state.versions[0]?.versionNumber).toBe(1);
      expect(state.isSimulated).toBe(true); // no real AI_API_KEY configured in tests

      const events = await repos.timelineEvents.listByCase(recoveryCase.id);
      expect(events.some((e) => e.type === 'POLICE_COMPLAINT_CREATED' && e.policeReportId === state.report.id)).toBe(true);
    },
    30000,
  );

  it('rejects a caseId belonging to another user', async () => {
    const user = await createTestUser();
    const { recoveryCase } = await setUpCaseWithImei(user.id);
    const otherUser = await createTestUser();

    await expect(createPoliceReport(testPool, otherUser.id, recoveryCase.id, baseComplaintInput)).rejects.toBeInstanceOf(NotFoundError);
  });
});

describe('police report lifecycle', () => {
  it(
    'regenerate updates stored facts and appends a version; manual edit appends another, never simulated',
    async () => {
      const user = await createTestUser();
      const { recoveryCase } = await setUpCaseWithImei(user.id);
      const created = await createPoliceReport(testPool, user.id, recoveryCase.id, baseComplaintInput);

      const regenerated = await regeneratePoliceReportDraft(testPool, user.id, recoveryCase.id, created.report.id, {
        ...baseComplaintInput,
        lastKnownPlace: 'MG Road cafe',
      });
      expect(regenerated.report.lastKnownPlace).toBe('MG Road cafe');
      expect(regenerated.versions).toHaveLength(2);

      const edited = await updatePoliceReportDraftManually(testPool, user.id, recoveryCase.id, created.report.id, {
        draftText: 'Manually corrected complaint text.',
      });
      expect(edited.report.draftText).toBe('Manually corrected complaint text.');
      expect(edited.versions).toHaveLength(3);
      expect(edited.versions[0]?.isSimulated).toBe(false);
    },
    45000,
  );

  it(
    'approving creates an Evidence row and a POLICE_COMPLAINT_APPROVED timeline event linked to it',
    async () => {
      const user = await createTestUser();
      const { recoveryCase } = await setUpCaseWithImei(user.id);
      const created = await createPoliceReport(testPool, user.id, recoveryCase.id, baseComplaintInput);

      const approved = await approvePoliceReport(testPool, user.id, recoveryCase.id, created.report.id);
      expect(approved.report.status).toBe('APPROVED');
      expect(approved.report.approvedAt).not.toBeNull();

      const evidence = await repos.evidence.listByCase(recoveryCase.id);
      const complaintEvidence = evidence.find((e) => e.category === 'POLICE_COMPLAINT');
      expect(complaintEvidence).toBeDefined();
      expect(complaintEvidence?.storageKey).toContain(created.report.id);

      const events = await repos.timelineEvents.listByCase(recoveryCase.id);
      const approvedEvent = events.find((e) => e.type === 'POLICE_COMPLAINT_APPROVED');
      expect(approvedEvent?.evidenceId).toBe(complaintEvidence?.id);
    },
    30000,
  );

  it(
    'marking submitted completes the POLICE_REPORT action and unblocks a dependent CEIR_SUBMISSION action',
    async () => {
      const user = await createTestUser();
      const { recoveryCase } = await setUpCaseWithImei(user.id);
      const created = await createPoliceReport(testPool, user.id, recoveryCase.id, baseComplaintInput);

      const actionsBefore = await repos.recoveryActions.listByCase(recoveryCase.id);
      const ceirBefore = actionsBefore.find((a) => a.type === 'CEIR_SUBMISSION');
      expect(ceirBefore?.status).toBe('BLOCKED');

      const submitted = await markPoliceReportSubmitted(testPool, user.id, recoveryCase.id, created.report.id, {
        externalReferenceNumber: 'FIR-2026-00123',
      });
      expect(submitted.report.status).toBe('USER_MARKED_SUBMITTED');
      expect(submitted.report.externalReferenceNumber).toBe('FIR-2026-00123');

      const actionsAfter = await repos.recoveryActions.listByCase(recoveryCase.id);
      expect(actionsAfter.find((a) => a.type === 'POLICE_REPORT')?.status).toBe('COMPLETED');
      expect(actionsAfter.find((a) => a.type === 'CEIR_SUBMISSION')?.status).toBe('PENDING');
    },
    45000,
  );

  it('rejects operating on a report belonging to another user', async () => {
    const user = await createTestUser();
    const { recoveryCase } = await setUpCaseWithImei(user.id);
    const created = await createPoliceReport(testPool, user.id, recoveryCase.id, baseComplaintInput);
    const otherUser = await createTestUser();

    await expect(getPoliceReportState(testPool, otherUser.id, recoveryCase.id, created.report.id)).rejects.toBeInstanceOf(NotFoundError);
    await expect(
      updatePoliceReportDraftManually(testPool, otherUser.id, recoveryCase.id, created.report.id, { draftText: 'x' }),
    ).rejects.toBeInstanceOf(NotFoundError);
    await expect(approvePoliceReport(testPool, otherUser.id, recoveryCase.id, created.report.id)).rejects.toBeInstanceOf(NotFoundError);
  });
});
