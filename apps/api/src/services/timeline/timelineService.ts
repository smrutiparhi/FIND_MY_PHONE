import type { Pool } from 'pg';
import type {
  CaseSummaryExport,
  CreateTimelineNoteInput,
  RecoveryCaseId,
  TimelineEvent,
  TimelineEventId,
  TimelineOrder,
  UpdateTimelineNoteInput,
  UserId,
} from '@recoverai/shared';
import { createRepositories } from '../../db/repositories';
import { ForbiddenError, NotFoundError } from '../../lib/errors';
import { buildSanitizedCaseSummary } from './buildSanitizedCaseSummary';

export async function listTimeline(
  pool: Pool,
  userId: UserId,
  caseId: RecoveryCaseId,
  order: TimelineOrder = 'desc',
): Promise<TimelineEvent[]> {
  const repos = createRepositories(pool);
  const recoveryCase = await repos.recoveryCases.findById(caseId, userId);
  if (!recoveryCase) throw new NotFoundError('Recovery case not found');
  return repos.timelineEvents.listByCase(caseId, order === 'asc' ? 'ASC' : 'DESC');
}

export async function addTimelineNote(
  pool: Pool,
  userId: UserId,
  caseId: RecoveryCaseId,
  input: CreateTimelineNoteInput,
): Promise<TimelineEvent> {
  const repos = createRepositories(pool);
  const recoveryCase = await repos.recoveryCases.findById(caseId, userId);
  if (!recoveryCase) throw new NotFoundError('Recovery case not found');

  return repos.timelineEvents.create({
    caseId,
    type: 'USER_NOTE',
    title: input.title,
    description: input.description ?? null,
    source: 'USER',
    verificationStatus: 'USER_REPORTED',
    createdByUserId: userId,
  });
}

/**
 * "Prevent users from modifying immutable system audit events" (master
 * spec) - the repository already guards this at the SQL level
 * (`type = 'USER_NOTE'` in the WHERE clause), so a mismatched type simply
 * updates/deletes zero rows. Checking the type here first turns that into
 * an explicit 403 instead of a misleading 404, so a client - or a user
 * poking at the API directly - gets a clear "this is immutable" signal
 * rather than "not found".
 */
async function requireOwnedUserNote(
  repos: ReturnType<typeof createRepositories>,
  userId: UserId,
  caseId: RecoveryCaseId,
  eventId: TimelineEventId,
): Promise<TimelineEvent> {
  const event = await repos.timelineEvents.findByIdForUser(eventId, userId);
  if (!event || event.caseId !== caseId) throw new NotFoundError('Timeline event not found');
  if (event.type !== 'USER_NOTE') throw new ForbiddenError('System timeline events cannot be modified or deleted');
  return event;
}

export async function updateTimelineNote(
  pool: Pool,
  userId: UserId,
  caseId: RecoveryCaseId,
  eventId: TimelineEventId,
  input: UpdateTimelineNoteInput,
): Promise<TimelineEvent> {
  const repos = createRepositories(pool);
  await requireOwnedUserNote(repos, userId, caseId, eventId);

  const updated = await repos.timelineEvents.updateUserNote(eventId, userId, {
    title: input.title,
    description: input.description ?? null,
  });
  if (!updated) throw new NotFoundError('Timeline event not found');
  return updated;
}

export async function deleteTimelineNote(pool: Pool, userId: UserId, caseId: RecoveryCaseId, eventId: TimelineEventId): Promise<void> {
  const repos = createRepositories(pool);
  await requireOwnedUserNote(repos, userId, caseId, eventId);

  const deleted = await repos.timelineEvents.deleteUserNote(eventId, userId);
  if (!deleted) throw new NotFoundError('Timeline event not found');
}

export async function exportCaseSummary(pool: Pool, userId: UserId, caseId: RecoveryCaseId): Promise<CaseSummaryExport> {
  const repos = createRepositories(pool);
  const recoveryCase = await repos.recoveryCases.findById(caseId, userId);
  if (!recoveryCase) throw new NotFoundError('Recovery case not found');
  const device = await repos.devices.findById(recoveryCase.deviceId, userId);
  if (!device) throw new NotFoundError('Device not found');
  const events = await repos.timelineEvents.listByCase(caseId, 'ASC');

  return { summary: buildSanitizedCaseSummary({ recoveryCase, device, events }), generatedAt: new Date().toISOString() };
}
