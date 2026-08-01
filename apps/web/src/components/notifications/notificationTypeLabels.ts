import type { NotificationType } from '@recoverai/shared';

export const NOTIFICATION_TYPE_LABELS: Record<NotificationType, string> = {
  CRITICAL_ACTION_PENDING: 'Critical action pending',
  ACCOUNT_RECOVERY_UPDATE: 'Account recovery update',
  SIM_STATUS_UPDATE: 'SIM status update',
  CEIR_FOLLOWUP_REMINDER: 'CEIR follow-up reminder',
  CASE_INACTIVITY: 'Case inactivity',
  EVIDENCE_REMINDER: 'Evidence reminder',
  DEVICE_RECOVERY_CHECKLIST: 'Device recovery checklist',
};
