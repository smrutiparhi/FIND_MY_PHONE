import type {
  IncidentType,
  OfficialExternalAction,
  PlatformType,
  RecoveryActionType,
  RiskLevel,
  SensitiveAppType,
  SimAccessStatus,
  TriStateAnswer,
} from '@recoverai/shared';

/**
 * PROVISIONAL - this is Part 5's wizard-completion calculation, not the
 * Recovery Decision Engine. The master spec puts the real engine in its own
 * dedicated Part 6 ("the most important engineering part"): a deterministic
 * rule set over a much larger input space (device-secured/SIM-secured/
 * police/CEIR status, time-since-incident, dependency-aware blocking,
 * warnings, recalculation triggers) with 20+ tested scenarios. None of that
 * state exists yet at the moment a case is first created - only the wizard's
 * ten answers do - so this module only ever needs to run once, at creation
 * time, from exactly those ten answers.
 *
 * Part 6 replaces this function; createRecoveryCaseFromWizard.ts is written
 * so that swap only touches this one file.
 */

export interface ComputeInitialAssessmentInput {
  incidentType: IncidentType;
  platform: PlatformType;
  accountAccessStatus: TriStateAnswer;
  simAccessStatus: SimAccessStatus;
  screenLockEnabled: TriStateAnswer;
  sensitiveApps: SensitiveAppType[];
  deviceFindingAvailable: TriStateAnswer;
}

export interface ProposedRecoveryAction {
  type: RecoveryActionType;
  priority: number;
  title: string;
  reason: string;
  instructions: string;
  officialExternalAction?: OfficialExternalAction | null;
  /** Resolved to real ids by createRecoveryCaseFromWizard.ts once each referenced action has been inserted. */
  dependsOnTypes?: RecoveryActionType[];
}

export interface InitialAssessmentResult {
  riskLevel: RiskLevel;
  riskReasons: string[];
  actions: ProposedRecoveryAction[];
}

function scoreToRiskLevel(score: number): RiskLevel {
  if (score >= 7) return 'CRITICAL';
  if (score >= 5) return 'HIGH';
  if (score >= 2) return 'MEDIUM';
  return 'LOW';
}

function findingProvider(platform: PlatformType): OfficialExternalAction | null {
  if (platform === 'ANDROID') {
    return { provider: 'google', label: 'Open Google Find Hub', url: 'https://android.com/find' };
  }
  if (platform === 'IPHONE') {
    return { provider: 'apple', label: 'Open Find My', url: 'https://www.icloud.com/find' };
  }
  return null;
}

function accountRecoveryProvider(platform: PlatformType): OfficialExternalAction | null {
  if (platform === 'ANDROID') {
    return { provider: 'google', label: 'Start Google Account Recovery', url: 'https://accounts.google.com/signin/recovery' };
  }
  if (platform === 'IPHONE') {
    return { provider: 'apple', label: 'Start Apple Account Recovery', url: 'https://iforgot.apple.com' };
  }
  return null;
}

const FINANCIAL_APP_TYPES: SensitiveAppType[] = ['BANKING', 'UPI'];
const CREDENTIAL_APP_TYPES: SensitiveAppType[] = ['AUTHENTICATOR', 'PASSWORD_MANAGER'];

