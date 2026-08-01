import type { Pool } from 'pg';
import type {
  Notification,
  NotificationId,
  NotificationListState,
  NotificationPreferences,
  UpdateNotificationPreferencesInput,
  UserId,
} from '@recoverai/shared';
import { createRepositories } from '../../db/repositories';
import { NotFoundError } from '../../lib/errors';
import { logger } from '../../lib/logger';
import { checkReminderNotifications } from './reminderChecks';
import { isMutableNotificationType } from './notificationPreferences';

/**
 * Runs the time-elapsed reminder checks (case inactivity, CEIR follow-up,
 * evidence reminder - see reminderChecks.ts) before returning the list, so
 * opening notifications is the real, user-driven "tick" those reminders
 * run on. A failure there is logged and swallowed rather than breaking the
 * list itself - a missed reminder this one time is far less bad than an
 * error page.
 */
export async function listNotifications(
  pool: Pool,
  userId: UserId,
  options: { unreadOnly?: boolean } = {},
): Promise<NotificationListState> {
  const repos = createRepositories(pool);

  await checkReminderNotifications(repos, userId).catch((err: unknown) => {
    logger.warn({ err, userId }, 'Reminder notification check failed');
  });

  const [notifications, unreadCount, preferences] = await Promise.all([
    repos.notifications.listByUser(userId, options),
    repos.notifications.countUnread(userId),
    repos.notificationPreferences.getOrCreateForUser(userId),
  ]);

  return { notifications, unreadCount, preferences };
}

export async function markNotificationRead(pool: Pool, userId: UserId, notificationId: NotificationId): Promise<Notification> {
  const repos = createRepositories(pool);
  const updated = await repos.notifications.markRead(notificationId, userId);
  if (!updated) throw new NotFoundError('Notification not found');
  return updated;
}

export async function markAllNotificationsRead(pool: Pool, userId: UserId): Promise<{ markedCount: number }> {
  const repos = createRepositories(pool);
  const markedCount = await repos.notifications.markAllRead(userId);
  return { markedCount };
}

export async function getNotificationPreferences(pool: Pool, userId: UserId): Promise<NotificationPreferences> {
  const repos = createRepositories(pool);
  return repos.notificationPreferences.getOrCreateForUser(userId);
}

/**
 * "Except for user-selected critical recovery alerts" - CRITICAL_ACTION_PENDING is silently
 * stripped from any mutedTypes the client sends rather than rejecting the whole request, since a
 * client naively sending "select all" from a type list would otherwise get a confusing error for
 * doing something the UI itself should already prevent.
 */
export async function updateNotificationPreferences(
  pool: Pool,
  userId: UserId,
  input: UpdateNotificationPreferencesInput,
): Promise<NotificationPreferences> {
  const repos = createRepositories(pool);
  const sanitized: UpdateNotificationPreferencesInput = {
    ...input,
    mutedTypes: input.mutedTypes?.filter(isMutableNotificationType),
  };
  return repos.notificationPreferences.update(userId, sanitized);
}
