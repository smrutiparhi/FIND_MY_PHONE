import type { Request, Response } from 'express';
import type {
  ApiSuccessResponse,
  CaseSummaryExport,
  CreateTimelineNoteInput,
  RecoveryCaseId,
  TimelineEvent,
  TimelineEventId,
  TimelineOrder,
  UpdateTimelineNoteInput,
} from '@recoverai/shared';
import { getPool } from '../db/pool';
import { UnauthorizedError } from '../lib/errors';
import {
  addTimelineNote,
  deleteTimelineNote,
  exportCaseSummary,
  listTimeline,
  updateTimelineNote,
} from '../services/timeline/timelineService';

function requirePool() {
  const pool = getPool();
  if (!pool) throw new Error('DATABASE_URL must be configured to use the case Timeline.');
  return pool;
}

export async function getTimeline(
  req: Request<{ caseId: string }, unknown, unknown, { order?: TimelineOrder }>,
  res: Response<ApiSuccessResponse<TimelineEvent[]>>,
): Promise<void> {
  if (!req.user) throw new UnauthorizedError();
  const caseId = req.params.caseId as RecoveryCaseId;
  const events = await listTimeline(requirePool(), req.user.id, caseId, req.query.order ?? 'desc');
  res.status(200).json({ success: true, data: events });
}

export async function postTimelineNote(
  req: Request<{ caseId: string }, unknown, CreateTimelineNoteInput>,
  res: Response<ApiSuccessResponse<TimelineEvent>>,
): Promise<void> {
  if (!req.user) throw new UnauthorizedError();
  const caseId = req.params.caseId as RecoveryCaseId;
  const event = await addTimelineNote(requirePool(), req.user.id, caseId, req.body);
  res.status(201).json({ success: true, data: event });
}

export async function patchTimelineNote(
  req: Request<{ caseId: string; eventId: string }, unknown, UpdateTimelineNoteInput>,
  res: Response<ApiSuccessResponse<TimelineEvent>>,
): Promise<void> {
  if (!req.user) throw new UnauthorizedError();
  const caseId = req.params.caseId as RecoveryCaseId;
  const eventId = req.params.eventId as TimelineEventId;
  const event = await updateTimelineNote(requirePool(), req.user.id, caseId, eventId, req.body);
  res.status(200).json({ success: true, data: event });
}

export async function deleteTimelineNoteHandler(
  req: Request<{ caseId: string; eventId: string }>,
  res: Response<ApiSuccessResponse<{ deleted: true }>>,
): Promise<void> {
  if (!req.user) throw new UnauthorizedError();
  const caseId = req.params.caseId as RecoveryCaseId;
  const eventId = req.params.eventId as TimelineEventId;
  await deleteTimelineNote(requirePool(), req.user.id, caseId, eventId);
  res.status(200).json({ success: true, data: { deleted: true } });
}

export async function getTimelineExport(
  req: Request<{ caseId: string }>,
  res: Response<ApiSuccessResponse<CaseSummaryExport>>,
): Promise<void> {
  if (!req.user) throw new UnauthorizedError();
  const caseId = req.params.caseId as RecoveryCaseId;
  const result = await exportCaseSummary(requirePool(), req.user.id, caseId);
  res.status(200).json({ success: true, data: result });
}
