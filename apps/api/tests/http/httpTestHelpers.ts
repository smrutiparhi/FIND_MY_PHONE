import { randomUUID } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import { env } from '../../src/config/env';
import { getSupabaseAdmin } from '../../src/lib/supabaseAdmin';

if (!env.SUPABASE_ANON_KEY) {
  throw new Error(
    'SUPABASE_ANON_KEY must be configured to run the HTTP-level test suite - see apps/api/.env.example (tests/http/*).',
  );
}

export interface HttpTestUser {
  id: string;
  email: string;
  token: string;
}

/**
 * Creates a real, disposable Supabase Auth user and signs in as them via the
 * anon key (the same client-side flow LoginPage.tsx uses) to get a real
 * access token - HTTP-level authorization tests must exercise the actual
 * `requireAuth` middleware's `auth.getUser(token)` call, not a mocked
 * stand-in, or they'd never catch a real integration break. Always paired
 * with `deleteHttpTestUser` in the test's own cleanup.
 */
export async function createHttpTestUser(label: string): Promise<HttpTestUser> {
  const email = `http-test-${label}-${randomUUID()}@example.com`;
  const password = `Test-${randomUUID()}!`;
  const admin = getSupabaseAdmin();

  const { data: created, error: createError } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (createError || !created.user) {
    throw new Error(`Failed to create HTTP test user: ${createError?.message}`);
  }

  const anonClient = createClient(env.SUPABASE_URL!, env.SUPABASE_ANON_KEY!);
  const { data: signIn, error: signInError } = await anonClient.auth.signInWithPassword({ email, password });
  if (signInError || !signIn.session) {
    throw new Error(`Failed to sign in HTTP test user: ${signInError?.message}`);
  }

  return { id: created.user.id, email, token: signIn.session.access_token };
}

export async function deleteHttpTestUser(user: HttpTestUser): Promise<void> {
  await getSupabaseAdmin().auth.admin.deleteUser(user.id).catch(() => {
    /* best-effort cleanup - a leftover disposable test account is harmless */
  });
}
