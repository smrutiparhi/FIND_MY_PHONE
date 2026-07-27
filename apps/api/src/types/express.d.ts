import 'express';

declare global {
  namespace Express {
    interface Request {
      /** Correlation id set by pino-http (genReqId); also echoed as the x-request-id response header. */
      id?: string;
    }
  }
}

export {};
