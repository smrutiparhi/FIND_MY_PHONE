import 'express';
import type { UserId } from '@recoverai/shared';

declare global {
  namespace Express {
    interface Request {
      /** Correlation id set by pino-http (genReqId); also echoed as the x-request-id response header. */
      id?: string;
      /** Set by middleware/authenticate.ts's requireAuth after verifying the caller's Supabase access token. */
      user?: { id: UserId; email: string };
    }
  }
}

export {};
