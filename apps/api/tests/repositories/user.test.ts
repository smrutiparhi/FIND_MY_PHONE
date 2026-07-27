import { randomUUID } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import type { UserId } from '@recoverai/shared';
import { createTestUser, repos } from '../factories';

describe('UserRepository', () => {
  it('creates and finds a user by id and by email', async () => {
    const user = await createTestUser({ email: 'lookup@example.com', fullName: 'Lookup Test' });

    await expect(repos.users.findById(user.id)).resolves.toMatchObject({
      email: 'lookup@example.com',
    });
    await expect(repos.users.findByEmail('lookup@example.com')).resolves.toMatchObject({
      id: user.id,
    });
  });

  it('returns null for a user that does not exist', async () => {
    await expect(repos.users.findById(randomUUID() as UserId)).resolves.toBeNull();
    await expect(repos.users.findByEmail('nobody@example.com')).resolves.toBeNull();
  });

  it('enforces unique email at the database level', async () => {
    await createTestUser({ email: 'duplicate@example.com' });
    await expect(createTestUser({ email: 'duplicate@example.com' })).rejects.toThrow();
  });

  it('updates and clears the profile full name', async () => {
    const user = await createTestUser({ fullName: 'Original Name' });

    const renamed = await repos.users.updateProfile(user.id, { fullName: 'New Name' });
    expect(renamed?.fullName).toBe('New Name');

    const cleared = await repos.users.updateProfile(user.id, { fullName: null });
    expect(cleared?.fullName).toBeNull();
  });

  it('deletes a user', async () => {
    const user = await createTestUser();
    await expect(repos.users.delete(user.id)).resolves.toBe(true);
    await expect(repos.users.findById(user.id)).resolves.toBeNull();
    await expect(repos.users.delete(user.id)).resolves.toBe(false);
  });
});
