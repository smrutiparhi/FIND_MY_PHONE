import type { OfficialExternalAction, RecoveryActionType, RiskLevel } from '@recoverai/shared';
import { accountRecoveryProvider, findingProvider } from './officialProviderLinks';
import type { EngineAction, ExistingActionState, RecoveryEngineInput, RecoveryEngineResult } from './types';

/**
 * The Recovery Decision Engine (master spec Part 6) - a deterministic rule
 * set, not a prompt. Given identical input this always produces identical
 * output; nothing here calls the database, the clock, or an LLM. The AI
 * layer (Part 7) may only ever read this function's output to explain a
 * recommendation in natural language - it has no path to change riskLevel,
 * orderedActions, currentRecommendedAction, or blockedActions.
 *
 * Design: every possible action is generated as a "candidate" tagged with a
 * priority tier (lower = more urgent); candidates are then merged against
 * existingActions (never deleting or silently resetting a row a user has
 * already started/completed/skipped), sorted by tier, and re-numbered into
 * final priorities. Dependencies are resolved by RecoveryActionType, and any
 * pending action whose dependency isn't COMPLETED is surfaced as BLOCKED.
 */

interface Candidate {
  type: RecoveryActionType;
  tier: number;
  title: string;
  reason: string;
  instructions: string;
  officialExternalAction?: OfficialExternalAction | null;
  dependencies?: RecoveryActionType[];
}

function computeRisk(input: RecoveryEngineInput): { riskLevel: RiskLevel; riskReasons: string[] } {
  const reasons: string[] = [];
  let score = 0;

  if (input.incidentType === 'STOLEN') {
    score += 3;
    reasons.push('The device was stolen, not just misplaced.');
  } else if (input.incidentType === 'UNSURE') {
    score += 1;
    reasons.push("It isn't yet clear whether the device was lost or stolen.");
  }

  if (!input.deviceSecured) {
    if (input.accountAccess === 'NO') {
      score += 2;
      reasons.push('The owner cannot currently access their Google/Apple account.');
    } else if (input.accountAccess === 'UNSURE') {
      score += 1;
    }

    if (input.simAccess === 'LOST_WITH_PHONE' && !input.simSecured) {
      score += 2;
      reasons.push('The SIM was lost with the device, blocking OTP-based recovery until it is replaced.');
    } else if (input.simAccess === 'UNSURE' && !input.simSecured) {
      score += 1;
    }

    if (input.screenLockStatus === 'NO') {
      score += 2;
      reasons.push('The device did not have a screen lock enabled.');
    } else if (input.screenLockStatus === 'UNSURE') {
      score += 1;
      reasons.push('It is unclear whether a screen lock was enabled.');
    }
  } else {
    reasons.push('The device has already been secured remotely, reducing further exposure.');
  }

  if (input.financialAppsPresent && !input.financialAccountsSecured) {
    score += input.incidentType === 'STOLEN' && !input.deviceSecured ? 3 : 2;
    reasons.push('Banking or UPI apps are present and have not yet been secured.');
  }
  if ((input.authenticatorPresent || input.passwordManagerPresent) && !input.financialAccountsSecured) {
    score += 1;
    reasons.push('A password manager or authenticator app is present on the device.');
  }
  if (input.workAccountPresent) {
    score += 1;
    reasons.push('Work accounts are present - your employer may need to be informed.');
  }

  if (input.deviceFindingAvailability === 'NO') {
    score += 1;
    reasons.push('No authorized device-finding option is currently available.');
  }
  if (input.incidentType === 'STOLEN' && input.locationStatus === 'UNAVAILABLE') {
    score += 1;
  }

  if (input.timeSinceIncident === 'OLDER' && !input.deviceSecured) {
    score += 1;
    reasons.push('This case has been open for a while without the device being secured yet.');
  }

  if (input.simSecured) score = Math.max(0, score - 1);

  const riskLevel: RiskLevel = score >= 7 ? 'CRITICAL' : score >= 5 ? 'HIGH' : score >= 2 ? 'MEDIUM' : 'LOW';
  return { riskLevel, riskReasons: reasons };
}

/**
 * Tier numbers below are chosen to reproduce the master spec's own worked
 * examples exactly (see the module doc-comment and the "matches the spec's
 * examples" test cases): 0=financial emergency, 1=confident locate/ring/
 * search, 2=secure-device-when-account-access-already-works, 3=SIM
 * protection, 4=account recovery, 5=secure-device-once-account-recovered,
 * 6=uncertain locate (attempted once access allows), 7=general account/
 * financial protection, 8=evidence, 9=police, 10=CEIR, 11=monitor.
 */
