import type { Request, Response } from 'express';
import type {
  ApiSuccessResponse,
  Notification,
  NotificationId,
  NotificationListState,
  NotificationPreferences,
  UpdateNotificationPreferencesInput,
} from '@recoverai/shared';
import { getPool } from '../db/pool';
import { UnauthorizedError } from '../lib/errors';
import {
  getNotificationPreferences,
  listNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  updateNotificationPreferences,
} from '../services/notifications/notificationService';

function requirePool() {
  const pool = getPool();
  if (!pool) throw new Error('DATABASE_URL must be configured to use notifications.');
  return pool;
}

export async function getNotifications(
  req: Request<Record<string, string>, unknown, unknown, { unreadOnly?: 'true' | 'false' }>,
  res: Response<ApiSuccessResponse<NotificationListState>>,
): Promise<void> {
  if (!req.user) throw new UnauthorizedError();
  const state = await listNotifications(requirePool(), req.user.id, { unreadOnly: req.query.unreadOnly === 'true' });
  res.status(200).json({ success: true, data: state });
}

export async function patchMarkNotificationRead(
  req: Request<{ id: string }>,
  res: Response<ApiSuccessResponse<Notification>>,
): Promise<void> {
  if (!req.user) throw new UnauthorizedError();
  const notification = await markNotificationRead(requirePool(), req.user.id, req.params.id as NotificationId);
  res.status(200).json({ success: true, data: notification });
}

export async function postMarkAllNotificationsRead(
  req: Request,
  res: Response<ApiSuccessResponse<{ markedCount: number }>>,
): Promise<void> {
  if (!req.user) throw new UnauthorizedError();
  const result = await markAllNotificationsRead(requirePool(), req.user.id);
  res.status(200).json({ success: true, data: result });
}

export async function getPreferences(
  req: Request,
  res: Response<ApiSuccessResponse<NotificationPreferences>>,
): Promise<void> {
  if (!req.user) throw new UnauthorizedError();
  const preferences = await getNotificationPreferences(requirePool(), req.user.id);
  res.status(200).json({ success: true, data: preferences });
}

export async function patchPreferences(
  req: Request<Record<string, string>, unknown, UpdateNotificationPreferencesInput>,
  res: Response<ApiSuccessResponse<NotificationPreferences>>,
): Promise<void> {
  if (!req.user) throw new UnauthorizedError();
  const preferences = await updateNotificationPreferences(requirePool(), req.user.id, req.body);
  res.status(200).json({ success: true, data: preferences });
}
