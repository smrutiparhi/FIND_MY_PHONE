import { createClient } from '@supabase/supabase-js';
import { clientEnv } from './env';

/**
 * The only place in the frontend that talks to Supabase directly.
 * Registration, login, logout, password reset, and session persistence all
 * go through this client (see docs/ARCHITECTURE.md) - credentials never
 * pass through our own backend. The anon key is not a secret; it's designed
 * to be public and is protected by Postgres row-level security instead (see
 * docs/DATABASE.md).
 */
export const supabase = createClient(clientEnv.supabaseUrl, clientEnv.supabaseAnonKey);
