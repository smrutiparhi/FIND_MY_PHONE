import type { CeirRecord, Device, LocationObservation, PoliceReport, RecoveryCase, RecoveryPlan } from '@recoverai/shared';
import { wrapUntrustedContent } from './promptInjectionGuard';

const INCIDENT_LABELS: Record<RecoveryCase['incidentType'], string> = {
  LOST: 'Lost',
  STOLEN: 'Stolen',
  UNSURE: 'Unsure whether lost or stolen',
};

function formatLocation(location: LocationObservation | null): string {
  if (!location) return 'No location observation on file. Never state or imply a coordinate exists.';
  return [
    `Last observation: ${location.observedAt}`,
    `Source: ${location.source} (verification status: ${location.verificationStatus})`,
    `Coordinates: ${location.latitude}, ${location.longitude}${location.accuracyMeters ? ` (+/- ${location.accuracyMeters}m)` : ''}`,
  ].join('\n');
}

function formatPoliceReport(report: PoliceReport | null): string {
  if (!report) return 'No police report drafted yet.';
  return `Status: ${report.status}.`;
}

function formatCeir(record: CeirRecord | null): string {
  if (!record) return 'Not started (NOT_READY).';
  return `Status: ${record.status}.`;
}

/**
 * Renders the one and only source of case knowledge the model is given -
 * "the agent has access only to the authenticated user's current
 * recovery-case context" per the master spec. Fresh on every turn (the
 * caller re-runs the Recovery Decision Engine first), so the agent can never
 * act on stale state and never needs a tool call just to find out what's
 * true right now.
 */
export function buildCaseContextBlock(
  recoveryCase: RecoveryCase,
  device: Device,
  recoveryPlan: RecoveryPlan,
  latestLocation: LocationObservation | null,
  latestPoliceReport: PoliceReport | null,
  ceirRecord: CeirRecord | null,
): string {
  const actionLines = recoveryPlan.orderedActions.map((action) => {
    const dep = action.dependencies.length > 0 ? ` (depends on: ${action.dependencies.join(', ')})` : '';
    return `- [${action.status}] ${action.type}: "${action.title}" - id ${action.id}${dep}`;
  });

  const untrustedBlocks = [wrapUntrustedContent('User-entered last-seen description', recoveryCase.lastSeenDescription)].filter(
    (b): b is string => b !== null,
  );

  return [
    `Device: ${device.nickname} (${device.manufacturer} ${device.model}, platform ${device.platform})`,
    `Incident type: ${INCIDENT_LABELS[recoveryCase.incidentType]}`,
    `Case status: ${recoveryCase.status}`,
    `Risk level: ${recoveryPlan.riskLevel}`,
    `Risk reasons:\n${recoveryPlan.riskReasons.map((r) => `- ${r}`).join('\n') || '(none recorded)'}`,
    `Current recommended action: ${recoveryPlan.currentRecommendedAction ? `${recoveryPlan.currentRecommendedAction.title} (id ${recoveryPlan.currentRecommendedAction.id})` : 'None - nothing pending'}`,
    `All actions:\n${actionLines.join('\n')}`,
    recoveryPlan.warnings.length > 0 ? `Active warnings:\n${recoveryPlan.warnings.map((w) => `- ${w}`).join('\n')}` : null,
    `Location:\n${formatLocation(latestLocation)}`,
    `Police report: ${formatPoliceReport(latestPoliceReport)}`,
    `CEIR/Sanchar Saathi: ${formatCeir(ceirRecord)}`,
    ...untrustedBlocks,
  ]
    .filter((line): line is string => line !== null)
    .join('\n\n');
}
