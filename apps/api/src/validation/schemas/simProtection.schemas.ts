import { z } from 'zod';

export const updateSimProtectionRecordSchema = z.object({
  // ACTIVE is the initial default only - never a client-chosen transition (see USER_SETTABLE_SIM_STATUSES).
  status: z.enum(['BLOCK_REQUESTED', 'BLOCKED', 'REPLACEMENT_PENDING', 'REPLACED', 'UNKNOWN']).optional(),
  notes: z.string().trim().max(1000).nullable().optional(),
});
