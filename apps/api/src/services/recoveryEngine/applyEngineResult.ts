import type {
  RecoveryAction,
  RecoveryActionId,
  RecoveryActionType,
  RecoveryCase,
  RecoveryCaseId,
  SensitiveAppType,
  UserId,
} from '@recoverai/shared';
import type { Repositories } from '../../db/repositories';
import { createNotification } from '../notifications/createNotification';
import type { RecoveryEngineInput, RecoveryEngineResult } from './types';

const HIGH_RISK_LEVELS = new Set(['CRITICAL', 'HIGH']);

function sameSensitiveApps(a: SensitiveAppType[], b: SensitiveAppType[]): boolean {
  return a.length === b.length && a.every((type) => b.includes(type));
}

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
 * only when the assessed state actually changed. Shared by case creation
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
  /** The raw checklist behind engineInput's four boolean sensitive-app fields - see gatherEngineInputForExistingCase.ts. */
  sensitiveApps: SensitiveAppType[],
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
  // Broader than "did the risk score change": an agent- or wizard-reported correction (a
  // sensitive app the engine didn't know about, a screen-lock answer that was wrong) must still
  // be captured in a new snapshot even on the rare turn where it happens not to move riskLevel -
  // otherwise the next recalculation would silently read the stale prior assessment again.
  const assessmentChanged =
    !latestAssessment ||
    latestAssessment.riskLevel !== engineResult.riskLevel ||
    latestAssessment.riskReasons.length !== engineResult.riskReasons.length ||
    latestAssessment.riskReasons.some((reason, index) => reason !== engineResult.riskReasons[index]) ||
    latestAssessment.screenLockEnabled !== engineInput.screenLockStatus ||
    latestAssessment.deviceFindingAvailable !== engineInput.deviceFindingAvailability ||
    !sameSensitiveApps(latestAssessment.sensitiveApps, sensitiveApps);

  if (assessmentChanged) {
    // "Critical recovery action pending" (Part 19) fires only on the transition *into*
    // CRITICAL/HIGH risk, not on every recalculation that happens to stay there - the same
    // "log once, on the real transition" discipline as SIM_PROTECTION_STARTED etc.
    const wasAlreadyHighRisk = latestAssessment ? HIGH_RISK_LEVELS.has(latestAssessment.riskLevel) : false;
    const isNowHighRisk = HIGH_RISK_LEVELS.has(engineResult.riskLevel);

    await repos.incidentAssessments.create({
      caseId,
      screenLockEnabled: engineInput.screenLockStatus,
      sensitiveApps,
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

    if (isNowHighRisk && !wasAlreadyHighRisk) {
      await createNotification(repos, {
        userId,
        caseId,
        type: 'CRITICAL_ACTION_PENDING',
        title: `${engineResult.riskLevel === 'CRITICAL' ? 'Critical' : 'High'} risk: ${engineResult.currentRecommendedAction?.title ?? 'this case needs attention'}`,
        body: engineResult.currentRecommendedAction?.reason ?? 'This case now needs your attention.',
      });
    }
  }

  await repos.recoveryCases.update(caseId, userId, { riskLevel: engineResult.riskLevel });
  const recommendedActionId = engineResult.currentRecommendedAction
    ? (idByType.get(engineResult.currentRecommendedAction.type) ?? null)
    : null;
  const finalCase = await repos.recoveryCases.setCurrentRecommendedAction(caseId, userId, recommendedActionId);
  if (!finalCase) throw new Error('Recovery case vanished while applying the recovery decision engine result');
  return { recoveryCase: finalCase, actionIdByType: idByType };
}
