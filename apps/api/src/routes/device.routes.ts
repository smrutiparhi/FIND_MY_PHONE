import { Router } from 'express';
import { requireAuth } from '../middleware/authenticate';
import { asyncHandler } from '../lib/asyncHandler';
import { listMyDevices } from '../controllers/device.controller';

export const deviceRouter = Router();

deviceRouter.get('/', requireAuth, asyncHandler(listMyDevices));
