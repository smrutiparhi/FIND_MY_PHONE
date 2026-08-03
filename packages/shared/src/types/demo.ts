import type { RecoveryCase } from './domain';
import type { RecoveryPlan } from './recoveryEngine';

/**
 * Part 22 (Demo Mode). Verbatim stage order from the master spec's own
 * presentation flow: "Report Stolen Phone -> Risk Assessment -> Location
 * Screen -> Recovery Decision Engine -> Secure Device -> Protect SIM ->
 * Generate Police Complaint -> CEIR Assistant -> Timeline -> Device
 * Recovered."
 */
export const DEMO_STAGE_LABELS = [
  'Report Stolen Phone',
  'Risk Assessment',
  'Location Screen',
  'Recovery Decision Engine',
  'Secure Device',
  'Protect SIM',
  'Generate Police Complaint',
  'CEIR Assistant',
  'Timeline',
  'Device Recovered',
] as const;
export const DEMO_STAGE_COUNT = DEMO_STAGE_LABELS.length;

export interface DemoState {
  recoveryCase: RecoveryCase;
  recoveryPlan: RecoveryPlan;
  stage: number;
  stageLabel: string;
  isFinalStage: boolean;
}

export interface AdvanceDemoInput {
  stage: number;
}