function buildCandidates(input: RecoveryEngineInput): Candidate[] {
  const candidates: Candidate[] = [];
  const deviceLabel = input.platform === 'IPHONE' ? 'Find My' : 'Find Hub';
  const accountLabel = input.platform === 'IPHONE' ? 'Apple' : 'Google';
  const hasAccountAccess = input.accountAccess === 'YES';

  const financialEmergency =
    input.financialAppsPresent && !input.financialAccountsSecured && input.incidentType === 'STOLEN' && !input.deviceSecured;
  if (financialEmergency) {
    candidates.push({
      type: 'FINANCIAL_PROTECTION',
      tier: 0,
      title: 'Secure banking, UPI, and password-manager access',
      reason: 'The device is stolen, unsecured, and has financial apps on it - this is now the single highest priority.',
      instructions: 'Contact your bank/UPI provider immediately to freeze or re-secure access, and revoke sessions in your password manager.',
    });
  }

  const findingConfident = input.deviceFindingAvailability === 'YES';
  const findingUncertain = input.deviceFindingAvailability === 'UNSURE';
  if (findingConfident) {
    candidates.push({
      type: 'LOCATE_DEVICE',
      tier: 1,
      title: `Locate the device using ${deviceLabel}`,
      reason: 'Authorized device-finding is available, so start by checking the last reported location.',
      instructions: `Sign in to ${deviceLabel} on another device with the same account.`,
      officialExternalAction: findingProvider(input.platform),
    });

    if (input.incidentType === 'LOST') {
      candidates.push({
        type: 'RING_DEVICE',
        tier: 1,
        title: 'Ring the device to help locate it nearby',
        reason: 'For a lost (not stolen) device, ringing it can help pinpoint it in the immediate area.',
        instructions: 'Use the "Play Sound" option, even if the device is on silent.',
        dependencies: ['LOCATE_DEVICE'],
      });
      candidates.push({
        type: 'NEARBY_SEARCH',
        tier: 1,
        title: 'Search the area where the device was last active',
        reason: 'Ringing narrows the search down to a specific area worth checking physically.',
        instructions: 'Check likely spots near where the sound was heard or the location was last reported.',
        dependencies: ['RING_DEVICE'],
      });
    }
  }

  const deviceNeedsSecuring = !input.deviceSecured && (input.incidentType !== 'LOST' || input.screenLockStatus !== 'YES');
  if (deviceNeedsSecuring && hasAccountAccess) {
    candidates.push({
      type: 'SECURE_DEVICE',
      tier: 2,
      title: 'Secure the device remotely (Lost Mode / lock / erase)',
      reason:
        input.incidentType === 'STOLEN'
          ? "The device is in someone else's possession - secure it remotely now that account access is confirmed."
          : 'The screen-lock status is uncertain, so securing the device remotely is a precaution.',
      instructions:
        input.platform === 'IPHONE'
          ? 'Use Find My to enable Lost Mode, which locks the device and displays a contact message.'
          : 'Use Find Hub to lock the device remotely and display a contact message.',
    });
  }

  // A thief may still have physical access to the SIM even if the owner has another line via
  // ANOTHER_DEVICE_HAS_ACCESS - so STOLEN/UNSURE always warrants protecting it as a precaution,
  // while a plain LOST device with an unaffected number does not (matches the master spec's
  // "Locate -> Ring -> Nearby Search" example, which includes no SIM step at all).
  const simAtRisk =
    input.simAccess === 'LOST_WITH_PHONE' || input.simAccess === 'UNSURE' || input.incidentType !== 'LOST';
  if (input.simAccess !== 'SIM_ALREADY_BLOCKED' && !input.simSecured && simAtRisk) {
    candidates.push({
      type: 'SIM_PROTECTION',
      tier: 3,
      title: input.simAccess === 'LOST_WITH_PHONE' ? 'Block and replace your SIM card' : 'Protect your SIM/phone number',
      reason:
        input.simAccess === 'LOST_WITH_PHONE'
          ? 'The SIM was lost with the phone, so replacing it is the fastest path back to OTP-based account recovery.'
          : 'Protecting the SIM prevents it from being used to intercept OTPs or reset account passwords.',
      instructions: 'Contact your carrier to block the SIM and, if needed, request a replacement.',
    });
  }

  if (!hasAccountAccess) {
    const dependsOnSim = input.simAccess === 'LOST_WITH_PHONE' && !input.simSecured;
    candidates.push({
      type: 'ACCOUNT_RECOVERY',
      tier: 4,
      title: `Recover your ${accountLabel} account access`,
      reason: dependsOnSim
        ? 'Account recovery often needs a one-time code sent to your phone number, so restoring SIM access first speeds this up.'
        : 'Account access is needed to use device-finding and remote security features.',
      instructions: `Use the official ${accountLabel} account recovery flow - never share your password or recovery codes with anyone, including RecoverAI.`,
      officialExternalAction: accountRecoveryProvider(input.platform),
      dependencies: dependsOnSim ? ['SIM_PROTECTION'] : undefined,
    });

    // Remote-secure and device-finding both typically require being signed in, so once account
    // access is gone, they're pushed after (and blocked on) recovering it rather than offered
    // as if they could be done right away - see the "attempted device finding" position in the
    // master spec's "no account access" example.
    if (deviceNeedsSecuring) {
      candidates.push({
        type: 'SECURE_DEVICE',
        tier: 5,
        title: 'Secure the device remotely (Lost Mode / lock / erase)',
        reason: "The device is in someone else's possession - secure it remotely as soon as account access is restored.",
        instructions:
          input.platform === 'IPHONE'
            ? 'Use Find My to enable Lost Mode, which locks the device and displays a contact message.'
            : 'Use Find Hub to lock the device remotely and display a contact message.',
        dependencies: ['ACCOUNT_RECOVERY'],
      });
    }
    if (findingUncertain) {
      candidates.push({
        type: 'LOCATE_DEVICE',
        tier: 6,
        title: `Locate the device using ${deviceLabel}`,
        reason: "Device-finding may work once account access is confirmed - worth attempting once you're able to sign in.",
        instructions: `Sign in to ${deviceLabel} on another device with the same account.`,
        officialExternalAction: findingProvider(input.platform),
        dependencies: ['ACCOUNT_RECOVERY'],
      });
    }
  } else if (findingUncertain) {
    // Account access already works, so there's no reason to gate an uncertain finding attempt
    // behind anything - just offer it at a lower priority than the confirmed-available case.
    candidates.push({
      type: 'LOCATE_DEVICE',
      tier: 6,
      title: `Locate the device using ${deviceLabel}`,
      reason: "It's not confirmed whether device-finding will work, but it's worth attempting.",
      instructions: `Sign in to ${deviceLabel} on another device with the same account.`,
      officialExternalAction: findingProvider(input.platform),
    });
  }

  // Matches the master spec's "Protect Critical Accounts" step, which appears in both STOLEN
  // worked examples regardless of whether specific financial apps were called out - being
  // stolen at all warrants a general account-protection pass, escalated further above when
  // financial apps are specifically present.
  const needsGeneralAccountProtection =
    !financialEmergency &&
    !input.financialAccountsSecured &&
    (input.financialAppsPresent || input.authenticatorPresent || input.passwordManagerPresent || input.incidentType === 'STOLEN');
  if (needsGeneralAccountProtection) {
    candidates.push({
      type: 'FINANCIAL_PROTECTION',
      tier: 7,
      title: 'Protect your critical accounts',
      reason:
        input.financialAppsPresent || input.authenticatorPresent || input.passwordManagerPresent
          ? 'Financial and credential apps on the device could let someone else access your money or other accounts.'
          : 'Reviewing account security is good practice whenever a device is stolen, even without financial apps flagged.',
      instructions: 'Review and re-secure banking/UPI apps, your password manager, and any authenticator-linked accounts.',
    });
  }

  if (input.incidentType === 'STOLEN' || input.incidentType === 'UNSURE') {
    candidates.push({
      type: 'EVIDENCE_COLLECTION',
      tier: 8,
      title: 'Preserve evidence about the incident',
      reason: 'Notes, receipts, and screenshots taken now are harder to gather later and help the police complaint and CEIR process.',
      instructions: 'Save the purchase invoice, any IMEI/serial documentation, and a written account of what happened.',
    });

    if (input.policeReportStatus !== 'FILED') {
      candidates.push({
        type: 'POLICE_REPORT',
        tier: 9,
        title: 'File a police complaint',
        reason: 'A police complaint documents the theft and is required before submitting a CEIR request.',
        instructions: 'Use the Police Complaint Assistant to prepare a draft from your confirmed details.',
      });
    }

    if (!['SUBMITTED', 'PROCESSING', 'BLOCKED', 'UNBLOCKED'].includes(input.ceirStatus)) {
      candidates.push({
        type: 'CEIR_SUBMISSION',
        tier: 10,
        title: 'Submit a CEIR request to block the IMEI',
        reason: 'CEIR/Sanchar Saathi submission requires a filed police complaint first.',
        instructions: 'Use the CEIR Assistant once your police complaint has been filed.',
        dependencies: ['POLICE_REPORT'],
      });
    }
  }

  candidates.push({
    type: 'MONITOR',
    tier: 11,
    title: 'Monitor the case for updates',
    reason: 'Keep watching for new location information or changes in device/account status.',
    instructions: 'Check back here for updates, and record anything new you learn (e.g. the device reappearing online).',
  });

  return candidates;
}

