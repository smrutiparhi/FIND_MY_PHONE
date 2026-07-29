/**
 * What GET /api/map/config hands the frontend - only ever public/publishable
 * config, never a secret. `isConfigured: false` (MAP_PROVIDER=none, the
 * default) means the location page must render an honest "map unavailable"
 * empty state rather than pretending a provider is wired up - see
 * apps/api/src/services/maps/MapProvider.ts.
 */
export interface MapClientConfig {
  provider: string;
  publicToken: string | null;
  isConfigured: boolean;
}
