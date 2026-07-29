import { z } from 'zod';

export const updateAccountRecoveryAttemptSchema = z.object({
  availableSignals: z
    .array(z.enum(['PASSWORD', 'TRUSTED_DEVICE', 'TRUSTED_PHONE_NUMBER', 'RECOVERY_EMAIL', 'SIM', 'BACKUP_AUTH_METHOD']))
    .optional(),
  // NOT_STARTED is the initial default only - never a client-chosen transition (see ACCOUNT_RECOVERY_STATUSES).
  status: z.enum(['IN_PROGRESS', 'WAITING', 'RECOVERED', 'FAILED']).optional(),
  notes: z.string().trim().max(1000).nullable().optional(),
});
