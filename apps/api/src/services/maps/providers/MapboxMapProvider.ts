import type { MapClientConfig, MapProvider } from '../MapProvider';

/** Used when MAP_PROVIDER=mapbox. Expects a public (`pk.`) access token - never a secret token. */
export class MapboxMapProvider implements MapProvider {
  readonly name = 'mapbox';

  constructor(private readonly publicToken: string) {}

  getClientConfig(): MapClientConfig {
    return { provider: this.name, publicToken: this.publicToken, isConfigured: true };
  }
}
