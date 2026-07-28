import { z } from 'zod';

const triStateSchema = z.enum(['YES', 'NO', 'UNSURE']);

const wizardDeviceSchema = z.discriminatedUnion('mode', [
  z.object({
    mode: z.literal('existing'),
    deviceId: z.string().uuid(),
  }),
  z.object({
    mode: z.literal('new'),
    nickname: z.string().trim().min(1, 'Give the device a name').max(100),
    manufacturer: z.string().trim().min(1, 'Manufacturer is required').max(100),
    model: z.string().trim().min(1, 'Model is required').max(100),
    platform: z.enum(['ANDROID', 'IPHONE', 'OTHER']),
  }),
]);

export const createRecoveryCaseWizardSchema = z.object({
  incidentType: z.enum(['LOST', 'STOLEN', 'UNSURE']),
  device: wizardDeviceSchema,
  lastSeenAt: z.string().datetime().nullable(),
  lastSeenDescription: z.string().trim().max(500).nullable(),
  accountAccessStatus: triStateSchema,
  simAccessStatus: z.enum(['ANOTHER_DEVICE_HAS_ACCESS', 'LOST_WITH_PHONE', 'SIM_ALREADY_BLOCKED', 'UNSURE']),
  screenLockEnabled: triStateSchema,
  sensitiveApps: z.array(
    z.enum(['BANKING', 'UPI', 'EMAIL', 'SOCIAL_MEDIA', 'PASSWORD_MANAGER', 'AUTHENTICATOR', 'WORK_ACCOUNTS']),
  ),
  deviceFindingAvailable: triStateSchema,
});
