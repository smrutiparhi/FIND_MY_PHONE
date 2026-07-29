import { env } from '../../config/env';
import { logger } from '../../lib/logger';
import { NoopMapProvider } from './providers/NoopMapProvider';
import { MapTilerMapProvider } from './providers/MapTilerMapProvider';
import { MapboxMapProvider } from './providers/MapboxMapProvider';
import type { MapProvider } from './MapProvider';

let cachedProvider: MapProvider | undefined;

/**
 * Provider factory (Part 8). Falls back to NoopMapProvider - reporting
 * `isConfigured: false` so the UI renders an honest "map unavailable" state
 * - whenever MAP_PROVIDER is 'none' (the default), 'google' (declared in the
 * env schema but not yet wired to a frontend renderer), or a real provider
 * was requested without the key it needs.
 */
export function getMapProvider(): MapProvider {
  if (cachedProvider) return cachedProvider;

  if (env.MAP_PROVIDER !== 'none' && !env.MAP_API_KEY) {
    logger.warn({ requestedProvider: env.MAP_PROVIDER }, 'MAP_PROVIDER is set but MAP_API_KEY is missing - falling back to NoopMapProvider');
  } else if (env.MAP_PROVIDER === 'maptiler' && env.MAP_API_KEY) {
    cachedProvider = new MapTilerMapProvider(env.MAP_API_KEY);
  } else if (env.MAP_PROVIDER === 'mapbox' && env.MAP_API_KEY) {
    cachedProvider = new MapboxMapProvider(env.MAP_API_KEY);
  } else if (env.MAP_PROVIDER === 'google') {
    logger.warn('MAP_PROVIDER=google has no frontend renderer wired up yet - falling back to NoopMapProvider');
  }

  if (!cachedProvider) cachedProvider = new NoopMapProvider();
  return cachedProvider;
}

export type { MapProvider, MapClientConfig } from './MapProvider';
