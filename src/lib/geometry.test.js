import area from '@turf/area';
import { describe, expect, it } from 'vitest';
import { rectangleArea, rectangleDimensions } from './geometry.js';

const asPolygon = ({ south, west, north, east }) => ({
  type: 'Polygon',
  coordinates: [
    [
      [west, south],
      [east, south],
      [east, north],
      [west, north],
      [west, south],
    ],
  ],
});

describe('rectangleArea', () => {
  it('matches @turf/area for the same rectangle (consistent coverage ratio)', () => {
    const bounds = { south: 52.51, west: 13.37, north: 52.52, east: 13.39 };
    expect(rectangleArea(bounds)).toBeCloseTo(area(asPolygon(bounds)), 3);
  });

  it('is about 1.236 km² for 0.01° × 0.01° at the equator', () => {
    // (6,371,008.8 m · π/180 · 0.01)² ≈ 1,236,431 m²
    const m2 = rectangleArea({ south: 0, west: 0, north: 0.01, east: 0.01 });
    expect(m2).toBeGreaterThan(1_236_000);
    expect(m2).toBeLessThan(1_237_000);
  });

  it('does not depend on corner order', () => {
    const a = rectangleArea({ south: 52.5, west: 13.4, north: 52.51, east: 13.42 });
    const b = rectangleArea({ south: 52.51, west: 13.42, north: 52.5, east: 13.4 });
    expect(a).toBeCloseTo(b, 6);
  });
});

describe('rectangleDimensions', () => {
  it('shrinks east-west distance with latitude', () => {
    const { widthM, heightM } = rectangleDimensions({ south: 60, west: 0, north: 60.01, east: 0.01 });
    expect(heightM).toBeCloseTo(1111.95, 1);
    expect(widthM).toBeCloseTo(1111.95 * Math.cos((60.005 * Math.PI) / 180), 1);
  });
});
