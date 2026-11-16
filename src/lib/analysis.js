// Footprint area and coverage of buildings inside a rectangle.
//
// Each building is clipped to the rectangle first, so parts outside the
// selection never count. Areas are geodesic (spherical) via @turf/area, and
// the rectangle area uses the same sphere (see geometry.js), so the ratio is
// consistent.

import area from '@turf/area';
import bboxClip from '@turf/bbox-clip';
import { rectangleArea } from './geometry.js';

// Slivers below this (m²) come from buildings that only touch the boundary.
const MIN_PART_AREA_M2 = 0.01;

function* positionsOf(geometry) {
  const polygons = geometry.type === 'Polygon' ? [geometry.coordinates] : geometry.coordinates;
  for (const polygon of polygons) {
    for (const ring of polygon) yield* ring;
  }
}

function isFullyInside(geometry, { south, west, north, east }) {
  for (const [lon, lat] of positionsOf(geometry)) {
    if (lon < west || lon > east || lat < south || lat > north) return false;
  }
  return true;
}

function hasArea(geometry) {
  if (geometry.type === 'Polygon') return geometry.coordinates.length > 0;
  return geometry.coordinates.some((polygon) => polygon.length > 0);
}

// bboxClip may leave polygons without an outer ring; drop them so the
// result is valid GeoJSON for rendering.
function withoutEmptyParts(geometry) {
  if (geometry.type !== 'MultiPolygon') return geometry;
  return { ...geometry, coordinates: geometry.coordinates.filter((p) => p.length > 0) };
}

/**
 * @param {object[]} features GeoJSON building features (Polygon/MultiPolygon)
 * @param {{south, west, north, east}} bounds analysis rectangle
 */
export function analyzeCoverage(features, bounds) {
  const { south, west, north, east } = bounds;
  const bbox = [west, south, east, north];
  const selectionAreaM2 = rectangleArea(bounds);

  const buildings = [];
  let footprintAreaM2 = 0;
  let clippedCount = 0;

  for (const feature of features) {
    const inside = isFullyInside(feature.geometry, bounds);
    const clipped = inside ? feature : bboxClip(feature, bbox);
    if (!hasArea(clipped.geometry)) continue;

    const areaInsideM2 = area(clipped);
    if (areaInsideM2 < MIN_PART_AREA_M2) continue;

    footprintAreaM2 += areaInsideM2;
    if (!inside) clippedCount += 1;

    buildings.push({
      id: feature.id,
      properties: feature.properties,
      geometry: withoutEmptyParts(clipped.geometry), // part inside the selection
      fullGeometry: feature.geometry,
      areaInsideM2,
      fullAreaM2: inside ? areaInsideM2 : area(feature),
      isClipped: !inside,
    });
  }

  return {
    selectionAreaM2,
    footprintAreaM2,
    coverageRatio: selectionAreaM2 > 0 ? footprintAreaM2 / selectionAreaM2 : 0,
    buildingCount: buildings.length,
    clippedCount,
    buildings,
  };
}

/**
 * Count excluded man_made structures that actually lie inside the selection,
 * grouped by their man_made value (most frequent first).
 * @returns {{ count: number, kinds: Array<[string, number]> }}
 */
export function summarizeExclusions(excludedFeatures, bounds) {
  const { buildings } = analyzeCoverage(excludedFeatures, bounds);
  const byKind = new Map();
  for (const { properties } of buildings) {
    const kind = properties?.tags?.man_made ?? 'unknown';
    byKind.set(kind, (byKind.get(kind) ?? 0) + 1);
  }
  return {
    count: buildings.length,
    kinds: [...byKind.entries()].sort((a, b) => b[1] - a[1]),
  };
}
