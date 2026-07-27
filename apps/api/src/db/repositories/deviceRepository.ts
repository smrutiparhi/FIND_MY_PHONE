import type { Device, DeviceId, PlatformType, SimType, UserId } from '@recoverai/shared';
import { decryptField, encryptField } from '../../lib/encryption';
import type { Queryable } from '../queryable';

interface DeviceRow {
  id: string;
  user_id: string;
  nickname: string;
  manufacturer: string;
  model: string;
  platform: PlatformType;
  phone_number_masked: string | null;
  imei1_encrypted: string | null;
  imei2_encrypted: string | null;
  serial_number_encrypted: string | null;
  sim_type: SimType;
  carrier: string | null;
  created_at: string;
  updated_at: string;
}

function toDevice(row: DeviceRow): Device {
  return {
    id: row.id as DeviceId,
    userId: row.user_id as UserId,
    nickname: row.nickname,
    manufacturer: row.manufacturer,
    model: row.model,
    platform: row.platform,
    phoneNumberMasked: row.phone_number_masked,
    // Ciphertext, not plaintext - see getDecryptedImei1/2/SerialNumber below
    // for the explicit, ownership-scoped path to the real value.
    imei1Encrypted: row.imei1_encrypted,
    imei2Encrypted: row.imei2_encrypted,
    serialNumberEncrypted: row.serial_number_encrypted,
    simType: row.sim_type,
    carrier: row.carrier,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export interface CreateDeviceInput {
  userId: UserId;
  nickname: string;
  manufacturer: string;
  model: string;
  platform: PlatformType;
  /** Already masked by the caller (see lib/encryption.ts maskPhoneNumber) - the full number is never persisted. */
  phoneNumberMasked?: string | null;
  /** Plaintext - encrypted before storage. Never store the plaintext anywhere else. */
  imei1?: string | null;
  imei2?: string | null;
  serialNumber?: string | null;
  simType?: SimType;
  carrier?: string | null;
}

export interface UpdateDeviceInput {
  nickname?: string;
  manufacturer?: string;
  model?: string;
  phoneNumberMasked?: string | null;
  imei1?: string | null;
  imei2?: string | null;
  serialNumber?: string | null;
  simType?: SimType;
  carrier?: string | null;
}

/**
 * Every read/write method is scoped by ownerUserId - this is the primary
 * IDOR-prevention mechanism the master spec requires ("Ensure users can
 * never retrieve another user's device"). There is deliberately no
 * unscoped findById: a caller always states which user they're acting as.
 */
export class DeviceRepository {
  constructor(private readonly db: Queryable) {}

  async create(input: CreateDeviceInput): Promise<Device> {
    const result = await this.db.query<DeviceRow>(
      `INSERT INTO devices
         (user_id, nickname, manufacturer, model, platform, phone_number_masked,
          imei1_encrypted, imei2_encrypted, serial_number_encrypted, sim_type, carrier)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, COALESCE($10::sim_type, 'UNKNOWN'), $11)
       RETURNING *`,
      [
        input.userId,
        input.nickname,
        input.manufacturer,
        input.model,
        input.platform,
        input.phoneNumberMasked ?? null,
        input.imei1 ? encryptField(input.imei1) : null,
        input.imei2 ? encryptField(input.imei2) : null,
        input.serialNumber ? encryptField(input.serialNumber) : null,
        input.simType ?? null,
        input.carrier ?? null,
      ],
    );
    const row = result.rows[0];
    if (!row) throw new Error('Insert into devices returned no row');
    return toDevice(row);
  }

  async findById(id: DeviceId, ownerUserId: UserId): Promise<Device | null> {
    const result = await this.db.query<DeviceRow>(
      'SELECT * FROM devices WHERE id = $1 AND user_id = $2',
      [id, ownerUserId],
    );
    const row = result.rows[0];
    return row ? toDevice(row) : null;
  }

  async listByUser(ownerUserId: UserId): Promise<Device[]> {
    const result = await this.db.query<DeviceRow>(
      'SELECT * FROM devices WHERE user_id = $1 ORDER BY created_at DESC',
      [ownerUserId],
    );
    return result.rows.map(toDevice);
  }

  async update(
    id: DeviceId,
    ownerUserId: UserId,
    patch: UpdateDeviceInput,
  ): Promise<Device | null> {
    const result = await this.db.query<DeviceRow>(
      `UPDATE devices SET
         nickname = COALESCE($3, nickname),
         manufacturer = COALESCE($4, manufacturer),
         model = COALESCE($5, model),
         phone_number_masked = CASE WHEN $6::boolean THEN $7 ELSE phone_number_masked END,
         imei1_encrypted = CASE WHEN $8::boolean THEN $9 ELSE imei1_encrypted END,
         imei2_encrypted = CASE WHEN $10::boolean THEN $11 ELSE imei2_encrypted END,
         serial_number_encrypted = CASE WHEN $12::boolean THEN $13 ELSE serial_number_encrypted END,
         sim_type = COALESCE($14, sim_type),
         carrier = CASE WHEN $15::boolean THEN $16 ELSE carrier END
       WHERE id = $1 AND user_id = $2
       RETURNING *`,
      [
        id,
        ownerUserId,
        patch.nickname ?? null,
        patch.manufacturer ?? null,
        patch.model ?? null,
        'phoneNumberMasked' in patch,
        patch.phoneNumberMasked ?? null,
        'imei1' in patch,
        patch.imei1 ? encryptField(patch.imei1) : null,
        'imei2' in patch,
        patch.imei2 ? encryptField(patch.imei2) : null,
        'serialNumber' in patch,
        patch.serialNumber ? encryptField(patch.serialNumber) : null,
        patch.simType ?? null,
        'carrier' in patch,
        patch.carrier ?? null,
      ],
    );
    const row = result.rows[0];
    return row ? toDevice(row) : null;
  }

  async delete(id: DeviceId, ownerUserId: UserId): Promise<boolean> {
    const result = await this.db.query('DELETE FROM devices WHERE id = $1 AND user_id = $2', [
      id,
      ownerUserId,
    ]);
    return (result.rowCount ?? 0) > 0;
  }

  async getDecryptedImei1(id: DeviceId, ownerUserId: UserId): Promise<string | null> {
    const device = await this.findById(id, ownerUserId);
    return device?.imei1Encrypted ? decryptField(device.imei1Encrypted) : null;
  }

  async getDecryptedImei2(id: DeviceId, ownerUserId: UserId): Promise<string | null> {
    const device = await this.findById(id, ownerUserId);
    return device?.imei2Encrypted ? decryptField(device.imei2Encrypted) : null;
  }

  async getDecryptedSerialNumber(id: DeviceId, ownerUserId: UserId): Promise<string | null> {
    const device = await this.findById(id, ownerUserId);
    return device?.serialNumberEncrypted ? decryptField(device.serialNumberEncrypted) : null;
  }
}
