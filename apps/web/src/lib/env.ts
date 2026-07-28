export interface ClientEnv {
  apiBaseUrl: string;
  supabaseUrl: string;
  supabaseAnonKey: string;
}

function readApiBaseUrl(): string {
  const value = import.meta.env.VITE_API_BASE_URL;
  if (!value) {
    if (import.meta.env.PROD) {
      throw new Error('VITE_API_BASE_URL must be set in production builds.');
    }
    return 'http://localhost:4000';
  }
  return value;
}

function readRequired(name: 'VITE_SUPABASE_URL' | 'VITE_SUPABASE_ANON_KEY'): string {
  const value = import.meta.env[name];
  if (!value) {
    throw new Error(
      `${name} must be set - see apps/web/.env.example. Authentication cannot work without it.`,
    );
  }
  return value;
}

export const clientEnv: ClientEnv = {
  apiBaseUrl: readApiBaseUrl(),
  supabaseUrl: readRequired('VITE_SUPABASE_URL'),
  supabaseAnonKey: readRequired('VITE_SUPABASE_ANON_KEY'),
};
