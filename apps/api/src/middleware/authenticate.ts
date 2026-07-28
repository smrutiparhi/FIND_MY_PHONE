import type { NextFunction, Request, Response } from 'express';
import type { UserId } from '@recoverai/shared';
import { getSupabaseAdmin } from '../lib/supabaseAdmin';
import { getRepos } from '../db/repos';
import { UnauthorizedError } from '../lib/errors';
import { asyncHandler } from '../lib/asyncHandler';

function extractBearerToken(req: Request): string | null {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) return null;
  const token = header.slice('Bearer '.length).trim();
  return token.length > 0 ? token : null;
}

/**
 * Verifies the caller's Supabase-issued access token and attaches the
 * resulting identity to `req.user`. This is the only session mechanism in
 * the app (see docs/ARCHITECTURE.md: "the backend verifies the
 * Supabase-issued JWT on protected routes") - every route that touches a
 * user's own data sits behind this middleware.
 *
 * Verification calls Supabase's Auth API (`auth.getUser`) rather than
 * decoding the JWT locally, so a revoked/signed-out session is rejected
 * immediately instead of remaining valid until it expires.
 *
 * The upsert below is the mechanism that actually guarantees a matching
 * public.users row exists - not the auth.users DB trigger
 * (0015_supabase_auth_sync.sql). Supabase's Auth service appears to write
 * to auth.users with session_replication_role set such that
 * default-firing ("origin") triggers never run; this was confirmed
 * empirically (a real signup never produced a public.users row, while
 * manually replicating the same INSERT succeeded) and can't be fixed with
 * `ALTER TABLE auth.users ENABLE ALWAYS TRIGGER ...` because this app's
 * Postgres role doesn't own that table - only Supabase's own
 * `supabase_auth_admin` role does. The trigger is left in place as a
 * harmless bonus in case it ever does fire; this upsert is what the app
 * actually depends on, and it also keeps `email` current on every request
 * without needing the separate UPDATE trigger to work either.
 */
export const requireAuth = asyncHandler(
  async (req: Request, _res: Response, next: NextFunction) => {
    const token = extractBearerToken(req);
    if (!token) {
      throw new UnauthorizedError('Authentication required');
    }

    const { data, error } = await getSupabaseAdmin().auth.getUser(token);
    if (error || !data.user) {
      throw new UnauthorizedError('Invalid or expired session');
    }
    if (!data.user.email) {
      throw new UnauthorizedError('Account has no associated email');
    }

    const id = data.user.id as UserId;
    const email = data.user.email;
    await getRepos().users.syncFromAuth({ id, email });

    req.user = { id, email };
    next();
  },
);
