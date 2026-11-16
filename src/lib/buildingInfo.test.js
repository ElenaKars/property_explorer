import { describe, expect, it } from 'vitest';
import { buildingTypeLabel, describeBuilding } from './buildingInfo.js';

const building = (tags, extra = {}) => ({
  properties: { osmType: 'way', osmId: 123, tags },
  areaInsideM2: 250,
  fullAreaM2: 250,
  isClipped: false,
  ...extra,
});

describe('buildingTypeLabel', () => {
  it('maps generic and specific building values', () => {
    expect(buildingTypeLabel({ building: 'yes' })).toBe('Building');
    expect(buildingTypeLabel({ building: 'semidetached_house' })).toBe('Semidetached house');
    expect(buildingTypeLabel({})).toBe('Building');
  });
});

describe('describeBuilding', () => {
  it('uses the name as title and lists address, levels and footprint', () => {
    const info = describeBuilding(
      building({
        building: 'apartments',
        name: 'Haus am See',
        'addr:street': 'Seestraße',
        'addr:housenumber': '12',
        'addr:postcode': '10115',
        'addr:city': 'Berlin',
        'building:levels': '5',
      }),
    );
    expect(info.title).toBe('Haus am See');
    expect(info.rows).toEqual([
      ['Type', 'Apartments'],
      ['Address', 'Seestraße 12, 10115 Berlin'],
      ['Levels', '5'],
      ['Footprint', '250 m²'],
    ]);
    expect(info.osmUrl).toBe('https://www.openstreetmap.org/way/123');
  });

  it('falls back to the address, then the type, as title', () => {
    expect(describeBuilding(building({ 'addr:street': 'A', 'addr:housenumber': '1' })).title).toBe('A 1');
    expect(describeBuilding(building({ building: 'garage' })).title).toBe('Garage');
  });

  it('shows inside and full footprint for clipped buildings', () => {
    const info = describeBuilding(building({}, { isClipped: true, areaInsideM2: 100, fullAreaM2: 400 }));
    expect(info.rows).toContainEqual(['Footprint inside area', '100 m²']);
    expect(info.rows).toContainEqual(['Full footprint', '400 m²']);
  });

  it('returns tag text unchanged so the UI can render it safely as text', () => {
    const info = describeBuilding(building({ name: '<img src=x onerror=alert(1)>' }));
    expect(info.title).toBe('<img src=x onerror=alert(1)>');
  });

  it('only builds OSM links for ways and relations with numeric ids', () => {
    const bad = { properties: { osmType: 'javascript:', osmId: 1, tags: {} }, areaInsideM2: 1 };
    expect(describeBuilding(bad).osmUrl).toBeNull();
  });
});
