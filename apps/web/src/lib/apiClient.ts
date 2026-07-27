import type { ApiResponse } from '@recoverai/shared';
import { clientEnv } from './env';

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

export async function apiGet<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${clientEnv.apiBaseUrl}${path}`, {
    ...init,
    method: 'GET',
    credentials: 'include',
    headers: {
      Accept: 'application/json',
      ...init?.headers,
    },
  });

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
