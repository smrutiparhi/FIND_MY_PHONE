import rateLimit from 'express-rate-limit';

/**
 * Generous, app-wide baseline so no endpoint is ever completely unprotected.
 * Endpoint-specific limiters (e.g. tight brute-force protection on
 * login/password-reset) are added in Part 3 - Authentication.
 */
export const baselineRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 300,
  standardHeaders: true,
  legacyHeaders: false,
});

/**
 * Every Recovery Agent message is a real (potentially billed) call to a real
 * model provider - tighter than the app-wide baseline so a runaway client or
 * scripted abuse can't rack up provider cost the way it could against a free
 * read endpoint.
 */
export const agentMessageRateLimiter = rateLimit({
  windowMs: 5 * 60 * 1000,
  limit: 20,
  standardHeaders: true,
  legacyHeaders: false,
});

/**
 * Every evidence upload costs real object-storage space and bandwidth -
 * tighter than the app-wide baseline so a scripted client can't fill a
 * user's Evidence Vault (or storage costs) via repeated large uploads.
 */
export const evidenceUploadRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 30,
  standardHeaders: true,
  legacyHeaders: false,
});
