import type { Notification, NotificationPreferences, NotificationType } from './domain';

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

export interface NotificationListState {
  notifications: Notification[];
  unreadCount: number;
  preferences: NotificationPreferences;
}
