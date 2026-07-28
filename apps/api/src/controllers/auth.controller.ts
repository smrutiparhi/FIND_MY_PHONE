import type { Request, Response } from 'express';
import type { ApiSuccessResponse, User, UserId } from '@recoverai/shared';
import { getRepos } from '../db/repos';
import { getSupabaseAdmin } from '../lib/supabaseAdmin';
import { NotFoundError, UnauthorizedError } from '../lib/errors';
import { logger } from '../lib/logger';
import type { UpdateProfileInput } from '../validation/schemas/auth.schemas';

function requireUser(req: Pick<Request, 'user'>): { id: UserId; email: string } {
  if (!req.user) throw new UnauthorizedError();
  return req.user;
}

export async function getMe(req: Request, res: Response<ApiSuccessResponse<User>>): Promise<void> {
  const { id } = requireUser(req);
  const profile = await getRepos().users.findById(id);
  if (!profile) throw new NotFoundError('User profile not found');
  res.status(200).json({ success: true, data: profile });
}

export async function updateMe(
  req: Request<Record<string, string>, unknown, UpdateProfileInput>,
  res: Response<ApiSuccessResponse<User>>,
): Promise<void> {
  const { id } = requireUser(req);
  const updated = await getRepos().users.updateProfile(id, { fullName: req.body.fullName });
  if (!updated) throw new NotFoundError('User profile not found');
  res.status(200).json({ success: true, data: updated });
}

/**
 * Deletes application data first, then the Supabase identity. If the second
 * step fails, the user is left with an empty, harmless Supabase account
 * (recoverable) rather than an orphaned pile of application data outliving
 * a deleted identity (a privacy-deletion-request problem) - so the ordering
 * here is deliberate, not incidental.
 */
export async function deleteMe(req: Request, res: Response): Promise<void> {
  const { id, email } = requireUser(req);

  const deleted = await getRepos().users.delete(id);
  if (!deleted) throw new NotFoundError('User profile not found');

  const { error } = await getSupabaseAdmin().auth.admin.deleteUser(id);
  if (error) {
    logger.error(
      { err: error, userId: id, email },
      'Deleted application data but failed to delete the Supabase identity - needs manual cleanup',
    );
  }

  res.status(204).send();
}
