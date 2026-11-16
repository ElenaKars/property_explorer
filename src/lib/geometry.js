// Geometry helpers. Bounds are plain objects: { south, west, north, east }
// in WGS84 degrees.

import { earthRadius } from '@turf/helpers';

// Same sphere as @turf/area (mean Earth radius, 6,371,008.8 m), so rectangle
// and building areas are computed on a consistent basis.
export const EARTH_RADIUS_M = earthRadius;

const toRad = (deg) => (deg * Math.PI) / 180;

/**
 * Area of a latitude/longitude-aligned rectangle on a sphere, in m².
 * Exact for the spherical model: R² · Δλ · |sin φ₂ − sin φ₁|.
 */
export function rectangleArea({ south, west, north, east }) {
  return (
    EARTH_RADIUS_M ** 2 *
    Math.abs(toRad(east - west)) *
    Math.abs(Math.sin(toRad(north)) - Math.sin(toRad(south)))
  );
}

/** Approximate width (at the middle latitude) and height in metres. */
export function rectangleDimensions({ south, west, north, east }) {
  const midLat = toRad((north + south) / 2);
  return {
    widthM: EARTH_RADIUS_M * Math.abs(toRad(east - west)) * Math.cos(midLat),
    heightM: EARTH_RADIUS_M * Math.abs(toRad(north - south)),
  };
}

/** Leaflet-style [[south, west], [north, east]] pair for <Rectangle>. */
export function toLeafletBounds({ south, west, north, east }) {
  return [
    [south, west],
    [north, east],
  ];
}
