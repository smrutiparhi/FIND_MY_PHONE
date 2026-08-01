import { useEffect, useRef, type ReactElement } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import type { LocationObservation, MapClientConfig } from '@recoverai/shared';

interface TileTemplate {
  url: string;
  attribution: string;
}

/** Only the two providers actually rendered by this component - see services/maps/index.ts on the backend for the full provider list. 'google' has no tile-URL renderer wired up here (its terms restrict raw tile access outside its own JS API). */
function tileTemplateFor(config: MapClientConfig): TileTemplate | null {
  if (!config.isConfigured || !config.publicToken) return null;
  if (config.provider === 'maptiler') {
    return {
      url: `https://api.maptiler.com/maps/streets-v2/{z}/{x}/{y}.png?key=${config.publicToken}`,
      attribution: '&copy; <a href="https://www.maptiler.com/copyright/">MapTiler</a> &copy; OpenStreetMap contributors',
    };
  }
  if (config.provider === 'mapbox') {
    return {
      url: `https://api.mapbox.com/styles/v1/mapbox/streets-v12/tiles/256/{z}/{x}/{y}@2x?access_token=${config.publicToken}`,
      attribution: '&copy; <a href="https://www.mapbox.com/about/maps/">Mapbox</a> &copy; OpenStreetMap contributors',
    };
  }
  return null;
}

function markerIcon(color: string, size: number): L.DivIcon {
  return L.divIcon({
    className: '',
    html: `<span style="display:block;width:${size}px;height:${size}px;border-radius:9999px;background:${color};border:2px solid white;box-shadow:0 0 0 1px rgba(0,0,0,0.4);"></span>`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
  });
}

interface DeviceMapProps {
  config: MapClientConfig;
  observations: LocationObservation[];
  /** When set, clicking the map reports the picked coordinates - used by RecordLocationForm's "pick on map" mode. */
  onPickLocation?: (lat: number, lng: number) => void;
}

/**
 * Renders independent markers per observation - deliberately no connecting
 * line between them, since a polyline would visually imply continuous
 * tracking between two points that were, in reality, most likely minutes or
 * hours apart (master spec: "without presenting historical observations as
 * continuous tracking"). The most recent observation is drawn larger, with
 * an accuracy-radius circle when available.
 */
export function DeviceMap({ config, observations, onPickLocation }: DeviceMapProps): ReactElement {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const layerGroupRef = useRef<L.LayerGroup | null>(null);
  const onPickLocationRef = useRef(onPickLocation);
  onPickLocationRef.current = onPickLocation;

  const tileTemplate = tileTemplateFor(config);

  useEffect(() => {
    if (!containerRef.current || !tileTemplate || mapRef.current) return;
    const map = L.map(containerRef.current, { attributionControl: true });
    L.tileLayer(tileTemplate.url, { attribution: tileTemplate.attribution, maxZoom: 19 }).addTo(map);
    map.setView([20, 0], 2);
    map.on('click', (e: L.LeafletMouseEvent) => {
      onPickLocationRef.current?.(e.latlng.lat, e.latlng.lng);
    });
    layerGroupRef.current = L.layerGroup().addTo(map);
    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tileTemplate?.url]);

  useEffect(() => {
    const map = mapRef.current;
    const layerGroup = layerGroupRef.current;
    if (!map || !layerGroup) return;
    layerGroup.clearLayers();

    if (observations.length === 0) return;
    const [latest, ...history] = observations;
    if (!latest) return;

    for (const obs of history) {
      L.marker([obs.latitude, obs.longitude], { icon: markerIcon('#64748b', 12) })
        .bindPopup(popupHtml(obs, false))
        .addTo(layerGroup);
    }

    L.marker([latest.latitude, latest.longitude], { icon: markerIcon('#0ea5e9', 18) })
      .bindPopup(popupHtml(latest, true))
      .addTo(layerGroup);

    if (latest.accuracyMeters) {
      L.circle([latest.latitude, latest.longitude], {
        radius: latest.accuracyMeters,
        color: '#0ea5e9',
        fillColor: '#0ea5e9',
        fillOpacity: 0.1,
        weight: 1,
      }).addTo(layerGroup);
    }

    const bounds = L.latLngBounds(observations.map((o) => [o.latitude, o.longitude]));
    map.fitBounds(bounds.pad(0.3), { maxZoom: 15 });
  }, [observations]);

  if (!tileTemplate) {
    return (
      <div className="flex h-72 flex-col items-center justify-center gap-1 glass-panel text-center">
        <p className="text-sm font-medium text-slate-300">Map unavailable</p>
        <p className="max-w-xs text-xs text-slate-500">
          No map provider is configured. Coordinates, timestamps, and source information are still shown below.
        </p>
      </div>
    );
  }

  return <div ref={containerRef} className="h-72 w-full rounded-lg border border-white/10" />;
}

function popupHtml(obs: LocationObservation, isLatest: boolean): string {
  const time = new Date(obs.observedAt).toLocaleString();
  return `<div style="font-size:12px;line-height:1.4">
    <strong>${isLatest ? 'Latest observation' : 'Past observation'}</strong><br/>
    ${time}<br/>
    Source: ${obs.source}<br/>
    Verification: ${obs.verificationStatus}
  </div>`;
}
