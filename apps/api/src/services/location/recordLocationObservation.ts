import type { Pool } from 'pg';
import type { RecordLocationObservationInput, RecordLocationObservationResult, RecoveryCaseId, UserId } from '@recoverai/shared';
import { createRepositories } from '../../db/repositories';
import { NotFoundError } from '../../lib/errors';
import { recalculateRecoveryCase } from '../recoveryEngine/recalculateRecoveryCase';
import { toRecoveryPlan } from '../recoveryEngine/toRecoveryPlan';
import { deriveLocationVerificationStatus } from './deriveLocationVerificationStatus';

/**
 * Records one LocationObservation (never a live/continuous track - master
 * spec) and re-runs the Recovery Decision Engine, since `locationStatus` is
 * one of its 17 inputs and a newly-recorded observation can move it from
 * UNAVAILABLE to AVAILABLE. Mirrors the Part 7 Recovery Agent's tool
 * handlers: the write itself isn't wrapped in an explicit transaction (a
 * timeline event existing without its observation, or vice versa, is a
 * low-stakes inconsistency), and recalculation runs as its own
 * self-contained transaction afterward.
 */
export async function recordLocationObservation(
  pool: Pool,
  userId: UserId,
  caseId: RecoveryCaseId,
  input: RecordLocationObservationInput,
): Promise<RecordLocationObservationResult> {
  const repos = createRepositories(pool);
  const recoveryCase = await repos.recoveryCases.findById(caseId, userId);
  if (!recoveryCase) throw new NotFoundError('Recovery case not found');

  const verificationStatus = deriveLocationVerificationStatus(input.source);
  const locationObservation = await repos.locationObservations.create({
    caseId,
    latitude: input.latitude,
    longitude: input.longitude,
    accuracyMeters: input.accuracyMeters ?? null,
    observedAt: input.observedAt,
    source: input.source,
    verificationStatus,
    notes: input.notes ?? null,
    recordedByUserId: userId,
  });

  await repos.timelineEvents.create({
    caseId,
    type: 'LOCATION_OBSERVATION_RECORDED',
    title: 'Location observation recorded',
    description: input.notes ?? null,
    source: 'USER',
    verificationStatus,
    locationObservationId: locationObservation.id,
    createdByUserId: userId,
  });

  const { recoveryCase: updatedCase, engineResult, actionIdByType } = await recalculateRecoveryCase(pool, userId, caseId);

  return {
    locationObservation,
    recoveryCase: updatedCase,
    recoveryPlan: toRecoveryPlan(engineResult, actionIdByType),
  };
}
