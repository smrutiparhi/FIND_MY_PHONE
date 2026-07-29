import type { Request, Response } from 'express';
import type { ApiSuccessResponse, LocationObservation, RecordLocationObservationInput, RecordLocationObservationResult, RecoveryCaseId } from '@recoverai/shared';
import { getRepos } from '../db/repos';
import { getPool } from '../db/pool';
import { NotFoundError, UnauthorizedError } from '../lib/errors';
import { recordLocationObservation } from '../services/location/recordLocationObservation';

/**
 * Ownership is enforced by scoping the case lookup to req.user.id (IDOR
 * prevention, see docs/DATABASE.md) - a caseId belonging to another user
 * resolves to NotFoundError rather than leaking whether it exists.
 */
export async function listLocationObservations(
  req: Request<{ caseId: string }>,
  res: Response<ApiSuccessResponse<LocationObservation[]>>,
): Promise<void> {
  if (!req.user) throw new UnauthorizedError();
  const caseId = req.params.caseId as RecoveryCaseId;
  const recoveryCase = await getRepos().recoveryCases.findById(caseId, req.user.id);
  if (!recoveryCase) throw new NotFoundError('Recovery case not found');

  const observations = await getRepos().locationObservations.listByCase(caseId);
  res.status(200).json({ success: true, data: observations });
}

export async function createLocationObservation(
  req: Request<{ caseId: string }, unknown, RecordLocationObservationInput>,
  res: Response<ApiSuccessResponse<RecordLocationObservationResult>>,
): Promise<void> {
  if (!req.user) throw new UnauthorizedError();
  const pool = getPool();
  if (!pool) throw new Error('DATABASE_URL must be configured to record a location observation.');

  const caseId = req.params.caseId as RecoveryCaseId;
  const result = await recordLocationObservation(pool, req.user.id, caseId, req.body);
  res.status(201).json({ success: true, data: result });
}
