import { Router } from 'express';
import { requireAuth } from '../middleware/authenticate';
import { validate } from '../middleware/validate';
import { agentMessageRateLimiter } from '../middleware/rateLimiter';
import { asyncHandler } from '../lib/asyncHandler';
import {
  createCase,
  getCase,
  getRecoveryPlan,
  listMyCases,
  sendAgentMessage,
  updateActionStatus,
} from '../controllers/recoveryCase.controller';
import { createLocationObservation, listLocationObservations } from '../controllers/location.controller';
import {
  caseActionParamsSchema,
  caseIdParamsSchema,
  createRecoveryCaseWizardSchema,
  sendAgentMessageSchema,
  updateActionStatusSchema,
} from '../validation/schemas/recoveryCase.schemas';
import { recordLocationObservationSchema } from '../validation/schemas/location.schemas';

export const recoveryCaseRouter = Router();

recoveryCaseRouter.get('/', requireAuth, asyncHandler(listMyCases));
recoveryCaseRouter.post('/', requireAuth, validate(createRecoveryCaseWizardSchema), asyncHandler(createCase));
recoveryCaseRouter.get('/:caseId', requireAuth, validate(caseIdParamsSchema, 'params'), asyncHandler(getCase));
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
recoveryCaseRouter.post(
  '/:caseId/agent/messages',
  requireAuth,
  agentMessageRateLimiter,
  validate(caseIdParamsSchema, 'params'),
  validate(sendAgentMessageSchema),
  asyncHandler(sendAgentMessage),
);
recoveryCaseRouter.get(
  '/:caseId/locations',
  requireAuth,
  validate(caseIdParamsSchema, 'params'),
  asyncHandler(listLocationObservations),
);
recoveryCaseRouter.post(
  '/:caseId/locations',
  requireAuth,
  validate(caseIdParamsSchema, 'params'),
  validate(recordLocationObservationSchema),
  asyncHandler(createLocationObservation),
);
