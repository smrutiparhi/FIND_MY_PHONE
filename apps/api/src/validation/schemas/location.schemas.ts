import { z } from 'zod';

const FUTURE_CLOCK_SKEW_MS = 5 * 60 * 1000;

export const recordLocationObservationSchema = z.object({
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  accuracyMeters: z.number().positive().nullable().optional(),
  observedAt: z
    .string()
    .datetime()
    .refine((value) => new Date(value).getTime() <= Date.now() + FUTURE_CLOCK_SKEW_MS, {
      message: 'observedAt cannot be in the future',
    }),
  source: z.enum(['AUTHORIZED_INTEGRATION', 'USER_CONFIRMED', 'USER_ENTERED', 'OTHER_VERIFIED_SOURCE']),
  notes: z.string().trim().max(500).nullable().optional(),
});
