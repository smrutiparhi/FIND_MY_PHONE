export type ServiceLivenessStatus = 'ok';

export interface HealthCheckResponse {
  status: ServiceLivenessStatus;
  service: 'recoverai-api';
  timestamp: string;
  uptimeSeconds: number;
}

export type DependencyStatus = 'connected' | 'not_configured' | 'unavailable';

export interface ReadinessCheckResponse {
  status: 'ready' | 'degraded';
  timestamp: string;
  dependencies: {
    database: DependencyStatus;
    aiProvider: { name: string; status: DependencyStatus };
    mapProvider: { name: string; status: DependencyStatus };
  };
}
