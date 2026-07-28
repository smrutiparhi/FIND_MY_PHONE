import type { ApiResponse } from '@recoverai/shared';
import { clientEnv } from './env';
import { supabase } from './supabaseClient';

export class ApiClientError extends Error {
  readonly code: string;
  readonly status: number;

  constructor(status: number, code: string, message: string) {
    super(message);
    this.name = 'ApiClientError';
    this.status = status;
    this.code = code;
  }
}

async function authHeaders(): Promise<HeadersInit> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function apiRequest<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${clientEnv.apiBaseUrl}${path}`, {
    ...init,
    headers: {
      Accept: 'application/json',
      ...(init?.body ? { 'Content-Type': 'application/json' } : {}),
      ...(await authHeaders()),
      ...init?.headers,
    },
  });

  if (response.status === 204) {
    return undefined as T;
  }

  const body = (await response.json().catch(() => undefined)) as ApiResponse<T> | undefined;

  if (!body) {
    throw new ApiClientError(
      response.status,
      'INVALID_RESPONSE',
      'The server returned an unreadable response.',
    );
  }
  if (!body.success) {
    throw new ApiClientError(response.status, body.error.code, body.error.message);
  }
  return body.data;
}

export function apiGet<T>(path: string, init?: RequestInit): Promise<T> {
  return apiRequest<T>(path, { ...init, method: 'GET' });
}

export function apiPatch<T>(path: string, body: unknown, init?: RequestInit): Promise<T> {
  return apiRequest<T>(path, { ...init, method: 'PATCH', body: JSON.stringify(body) });
}

export function apiDelete<T>(path: string, init?: RequestInit): Promise<T> {
  return apiRequest<T>(path, { ...init, method: 'DELETE' });
}
