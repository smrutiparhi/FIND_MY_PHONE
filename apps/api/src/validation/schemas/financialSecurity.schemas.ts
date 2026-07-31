import { z } from 'zod';

const financialItemCategorySchema = z.enum(['UPI', 'BANKING_APP', 'DIGITAL_WALLET', 'SAVED_CARD', 'BANKING_EMAIL', 'PASSWORD_MANAGER']);

export const financialItemParamsSchema = z.object({
  caseId: z.string().uuid(),
  itemId: z.string().uuid(),
});

export const createFinancialProtectionItemSchema = z.object({
  category: financialItemCategorySchema,
  label: z.string().trim().max(150).nullable().optional(),
});

export const updateFinancialProtectionItemSchema = z.object({
  // CONFIRMED_BY_INTEGRATION is never client-settable - no real integration exists (see FinancialProtectionStatus).
  status: z.enum(['NOT_STARTED', 'IN_PROGRESS', 'CONFIRMED_BY_USER']).optional(),
  label: z.string().trim().max(150).nullable().optional(),
  notes: z.string().trim().max(1000).nullable().optional(),
});
