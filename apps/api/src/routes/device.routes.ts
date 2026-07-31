import { Router } from 'express';
import { requireAuth } from '../middleware/authenticate';
import { validate } from '../middleware/validate';
import { asyncHandler } from '../lib/asyncHandler';
import { listMyDevices, updateDeviceSimInfo } from '../controllers/device.controller';
import { deviceIdParamsSchema, updateDeviceSimInfoSchema } from '../validation/schemas/device.schemas';

export const deviceRouter = Router();

deviceRouter.get('/', requireAuth, asyncHandler(listMyDevices));
deviceRouter.patch(
  '/:deviceId',
  requireAuth,
  validate(deviceIdParamsSchema, 'params'),
  validate(updateDeviceSimInfoSchema),
  asyncHandler(updateDeviceSimInfo),
);
