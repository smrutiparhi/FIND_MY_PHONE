export interface MapClientConfig {
  provider: string;
  /** Public/publishable token safe to hand to a frontend map SDK, if any. */
  publicToken: string | null;
  isConfigured: boolean;
}

/**
 * RecoverAI never computes or fabricates a device's position - see master
 * spec: "Never fabricate device location." This abstraction only hands the
 * frontend whatever public configuration a real mapping provider (Mapbox,
 * MapTiler, Google Maps) needs to render a map and plot LocationObservation
 * rows the user or an authorized integration already supplied. It performs
 * no geolocation or tracking of its own.
 */
export interface MapProvider {
  readonly name: string;
  getClientConfig(): MapClientConfig;
}
