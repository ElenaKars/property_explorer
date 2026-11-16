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
      geometry: withoutEmptyParts(clipped.geometry),
      areaInsideM2,
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
