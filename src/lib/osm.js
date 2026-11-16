// Convert Overpass `out geom` JSON into GeoJSON building features.
//
// - Closed ways become Polygons.
// - Multipolygon relations are assembled from their member ways: segments
//   are joined end-to-end into closed rings, then inner rings are assigned
//   to the outer ring that contains them.
// - Ways that are also members of a building relation are skipped, so the
//   same footprint is never counted twice.
// - Anything that cannot form valid closed rings is skipped and counted.
// - Structures tagged man_made=* (e.g. memorial stelae mapped as
//   building=yes + man_made=stele) are returned separately as excluded.
//
// Coordinates are GeoJSON order: [lon, lat].

/** True for OSM objects that are structures rather than buildings. */
export function isExcludedStructure(tags = {}) {
  return Boolean(tags.man_made);
}

const MIN_RING_POINTS = 4; // closed triangle: A, B, C, A

function toPosition(point) {
  if (!point || !Number.isFinite(point.lat) || !Number.isFinite(point.lon)) return null;
  return [point.lon, point.lat];
}

function toPositions(geometry) {
  if (!Array.isArray(geometry)) return null;
  const positions = geometry.map(toPosition);
  return positions.every(Boolean) ? positions : null;
}

const samePosition = (a, b) => a[0] === b[0] && a[1] === b[1];

function isClosedRing(ring) {
  return ring.length >= MIN_RING_POINTS && samePosition(ring[0], ring[ring.length - 1]);
}

/**
 * Join open line segments into closed rings by matching endpoints.
 * Returns null if any segment cannot be closed into a ring.
 */
export function assembleRings(segments) {
  const remaining = segments.filter((segment) => segment.length >= 2).map((s) => [...s]);
  const rings = [];

  while (remaining.length > 0) {
    let ring = remaining.shift();

    while (!samePosition(ring[0], ring[ring.length - 1])) {
      const end = ring[ring.length - 1];
      const index = remaining.findIndex(
        (s) => samePosition(s[0], end) || samePosition(s[s.length - 1], end),
      );
      if (index === -1) return null; // gap in the outline

      const [next] = remaining.splice(index, 1);
      const oriented = samePosition(next[0], end) ? next : [...next].reverse();
      ring = ring.concat(oriented.slice(1));
    }

    if (!isClosedRing(ring)) return null;
    rings.push(ring);
  }

  return rings;
}

/** Ray-casting point-in-ring test (planar, fine at building scale). */
export function pointInRing([x, y], ring) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) {
      inside = !inside;
    }
  }
  return inside;
}

function wayToGeometry(way) {
  const ring = toPositions(way.geometry);
  if (!ring || !isClosedRing(ring)) return null;
  return { type: 'Polygon', coordinates: [ring] };
}

function relationToGeometry(relation) {
  const wayMembers = (relation.members ?? []).filter((m) => m.type === 'way');
  const outerSegments = [];
  const innerSegments = [];

  for (const member of wayMembers) {
    const positions = toPositions(member.geometry);
    if (!positions) return null; // incomplete member geometry
    // An empty role is treated as outer, as OSM tools commonly do.
    (member.role === 'inner' ? innerSegments : outerSegments).push(positions);
  }

  const outers = assembleRings(outerSegments);
  const inners = assembleRings(innerSegments);
  if (!outers || outers.length === 0 || !inners) return null;

  const polygons = outers.map((outer) => [outer]);
  for (const inner of inners) {
    const owner = polygons.find(([outer]) => pointInRing(inner[0], outer));
    if (!owner) return null; // inner ring outside every outer ring
    owner.push(inner);
  }

  return polygons.length === 1
    ? { type: 'Polygon', coordinates: polygons[0] }
    : { type: 'MultiPolygon', coordinates: polygons };
}

/**
 * @param {object[]} elements Overpass JSON `elements` from an `out geom` query
 * @returns {{ features: object[], excludedFeatures: object[], skipped: number }}
 *   `features` are buildings; `excludedFeatures` are man_made structures.
 */
export function osmToBuildingFeatures(elements) {
  const relationMemberWays = new Set();
  for (const element of elements) {
    if (element.type !== 'relation' || isExcludedStructure(element.tags)) continue;
    for (const member of element.members ?? []) {
      if (member.type === 'way') relationMemberWays.add(member.ref);
    }
  }

  const features = [];
  const excludedFeatures = [];
  let skipped = 0;

  for (const element of elements) {
    let geometry = null;
    if (element.type === 'way') {
      if (relationMemberWays.has(element.id)) continue; // counted via its relation
      geometry = wayToGeometry(element);
    } else if (element.type === 'relation') {
      geometry = relationToGeometry(element);
    } else {
      continue; // nodes are not building outlines
    }

    if (!geometry) {
      skipped += 1;
      continue;
    }

    const feature = {
      type: 'Feature',
      id: `${element.type}/${element.id}`,
      properties: { osmType: element.type, osmId: element.id, tags: element.tags ?? {} },
      geometry,
    };
    (isExcludedStructure(element.tags) ? excludedFeatures : features).push(feature);
  }

  return { features, excludedFeatures, skipped };
}
