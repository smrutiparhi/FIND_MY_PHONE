import type { RiskLevel, RecoveryCase } from './domain';
import type { RecoveryPlanAction } from './recoveryEngine';

/**
 * Never its own stored flag - "trigger when combinations such as these
 * occur" (master spec) is exactly what the Recovery Decision Engine's
 * riskLevel already captures (STOLEN, no account access, SIM lost,
 * financial apps present, ... are the inputs computeRisk() scores), so
 * isEmergency is always freshly derived from the live recovery plan, never
 * persisted - see deriveEmergencyModeState.ts.
 */
export interface EmergencyModeState {
  isEmergency: boolean;
  riskLevel: RiskLevel;
  riskReasons: string[];
  warnings: string[];
  completedCount: number;
  totalCount: number;
  currentAction: RecoveryPlanAction | null;
  /** The next non-terminal action after currentAction, even if currently BLOCKED - "what happens once I finish this." */
  nextAction: RecoveryPlanAction | null;
}

export interface EmergencyModeResult {
  recoveryCase: RecoveryCase;
  emergency: EmergencyModeState;
}
