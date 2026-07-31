import { describe, expect, it } from 'vitest';
import type { CreateRecoveryCaseWizardInput, RecoveryCaseId, UserId } from '@recoverai/shared';
import { createRecoveryCaseFromWizard } from '../../src/services/wizardAssessment/createRecoveryCaseFromWizard';
import {
  createFinancialProtectionItem,
  deleteFinancialProtectionItem,
  getFinancialSecurityState,
  updateFinancialProtectionItem,
} from '../../src/services/financialSecurity/updateFinancialSecurity';
import { gatherEngineInputForExistingCase } from '../../src/services/recoveryEngine/gatherEngineInputForExistingCase';
import { NotFoundError } from '../../src/lib/errors';
import { repos, createTestUser } from '../factories';
import { testPool } from '../setup';

const baseWizardInput: CreateRecoveryCaseWizardInput = {
  incidentType: 'STOLEN',
  device: { mode: 'new', nickname: 'My Phone', manufacturer: 'Google', model: 'Pixel 9', platform: 'ANDROID' },
  lastSeenAt: null,
  lastSeenDescription: null,
  accountAccessStatus: 'YES',
  simAccessStatus: 'ANOTHER_DEVICE_HAS_ACCESS',
  screenLockEnabled: 'NO',
  sensitiveApps: ['BANKING', 'UPI', 'PASSWORD_MANAGER'],
  deviceFindingAvailable: 'YES',
};

async function setUpCase(userId: UserId, overrides: Partial<CreateRecoveryCaseWizardInput> = {}) {
  return createRecoveryCaseFromWizard(testPool, userId, { ...baseWizardInput, ...overrides });
}

describe('getFinancialSecurityState', () => {
  it('seeds items from the wizard sensitiveApps checklist on first load', async () => {
    const user = await createTestUser();
    const recoveryCase = await setUpCase(user.id);

    const state = await getFinancialSecurityState(testPool, user.id, recoveryCase.id);

    const categories = state.items.map((i) => i.category).sort();
    expect(categories).toEqual(['BANKING_APP', 'PASSWORD_MANAGER', 'UPI']);
    expect(state.items.every((i) => i.status === 'NOT_STARTED')).toBe(true);
    expect(state.categoryGuides).toHaveLength(6);
  });

  it('never seeds digital wallets, saved cards, or banking email - those have no wizard equivalent', async () => {
    const user = await createTestUser();
    const recoveryCase = await setUpCase(user.id, { sensitiveApps: ['BANKING'] });

    const state = await getFinancialSecurityState(testPool, user.id, recoveryCase.id);

    expect(state.items.map((i) => i.category)).toEqual(['BANKING_APP']);
  });

  it('does not re-seed once the user has their own list, even if it differs from sensitiveApps', async () => {
    const user = await createTestUser();
    const recoveryCase = await setUpCase(user.id, { sensitiveApps: ['BANKING'] });

    await getFinancialSecurityState(testPool, user.id, recoveryCase.id); // triggers seeding
    await deleteAllItemsButOne(user.id, recoveryCase.id);

    const state = await getFinancialSecurityState(testPool, user.id, recoveryCase.id);
    expect(state.items).toHaveLength(1);
  });

  it('warns when the device may have been stolen while unlocked', async () => {
    const user = await createTestUser();
    const recoveryCase = await setUpCase(user.id, { incidentType: 'STOLEN', screenLockEnabled: 'NO' });

    const state = await getFinancialSecurityState(testPool, user.id, recoveryCase.id);

    expect(state.warnings.some((w) => w.includes('unlocked'))).toBe(true);
  });

  it('does not warn for a LOST case even if the screen lock was off', async () => {
    const user = await createTestUser();
    const recoveryCase = await setUpCase(user.id, { incidentType: 'LOST', screenLockEnabled: 'NO' });

    const state = await getFinancialSecurityState(testPool, user.id, recoveryCase.id);

    expect(state.warnings).toHaveLength(0);
  });
});

async function deleteAllItemsButOne(userId: UserId, caseId: RecoveryCaseId) {
  const items = await repos.financialProtectionItems.listByCase(caseId);
  for (const item of items.slice(1)) {
    await repos.financialProtectionItems.delete(item.id, userId);
  }
}

describe('financial protection item mutations', () => {
  it(
    'completes FINANCIAL_PROTECTION only once every item is confirmed, and reopens it if a new unconfirmed item appears',
    async () => {
      const user = await createTestUser();
      const recoveryCase = await setUpCase(user.id, { sensitiveApps: ['UPI'] });
      const device = await repos.devices.findById(recoveryCase.deviceId, user.id);
      if (!device) throw new Error('expected device');

      const seeded = await getFinancialSecurityState(testPool, user.id, recoveryCase.id);
      const upiItem = seeded.items.find((i) => i.category === 'UPI');
      if (!upiItem) throw new Error('expected seeded UPI item');

      const before = await gatherEngineInputForExistingCase(repos, recoveryCase, device);
      expect(before.input.financialAccountsSecured).toBe(false);

      const afterConfirm = await updateFinancialProtectionItem(testPool, user.id, recoveryCase.id, upiItem.id, {
        status: 'CONFIRMED_BY_USER',
      });
      const financialActionAfterConfirm = afterConfirm.recoveryPlan.orderedActions.find((a) => a.type === 'FINANCIAL_PROTECTION');
      expect(financialActionAfterConfirm?.status).toBe('COMPLETED');

      const reloadedCase = await repos.recoveryCases.findById(recoveryCase.id, user.id);
      if (!reloadedCase) throw new Error('expected case');
      const afterSecured = await gatherEngineInputForExistingCase(repos, reloadedCase, device);
      expect(afterSecured.input.financialAccountsSecured).toBe(true);

      const events = await repos.timelineEvents.listByCase(recoveryCase.id);
      expect(events.some((e) => e.type === 'FINANCIAL_PROTECTION_COMPLETED')).toBe(true);

      const afterNewItem = await createFinancialProtectionItem(testPool, user.id, recoveryCase.id, { category: 'SAVED_CARD' });
      const financialActionReopened = afterNewItem.recoveryPlan.orderedActions.find((a) => a.type === 'FINANCIAL_PROTECTION');
      expect(financialActionReopened?.status).not.toBe('COMPLETED');
    },
    45000,
  );

  it('rejects creating an item on a caseId belonging to another user', async () => {
    const user = await createTestUser();
    const recoveryCase = await setUpCase(user.id);
    const otherUser = await createTestUser();

    await expect(
      createFinancialProtectionItem(testPool, otherUser.id, recoveryCase.id, { category: 'UPI' }),
    ).rejects.toBeInstanceOf(NotFoundError);
  });

  it('rejects updating or deleting an item belonging to another user', async () => {
    const user = await createTestUser();
    const recoveryCase = await setUpCase(user.id, { sensitiveApps: ['UPI'] });
    const seeded = await getFinancialSecurityState(testPool, user.id, recoveryCase.id);
    const item = seeded.items[0];
    if (!item) throw new Error('expected a seeded item');
    const otherUser = await createTestUser();

    await expect(
      updateFinancialProtectionItem(testPool, otherUser.id, recoveryCase.id, item.id, { status: 'CONFIRMED_BY_USER' }),
    ).rejects.toBeInstanceOf(NotFoundError);
    await expect(deleteFinancialProtectionItem(testPool, otherUser.id, recoveryCase.id, item.id)).rejects.toBeInstanceOf(NotFoundError);
  });
});
