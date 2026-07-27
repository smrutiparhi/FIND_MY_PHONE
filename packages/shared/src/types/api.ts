/**
 * Standard REST response envelope shared by every RecoverAI API endpoint.
 * Keeping success/error shapes consistent lets the frontend handle any
 * endpoint with one response-parsing code path.
 */

export interface ApiSuccessResponse<T> {
  success: true;
  data: T;
}

export interface ApiErrorDetail {
  path: string;
  message: string;
}

export interface ApiErrorResponse {
  success: false;
  error: {
    code: string;
    message: string;
    details?: ApiErrorDetail[];
  };
}

export type ApiResponse<T> = ApiSuccessResponse<T> | ApiErrorResponse;
