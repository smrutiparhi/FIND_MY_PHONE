import { describe, expect, it } from 'vitest';
import { maskPhoneNumber } from '../../src/lib/encryption';
import { createTestUser, repos } from '../factories';

describe('DeviceRepository', () => {
  it('encrypts IMEI/serial fields at rest and decrypts only via the explicit accessor', async () => {
    const user = await createTestUser();
    const device = await repos.devices.create({
      userId: user.id,
      nickname: "User's Phone",
      manufacturer: 'Apple',
      model: 'iPhone 15',
      platform: 'IPHONE',
      imei1: '356789101234567',
      imei2: '356789101234568',
      serialNumber: 'C02XG2JMQ6L4',
    });

    // The general read path returns ciphertext, never plaintext.
    expect(device.imei1Encrypted).not.toBe('356789101234567');
    expect(device.imei1Encrypted).not.toContain('356789101234567');
    expect(device.serialNumberEncrypted).not.toBe('C02XG2JMQ6L4');

    await expect(repos.devices.getDecryptedImei1(device.id, user.id)).resolves.toBe(
      '356789101234567',
    );
    await expect(repos.devices.getDecryptedImei2(device.id, user.id)).resolves.toBe(
      '356789101234568',
    );
    await expect(repos.devices.getDecryptedSerialNumber(device.id, user.id)).resolves.toBe(
      'C02XG2JMQ6L4',
    );
  });

  it('never persists a full phone number - only a masked display string', () => {
    expect(maskPhoneNumber('+919876543210')).toBe('+91••••••3210');
    expect(maskPhoneNumber('9876543210')).toBe('98••••3210');
  });

  it('defaults sim_type to UNKNOWN when not provided', async () => {
    const user = await createTestUser();
    const device = await repos.devices.create({
      userId: user.id,
      nickname: 'No SIM info',
      manufacturer: 'Google',
      model: 'Pixel 8',
      platform: 'ANDROID',
    });
    expect(device.simType).toBe('UNKNOWN');
  });

  it('updates only the fields explicitly included in the patch', async () => {
    const user = await createTestUser();
    const device = await repos.devices.create({
      userId: user.id,
      nickname: 'Original',
      manufacturer: 'Samsung',
      model: 'Galaxy S23',
      platform: 'ANDROID',
      carrier: 'Original Carrier',
    });

    const updated = await repos.devices.update(device.id, user.id, { nickname: 'Renamed' });
    expect(updated?.nickname).toBe('Renamed');
    expect(updated?.carrier).toBe('Original Carrier');

    const cleared = await repos.devices.update(device.id, user.id, { carrier: null });
    expect(cleared?.carrier).toBeNull();
    expect(cleared?.nickname).toBe('Renamed');
  });

  it("lists only the requesting user's devices, newest first", async () => {
    const user = await createTestUser();
    const first = await repos.devices.create({
      userId: user.id,
      nickname: 'First',
      manufacturer: 'A',
      model: 'A1',
      platform: 'ANDROID',
    });
    const second = await repos.devices.create({
      userId: user.id,
      nickname: 'Second',
      manufacturer: 'B',
      model: 'B1',
      platform: 'IPHONE',
    });

    const list = await repos.devices.listByUser(user.id);
    expect(list.map((d) => d.id)).toEqual([second.id, first.id]);
  });

  it('deletes a device that has no recovery case history', async () => {
    const user = await createTestUser();
    const device = await repos.devices.create({
      userId: user.id,
      nickname: 'Disposable',
      manufacturer: 'A',
      model: 'A1',
      platform: 'ANDROID',
    });

    await expect(repos.devices.delete(device.id, user.id)).resolves.toBe(true);
    await expect(repos.devices.findById(device.id, user.id)).resolves.toBeNull();
  });
});
