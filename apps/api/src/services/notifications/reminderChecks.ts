import type { RecoveryCase, UserId } from '@recoverai/shared';
import type { Repositories } from '../../db/repositories';
import { createNotification } from './createNotification';

const TERMINAL_STATUSES = new Set(['RECOVERED', 'ERASED', 'CLOSED']);
const MS_PER_DAY = 24 * 60 * 60 * 1000;

const CASE_INACTIVITY_THRESHOLD_MS = 7 * MS_PER_DAY;
const CEIR_FOLLOWUP_THRESHOLD_MS = 3 * MS_PER_DAY;
const EVIDENCE_REMINDER_THRESHOLD_MS = 2 * MS_PER_DAY;
/** Shared minimum gap between two reminders of the same type on the same case - generous enough that opening the notification list repeatedly never spams. */
const REMINDER_COOLDOWN_MS = 3 * MS_PER_DAY;

/**
 * "Case inactivity, CEIR follow-up reminder, evidence reminder" (master
 * spec) are the three time-elapsed reminder types - unlike the other four
 * notification types, which fire on a real, immediate state change, these
 * only make sense relative to "how long has it been". This app has no
 * background job scheduler anywhere, so rather than invent one for just
 * these three, they're checked opportunistically whenever the user opens
 * their notification list (see notificationService.ts's listNotifications)
 * - a real user action, not a fabricated timer. A failure checking one case
 * never blocks the others or the list itself.
 */
export async function checkReminderNotifications(repos: Repositories, userId: UserId): Promise<void> {
  const now = new Date();
  const cases = await repos.recoveryCases.listByUser(userId);
  const activeCases = cases.filter((c) => !TERMINAL_STATUSES.has(c.status));

  for (const recoveryCase of activeCases) {
    await checkCaseInactivity(repos, userId, recoveryCase, now);
    await checkCeirFollowup(repos, userId, recoveryCase, now);
    await checkEvidenceReminder(repos, userId, recoveryCase, now);
  }
}

async function recentlyReminded(repos: Repositories, caseId: RecoveryCase['id'], type: 'CASE_INACTIVITY' | 'CEIR_FOLLOWUP_REMINDER' | 'EVIDENCE_REMINDER', now: Date): Promise<boolean> {
  return repos.notifications.existsRecentForCase(caseId, type, new Date(now.getTime() - REMINDER_COOLDOWN_MS));
}

async function checkCaseInactivity(repos: Repositories, userId: UserId, recoveryCase: RecoveryCase, now: Date): Promise<void> {
  if (now.getTime() - new Date(recoveryCase.updatedAt).getTime() < CASE_INACTIVITY_THRESHOLD_MS) return;
  if (await recentlyReminded(repos, recoveryCase.id, 'CASE_INACTIVITY', now)) return;

  await createNotification(repos, {
    userId,
    caseId: recoveryCase.id,
    type: 'CASE_INACTIVITY',
    title: 'This case has been quiet for a while',
    body: "No updates have been recorded on this case in over a week - check in and see if anything needs attention.",
  });
}

async function checkCeirFollowup(repos: Repositories, userId: UserId, recoveryCase: RecoveryCase, now: Date): Promise<void> {
  const ceirRecord = await repos.ceirRecords.findByCase(recoveryCase.id);
  if (!ceirRecord || (ceirRecord.status !== 'SUBMITTED' && ceirRecord.status !== 'PROCESSING')) return;
  if (now.getTime() - new Date(ceirRecord.updatedAt).getTime() < CEIR_FOLLOWUP_THRESHOLD_MS) return;
  if (await recentlyReminded(repos, recoveryCase.id, 'CEIR_FOLLOWUP_REMINDER', now)) return;

  await createNotification(repos, {
    userId,
    caseId: recoveryCase.id,
    type: 'CEIR_FOLLOWUP_REMINDER',
    title: 'Check on your CEIR request',
    body: `Your CEIR request has been ${ceirRecord.status.toLowerCase()} for a few days - it may be worth checking its status on the CEIR portal.`,
  });
}

async function checkEvidenceReminder(repos: Repositories, userId: UserId, recoveryCase: RecoveryCase, now: Date): Promise<void> {
  if (now.getTime() - new Date(recoveryCase.createdAt).getTime() < EVIDENCE_REMINDER_THRESHOLD_MS) return;
  const actions = await repos.recoveryActions.listByCase(recoveryCase.id);
  const evidenceAction = actions.find((a) => a.type === 'EVIDENCE_COLLECTION');
  if (!evidenceAction || evidenceAction.status === 'COMPLETED' || evidenceAction.status === 'SKIPPED') return;
  if (await recentlyReminded(repos, recoveryCase.id, 'EVIDENCE_REMINDER', now)) return;

  await createNotification(repos, {
    userId,
    caseId: recoveryCase.id,
    type: 'EVIDENCE_REMINDER',
    title: "Save evidence while it's still fresh",
    body: 'Receipts, screenshots, and notes about what happened are easier to gather now than later - add anything you have to the Evidence Vault.',
  });
}
