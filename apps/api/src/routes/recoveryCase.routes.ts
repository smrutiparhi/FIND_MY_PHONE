import { Router } from 'express';
import { requireAuth } from '../middleware/authenticate';
import { validate } from '../middleware/validate';
import { asyncHandler } from '../lib/asyncHandler';
import { createCase, listMyCases } from '../controllers/recoveryCase.controller';
import { createRecoveryCaseWizardSchema } from '../validation/schemas/recoveryCase.schemas';

export const recoveryCaseRouter = Router();

recoveryCaseRouter.get('/', requireAuth, asyncHandler(listMyCases));
recoveryCaseRouter.post('/', requireAuth, validate(createRecoveryCaseWizardSchema), asyncHandler(createCase));
