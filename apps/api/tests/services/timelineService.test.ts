import { describe, expect, it } from 'vitest';
import type { CreateRecoveryCaseWizardInput, UserId } from '@recoverai/shared';
import { createRecoveryCaseFromWizard } from '../../src/services/wizardAssessment/createRecoveryCaseFromWizard';
import {
  addTimelineNote,
  deleteTimelineNote,
  exportCaseSummary,
  listTimeline,
  updateTimelineNote,
} from '../../src/services/timeline/timelineService';
import { ForbiddenError, NotFoundError } from '../../src/lib/errors';
import { createTestUser } from '../factories';
import { testPool } from '../setup';

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

describe('listTimeline', () => {
  it(
    'returns chronological and reverse-chronological views, and includes the automatic CASE_CREATED event',
    async () => {
      const user = await createTestUser();
      const recoveryCase = await setUpCase(user.id);
      await addTimelineNote(testPool, user.id, recoveryCase.id, { title: 'Second thing' });

      const desc = await listTimeline(testPool, user.id, recoveryCase.id, 'desc');
      const asc = await listTimeline(testPool, user.id, recoveryCase.id, 'asc');

      expect(desc.length).toBeGreaterThanOrEqual(2);
      expect(desc.some((e) => e.type === 'CASE_CREATED')).toBe(true);
      expect(asc.map((e) => e.id)).toEqual([...desc.map((e) => e.id)].reverse());
      expect(new Date(desc[0]!.createdAt).getTime()).toBeGreaterThanOrEqual(new Date(desc[desc.length - 1]!.createdAt).getTime());
    },
    30000,
  );

  it('rejects a caseId belonging to another user', async () => {
    const user = await createTestUser();
    const recoveryCase = await setUpCase(user.id);
    const other = await createTestUser();

    await expect(listTimeline(testPool, other.id, recoveryCase.id)).rejects.toBeInstanceOf(NotFoundError);
  });
});

describe('addTimelineNote / updateTimelineNote / deleteTimelineNote', () => {
  it('adds a USER_NOTE event that is user-editable and user-deletable', async () => {
    const user = await createTestUser();
    const recoveryCase = await setUpCase(user.id);

    const created = await addTimelineNote(testPool, user.id, recoveryCase.id, { title: 'Called the bank', description: 'Flagged the account' });
    expect(created.type).toBe('USER_NOTE');
    expect(created.source).toBe('USER');

    const updated = await updateTimelineNote(testPool, user.id, recoveryCase.id, created.id, { title: 'Called the bank again' });
    expect(updated.title).toBe('Called the bank again');

    await deleteTimelineNote(testPool, user.id, recoveryCase.id, created.id);
    const events = await listTimeline(testPool, user.id, recoveryCase.id);
    expect(events.find((e) => e.id === created.id)).toBeUndefined();
  });

  it(
    'refuses to edit or delete a system-generated event, even for the owning user',
    async () => {
      const user = await createTestUser();
      const recoveryCase = await setUpCase(user.id);
      const events = await listTimeline(testPool, user.id, recoveryCase.id);
      const systemEvent = events.find((e) => e.type === 'CASE_CREATED');
      expect(systemEvent).toBeDefined();

      await expect(
        updateTimelineNote(testPool, user.id, recoveryCase.id, systemEvent!.id, { title: 'Hijacked title' }),
      ).rejects.toBeInstanceOf(ForbiddenError);
      await expect(deleteTimelineNote(testPool, user.id, recoveryCase.id, systemEvent!.id)).rejects.toBeInstanceOf(ForbiddenError);

      const stillThere = await listTimeline(testPool, user.id, recoveryCase.id);
      expect(stillThere.find((e) => e.id === systemEvent!.id)?.title).toBe(systemEvent!.title);
    },
    30000,
  );

  it('rejects editing/deleting a note belonging to another user', async () => {
    const user = await createTestUser();
    const recoveryCase = await setUpCase(user.id);
    const created = await addTimelineNote(testPool, user.id, recoveryCase.id, { title: 'My note' });
    const other = await createTestUser();

    await expect(updateTimelineNote(testPool, other.id, recoveryCase.id, created.id, { title: 'x' })).rejects.toBeInstanceOf(NotFoundError);
    await expect(deleteTimelineNote(testPool, other.id, recoveryCase.id, created.id)).rejects.toBeInstanceOf(NotFoundError);
  });
});

describe('exportCaseSummary', () => {
  it(
    'produces a chronological, sanitized text summary covering real timeline content',
    async () => {
      const user = await createTestUser();
      const recoveryCase = await setUpCase(user.id);
      await addTimelineNote(testPool, user.id, recoveryCase.id, { title: 'Called the bank', description: 'Flagged the account' });

      const result = await exportCaseSummary(testPool, user.id, recoveryCase.id);
      expect(result.summary).toContain('Case ID:');
      expect(result.summary).toContain('STOLEN');
      expect(result.summary).toContain('Samsung Galaxy S23');
      expect(result.summary).toContain('Called the bank');
      expect(result.summary).toContain('Flagged the account');
      expect(new Date(result.generatedAt).getTime()).not.toBeNaN();
    },
    30000,
  );

  it('rejects a caseId belonging to another user', async () => {
    const user = await createTestUser();
    const recoveryCase = await setUpCase(user.id);
    const other = await createTestUser();

    await expect(exportCaseSummary(testPool, other.id, recoveryCase.id)).rejects.toBeInstanceOf(NotFoundError);
  });
});
