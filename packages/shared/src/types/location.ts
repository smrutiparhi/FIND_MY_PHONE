import type { LocationObservation, LocationSource, RecoveryCase } from './domain';
import type { RecoveryPlan } from './recoveryEngine';

/**
 * The request body for POST /api/recovery-cases/:caseId/locations.
 * `verificationStatus` is deliberately not a field here - the backend
 * derives it from `source` (see deriveLocationVerificationStatus.ts) so a
 * client can never claim USER_ENTERED coordinates are SYSTEM_VERIFIED.
 */
export interface RecordLocationObservationInput {
  latitude: number;
  longitude: number;
  accuracyMeters?: number | null;
  observedAt: string;
  source: LocationSource;
  notes?: string | null;
}

export interface RecordLocationObservationResult {
  locationObservation: LocationObservation;
  recoveryCase: RecoveryCase;
  recoveryPlan: RecoveryPlan;
}
