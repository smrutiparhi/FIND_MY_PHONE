import { describe, expect, it } from 'vitest';
import { evaluateRecoveryDecision } from '../../src/services/recoveryEngine/evaluateRecoveryDecision';
import type { ExistingActionState, RecoveryEngineInput } from '../../src/services/recoveryEngine/types';

/**
 * A "clean" LOST case matching the master spec's first worked example:
 * nearby, device-finding available, account/SIM already fine, screen lock
 * on. Individual tests override just the fields relevant to that scenario.
 */
function baseInput(overrides: Partial<RecoveryEngineInput> = {}): RecoveryEngineInput {
  return {
    incidentType: 'LOST',
    timeSinceIncident: 'TODAY',
    platform: 'IPHONE',
    accountAccess: 'YES',
    simAccess: 'ANOTHER_DEVICE_HAS_ACCESS',
    screenLockStatus: 'YES',
    deviceFindingAvailability: 'YES',
    locationStatus: 'AVAILABLE',
    financialAppsPresent: false,
    authenticatorPresent: false,
    passwordManagerPresent: false,
    workAccountPresent: false,
    deviceSecured: false,
    simSecured: false,
    financialAccountsSecured: false,
    policeReportStatus: 'NOT_STARTED',
    ceirStatus: 'NOT_READY',
    existingActions: [],
    ...overrides,
  };
}

function typesOf(actions: { type: string }[]): string[] {
  return actions.map((a) => a.type);
}

function existing(...states: ExistingActionState[]): ExistingActionState[] {
  return states;
}

describe('evaluateRecoveryDecision - master spec worked examples', () => {
  it('Example 1: LOST + nearby + device finding available -> Locate, Ring, Nearby Search, in that order, no SIM step', () => {
    const result = evaluateRecoveryDecision(baseInput());
    const order = typesOf(result.orderedActions);
    expect(order.indexOf('LOCATE_DEVICE')).toBeLessThan(order.indexOf('RING_DEVICE'));
    expect(order.indexOf('RING_DEVICE')).toBeLessThan(order.indexOf('NEARBY_SEARCH'));
    expect(order).not.toContain('SIM_PROTECTION');
    expect(order).not.toContain('SECURE_DEVICE');
    expect(order).not.toContain('POLICE_REPORT');
  });

  it('Example 2: STOLEN + account access + location available -> Locate, Secure Device, Protect SIM, Protect Critical Accounts, Police, CEIR', () => {
    const result = evaluateRecoveryDecision(
      baseInput({
        incidentType: 'STOLEN',
        accountAccess: 'YES',
        locationStatus: 'AVAILABLE',
        simAccess: 'LOST_WITH_PHONE',
      }),
    );
    const order = typesOf(result.orderedActions);
    const namedSteps = ['LOCATE_DEVICE', 'SECURE_DEVICE', 'SIM_PROTECTION', 'FINANCIAL_PROTECTION', 'POLICE_REPORT', 'CEIR_SUBMISSION'];
    const positions = namedSteps.map((type) => order.indexOf(type));
    expect(positions.every((p) => p !== -1)).toBe(true);
    for (let i = 1; i < positions.length; i++) {
      expect(positions[i - 1]).toBeLessThan(positions[i] as number);
    }
    expect(order).not.toContain('RING_DEVICE');
    expect(order).not.toContain('NEARBY_SEARCH');
  });

  it('Example 3: STOLEN + no account access + SIM lost -> SIM/Recover, Recover Platform Account, Attempt Device Finding, Protect Critical Accounts, Police, CEIR', () => {
    const result = evaluateRecoveryDecision(
      baseInput({
        incidentType: 'STOLEN',
        accountAccess: 'NO',
        simAccess: 'LOST_WITH_PHONE',
        deviceFindingAvailability: 'UNSURE',
      }),
    );
    const order = typesOf(result.orderedActions);
    const namedSteps = ['SIM_PROTECTION', 'ACCOUNT_RECOVERY', 'LOCATE_DEVICE', 'FINANCIAL_PROTECTION', 'POLICE_REPORT', 'CEIR_SUBMISSION'];
    const positions = namedSteps.map((type) => order.indexOf(type));
    expect(positions.every((p) => p !== -1)).toBe(true);
    for (let i = 1; i < positions.length; i++) {
      expect(positions[i - 1]).toBeLessThan(positions[i] as number);
    }
    // Account recovery needs the SIM back first (OTP-based recovery).
    const accountRecovery = result.orderedActions.find((a) => a.type === 'ACCOUNT_RECOVERY');
    expect(accountRecovery?.dependencies).toContain('SIM_PROTECTION');
    // Locate is only attempted once account access is back.
    const locate = result.orderedActions.find((a) => a.type === 'LOCATE_DEVICE');
    expect(locate?.dependencies).toContain('ACCOUNT_RECOVERY');
  });

  it('STOLEN + banking apps + unlocked, unsecured device -> financial protection becomes the single highest priority', () => {
    const result = evaluateRecoveryDecision(
      baseInput({
        incidentType: 'STOLEN',
        screenLockStatus: 'NO',
        deviceSecured: false,
        financialAppsPresent: true,
        financialAccountsSecured: false,
      }),
    );
    expect(result.orderedActions[0]?.type).toBe('FINANCIAL_PROTECTION');
    expect(result.orderedActions[0]?.priority).toBe(1);
    expect(result.riskLevel).toBe('CRITICAL');
  });
});

