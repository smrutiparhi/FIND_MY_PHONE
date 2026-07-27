import { Router } from 'express';
import { getLiveness, getReadiness } from '../controllers/health.controller';
import { asyncHandler } from '../lib/asyncHandler';

export const healthRouter = Router();

healthRouter.get('/', getLiveness);
healthRouter.get('/ready', asyncHandler(getReadiness));
