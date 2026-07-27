import type { NextFunction, Request, Response } from 'express';
import type { ZodSchema } from 'zod';

type ValidationTarget = 'body' | 'query' | 'params';

/**
 * Generic request-validation middleware factory. No route uses this yet in
 * Part 1 (health check takes no input) - it exists so every request-handling
 * route added from Part 3 onward validates through the same mechanism
 * instead of ad hoc checks inside controllers.
 */
export function validate(schema: ZodSchema, target: ValidationTarget = 'body') {
  return (req: Request, _res: Response, next: NextFunction): void => {
    req[target] = schema.parse(req[target]);
    next();
  };
}
