export interface ClientEnv {
  apiBaseUrl: string;
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

export const clientEnv: ClientEnv = {
  apiBaseUrl: readApiBaseUrl(),
};
