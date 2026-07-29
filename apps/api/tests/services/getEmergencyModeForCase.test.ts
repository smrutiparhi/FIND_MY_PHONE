import { describe, expect, it } from 'vitest';
import type { CreateRecoveryCaseWizardInput } from '@recoverai/shared';
import { createRecoveryCaseFromWizard } from '../../src/services/wizardAssessment/createRecoveryCaseFromWizard';
import { getEmergencyModeForCase } from '../../src/services/emergencyMode/getEmergencyModeForCase';
import { NotFoundError } from '../../src/lib/errors';
import { createTestUser } from '../factories';
import { testPool } from '../setup';

describe('getEmergencyModeForCase', () => {
  it('reflects the real engine risk for a high-risk case', async () => {
    const user = await createTestUser();
    const wizardInput: CreateRecoveryCaseWizardInput = {
      incidentType: 'STOLEN',
      device: { mode: 'new', nickname: 'My Phone', manufacturer: 'Apple', model: 'iPhone 16', platform: 'IPHONE' },
      lastSeenAt: null,
      lastSeenDescription: null,
      accountAccessStatus: 'NO',
      simAccessStatus: 'LOST_WITH_PHONE',
      screenLockEnabled: 'NO',
      sensitiveApps: ['BANKING'],
      deviceFindingAvailable: 'UNSURE',
    };
    const recoveryCase = await createRecoveryCaseFromWizard(testPool, user.id, wizardInput);

    const result = await getEmergencyModeForCase(testPool, user.id, recoveryCase.id);

    expect(['CRITICAL', 'HIGH']).toContain(result.emergency.riskLevel);
    expect(result.emergency.isEmergency).toBe(true);
    expect(result.emergency.currentAction).not.toBeNull();
    expect(result.emergency.totalCount).toBeGreaterThan(0);
  });

  it('is not an emergency for a clean, low-risk case', async () => {
    const user = await createTestUser();
    const wizardInput: CreateRecoveryCaseWizardInput = {
      incidentType: 'LOST',
      device: { mode: 'new', nickname: 'My Phone', manufacturer: 'Google', model: 'Pixel 9', platform: 'ANDROID' },
      lastSeenAt: null,
      lastSeenDescription: null,
      accountAccessStatus: 'YES',
      simAccessStatus: 'ANOTHER_DEVICE_HAS_ACCESS',
      screenLockEnabled: 'YES',
      sensitiveApps: [],
      deviceFindingAvailable: 'YES',
    };
    const recoveryCase = await createRecoveryCaseFromWizard(testPool, user.id, wizardInput);

    const result = await getEmergencyModeForCase(testPool, user.id, recoveryCase.id);

    expect(result.emergency.isEmergency).toBe(false);
  });

  it('rejects a caseId belonging to another user', async () => {
    const user = await createTestUser();
    const otherUser = await createTestUser();
    const recoveryCase = await createRecoveryCaseFromWizard(testPool, user.id, {
      incidentType: 'STOLEN',
      device: { mode: 'new', nickname: 'My Phone', manufacturer: 'Apple', model: 'iPhone 16', platform: 'IPHONE' },
      lastSeenAt: null,
      lastSeenDescription: null,
      accountAccessStatus: 'NO',
      simAccessStatus: 'LOST_WITH_PHONE',
      screenLockEnabled: 'NO',
      sensitiveApps: [],
      deviceFindingAvailable: 'NO',
    });

    await expect(getEmergencyModeForCase(testPool, otherUser.id, recoveryCase.id)).rejects.toBeInstanceOf(NotFoundError);
  });
});
