import type { Pool } from 'pg';
import { z } from 'zod';
import type { RecoveryActionId, RecoveryActionStatus, RecoveryActionType, RecoveryCaseId, TimelineEventType, UserId } from '@recoverai/shared';
import { createRepositories } from '../../db/repositories';
import { recalculateRecoveryCase, type RecalculateRecoveryCaseOverrides } from '../recoveryEngine/recalculateRecoveryCase';

/**
 * A lightweight, independent check that the user actually confirmed
 * something, rather than trusting the model's own `userConfirmed: true`
 * claim alone - defense in depth for "update an action only after explicit
 * user confirmation" per the master spec. Not real NLU; a model that wants
 * to lie about confirmation could still phrase a fake "yes" - the point is
 * to catch the much more common failure mode of the model mis-reading an
 * ambiguous or negative reply as consent.
 */
const CONFIRMATION_PATTERN = /\b(yes|yep|yeah|yup|confirm(ed)?|go ahead|do it|please do|sure|correct|that'?s right|sounds good|ok(ay)?)\b/i;

export function looksLikeConfirmation(text: string): boolean {
  return CONFIRMATION_PATTERN.test(text);
}

function requireRealConfirmation(userConfirmed: boolean, lastUserMessageText: string): string | null {
  if (!userConfirmed) return 'Not applied: userConfirmed was false. Ask the user to confirm explicitly first, then try again.';
  if (!looksLikeConfirmation(lastUserMessageText)) {
    return "Not applied: the user's most recent message didn't read as an explicit confirmation. Ask a plain yes/no question and wait for a clear answer before calling this tool again.";
  }
  return null;
}

export interface ToolHandlerContext {
  pool: Pool;
  userId: UserId;
  caseId: RecoveryCaseId;
  /** The last user-authored message text in this turn's transcript - see requireRealConfirmation. */
  lastUserMessageText: string;
}

export interface ToolHandlerOutcome {
  /** Fed back to the model as the tool_result content. */
  resultText: string;
  isError: boolean;
  /** True only on a successful write - tells the caller a fresh case-context re-fetch is worthwhile. */
  changed: boolean;
  /** Human-readable line surfaced to the UI as a "Verified system state" notice distinct from the AI's own prose. */
  summary?: string;
}

const updateActionStatusSchema = z.object({
  actionId: z.string().uuid(),
  newStatus: z.enum(['IN_PROGRESS', 'COMPLETED', 'SKIPPED']),
  userConfirmed: z.boolean(),
});

const recordIncidentDetailsSchema = z.object({
  accountAccessStatus: z.enum(['YES', 'NO', 'UNSURE']).optional(),
  simAccessStatus: z.enum(['ANOTHER_DEVICE_HAS_ACCESS', 'LOST_WITH_PHONE', 'SIM_ALREADY_BLOCKED', 'UNSURE']).optional(),
  screenLockEnabled: z.enum(['YES', 'NO', 'UNSURE']).optional(),
  deviceFindingAvailable: z.enum(['YES', 'NO', 'UNSURE']).optional(),
  addSensitiveApps: z
    .array(z.enum(['BANKING', 'UPI', 'EMAIL', 'SOCIAL_MEDIA', 'PASSWORD_MANAGER', 'AUTHENTICATOR', 'WORK_ACCOUNTS']))
    .optional(),
  userConfirmed: z.boolean(),
});

/** Maps an action-status change onto Part 16's specific timeline event types where one exists, falling back to USER_NOTE. */
function mapActionEventType(type: RecoveryActionType, status: RecoveryActionStatus): TimelineEventType {
  if (type === 'SECURE_DEVICE' && status === 'COMPLETED') return 'DEVICE_SECURED';
  if (type === 'SIM_PROTECTION' && status === 'IN_PROGRESS') return 'SIM_PROTECTION_STARTED';
  if (type === 'SIM_PROTECTION' && status === 'COMPLETED') return 'SIM_PROTECTION_COMPLETED';
  if (type === 'ACCOUNT_RECOVERY' && status === 'IN_PROGRESS') return 'ACCOUNT_RECOVERY_STARTED';
  if (type === 'ACCOUNT_RECOVERY' && status === 'COMPLETED') return 'ACCOUNT_RECOVERY_COMPLETED';
  if (type === 'FINANCIAL_PROTECTION' && status === 'COMPLETED') return 'FINANCIAL_PROTECTION_COMPLETED';
  if (type === 'LOCATE_DEVICE' && status === 'IN_PROGRESS') return 'DEVICE_FINDING_OPENED';
  return 'USER_NOTE';
}

export async function handleUpdateActionStatus(ctx: ToolHandlerContext, rawInput: unknown): Promise<ToolHandlerOutcome> {
  const parsed = updateActionStatusSchema.safeParse(rawInput);
  if (!parsed.success) {
    return { resultText: `Invalid tool input: ${parsed.error.issues.map((i) => i.message).join('; ')}`, isError: true, changed: false };
  }
  const { actionId, newStatus, userConfirmed } = parsed.data;

  const rejection = requireRealConfirmation(userConfirmed, ctx.lastUserMessageText);
  if (rejection) return { resultText: rejection, isError: true, changed: false };

  const repos = createRepositories(ctx.pool);
  const action = await repos.recoveryActions.findByIdForUser(actionId as RecoveryActionId, ctx.userId);
  if (!action || action.caseId !== ctx.caseId) {
    return { resultText: 'No action with that id exists on this case.', isError: true, changed: false };
  }

  await repos.recoveryActions.updateStatus(action.id, ctx.userId, newStatus);
  await repos.timelineEvents.create({
    caseId: ctx.caseId,
    type: mapActionEventType(action.type, newStatus),
    title: `${action.title} marked ${newStatus.toLowerCase().replace('_', ' ')}`,
    description: 'Updated via the AI Recovery Agent after the user confirmed in chat.',
    source: 'AI_AGENT',
    verificationStatus: 'USER_REPORTED',
    recoveryActionId: action.id,
  });
  await recalculateRecoveryCase(ctx.pool, ctx.userId, ctx.caseId);

  const summary = `Marked "${action.title}" as ${newStatus.replace('_', ' ').toLowerCase()}`;
  return {
    resultText: `Done - ${summary}. The recovery plan has been re-run to reflect it.`,
    isError: false,
    changed: true,
    summary,
  };
}

function describeOverrides(overrides: RecalculateRecoveryCaseOverrides): string {
  const parts: string[] = [];
  if (overrides.accountAccessStatus) parts.push(`account access = ${overrides.accountAccessStatus}`);
  if (overrides.simAccessStatus) parts.push(`SIM access = ${overrides.simAccessStatus}`);
  if (overrides.screenLockEnabled) parts.push(`screen lock = ${overrides.screenLockEnabled}`);
  if (overrides.deviceFindingAvailable) parts.push(`device finding = ${overrides.deviceFindingAvailable}`);
  if (overrides.addSensitiveApps && overrides.addSensitiveApps.length > 0) {
    parts.push(`added sensitive apps: ${overrides.addSensitiveApps.join(', ')}`);
  }
  return parts.join('; ');
}

export async function handleRecordIncidentDetails(ctx: ToolHandlerContext, rawInput: unknown): Promise<ToolHandlerOutcome> {
  const parsed = recordIncidentDetailsSchema.safeParse(rawInput);
  if (!parsed.success) {
    return { resultText: `Invalid tool input: ${parsed.error.issues.map((i) => i.message).join('; ')}`, isError: true, changed: false };
  }
  const { userConfirmed, ...overrides } = parsed.data;

  const rejection = requireRealConfirmation(userConfirmed, ctx.lastUserMessageText);
  if (rejection) return { resultText: rejection, isError: true, changed: false };

  const hasAnyField =
    overrides.accountAccessStatus !== undefined ||
    overrides.simAccessStatus !== undefined ||
    overrides.screenLockEnabled !== undefined ||
    overrides.deviceFindingAvailable !== undefined ||
    (overrides.addSensitiveApps !== undefined && overrides.addSensitiveApps.length > 0);
  if (!hasAnyField) {
    return { resultText: 'Nothing to record - no fields were provided.', isError: true, changed: false };
  }

  const description = describeOverrides(overrides);
  const repos = createRepositories(ctx.pool);
  await repos.timelineEvents.create({
    caseId: ctx.caseId,
    type: 'USER_NOTE',
    title: 'Incident details updated via chat',
    description,
    source: 'AI_AGENT',
    verificationStatus: 'USER_REPORTED',
  });
  await recalculateRecoveryCase(ctx.pool, ctx.userId, ctx.caseId, overrides);

  return {
    resultText: `Recorded: ${description}. The recovery plan has been re-run to reflect it.`,
    isError: false,
    changed: true,
    summary: `Recorded: ${description}`,
  };
}

export const TOOL_HANDLERS: Record<string, (ctx: ToolHandlerContext, rawInput: unknown) => Promise<ToolHandlerOutcome>> = {
  update_action_status: handleUpdateActionStatus,
  record_incident_details: handleRecordIncidentDetails,
};
