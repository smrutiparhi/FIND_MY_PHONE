import type { Brand } from '../utils/brand';

/**
 * Core RecoverAI data model (Part 2 - Database). Enum values and field names
 * here are taken verbatim from the master spec where it specifies them
 * (Device, RecoveryCase, LocationObservation fields; case statuses; location
 * sources); everything else is designed to support the modules that consume
 * it in later parts - see docs/DATABASE.md for the full rationale per table.
 */

// ---------------------------------------------------------------------------
// Branded ids - prevents accidentally passing a DeviceId where a CaseId is
// expected even though both are plain strings at runtime.
// ---------------------------------------------------------------------------
export type UserId = Brand<string, 'UserId'>;
export type DeviceId = Brand<string, 'DeviceId'>;
export type RecoveryCaseId = Brand<string, 'RecoveryCaseId'>;
export type IncidentAssessmentId = Brand<string, 'IncidentAssessmentId'>;
export type RecoveryActionId = Brand<string, 'RecoveryActionId'>;
export type LocationObservationId = Brand<string, 'LocationObservationId'>;
export type EvidenceId = Brand<string, 'EvidenceId'>;
export type TimelineEventId = Brand<string, 'TimelineEventId'>;
export type PoliceReportId = Brand<string, 'PoliceReportId'>;
export type CeirRecordId = Brand<string, 'CeirRecordId'>;
export type NotificationId = Brand<string, 'NotificationId'>;
export type AuditEventId = Brand<string, 'AuditEventId'>;
export type AccountRecoveryAttemptId = Brand<string, 'AccountRecoveryAttemptId'>;

// ---------------------------------------------------------------------------
// Enums
// ---------------------------------------------------------------------------
export const PLATFORM_TYPES = ['ANDROID', 'IPHONE', 'OTHER'] as const;
export type PlatformType = (typeof PLATFORM_TYPES)[number];

export const SIM_TYPES = ['PHYSICAL', 'ESIM', 'DUAL', 'UNKNOWN'] as const;
export type SimType = (typeof SIM_TYPES)[number];

export const INCIDENT_TYPES = ['LOST', 'STOLEN', 'UNSURE'] as const;
export type IncidentType = (typeof INCIDENT_TYPES)[number];

/** Verbatim from the master spec's "Case statuses" list. */
export const CASE_STATUSES = [
  'NEW',
  'ASSESSING',
  'LOCATING',
  'DEVICE_FOUND',
  'DEVICE_OFFLINE',
  'SECURING',
  'SIM_PROTECTION',
  'ACCOUNT_RECOVERY',
  'FINANCIAL_PROTECTION',
  'POLICE_REPORT',
  'CEIR_PENDING',
  'CEIR_SUBMITTED',
  'MONITORING',
  'RECOVERED',
  'ERASED',
  'CLOSED',
] as const;
export type CaseStatus = (typeof CASE_STATUSES)[number];

export const RISK_LEVELS = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'] as const;
export type RiskLevel = (typeof RISK_LEVELS)[number];

/** Shared tri-state answer for wizard questions that offer Yes/No/Unsure. */
export const TRI_STATE_ANSWERS = ['YES', 'NO', 'UNSURE'] as const;
export type TriStateAnswer = (typeof TRI_STATE_ANSWERS)[number];

/** Verbatim options from the incident wizard's "SIM/phone number access" step. */
export const SIM_ACCESS_STATUSES = [
  'ANOTHER_DEVICE_HAS_ACCESS',
  'LOST_WITH_PHONE',
  'SIM_ALREADY_BLOCKED',
  'UNSURE',
] as const;
export type SimAccessStatus = (typeof SIM_ACCESS_STATUSES)[number];

/** Verbatim checklist from the incident wizard's "sensitive apps" step. */
export const SENSITIVE_APP_TYPES = [
  'BANKING',
  'UPI',
  'EMAIL',
  'SOCIAL_MEDIA',
  'PASSWORD_MANAGER',
  'AUTHENTICATOR',
  'WORK_ACCOUNTS',
] as const;
export type SensitiveAppType = (typeof SENSITIVE_APP_TYPES)[number];

