import type {
  Notification,
  NotificationId,
  NotificationType,
  RecoveryCaseId,
  UserId,
} from '@recoverai/shared';
import type { Queryable } from '../queryable';

interface NotificationRow {
  id: string;
  user_id: string;
  case_id: string | null;
  type: NotificationType;
  title: string;
  body: string;
  is_read: boolean;
  read_at: string | null;
  created_at: string;
}

function toNotification(row: NotificationRow): Notification {
  return {
    id: row.id as NotificationId,
    userId: row.user_id as UserId,
    caseId: row.case_id as RecoveryCaseId | null,
    type: row.type,
    title: row.title,
    body: row.body,
    isRead: row.is_read,
    readAt: row.read_at,
    createdAt: row.created_at,
  };
}

export interface CreateNotificationInput {
  userId: UserId;
  caseId?: RecoveryCaseId | null;
  type: NotificationType;
  title: string;
  body: string;
}

export class NotificationRepository {
  constructor(private readonly db: Queryable) {}

  async create(input: CreateNotificationInput): Promise<Notification> {
    const result = await this.db.query<NotificationRow>(
      `INSERT INTO notifications (user_id, case_id, type, title, body)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [input.userId, input.caseId ?? null, input.type, input.title, input.body],
    );
    const row = result.rows[0];
    if (!row) throw new Error('Insert into notifications returned no row');
    return toNotification(row);
  }

  async listByUser(
    ownerUserId: UserId,
    options: { unreadOnly?: boolean } = {},
  ): Promise<Notification[]> {
    const result = await this.db.query<NotificationRow>(
      options.unreadOnly
        ? 'SELECT * FROM notifications WHERE user_id = $1 AND is_read = false ORDER BY created_at DESC'
        : 'SELECT * FROM notifications WHERE user_id = $1 ORDER BY created_at DESC',
      [ownerUserId],
    );
    return result.rows.map(toNotification);
  }

  async countUnread(ownerUserId: UserId): Promise<number> {
    const result = await this.db.query<{ count: string }>(
      'SELECT COUNT(*)::text AS count FROM notifications WHERE user_id = $1 AND is_read = false',
      [ownerUserId],
    );
    return Number(result.rows[0]?.count ?? '0');
  }

  async markRead(id: NotificationId, ownerUserId: UserId): Promise<Notification | null> {
    const result = await this.db.query<NotificationRow>(
      `UPDATE notifications SET is_read = true, read_at = now()
       WHERE id = $1 AND user_id = $2
       RETURNING *`,
      [id, ownerUserId],
    );
    const row = result.rows[0];
    return row ? toNotification(row) : null;
  }

  async markAllRead(ownerUserId: UserId): Promise<number> {
    const result = await this.db.query(
      `UPDATE notifications SET is_read = true, read_at = now() WHERE user_id = $1 AND is_read = false`,
      [ownerUserId],
    );
    return result.rowCount ?? 0;
  }

  /** Reminder de-duplication (services/notifications/reminderChecks.ts) - "has this case already gotten one of these recently?". */
  async existsRecentForCase(caseId: RecoveryCaseId, type: NotificationType, since: Date): Promise<boolean> {
    const result = await this.db.query(
      'SELECT 1 FROM notifications WHERE case_id = $1 AND type = $2 AND created_at >= $3 LIMIT 1',
      [caseId, type, since.toISOString()],
    );
    return (result.rowCount ?? 0) > 0;
  }
}
