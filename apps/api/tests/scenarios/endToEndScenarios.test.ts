import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import type { CreateRecoveryCaseWizardInput } from '@recoverai/shared';
import { createApp } from '../../src/app';
import { closePool } from '../../src/db/pool';
import { createHttpTestUser, deleteHttpTestUser, type HttpTestUser } from '../http/httpTestHelpers';

/**
 * Part 21's ten named end-to-end scenarios, run through the real HTTP stack
 * (Express routing, real Supabase-issued tokens, real Postgres) rather than
 * calling service functions directly - "end-to-end" here means the whole
 * request path a browser actually uses, matching the same infrastructure
 * Part 20's authorization tests already proved works. Each scenario asserts
 * a real, distinguishing property of the Recovery Decision Engine's actual
 * output for that incident shape (see evaluateRecoveryDecision.ts's scoring
 * rules) rather than a vague "risk level is set" smoke test.
 */
const app = createApp();

async function createCase(token: string, overrides: Partial<CreateRecoveryCaseWizardInput> = {}) {
  const body: CreateRecoveryCaseWizardInput = {
    incidentType: 'LOST',
    device: { mode: 'new', nickname: 'Scenario Phone', manufacturer: 'Samsung', model: 'Galaxy S23', platform: 'ANDROID' },
    lastSeenAt: null,
    lastSeenDescription: null,
    accountAccessStatus: 'YES',
    simAccessStatus: 'ANOTHER_DEVICE_HAS_ACCESS',
    screenLockEnabled: 'YES',
    sensitiveApps: [],
    deviceFindingAvailable: 'YES',
    ...overrides,
  };
  const res = await request(app).post('/api/recovery-cases').set('Authorization', `Bearer ${token}`).send(body);
  expect(res.status).toBe(201);
  return res.body.data;
}

