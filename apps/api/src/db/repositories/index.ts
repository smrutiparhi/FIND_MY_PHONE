import type { Queryable } from '../queryable';
import { AccountRecoveryAttemptRepository } from './accountRecoveryAttemptRepository';
import { AuditEventRepository } from './auditEventRepository';
import { CeirRecordRepository } from './ceirRecordRepository';
import { DeviceRecoveryChecklistRepository } from './deviceRecoveryChecklistRepository';
import { DeviceRepository } from './deviceRepository';
import { EvidenceRepository } from './evidenceRepository';
import { FinancialProtectionItemRepository } from './financialProtectionItemRepository';
import { IncidentAssessmentRepository } from './incidentAssessmentRepository';
import { LocationObservationRepository } from './locationObservationRepository';
import { NotificationRepository } from './notificationRepository';
import { NotificationPreferencesRepository } from './notificationPreferencesRepository';
import { PoliceReportRepository } from './policeReportRepository';
import { RecoveryActionRepository } from './recoveryActionRepository';
import { RecoveryCaseRepository } from './recoveryCaseRepository';
import { SimProtectionRecordRepository } from './simProtectionRecordRepository';
import { TimelineEventRepository } from './timelineEventRepository';
import { UserRepository } from './userRepository';

/**
 * One repository instance per entity, all bound to the same Queryable (a
 * shared Pool for normal request handling, or a single transaction client
 * when a caller needs multiple writes to commit or roll back together).
 */
export function createRepositories(db: Queryable) {
  return {
    users: new UserRepository(db),
    devices: new DeviceRepository(db),
    recoveryCases: new RecoveryCaseRepository(db),
    incidentAssessments: new IncidentAssessmentRepository(db),
    recoveryActions: new RecoveryActionRepository(db),
    locationObservations: new LocationObservationRepository(db),
    evidence: new EvidenceRepository(db),
    timelineEvents: new TimelineEventRepository(db),
    policeReports: new PoliceReportRepository(db),
    ceirRecords: new CeirRecordRepository(db),
    notifications: new NotificationRepository(db),
    auditEvents: new AuditEventRepository(db),
    accountRecoveryAttempts: new AccountRecoveryAttemptRepository(db),
    simProtectionRecords: new SimProtectionRecordRepository(db),
    financialProtectionItems: new FinancialProtectionItemRepository(db),
    deviceRecoveryChecklists: new DeviceRecoveryChecklistRepository(db),
    notificationPreferences: new NotificationPreferencesRepository(db),
  };
}

export type Repositories = ReturnType<typeof createRepositories>;

export * from './userRepository';
export * from './deviceRepository';
export * from './recoveryCaseRepository';
export * from './incidentAssessmentRepository';
export * from './recoveryActionRepository';
export * from './locationObservationRepository';
export * from './evidenceRepository';
export * from './timelineEventRepository';
export * from './policeReportRepository';
export * from './ceirRecordRepository';
export * from './notificationRepository';
export * from './auditEventRepository';
export * from './accountRecoveryAttemptRepository';
export * from './simProtectionRecordRepository';
export * from './financialProtectionItemRepository';
export * from './deviceRecoveryChecklistRepository';
export * from './notificationPreferencesRepository';
