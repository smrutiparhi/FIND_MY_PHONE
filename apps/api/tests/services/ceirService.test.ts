import { describe, expect, it } from 'vitest';
import type { CreateRecoveryCaseWizardInput, UserId } from '@recoverai/shared';
import { createRecoveryCaseFromWizard } from '../../src/services/wizardAssessment/createRecoveryCaseFromWizard';
import { getCeirState, updateCeirRecord } from '../../src/services/ceir/ceirService';
import { NotFoundError } from '../../src/lib/errors';
import { repos, createTestUser } from '../factories';
import { testPool } from '../setup';

const baseWizardInput: CreateRecoveryCaseWizardInput = {
  incidentType: 'STOLEN',
  device: { mode: 'new', nickname: 'My Phone', manufacturer: 'Google', model: 'Pixel 9', platform: 'ANDROID' },
  lastSeenAt: null,
  lastSeenDescription: null,
  accountAccessStatus: 'NO',
  simAccessStatus: 'LOST_WITH_PHONE',
  screenLockEnabled: 'YES',
  sensitiveApps: [],
  deviceFindingAvailable: 'YES',
};

async function setUpCase(userId: UserId) {
  return createRecoveryCaseFromWizard(testPool, userId, baseWizardInput);
}

/** The wizard never collects IMEI (see docs/POLICE_REPORT.md) - set directly on the device, mirroring Part 13's setUpCaseWithImei. */
async function setUpCaseWithImei(userId: UserId) {
  const device = await repos.devices.create({
    userId,
    nickname: 'My Phone',
    manufacturer: 'Google',
    model: 'Pixel 9',
    platform: 'ANDROID',
    imei1: '359876543212345',
  });
  const recoveryCase = await createRecoveryCaseFromWizard(testPool, userId, {
    ...baseWizardInput,
    device: { mode: 'existing', deviceId: device.id },
  });
  return { device, recoveryCase };
}

describe('getCeirState', () => {
  it('lazily creates a NOT_READY record with checklist hints, guidance, and official links', async () => {
    const user = await createTestUser();
    const recoveryCase = await setUpCase(user.id);

    const state = await getCeirState(testPool, user.id, recoveryCase.id);

    expect(state.record.status).toBe('NOT_READY');
    expect(state.checklistHints).toHaveLength(8);
    expect(state.guidanceSections.length).toBeGreaterThan(0);
    expect(state.officialLinks.length).toBeGreaterThan(0);
    expect(state.officialLinks.every((l) => l.url.startsWith('https://'))).toBe(true);
    expect(state.deviceIdentifiers.imei1).toBeNull();
  });

  it('surfaces the real decrypted IMEI when one is on file for the device', async () => {
    const user = await createTestUser();
    const { recoveryCase } = await setUpCaseWithImei(user.id);

    const state = await getCeirState(testPool, user.id, recoveryCase.id);

    expect(state.deviceIdentifiers.imei1).toBe('359876543212345');
    expect(state.checklistHints.find((h) => h.item === 'IMEI_INFORMATION')?.satisfied).toBe(true);
  });

  it('rejects a caseId belonging to another user', async () => {
    const user = await createTestUser();
    const recoveryCase = await setUpCase(user.id);
    const otherUser = await createTestUser();

    await expect(getCeirState(testPool, otherUser.id, recoveryCase.id)).rejects.toBeInstanceOf(NotFoundError);
  });
});

