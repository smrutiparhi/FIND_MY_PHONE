import { randomUUID } from 'node:crypto';
import type { DeviceId, IncidentType, PlatformType, UserId } from '@recoverai/shared';
import { createRepositories } from '../src/db/repositories';
import { testPool } from './setup';

export const repos = createRepositories(testPool);

export async function createTestUser(overrides: { email?: string; fullName?: string | null } = {}) {
  return repos.users.create({
    id: randomUUID() as UserId,
    email: overrides.email ?? `test-${randomUUID()}@example.com`,
    fullName: overrides.fullName ?? 'Test User',
  });
}

export async function createTestDevice(
  userId: UserId,
  overrides: Partial<{
    nickname: string;
    manufacturer: string;
    model: string;
    platform: PlatformType;
  }> = {},
) {
  return repos.devices.create({
    userId,
    nickname: overrides.nickname ?? 'Test Device',
    manufacturer: overrides.manufacturer ?? 'TestCo',
    model: overrides.model ?? 'Model X',
    platform: overrides.platform ?? 'ANDROID',
  });
}

export async function createTestCase(
  userId: UserId,
  deviceId: DeviceId,
  overrides: Partial<{ incidentType: IncidentType }> = {},
) {
  return repos.recoveryCases.create({
    userId,
    deviceId,
    incidentType: overrides.incidentType ?? 'LOST',
  });
}

/** Convenience: a user with one device and one open case, the shape most repository tests need. */
export async function createUserWithCase() {
  const user = await createTestUser();
  const device = await createTestDevice(user.id);
  const recoveryCase = await createTestCase(user.id, device.id);
  return { user, device, recoveryCase };
}
