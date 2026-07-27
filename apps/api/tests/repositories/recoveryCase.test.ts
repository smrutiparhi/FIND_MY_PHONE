import { describe, expect, it } from 'vitest';
import {
  createTestCase,
  createTestDevice,
  createTestUser,
  createUserWithCase,
  repos,
} from '../factories';
import { testPool } from '../setup';

describe('RecoveryCaseRepository', () => {
  it('lists active cases before closed/recovered/erased ones, newest first within each group', async () => {
    const user = await createTestUser();
    const device = await createTestDevice(user.id);

    const closed = await createTestCase(user.id, device.id);
    await repos.recoveryCases.update(closed.id, user.id, { status: 'CLOSED' });

    const activeOld = await createTestCase(user.id, device.id);
    const activeNew = await createTestCase(user.id, device.id);

    const list = await repos.recoveryCases.listByUser(user.id);
    expect(list.map((c) => c.id)).toEqual([activeNew.id, activeOld.id, closed.id]);
  });

  it('sets closed_at automatically when status transitions to a terminal state, and only then', async () => {
    const { user, recoveryCase } = await createUserWithCase();
    expect(recoveryCase.closedAt).toBeNull();

    const secured = await repos.recoveryCases.update(recoveryCase.id, user.id, {
      status: 'SECURING',
    });
    expect(secured?.closedAt).toBeNull();

    const recovered = await repos.recoveryCases.update(recoveryCase.id, user.id, {
      status: 'RECOVERED',
    });
    expect(recovered?.closedAt).not.toBeNull();
  });

  it('links and clears the current recommended action', async () => {
    const { user, recoveryCase } = await createUserWithCase();
    const action = await repos.recoveryActions.create({
      caseId: recoveryCase.id,
      type: 'SECURE_DEVICE',
      priority: 1,
      title: 'Secure the device',
      reason: 'Test',
      instructions: 'Test',
    });

    const withAction = await repos.recoveryCases.setCurrentRecommendedAction(
      recoveryCase.id,
      user.id,
      action.id,
    );
    expect(withAction?.currentRecommendedActionId).toBe(action.id);

    const cleared = await repos.recoveryCases.setCurrentRecommendedAction(
      recoveryCase.id,
      user.id,
      null,
    );
    expect(cleared?.currentRecommendedActionId).toBeNull();
  });

  it('nulls out current_recommended_action_id if that action row is deleted (ON DELETE SET NULL)', async () => {
    const { user, recoveryCase } = await createUserWithCase();
    const action = await repos.recoveryActions.create({
      caseId: recoveryCase.id,
      type: 'SECURE_DEVICE',
      priority: 1,
      title: 'Secure the device',
      reason: 'Test',
      instructions: 'Test',
    });
    await repos.recoveryCases.setCurrentRecommendedAction(recoveryCase.id, user.id, action.id);

    // The repository never deletes an individual action (only status-transitions
    // it), so this constraint is exercised directly against the database to
    // guard against a future migration accidentally changing the FK behavior.
    await testPool.query('DELETE FROM recovery_actions WHERE id = $1', [action.id]);

    const result = await repos.recoveryCases.findById(recoveryCase.id, user.id);
    expect(result?.currentRecommendedActionId).toBeNull();
  });

  it('refuses to delete a device that still has recovery case history (ON DELETE RESTRICT)', async () => {
    const { user, device } = await createUserWithCase();
    await expect(repos.devices.delete(device.id, user.id)).rejects.toThrow();
  });
});