describe('updateCeirRecord', () => {
  it(
    'an update that omits a field never wipes what was already recorded for it',
    async () => {
      const user = await createTestUser();
      const recoveryCase = await setUpCase(user.id);

      await updateCeirRecord(testPool, user.id, recoveryCase.id, { ceirRequestId: 'REQ-123', notes: 'first note' });
      const afterNotesOnly = await updateCeirRecord(testPool, user.id, recoveryCase.id, { notes: 'updated note' });

      expect(afterNotesOnly.record.ceirRequestId).toBe('REQ-123');
      expect(afterNotesOnly.record.notes).toBe('updated note');

      const afterStatusOnly = await updateCeirRecord(testPool, user.id, recoveryCase.id, { status: 'READY' });
      expect(afterStatusOnly.record.ceirRequestId).toBe('REQ-123');
      expect(afterStatusOnly.record.notes).toBe('updated note');
    },
    30000,
  );

  it('updating only the checklist does not create a timeline event or touch status', async () => {
    const user = await createTestUser();
    const recoveryCase = await setUpCase(user.id);

    const result = await updateCeirRecord(testPool, user.id, recoveryCase.id, {
      checklistCompletedItems: ['DEVICE_DETAILS', 'MOBILE_NUMBER'],
    });

    expect(result.record.status).toBe('NOT_READY');
    expect(result.record.checklistCompletedItems).toEqual(['DEVICE_DETAILS', 'MOBILE_NUMBER']);
    const events = await repos.timelineEvents.listByCase(recoveryCase.id);
    expect(events.some((e) => e.type === 'CEIR_STATUS_UPDATED' || e.type === 'CEIR_SUBMITTED')).toBe(false);
  });

  it('transitioning to READY logs CEIR_STATUS_UPDATED and does not complete CEIR_SUBMISSION', async () => {
    const user = await createTestUser();
    const recoveryCase = await setUpCase(user.id);

    await updateCeirRecord(testPool, user.id, recoveryCase.id, { status: 'READY' });

    const events = await repos.timelineEvents.listByCase(recoveryCase.id);
    expect(events.some((e) => e.type === 'CEIR_STATUS_UPDATED' && e.title.includes('ready'))).toBe(true);

    const actions = await repos.recoveryActions.listByCase(recoveryCase.id);
    expect(actions.find((a) => a.type === 'CEIR_SUBMISSION')?.status).not.toBe('COMPLETED');
  });

  it(
    'transitioning to SUBMITTED with a request id logs CEIR_SUBMITTED, creates linked Evidence, and completes CEIR_SUBMISSION',
    async () => {
      const user = await createTestUser();
      const recoveryCase = await setUpCase(user.id);

      const result = await updateCeirRecord(testPool, user.id, recoveryCase.id, {
        status: 'SUBMITTED',
        ceirRequestId: 'REQ-999',
      });

      expect(result.record.status).toBe('SUBMITTED');

      const evidence = await repos.evidence.listByCase(recoveryCase.id);
      const ceirEvidence = evidence.find((e) => e.category === 'CEIR_ACKNOWLEDGEMENT');
      expect(ceirEvidence).toBeDefined();
      expect(ceirEvidence?.description).toContain('REQ-999');

      const events = await repos.timelineEvents.listByCase(recoveryCase.id);
      const submittedEvent = events.find((e) => e.type === 'CEIR_SUBMITTED');
      expect(submittedEvent?.evidenceId).toBe(ceirEvidence?.id);
      expect(submittedEvent?.ceirRecordId).toBe(result.record.id);

      const actions = await repos.recoveryActions.listByCase(recoveryCase.id);
      expect(actions.find((a) => a.type === 'CEIR_SUBMISSION')?.status).toBe('COMPLETED');
    },
    30000,
  );

  it('transitioning to SUBMITTED without a request id logs CEIR_SUBMITTED but creates no Evidence row', async () => {
    const user = await createTestUser();
    const recoveryCase = await setUpCase(user.id);

    await updateCeirRecord(testPool, user.id, recoveryCase.id, { status: 'SUBMITTED' });

    const evidence = await repos.evidence.listByCase(recoveryCase.id);
    expect(evidence.some((e) => e.category === 'CEIR_ACKNOWLEDGEMENT')).toBe(false);

    const events = await repos.timelineEvents.listByCase(recoveryCase.id);
    const submittedEvent = events.find((e) => e.type === 'CEIR_SUBMITTED');
    expect(submittedEvent?.evidenceId).toBeNull();
  });

  it(
    'a later transition to BLOCKED does not re-log CEIR_SUBMITTED or duplicate action completion',
    async () => {
      const user = await createTestUser();
      const recoveryCase = await setUpCase(user.id);

      await updateCeirRecord(testPool, user.id, recoveryCase.id, { status: 'SUBMITTED', ceirRequestId: 'REQ-1' });
      const result = await updateCeirRecord(testPool, user.id, recoveryCase.id, { status: 'BLOCKED' });

      expect(result.record.status).toBe('BLOCKED');
      const events = await repos.timelineEvents.listByCase(recoveryCase.id);
      expect(events.filter((e) => e.type === 'CEIR_SUBMITTED')).toHaveLength(1);
      expect(events.some((e) => e.type === 'CEIR_STATUS_UPDATED' && e.title.includes('blocked'))).toBe(true);

      const actions = await repos.recoveryActions.listByCase(recoveryCase.id);
      expect(actions.find((a) => a.type === 'CEIR_SUBMISSION')?.status).toBe('COMPLETED');
    },
    30000,
  );

  it('rejects a caseId belonging to another user', async () => {
    const user = await createTestUser();
    const recoveryCase = await setUpCase(user.id);
    const otherUser = await createTestUser();

    await expect(
      updateCeirRecord(testPool, otherUser.id, recoveryCase.id, { status: 'READY' }),
    ).rejects.toBeInstanceOf(NotFoundError);
  });
});