function isDependencySatisfied(dependsOnType: RecoveryActionType, actions: Map<RecoveryActionType, EngineAction>): boolean {
  const dependency = actions.get(dependsOnType);
  // Missing dependency (shouldn't normally happen) never blocks - avoids a permanent deadlock.
  return !dependency || dependency.status === 'COMPLETED';
}

const ENGINE_CONTROLLED_STATUSES = new Set(['PENDING', 'BLOCKED']);

export function evaluateRecoveryDecision(input: RecoveryEngineInput): RecoveryEngineResult {
  const { riskLevel, riskReasons } = computeRisk(input);
  const candidates = buildCandidates(input);
  const existingByType = new Map<RecoveryActionType, ExistingActionState>(input.existingActions.map((a) => [a.type, a]));

  const merged = candidates
    .map((candidate) => candidate) // stable order for the sort below
    .sort((a, b) => a.tier - b.tier)
    .map((candidate): EngineAction => {
      const existing = existingByType.get(candidate.type);
      return {
        type: candidate.type,
        priority: 0, // assigned below, after final ordering
        title: candidate.title,
        reason: candidate.reason,
        instructions: candidate.instructions,
        status: existing?.status ?? 'PENDING',
        dependencies: candidate.dependencies ?? [],
        officialExternalAction: candidate.officialExternalAction ?? null,
        isExisting: existing !== undefined,
      };
    });

  // A previously-created action whose type no longer has a fresh candidate (state changed since
  // it was created) is still kept - completed/in-progress/skipped history is never erased.
  for (const existing of input.existingActions) {
    if (!merged.some((action) => action.type === existing.type)) {
      merged.push({
        type: existing.type,
        priority: 0,
        title: existing.type,
        reason: 'Carried over from an earlier assessment.',
        instructions: '',
        status: existing.status,
        dependencies: [],
        officialExternalAction: null,
        isExisting: true,
      });
    }
  }

  const byType = new Map(merged.map((action) => [action.type, action]));

  for (const action of merged) {
    if (!ENGINE_CONTROLLED_STATUSES.has(action.status)) continue;
    const blocked = action.dependencies.some((dep) => !isDependencySatisfied(dep, byType));
    action.status = blocked ? 'BLOCKED' : 'PENDING';
  }

  merged.forEach((action, index) => {
    action.priority = index + 1;
  });

  const blockedActions = merged.filter((action) => action.status === 'BLOCKED');
  const currentRecommendedAction =
    merged.find((action) => action.status === 'PENDING' || action.status === 'IN_PROGRESS') ?? null;

  const warnings: string[] = [];
  if (input.incidentType === 'STOLEN') {
    warnings.push(
      'If the device appears at an unfamiliar location, do not go there or confront a suspected thief - share the information with the police instead.',
    );
  }
  if (input.financialAppsPresent && !input.deviceSecured && !input.financialAccountsSecured) {
    warnings.push('Financial apps are present on a device that has not been secured yet - protect your bank/UPI access as soon as possible.');
  }
  if (input.timeSinceIncident === 'OLDER' && !input.deviceSecured && !input.simSecured) {
    warnings.push('This case has been open for a while with no protective action completed yet - consider prioritizing the current recommendation now.');
  }

  return { riskLevel, riskReasons, orderedActions: merged, currentRecommendedAction, blockedActions, warnings };
}
