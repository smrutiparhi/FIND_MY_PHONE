import { z } from 'zod';
import { EVIDENCE_CATEGORIES } from '@recoverai/shared';

export const evidenceCaseParamsSchema = z.object({
  caseId: z.string().uuid(),
});

export const evidenceItemParamsSchema = z.object({
  caseId: z.string().uuid(),
  evidenceId: z.string().uuid(),
});

/** Runs after evidenceUploadMiddleware has populated req.body from the multipart form's non-file fields. */
export const uploadEvidenceBodySchema = z.object({
  category: z.enum(EVIDENCE_CATEGORIES),
  description: z.string().trim().max(500).optional(),
});
