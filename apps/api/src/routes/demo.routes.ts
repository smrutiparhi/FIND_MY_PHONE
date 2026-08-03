import { Router } from 'express';
import { requireAuth } from '../middleware/authenticate';
import { validate } from '../middleware/validate';
import { asyncHandler } from '../lib/asyncHandler';
import { deleteDemo, getDemo, postAdvanceDemo, postStartDemo } from '../controllers/demo.controller';
import { advanceDemoSchema, demoCaseParamsSchema } from '../validation/schemas/demo.schemas';

export const demoRouter = Router();

demoRouter.post('/start', requireAuth, asyncHandler(postStartDemo));
demoRouter.get('/:caseId', requireAuth, validate(demoCaseParamsSchema, 'params'), asyncHandler(getDemo));
demoRouter.post(
  '/:caseId/advance',
  requireAuth,
  validate(demoCaseParamsSchema, 'params'),
  validate(advanceDemoSchema),
  asyncHandler(postAdvanceDemo),
);
demoRouter.delete('/:caseId', requireAuth, validate(demoCaseParamsSchema, 'params'), asyncHandler(deleteDemo));