export const RECOVERY_ACTION_TYPES = [
  'LOCATE_DEVICE',
  'RING_DEVICE',
  'NEARBY_SEARCH',
  'SECURE_DEVICE',
  'SIM_PROTECTION',
  'ACCOUNT_RECOVERY',
  'FINANCIAL_PROTECTION',
  'POLICE_REPORT',
  'CEIR_SUBMISSION',
  'EVIDENCE_COLLECTION',
  'MONITOR',
] as const;
export type RecoveryActionType = (typeof RECOVERY_ACTION_TYPES)[number];

export const RECOVERY_ACTION_STATUSES = [
  'PENDING',
  'BLOCKED',
  'IN_PROGRESS',
  'COMPLETED',
  'SKIPPED',
] as const;
export type RecoveryActionStatus = (typeof RECOVERY_ACTION_STATUSES)[number];

/** Verbatim from the master spec's Part 8 location-source distinction. */
export const LOCATION_SOURCES = [
  'AUTHORIZED_INTEGRATION',
  'USER_CONFIRMED',
  'USER_ENTERED',
  'OTHER_VERIFIED_SOURCE',
] as const;
export type LocationSource = (typeof LOCATION_SOURCES)[number];

/**
 * Shared across LocationObservation and TimelineEvent. Operationalizes the
 * Part 7 UI requirement: "clear distinction between verified system state,
 * user-reported state, AI recommendation, external-service state."
 */
export const VERIFICATION_STATUSES = [
  'SYSTEM_VERIFIED',
  'USER_REPORTED',
  'AI_GENERATED',
  'EXTERNAL_VERIFIED',
  'UNVERIFIED',
] as const;
export type VerificationStatus = (typeof VERIFICATION_STATUSES)[number];

export const EVIDENCE_CATEGORIES = [
  'PURCHASE_INVOICE',
  'DEVICE_PHOTO',
  'IMEI_SERIAL_DOCUMENT',
  'LOCATION_SCREENSHOT',
  'POLICE_COMPLAINT',
  'POLICE_ACKNOWLEDGEMENT',
  'CEIR_ACKNOWLEDGEMENT',
  'CARRIER_SIM_DOCUMENT',
  'OTHER',
] as const;
export type EvidenceCategory = (typeof EVIDENCE_CATEGORIES)[number];

export const MALWARE_SCAN_STATUSES = ['PENDING', 'CLEAN', 'FLAGGED', 'SKIPPED'] as const;
export type MalwareScanStatus = (typeof MALWARE_SCAN_STATUSES)[number];

/** Verbatim event list from the master spec's Part 16, plus USER_NOTE for user-authored entries. */
export const TIMELINE_EVENT_TYPES = [
  'CASE_CREATED',
  'RISK_ASSESSED',
  'LOCATION_OBSERVATION_RECORDED',
  'DEVICE_FINDING_OPENED',
  'DEVICE_SECURED',
  'SIM_PROTECTION_STARTED',
  'SIM_PROTECTION_COMPLETED',
  'ACCOUNT_RECOVERY_STARTED',
  'ACCOUNT_RECOVERY_COMPLETED',
  'FINANCIAL_PROTECTION_COMPLETED',
  'POLICE_COMPLAINT_CREATED',
  'POLICE_COMPLAINT_APPROVED',
  'CEIR_SUBMITTED',
  'CEIR_STATUS_UPDATED',
  'EVIDENCE_UPLOADED',
  'DEVICE_RECOVERED',
  'DEVICE_ERASED',
  'CASE_CLOSED',
  'USER_NOTE',
] as const;
export type TimelineEventType = (typeof TIMELINE_EVENT_TYPES)[number];

export const TIMELINE_EVENT_SOURCES = [
  'SYSTEM',
  'USER',
  'AI_AGENT',
  'EXTERNAL_INTEGRATION',
] as const;
export type TimelineEventSource = (typeof TIMELINE_EVENT_SOURCES)[number];

