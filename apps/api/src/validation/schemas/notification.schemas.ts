import { z } from 'zod';
import { NOTIFICATION_TYPES } from '@recoverai/shared';

export const notificationIdParamsSchema = z.object({
  id: z.string().uuid(),
});

export const listNotificationsQuerySchema = z.object({
  unreadOnly: z.enum(['true', 'false']).optional(),
});

export const updateNotificationPreferencesSchema = z.object({
  mutedTypes: z.array(z.enum(NOTIFICATION_TYPES)).optional(),
  emailEnabled: z.boolean().optional(),
  pushEnabled: z.boolean().optional(),
  smsEnabled: z.boolean().optional(),
  quietHoursEnabled: z.boolean().optional(),
  quietHoursStartMinute: z.number().int().min(0).max(1439).nullable().optional(),
  quietHoursEndMinute: z.number().int().min(0).max(1439).nullable().optional(),
  timezone: z.string().trim().min(1).max(100).nullable().optional(),
});