describe('evaluateRecoveryDecision - gating conditions', () => {
  it('does not propose SIM protection when the SIM is already blocked', () => {
    const result = evaluateRecoveryDecision(baseInput({ incidentType: 'STOLEN', simAccess: 'SIM_ALREADY_BLOCKED' }));
    expect(typesOf(result.orderedActions)).not.toContain('SIM_PROTECTION');
  });

  it('does not propose SIM protection for a plain LOST case with an unaffected phone number', () => {
    const result = evaluateRecoveryDecision(baseInput({ incidentType: 'LOST', simAccess: 'ANOTHER_DEVICE_HAS_ACCESS' }));
    expect(typesOf(result.orderedActions)).not.toContain('SIM_PROTECTION');
  });

  it('does propose SIM protection for an UNSURE incident even with another device having access', () => {
    const result = evaluateRecoveryDecision(baseInput({ incidentType: 'UNSURE', simAccess: 'ANOTHER_DEVICE_HAS_ACCESS' }));
    expect(typesOf(result.orderedActions)).toContain('SIM_PROTECTION');
  });

  it('does not propose device securing once the device is already secured', () => {
    const result = evaluateRecoveryDecision(baseInput({ incidentType: 'STOLEN', accountAccess: 'YES', deviceSecured: true }));
    expect(typesOf(result.orderedActions)).not.toContain('SECURE_DEVICE');
  });

  it('does not propose SIM protection once the SIM is already secured', () => {
    const result = evaluateRecoveryDecision(baseInput({ incidentType: 'STOLEN', simSecured: true }));
    expect(typesOf(result.orderedActions)).not.toContain('SIM_PROTECTION');
  });

  it('does not propose financial protection once financial accounts are already secured, even with banking apps present', () => {
    const result = evaluateRecoveryDecision(
      baseInput({ incidentType: 'STOLEN', financialAppsPresent: true, financialAccountsSecured: true }),
    );
    expect(typesOf(result.orderedActions)).not.toContain('FINANCIAL_PROTECTION');
  });

  it('proposes general account protection for any STOLEN case, even with no sensitive apps flagged', () => {
    const result = evaluateRecoveryDecision(
      baseInput({ incidentType: 'STOLEN', financialAppsPresent: false, authenticatorPresent: false, passwordManagerPresent: false }),
    );
    expect(typesOf(result.orderedActions)).toContain('FINANCIAL_PROTECTION');
  });

  it('does not propose police report / CEIR / evidence collection for a plain LOST case', () => {
    const result = evaluateRecoveryDecision(baseInput({ incidentType: 'LOST' }));
    const order = typesOf(result.orderedActions);
    expect(order).not.toContain('POLICE_REPORT');
    expect(order).not.toContain('CEIR_SUBMISSION');
    expect(order).not.toContain('EVIDENCE_COLLECTION');
  });

  it('does not propose a police report once one has already been filed', () => {
    const result = evaluateRecoveryDecision(baseInput({ incidentType: 'STOLEN', policeReportStatus: 'FILED' }));
    expect(typesOf(result.orderedActions)).not.toContain('POLICE_REPORT');
  });

  it('does not propose CEIR submission once it has already been submitted', () => {
    const result = evaluateRecoveryDecision(baseInput({ incidentType: 'STOLEN', ceirStatus: 'SUBMITTED' }));
    expect(typesOf(result.orderedActions)).not.toContain('CEIR_SUBMISSION');
  });

  it('always includes a monitor action, regardless of scenario', () => {
    const lost = evaluateRecoveryDecision(baseInput({ incidentType: 'LOST' }));
    const stolen = evaluateRecoveryDecision(baseInput({ incidentType: 'STOLEN', accountAccess: 'NO' }));
    expect(typesOf(lost.orderedActions)).toContain('MONITOR');
    expect(typesOf(stolen.orderedActions)).toContain('MONITOR');
  });

  it('a minimal, low-risk LOST case with everything already fine produces essentially no action items besides monitoring', () => {
    const result = evaluateRecoveryDecision(
      baseInput({ incidentType: 'LOST', deviceFindingAvailability: 'NO', screenLockStatus: 'YES' }),
    );
    expect(typesOf(result.orderedActions)).toEqual(['MONITOR']);
    expect(result.riskLevel).toBe('LOW');
  });
});

