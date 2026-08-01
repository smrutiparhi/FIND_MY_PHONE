import type { NotificationPreferences, NotificationType } from '@recoverai/shared';

/** "Except for user-selected critical recovery alerts" (master spec) - the one type that can never be muted or quieted. */
const NON_MUTABLE_TYPES: readonly NotificationType[] = ['CRITICAL_ACTION_PENDING'];

export function isMutableNotificationType(type: NotificationType): boolean {
  return !NON_MUTABLE_TYPES.includes(type);
}

function getMinuteOfDayInTimezone(date: Date, timezone: string): number {
  try {
    const parts = new Intl.DateTimeFormat('en-US', { timeZone: timezone, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(
      date,
    );
    const hour = Number(parts.find((p) => p.type === 'hour')?.value ?? '0');
    const minute = Number(parts.find((p) => p.type === 'minute')?.value ?? '0');
    return hour * 60 + minute;
  } catch {
    // Invalid/unknown timezone string - fail open (report "not quiet") rather than silently
    // guessing at the user's intent from an unrelated timezone.
    return date.getUTCHours() * 60 + date.getUTCMinutes();
  }
}

/** Handles an overnight window (e.g. 22:00-06:00) as `start > end` rather than needing timezone-aware date arithmetic. */
export function isWithinQuietHours(prefs: NotificationPreferences, now: Date = new Date()): boolean {
  if (!prefs.quietHoursEnabled || prefs.quietHoursStartMinute == null || prefs.quietHoursEndMinute == null) return false;
  const { quietHoursStartMinute: start, quietHoursEndMinute: end } = prefs;
  if (start === end) return false;

  const minuteOfDay = getMinuteOfDayInTimezone(now, prefs.timezone ?? 'UTC');
  return start < end ? minuteOfDay >= start && minuteOfDay < end : minuteOfDay >= start || minuteOfDay < end;
}

/**
 * "Allow notification preferences and quiet settings except for
 * user-selected critical recovery alerts" (master spec, verbatim) - the one
 * gate every in-app notification passes through before it's ever written to
 * the database.
 */
export function shouldCreateNotification(prefs: NotificationPreferences, type: NotificationType, now: Date = new Date()): boolean {
  if (!isMutableNotificationType(type)) return true;
  if (prefs.mutedTypes.includes(type)) return false;
  if (isWithinQuietHours(prefs, now)) return false;
  return true;
}
