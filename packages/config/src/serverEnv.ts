import { z } from 'zod';

/**
 * Every environment variable the API will ever read is declared here, even
 * ones that only become required in a later build phase (e.g. DATABASE_URL
 * is optional until Part 2, SUPABASE_* until Part 3). Keeping the full
 * surface visible now avoids env drift as new parts come online, while
 * `.optional()` keeps today's server bootable without them.
 */
const aiProviderSchema = z.enum(['mock', 'anthropic', 'openai']).default('mock');
const mapProviderSchema = z.enum(['none', 'mapbox', 'maptiler', 'google']).default('none');

export const serverEnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(4000),
  WEB_ORIGIN: z.string().url().default('http://localhost:5173'),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),

  // Part 2 (Database): connection string for PostgreSQL (Supabase-managed or self-hosted).
  DATABASE_URL: z.string().min(1).optional(),

  // Part 2 (Database): base64-encoded 32-byte AES-256-GCM key used to encrypt
  // IMEI/serial fields at rest (see lib/encryption.ts). Generate with
  // `openssl rand -base64 32`. Optional at boot so the API and health check
  // still run without it; encrypting/decrypting a real field without it
  // configured throws immediately rather than silently storing plaintext.
  ENCRYPTION_KEY: z.string().min(1).optional(),

  // Part 3 (Authentication): Supabase Auth project used for identity/session verification.
  SUPABASE_URL: z.string().url().optional(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1).optional(),

  // Part 20 (Security hardening): the same public/publishable anon key already shipped in
  // the frontend bundle (apps/web's VITE_SUPABASE_ANON_KEY) - safe to duplicate here since
  // it carries no privilege on its own (RLS enforces access, not this key). The server
  // itself never uses it; it exists only so the HTTP-level authorization test suite can
  // sign in as real, disposable Supabase Auth test users the same way the real frontend
  // does, rather than mocking the auth layer.
  SUPABASE_ANON_KEY: z.string().min(1).optional(),

  // Part 7 (AI Recovery Agent): 'mock' requires no key and is safe for local development.
  // AI_MODEL overrides each provider's default model id (see services/ai/index.ts) - useful
  // when an API key only has access to a different or dated model string.
  AI_PROVIDER: aiProviderSchema,
  AI_API_KEY: z.string().min(1).optional(),
  AI_MODEL: z.string().min(1).optional(),

  // Part 8 (Device Location + Map): 'none' disables map tile/token issuance entirely.
  MAP_PROVIDER: mapProviderSchema,
  MAP_API_KEY: z.string().min(1).optional(),
});

export type ServerEnv = z.infer<typeof serverEnvSchema>;

export class ServerEnvValidationError extends Error {
  constructor(issues: z.ZodIssue[]) {
    const details = issues
      .map((issue) => `  - ${issue.path.join('.') || '(root)'}: ${issue.message}`)
      .join('\n');
    super(`Invalid environment configuration:\n${details}`);
    this.name = 'ServerEnvValidationError';
  }
}

export function loadServerEnv(source: NodeJS.ProcessEnv = process.env): ServerEnv {
  // .env.example documents unset optional variables as `KEY=` (empty string)
  // so every variable stays visible without needing to be commented out.
  // Treat that the same as "not present" rather than failing validation on
  // an empty string for optional fields like DATABASE_URL or AI_API_KEY.
  const sanitized = Object.fromEntries(Object.entries(source).filter(([, value]) => value !== ''));

  const result = serverEnvSchema.safeParse(sanitized);
  if (!result.success) {
    throw new ServerEnvValidationError(result.error.issues);
  }
  return result.data;
}
