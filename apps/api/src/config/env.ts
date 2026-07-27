import { loadServerEnv, type ServerEnv } from '@recoverai/config';

try {
  // Loads apps/api/.env into process.env when present (Node 20.6+ built-in).
  // A fresh checkout without a .env file is expected to still boot using
  // schema defaults, so failures here are intentionally swallowed.
  process.loadEnvFile();
} catch {
  // No .env file found - fall back to process.env / schema defaults.
}

export const env: ServerEnv = loadServerEnv(process.env);