export function computeInitialAssessment(input: ComputeInitialAssessmentInput): InitialAssessmentResult {
  const reasons: string[] = [];
  let score = 0;

  if (input.incidentType === 'STOLEN') {
    score += 3;
    reasons.push('The device was stolen, not just misplaced.');
  } else if (input.incidentType === 'UNSURE') {
    score += 1;
    reasons.push("It isn't yet clear whether the device was lost or stolen.");
  }

  if (input.accountAccessStatus === 'NO') {
    score += 2;
    reasons.push('The owner cannot currently access their Google/Apple account.');
  } else if (input.accountAccessStatus === 'UNSURE') {
    score += 1;
  }

  if (input.simAccessStatus === 'LOST_WITH_PHONE') {
    score += 2;
    reasons.push('The SIM was lost with the device, blocking OTP-based recovery until it is replaced.');
  } else if (input.simAccessStatus === 'UNSURE') {
    score += 1;
  }

  if (input.screenLockEnabled === 'NO') {
    score += 2;
    reasons.push('The device did not have a screen lock enabled.');
  } else if (input.screenLockEnabled === 'UNSURE') {
    score += 1;
    reasons.push('It is unclear whether a screen lock was enabled.');
  }

  const hasFinancialApps = input.sensitiveApps.some((app) => FINANCIAL_APP_TYPES.includes(app));
  const hasCredentialApps = input.sensitiveApps.some((app) => CREDENTIAL_APP_TYPES.includes(app));
  const deviceUnlocked = input.screenLockEnabled !== 'YES';

  if (hasFinancialApps) {
    // Master spec: "STOLEN + banking apps + unlocked device: Financial protection must
    // become extremely high priority" - weighted heavily specifically for that combination.
    score += input.incidentType === 'STOLEN' && deviceUnlocked ? 3 : 2;
    reasons.push('Banking or UPI apps are present on the device.');
  }
  if (hasCredentialApps) {
    score += 1;
    reasons.push('A password manager or authenticator app is present on the device.');
  }

  if (input.deviceFindingAvailable === 'NO') {
    score += 1;
    reasons.push('No authorized device-finding option is currently available.');
  }

  const riskLevel = scoreToRiskLevel(score);
  const actions: ProposedRecoveryAction[] = [];
  let priority = 1;

  const canAttemptFinding = input.deviceFindingAvailable === 'YES';
  if (canAttemptFinding) {
    actions.push({
      type: 'LOCATE_DEVICE',
      priority: priority++,
      title: `Locate the device using ${input.platform === 'IPHONE' ? 'Find My' : 'Google Find Hub'}`,
      reason: 'Authorized device-finding is available, so start by checking the last reported location.',
      instructions: `Sign in to ${input.platform === 'IPHONE' ? 'Find My' : 'Find Hub'} on another device with the same account.`,
      officialExternalAction: findingProvider(input.platform),
    });

    if (input.incidentType === 'LOST') {
      actions.push({
        type: 'RING_DEVICE',
        priority: priority++,
        title: 'Ring the device to help locate it nearby',
        reason: 'For a lost (not stolen) device, ringing it can help pinpoint it in the immediate area.',
        instructions: 'Use the "Play Sound" option, even if the device is on silent.',
        dependsOnTypes: ['LOCATE_DEVICE'],
      });
      actions.push({
        type: 'NEARBY_SEARCH',
        priority: priority++,
        title: 'Search the area where the device was last active',
        reason: 'Ringing narrows down the search to a specific area worth checking physically.',
        instructions: 'Check likely spots near where the sound was heard or the location was last reported.',
        dependsOnTypes: ['RING_DEVICE'],
      });
    }
  }

  if (input.simAccessStatus !== 'SIM_ALREADY_BLOCKED') {
    actions.push({
      type: 'SIM_PROTECTION',
      priority: priority++,
      title: input.simAccessStatus === 'LOST_WITH_PHONE' ? 'Block and replace your SIM card' : 'Protect your SIM/phone number',
      reason:
        input.simAccessStatus === 'LOST_WITH_PHONE'
          ? 'The SIM was lost with the phone, so replacing it is the fastest path back to OTP-based account recovery.'
          : 'Protecting the SIM prevents it from being used to intercept OTPs or reset account passwords.',
      instructions: 'Contact your carrier to block the SIM and, if needed, request a replacement.',
    });
  }

  if (input.incidentType !== 'LOST' || input.screenLockEnabled !== 'YES') {
    actions.push({
      type: 'SECURE_DEVICE',
      priority: priority++,
      title: 'Secure the device remotely (Lost Mode / lock / erase)',
      reason:
        input.incidentType === 'STOLEN'
          ? 'The device is in someone else\'s possession - secure it remotely as soon as account access allows.'
          : 'The screen-lock status is uncertain, so securing the device remotely is a precaution.',
      instructions:
        input.platform === 'IPHONE'
          ? 'Use Find My to enable Lost Mode, which locks the device and displays a contact message.'
          : 'Use Find Hub to lock the device remotely and display a contact message.',
    });
  }

  if (input.accountAccessStatus !== 'YES') {
    const dependsOnSim = input.simAccessStatus === 'LOST_WITH_PHONE';
    actions.push({
      type: 'ACCOUNT_RECOVERY',
      priority: priority++,
      title: `Recover your ${input.platform === 'IPHONE' ? 'Apple' : 'Google'} account access`,
      reason: dependsOnSim
        ? 'Account recovery often needs a one-time code sent to your phone number, so restoring SIM access first speeds this up.'
        : 'Account access is needed to use device-finding and remote security features.',
      instructions: `Use the official ${input.platform === 'IPHONE' ? 'Apple' : 'Google'} account recovery flow - never share your password or recovery codes with anyone, including RecoverAI.`,
      officialExternalAction: accountRecoveryProvider(input.platform),
      dependsOnTypes: dependsOnSim ? ['SIM_PROTECTION'] : undefined,
    });
  }

  if (hasFinancialApps || hasCredentialApps) {
    actions.push({
      type: 'FINANCIAL_PROTECTION',
      priority: hasFinancialApps && input.incidentType === 'STOLEN' && deviceUnlocked ? 0 : priority++,
      title: 'Secure banking, UPI, and password-manager access',
      reason: 'Financial and credential apps on the device could let someone else access your money or other accounts.',
      instructions: 'Contact your bank/UPI provider to freeze or re-secure access, and revoke sessions in your password manager.',
    });
  }

  if (input.incidentType === 'STOLEN' || input.incidentType === 'UNSURE') {
    actions.push({
      type: 'POLICE_REPORT',
      priority: priority++,
      title: 'File a police complaint',
      reason: 'A police complaint documents the theft and is required before submitting a CEIR request.',
      instructions: 'Use the Police Complaint Assistant to prepare a draft from your confirmed details.',
    });
    actions.push({
      type: 'CEIR_SUBMISSION',
      priority: priority++,
      title: 'Submit a CEIR request to block the IMEI',
      reason: 'CEIR/Sanchar Saathi submission requires a filed police complaint first.',
      instructions: 'Use the CEIR Assistant once your police complaint has been filed.',
      dependsOnTypes: ['POLICE_REPORT'],
    });
  }

  actions.push({
    type: 'MONITOR',
    priority: priority++,
    title: 'Monitor the case for updates',
    reason: 'Keep watching for new location information or changes in device/account status.',
    instructions: 'Check back here for updates, and record anything new you learn (e.g. the device reappearing online).',
  });

  // Financial protection with an emergency priority of 0 sorts first regardless of insertion
  // order - re-number everything to a clean, gap-free sequence before returning.
  const ordered = [...actions].sort((a, b) => a.priority - b.priority);
  ordered.forEach((action, index) => {
    action.priority = index + 1;
  });

  return { riskLevel, riskReasons: reasons, actions: ordered };
}
