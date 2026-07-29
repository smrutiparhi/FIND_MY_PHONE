import { describe, expect, it } from 'vitest';
import type { CreateRecoveryCaseWizardInput } from '@recoverai/shared';
import { createRecoveryCaseFromWizard } from '../../src/services/wizardAssessment/createRecoveryCaseFromWizard';
import { getAccountRecoveryState, updateAccountRecoveryAttempt } from '../../src/services/accountRecovery/updateAccountRecoveryAttempt';
import { gatherEngineInputForExistingCase } from '../../src/services/recoveryEngine/gatherEngineInputForExistingCase';
import { NotFoundError } from '../../src/lib/errors';
import { repos, createTestUser } from '../factories';
import { testPool } from '../setup';

const baseWizardInput: CreateRecoveryCaseWizardInput = {
  incidentType: 'STOLEN',
  device: { mode: 'new', nickname: 'My Phone', manufacturer: 'Google', model: 'Pixel 9', platform: 'ANDROID' },
  lastSeenAt: null,
  lastSeenDescription: null,
  accountAccessStatus: 'NO',
  simAccessStatus: 'ANOTHER_DEVICE_HAS_ACCESS',
  screenLockEnabled: 'YES',
  sensitiveApps: [],
  deviceFindingAvailable: 'YES',
};

async function setUpCase(overrides: Partial<CreateRecoveryCaseWizardInput> = {}) {
  const user = await createTestUser();
  const recoveryCase = await createRecoveryCaseFromWizard(testPool, user.id, { ...baseWizardInput, ...overrides });
  return { user, recoveryCase };
}

describe('getAccountRecoveryState', () => {
  it('lazily creates a NOT_STARTED attempt with no signals and a generic recovery path', async () => {
    const { user, recoveryCase } = await setUpCase();

    const state = await getAccountRecoveryState(testPool, user.id, recoveryCase.id);

    expect(state.attempt.status).toBe('NOT_STARTED');
    expect(state.attempt.availableSignals).toEqual([]);
    expect(state.steps[0]?.key).toBe('formal_account_recovery');
  });

  it('is idempotent - calling it twice reuses the same attempt row', async () => {
    const { user, recoveryCase } = await setUpCase();

    const first = await getAccountRecoveryState(testPool, user.id, recoveryCase.id);
    const second = await getAccountRecoveryState(testPool, user.id, recoveryCase.id);

    expect(second.attempt.id).toBe(first.attempt.id);
  });
});

describe('updateAccountRecoveryAttempt', () => {
  it('saves the checklist, starts the attempt, and regenerates the path to match', async () => {
    const { user, recoveryCase } = await setUpCase();

    const result = await updateAccountRecoveryAttempt(testPool, user.id, recoveryCase.id, {
      availableSignals: ['TRUSTED_DEVICE'],
      status: 'IN_PROGRESS',
    });

    expect(result.attempt.status).toBe('IN_PROGRESS');
    expect(result.attempt.availableSignals).toEqual(['TRUSTED_DEVICE']);
    expect(result.steps[0]?.key).toBe('reset_via_trusted_device');
  });

  // Longer timeout: this test makes two full updateAccountRecoveryAttempt calls back to back, each of
  // which is itself several sequential round trips (case/device lookup, attempt update, timeline
  // event, then a full recalculateRecoveryCase transaction) against the real remote Supabase instance
  // - comfortably over the suite's default 20s budget under normal network latency, not a hang.
  it(
    'logs ACCOUNT_RECOVERY_STARTED exactly once, on the first transition out of NOT_STARTED',
    async () => {
      const { user, recoveryCase } = await setUpCase();

      await updateAccountRecoveryAttempt(testPool, user.id, recoveryCase.id, { status: 'IN_PROGRESS' });
      await updateAccountRecoveryAttempt(testPool, user.id, recoveryCase.id, { availableSignals: ['RECOVERY_EMAIL'] });

      const events = await repos.timelineEvents.listByCase(recoveryCase.id);
      const startedEvents = events.filter((e) => e.type === 'ACCOUNT_RECOVERY_STARTED');
      expect(startedEvents).toHaveLength(1);
    },
    45000,
  );

  it('marking WAITING logs a USER_NOTE without completing the account-recovery action', async () => {
    const { user, recoveryCase } = await setUpCase();

    await updateAccountRecoveryAttempt(testPool, user.id, recoveryCase.id, { status: 'WAITING' });

    const actions = await repos.recoveryActions.listByCase(recoveryCase.id);
    const accountRecoveryAction = actions.find((a) => a.type === 'ACCOUNT_RECOVERY');
    expect(accountRecoveryAction?.status).not.toBe('COMPLETED');

    const events = await repos.timelineEvents.listByCase(recoveryCase.id);
    expect(events.some((e) => e.type === 'USER_NOTE' && e.title.includes('waiting'))).toBe(true);
  });

  // Longer timeout: one updateAccountRecoveryAttempt call (itself several sequential round trips,
  // ending in a full recalculateRecoveryCase transaction) plus four extra verification queries
  // against the real remote Supabase instance - see the timeout note above.
  it(
    'marking RECOVERED completes the ACCOUNT_RECOVERY action, logs ACCOUNT_RECOVERY_COMPLETED, and flips accountAccess to YES for the next evaluation',
    async () => {
      const { user, recoveryCase } = await setUpCase();
      const device = await repos.devices.findById(recoveryCase.deviceId, user.id);
      if (!device) throw new Error('expected device');

      const before = await gatherEngineInputForExistingCase(repos, recoveryCase, device);
      expect(before.input.accountAccess).not.toBe('YES');

      const result = await updateAccountRecoveryAttempt(testPool, user.id, recoveryCase.id, { status: 'RECOVERED' });

      expect(result.attempt.status).toBe('RECOVERED');
      const actions = await repos.recoveryActions.listByCase(recoveryCase.id);
      const accountRecoveryAction = actions.find((a) => a.type === 'ACCOUNT_RECOVERY');
      expect(accountRecoveryAction?.status).toBe('COMPLETED');

      const events = await repos.timelineEvents.listByCase(recoveryCase.id);
      expect(events.some((e) => e.type === 'ACCOUNT_RECOVERY_COMPLETED')).toBe(true);

      const reloadedCase = await repos.recoveryCases.findById(recoveryCase.id, user.id);
      if (!reloadedCase) throw new Error('expected case');
      const after = await gatherEngineInputForExistingCase(repos, reloadedCase, device);
      expect(after.input.accountAccess).toBe('YES');
      expect(reloadedCase.accountAccessStatus).toBe('YES');
    },
    45000,
  );

  it('rejects a caseId belonging to another user', async () => {
    const { recoveryCase } = await setUpCase();
    const otherUser = await createTestUser();

    await expect(
      updateAccountRecoveryAttempt(testPool, otherUser.id, recoveryCase.id, { status: 'IN_PROGRESS' }),
    ).rejects.toBeInstanceOf(NotFoundError);
  });
});
