import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { env } from '../config/env';

let client: SupabaseClient | undefined;

/**
 * Server-only Supabase client, authenticated with the service role key -
 * never exposed to the frontend. Used for two things: verifying a caller's
 * access token via `auth.getUser(token)` (see middleware/authenticate.ts),
 * and admin operations the anon key can't perform, like deleting a user's
 * Supabase identity on account deletion (Part 3's "account deletion").
 */
export function getSupabaseAdmin(): SupabaseClient {
  if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error(
      'SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be configured to use Supabase Auth. See apps/api/.env.example.',
    );
  }
  if (!client) {
    client = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
  }
  return client;
}
