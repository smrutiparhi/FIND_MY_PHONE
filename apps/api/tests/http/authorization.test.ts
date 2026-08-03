import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import { createApp } from '../../src/app';
import { env } from '../../src/config/env';
import { closePool } from '../../src/db/pool';
import { createHttpTestUser, deleteHttpTestUser, type HttpTestUser } from './httpTestHelpers';

/**
 * HTTP-level authorization and security tests (Part 20: "Add automated
 * authorization/security tests"). The repository layer already has
 * exhaustive IDOR coverage (tests/repositories/ownership.test.ts) - this
 * file proves the same guarantee holds through the *real* stack a browser
 * actually talks to: Express routing, requireAuth's real Supabase token
 * verification, and the controller/service layer, using real disposable
 * Supabase Auth accounts rather than a mocked auth layer.
 */
const app = createApp();

describe('HTTP authorization and security', () => {
  let userA: HttpTestUser;
  let userB: HttpTestUser;

  beforeAll(async () => {
    userA = await createHttpTestUser('a');
    userB = await createHttpTestUser('b');
  }, 45000);

  afterAll(async () => {
    await deleteHttpTestUser(userA);
    await deleteHttpTestUser(userB);
    // createApp() pulls from its own db pool, separate from tests/setup.ts's testPool - left
    // open for the rest of a long suite run, the two together can exceed Supabase's
    // session-mode pooler connection limit (see db/pool.ts's closePool() doc comment).
    await closePool();
  });

  describe('authentication', () => {
    it('rejects a request with no Authorization header', async () => {
      const res = await request(app).get('/api/recovery-cases');
      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    });

    it('rejects a request with a garbage bearer token', async () => {
      const res = await request(app).get('/api/recovery-cases').set('Authorization', 'Bearer not-a-real-token');
      expect(res.status).toBe(401);
    });

    it('rejects a malformed Authorization header (missing "Bearer " prefix)', async () => {
      const res = await request(app).get('/api/recovery-cases').set('Authorization', userA.token);
      expect(res.status).toBe(401);
    });
  });

  describe("IDOR: a stranger can never reach another user's case through the real HTTP stack", () => {
    // The suite-wide beforeEach in tests/setup.ts truncates every table before *every*
    // test (including these), so a case created once in an outer beforeAll would be wiped
    // before the second test ever runs. Each test here gets its own fresh case instead -
    // slower, but it means every 404 assertion below is a real ownership check against a
    // case that actually exists, not an accidental false-positive against an empty table.
    let caseId: string;

    beforeEach(async () => {
      const created = await request(app)
        .post('/api/recovery-cases')
        .set('Authorization', `Bearer ${userA.token}`)
        .send({
          incidentType: 'STOLEN',
          device: { mode: 'new', nickname: 'Auth Test Phone', manufacturer: 'Samsung', model: 'Galaxy S23', platform: 'ANDROID' },
          lastSeenAt: null,
          lastSeenDescription: null,
          accountAccessStatus: 'NO',
          simAccessStatus: 'LOST_WITH_PHONE',
          screenLockEnabled: 'YES',
          sensitiveApps: [],
          deviceFindingAvailable: 'YES',
        });
      expect(created.status).toBe(201);
      caseId = created.body.data.id;
    }, 15000);

    it('GET /api/recovery-cases/:caseId - 404, not 403 (never confirms the case exists)', async () => {
      const res = await request(app).get(`/api/recovery-cases/${caseId}`).set('Authorization', `Bearer ${userB.token}`);
      expect(res.status).toBe(404);
    });

    it('the owner can still fetch their own case', async () => {
      const res = await request(app).get(`/api/recovery-cases/${caseId}`).set('Authorization', `Bearer ${userA.token}`);
      expect(res.status).toBe(200);
      expect(res.body.data.id).toBe(caseId);
    });

    it('GET .../evidence - 404 for a stranger', async () => {
      const res = await request(app)
        .get(`/api/recovery-cases/${caseId}/evidence`)
        .set('Authorization', `Bearer ${userB.token}`);
      expect(res.status).toBe(404);
    });

    it('GET .../timeline - 404 for a stranger', async () => {
      const res = await request(app)
        .get(`/api/recovery-cases/${caseId}/timeline`)
        .set('Authorization', `Bearer ${userB.token}`);
      expect(res.status).toBe(404);
    });

    it('PATCH .../sim-protection - 404 for a stranger, and the case is left untouched', async () => {
      const res = await request(app)
        .patch(`/api/recovery-cases/${caseId}/sim-protection`)
        .set('Authorization', `Bearer ${userB.token}`)
        .send({ status: 'BLOCK_REQUESTED' });
      expect(res.status).toBe(404);

      const stillOwners = await request(app)
        .get(`/api/recovery-cases/${caseId}/sim-protection`)
        .set('Authorization', `Bearer ${userA.token}`);
      expect(stillOwners.status).toBe(200);
      expect(stillOwners.body.data.record.status).toBe('ACTIVE');
    });

    it("POST .../timeline/notes - 404 for a stranger (cannot inject a note into someone else's case)", async () => {
      const res = await request(app)
        .post(`/api/recovery-cases/${caseId}/timeline/notes`)
        .set('Authorization', `Bearer ${userB.token}`)
        .send({ title: 'Hijacked note', description: null });
      expect(res.status).toBe(404);
    });

    it("PATCH /api/devices/:deviceId - 404 for a stranger on the device-direct route (not case-scoped)", async () => {
      const ownCase = await request(app).get(`/api/recovery-cases/${caseId}`).set('Authorization', `Bearer ${userA.token}`);
      const deviceId = ownCase.body.data.deviceId;

      const res = await request(app)
        .patch(`/api/devices/${deviceId}`)
        .set('Authorization', `Bearer ${userB.token}`)
        .send({ simType: 'ESIM' });
      expect(res.status).toBe(404);

      const list = await request(app).get('/api/devices').set('Authorization', `Bearer ${userB.token}`);
      expect(list.body.data).not.toContainEqual(expect.objectContaining({ id: deviceId }));
    });
  });

  describe('security headers', () => {
    it('never reveals the Express/framework fingerprint', async () => {
      const res = await request(app).get('/api/health');
      expect(res.headers['x-powered-by']).toBeUndefined();
    });

    it("applies helmet's baseline protective headers", async () => {
      const res = await request(app).get('/api/health');
      expect(res.headers['x-content-type-options']).toBe('nosniff');
      expect(res.headers['x-frame-options']).toBeDefined();
    });

    it('applies rate-limit headers to a real response', async () => {
      const res = await request(app).get('/api/health');
      expect(res.headers['ratelimit-limit']).toBeDefined();
    });
  });

  describe('CORS', () => {
    it('reflects the configured WEB_ORIGIN', async () => {
      const res = await request(app).get('/api/health').set('Origin', env.WEB_ORIGIN);
      expect(res.headers['access-control-allow-origin']).toBe(env.WEB_ORIGIN);
    });

    it("never echoes back an arbitrary caller's Origin - always the fixed configured one", async () => {
      // The `cors` package, configured with a static origin string (not a matcher
      // function), always announces that one fixed origin - it never dynamically
      // reflects whatever Origin the caller sent. That's the actual security property:
      // a request from https://evil.example.com still gets told "only
      // http://localhost:5173 is allowed," which the *browser* then enforces by refusing
      // to let evil.example.com's own JS read the response - it does not mean an
      // unrecognized Origin gets no header at all.
      const res = await request(app).get('/api/health').set('Origin', 'https://evil.example.com');
      expect(res.headers['access-control-allow-origin']).toBe(env.WEB_ORIGIN);
      expect(res.headers['access-control-allow-origin']).not.toBe('https://evil.example.com');
    });
  });
});
