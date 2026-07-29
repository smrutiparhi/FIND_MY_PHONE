import type { Request, Response } from 'express';
import type { ApiSuccessResponse, MapClientConfig } from '@recoverai/shared';
import { getMapProvider } from '../services/maps';

/** Public/publishable config only (see MapProvider.ts) - still behind requireAuth for consistency with the rest of the app, not because the token itself is sensitive. */
export function getMapConfig(_req: Request, res: Response<ApiSuccessResponse<MapClientConfig>>): void {
  res.status(200).json({ success: true, data: getMapProvider().getClientConfig() });
}
