import type {
  CeirStatus,
  IncidentType,
  OfficialExternalAction,
  PlatformType,
  RecoveryActionStatus,
  RecoveryActionType,
  RiskLevel,
  SimAccessStatus,
  TriStateAnswer,
} from '@recoverai/shared';

/**
 * Named buckets rather than a raw duration, so the pure engine function
 * never needs `Date.now()` inside it - the caller (gatherEngineInput.ts /
 * buildEngineInputForNewCase.ts) computes the bucket once from
 * RecoveryCase.occurredAt, keeping evaluateRecoveryDecision fully
 * deterministic and trivial to unit test with fixed inputs.
 */
export type TimeSinceIncidentBucket = 'JUST_NOW' | 'TODAY' | 'THIS_WEEK' | 'OLDER' | 'UNKNOWN';

export type PoliceReportEngineStatus = 'NOT_STARTED' | 'DRAFTED' | 'FILED';

/** An action already persisted for this case - preserved across recalculation, never silently reset. */
export interface ExistingActionState {
  type: RecoveryActionType;
  status: RecoveryActionStatus;
}

/**
 * The master spec's own list of dimensions, verbatim. Everything here is
 * either a direct wizard/case answer or derived from case-scoped DB state -
 * see gatherEngineInput.ts and buildEngineInputForNewCase.ts for the two
 * ways this gets built.
 */
export interface RecoveryEngineInput {
  incidentType: IncidentType;
  timeSinceIncident: TimeSinceIncidentBucket;
  platform: PlatformType;
  accountAccess: TriStateAnswer;
  simAccess: SimAccessStatus;
  screenLockStatus: TriStateAnswer;
  deviceFindingAvailability: TriStateAnswer;
  locationStatus: 'AVAILABLE' | 'UNAVAILABLE';
  financialAppsPresent: boolean;
  authenticatorPresent: boolean;
  passwordManagerPresent: boolean;
  workAccountPresent: boolean;
  deviceSecured: boolean;
  simSecured: boolean;
  financialAccountsSecured: boolean;
  policeReportStatus: PoliceReportEngineStatus;
  ceirStatus: CeirStatus;
  existingActions: ExistingActionState[];
}

export interface EngineAction {
  /** The RecoveryActionType is the stable identity for an action within a case - see rules.ts for why. */
  type: RecoveryActionType;
  priority: number;
  title: string;
  reason: string;
  instructions: string;
  status: RecoveryActionStatus;
  dependencies: RecoveryActionType[];
  officialExternalAction: OfficialExternalAction | null;
  /** True only for pre-existing rows the engine is re-evaluating, never for a freshly proposed one. */
  isExisting: boolean;
}

export interface RecoveryEngineResult {
  riskLevel: RiskLevel;
  riskReasons: string[];
  orderedActions: EngineAction[];
  currentRecommendedAction: EngineAction | null;
  blockedActions: EngineAction[];
  warnings: string[];
}