describe('End-to-end scenarios (Part 21)', () => {
  let user: HttpTestUser;
  let stranger: HttpTestUser;

  beforeAll(async () => {
    user = await createHttpTestUser('scenarios');
    stranger = await createHttpTestUser('scenarios-stranger');
  }, 45000);

  afterAll(async () => {
    await deleteHttpTestUser(user);
    await deleteHttpTestUser(stranger);
    // See tests/http/authorization.test.ts's identical afterAll comment - createApp() opens
    // its own separate db pool from testPool, and leaving it open for the rest of a long
    // suite run risks exceeding Supabase's session-mode pooler connection limit.
    await closePool();
  });

  it(
    '1. Lost Android at home - everything still working, lowest realistic risk',
    async () => {
      const recoveryCase = await createCase(user.token, {
        incidentType: 'LOST',
        accountAccessStatus: 'YES',
        simAccessStatus: 'ANOTHER_DEVICE_HAS_ACCESS',
        screenLockEnabled: 'YES',
        deviceFindingAvailable: 'YES',
      });
      expect(recoveryCase.riskLevel).toBe('LOW');

      const plan = await request(app)
        .get(`/api/recovery-cases/${recoveryCase.id}/recovery-plan`)
        .set('Authorization', `Bearer ${user.token}`);
      const types = plan.body.data.orderedActions.map((a: { type: string }) => a.type);
      // "Locate -> Ring -> Nearby Search" is the master spec's own worked example for this shape.
      expect(types.slice(0, 3)).toEqual(['LOCATE_DEVICE', 'RING_DEVICE', 'NEARBY_SEARCH']);
    },
    30000,
  );

  it(
    '2. Stolen Android with account access - HIGH risk, locate before securing',
    async () => {
      const recoveryCase = await createCase(user.token, {
        incidentType: 'STOLEN',
        accountAccessStatus: 'YES',
        simAccessStatus: 'LOST_WITH_PHONE',
        screenLockEnabled: 'YES',
        deviceFindingAvailable: 'YES',
      });
      expect(recoveryCase.riskLevel).toBe('HIGH');

      const plan = await request(app)
        .get(`/api/recovery-cases/${recoveryCase.id}/recovery-plan`)
        .set('Authorization', `Bearer ${user.token}`);
      expect(plan.body.data.currentRecommendedAction.type).toBe('LOCATE_DEVICE');
      const types = plan.body.data.orderedActions.map((a: { type: string }) => a.type);
      expect(types).toContain('SECURE_DEVICE');
      expect(types).toContain('SIM_PROTECTION');
    },
    30000,
  );

  it(
    '3. Stolen Android without Google account access - CRITICAL, SIM unblocks the rest',
    async () => {
      const recoveryCase = await createCase(user.token, {
        incidentType: 'STOLEN',
        accountAccessStatus: 'NO',
        simAccessStatus: 'UNSURE',
        screenLockEnabled: 'UNSURE',
        deviceFindingAvailable: 'NO',
      });
      expect(recoveryCase.riskLevel).toBe('CRITICAL');

      const plan = await request(app)
        .get(`/api/recovery-cases/${recoveryCase.id}/recovery-plan`)
        .set('Authorization', `Bearer ${user.token}`);
      expect(plan.body.data.currentRecommendedAction.type).toBe('SIM_PROTECTION');
      const accountRecovery = plan.body.data.orderedActions.find((a: { type: string }) => a.type === 'ACCOUNT_RECOVERY');
      expect(accountRecovery).toBeDefined();
      expect(accountRecovery.title).toContain('Google');
    },
    30000,
  );

  it(
    '4. Stolen iPhone with Find My access - MEDIUM risk, "Find My" named explicitly',
    async () => {
      const recoveryCase = await createCase(user.token, {
        incidentType: 'STOLEN',
        device: { mode: 'new', nickname: 'Scenario iPhone', manufacturer: 'Apple', model: 'iPhone 15', platform: 'IPHONE' },
        accountAccessStatus: 'YES',
        simAccessStatus: 'ANOTHER_DEVICE_HAS_ACCESS',
        screenLockEnabled: 'YES',
        deviceFindingAvailable: 'YES',
      });
      expect(recoveryCase.riskLevel).toBe('MEDIUM');

      const plan = await request(app)
        .get(`/api/recovery-cases/${recoveryCase.id}/recovery-plan`)
        .set('Authorization', `Bearer ${user.token}`);
      expect(plan.body.data.currentRecommendedAction.type).toBe('LOCATE_DEVICE');
      expect(plan.body.data.currentRecommendedAction.title).toContain('Find My');
    },
    30000,
  );

  it(
    '5. Stolen iPhone without Apple account access - CRITICAL, account recovery names Apple and waits on the SIM',
    async () => {
      const recoveryCase = await createCase(user.token, {
        incidentType: 'STOLEN',
        device: { mode: 'new', nickname: 'Scenario iPhone', manufacturer: 'Apple', model: 'iPhone 15', platform: 'IPHONE' },
        accountAccessStatus: 'NO',
        simAccessStatus: 'LOST_WITH_PHONE',
        screenLockEnabled: 'NO',
        deviceFindingAvailable: 'NO',
      });
      expect(recoveryCase.riskLevel).toBe('CRITICAL');

      const plan = await request(app)
        .get(`/api/recovery-cases/${recoveryCase.id}/recovery-plan`)
        .set('Authorization', `Bearer ${user.token}`);
      const accountRecovery = plan.body.data.orderedActions.find((a: { type: string }) => a.type === 'ACCOUNT_RECOVERY');
      expect(accountRecovery.title).toContain('Apple');
      expect(accountRecovery.dependencies).toContain('SIM_PROTECTION');
      expect(plan.body.data.currentRecommendedAction.type).toBe('SIM_PROTECTION');
    },
    30000,
  );

  it(
    '6. Phone stolen while unlocked with UPI apps - CRITICAL, financial protection overrides everything else',
    async () => {
      const recoveryCase = await createCase(user.token, {
        incidentType: 'STOLEN',
        accountAccessStatus: 'YES',
        simAccessStatus: 'ANOTHER_DEVICE_HAS_ACCESS',
        screenLockEnabled: 'NO',
        deviceFindingAvailable: 'YES',
        sensitiveApps: ['UPI'],
      });
      expect(recoveryCase.riskLevel).toBe('CRITICAL');

      const plan = await request(app)
        .get(`/api/recovery-cases/${recoveryCase.id}/recovery-plan`)
        .set('Authorization', `Bearer ${user.token}`);
      // Tier 0 - the one candidate that outranks even a confident device-locate.
      expect(plan.body.data.currentRecommendedAction.type).toBe('FINANCIAL_PROTECTION');
      expect(plan.body.data.currentRecommendedAction.title).toContain('banking');
    },
    30000,
  );

  it(
    '7. SIM and phone both unavailable - CRITICAL, everything else blocked behind SIM recovery',
    async () => {
      const recoveryCase = await createCase(user.token, {
        incidentType: 'STOLEN',
        accountAccessStatus: 'UNSURE',
        simAccessStatus: 'LOST_WITH_PHONE',
        screenLockEnabled: 'UNSURE',
        deviceFindingAvailable: 'UNSURE',
      });
      expect(recoveryCase.riskLevel).toBe('CRITICAL');

      const plan = await request(app)
        .get(`/api/recovery-cases/${recoveryCase.id}/recovery-plan`)
        .set('Authorization', `Bearer ${user.token}`);
      expect(plan.body.data.currentRecommendedAction.type).toBe('SIM_PROTECTION');
      const byType: Record<string, string> = Object.fromEntries(
        plan.body.data.orderedActions.map((a: { type: string; status: string }) => [a.type, a.status]),
      );
      expect(byType['ACCOUNT_RECOVERY']).toBe('BLOCKED');
      expect(byType['SECURE_DEVICE']).toBe('BLOCKED');
      expect(byType['LOCATE_DEVICE']).toBe('BLOCKED');
    },
    30000,
  );

  it(
    '8. Device offline - nothing else wrong, the plan reduces to monitoring only',
    async () => {
      const recoveryCase = await createCase(user.token, {
        incidentType: 'LOST',
        accountAccessStatus: 'YES',
        simAccessStatus: 'ANOTHER_DEVICE_HAS_ACCESS',
        screenLockEnabled: 'YES',
        deviceFindingAvailable: 'NO',
      });
      expect(recoveryCase.riskLevel).toBe('LOW');

      const plan = await request(app)
        .get(`/api/recovery-cases/${recoveryCase.id}/recovery-plan`)
        .set('Authorization', `Bearer ${user.token}`);
      expect(plan.body.data.orderedActions).toHaveLength(1);
      expect(plan.body.data.currentRecommendedAction.type).toBe('MONITOR');
    },
    30000,
  );

  it(
    '9. Device recovered after CEIR submission - full lifecycle through to a closed case',
    async () => {
      const recoveryCase = await createCase(user.token, {
        incidentType: 'STOLEN',
        accountAccessStatus: 'NO',
        simAccessStatus: 'LOST_WITH_PHONE',
        screenLockEnabled: 'NO',
        deviceFindingAvailable: 'NO',
      });
      const caseId = recoveryCase.id;
      const auth = { Authorization: `Bearer ${user.token}` };

      // 1. Block and replace the SIM.
      await request(app).patch(`/api/recovery-cases/${caseId}/sim-protection`).set(auth).send({ status: 'BLOCK_REQUESTED' });
      const simBlocked = await request(app).patch(`/api/recovery-cases/${caseId}/sim-protection`).set(auth).send({ status: 'BLOCKED' });
      expect(simBlocked.status).toBe(200);

      // 2. Recover the Google account.
      const accountRecovered = await request(app)
        .patch(`/api/recovery-cases/${caseId}/account-recovery`)
        .set(auth)
        .send({ status: 'RECOVERED', availableSignals: ['PASSWORD', 'RECOVERY_EMAIL'] });
      expect(accountRecovered.status).toBe(200);

      // 3. File and submit a police complaint - required before CEIR.
      const created = await request(app)
        .post(`/api/recovery-cases/${caseId}/police-reports`)
        .set(auth)
        .send({
          ownerFullName: 'Scenario User',
          ownerContact: 'scenario@example.com',
          incidentDescription: 'My phone was stolen while I was commuting home from work yesterday evening.',
        });
      expect(created.status).toBe(201);
      const reportId = created.body.data.report.id;
      await request(app).post(`/api/recovery-cases/${caseId}/police-reports/${reportId}/approve`).set(auth).send({});
      const submitted = await request(app)
        .post(`/api/recovery-cases/${caseId}/police-reports/${reportId}/mark-submitted`)
        .set(auth)
        .send({ externalReferenceNumber: 'FIR-2026-0001' });
      expect(submitted.status).toBe(200);

      // 4. Submit the CEIR request, then progress it to blocked.
      const ceirSubmitted = await request(app)
        .patch(`/api/recovery-cases/${caseId}/ceir`)
        .set(auth)
        .send({ status: 'SUBMITTED', ceirRequestId: 'CEIR-REQ-0001' });
      expect(ceirSubmitted.status).toBe(200);
      const ceirBlocked = await request(app).patch(`/api/recovery-cases/${caseId}/ceir`).set(auth).send({ status: 'BLOCKED' });
      expect(ceirBlocked.status).toBe(200);

      // 5. The device turns up - confirm possession, which moves the case to RECOVERED.
      const confirmed = await request(app)
        .patch(`/api/recovery-cases/${caseId}/device-recovery`)
        .set(auth)
        .send({ completedItems: ['CONFIRM_POSSESSION'] });
      expect(confirmed.status).toBe(200);
      const afterConfirm = await request(app).get(`/api/recovery-cases/${caseId}`).set(auth);
      expect(afterConfirm.body.data.status).toBe('RECOVERED');

      // 6. Close the case.
      const closed = await request(app)
        .post(`/api/recovery-cases/${caseId}/device-recovery/close`)
        .set(auth)
        .send({ confirmedUnresolvedActionsReviewed: true });
      expect(closed.status).toBe(200);
      const final = await request(app).get(`/api/recovery-cases/${caseId}`).set(auth);
      expect(final.body.data.status).toBe('CLOSED');

      // The timeline narrates the whole arc, unprompted.
      const timeline = await request(app).get(`/api/recovery-cases/${caseId}/timeline`).set(auth);
      const timelineTypes = timeline.body.data.map((e: { type: string }) => e.type);
      expect(timelineTypes).toContain('DEVICE_RECOVERED');
      expect(timelineTypes).toContain('CASE_CLOSED');
      expect(timelineTypes).toContain('CEIR_SUBMITTED');
      expect(timelineTypes).toContain('POLICE_COMPLAINT_APPROVED');
    },
    120000,
  );

  it(
    "10. Attempted unauthorized access to another user's case - refused as if it doesn't exist",
    async () => {
      const recoveryCase = await createCase(user.token, { incidentType: 'STOLEN' });

      const strangerRead = await request(app)
        .get(`/api/recovery-cases/${recoveryCase.id}`)
        .set('Authorization', `Bearer ${stranger.token}`);
      expect(strangerRead.status).toBe(404);

      const strangerWrite = await request(app)
        .patch(`/api/recovery-cases/${recoveryCase.id}/sim-protection`)
        .set('Authorization', `Bearer ${stranger.token}`)
        .send({ status: 'BLOCK_REQUESTED' });
      expect(strangerWrite.status).toBe(404);

      // Full end-to-end IDOR coverage across every resource type lives in
      // tests/http/authorization.test.ts - this is the named-scenario proof point.
    },
    30000,
  );
});
