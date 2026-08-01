import { Router } from 'express';
import { requireAuth } from '../middleware/authenticate';
import { validate } from '../middleware/validate';
import { asyncHandler } from '../lib/asyncHandler';
import {
  getNotifications,
  getPreferences,
  patchMarkNotificationRead,
  patchPreferences,
  postMarkAllNotificationsRead,
} from '../controllers/notification.controller';
import {
  listNotificationsQuerySchema,
  notificationIdParamsSchema,
  updateNotificationPreferencesSchema,
} from '../validation/schemas/notification.schemas';

export const notificationRouter = Router();

notificationRouter.get('/', requireAuth, validate(listNotificationsQuerySchema, 'query'), asyncHandler(getNotifications));
notificationRouter.post('/read-all', requireAuth, asyncHandler(postMarkAllNotificationsRead));
notificationRouter.patch(
  '/:id/read',
  requireAuth,
  validate(notificationIdParamsSchema, 'params'),
  asyncHandler(patchMarkNotificationRead),
);
notificationRouter.get('/preferences', requireAuth, asyncHandler(getPreferences));
notificationRouter.patch(
  '/preferences',
  requireAuth,
  validate(updateNotificationPreferencesSchema),
  asyncHandler(patchPreferences),
);
