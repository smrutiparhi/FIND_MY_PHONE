import type { MapClientConfig, MapProvider } from '../MapProvider';

/**
 * Used when MAP_PROVIDER=none (the default). The Recovery Map UI (Part 8)
 * renders an explicit "map unavailable" empty state rather than pretending a
 * provider is wired up.
 */
export class NoopMapProvider implements MapProvider {
  readonly name = 'none';

  getClientConfig(): MapClientConfig {
    return { provider: this.name, publicToken: null, isConfigured: false };
  }
}
