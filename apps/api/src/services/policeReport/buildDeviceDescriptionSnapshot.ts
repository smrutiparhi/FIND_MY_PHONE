import type { Device, UserId } from '@recoverai/shared';
import type { Repositories } from '../../db/repositories';

/**
 * "Identifying device information" (master spec Part 13), assembled
 * entirely from already-verified system records - never client-supplied,
 * so nothing here can be fabricated by a request body. IMEI/serial are
 * decrypted via the same ownership-scoped accessors Part 2 built for this
 * exact purpose; `imei1`/`imei2`/`serialNumber` are returned alongside the
 * formatted `snapshot` text so the output guard can check what was actually
 * supplied against what the AI draft claims.
 */
export interface DeviceIdentifyingFacts {
  snapshot: string;
  imei1: string | null;
  imei2: string | null;
  serialNumber: string | null;
}

export async function buildDeviceDescriptionSnapshot(
  repos: Repositories,
  device: Device,
  userId: UserId,
): Promise<DeviceIdentifyingFacts> {
  const [imei1, imei2, serialNumber] = await Promise.all([
    repos.devices.getDecryptedImei1(device.id, userId),
    repos.devices.getDecryptedImei2(device.id, userId),
    repos.devices.getDecryptedSerialNumber(device.id, userId),
  ]);

  const lines = [
    `${device.manufacturer} ${device.model} (${device.platform})`,
    `Nickname on file: ${device.nickname}`,
    `Phone number (masked on file): ${device.phoneNumberMasked ?? 'not provided'}`,
    `IMEI 1: ${imei1 ?? 'not provided'}`,
    `IMEI 2: ${imei2 ?? 'not provided'}`,
    `Serial number: ${serialNumber ?? 'not provided'}`,
    `SIM type: ${device.simType}`,
    `Carrier: ${device.carrier ?? 'not provided'}`,
  ];

  return { snapshot: lines.join('\n'), imei1, imei2, serialNumber };
}
