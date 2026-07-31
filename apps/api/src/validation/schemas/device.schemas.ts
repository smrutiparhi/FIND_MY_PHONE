import { z } from 'zod';

export const deviceIdParamsSchema = z.object({
  deviceId: z.string().uuid(),
});

/**
 * Deliberately narrow - just the two fields Part 11's SIM/eSIM Protection
 * Center actually needs editable (the wizard never collects carrier at all,
 * and there's nowhere else in the app yet to set it). Broader device editing
 * (nickname, manufacturer, IMEI, ...) belongs to a future device-management
 * surface, not this endpoint.
 */
export const updateDeviceSimInfoSchema = z.object({
  carrier: z.string().trim().max(100).nullable().optional(),
  simType: z.enum(['PHYSICAL', 'ESIM', 'DUAL', 'UNKNOWN']).optional(),
});
