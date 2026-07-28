import type { Device, RecoveryAction, RecoveryCase } from '@recoverai/shared';
import type { Repositories } from '../../db/repositories';
import { computeTimeSinceIncidentBucket } from './timeSinceIncident';
import type { PoliceReportEngineStatus, RecoveryEngineInput } from './types';

export interface GatheredEngineInput {
  input: RecoveryEngineInput;
  /** The live DB rows behind `input.existingActions` - callers need real ids to persist updates. */
  existingDbActions: RecoveryAction[];
}

/**
 * Rebuilds engine input from a case's current live state for recalculation.
 * Deliberately introduces no new columns: "has the device/SIM/financial
 * accounts been secured" - and whether account access has been regained -
 * is read back from whether the corresponding recovery action is COMPLETED,
 * since that action's completion *is* what those things mean in this app -
 * see docs/RECOVERY_ENGINE.md.
 */
export async function gatherEngineInputForExistingCase(
  repos: Repositories,
  recoveryCase: RecoveryCase,
  device: Device,
): Promise<GatheredEngineInput> {
  const [latestAssessment, actions, latestLocation, policeReports, ceirRecord] = await Promise.all([
    repos.incidentAssessments.findLatestByCase(recoveryCase.id),
    repos.recoveryActions.listByCase(recoveryCase.id),
    repos.locationObservations.findLatestByCase(recoveryCase.id),
    repos.policeReports.listByCase(recoveryCase.id),
    repos.ceirRecords.findByCase(recoveryCase.id),
  ]);

  const isCompleted = (type: RecoveryAction['type']): boolean =>
    actions.some((action) => action.type === type && action.status === 'COMPLETED');

  const latestPoliceReport = policeReports[0] ?? null;
  const policeReportStatus: PoliceReportEngineStatus = !latestPoliceReport
    ? 'NOT_STARTED'
    : latestPoliceReport.status === 'USER_MARKED_SUBMITTED'
      ? 'FILED'
      : 'DRAFTED';

  const sensitiveApps = latestAssessment?.sensitiveApps ?? [];

  // accountAccessStatus is only ever the wizard's original answer - it never gets rewritten in
  // place, so a completed ACCOUNT_RECOVERY action (the only way this app knows access was
  // regained) is what promotes it to YES for every evaluation from then on.
  const accountAccess = isCompleted('ACCOUNT_RECOVERY') ? 'YES' : (recoveryCase.accountAccessStatus ?? 'UNSURE');

  const input: RecoveryEngineInput = {
    incidentType: recoveryCase.incidentType,
    timeSinceIncident: computeTimeSinceIncidentBucket(recoveryCase.occurredAt ?? recoveryCase.lastSeenAt),
    platform: device.platform,
    accountAccess,
    simAccess: recoveryCase.simAccessStatus ?? 'UNSURE',
    screenLockStatus: latestAssessment?.screenLockEnabled ?? 'UNSURE',
    deviceFindingAvailability: latestAssessment?.deviceFindingAvailable ?? 'UNSURE',
    locationStatus: latestLocation ? 'AVAILABLE' : 'UNAVAILABLE',
    financialAppsPresent: sensitiveApps.includes('BANKING') || sensitiveApps.includes('UPI'),
    authenticatorPresent: sensitiveApps.includes('AUTHENTICATOR'),
    passwordManagerPresent: sensitiveApps.includes('PASSWORD_MANAGER'),
    workAccountPresent: sensitiveApps.includes('WORK_ACCOUNTS'),
    deviceSecured: isCompleted('SECURE_DEVICE'),
    simSecured: isCompleted('SIM_PROTECTION'),
    financialAccountsSecured: isCompleted('FINANCIAL_PROTECTION'),
    policeReportStatus,
    ceirStatus: ceirRecord?.status ?? 'NOT_READY',
    existingActions: actions.map((action) => ({ type: action.type, status: action.status })),
  };

  return { input, existingDbActions: actions };
}
