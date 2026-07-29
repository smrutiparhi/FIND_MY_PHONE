import { describe, expect, it } from 'vitest';
import type { RecoveryPlan, RecoveryPlanAction } from '@recoverai/shared';
import { deriveEmergencyModeState } from '../../src/services/emergencyMode/deriveEmergencyModeState';

let nextId = 1;
function makeAction(overrides: Partial<RecoveryPlanAction> = {}): RecoveryPlanAction {
  const id = `action-${nextId++}`;
  return {
    id: id as RecoveryPlanAction['id'],
    type: 'SECURE_DEVICE',
    priority: 1,
    title: `Action ${id}`,
    reason: 'reason',
    instructions: 'instructions',
    status: 'PENDING',
    dependencies: [],
    officialExternalAction: null,
    ...overrides,
  };
}

function makePlan(overrides: Partial<RecoveryPlan> = {}): RecoveryPlan {
  return {
    riskLevel: 'HIGH',
    riskReasons: [],
    orderedActions: [],
    currentRecommendedAction: null,
    blockedActions: [],
    warnings: [],
    ...overrides,
  };
}

describe('deriveEmergencyModeState', () => {
  it.each(['LOW', 'MEDIUM'] as const)('isEmergency is false at %s risk', (riskLevel) => {
    expect(deriveEmergencyModeState(makePlan({ riskLevel })).isEmergency).toBe(false);
  });

  it.each(['HIGH', 'CRITICAL'] as const)('isEmergency is true at %s risk', (riskLevel) => {
    expect(deriveEmergencyModeState(makePlan({ riskLevel })).isEmergency).toBe(true);
  });

  it('counts completed vs total actions', () => {
    const actions = [
      makeAction({ priority: 1, status: 'COMPLETED' }),
      makeAction({ priority: 2, status: 'PENDING' }),
      makeAction({ priority: 3, status: 'SKIPPED' }),
    ];
    const state = deriveEmergencyModeState(makePlan({ orderedActions: actions }));
    expect(state.completedCount).toBe(1);
    expect(state.totalCount).toBe(3);
  });

  it('passes currentRecommendedAction straight through as currentAction', () => {
    const current = makeAction({ priority: 1 });
    const state = deriveEmergencyModeState(makePlan({ orderedActions: [current], currentRecommendedAction: current }));
    expect(state.currentAction).toBe(current);
  });

  it('nextAction is the next non-terminal action after current, skipping completed/skipped ones', () => {
    const current = makeAction({ priority: 1, status: 'PENDING' });
    const alreadyDone = makeAction({ priority: 2, status: 'COMPLETED' });
    const skipped = makeAction({ priority: 3, status: 'SKIPPED' });
    const upNext = makeAction({ priority: 4, status: 'BLOCKED' });
    const state = deriveEmergencyModeState(
      makePlan({ orderedActions: [current, alreadyDone, skipped, upNext], currentRecommendedAction: current }),
    );
    expect(state.nextAction).toBe(upNext);
  });

  it('nextAction is null when there is no current action', () => {
    const state = deriveEmergencyModeState(makePlan({ orderedActions: [], currentRecommendedAction: null }));
    expect(state.nextAction).toBeNull();
  });

  it('nextAction is null when the current action is the last non-terminal one', () => {
    const current = makeAction({ priority: 1, status: 'PENDING' });
    const done = makeAction({ priority: 2, status: 'COMPLETED' });
    const state = deriveEmergencyModeState(makePlan({ orderedActions: [current, done], currentRecommendedAction: current }));
    expect(state.nextAction).toBeNull();
  });

  it('carries riskReasons and warnings through unchanged', () => {
    const state = deriveEmergencyModeState(
      makePlan({ riskReasons: ['reason one'], warnings: ['do not confront a thief'] }),
    );
    expect(state.riskReasons).toEqual(['reason one']);
    expect(state.warnings).toEqual(['do not confront a thief']);
  });
});
