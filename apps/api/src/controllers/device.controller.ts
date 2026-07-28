import type { Request, Response } from 'express';
import type { ApiSuccessResponse, Device } from '@recoverai/shared';
import { getRepos } from '../db/repos';
import { UnauthorizedError } from '../lib/errors';

export async function listMyDevices(req: Request, res: Response<ApiSuccessResponse<Device[]>>): Promise<void> {
  if (!req.user) throw new UnauthorizedError();
  const devices = await getRepos().devices.listByUser(req.user.id);
  res.status(200).json({ success: true, data: devices });
}
