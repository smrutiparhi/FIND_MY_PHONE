import type { MapClientConfig, MapProvider } from '../MapProvider';

/** Used when MAP_PROVIDER=maptiler. The API key doubles as MapTiler's publishable tile-query token - MapTiler has no separate public/secret key split. */
export class MapTilerMapProvider implements MapProvider {
  readonly name = 'maptiler';

  constructor(private readonly apiKey: string) {}

  getClientConfig(): MapClientConfig {
    return { provider: this.name, publicToken: this.apiKey, isConfigured: true };
  }
}
