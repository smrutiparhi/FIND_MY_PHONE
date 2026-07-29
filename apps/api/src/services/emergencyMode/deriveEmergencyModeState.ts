import type { EmergencyModeState, RecoveryPlan } from '@recoverai/shared';

const TERMINAL_STATUSES = new Set(['COMPLETED', 'SKIPPED']);

/**
 * Pure - no database, no clock. "Trigger when combinations such as these
 * occur: device stolen, account inaccessible, SIM inaccessible, ..." (master
 * spec Part 10) is exactly the input space computeRisk() already scores in
 * the Recovery Decision Engine, so isEmergency is just riskLevel being
 * CRITICAL or HIGH - no second risk-detection system to keep in sync with
 * Part 6's.
 *
 * "Do not display a huge checklist during emergency mode" is why this
 * returns only completedCount/totalCount (a progress number, not the list)
 * plus exactly one current and one next action - the frontend has no way to
 * render the full list from this response even if it wanted to.
 */
export function deriveEmergencyModeState(recoveryPlan: RecoveryPlan): EmergencyModeState {
  const isEmergency = recoveryPlan.riskLevel === 'CRITICAL' || recoveryPlan.riskLevel === 'HIGH';
  const completedCount = recoveryPlan.orderedActions.filter((a) => a.status === 'COMPLETED').length;
  const totalCount = recoveryPlan.orderedActions.length;
  const currentAction = recoveryPlan.currentRecommendedAction;

  const nextAction = currentAction
    ? (recoveryPlan.orderedActions.find((a) => a.priority > currentAction.priority && !TERMINAL_STATUSES.has(a.status)) ?? null)
    : null;

  return {
    isEmergency,
    riskLevel: recoveryPlan.riskLevel,
    riskReasons: recoveryPlan.riskReasons,
    warnings: recoveryPlan.warnings,
    completedCount,
    totalCount,
    currentAction,
    nextAction,
  };
}
