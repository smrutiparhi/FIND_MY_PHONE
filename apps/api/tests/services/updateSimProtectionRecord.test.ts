import { describe, expect, it } from 'vitest';
import type { CreateRecoveryCaseWizardInput, UserId } from '@recoverai/shared';
import { createRecoveryCaseFromWizard } from '../../src/services/wizardAssessment/createRecoveryCaseFromWizard';
import { getSimProtectionState, updateSimProtectionRecord } from '../../src/services/simProtection/updateSimProtectionRecord';
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
  simAccessStatus: 'LOST_WITH_PHONE',
  screenLockEnabled: 'YES',
  sensitiveApps: [],
  deviceFindingAvailable: 'YES',
};

async function setUpCase(userId: UserId, overrides: Partial<CreateRecoveryCaseWizardInput> = {}) {
  return createRecoveryCaseFromWizard(testPool, userId, { ...baseWizardInput, ...overrides });
}

describe('getSimProtectionState', () => {
  it('lazily creates an ACTIVE record with a generic carrier guide when the device has no carrier set (the wizard never collects one) and full guidance', async () => {
    const user = await createTestUser();
    const recoveryCase = await setUpCase(user.id);

    const state = await getSimProtectionState(testPool, user.id, recoveryCase.id);

    expect(state.record.status).toBe('ACTIVE');
    expect(state.carrierGuide.carrierKey).toBe('OTHER');
    expect(state.guidanceSections).toHaveLength(6);
  });

  it('reflects the real carrier once it has been set on the device', async () => {
    const user = await createTestUser();
    const recoveryCase = await setUpCase(user.id);
    const device = await repos.devices.findById(recoveryCase.deviceId, user.id);
    if (!device) throw new Error('expected device');
    await repos.devices.update(device.id, user.id, { carrier: 'Reliance Jio' });

    const state = await getSimProtectionState(testPool, user.id, recoveryCase.id);

    expect(state.carrierGuide.carrierKey).toBe('JIO');
  });
});

describe('updateSimProtectionRecord', () => {
  it('logs SIM_PROTECTION_STARTED exactly once, on the first transition out of ACTIVE', async () => {
    const user = await createTestUser();
    const recoveryCase = await setUpCase(user.id);

    await updateSimProtectionRecord(testPool, user.id, recoveryCase.id, { status: 'BLOCK_REQUESTED' });
    await updateSimProtectionRecord(testPool, user.id, recoveryCase.id, { notes: 'called support' });

    const events = await repos.timelineEvents.listByCase(recoveryCase.id);
    expect(events.filter((e) => e.type === 'SIM_PROTECTION_STARTED')).toHaveLength(1);
  });

  it('marking REPLACEMENT_PENDING logs a USER_NOTE without completing the SIM_PROTECTION action', async () => {
    const user = await createTestUser();
    const recoveryCase = await setUpCase(user.id);

    await updateSimProtectionRecord(testPool, user.id, recoveryCase.id, { status: 'REPLACEMENT_PENDING' });

    const actions = await repos.recoveryActions.listByCase(recoveryCase.id);
    expect(actions.find((a) => a.type === 'SIM_PROTECTION')?.status).not.toBe('COMPLETED');

    const events = await repos.timelineEvents.listByCase(recoveryCase.id);
    expect(events.some((e) => e.type === 'USER_NOTE' && e.title.includes('replacement pending'))).toBe(true);
  });

  it.each(['BLOCKED', 'REPLACED'] as const)(
    'marking %s completes the SIM_PROTECTION action, logs SIM_PROTECTION_COMPLETED, and secures the SIM for the next evaluation',
    async (targetStatus) => {
      const user = await createTestUser();
      const recoveryCase = await setUpCase(user.id);
      const device = await repos.devices.findById(recoveryCase.deviceId, user.id);
      if (!device) throw new Error('expected device');

      const before = await gatherEngineInputForExistingCase(repos, recoveryCase, device);
      expect(before.input.simSecured).toBe(false);

      const result = await updateSimProtectionRecord(testPool, user.id, recoveryCase.id, { status: targetStatus });

      expect(result.record.status).toBe(targetStatus);
      const actions = await repos.recoveryActions.listByCase(recoveryCase.id);
      expect(actions.find((a) => a.type === 'SIM_PROTECTION')?.status).toBe('COMPLETED');

      const events = await repos.timelineEvents.listByCase(recoveryCase.id);
      expect(events.some((e) => e.type === 'SIM_PROTECTION_COMPLETED')).toBe(true);

      const reloadedCase = await repos.recoveryCases.findById(recoveryCase.id, user.id);
      if (!reloadedCase) throw new Error('expected case');
      expect(reloadedCase.simAccessStatus).toBe('SIM_ALREADY_BLOCKED');
      const after = await gatherEngineInputForExistingCase(repos, reloadedCase, device);
      expect(after.input.simSecured).toBe(true);
    },
    45000,
  );

  it(
    'securing the SIM unblocks an ACCOUNT_RECOVERY action that depended on it',
    async () => {
      const user = await createTestUser();
      const recoveryCase = await setUpCase(user.id); // accountAccessStatus NO + simAccessStatus LOST_WITH_PHONE -> ACCOUNT_RECOVERY depends on SIM_PROTECTION

      const actionsBefore = await repos.recoveryActions.listByCase(recoveryCase.id);
      const accountActionBefore = actionsBefore.find((a) => a.type === 'ACCOUNT_RECOVERY');
      expect(accountActionBefore?.status).toBe('BLOCKED');

      await updateSimProtectionRecord(testPool, user.id, recoveryCase.id, { status: 'BLOCKED' });

      const actionsAfter = await repos.recoveryActions.listByCase(recoveryCase.id);
      const accountActionAfter = actionsAfter.find((a) => a.type === 'ACCOUNT_RECOVERY');
      expect(accountActionAfter?.status).toBe('PENDING');
    },
    45000,
  );

  it('rejects a caseId belonging to another user', async () => {
    const user = await createTestUser();
    const recoveryCase = await setUpCase(user.id);
    const otherUser = await createTestUser();

    await expect(
      updateSimProtectionRecord(testPool, otherUser.id, recoveryCase.id, { status: 'BLOCK_REQUESTED' }),
    ).rejects.toBeInstanceOf(NotFoundError);
  });
});
