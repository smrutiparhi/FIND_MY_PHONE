import { describe, expect, it } from 'vitest';
import type { CreateRecoveryCaseWizardInput, RecoveryCaseId, UserId } from '@recoverai/shared';
import { createRecoveryCaseFromWizard } from '../../src/services/wizardAssessment/createRecoveryCaseFromWizard';
import { handleRecordIncidentDetails, handleUpdateActionStatus } from '../../src/services/recoveryAgent/toolHandlers';
import type { ToolHandlerContext } from '../../src/services/recoveryAgent/toolHandlers';
import { repos, createTestUser } from '../factories';
import { testPool } from '../setup';

const baseWizardInput: CreateRecoveryCaseWizardInput = {
  incidentType: 'STOLEN',
  device: { mode: 'new', nickname: 'My Phone', manufacturer: 'Google', model: 'Pixel 9', platform: 'ANDROID' },
  lastSeenAt: null,
  lastSeenDescription: null,
  accountAccessStatus: 'YES',
  simAccessStatus: 'LOST_WITH_PHONE',
  screenLockEnabled: 'YES',
  sensitiveApps: [],
  deviceFindingAvailable: 'YES',
};

async function setUpCase(overrides: Partial<CreateRecoveryCaseWizardInput> = {}) {
  const user = await createTestUser();
  const recoveryCase = await createRecoveryCaseFromWizard(testPool, user.id, { ...baseWizardInput, ...overrides });
  const actions = await repos.recoveryActions.listByCase(recoveryCase.id);
  return { user, recoveryCase, actions };
}

function ctxFor(userId: UserId, caseId: RecoveryCaseId, lastUserMessageText: string): ToolHandlerContext {
  return { pool: testPool, userId, caseId, lastUserMessageText };
}

describe('handleUpdateActionStatus', () => {
  it('rejects when userConfirmed is false, even with confirmation-sounding text', async () => {
    const { user, recoveryCase, actions } = await setUpCase();
    const action = actions[0];
    if (!action) throw new Error('expected at least one seeded action');

    const outcome = await handleUpdateActionStatus(ctxFor(user.id, recoveryCase.id, 'yes please'), {
      actionId: action.id,
      newStatus: 'COMPLETED',
      userConfirmed: false,
    });

    expect(outcome.isError).toBe(true);
    expect(outcome.changed).toBe(false);
    const reloaded = await repos.recoveryActions.findById(action.id);
    expect(reloaded?.status).toBe(action.status);
  });

  it("rejects when the user's last message doesn't read as a confirmation, even if userConfirmed claims true", async () => {
    const { user, recoveryCase, actions } = await setUpCase();
    const action = actions[0];
    if (!action) throw new Error('expected at least one seeded action');

    const outcome = await handleUpdateActionStatus(ctxFor(user.id, recoveryCase.id, 'what does that mean?'), {
      actionId: action.id,
      newStatus: 'COMPLETED',
      userConfirmed: true,
    });

    expect(outcome.isError).toBe(true);
    expect(outcome.changed).toBe(false);
  });

  it('applies the status change, logs an AI_AGENT timeline event, and recalculates the plan on real confirmation', async () => {
    const { user, recoveryCase, actions } = await setUpCase();
    const action = actions[0];
    if (!action) throw new Error('expected at least one seeded action');

    const outcome = await handleUpdateActionStatus(ctxFor(user.id, recoveryCase.id, 'yes, mark it done'), {
      actionId: action.id,
      newStatus: 'COMPLETED',
      userConfirmed: true,
    });

    expect(outcome.isError).toBe(false);
    expect(outcome.changed).toBe(true);

    const reloaded = await repos.recoveryActions.findById(action.id);
    expect(reloaded?.status).toBe('COMPLETED');

    const events = await repos.timelineEvents.listByCase(recoveryCase.id);
    const agentEvent = events.find((e) => e.source === 'AI_AGENT' && e.recoveryActionId === action.id);
    expect(agentEvent).toBeDefined();
    expect(agentEvent?.verificationStatus).toBe('USER_REPORTED');
  });

  it('rejects an action id belonging to another user', async () => {
    const { recoveryCase, actions } = await setUpCase();
    const otherUser = await createTestUser();
    const action = actions[0];
    if (!action) throw new Error('expected at least one seeded action');

    const outcome = await handleUpdateActionStatus(ctxFor(otherUser.id, recoveryCase.id, 'yes'), {
      actionId: action.id,
      newStatus: 'COMPLETED',
      userConfirmed: true,
    });

    expect(outcome.isError).toBe(true);
    const reloaded = await repos.recoveryActions.findById(action.id);
    expect(reloaded?.status).toBe(action.status);
  });
});

describe('handleRecordIncidentDetails', () => {
  it('rejects without explicit confirmation', async () => {
    const { user, recoveryCase } = await setUpCase({ sensitiveApps: [] });

    const outcome = await handleRecordIncidentDetails(ctxFor(user.id, recoveryCase.id, 'I have UPI apps on it'), {
      addSensitiveApps: ['UPI'],
      userConfirmed: false,
    });

    expect(outcome.isError).toBe(true);
    expect(outcome.changed).toBe(false);
  });

  it('adding a sensitive app raises financialAccountsSecured-relevant risk and is reflected in a new assessment', async () => {
    const { user, recoveryCase } = await setUpCase({ sensitiveApps: [] });
    const before = await repos.incidentAssessments.findLatestByCase(recoveryCase.id);
    expect(before?.sensitiveApps ?? []).not.toContain('UPI');

    const outcome = await handleRecordIncidentDetails(ctxFor(user.id, recoveryCase.id, 'yes, I have UPI apps on it, please record that'), {
      addSensitiveApps: ['UPI'],
      userConfirmed: true,
    });

    expect(outcome.isError).toBe(false);
    expect(outcome.changed).toBe(true);

    const after = await repos.incidentAssessments.findLatestByCase(recoveryCase.id);
    expect(after?.sensitiveApps).toContain('UPI');

    const events = await repos.timelineEvents.listByCase(recoveryCase.id);
    expect(events.some((e) => e.source === 'AI_AGENT' && e.type === 'USER_NOTE')).toBe(true);
  });

  it('is additive - a second call with a different app keeps the first', async () => {
    const { user, recoveryCase } = await setUpCase({ sensitiveApps: ['BANKING'] });

    await handleRecordIncidentDetails(ctxFor(user.id, recoveryCase.id, 'yes please record that'), {
      addSensitiveApps: ['UPI'],
      userConfirmed: true,
    });

    const after = await repos.incidentAssessments.findLatestByCase(recoveryCase.id);
    expect(after?.sensitiveApps).toEqual(expect.arrayContaining(['BANKING', 'UPI']));
  });

  it('updating accountAccessStatus persists on the case and is picked up by the next recalculation', async () => {
    const { user, recoveryCase } = await setUpCase({ accountAccessStatus: 'NO' });

    await handleRecordIncidentDetails(ctxFor(user.id, recoveryCase.id, 'yes, I now have access, please record it'), {
      accountAccessStatus: 'YES',
      userConfirmed: true,
    });

    const reloadedCase = await repos.recoveryCases.findById(recoveryCase.id, user.id);
    expect(reloadedCase?.accountAccessStatus).toBe('YES');
  });
});
