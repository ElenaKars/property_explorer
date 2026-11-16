import { describe, expect, it } from 'vitest';
import { assembleRings, osmToBuildingFeatures, pointInRing } from './osm.js';

// Overpass `out geom` points are { lat, lon }.
const pt = (lon, lat) => ({ lat, lon });
const closedSquare = (lon, lat, size) => [
  pt(lon, lat),
  pt(lon + size, lat),
  pt(lon + size, lat + size),
  pt(lon, lat + size),
  pt(lon, lat),
];

const way = (id, geometry, tags = { building: 'yes' }) => ({ type: 'way', id, geometry, tags });
const member = (ref, role, geometry) => ({ type: 'way', ref, role, geometry });
const relation = (id, members, tags = { building: 'yes', type: 'multipolygon' }) => ({
  type: 'relation',
  id,
  members,
  tags,
});

describe('osmToBuildingFeatures: ways', () => {
  it('turns a closed way into a Polygon in [lon, lat] order', () => {
    const { features, skipped } = osmToBuildingFeatures([way(1, closedSquare(13.4, 52.5, 0.001))]);
    expect(skipped).toBe(0);
    expect(features).toHaveLength(1);
    expect(features[0].id).toBe('way/1');
    expect(features[0].properties.tags).toEqual({ building: 'yes' });
    expect(features[0].geometry.type).toBe('Polygon');
    expect(features[0].geometry.coordinates[0][0]).toEqual([13.4, 52.5]);
  });

  it('skips and counts an unclosed way', () => {
    const open = closedSquare(13.4, 52.5, 0.001).slice(0, 4);
    const { features, skipped } = osmToBuildingFeatures([way(2, open)]);
    expect(features).toHaveLength(0);
    expect(skipped).toBe(1);
  });

  it('skips a way with missing coordinates', () => {
    const broken = closedSquare(13.4, 52.5, 0.001);
    broken[2] = null;
    expect(osmToBuildingFeatures([way(3, broken)]).skipped).toBe(1);
  });

  it('ignores nodes', () => {
    const { features, skipped } = osmToBuildingFeatures([{ type: 'node', id: 9, lat: 1, lon: 1 }]);
    expect(features).toHaveLength(0);
    expect(skipped).toBe(0);
  });
});

describe('osmToBuildingFeatures: multipolygon relations', () => {
  it('joins split outer segments (one reversed) and attaches an inner ring', () => {
    // Outer square 13.400–13.403 / 52.500–52.503 split into two halves.
    const half1 = [pt(13.4, 52.5), pt(13.403, 52.5), pt(13.403, 52.503)];
    const half2Reversed = [pt(13.4, 52.5), pt(13.4, 52.503), pt(13.403, 52.503)];
    const inner = closedSquare(13.401, 52.501, 0.001);

    const { features, skipped } = osmToBuildingFeatures([
      relation(10, [member(100, 'outer', half1), member(101, 'outer', half2Reversed), member(102, 'inner', inner)]),
    ]);

    expect(skipped).toBe(0);
    expect(features).toHaveLength(1);
    const { geometry } = features[0];
    expect(geometry.type).toBe('Polygon');
    expect(geometry.coordinates).toHaveLength(2); // outer + hole
    const outer = geometry.coordinates[0];
    expect(outer[0]).toEqual(outer[outer.length - 1]);
    expect(outer).toHaveLength(5);
  });

  it('builds a MultiPolygon from two separate outer rings', () => {
    const { features } = osmToBuildingFeatures([
      relation(11, [
        member(110, 'outer', closedSquare(13.4, 52.5, 0.001)),
        member(111, '', closedSquare(13.41, 52.5, 0.001)), // empty role = outer
      ]),
    ]);
    expect(features[0].geometry.type).toBe('MultiPolygon');
    expect(features[0].geometry.coordinates).toHaveLength(2);
  });

  it('places each inner ring in the outer ring that contains it', () => {
    const { features } = osmToBuildingFeatures([
      relation(12, [
        member(120, 'outer', closedSquare(13.4, 52.5, 0.002)),
        member(121, 'outer', closedSquare(13.41, 52.5, 0.002)),
        member(122, 'inner', closedSquare(13.4105, 52.5005, 0.0005)),
      ]),
    ]);
    const [first, second] = features[0].geometry.coordinates;
    expect(first).toHaveLength(1);
    expect(second).toHaveLength(2);
  });

  it('skips a relation whose outer ring has a gap', () => {
    const { features, skipped } = osmToBuildingFeatures([
      relation(13, [
        member(130, 'outer', [pt(13.4, 52.5), pt(13.403, 52.5), pt(13.403, 52.503)]),
        member(131, 'outer', [pt(13.4, 52.5), pt(13.4, 52.503), pt(13.4029, 52.503)]),
      ]),
    ]);
    expect(features).toHaveLength(0);
    expect(skipped).toBe(1);
  });

  it('skips a relation with an inner ring outside every outer ring', () => {
    const { skipped } = osmToBuildingFeatures([
      relation(14, [
        member(140, 'outer', closedSquare(13.4, 52.5, 0.001)),
        member(141, 'inner', closedSquare(13.5, 52.5, 0.0005)),
      ]),
    ]);
    expect(skipped).toBe(1);
  });

  it('does not count a member way twice when it is also tagged as a building', () => {
    const outline = closedSquare(13.4, 52.5, 0.001);
    const { features } = osmToBuildingFeatures([
      way(200, outline),
      relation(20, [member(200, 'outer', outline)]),
    ]);
    expect(features.map((f) => f.id)).toEqual(['relation/20']);
  });
});

describe('assembleRings / pointInRing', () => {
  it('returns closed rings unchanged', () => {
    const ring = [[0, 0], [1, 0], [1, 1], [0, 0]];
    expect(assembleRings([ring])).toEqual([ring]);
  });

  it('rejects a degenerate ring', () => {
    expect(assembleRings([[[0, 0], [1, 0], [0, 0]]])).toBeNull();
  });

  it('detects points inside and outside a ring', () => {
    const ring = [[0, 0], [2, 0], [2, 2], [0, 2], [0, 0]];
    expect(pointInRing([1, 1], ring)).toBe(true);
    expect(pointInRing([3, 1], ring)).toBe(false);
  });
});
