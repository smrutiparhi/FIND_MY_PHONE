import { NoopMapProvider } from './providers/NoopMapProvider';
import type { MapProvider } from './MapProvider';

let cachedProvider: MapProvider | undefined;

/**
 * Provider factory. A real provider (Mapbox/MapTiler/Google) is wired up in
 * Part 8 - Device Location + Map, once the Recovery Map UI exists to consume
 * LocationObservation data.
 */
export function getMapProvider(): MapProvider {
  if (!cachedProvider) {
    cachedProvider = new NoopMapProvider();
  }
  return cachedProvider;
}

export type { MapProvider, MapClientConfig } from './MapProvider';
