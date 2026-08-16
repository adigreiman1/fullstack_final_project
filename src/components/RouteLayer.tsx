'use client';

import { useMemo } from 'react';
import { Layer, Source } from 'react-map-gl/mapbox';

import { toLineFeature, type LineStringGeometry } from '@/lib/mapbox-optimization';

interface RouteLayerProps {
  vehicleId: string;
  /** The optimised trip geometry, or null while loading / after a failure. */
  geometry: LineStringGeometry | null;
  color: string;
  /** Second, non-colour encoding of vehicle identity. Undefined = solid line. */
  dashArray?: readonly number[];
  visible: boolean;
  /** Another vehicle is focused: stay on the map, but recede. */
  dimmed?: boolean;
}

/** Mapbox layer ids allow no separators we cannot control, so slugify the id. */
function layerSlug(vehicleId: string): string {
  return vehicleId.replace(/[^a-zA-Z0-9_-]/g, '_');
}

/**
 * One vehicle's optimised route: a light casing under a coloured line.
 *
 * The casing is not decoration — three of the palette's slots sit below 3:1
 * against the map surface, and a 2px surface ring is what keeps two routes
 * legible where they overlap.
 */
export function RouteLayer({
  vehicleId,
  geometry,
  color,
  dashArray,
  visible,
  dimmed = false,
}: RouteLayerProps) {
  const slug = layerSlug(vehicleId);

  // The feature identity has to be stable, or mapbox-gl re-uploads the source
  // data on every parent render (every hover) and the map stutters.
  const data = useMemo(() => (geometry ? toLineFeature(geometry) : null), [geometry]);

  if (!data || !visible) return null;

  return (
    <Source id={`route-source-${slug}`} type="geojson" data={data}>
      <Layer
        id={`route-casing-${slug}`}
        type="line"
        layout={{ 'line-cap': 'round', 'line-join': 'round' }}
        paint={{
          'line-color': '#ffffff',
          'line-width': 7,
          'line-opacity': dimmed ? 0.35 : 0.9,
        }}
      />
      <Layer
        id={`route-line-${slug}`}
        type="line"
        layout={{ 'line-cap': 'round', 'line-join': 'round' }}
        paint={{
          'line-color': color,
          'line-width': 3.5,
          'line-opacity': dimmed ? 0.3 : 1,
          ...(dashArray ? { 'line-dasharray': [...dashArray] } : {}),
        }}
      />
    </Source>
  );
}
