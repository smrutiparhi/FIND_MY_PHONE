import type { RecoveryActionId, RecoveryActionType, RecoveryPlan, RecoveryPlanAction } from '@recoverai/shared';
import type { EngineAction, RecoveryEngineResult } from './types';

function toRecoveryPlanAction(
  action: EngineAction,
  actionIdByType: Map<RecoveryActionType, RecoveryActionId>,
): RecoveryPlanAction {
  const id = actionIdByType.get(action.type);
  if (!id) {
    throw new Error(`No persisted recovery_actions row found for engine action type ${action.type}`);
  }
  return {
    id,
    type: action.type,
    priority: action.priority,
    title: action.title,
    reason: action.reason,
    instructions: action.instructions,
    status: action.status,
    dependencies: action.dependencies,
    officialExternalAction: action.officialExternalAction,
  };
}

/** Attaches real persisted ids to an evaluateRecoveryDecision() result - see applyEngineResult.ts's actionIdByType. */
export function toRecoveryPlan(
  engineResult: RecoveryEngineResult,
  actionIdByType: Map<RecoveryActionType, RecoveryActionId>,
): RecoveryPlan {
  return {
    riskLevel: engineResult.riskLevel,
    riskReasons: engineResult.riskReasons,
    orderedActions: engineResult.orderedActions.map((action) => toRecoveryPlanAction(action, actionIdByType)),
    currentRecommendedAction: engineResult.currentRecommendedAction
      ? toRecoveryPlanAction(engineResult.currentRecommendedAction, actionIdByType)
      : null,
    blockedActions: engineResult.blockedActions.map((action) => toRecoveryPlanAction(action, actionIdByType)),
    warnings: engineResult.warnings,
  };
}
