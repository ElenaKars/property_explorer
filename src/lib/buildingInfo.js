import { formatArea } from './format.js';

function humanize(value) {
  const text = String(value).replace(/_/g, ' ').trim();
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/** OSM `building=*` value as a label: "yes" -> "Building", "apartments" -> "Apartments". */
export function buildingTypeLabel(tags = {}) {
  const type = tags.building;
  return !type || type === 'yes' ? 'Building' : humanize(type);
}

function formatAddress(tags) {
  const street = [tags['addr:street'] ?? tags['addr:place'], tags['addr:housenumber']]
    .filter(Boolean)
    .join(' ');
  const city = [tags['addr:postcode'], tags['addr:city']].filter(Boolean).join(' ');
  return [street, city].filter(Boolean).join(', ') || null;
}

/**
 * Plain data for a building popup. All values are plain strings; the UI must
 * render them as text, never as HTML (OSM tags are user-edited data).
 * @returns {{ title: string, rows: Array<[string, string]>, osmUrl: string|null }}
 */
export function describeBuilding({ properties = {}, areaInsideM2, fullAreaM2, isClipped }) {
  const tags = properties.tags ?? {};
  const type = buildingTypeLabel(tags);
  const address = formatAddress(tags);
  const title = tags.name || address || type;

  const rows = [['Type', type]];
  if (address && address !== title) rows.push(['Address', address]);
  if (tags['building:levels']) rows.push(['Levels', String(tags['building:levels'])]);
  if (tags['start_date']) rows.push(['Built', String(tags['start_date'])]);

  if (isClipped) {
    rows.push(['Footprint inside area', formatArea(areaInsideM2)]);
    rows.push(['Full footprint', formatArea(fullAreaM2)]);
  } else {
    rows.push(['Footprint', formatArea(areaInsideM2)]);
  }

  const { osmType, osmId } = properties;
  const osmUrl =
    (osmType === 'way' || osmType === 'relation') && Number.isInteger(osmId)
      ? `https://www.openstreetmap.org/${osmType}/${osmId}`
      : null;

  return { title, rows, osmUrl };
}