describe('evaluateRecoveryDecision - dependency blocking', () => {
  it('blocks account recovery on SIM protection when the SIM was lost with the phone', () => {
    const result = evaluateRecoveryDecision(baseInput({ incidentType: 'STOLEN', accountAccess: 'NO', simAccess: 'LOST_WITH_PHONE' }));
    const accountRecovery = result.orderedActions.find((a) => a.type === 'ACCOUNT_RECOVERY');
    expect(accountRecovery?.status).toBe('BLOCKED');
    expect(result.blockedActions.map((a) => a.type)).toContain('ACCOUNT_RECOVERY');
  });

  it('unblocks account recovery once SIM protection is marked completed', () => {
    const result = evaluateRecoveryDecision(
      baseInput({
        incidentType: 'STOLEN',
        accountAccess: 'NO',
        simAccess: 'LOST_WITH_PHONE',
        simSecured: true,
        existingActions: existing({ type: 'SIM_PROTECTION', status: 'COMPLETED' }, { type: 'ACCOUNT_RECOVERY', status: 'PENDING' }),
      }),
    );
    const accountRecovery = result.orderedActions.find((a) => a.type === 'ACCOUNT_RECOVERY');
    expect(accountRecovery?.status).toBe('PENDING');
    expect(result.blockedActions.map((a) => a.type)).not.toContain('ACCOUNT_RECOVERY');
  });

  it('blocks CEIR submission until the police report is completed', () => {
    const result = evaluateRecoveryDecision(
      baseInput({
        incidentType: 'STOLEN',
        policeReportStatus: 'DRAFTED',
        existingActions: existing({ type: 'POLICE_REPORT', status: 'PENDING' }, { type: 'CEIR_SUBMISSION', status: 'PENDING' }),
      }),
    );
    const ceir = result.orderedActions.find((a) => a.type === 'CEIR_SUBMISSION');
    expect(ceir?.status).toBe('BLOCKED');
  });

  it('unblocks CEIR submission once the police report action is completed', () => {
    const result = evaluateRecoveryDecision(
      baseInput({
        incidentType: 'STOLEN',
        policeReportStatus: 'FILED',
        existingActions: existing({ type: 'POLICE_REPORT', status: 'COMPLETED' }, { type: 'CEIR_SUBMISSION', status: 'PENDING' }),
      }),
    );
    const ceir = result.orderedActions.find((a) => a.type === 'CEIR_SUBMISSION');
    expect(ceir?.status).toBe('PENDING');
  });
});

