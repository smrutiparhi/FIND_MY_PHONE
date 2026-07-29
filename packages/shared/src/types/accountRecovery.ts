import type { AccountAccessSignal, AccountRecoveryAttempt, OfficialExternalAction, RecoveryCase } from './domain';
import type { RecoveryPlan } from './recoveryEngine';

/**
 * One step in a deterministically-generated recovery path
 * (services/accountRecovery/generateAccountRecoveryPath.ts) - never
 * persisted, always recomputed fresh from the attempt's platform and
 * availableSignals. `dependsOnExternalProvider` is what the master spec's
 * "clearly indicate when account recovery depends on an external provider
 * and cannot be accelerated by RecoverAI" becomes in the API response.
 */
export interface AccountRecoveryStep {
  key: string;
  title: string;
  description: string;
  speed: 'FAST' | 'VARIES' | 'SLOW';
  dependsOnExternalProvider: boolean;
  officialExternalAction: OfficialExternalAction | null;
}

/** The user-settable subset of AccountRecoveryStatus - NOT_STARTED is only ever the initial default, never a client-chosen transition. */
export const USER_SETTABLE_ACCOUNT_RECOVERY_STATUSES = ['IN_PROGRESS', 'WAITING', 'RECOVERED', 'FAILED'] as const;
export type UserSettableAccountRecoveryStatus = (typeof USER_SETTABLE_ACCOUNT_RECOVERY_STATUSES)[number];

export interface UpdateAccountRecoveryAttemptInput {
  availableSignals?: AccountAccessSignal[];
  status?: UserSettableAccountRecoveryStatus;
  notes?: string | null;
}

/**
 * Returned by both GET and PATCH account-recovery - recoveryCase/recoveryPlan
 * are always freshly recalculated (cheap, idempotent when nothing changed;
 * see recoveryEngine/recalculateRecoveryCase.ts) so the page never needs a
 * second round trip to reflect a status update, exactly like Part 8's
 * location endpoints.
 */
export interface AccountRecoveryState {
  attempt: AccountRecoveryAttempt;
  steps: AccountRecoveryStep[];
  recoveryCase: RecoveryCase;
  recoveryPlan: RecoveryPlan;
}