/**
 * No SUBMITTED status: the master spec requires never claiming a complaint
 * was submitted unless an official integration confirms it, and none exists.
 * USER_MARKED_SUBMITTED records the user's own attestation that they filed
 * it themselves (e.g. at a station or an external portal), not RecoverAI.
 */
export const POLICE_REPORT_STATUSES = ['DRAFT', 'APPROVED', 'USER_MARKED_SUBMITTED'] as const;
export type PoliceReportStatus = (typeof POLICE_REPORT_STATUSES)[number];

/** Verbatim from the master spec's Part 14 CEIR statuses. */
export const CEIR_STATUSES = [
  'NOT_READY',
  'READY',
  'SUBMITTED',
  'PROCESSING',
  'BLOCKED',
  'UNBLOCK_REQUESTED',
  'UNBLOCKED',
  'UNKNOWN',
] as const;
export type CeirStatus = (typeof CEIR_STATUSES)[number];

/**
 * Distinct from RecoveryActionStatus for the same reason PoliceReportStatus
 * and CeirStatus are their own enums (Part 9): WAITING and FAILED don't fit
 * the generic action lifecycle the Recovery Decision Engine governs.
 */
export const ACCOUNT_RECOVERY_STATUSES = ['NOT_STARTED', 'IN_PROGRESS', 'WAITING', 'RECOVERED', 'FAILED'] as const;
export type AccountRecoveryStatus = (typeof ACCOUNT_RECOVERY_STATUSES)[number];

/** Verbatim checklist from the master spec's Part 9. "none/unsure" is an empty array, not its own value. */
export const ACCOUNT_ACCESS_SIGNALS = [
  'PASSWORD',
  'TRUSTED_DEVICE',
  'TRUSTED_PHONE_NUMBER',
  'RECOVERY_EMAIL',
  'SIM',
  'BACKUP_AUTH_METHOD',
] as const;
export type AccountAccessSignal = (typeof ACCOUNT_ACCESS_SIGNALS)[number];

export const CEIR_CHECKLIST_ITEMS = [
  'IMEI_INFORMATION',
  'MOBILE_NUMBER',
  'DEVICE_DETAILS',
  'POLICE_REPORT',
  'IDENTITY_DOCUMENT',
  'PURCHASE_INVOICE',
  'REPLACEMENT_SIM_STATUS',
  'OTHER',
] as const;
export type CeirChecklistItem = (typeof CEIR_CHECKLIST_ITEMS)[number];

/** Verbatim from the master spec's Part 19 notification types. */
export const NOTIFICATION_TYPES = [
  'CRITICAL_ACTION_PENDING',
  'ACCOUNT_RECOVERY_UPDATE',
  'SIM_STATUS_UPDATE',
  'CEIR_FOLLOWUP_REMINDER',
  'CASE_INACTIVITY',
  'EVIDENCE_REMINDER',
  'DEVICE_RECOVERY_CHECKLIST',
] as const;
export type NotificationType = (typeof NOTIFICATION_TYPES)[number];

// ---------------------------------------------------------------------------
// Entities
// ---------------------------------------------------------------------------

