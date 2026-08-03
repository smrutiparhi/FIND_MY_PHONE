import { z } from 'zod';
import { DEMO_STAGE_COUNT } from '@recoverai/shared';

export const demoCaseParamsSchema = z.object({
  caseId: z.string().uuid(),
});

export const advanceDemoSchema = z.object({
  stage: z.number().int().min(1).max(DEMO_STAGE_COUNT),
});
