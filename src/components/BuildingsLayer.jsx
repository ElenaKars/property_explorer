import { useMemo } from 'react';
import { GeoJSON } from 'react-leaflet';
import L from 'leaflet';
import { describeBuilding } from '../lib/buildingInfo.js';
import { BUILDING_COLORS } from '../lib/mapStyles.js';

const baseStyle = (building) => {
  const colors = building.isClipped ? BUILDING_COLORS.clipped : BUILDING_COLORS.inside;
  return { color: colors.stroke, weight: 1, fillColor: colors.fill, fillOpacity: 0.45 };
};

// Stable reference: react-leaflet re-applies styles when this prop changes.
const styleFeature = (feature) => baseStyle(feature.properties.building);

const OUTLINE_STYLE = {
  color: BUILDING_COLORS.clipped.stroke,
  weight: 1,
  opacity: 0.6,
  dashArray: '3 3',
  fill: false,
};

// Build popup content with DOM text nodes: OSM tags are user-edited data and
// must never be interpreted as HTML.
function createPopupContent(building) {
  const { title, rows, osmUrl } = describeBuilding(building);
  const root = document.createElement('div');
  root.className = 'building-popup';

  const heading = document.createElement('p');
  heading.className = 'building-popup__title';
  heading.textContent = title;
  root.append(heading);

  const list = document.createElement('dl');
  for (const [label, value] of rows) {
    const row = document.createElement('div');
    const dt = document.createElement('dt');
    const dd = document.createElement('dd');
    dt.textContent = label;
    dd.textContent = value;
    row.append(dt, dd);
    list.append(row);
  }
  root.append(list);

  if (osmUrl) {
    const link = document.createElement('a');
    link.href = osmUrl;
    link.target = '_blank';
    link.rel = 'noreferrer';
    link.textContent = 'View on OpenStreetMap';
    root.append(link);
  }

  return root;
}

function toCollection(buildings, geometryKey) {
  return {
    type: 'FeatureCollection',
    features: buildings.map((building) => ({
      type: 'Feature',
      id: building.id,
      properties: { building },
      geometry: building[geometryKey],
    })),
  };
}

/**
 * Renders analysed buildings: the part inside the selection is filled
 * (blue = fully inside, amber = cut at the boundary); for cut buildings the
 * full outline is drawn faintly so the clipping is visible.
 */
export default function BuildingsLayer({ analysis, dataKey, interactive }) {
  const renderer = useMemo(() => L.canvas({ padding: 0.5 }), []);

  const collections = useMemo(() => {
    if (!analysis) return null;
    return {
      inside: toCollection(analysis.buildings, 'geometry'),
      outlines: toCollection(
        analysis.buildings.filter((b) => b.isClipped),
        'fullGeometry',
      ),
    };
  }, [analysis]);

  if (!collections) return null;

  // GeoJSON layers are immutable in react-leaflet: a new key re-creates them.
  const key = `${dataKey}|${interactive ? 'i' : 'n'}`;

  return (
    <>
      <GeoJSON
        key={`outlines|${key}`}
        data={collections.outlines}
        style={OUTLINE_STYLE}
        interactive={false}
        renderer={renderer}
      />
      <GeoJSON
        key={`inside|${key}`}
        data={collections.inside}
        style={styleFeature}
        interactive={interactive}
        renderer={renderer}
        onEachFeature={(feature, layer) => {
          if (!interactive) return;
          const { building } = feature.properties;
          layer.bindPopup(() => createPopupContent(building), { maxWidth: 280 });
          layer.on('mouseover', () => layer.setStyle({ weight: 2.5, fillOpacity: 0.65 }));
          layer.on('mouseout', () => layer.setStyle(baseStyle(building)));
        }}
      />
    </>
  );
}
