import { describe, expect, it } from 'vitest';
import { createNotification } from '../../src/services/notifications/createNotification';
import {
  getNotificationPreferences,
  listNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  updateNotificationPreferences,
} from '../../src/services/notifications/notificationService';
import { NotFoundError } from '../../src/lib/errors';
import { repos, createTestUser } from '../factories';
import { testPool } from '../setup';

describe('createNotification (via the service layer)', () => {
  it('creates an in-app row that shows up in listNotifications', async () => {
    const user = await createTestUser();
    const created = await createNotification(repos, {
      userId: user.id,
      type: 'SIM_STATUS_UPDATE',
      title: 'Test notification',
      body: 'Body text',
    });
    expect(created).not.toBeNull();

    const state = await listNotifications(testPool, user.id);
    expect(state.notifications.some((n) => n.id === created!.id)).toBe(true);
    expect(state.unreadCount).toBeGreaterThanOrEqual(1);
  });

  it('is suppressed (returns null, creates no row) for a muted mutable type', async () => {
    const user = await createTestUser();
    await updateNotificationPreferences(testPool, user.id, { mutedTypes: ['CASE_INACTIVITY'] });

    const created = await createNotification(repos, {
      userId: user.id,
      type: 'CASE_INACTIVITY',
      title: 'Should be suppressed',
      body: 'Body text',
    });
    expect(created).toBeNull();

    const state = await listNotifications(testPool, user.id);
    expect(state.notifications.some((n) => n.title === 'Should be suppressed')).toBe(false);
  });

  it('CRITICAL_ACTION_PENDING is never suppressed, even if the client tries to mute it', async () => {
    const user = await createTestUser();
    // updateNotificationPreferences itself strips CRITICAL_ACTION_PENDING from mutedTypes - confirms the whole path, not just the pure function.
    await updateNotificationPreferences(testPool, user.id, { mutedTypes: ['CRITICAL_ACTION_PENDING'] });
    const prefs = await getNotificationPreferences(testPool, user.id);
    expect(prefs.mutedTypes).not.toContain('CRITICAL_ACTION_PENDING');

    const created = await createNotification(repos, {
      userId: user.id,
      type: 'CRITICAL_ACTION_PENDING',
      title: 'Critical',
      body: 'Body text',
    });
    expect(created).not.toBeNull();
  });
});

describe('markNotificationRead / markAllNotificationsRead', () => {
  it(
    'marks a single notification read, and rejects one belonging to another user',
    async () => {
      const user = await createTestUser();
      const other = await createTestUser();
      const created = await createNotification(repos, { userId: user.id, type: 'SIM_STATUS_UPDATE', title: 'T', body: 'B' });

      const updated = await markNotificationRead(testPool, user.id, created!.id);
      expect(updated.isRead).toBe(true);
      expect(updated.readAt).not.toBeNull();

      await expect(markNotificationRead(testPool, other.id, created!.id)).rejects.toBeInstanceOf(NotFoundError);
    },
    30000,
  );

  it('marks every unread notification read at once, scoped to the requesting user', async () => {
    const user = await createTestUser();
    const other = await createTestUser();
    await createNotification(repos, { userId: user.id, type: 'SIM_STATUS_UPDATE', title: 'T1', body: 'B' });
    await createNotification(repos, { userId: user.id, type: 'ACCOUNT_RECOVERY_UPDATE', title: 'T2', body: 'B' });
    await createNotification(repos, { userId: other.id, type: 'SIM_STATUS_UPDATE', title: 'Other user', body: 'B' });

    const result = await markAllNotificationsRead(testPool, user.id);
    expect(result.markedCount).toBe(2);

    const otherState = await listNotifications(testPool, other.id);
    expect(otherState.unreadCount).toBe(1); // untouched by the first user's mark-all
  });
});

describe('updateNotificationPreferences', () => {
  it('persists muted types, quiet hours, and timezone', async () => {
    const user = await createTestUser();
    const updated = await updateNotificationPreferences(testPool, user.id, {
      mutedTypes: ['EVIDENCE_REMINDER', 'CASE_INACTIVITY'],
      quietHoursEnabled: true,
      quietHoursStartMinute: 1320,
      quietHoursEndMinute: 360,
      timezone: 'Asia/Kolkata',
    });
    expect(updated.mutedTypes).toEqual(['EVIDENCE_REMINDER', 'CASE_INACTIVITY']);
    expect(updated.quietHoursEnabled).toBe(true);
    expect(updated.quietHoursStartMinute).toBe(1320);
    expect(updated.timezone).toBe('Asia/Kolkata');
  });

  it('an update that omits a field never wipes what was already recorded for it', async () => {
    const user = await createTestUser();
    await updateNotificationPreferences(testPool, user.id, { timezone: 'Asia/Kolkata' });
    const result = await updateNotificationPreferences(testPool, user.id, { emailEnabled: true });
    expect(result.timezone).toBe('Asia/Kolkata');
    expect(result.emailEnabled).toBe(true);
  });
});
