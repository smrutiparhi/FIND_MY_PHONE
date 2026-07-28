import { Router } from 'express';
import { requireAuth } from '../middleware/authenticate';
import { asyncHandler } from '../lib/asyncHandler';
import { listMyCases } from '../controllers/recoveryCase.controller';

export const recoveryCaseRouter = Router();

recoveryCaseRouter.get('/', requireAuth, asyncHandler(listMyCases));
