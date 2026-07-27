/**
 * Shared result shape for every integration with a system RecoverAI does not
 * control (carriers, police portals, CEIR/Sanchar Saathi, Apple/Google).
 * Callers must branch on `status` explicitly - there is no implicit
 * "assume success" path - which structurally enforces the master-spec rule:
 * never claim an external action succeeded unless the integration confirms
 * it or the user confirms completion.
 */
export type ExternalServiceResult<T> =
  | { status: 'success'; data: T }
  | { status: 'not_configured'; message: string }
  | { status: 'error'; message: string };