describe('evaluateRecoveryDecision - recalculation never resets user progress', () => {
  it('preserves an IN_PROGRESS status across recalculation and surfaces it as the current recommendation', () => {
    const result = evaluateRecoveryDecision(
      baseInput({ existingActions: existing({ type: 'LOCATE_DEVICE', status: 'IN_PROGRESS' }) }),
    );
    const locate = result.orderedActions.find((a) => a.type === 'LOCATE_DEVICE');
    expect(locate?.status).toBe('IN_PROGRESS');
    expect(result.currentRecommendedAction?.type).toBe('LOCATE_DEVICE');
  });

  it('preserves a COMPLETED status across recalculation even though a fresh candidate is regenerated', () => {
    const result = evaluateRecoveryDecision(
      baseInput({ existingActions: existing({ type: 'LOCATE_DEVICE', status: 'COMPLETED' }) }),
    );
    const locate = result.orderedActions.find((a) => a.type === 'LOCATE_DEVICE');
    expect(locate?.status).toBe('COMPLETED');
  });

  it('preserves a SKIPPED status and does not surface it as the current recommendation', () => {
    const result = evaluateRecoveryDecision(
      baseInput({ existingActions: existing({ type: 'RING_DEVICE', status: 'SKIPPED' }) }),
    );
    const ring = result.orderedActions.find((a) => a.type === 'RING_DEVICE');
    expect(ring?.status).toBe('SKIPPED');
    expect(result.currentRecommendedAction?.type).not.toBe('RING_DEVICE');
  });

  it('keeps a completed action visible even after the state that generated it no longer applies', () => {
    // SIM already secured (derived from the action itself being COMPLETED) means no fresh
    // SIM_PROTECTION candidate is generated this round - the row must still survive via the
    // "orphaned existing action" path, not disappear from the plan.
    const result = evaluateRecoveryDecision(
      baseInput({
        incidentType: 'STOLEN',
        simSecured: true,
        existingActions: existing({ type: 'SIM_PROTECTION', status: 'COMPLETED' }),
      }),
    );
    const sim = result.orderedActions.find((a) => a.type === 'SIM_PROTECTION');
    expect(sim?.status).toBe('COMPLETED');
  });

  it('preserves the real title/reason/instructions on a carried-over action instead of falling back to the raw type string', () => {
    // Regression test: the "orphaned existing action" path used to always emit
    // `title: existing.type` (e.g. the literal string "SECURE_DEVICE") and a generic reason,
    // discarding the action's real persisted text - visible to a real user as a raw enum name
    // on the Part 17 dashboard.
    const result = evaluateRecoveryDecision(
      baseInput({
        incidentType: 'STOLEN',
        deviceSecured: true,
        existingActions: existing({
          type: 'SECURE_DEVICE',
          status: 'COMPLETED',
          title: 'Secure the device remotely (Lost Mode / lock / erase)',
          reason: 'The device is in someone else\'s possession.',
          instructions: 'Use Find Hub to lock the device remotely.',
        }),
      }),
    );
    const secure = result.orderedActions.find((a) => a.type === 'SECURE_DEVICE');
    expect(secure?.title).toBe('Secure the device remotely (Lost Mode / lock / erase)');
    expect(secure?.title).not.toBe('SECURE_DEVICE');
    expect(secure?.reason).toBe('The device is in someone else\'s possession.');
    expect(secure?.instructions).toBe('Use Find Hub to lock the device remotely.');
  });

  it('when every action is resolved (completed/skipped), there is no current recommended action', () => {
    const result = evaluateRecoveryDecision(
      baseInput({
        incidentType: 'LOST',
        deviceFindingAvailability: 'NO',
        existingActions: existing({ type: 'MONITOR', status: 'SKIPPED' }),
      }),
    );
    expect(result.currentRecommendedAction).toBeNull();
  });
});

describe('evaluateRecoveryDecision - risk scoring', () => {
  it('scores a clean, secured LOST case as LOW risk', () => {
    const result = evaluateRecoveryDecision(baseInput());
    expect(result.riskLevel).toBe('LOW');
  });

  it('scores a STOLEN case with no account access and no SIM access as CRITICAL', () => {
    const result = evaluateRecoveryDecision(
      baseInput({
        incidentType: 'STOLEN',
        accountAccess: 'NO',
        simAccess: 'LOST_WITH_PHONE',
        screenLockStatus: 'NO',
        deviceFindingAvailability: 'NO',
      }),
    );
    expect(result.riskLevel).toBe('CRITICAL');
  });

  it('a securing an already-secured device lowers the computed risk relative to an otherwise-identical unsecured case', () => {
    const unsecured = evaluateRecoveryDecision(baseInput({ incidentType: 'STOLEN', accountAccess: 'NO', screenLockStatus: 'NO' }));
    const secured = evaluateRecoveryDecision(
      baseInput({ incidentType: 'STOLEN', accountAccess: 'NO', screenLockStatus: 'NO', deviceSecured: true }),
    );
    const riskOrder = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];
    expect(riskOrder.indexOf(secured.riskLevel)).toBeLessThan(riskOrder.indexOf(unsecured.riskLevel));
  });

  it('securing the SIM reduces the computed score relative to an otherwise-identical case', () => {
    const withoutSimSecured = evaluateRecoveryDecision(baseInput({ incidentType: 'UNSURE', simAccess: 'UNSURE' }));
    const withSimSecured = evaluateRecoveryDecision(baseInput({ incidentType: 'UNSURE', simAccess: 'UNSURE', simSecured: true }));
    const riskOrder = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];
    expect(riskOrder.indexOf(withSimSecured.riskLevel)).toBeLessThanOrEqual(riskOrder.indexOf(withoutSimSecured.riskLevel));
  });

  it('an older, still-unsecured case includes a stale-case warning', () => {
    const result = evaluateRecoveryDecision(baseInput({ incidentType: 'STOLEN', timeSinceIncident: 'OLDER' }));
    expect(result.warnings.some((w) => w.toLowerCase().includes('open for a while'))).toBe(true);
  });

  it('a work account present is reflected in the risk reasons without inventing a bogus action type', () => {
    const result = evaluateRecoveryDecision(baseInput({ workAccountPresent: true }));
    expect(result.riskReasons.some((r) => r.toLowerCase().includes('work account'))).toBe(true);
    expect(typesOf(result.orderedActions)).not.toContain('WORK_ACCOUNT_PROTECTION');
  });
});

