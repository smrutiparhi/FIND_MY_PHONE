import type {
  DeviceId,
  IncidentType,
  PlatformType,
  SensitiveAppType,
  SimAccessStatus,
  TriStateAnswer,
} from './domain';

/**
 * The request body for POST /api/recovery-cases (Part 5's incident wizard).
 * Shared so the frontend's wizard state maps directly onto what the backend
 * validates, with no separate "API shape" to keep in sync by hand.
 */
export interface CreateRecoveryCaseWizardInput {
  incidentType: IncidentType;
  device:
    | { mode: 'existing'; deviceId: DeviceId }
    | { mode: 'new'; nickname: string; manufacturer: string; model: string; platform: PlatformType };
  /** Null means the user doesn't remember/know - never forced (master spec: allow "I don't know"). */
  lastSeenAt: string | null;
  lastSeenDescription: string | null;
  accountAccessStatus: TriStateAnswer;
  simAccessStatus: SimAccessStatus;
  screenLockEnabled: TriStateAnswer;
  sensitiveApps: SensitiveAppType[];
  deviceFindingAvailable: TriStateAnswer;
}
