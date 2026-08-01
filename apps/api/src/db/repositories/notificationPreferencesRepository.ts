import type { NotificationPreferences, NotificationPreferencesId, NotificationType, UserId } from '@recoverai/shared';
import type { Queryable } from '../queryable';

interface NotificationPreferencesRow {
  id: string;
  user_id: string;
  muted_types: NotificationType[];
  email_enabled: boolean;
  push_enabled: boolean;
  sms_enabled: boolean;
  quiet_hours_enabled: boolean;
  quiet_hours_start_minute: number | null;
  quiet_hours_end_minute: number | null;
  timezone: string | null;
  created_at: string;
  updated_at: string;
}

function toNotificationPreferences(row: NotificationPreferencesRow): NotificationPreferences {
  return {
    id: row.id as NotificationPreferencesId,
    userId: row.user_id as UserId,
    mutedTypes: row.muted_types,
    emailEnabled: row.email_enabled,
    pushEnabled: row.push_enabled,
    smsEnabled: row.sms_enabled,
    quietHoursEnabled: row.quiet_hours_enabled,
    quietHoursStartMinute: row.quiet_hours_start_minute,
    quietHoursEndMinute: row.quiet_hours_end_minute,
    timezone: row.timezone,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export interface UpdateNotificationPreferencesInput {
  mutedTypes?: NotificationType[];
  emailEnabled?: boolean;
  pushEnabled?: boolean;
  smsEnabled?: boolean;
  quietHoursEnabled?: boolean;
  quietHoursStartMinute?: number | null;
  quietHoursEndMinute?: number | null;
  timezone?: string | null;
}

/** One row per user (mirrors ceir_records' one-per-case pattern), lazily created the first time preferences are read or written. */
export class NotificationPreferencesRepository {
  constructor(private readonly db: Queryable) {}

  async getOrCreateForUser(userId: UserId): Promise<NotificationPreferences> {
    const existing = await this.findByUser(userId);
    if (existing) return existing;

    const result = await this.db.query<NotificationPreferencesRow>(
      `INSERT INTO notification_preferences (user_id) VALUES ($1)
       ON CONFLICT (user_id) DO UPDATE SET user_id = EXCLUDED.user_id
       RETURNING *`,
      [userId],
    );
    const row = result.rows[0];
    if (!row) throw new Error('Insert into notification_preferences returned no row');
    return toNotificationPreferences(row);
  }

  async findByUser(userId: UserId): Promise<NotificationPreferences | null> {
    const result = await this.db.query<NotificationPreferencesRow>(
      'SELECT * FROM notification_preferences WHERE user_id = $1',
      [userId],
    );
    const row = result.rows[0];
    return row ? toNotificationPreferences(row) : null;
  }

  async update(userId: UserId, patch: UpdateNotificationPreferencesInput): Promise<NotificationPreferences> {
    await this.getOrCreateForUser(userId);
    const result = await this.db.query<NotificationPreferencesRow>(
      `UPDATE notification_preferences SET
         muted_types = COALESCE($2, muted_types),
         email_enabled = COALESCE($3, email_enabled),
         push_enabled = COALESCE($4, push_enabled),
         sms_enabled = COALESCE($5, sms_enabled),
         quiet_hours_enabled = COALESCE($6, quiet_hours_enabled),
         quiet_hours_start_minute = CASE WHEN $7::boolean THEN $8 ELSE quiet_hours_start_minute END,
         quiet_hours_end_minute = CASE WHEN $9::boolean THEN $10 ELSE quiet_hours_end_minute END,
         timezone = CASE WHEN $11::boolean THEN $12 ELSE timezone END
       WHERE user_id = $1
       RETURNING *`,
      [
        userId,
        patch.mutedTypes ?? null,
        patch.emailEnabled ?? null,
        patch.pushEnabled ?? null,
        patch.smsEnabled ?? null,
        patch.quietHoursEnabled ?? null,
        'quietHoursStartMinute' in patch,
        patch.quietHoursStartMinute ?? null,
        'quietHoursEndMinute' in patch,
        patch.quietHoursEndMinute ?? null,
        'timezone' in patch,
        patch.timezone ?? null,
      ],
    );
    const row = result.rows[0];
    if (!row) throw new Error('Update of notification_preferences returned no row');
    return toNotificationPreferences(row);
  }
}
