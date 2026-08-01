import { describe, expect, it } from 'vitest';
import type { CreateRecoveryCaseWizardInput, UserId } from '@recoverai/shared';
import { createRecoveryCaseFromWizard } from '../../src/services/wizardAssessment/createRecoveryCaseFromWizard';
import { updateAccountRecoveryAttempt } from '../../src/services/accountRecovery/updateAccountRecoveryAttempt';
import { updateSimProtectionRecord } from '../../src/services/simProtection/updateSimProtectionRecord';
import { updateDeviceRecoveryChecklist } from '../../src/services/deviceRecovery/deviceRecoveryService';
import { repos, createTestUser } from '../factories';
import { testPool } from '../setup';

async function setUpCase(userId: UserId, overrides: Partial<CreateRecoveryCaseWizardInput> = {}) {
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
    ...overrides,
  };
  return createRecoveryCaseFromWizard(testPool, userId, wizardInput);
}

describe('notification wiring at each real trigger point', () => {
  it(
    'a wizard submission that lands at CRITICAL/HIGH risk creates CRITICAL_ACTION_PENDING immediately',
    async () => {
      const user = await createTestUser();
      const recoveryCase = await setUpCase(user.id, { accountAccessStatus: 'NO', simAccessStatus: 'LOST_WITH_PHONE' });
      expect(['CRITICAL', 'HIGH']).toContain(recoveryCase.riskLevel);

      const notifications = await repos.notifications.listByUser(user.id);
      expect(notifications.some((n) => n.type === 'CRITICAL_ACTION_PENDING' && n.caseId === recoveryCase.id)).toBe(true);
    },
    30000,
  );

  it(
    'a clean LOW-risk wizard submission never creates CRITICAL_ACTION_PENDING',
    async () => {
      const user = await createTestUser();
      const recoveryCase = await setUpCase(user.id, { incidentType: 'LOST' });
      expect(recoveryCase.riskLevel).toBe('LOW');

      const notifications = await repos.notifications.listByUser(user.id);
      expect(notifications.some((n) => n.type === 'CRITICAL_ACTION_PENDING')).toBe(false);
    },
    30000,
  );

  it(
    'marking account recovery RECOVERED creates ACCOUNT_RECOVERY_UPDATE',
    async () => {
      const user = await createTestUser();
      const recoveryCase = await setUpCase(user.id);
      await updateAccountRecoveryAttempt(testPool, user.id, recoveryCase.id, { status: 'RECOVERED', availableSignals: ['PASSWORD'] });

      const notifications = await repos.notifications.listByUser(user.id);
      expect(notifications.some((n) => n.type === 'ACCOUNT_RECOVERY_UPDATE' && n.caseId === recoveryCase.id)).toBe(true);
    },
    45000,
  );

  it(
    'marking the SIM blocked creates SIM_STATUS_UPDATE',
    async () => {
      const user = await createTestUser();
      const recoveryCase = await setUpCase(user.id);
      await updateSimProtectionRecord(testPool, user.id, recoveryCase.id, { status: 'BLOCK_REQUESTED' });
      await updateSimProtectionRecord(testPool, user.id, recoveryCase.id, { status: 'BLOCKED' });

      const notifications = await repos.notifications.listByUser(user.id);
      expect(notifications.some((n) => n.type === 'SIM_STATUS_UPDATE' && n.caseId === recoveryCase.id)).toBe(true);
    },
    45000,
  );

  it(
    'confirming device possession creates DEVICE_RECOVERY_CHECKLIST',
    async () => {
      const user = await createTestUser();
      const recoveryCase = await setUpCase(user.id);
      await updateDeviceRecoveryChecklist(testPool, user.id, recoveryCase.id, { completedItems: ['CONFIRM_POSSESSION'] });

      const notifications = await repos.notifications.listByUser(user.id);
      expect(notifications.some((n) => n.type === 'DEVICE_RECOVERY_CHECKLIST' && n.caseId === recoveryCase.id)).toBe(true);
    },
    30000,
  );
});
