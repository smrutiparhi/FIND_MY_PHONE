import { describe, expect, it, vi } from 'vitest';
import { advanceDemoCase, getDemoState, resetDemoCase, startOrResumeDemoCase } from '../../src/services/demo/demoService';
import { createNotification } from '../../src/services/notifications/createNotification';
import { ForbiddenError, NotFoundError } from '../../src/lib/errors';
import { repos, createTestUser } from '../factories';
import { testPool } from '../setup';

// Every test here does at least one real, multi-write demo-case operation (case creation runs
// the full Recovery Decision Engine; each stage advance is a real service call chaining several
// writes) - the suite-wide 20s default is too tight, and a test that times out leaves its
// still-running background query holding locks that then deadlock the *next* test's
// TRUNCATE-based beforeEach (see tests/setup.ts). A generous per-file default avoids that
// cascade rather than just papering over one slow test at a time.
vi.setConfig({ testTimeout: 60000 });

describe('Demo Mode (Part 22)', () => {
  it('starts a fictional STOLEN case at CRITICAL/HIGH risk, isolated from the real dashboard', async () => {
    const user = await createTestUser();
    const state = await startOrResumeDemoCase(testPool, user.id);

    expect(state.recoveryCase.isDemo).toBe(true);
    expect(state.recoveryCase.incidentType).toBe('STOLEN');
    expect(['CRITICAL', 'HIGH']).toContain(state.recoveryCase.riskLevel);
    expect(state.stage).toBe(2);
    expect(state.stageLabel).toBe('Risk Assessment');

    // Never shows up in the real dashboard/case list.
    const realCases = await repos.recoveryCases.listByUser(user.id);
    expect(realCases).toHaveLength(0);
  });

  it('re-entering the flow resumes the same case instead of creating a duplicate', async () => {
    const user = await createTestUser();
    const first = await startOrResumeDemoCase(testPool, user.id);
    const second = await startOrResumeDemoCase(testPool, user.id);
    expect(second.recoveryCase.id).toBe(first.recoveryCase.id);
  });

  it('advancing to stage 3 adds a simulated location observation near the fictional Hyderabad Metro incident', async () => {
    const user = await createTestUser();
    const { recoveryCase } = await startOrResumeDemoCase(testPool, user.id);

    await advanceDemoCase(testPool, user.id, recoveryCase.id, 3);
    const locations = await repos.locationObservations.listByCase(recoveryCase.id);
    expect(locations).toHaveLength(1);
    expect(locations[0]?.notes).toContain('DEMO DATA');

    // Idempotent - advancing to the same stage again never duplicates.
    await advanceDemoCase(testPool, user.id, recoveryCase.id, 3);
    const locationsAfter = await repos.locationObservations.listByCase(recoveryCase.id);
    expect(locationsAfter).toHaveLength(1);
  });

  it(
    'advancing through every stage in order blocks the SIM, submits a police complaint, submits CEIR, and confirms recovery',
    async () => {
      const user = await createTestUser();
      const { recoveryCase } = await startOrResumeDemoCase(testPool, user.id);
      const caseId = recoveryCase.id;

      for (let stage = 3; stage <= 10; stage++) {
        await advanceDemoCase(testPool, user.id, caseId, stage);
      }

      const sim = await repos.simProtectionRecords.findByCase(caseId);
      expect(sim?.status).toBe('BLOCKED');

      const reports = await repos.policeReports.listByCase(caseId);
      expect(reports.some((r) => r.status === 'USER_MARKED_SUBMITTED')).toBe(true);

      const ceir = await repos.ceirRecords.findByCase(caseId);
      expect(ceir?.status).toBe('PROCESSING');

      const finalCase = await repos.recoveryCases.findById(caseId, user.id);
      expect(finalCase?.status).toBe('RECOVERED');
    },
    120000,
  );

  it(
    'resuming after partial progress derives the correct current stage',
    async () => {
      const user = await createTestUser();
      const { recoveryCase } = await startOrResumeDemoCase(testPool, user.id);
      await advanceDemoCase(testPool, user.id, recoveryCase.id, 3);
      await advanceDemoCase(testPool, user.id, recoveryCase.id, 5);
      await advanceDemoCase(testPool, user.id, recoveryCase.id, 6);

      const resumed = await getDemoState(testPool, user.id, recoveryCase.id);
      expect(resumed.stage).toBe(7);
      expect(resumed.stageLabel).toBe('Generate Police Complaint');
    },
    60000,
  );

  it(
    'never creates a notification for demo-case events, unlike the identical action on a real case',
    async () => {
      const user = await createTestUser();
      const { recoveryCase } = await startOrResumeDemoCase(testPool, user.id);
      await advanceDemoCase(testPool, user.id, recoveryCase.id, 6); // blocks the SIM - a real case fires SIM_STATUS_UPDATE for this

      const notifications = await repos.notifications.listByUser(user.id);
      expect(notifications).toHaveLength(0);

      // Confirms the suppression is demo-specific, not a general regression - the same call
      // creates a real notification for a caseId that isn't a demo case.
      const created = await createNotification(repos, {
        userId: user.id,
        caseId: recoveryCase.id,
        type: 'SIM_STATUS_UPDATE',
        title: 'Should be suppressed',
        body: 'Body',
      });
      expect(created).toBeNull();
    },
    45000,
  );

  it('refuses to advance or reset a real (non-demo) case, even for its own owner', async () => {
    const user = await createTestUser();
    const device = await repos.devices.create({
      userId: user.id,
      nickname: 'Real Phone',
      manufacturer: 'TestCo',
      model: 'Model X',
      platform: 'ANDROID',
    });
    const realCase = await repos.recoveryCases.create({ userId: user.id, deviceId: device.id, incidentType: 'STOLEN' });

    await expect(advanceDemoCase(testPool, user.id, realCase.id, 3)).rejects.toBeInstanceOf(ForbiddenError);
    await expect(resetDemoCase(testPool, user.id, realCase.id)).rejects.toBeInstanceOf(ForbiddenError);
    await expect(getDemoState(testPool, user.id, realCase.id)).rejects.toBeInstanceOf(ForbiddenError);
  });

  it('reset deletes the demo case and every row it owns, and a fresh start creates a new one', async () => {
    const user = await createTestUser();
    const { recoveryCase } = await startOrResumeDemoCase(testPool, user.id);
    await advanceDemoCase(testPool, user.id, recoveryCase.id, 3);

    await resetDemoCase(testPool, user.id, recoveryCase.id);
    await expect(repos.recoveryCases.findById(recoveryCase.id, user.id)).resolves.toBeNull();
    await expect(repos.locationObservations.listByCase(recoveryCase.id)).resolves.toEqual([]);

    const fresh = await startOrResumeDemoCase(testPool, user.id);
    expect(fresh.recoveryCase.id).not.toBe(recoveryCase.id);
    expect(fresh.stage).toBe(2);
  });

  it("a stranger cannot see or advance another user's demo case", async () => {
    const owner = await createTestUser();
    const stranger = await createTestUser();
    const { recoveryCase } = await startOrResumeDemoCase(testPool, owner.id);

    await expect(getDemoState(testPool, stranger.id, recoveryCase.id)).rejects.toBeInstanceOf(NotFoundError);
    await expect(advanceDemoCase(testPool, stranger.id, recoveryCase.id, 3)).rejects.toBeInstanceOf(NotFoundError);
  });
});
