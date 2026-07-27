import { randomUUID } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { createTestUser, repos } from '../factories';

describe('AuditEventRepository', () => {
  it('records an event with a free-text action and structured metadata', async () => {
    const user = await createTestUser();
    const event = await repos.auditEvents.record({
      userId: user.id,
      action: 'auth.login.success',
      resourceType: 'user',
      resourceId: user.id,
      ipAddress: '203.0.113.42',
      userAgent: 'vitest',
      metadata: { method: 'password' },
    });

    expect(event.action).toBe('auth.login.success');
    expect(event.metadata).toEqual({ method: 'password' });
  });

  it('lists events by user and by resource, newest first', async () => {
    const user = await createTestUser();
    const deviceId = randomUUID();
    await repos.auditEvents.record({ userId: user.id, action: 'auth.login.success' });
    await repos.auditEvents.record({
      userId: user.id,
      action: 'device.created',
      resourceType: 'device',
      resourceId: deviceId,
    });
    await repos.auditEvents.record({
      userId: user.id,
      action: 'device.updated',
      resourceType: 'device',
      resourceId: deviceId,
    });

    const byUser = await repos.auditEvents.listByUser(user.id);
    expect(byUser).toHaveLength(3);
    expect(byUser[0]?.action).toBe('device.updated');

    const byResource = await repos.auditEvents.listByResource('device', deviceId);
    expect(byResource.map((e) => e.action)).toEqual(['device.updated', 'device.created']);
  });

  it('allows a null user for events where identity is not yet known', async () => {
    const event = await repos.auditEvents.record({
      action: 'auth.login.failure',
      metadata: { reason: 'unknown_email' },
    });
    expect(event.userId).toBeNull();
  });
});
