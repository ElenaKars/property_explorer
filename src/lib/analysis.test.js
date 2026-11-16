import area from '@turf/area';
import { describe, expect, it } from 'vitest';
import { analyzeCoverage, summarizeExclusions } from './analysis.js';
import { rectangleArea } from './geometry.js';

// Analysis box in Berlin, about 136 m × 111 m.
const BOX = { south: 52.5, west: 13.4, north: 52.501, east: 13.402 };

// Rectangle helpers. Expected areas use rectangleArea, which is exact on the
// same sphere as @turf/area, so clipping errors show up immediately.
const ring = ({ south, west, north, east }) => [
  [west, south],
  [east, south],
  [east, north],
  [west, north],
  [west, south],
];
const building = (id, rings) => ({
  type: 'Feature',
  id,
  properties: { tags: { building: 'yes' } },
  geometry: { type: 'Polygon', coordinates: rings },
});
const rect = (id, bounds) => building(id, [ring(bounds)]);

// Relative tolerance: 0.01 %
const expectArea = (actual, expected) =>
  expect(Math.abs(actual - expected) / expected).toBeLessThan(1e-4);

describe('analyzeCoverage', () => {
  it('counts a building fully inside at its full area', () => {
    const b = { south: 52.5002, west: 13.4005, north: 52.5004, east: 13.4008 };
    const result = analyzeCoverage([rect('in', b)], BOX);

    expect(result.buildingCount).toBe(1);
    expect(result.clippedCount).toBe(0);
    expect(result.buildings[0].isClipped).toBe(false);
    expectArea(result.footprintAreaM2, rectangleArea(b));
    expectArea(result.coverageRatio, rectangleArea(b) / rectangleArea(BOX));
  });

  it('clips a building crossing the west edge to the part inside', () => {
    const b = { south: 52.5004, west: 13.3995, north: 52.5006, east: 13.4005 };
    const result = analyzeCoverage([rect('edge', b)], BOX);

    expect(result.clippedCount).toBe(1);
    expect(result.buildings[0].isClipped).toBe(true);
    expectArea(result.footprintAreaM2, rectangleArea({ ...b, west: BOX.west }));
    expectArea(result.buildings[0].fullAreaM2, rectangleArea(b));
    expect(result.buildings[0].fullGeometry.coordinates[0]).toHaveLength(5);
  });

  it('clips a building over a corner to the inside quarter', () => {
    const b = { south: 52.5009, west: 13.4019, north: 52.5011, east: 13.4021 };
    const result = analyzeCoverage([rect('corner', b)], BOX);
    expectArea(result.footprintAreaM2, rectangleArea({ ...b, north: BOX.north, east: BOX.east }));
  });

  it('ignores buildings entirely outside or only touching the boundary', () => {
    const outside = { south: 52.502, west: 13.403, north: 52.5022, east: 13.4032 };
    const touching = { south: 52.5004, west: 13.399, north: 52.5006, east: 13.4 }; // shares west edge
    const result = analyzeCoverage([rect('out', outside), rect('touch', touching)], BOX);

    expect(result.buildingCount).toBe(0);
    expect(result.footprintAreaM2).toBe(0);
  });

  it('subtracts a courtyard (hole) inside a clipped building', () => {
    const outer = { south: 52.5002, west: 13.3995, north: 52.5008, east: 13.401 };
    const hole = { south: 52.5004, west: 13.4002, north: 52.5006, east: 13.4006 };
    const result = analyzeCoverage([building('court', [ring(outer), ring(hole)])], BOX);

    const expected = rectangleArea({ ...outer, west: BOX.west }) - rectangleArea(hole);
    expectArea(result.footprintAreaM2, expected);
  });

  it('clips a courtyard that itself crosses the boundary', () => {
    const outer = { south: 52.5002, west: 13.3990, north: 52.5008, east: 13.401 };
    const hole = { south: 52.5004, west: 13.3995, north: 52.5006, east: 13.4005 };
    const result = analyzeCoverage([building('court2', [ring(outer), ring(hole)])], BOX);

    const expected =
      rectangleArea({ ...outer, west: BOX.west }) - rectangleArea({ ...hole, west: BOX.west });
    expectArea(result.footprintAreaM2, expected);
  });

  it('handles a concave building split into two pieces by the boundary', () => {
    // Upside-down U: the base lies north of the box, two arms reach inside.
    const n = BOX.north;
    const uShape = [
      [13.4005, 52.5006],
      [13.4008, 52.5006],
      [13.4008, n + 0.0002],
      [13.4012, n + 0.0002],
      [13.4012, 52.5006],
      [13.4015, 52.5006],
      [13.4015, n + 0.0005],
      [13.4005, n + 0.0005],
      [13.4005, 52.5006],
    ];
    const result = analyzeCoverage([building('u', [uShape])], BOX);

    const leftArm = rectangleArea({ south: 52.5006, west: 13.4005, north: n, east: 13.4008 });
    const rightArm = rectangleArea({ south: 52.5006, west: 13.4012, north: n, east: 13.4015 });
    expectArea(result.footprintAreaM2, leftArm + rightArm);
    expect(result.buildingCount).toBe(1);
  });

  it('handles MultiPolygon buildings and drops parts outside', () => {
    const inside = { south: 52.5002, west: 13.4002, north: 52.5003, east: 13.4004 };
    const outside = { south: 52.503, west: 13.41, north: 52.5031, east: 13.4102 };
    const feature = {
      type: 'Feature',
      id: 'multi',
      properties: {},
      geometry: { type: 'MultiPolygon', coordinates: [[ring(inside)], [ring(outside)]] },
    };
    const result = analyzeCoverage([feature], BOX);

    expectArea(result.footprintAreaM2, rectangleArea(inside));
    const coords = result.buildings[0].geometry.coordinates;
    expect(coords.every((polygon) => polygon.length > 0)).toBe(true);
  });

  it('gives 100 % coverage for a building larger than the box', () => {
    const huge = { south: 52.49, west: 13.39, north: 52.51, east: 13.41 };
    const result = analyzeCoverage([rect('huge', huge)], BOX);
    expectArea(result.coverageRatio, 1);
  });

  it('sums several buildings and reports the box area', () => {
    const a = { south: 52.5001, west: 13.4001, north: 52.5002, east: 13.4003 };
    const b = { south: 52.5005, west: 13.4010, north: 52.5007, east: 13.4012 };
    const result = analyzeCoverage([rect('a', a), rect('b', b)], BOX);

    expect(result.buildingCount).toBe(2);
    expectArea(result.selectionAreaM2, rectangleArea(BOX));
    expectArea(result.footprintAreaM2, rectangleArea(a) + rectangleArea(b));
    expectArea(
      result.footprintAreaM2,
      area(result.buildings[0].geometry) + area(result.buildings[1].geometry),
    );
  });

  it('counts excluded structures inside the box only, grouped by kind', () => {
    const structure = (id, kind, bounds) => ({
      ...rect(id, bounds),
      properties: { tags: { building: 'yes', man_made: kind } },
    });
    const summary = summarizeExclusions(
      [
        structure('s1', 'stele', { south: 52.5001, west: 13.4001, north: 52.50011, east: 13.40012 }),
        structure('s2', 'stele', { south: 52.5002, west: 13.4001, north: 52.50021, east: 13.40012 }),
        structure('t1', 'tower', { south: 52.5003, west: 13.4001, north: 52.50031, east: 13.40012 }),
        structure('out', 'stele', { south: 52.6, west: 13.5, north: 52.60001, east: 13.50002 }),
      ],
      BOX,
    );
    expect(summary).toEqual({ count: 3, kinds: [['stele', 2], ['tower', 1]] });
  });

  it('returns zero coverage for no buildings', () => {
    const result = analyzeCoverage([], BOX);
    expect(result).toMatchObject({ buildingCount: 0, clippedCount: 0, footprintAreaM2: 0, coverageRatio: 0 });
  });
});
