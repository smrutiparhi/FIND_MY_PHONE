import type { NextFunction, Request, Response } from 'express';

type AsyncRouteHandler<Req extends Request = Request, Res extends Response = Response> = (
  req: Req,
  res: Res,
  next: NextFunction,
) => Promise<unknown>;

/** Forwards rejected promises from async route/controller handlers to Express's error middleware. */
export function asyncHandler<Req extends Request = Request, Res extends Response = Response>(
  handler: AsyncRouteHandler<Req, Res>,
) {
  return (req: Req, res: Res, next: NextFunction): void => {
    handler(req, res, next).catch(next);
  };
}
