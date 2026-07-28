import type { RecoveryAction, RecoveryActionId, RecoveryActionType, RecoveryCase, RecoveryCaseId, UserId } from '@recoverai/shared';
import type { Repositories } from '../../db/repositories';
import type { RecoveryEngineInput, RecoveryEngineResult } from './types';

export interface ApplyEngineResultOutcome {
  recoveryCase: RecoveryCase;
  /** Every orderedActions entry's real DB id, keyed by type - lets callers build an API response with ids attached. */
  actionIdByType: Map<RecoveryActionType, RecoveryActionId>;
}

/**
 * Writes one evaluateRecoveryDecision() result to the database: creates any
 * newly-surfaced action, updates the priority/status of every action that
 * already existed (never touching IN_PROGRESS/COMPLETED/SKIPPED rows'
 * status - see updatePriorityAndStatus), points the case at the new
 * recommended action, and records a new IncidentAssessment + timeline event
 * only when the computed risk actually changed. Shared by case creation
 * (existingDbActions = []) and recalculation (existingDbActions = the case's
 * current rows) so both paths persist a RecoveryEngineResult identically.
 */
export async function applyEngineResult(
  repos: Repositories,
  userId: UserId,
  caseId: RecoveryCaseId,
  engineInput: RecoveryEngineInput,
  engineResult: RecoveryEngineResult,
  existingDbActions: RecoveryAction[],
): Promise<ApplyEngineResultOutcome> {
  const idByType = new Map<RecoveryActionType, RecoveryActionId>(existingDbActions.map((a) => [a.type, a.id]));

  for (const action of engineResult.orderedActions) {
    if (action.isExisting) continue;
    const dependsOnActionIds = action.dependencies
      .map((depType) => idByType.get(depType))
      .filter((id): id is RecoveryActionId => id !== undefined);

    const created = await repos.recoveryActions.create({
      caseId,
      type: action.type,
      priority: action.priority,
      title: action.title,
      reason: action.reason,
      instructions: action.instructions,
      status: action.status,
      dependsOnActionIds,
      officialExternalAction: action.officialExternalAction,
    });
    idByType.set(action.type, created.id);
  }

  for (const action of engineResult.orderedActions) {
    if (!action.isExisting) continue;
    const id = idByType.get(action.type);
    if (!id) continue;
    await repos.recoveryActions.updatePriorityAndStatus(id, userId, {
      priority: action.priority,
      status: action.status,
    });
  }

  const latestAssessment = await repos.incidentAssessments.findLatestByCase(caseId);
  const riskChanged =
    !latestAssessment ||
    latestAssessment.riskLevel !== engineResult.riskLevel ||
    latestAssessment.riskReasons.length !== engineResult.riskReasons.length ||
    latestAssessment.riskReasons.some((reason, index) => reason !== engineResult.riskReasons[index]);

  if (riskChanged) {
    await repos.incidentAssessments.create({
      caseId,
      screenLockEnabled: engineInput.screenLockStatus,
      sensitiveApps: latestAssessment?.sensitiveApps ?? [],
      deviceFindingAvailable: engineInput.deviceFindingAvailability,
      riskLevel: engineResult.riskLevel,
      riskReasons: engineResult.riskReasons,
    });
    await repos.timelineEvents.create({
      caseId,
      type: 'RISK_ASSESSED',
      title: `Risk assessed as ${engineResult.riskLevel}`,
      source: 'SYSTEM',
      verificationStatus: 'SYSTEM_VERIFIED',
    });
  }

  await repos.recoveryCases.update(caseId, userId, { riskLevel: engineResult.riskLevel });
  const recommendedActionId = engineResult.currentRecommendedAction
    ? (idByType.get(engineResult.currentRecommendedAction.type) ?? null)
    : null;
  const finalCase = await repos.recoveryCases.setCurrentRecommendedAction(caseId, userId, recommendedActionId);
  if (!finalCase) throw new Error('Recovery case vanished while applying the recovery decision engine result');
  return { recoveryCase: finalCase, actionIdByType: idByType };
}
