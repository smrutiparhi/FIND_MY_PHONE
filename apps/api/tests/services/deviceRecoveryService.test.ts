import { describe, expect, it } from 'vitest';
import type { CreateRecoveryCaseWizardInput, UserId } from '@recoverai/shared';
import { createRecoveryCaseFromWizard } from '../../src/services/wizardAssessment/createRecoveryCaseFromWizard';
import {
  closeRecoveryCase,
  getDeviceRecoveryState,
  getFinalCaseSummary,
  updateDeviceRecoveryChecklist,
} from '../../src/services/deviceRecovery/deviceRecoveryService';
import { NotFoundError, ValidationError } from '../../src/lib/errors';
import { repos, createTestUser } from '../factories';
import { testPool } from '../setup';

async function setUpCase(userId: UserId) {
  const wizardInput: CreateRecoveryCaseWizardInput = {
    incidentType: 'STOLEN',
    device: { mode: 'new', nickname: 'Test Phone', manufacturer: 'Samsung', model: 'Galaxy S23', platform: 'ANDROID' },
    lastSeenAt: null,
    lastSeenDescription: null,
    accountAccessStatus: 'NO',
    simAccessStatus: 'LOST_WITH_PHONE',
    screenLockEnabled: 'YES',
    sensitiveApps: [],
    deviceFindingAvailable: 'YES',
  };
  return createRecoveryCaseFromWizard(testPool, userId, wizardInput);
}

describe('getDeviceRecoveryState', () => {
  it(
    'lazily creates a checklist and lists unresolved actions, excluding MONITOR',
    async () => {
      const user = await createTestUser();
      const recoveryCase = await setUpCase(user.id);

      const state = await getDeviceRecoveryState(testPool, user.id, recoveryCase.id);
      expect(state.checklist.completedItems).toEqual([]);
      expect(state.checklist.recoveredAt).toBeNull();
      expect(state.unresolvedActions.every((a) => a.type !== 'MONITOR')).toBe(true);
      expect(state.unresolvedActions.every((a) => a.status !== 'COMPLETED' && a.status !== 'SKIPPED')).toBe(true);
    },
    30000,
  );

  it('rejects a caseId belonging to another user', async () => {
    const user = await createTestUser();
    const recoveryCase = await setUpCase(user.id);
    const other = await createTestUser();

    await expect(getDeviceRecoveryState(testPool, other.id, recoveryCase.id)).rejects.toBeInstanceOf(NotFoundError);
  });
});

describe('updateDeviceRecoveryChecklist', () => {
  it(
    'confirming possession for the first time sets recoveredAt, moves the case to RECOVERED, and logs DEVICE_RECOVERED exactly once',
    async () => {
      const user = await createTestUser();
      const recoveryCase = await setUpCase(user.id);

      const first = await updateDeviceRecoveryChecklist(testPool, user.id, recoveryCase.id, {
        completedItems: ['CONFIRM_POSSESSION'],
      });
      expect(first.checklist.recoveredAt).not.toBeNull();
      expect(first.recoveryCase.status).toBe('RECOVERED');

      const events = await repos.timelineEvents.listByCase(recoveryCase.id);
      expect(events.filter((e) => e.type === 'DEVICE_RECOVERED')).toHaveLength(1);

      // Toggling an unrelated item afterward must not re-trigger the transition or duplicate the event.
      const second = await updateDeviceRecoveryChecklist(testPool, user.id, recoveryCase.id, {
        completedItems: ['CONFIRM_POSSESSION', 'RESTORE_SIM'],
      });
      expect(second.checklist.completedItems).toContain('RESTORE_SIM');
      const eventsAfter = await repos.timelineEvents.listByCase(recoveryCase.id);
      expect(eventsAfter.filter((e) => e.type === 'DEVICE_RECOVERED')).toHaveLength(1);
    },
    45000,
  );

  it(
    'toggling a non-possession item before confirming possession does not change case status',
    async () => {
      const user = await createTestUser();
      const recoveryCase = await setUpCase(user.id);

      const result = await updateDeviceRecoveryChecklist(testPool, user.id, recoveryCase.id, {
        completedItems: ['PRESERVE_EVIDENCE'],
      });
      expect(result.checklist.recoveredAt).toBeNull();
      expect(result.recoveryCase.status).not.toBe('RECOVERED');
    },
    30000,
  );

  it(
    'an update that omits notes never wipes what was already recorded for it',
    async () => {
      const user = await createTestUser();
      const recoveryCase = await setUpCase(user.id);

      await updateDeviceRecoveryChecklist(testPool, user.id, recoveryCase.id, { notes: 'first note' });
      const result = await updateDeviceRecoveryChecklist(testPool, user.id, recoveryCase.id, {
        completedItems: ['CONFIRM_POSSESSION'],
      });
      expect(result.checklist.notes).toBe('first note');
    },
    30000,
  );

  it('rejects a caseId belonging to another user', async () => {
    const user = await createTestUser();
    const recoveryCase = await setUpCase(user.id);
    const other = await createTestUser();

    await expect(
      updateDeviceRecoveryChecklist(testPool, other.id, recoveryCase.id, { completedItems: ['CONFIRM_POSSESSION'] }),
    ).rejects.toBeInstanceOf(NotFoundError);
  });
});

