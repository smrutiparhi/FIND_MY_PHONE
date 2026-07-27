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
