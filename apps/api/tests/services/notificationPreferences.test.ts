import { describe, expect, it } from 'vitest';
import type { NotificationPreferences } from '@recoverai/shared';
import {
  isMutableNotificationType,
  isWithinQuietHours,
  shouldCreateNotification,
} from '../../src/services/notifications/notificationPreferences';

function basePrefs(overrides: Partial<NotificationPreferences> = {}): NotificationPreferences {
  return {
    id: 'pref-1' as NotificationPreferences['id'],
    userId: 'user-1' as NotificationPreferences['userId'],
    mutedTypes: [],
    emailEnabled: false,
    pushEnabled: false,
    smsEnabled: false,
    quietHoursEnabled: false,
    quietHoursStartMinute: null,
    quietHoursEndMinute: null,
    timezone: null,
    createdAt: '2026-07-01T00:00:00.000Z',
    updatedAt: '2026-07-01T00:00:00.000Z',
    ...overrides,
  };
}

describe('isMutableNotificationType', () => {
  it('CRITICAL_ACTION_PENDING is the only non-mutable type', () => {
    expect(isMutableNotificationType('CRITICAL_ACTION_PENDING')).toBe(false);
    expect(isMutableNotificationType('ACCOUNT_RECOVERY_UPDATE')).toBe(true);
    expect(isMutableNotificationType('CASE_INACTIVITY')).toBe(true);
  });
});

describe('isWithinQuietHours', () => {
  it('is false when quiet hours are disabled', () => {
    const prefs = basePrefs({ quietHoursEnabled: false, quietHoursStartMinute: 60, quietHoursEndMinute: 120 });
    expect(isWithinQuietHours(prefs, new Date('2026-07-15T01:30:00.000Z'))).toBe(false);
  });

  it('handles a same-day window (e.g. 09:00-17:00 UTC)', () => {
    const prefs = basePrefs({ quietHoursEnabled: true, quietHoursStartMinute: 9 * 60, quietHoursEndMinute: 17 * 60, timezone: 'UTC' });
    expect(isWithinQuietHours(prefs, new Date('2026-07-15T12:00:00.000Z'))).toBe(true);
    expect(isWithinQuietHours(prefs, new Date('2026-07-15T20:00:00.000Z'))).toBe(false);
  });

  it('handles an overnight window that wraps past midnight (e.g. 22:00-06:00 UTC)', () => {
    const prefs = basePrefs({ quietHoursEnabled: true, quietHoursStartMinute: 22 * 60, quietHoursEndMinute: 6 * 60, timezone: 'UTC' });
    expect(isWithinQuietHours(prefs, new Date('2026-07-15T23:00:00.000Z'))).toBe(true);
    expect(isWithinQuietHours(prefs, new Date('2026-07-15T02:00:00.000Z'))).toBe(true);
    expect(isWithinQuietHours(prefs, new Date('2026-07-15T12:00:00.000Z'))).toBe(false);
  });

  it('is false for a zero-length window (start equals end)', () => {
    const prefs = basePrefs({ quietHoursEnabled: true, quietHoursStartMinute: 60, quietHoursEndMinute: 60, timezone: 'UTC' });
    expect(isWithinQuietHours(prefs, new Date('2026-07-15T01:00:00.000Z'))).toBe(false);
  });
});

describe('shouldCreateNotification', () => {
  it('CRITICAL_ACTION_PENDING is always created, even when muted or during quiet hours', () => {
    const prefs = basePrefs({
      mutedTypes: ['CRITICAL_ACTION_PENDING'] as never,
      quietHoursEnabled: true,
      quietHoursStartMinute: 0,
      quietHoursEndMinute: 1439,
      timezone: 'UTC',
    });
    expect(shouldCreateNotification(prefs, 'CRITICAL_ACTION_PENDING', new Date('2026-07-15T12:00:00.000Z'))).toBe(true);
  });

  it('suppresses a muted mutable type', () => {
    const prefs = basePrefs({ mutedTypes: ['CASE_INACTIVITY'] });
    expect(shouldCreateNotification(prefs, 'CASE_INACTIVITY', new Date('2026-07-15T12:00:00.000Z'))).toBe(false);
  });

  it('suppresses a non-critical type during quiet hours', () => {
    const prefs = basePrefs({ quietHoursEnabled: true, quietHoursStartMinute: 0, quietHoursEndMinute: 1439, timezone: 'UTC' });
    expect(shouldCreateNotification(prefs, 'EVIDENCE_REMINDER', new Date('2026-07-15T12:00:00.000Z'))).toBe(false);
  });

  it('allows a non-muted, non-critical type outside quiet hours', () => {
    const prefs = basePrefs();
    expect(shouldCreateNotification(prefs, 'SIM_STATUS_UPDATE', new Date('2026-07-15T12:00:00.000Z'))).toBe(true);
  });
});