describe('closeRecoveryCase', () => {
  it('rejects closing without explicit confirmation', async () => {
    const user = await createTestUser();
    const recoveryCase = await setUpCase(user.id);

    await expect(
      closeRecoveryCase(testPool, user.id, recoveryCase.id, { confirmedUnresolvedActionsReviewed: false }),
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it(
    'closes the case, sets closedAt, moves status to CLOSED, and logs CASE_CLOSED',
    async () => {
      const user = await createTestUser();
      const recoveryCase = await setUpCase(user.id);
      await updateDeviceRecoveryChecklist(testPool, user.id, recoveryCase.id, { completedItems: ['CONFIRM_POSSESSION'] });

      const result = await closeRecoveryCase(testPool, user.id, recoveryCase.id, { confirmedUnresolvedActionsReviewed: true });
      expect(result.checklist.closedAt).not.toBeNull();
      expect(result.recoveryCase.status).toBe('CLOSED');

      const events = await repos.timelineEvents.listByCase(recoveryCase.id);
      expect(events.some((e) => e.type === 'CASE_CLOSED')).toBe(true);
    },
    45000,
  );

  it('rejects a caseId belonging to another user', async () => {
    const user = await createTestUser();
    const recoveryCase = await setUpCase(user.id);
    const other = await createTestUser();

    await expect(
      closeRecoveryCase(testPool, other.id, recoveryCase.id, { confirmedUnresolvedActionsReviewed: true }),
    ).rejects.toBeInstanceOf(NotFoundError);
  });
});

describe('getFinalCaseSummary', () => {
  it(
    'reflects real case data: incident date, recovery date, and completed actions',
    async () => {
      const user = await createTestUser();
      const recoveryCase = await setUpCase(user.id);
      await updateDeviceRecoveryChecklist(testPool, user.id, recoveryCase.id, { completedItems: ['CONFIRM_POSSESSION'] });

      const summary = await getFinalCaseSummary(testPool, user.id, recoveryCase.id);
      expect(summary.recoveryDate).not.toBeNull();
      expect(summary.policeStatus).toBe('NOT_STARTED');
      expect(summary.ceirStatus).toBe('NOT_READY');
      expect(Array.isArray(summary.statusChanges)).toBe(true);
      expect(summary.statusChanges.length).toBeGreaterThan(0);
    },
    30000,
  );

  it('rejects a caseId belonging to another user', async () => {
    const user = await createTestUser();
    const recoveryCase = await setUpCase(user.id);
    const other = await createTestUser();

    await expect(getFinalCaseSummary(testPool, other.id, recoveryCase.id)).rejects.toBeInstanceOf(NotFoundError);
  });
});
