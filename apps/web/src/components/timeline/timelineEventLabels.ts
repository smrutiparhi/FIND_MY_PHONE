import type { TimelineEventType } from '@recoverai/shared';

export const TIMELINE_EVENT_TYPE_LABELS: Record<TimelineEventType, string> = {
  CASE_CREATED: 'Case created',
  RISK_ASSESSED: 'Risk assessed',
  LOCATION_OBSERVATION_RECORDED: 'Location recorded',
  DEVICE_FINDING_OPENED: 'Device-finding opened',
  DEVICE_SECURED: 'Device secured',
  SIM_PROTECTION_STARTED: 'SIM protection started',
  SIM_PROTECTION_COMPLETED: 'SIM protection completed',
  ACCOUNT_RECOVERY_STARTED: 'Account recovery started',
  ACCOUNT_RECOVERY_COMPLETED: 'Account recovery completed',
  FINANCIAL_PROTECTION_COMPLETED: 'Financial protection completed',
  POLICE_COMPLAINT_CREATED: 'Police complaint drafted',
  POLICE_COMPLAINT_APPROVED: 'Police complaint approved',
  CEIR_SUBMITTED: 'CEIR request submitted',
  CEIR_STATUS_UPDATED: 'CEIR status updated',
  EVIDENCE_UPLOADED: 'Evidence uploaded',
  DEVICE_RECOVERED: 'Device recovered',
  DEVICE_ERASED: 'Device erased',
  CASE_CLOSED: 'Case closed',
  USER_NOTE: 'Note',
};
