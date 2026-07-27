import type { Request, Response } from 'express';
import type {
  ApiSuccessResponse,
  HealthCheckResponse,
  ReadinessCheckResponse,
} from '@recoverai/shared';
import { env } from '../config/env';
import { checkDatabaseConnection } from '../db/pool';
import { getAiProvider } from '../services/ai';
import { getMapProvider } from '../services/maps';

export function getLiveness(
  _req: Request,
  res: Response<ApiSuccessResponse<HealthCheckResponse>>,
): void {
  res.status(200).json({
    success: true,
    data: {
      status: 'ok',
      service: 'recoverai-api',
      timestamp: new Date().toISOString(),
      uptimeSeconds: Math.round(process.uptime()),
    },
  });
}

export async function getReadiness(
  _req: Request,
  res: Response<ApiSuccessResponse<ReadinessCheckResponse>>,
): Promise<void> {
  const databaseConnected = env.DATABASE_URL ? await checkDatabaseConnection() : false;
  const aiProvider = getAiProvider();
  const mapProvider = getMapProvider();
  const mapConfig = mapProvider.getClientConfig();

  const dependencies: ReadinessCheckResponse['dependencies'] = {
    database: env.DATABASE_URL
      ? databaseConnected
        ? 'connected'
        : 'unavailable'
      : 'not_configured',
    aiProvider: { name: aiProvider.name, status: 'connected' },
    mapProvider: {
      name: mapProvider.name,
      status: mapConfig.isConfigured ? 'connected' : 'not_configured',
    },
  };

  const status: ReadinessCheckResponse['status'] =
    dependencies.database === 'unavailable' ? 'degraded' : 'ready';

  res.status(200).json({
    success: true,
    data: { status, timestamp: new Date().toISOString(), dependencies },
  });
}
