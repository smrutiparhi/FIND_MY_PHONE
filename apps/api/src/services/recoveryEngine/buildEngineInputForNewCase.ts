import type { CreateRecoveryCaseWizardInput, PlatformType } from '@recoverai/shared';
import { computeTimeSinceIncidentBucket } from './timeSinceIncident';
import type { RecoveryEngineInput } from './types';

/**
 * Builds engine input straight from the ten wizard answers (Part 5) - no DB
 * read needed, since nothing else exists yet for a brand-new case. Every
 * "has this been secured/filed/submitted" flag starts false: the case was
 * just opened.
 */
export function buildEngineInputForNewCase(
  wizardInput: CreateRecoveryCaseWizardInput,
  platform: PlatformType,
): RecoveryEngineInput {
  const sensitiveApps = wizardInput.sensitiveApps;

  return {
    incidentType: wizardInput.incidentType,
    timeSinceIncident: computeTimeSinceIncidentBucket(wizardInput.lastSeenAt),
    platform,
    accountAccess: wizardInput.accountAccessStatus,
    simAccess: wizardInput.simAccessStatus,
    screenLockStatus: wizardInput.screenLockEnabled,
    deviceFindingAvailability: wizardInput.deviceFindingAvailable,
    locationStatus: 'UNAVAILABLE',
    financialAppsPresent: sensitiveApps.includes('BANKING') || sensitiveApps.includes('UPI'),
    authenticatorPresent: sensitiveApps.includes('AUTHENTICATOR'),
    passwordManagerPresent: sensitiveApps.includes('PASSWORD_MANAGER'),
    workAccountPresent: sensitiveApps.includes('WORK_ACCOUNTS'),
    deviceSecured: false,
    simSecured: false,
    financialAccountsSecured: false,
    policeReportStatus: 'NOT_STARTED',
    ceirStatus: 'NOT_READY',
    existingActions: [],
  };
}
