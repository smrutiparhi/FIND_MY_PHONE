import type { FinancialItemCategory, FinancialProtectionItem, RecoveryCase } from './domain';
import type { RecoveryPlan } from './recoveryEngine';

/** Deterministic per-category guidance (never AI-generated) - always all six categories, shown so a user knows what a category means before adding an item for it. */
export interface FinancialCategoryGuide {
  category: FinancialItemCategory;
  label: string;
  instructions: string;
}

export interface CreateFinancialProtectionItemInput {
  category: FinancialItemCategory;
  /** "Allow the user to record institutions/apps generically or by name" - optional, free text, never a secret field. */
  label?: string | null;
}

/** CONFIRMED_BY_INTEGRATION is never client-settable - no real integration exists to confirm anything (see FinancialProtectionStatus). */
export const USER_SETTABLE_FINANCIAL_PROTECTION_STATUSES = ['NOT_STARTED', 'IN_PROGRESS', 'CONFIRMED_BY_USER'] as const;
export type UserSettableFinancialProtectionStatus = (typeof USER_SETTABLE_FINANCIAL_PROTECTION_STATUSES)[number];

export interface UpdateFinancialProtectionItemInput {
  status?: UserSettableFinancialProtectionStatus;
  label?: string | null;
  notes?: string | null;
}

export interface FinancialSecurityState {
  items: FinancialProtectionItem[];
  categoryGuides: FinancialCategoryGuide[];
  /** e.g. "device may have been stolen while unlocked" - master spec's Part 12 "include strong warnings" requirement. */
  warnings: string[];
  recoveryCase: RecoveryCase;
  recoveryPlan: RecoveryPlan;
}
