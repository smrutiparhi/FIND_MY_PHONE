import { describe, expect, it } from 'vitest';
import { createUserWithCase, repos } from '../factories';
import { testPool } from '../setup';

describe('RecoveryActionRepository', () => {
  it('lists actions ordered by priority', async () => {
    const { recoveryCase } = await createUserWithCase();
    await repos.recoveryActions.create({
      caseId: recoveryCase.id,
      type: 'POLICE_REPORT',
      priority: 3,
      title: 'File a police complaint',
      reason: 'Test',
      instructions: 'Test',
    });
    await repos.recoveryActions.create({
      caseId: recoveryCase.id,
      type: 'LOCATE_DEVICE',
      priority: 1,
      title: 'Locate the device',
      reason: 'Test',
      instructions: 'Test',
    });
    await repos.recoveryActions.create({
      caseId: recoveryCase.id,
      type: 'SIM_PROTECTION',
      priority: 2,
      title: 'Protect the SIM',
      reason: 'Test',
      instructions: 'Test',
    });

    const list = await repos.recoveryActions.listByCase(recoveryCase.id);
    expect(list.map((a) => a.type)).toEqual(['LOCATE_DEVICE', 'SIM_PROTECTION', 'POLICE_REPORT']);
  });

  it('persists and returns the dependency graph', async () => {
    const { recoveryCase } = await createUserWithCase();
    const simAction = await repos.recoveryActions.create({
      caseId: recoveryCase.id,
      type: 'SIM_PROTECTION',
      priority: 1,
      title: 'Protect the SIM',
      reason: 'Test',
      instructions: 'Test',
    });
    const accountAction = await repos.recoveryActions.create({
      caseId: recoveryCase.id,
      type: 'ACCOUNT_RECOVERY',
      priority: 2,
      title: 'Recover the account',
      reason: 'Test',
      instructions: 'Test',
      dependsOnActionIds: [simAction.id],
    });

    const fetched = await repos.recoveryActions.findById(accountAction.id);
    expect(fetched?.dependsOnActionIds).toEqual([simAction.id]);
  });

  it('rejects a self-referential dependency at the database level', async () => {
    const { recoveryCase } = await createUserWithCase();
    const action = await repos.recoveryActions.create({
      caseId: recoveryCase.id,
      type: 'SIM_PROTECTION',
      priority: 1,
      title: 'Protect the SIM',
      reason: 'Test',
      instructions: 'Test',
    });

    await expect(
      repos.recoveryActions.create({
        caseId: recoveryCase.id,
        type: 'ACCOUNT_RECOVERY',
        priority: 2,
        title: 'Self-referencing',
        reason: 'Test',
        instructions: 'Test',
        dependsOnActionIds: [action.id],
      }),
    ).resolves.toBeDefined();

    // Directly attempting a row that depends on itself must be rejected by the CHECK constraint.
    await expect(
      testPool.query(
        'INSERT INTO recovery_action_dependencies (action_id, depends_on_action_id) VALUES ($1, $1)',
        [action.id],
      ),
    ).rejects.toThrow();
  });

  it('marks an action completed and stamps completed_at', async () => {
    const { user, recoveryCase } = await createUserWithCase();
    const action = await repos.recoveryActions.create({
      caseId: recoveryCase.id,
      type: 'SECURE_DEVICE',
      priority: 1,
      title: 'Secure the device',
      reason: 'Test',
      instructions: 'Test',
    });
    expect(action.completedAt).toBeNull();

    const completed = await repos.recoveryActions.updateStatus(action.id, user.id, 'COMPLETED');
    expect(completed?.status).toBe('COMPLETED');
    expect(completed?.completedAt).not.toBeNull();
  });
});
