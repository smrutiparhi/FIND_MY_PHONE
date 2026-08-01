import { z } from 'zod';

export const timelineCaseParamsSchema = z.object({
  caseId: z.string().uuid(),
});

export const timelineEventParamsSchema = z.object({
  caseId: z.string().uuid(),
  eventId: z.string().uuid(),
});

export const timelineOrderQuerySchema = z.object({
  order: z.enum(['asc', 'desc']).optional(),
});

export const timelineNoteSchema = z.object({
  title: z.string().trim().min(1, 'A note needs a title').max(200),
  description: z.string().trim().max(2000).nullable().optional(),
});
