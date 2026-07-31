import type { Request, Response } from 'express';
import type { ApiSuccessResponse, Device, DeviceId, UpdateDeviceSimInfoInput } from '@recoverai/shared';
import { getRepos } from '../db/repos';
import { NotFoundError, UnauthorizedError } from '../lib/errors';

export async function listMyDevices(req: Request, res: Response<ApiSuccessResponse<Device[]>>): Promise<void> {
  if (!req.user) throw new UnauthorizedError();
  const devices = await getRepos().devices.listByUser(req.user.id);
  res.status(200).json({ success: true, data: devices });
}

export async function updateDeviceSimInfo(
  req: Request<{ deviceId: string }, unknown, UpdateDeviceSimInfoInput>,
  res: Response<ApiSuccessResponse<Device>>,
): Promise<void> {
  if (!req.user) throw new UnauthorizedError();
  const deviceId = req.params.deviceId as DeviceId;
  const updated = await getRepos().devices.update(deviceId, req.user.id, req.body);
  if (!updated) throw new NotFoundError('Device not found');
  res.status(200).json({ success: true, data: updated });
}
