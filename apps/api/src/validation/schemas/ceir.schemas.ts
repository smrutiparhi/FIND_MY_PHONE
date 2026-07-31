import { z } from 'zod';

// NOT_READY is the initial default only - never a client-chosen transition (see USER_SETTABLE_CEIR_STATUSES).
export const updateCeirRecordSchema = z.object({
  status: z.enum(['READY', 'SUBMITTED', 'PROCESSING', 'BLOCKED', 'UNBLOCK_REQUESTED', 'UNBLOCKED', 'UNKNOWN']).optional(),
  ceirRequestId: z.string().trim().min(1).max(100).nullable().optional(),
  submissionDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Expected YYYY-MM-DD')
    .nullable()
    .optional(),
  notes: z.string().trim().max(1000).nullable().optional(),
  checklistCompletedItems: z
    .array(
      z.enum([
        'IMEI_INFORMATION',
        'MOBILE_NUMBER',
        'DEVICE_DETAILS',
        'POLICE_REPORT',
        'IDENTITY_DOCUMENT',
        'PURCHASE_INVOICE',
        'REPLACEMENT_SIM_STATUS',
        'OTHER',
      ]),
    )
    .optional(),
});
