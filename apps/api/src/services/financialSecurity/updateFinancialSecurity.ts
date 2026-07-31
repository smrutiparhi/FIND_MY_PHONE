import type { Pool } from 'pg';
import type {
  CreateFinancialProtectionItemInput,
  FinancialItemCategory,
  FinancialProtectionItem,
  FinancialProtectionItemId,
  FinancialSecurityState,
  RecoveryCaseId,
  SensitiveAppType,
  UpdateFinancialProtectionItemInput,
  UserId,
} from '@recoverai/shared';
import type { Repositories } from '../../db/repositories';
import { createRepositories } from '../../db/repositories';
import { NotFoundError } from '../../lib/errors';
import { recalculateRecoveryCase } from '../recoveryEngine/recalculateRecoveryCase';
import { toRecoveryPlan } from '../recoveryEngine/toRecoveryPlan';
import { listFinancialCategoryGuides } from './financialCategoryGuides';

const CONFIRMED_STATUSES = new Set(['CONFIRMED_BY_USER', 'CONFIRMED_BY_INTEGRATION']);

/** Only the three checklist items the Part 5 wizard already asks about have a matching Part 12 category - digital wallets, saved cards, and banking email are only ever user-added here. */
const SENSITIVE_APP_TO_FINANCIAL_CATEGORY: Partial<Record<SensitiveAppType, FinancialItemCategory>> = {
  BANKING: 'BANKING_APP',
  UPI: 'UPI',
  PASSWORD_MANAGER: 'PASSWORD_MANAGER',
};

/**
 * Only seeds once - "allow the user to record institutions/apps generically
 * or by name" implies this is the user's own list from then on, so once
 * they've added or removed anything, nothing here overwrites it again.
 */
async function seedItemsFromWizardIfEmpty(repos: Repositories, caseId: RecoveryCaseId): Promise<FinancialProtectionItem[]> {
  const existing = await repos.financialProtectionItems.listByCase(caseId);
  if (existing.length > 0) return existing;

  const latestAssessment = await repos.incidentAssessments.findLatestByCase(caseId);
  const sensitiveApps = latestAssessment?.sensitiveApps ?? [];
  const categoriesToSeed = new Set<FinancialItemCategory>();
  for (const app of sensitiveApps) {
    const category = SENSITIVE_APP_TO_FINANCIAL_CATEGORY[app];
    if (category) categoriesToSeed.add(category);
  }
  if (categoriesToSeed.size === 0) return [];

  const seeded: FinancialProtectionItem[] = [];
  for (const category of categoriesToSeed) {
    seeded.push(await repos.financialProtectionItems.create({ caseId, category }));
  }
  return seeded;
}

/**
 * "Do not claim financial accounts are secure merely because the phone was
 * locked" (master spec) applies here too: the FINANCIAL_PROTECTION action
 * only ever completes because every tracked item is confirmed by the user
 * (or, in the future, a real integration) - never inferred from
 * deviceSecured/screenLockStatus. Reopens the action if a previously-secured
 * case later gets a new or un-confirmed item, so the engine's
 * financialAccountsSecured claim never lags behind the user's own list.
 */
async function syncFinancialProtectionAction(
  repos: Repositories,
  userId: UserId,
  caseId: RecoveryCaseId,
  items: FinancialProtectionItem[],
): Promise<void> {
  const allConfirmed = items.length > 0 && items.every((item) => CONFIRMED_STATUSES.has(item.status));
  const actions = await repos.recoveryActions.listByCase(caseId);
  const financialAction = actions.find((a) => a.type === 'FINANCIAL_PROTECTION');
  if (!financialAction) return;

  if (allConfirmed && financialAction.status !== 'COMPLETED') {
    await repos.recoveryActions.updateStatus(financialAction.id, userId, 'COMPLETED');
    await repos.timelineEvents.create({
      caseId,
      type: 'FINANCIAL_PROTECTION_COMPLETED',
      title: 'Financial accounts protected',
      description: `${items.length} tracked item${items.length === 1 ? '' : 's'} confirmed.`,
      source: 'USER',
      verificationStatus: 'USER_REPORTED',
      recoveryActionId: financialAction.id,
      createdByUserId: userId,
    });
  } else if (!allConfirmed && financialAction.status === 'COMPLETED') {
    await repos.recoveryActions.updateStatus(financialAction.id, userId, 'PENDING');
    await repos.timelineEvents.create({
      caseId,
      type: 'USER_NOTE',
      title: 'Financial protection reopened',
      description: 'A tracked item is no longer fully confirmed, so financial protection is no longer marked complete.',
      source: 'SYSTEM',
      verificationStatus: 'SYSTEM_VERIFIED',
      recoveryActionId: financialAction.id,
    });
  }
}

