import type {
  CaseStatus,
  DeviceId,
  IncidentType,
  LocationSource,
  PlatformType,
  RecoveryActionId,
  RecoveryActionType,
  RecoveryCaseId,
  RiskLevel,
  VerificationStatus,
} from './domain';

/**
 * The read-optimized shape the dashboard (Part 4) renders one case card
 * from - assembled server-side by a single joined query
 * (RecoveryCaseRepository.listDashboardSummariesByUser) rather than the
 * frontend stitching together separate Device/LocationObservation/
 * RecoveryAction fetches per case.
 */
export interface DashboardCaseSummary {
  caseId: RecoveryCaseId;
  incidentType: IncidentType;
  status: CaseStatus;
  riskLevel: RiskLevel | null;
  updatedAt: string;
  device: {
    id: DeviceId;
    nickname: string;
    manufacturer: string;
    model: string;
    platform: PlatformType;
  };
  /** Null lastObservedAt means no location has ever been recorded - the "current location unavailable" state (Part 8). */
  location: {
    lastObservedAt: string | null;
    source: LocationSource | null;
    verificationStatus: VerificationStatus | null;
  };
  currentRecommendedAction: {
    id: RecoveryActionId;
    type: RecoveryActionType;
    title: string;
  } | null;
  securityProgress: {
    completedActions: number;
    totalActions: number;
  };
}
