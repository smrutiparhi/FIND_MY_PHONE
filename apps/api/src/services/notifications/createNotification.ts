import type { Notification, NotificationType, RecoveryCaseId, UserId } from '@recoverai/shared';
import type { Repositories } from '../../db/repositories';
import { logger } from '../../lib/logger';
import { shouldCreateNotification } from './notificationPreferences';
import { getNotificationChannelProviders } from './channels/getNotificationChannelProviders';

export interface CreateNotificationInput {
  userId: UserId;
  caseId?: RecoveryCaseId | null;
  type: NotificationType;
  title: string;
  body: string;
}

/**
 * The one place every notification in this app gets created - every call
 * site (Recovery Decision Engine, Account Recovery, SIM Protection, Device
 * Recovered, the reminder checks) goes through this instead of
 * `repos.notifications.create()` directly, so the preferences/quiet-hours
 * gate (`shouldCreateNotification`) and the best-effort channel fan-out
 * apply everywhere uniformly. Takes an already-bound `Repositories` rather
 * than a `Pool` so it composes into a caller's existing transaction (e.g.
 * applyEngineResult.ts, which runs inside recalculateRecoveryCase's own
 * transaction) instead of opening a second connection.
 *
 * Returns `null` when the notification was suppressed by preferences/quiet
 * hours, or when the case is a Part 22 Demo Mode case - never an error,
 * since both are normal, expected outcomes, not failures. Demo cases never
 * produce a real notification (in-app or emailed): a fictional "SIM
 * blocked" alert has no business mixing into a user's real notification
 * list, and Demo Mode must never send anything to a real external account
 * (the master spec, verbatim) - checked here, once, rather than trusting
 * every one of the half-dozen call sites to remember to skip demo cases.
 */
export async function createNotification(repos: Repositories, input: CreateNotificationInput): Promise<Notification | null> {
  if (input.caseId) {
    const recoveryCase = await repos.recoveryCases.findById(input.caseId, input.userId);
    if (recoveryCase?.isDemo) return null;
  }

  const prefs = await repos.notificationPreferences.getOrCreateForUser(input.userId);
  if (!shouldCreateNotification(prefs, input.type)) return null;

  const notification = await repos.notifications.create({
    userId: input.userId,
    caseId: input.caseId ?? null,
    type: input.type,
    title: input.title,
    body: input.body,
  });

  // Best-effort only - a channel-send failure must never roll back or block the in-app
  // notification that already exists. Only email has a real address to send to (the user's own,
  // already collected for auth); push/SMS have no token/number storage anywhere in this app yet,
  // so their providers stay unwired rather than being called with a fabricated destination.
  if (prefs.emailEnabled) {
    void sendEmailBestEffort(repos, input.userId, notification.title, notification.body);
  }

  return notification;
}

async function sendEmailBestEffort(repos: Repositories, userId: UserId, title: string, body: string): Promise<void> {
  try {
    const user = await repos.users.findById(userId);
    if (!user) return;
    const result = await getNotificationChannelProviders().email.send({ to: user.email, title, body });
    if (result.status === 'error') {
      logger.warn({ userId, message: result.message }, 'Email notification send failed');
    }
  } catch (err) {
    logger.warn({ err, userId }, 'Email notification send threw unexpectedly');
  }
}
