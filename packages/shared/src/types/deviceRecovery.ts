import type {
  CeirStatus,
  DeviceRecoveryChecklist,
  DeviceRecoveryChecklistItem,
  LocationObservation,
  PoliceReportStatus,
  RecoveryActionType,
  RecoveryCase,
  TimelineEvent,
} from './domain';
import type { RecoveryPlan, RecoveryPlanAction } from './recoveryEngine';

export interface UpdateDeviceRecoveryChecklistInput {
  completedItems?: DeviceRecoveryChecklistItem[];
  notes?: string | null;
}

/**
 * "Allow the user to close the case only after reviewing unresolved
 * actions" (master spec) - the server can't observe that a user actually
 * read the unresolved-actions list the frontend shows, so this explicit
 * flag is the same "require an affirmative confirmation" pattern used for
 * every other consequential action in this app (marking a SIM blocked,
 * approving a police complaint, ...). `false` or omitted is rejected.
 */
export interface CloseRecoveryCaseInput {
  confirmedUnresolvedActionsReviewed: boolean;
}

/**
 * "Create a final case summary containing: incident date, recovery date,
 * actions completed, important status changes, location observations,
 * police status, CEIR status" (master spec, verbatim field list). Unlike
 * Part 16's sanitized export - built for handing to someone else - this is
 * the user's own closing record, so it includes real location observations
 * rather than omitting them.
 */
export interface FinalCaseSummary {
  incidentDate: string | null;
  recoveryDate: string | null;
  actionsCompleted: { type: RecoveryActionType; title: string }[];
  statusChanges: TimelineEvent[];
  locationObservations: LocationObservation[];
  policeStatus: PoliceReportStatus | 'NOT_STARTED';
  ceirStatus: CeirStatus;
}

export interface DeviceRecoveryState {
  checklist: DeviceRecoveryChecklist;
  recoveryCase: RecoveryCase;
  recoveryPlan: RecoveryPlan;
  /** Every action not yet COMPLETED/SKIPPED, excluding MONITOR (a perpetual catch-all, never a discrete "unresolved" item) - what the close-case screen shows before asking for confirmation. */
  unresolvedActions: RecoveryPlanAction[];
}
