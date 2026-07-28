import type {
  OfficialExternalAction,
  RecoveryActionId,
  RecoveryActionStatus,
  RecoveryActionType,
  RecoveryCase,
  RiskLevel,
} from './domain';

/**
 * The API-facing shape of one evaluateRecoveryDecision() action, with the
 * real persisted RecoveryActionId attached - see
 * apps/api/src/services/recoveryEngine/toRecoveryPlan.ts.
 */
export interface RecoveryPlanAction {
  id: RecoveryActionId;
  type: RecoveryActionType;
  priority: number;
  title: string;
  reason: string;
  instructions: string;
  status: RecoveryActionStatus;
  dependencies: RecoveryActionType[];
  officialExternalAction: OfficialExternalAction | null;
}

/**
 * The Recovery Decision Engine's (master spec Part 6) full output, as
 * returned by GET /api/recovery-cases/:caseId/recovery-plan and the action
 * status PATCH. blockedActions and warnings are computed live on every
 * request - unlike orderedActions, they have no dedicated table of their
 * own, since they're a function of current state rather than history worth
 * persisting.
 */
export interface RecoveryPlan {
  riskLevel: RiskLevel;
  riskReasons: string[];
  orderedActions: RecoveryPlanAction[];
  currentRecommendedAction: RecoveryPlanAction | null;
  blockedActions: RecoveryPlanAction[];
  warnings: string[];
}

/** The user-settable subset of RecoveryActionStatus - BLOCKED/PENDING toggling is engine-only, never a direct user choice. */
export const USER_SETTABLE_ACTION_STATUSES = ['PENDING', 'IN_PROGRESS', 'COMPLETED', 'SKIPPED'] as const;
export type UserSettableActionStatus = (typeof USER_SETTABLE_ACTION_STATUSES)[number];

export interface UpdateRecoveryActionStatusInput {
  status: UserSettableActionStatus;
}

export interface UpdateRecoveryActionStatusResult {
  recoveryCase: RecoveryCase;
  recoveryPlan: RecoveryPlan;
}