function computeWarnings(incidentType: string, screenLockEnabled: string | null | undefined): string[] {
  const warnings: string[] = [];
  if (incidentType === 'STOLEN' && screenLockEnabled !== 'YES') {
    warnings.push(
      'This device may have been stolen while unlocked, or its screen-lock status is unclear - treat every financial app and saved card on it as exposed until you confirm otherwise.',
    );
  }
  return warnings;
}

async function buildState(pool: Pool, repos: Repositories, userId: UserId, caseId: RecoveryCaseId): Promise<FinancialSecurityState> {
  const items = await repos.financialProtectionItems.listByCase(caseId);
  const latestAssessment = await repos.incidentAssessments.findLatestByCase(caseId);
  const { recoveryCase, engineResult, actionIdByType } = await recalculateRecoveryCase(pool, userId, caseId);

  return {
    items,
    categoryGuides: listFinancialCategoryGuides(),
    warnings: computeWarnings(recoveryCase.incidentType, latestAssessment?.screenLockEnabled),
    recoveryCase,
    recoveryPlan: toRecoveryPlan(engineResult, actionIdByType),
  };
}

export async function getFinancialSecurityState(pool: Pool, userId: UserId, caseId: RecoveryCaseId): Promise<FinancialSecurityState> {
  const repos = createRepositories(pool);
  const recoveryCase = await repos.recoveryCases.findById(caseId, userId);
  if (!recoveryCase) throw new NotFoundError('Recovery case not found');

  await seedItemsFromWizardIfEmpty(repos, caseId);
  return buildState(pool, repos, userId, caseId);
}

export async function createFinancialProtectionItem(
  pool: Pool,
  userId: UserId,
  caseId: RecoveryCaseId,
  input: CreateFinancialProtectionItemInput,
): Promise<FinancialSecurityState> {
  const repos = createRepositories(pool);
  const recoveryCase = await repos.recoveryCases.findById(caseId, userId);
  if (!recoveryCase) throw new NotFoundError('Recovery case not found');

  await repos.financialProtectionItems.create({ caseId, category: input.category, label: input.label ?? null });
  const items = await repos.financialProtectionItems.listByCase(caseId);
  await syncFinancialProtectionAction(repos, userId, caseId, items);

  return buildState(pool, repos, userId, caseId);
}

export async function updateFinancialProtectionItem(
  pool: Pool,
  userId: UserId,
  caseId: RecoveryCaseId,
  itemId: FinancialProtectionItemId,
  input: UpdateFinancialProtectionItemInput,
): Promise<FinancialSecurityState> {
  const repos = createRepositories(pool);
  const recoveryCase = await repos.recoveryCases.findById(caseId, userId);
  if (!recoveryCase) throw new NotFoundError('Recovery case not found');

  const existingItem = await repos.financialProtectionItems.findByIdForUser(itemId, userId);
  if (!existingItem || existingItem.caseId !== caseId) throw new NotFoundError('Financial protection item not found');

  await repos.financialProtectionItems.update(itemId, userId, {
    status: input.status,
    label: 'label' in input ? input.label : undefined,
    notes: 'notes' in input ? input.notes : undefined,
  });
  const items = await repos.financialProtectionItems.listByCase(caseId);
  await syncFinancialProtectionAction(repos, userId, caseId, items);

  return buildState(pool, repos, userId, caseId);
}

export async function deleteFinancialProtectionItem(
  pool: Pool,
  userId: UserId,
  caseId: RecoveryCaseId,
  itemId: FinancialProtectionItemId,
): Promise<FinancialSecurityState> {
  const repos = createRepositories(pool);
  const recoveryCase = await repos.recoveryCases.findById(caseId, userId);
  if (!recoveryCase) throw new NotFoundError('Recovery case not found');

  const existingItem = await repos.financialProtectionItems.findByIdForUser(itemId, userId);
  if (!existingItem || existingItem.caseId !== caseId) throw new NotFoundError('Financial protection item not found');

  await repos.financialProtectionItems.delete(itemId, userId);
  const items = await repos.financialProtectionItems.listByCase(caseId);
  await syncFinancialProtectionAction(repos, userId, caseId, items);

  return buildState(pool, repos, userId, caseId);
}
