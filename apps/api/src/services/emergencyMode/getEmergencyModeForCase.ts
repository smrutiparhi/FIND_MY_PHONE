import type { Pool } from 'pg';
import type { EmergencyModeResult, RecoveryCaseId, UserId } from '@recoverai/shared';
import { recalculateRecoveryCase } from '../recoveryEngine/recalculateRecoveryCase';
import { toRecoveryPlan } from '../recoveryEngine/toRecoveryPlan';
import { deriveEmergencyModeState } from './deriveEmergencyModeState';

/** Same "recalculate fresh, cheap to repeat" pattern as every other GET in this app (Part 8's locations, Part 9's account-recovery). */
export async function getEmergencyModeForCase(pool: Pool, userId: UserId, caseId: RecoveryCaseId): Promise<EmergencyModeResult> {
  const { recoveryCase, engineResult, actionIdByType } = await recalculateRecoveryCase(pool, userId, caseId);
  const recoveryPlan = toRecoveryPlan(engineResult, actionIdByType);
  return { recoveryCase, emergency: deriveEmergencyModeState(recoveryPlan) };
}
