import { describe, expect, it } from 'vitest';
import type { CreateRecoveryCaseWizardInput, UserId } from '@recoverai/shared';
import { createRecoveryCaseFromWizard } from '../../src/services/wizardAssessment/createRecoveryCaseFromWizard';
import { checkReminderNotifications } from '../../src/services/notifications/reminderChecks';
import { repos, createTestUser } from '../factories';
import { testPool } from '../setup';

/**
 * `set_updated_at()` is a BEFORE UPDATE trigger on every table (see
 * 0001_extensions_and_functions.sql) that unconditionally forces
 * `updated_at = now()`, overriding any value the UPDATE statement tries to
 * set. Backdating updated_at for a reminder test has to disable it for that
 * one write, or the trigger silently stamps "now" right back in.
 */
async function backdateUpdatedAt(table: string, id: string, when: Date): Promise<void> {
  await testPool.query(`ALTER TABLE ${table} DISABLE TRIGGER trg_${table}_updated_at`);
  try {
    await testPool.query(`UPDATE ${table} SET updated_at = $1 WHERE id = $2`, [when.toISOString(), id]);
  } finally {
    await testPool.query(`ALTER TABLE ${table} ENABLE TRIGGER trg_${table}_updated_at`);
  }
}

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

const EIGHT_DAYS_AGO = new Date(Date.now() - 8 * 24 * 60 * 60 * 1000);
const FOUR_DAYS_AGO = new Date(Date.now() - 4 * 24 * 60 * 60 * 1000);
const THREE_DAYS_AGO = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000);

describe('checkReminderNotifications', () => {
  it(
    'creates CASE_INACTIVITY once a case has been untouched for over a week, and not again within the cooldown',
    async () => {
      const user = await createTestUser();
      const recoveryCase = await setUpCase(user.id);
      await backdateUpdatedAt('recovery_cases', recoveryCase.id, EIGHT_DAYS_AGO);

      await checkReminderNotifications(repos, user.id);
      const events = await repos.notifications.listByUser(user.id);
      expect(events.filter((n) => n.type === 'CASE_INACTIVITY')).toHaveLength(1);

      // Running it again immediately must not duplicate - the cooldown window covers "just created".
      await checkReminderNotifications(repos, user.id);
      const eventsAfter = await repos.notifications.listByUser(user.id);
      expect(eventsAfter.filter((n) => n.type === 'CASE_INACTIVITY')).toHaveLength(1);
    },
    30000,
  );

  it('does not create CASE_INACTIVITY for a recently-updated case', async () => {
    const user = await createTestUser();
    await setUpCase(user.id);

    await checkReminderNotifications(repos, user.id);
    const events = await repos.notifications.listByUser(user.id);
    expect(events.some((n) => n.type === 'CASE_INACTIVITY')).toBe(false);
  });

  it(
    'creates CEIR_FOLLOWUP_REMINDER once a SUBMITTED CEIR record has been quiet for a few days',
    async () => {
      const user = await createTestUser();
      const recoveryCase = await setUpCase(user.id);
      const ceir = await repos.ceirRecords.getOrCreateForCase(recoveryCase.id);
      await repos.ceirRecords.update(ceir.id, user.id, { status: 'SUBMITTED', ceirRequestId: 'REQ-1' });
      await backdateUpdatedAt('ceir_records', ceir.id, FOUR_DAYS_AGO);

      await checkReminderNotifications(repos, user.id);
      const events = await repos.notifications.listByUser(user.id);
      expect(events.some((n) => n.type === 'CEIR_FOLLOWUP_REMINDER')).toBe(true);
    },
    30000,
  );

  it('does not create CEIR_FOLLOWUP_REMINDER when there is no CEIR record, or it is not SUBMITTED/PROCESSING', async () => {
    const user = await createTestUser();
    await setUpCase(user.id);

    await checkReminderNotifications(repos, user.id);
    const events = await repos.notifications.listByUser(user.id);
    expect(events.some((n) => n.type === 'CEIR_FOLLOWUP_REMINDER')).toBe(false);
  });

  it(
    'creates EVIDENCE_REMINDER once an older case still has an open EVIDENCE_COLLECTION action',
    async () => {
      const user = await createTestUser();
      const recoveryCase = await setUpCase(user.id);
      await testPool.query('UPDATE recovery_cases SET created_at = $1 WHERE id = $2', [THREE_DAYS_AGO.toISOString(), recoveryCase.id]);

      const actions = await repos.recoveryActions.listByCase(recoveryCase.id);
      const evidenceAction = actions.find((a) => a.type === 'EVIDENCE_COLLECTION');
      expect(evidenceAction).toBeDefined();

      await checkReminderNotifications(repos, user.id);
      const events = await repos.notifications.listByUser(user.id);
      expect(events.some((n) => n.type === 'EVIDENCE_REMINDER')).toBe(true);
    },
    30000,
  );

  it(
    'does not create EVIDENCE_REMINDER once the EVIDENCE_COLLECTION action is completed',
    async () => {
      const user = await createTestUser();
      const recoveryCase = await setUpCase(user.id);
      await testPool.query('UPDATE recovery_cases SET created_at = $1 WHERE id = $2', [THREE_DAYS_AGO.toISOString(), recoveryCase.id]);

      const actions = await repos.recoveryActions.listByCase(recoveryCase.id);
      const evidenceAction = actions.find((a) => a.type === 'EVIDENCE_COLLECTION');
      await repos.recoveryActions.updateStatus(evidenceAction!.id, user.id, 'COMPLETED');

      await checkReminderNotifications(repos, user.id);
      const events = await repos.notifications.listByUser(user.id);
      expect(events.some((n) => n.type === 'EVIDENCE_REMINDER')).toBe(false);
    },
    30000,
  );

  it(
    'never checks a terminal (CLOSED/RECOVERED/ERASED) case',
    async () => {
      const user = await createTestUser();
      const recoveryCase = await setUpCase(user.id);
      await testPool.query('UPDATE recovery_cases SET updated_at = $1, status = $2 WHERE id = $3', [
        EIGHT_DAYS_AGO.toISOString(),
        'CLOSED',
        recoveryCase.id,
      ]);

      await checkReminderNotifications(repos, user.id);
      const events = await repos.notifications.listByUser(user.id);
      expect(events.some((n) => n.type === 'CASE_INACTIVITY')).toBe(false);
    },
    30000,
  );
});