export interface User {
  id: UserId;
  email: string;
  fullName: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Device {
  id: DeviceId;
  userId: UserId;
  nickname: string;
  manufacturer: string;
  model: string;
  platform: PlatformType;
  phoneNumberMasked: string | null;
  imei1Encrypted: string | null;
  imei2Encrypted: string | null;
  serialNumberEncrypted: string | null;
  simType: SimType;
  carrier: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface RecoveryCase {
  id: RecoveryCaseId;
  userId: UserId;
  deviceId: DeviceId;
  incidentType: IncidentType;
  status: CaseStatus;
  riskLevel: RiskLevel | null;
  occurredAt: string | null;
  lastSeenAt: string | null;
  lastSeenDescription: string | null;
  accountAccessStatus: TriStateAnswer | null;
  simAccessStatus: SimAccessStatus | null;
  locationCapability: TriStateAnswer | null;
  currentRecommendedActionId: RecoveryActionId | null;
  createdAt: string;
  updatedAt: string;
  closedAt: string | null;
}

export interface IncidentAssessment {
  id: IncidentAssessmentId;
  caseId: RecoveryCaseId;
  screenLockEnabled: TriStateAnswer | null;
  sensitiveApps: SensitiveAppType[];
  deviceFindingAvailable: TriStateAnswer | null;
  riskLevel: RiskLevel;
  riskReasons: string[];
  createdAt: string;
}

export interface OfficialExternalAction {
  provider: string;
  label: string;
  url?: string;
}

export interface RecoveryAction {
  id: RecoveryActionId;
  caseId: RecoveryCaseId;
  type: RecoveryActionType;
  priority: number;
  title: string;
  reason: string;
  instructions: string;
  status: RecoveryActionStatus;
  dependsOnActionIds: RecoveryActionId[];
  officialExternalAction: OfficialExternalAction | null;
  metadata: Record<string, unknown> | null;
  createdAt: string;
  updatedAt: string;
  completedAt: string | null;
}

export interface LocationObservation {
  id: LocationObservationId;
  caseId: RecoveryCaseId;
  latitude: number;
  longitude: number;
  accuracyMeters: number | null;
  observedAt: string;
  source: LocationSource;
  verificationStatus: VerificationStatus;
  notes: string | null;
  recordedByUserId: UserId | null;
  createdAt: string;
}

export interface Evidence {
  id: EvidenceId;
  caseId: RecoveryCaseId;
  uploadedByUserId: UserId;
  category: EvidenceCategory;
  description: string | null;
  storageKey: string;
  originalFileName: string;
  mimeType: string;
  fileSizeBytes: number;
  checksumSha256: string | null;
  malwareScanStatus: MalwareScanStatus;
  deletedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface TimelineEvent {
  id: TimelineEventId;
  caseId: RecoveryCaseId;
  type: TimelineEventType;
  title: string;
  description: string | null;
  source: TimelineEventSource;
  verificationStatus: VerificationStatus;
  recoveryActionId: RecoveryActionId | null;
  locationObservationId: LocationObservationId | null;
  evidenceId: EvidenceId | null;
  policeReportId: PoliceReportId | null;
  ceirRecordId: CeirRecordId | null;
  createdByUserId: UserId | null;
  createdAt: string;
}

export interface PoliceReport {
  id: PoliceReportId;
  caseId: RecoveryCaseId;
  createdByUserId: UserId;
  status: PoliceReportStatus;
  ownerFullName: string;
  ownerContact: string;
  incidentDateTime: string | null;
  lastKnownPlace: string | null;
  incidentDescription: string;
  deviceDescriptionSnapshot: string;
  draftText: string;
  externalReferenceNumber: string | null;
  approvedAt: string | null;
  userMarkedSubmittedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface PoliceReportVersion {
  id: string;
  policeReportId: PoliceReportId;
  versionNumber: number;
  draftText: string;
  createdAt: string;
}

export interface CeirRecord {
  id: CeirRecordId;
  caseId: RecoveryCaseId;
  status: CeirStatus;
  ceirRequestId: string | null;
  submissionDate: string | null;
  notes: string | null;
  checklistCompletedItems: CeirChecklistItem[];
  createdAt: string;
  updatedAt: string;
}

export interface AccountRecoveryAttempt {
  id: AccountRecoveryAttemptId;
  caseId: RecoveryCaseId;
  status: AccountRecoveryStatus;
  availableSignals: AccountAccessSignal[];
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Notification {
  id: NotificationId;
  userId: UserId;
  caseId: RecoveryCaseId | null;
  type: NotificationType;
  title: string;
  body: string;
  isRead: boolean;
  readAt: string | null;
  createdAt: string;
}

export interface AuditEvent {
  id: AuditEventId;
  userId: UserId | null;
  action: string;
  resourceType: string | null;
  resourceId: string | null;
  ipAddress: string | null;
  userAgent: string | null;
  metadata: Record<string, unknown> | null;
  createdAt: string;
}
