import { z } from 'zod';

export const policeReportParamsSchema = z.object({
  caseId: z.string().uuid(),
  reportId: z.string().uuid(),
});

const createPoliceReportFields = {
  ownerFullName: z.string().trim().min(1, 'Owner name is required').max(150),
  ownerContact: z.string().trim().min(1, 'Contact information is required').max(200),
  incidentDateTime: z.string().datetime().nullable().optional(),
  lastKnownPlace: z.string().trim().max(300).nullable().optional(),
  incidentDescription: z.string().trim().min(10, 'Please describe what happened in a bit more detail').max(3000),
};

export const createPoliceReportSchema = z.object(createPoliceReportFields);
export const regeneratePoliceReportDraftSchema = z.object(createPoliceReportFields);

export const updatePoliceReportDraftSchema = z.object({
  draftText: z.string().trim().min(1, 'Draft text cannot be empty').max(10000),
});

export const markPoliceReportSubmittedSchema = z.object({
  externalReferenceNumber: z.string().trim().max(100).nullable().optional(),
});
