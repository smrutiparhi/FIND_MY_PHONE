import type {
  CeirStatus,
  DeviceRecoveryChecklist,
  FinalCaseSummary,
  LocationObservation,
  PoliceReport,
  PoliceReportStatus,
  RecoveryCase,
  RecoveryPlan,
  TimelineEvent,
} from '@recoverai/shared';

/**
 * "Create a final case summary containing: incident date, recovery date,
 * actions completed, important status changes, location observations,
 * police status, CEIR status" (master spec, verbatim). Pure function over
 * already-fetched data, same discipline as Part 16's
 * buildSanitizedCaseSummary - easy to unit test, no hidden DB access.
 */
export function buildFinalCaseSummary(input: {
  recoveryCase: RecoveryCase;
  checklist: DeviceRecoveryChecklist;
  recoveryPlan: RecoveryPlan;
  timelineEvents: TimelineEvent[];
  locationObservations: LocationObservation[];
  latestPoliceReport: PoliceReport | null;
  ceirStatus: CeirStatus;
}): FinalCaseSummary {
  const policeStatus: PoliceReportStatus | 'NOT_STARTED' = input.latestPoliceReport?.status ?? 'NOT_STARTED';

  return {
    incidentDate: input.recoveryCase.occurredAt ?? input.recoveryCase.lastSeenAt,
    recoveryDate: input.checklist.recoveredAt,
    actionsCompleted: input.recoveryPlan.orderedActions
      .filter((a) => a.status === 'COMPLETED')
      .map((a) => ({ type: a.type, title: a.title })),
    statusChanges: [...input.timelineEvents].sort(
      (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
    ),
    locationObservations: input.locationObservations,
    policeStatus,
    ceirStatus: input.ceirStatus,
  };
}