describe('evaluateRecoveryDecision - warnings', () => {
  it('warns about not confronting a thief for STOLEN cases', () => {
    const result = evaluateRecoveryDecision(baseInput({ incidentType: 'STOLEN' }));
    expect(result.warnings.some((w) => w.toLowerCase().includes('do not go there'))).toBe(true);
  });

  it('does not include the confrontation warning for a plain LOST case', () => {
    const result = evaluateRecoveryDecision(baseInput({ incidentType: 'LOST' }));
    expect(result.warnings.some((w) => w.toLowerCase().includes('do not go there'))).toBe(false);
  });

  it('warns about unsecured financial apps on an unsecured device', () => {
    const result = evaluateRecoveryDecision(baseInput({ financialAppsPresent: true, deviceSecured: false, financialAccountsSecured: false }));
    expect(result.warnings.some((w) => w.toLowerCase().includes('financial apps are present'))).toBe(true);
  });

  it('does not warn about financial apps once the device is already secured', () => {
    const result = evaluateRecoveryDecision(baseInput({ financialAppsPresent: true, deviceSecured: true }));
    expect(result.warnings.some((w) => w.toLowerCase().includes('financial apps are present'))).toBe(false);
  });
});

describe('evaluateRecoveryDecision - purity and structure', () => {
  it('is deterministic: identical input produces deep-equal output', () => {
    const input = baseInput({ incidentType: 'STOLEN', accountAccess: 'UNSURE', deviceFindingAvailability: 'UNSURE' });
    const first = evaluateRecoveryDecision(input);
    const second = evaluateRecoveryDecision(input);
    expect(second).toEqual(first);
  });

  it('assigns a gap-free, ascending priority sequence starting at 1', () => {
    const result = evaluateRecoveryDecision(baseInput({ incidentType: 'STOLEN', accountAccess: 'NO', simAccess: 'LOST_WITH_PHONE' }));
    const priorities = result.orderedActions.map((a) => a.priority);
    expect(priorities).toEqual(priorities.map((_, i) => i + 1));
  });

  it('every generated action carries the fields the master spec requires', () => {
    const result = evaluateRecoveryDecision(baseInput({ incidentType: 'STOLEN', accountAccess: 'NO' }));
    for (const action of result.orderedActions) {
      expect(action.type).toBeTruthy();
      expect(typeof action.priority).toBe('number');
      expect(action.title).toBeTruthy();
      expect(action.reason).toBeTruthy();
      expect(action.instructions).toBeTruthy();
      expect(action.status).toBeTruthy();
      expect(Array.isArray(action.dependencies)).toBe(true);
    }
  });

  it("an uncertain account-access answer attempts device finding once access is confirmed, gated behind account recovery", () => {
    const result = evaluateRecoveryDecision(
      baseInput({ incidentType: 'STOLEN', accountAccess: 'UNSURE', deviceFindingAvailability: 'UNSURE' }),
    );
    // accountAccess !== 'YES' takes the no-account-access branch, so LOCATE_DEVICE depends on ACCOUNT_RECOVERY.
    const locate = result.orderedActions.find((a) => a.type === 'LOCATE_DEVICE');
    expect(locate?.dependencies).toContain('ACCOUNT_RECOVERY');
  });

  it('offers an uncertain device-finding attempt with no dependency when account access already works', () => {
    const result = evaluateRecoveryDecision(baseInput({ incidentType: 'LOST', deviceFindingAvailability: 'UNSURE', accountAccess: 'YES' }));
    const locate = result.orderedActions.find((a) => a.type === 'LOCATE_DEVICE');
    expect(locate).toBeDefined();
    expect(locate?.dependencies).toEqual([]);
  });
});
