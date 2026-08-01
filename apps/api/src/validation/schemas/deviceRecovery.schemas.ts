import { z } from 'zod';
import { DEVICE_RECOVERY_CHECKLIST_ITEMS } from '@recoverai/shared';

export const deviceRecoveryCaseParamsSchema = z.object({
  caseId: z.string().uuid(),
});

export const updateDeviceRecoveryChecklistSchema = z.object({
  completedItems: z.array(z.enum(DEVICE_RECOVERY_CHECKLIST_ITEMS)).optional(),
  notes: z.string().trim().max(1000).nullable().optional(),
});

export const closeRecoveryCaseSchema = z.object({
  confirmedUnresolvedActionsReviewed: z.boolean(),
});
