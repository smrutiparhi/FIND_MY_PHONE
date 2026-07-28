import { Router } from 'express';
import { requireAuth } from '../middleware/authenticate';
import { validate } from '../middleware/validate';
import { asyncHandler } from '../lib/asyncHandler';
import { createCase, getRecoveryPlan, listMyCases, updateActionStatus } from '../controllers/recoveryCase.controller';
import {
  caseActionParamsSchema,
  caseIdParamsSchema,
  createRecoveryCaseWizardSchema,
  updateActionStatusSchema,
} from '../validation/schemas/recoveryCase.schemas';

export const recoveryCaseRouter = Router();

recoveryCaseRouter.get('/', requireAuth, asyncHandler(listMyCases));
recoveryCaseRouter.post('/', requireAuth, validate(createRecoveryCaseWizardSchema), asyncHandler(createCase));
recoveryCaseRouter.get(
  '/:caseId/recovery-plan',
  requireAuth,
  validate(caseIdParamsSchema, 'params'),
  asyncHandler(getRecoveryPlan),
);
recoveryCaseRouter.patch(
  '/:caseId/actions/:actionId',
  requireAuth,
  validate(caseActionParamsSchema, 'params'),
  validate(updateActionStatusSchema),
  asyncHandler(updateActionStatus),
);
