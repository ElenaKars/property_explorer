// Central app configuration. Keep public-API settings here so they are easy
// to review against each provider's usage policy.

export const DEFAULT_CITY = {
  name: 'Berlin',
  center: [52.5163, 13.3777], // [lat, lng], around Brandenburger Tor
  zoom: 16,
};

export const MAP_LIMITS = {
  minZoom: 5,
  maxZoom: 19,
};

// OpenStreetMap standard tiles. Fine for a low-traffic demo; see
// https://operations.osmfoundation.org/policies/tiles/ before heavier use.
export const TILE_LAYER = {
  url: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
  attribution:
    '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
  maxZoom: 19,
};

// Nominatim geocoding. Policy: https://operations.osmfoundation.org/policies/nominatim/
export const GEOCODER = {
  endpoint: 'https://nominatim.openstreetmap.org/search',
  countryCodes: 'de',
  language: 'de,en',
  resultLimit: 5,
  minQueryLength: 3,
  minIntervalMs: 1100, // policy maximum is 1 request/second; keep a margin
  timeoutMs: 10000,
};

// Zoom used when focusing a search result that has no bounding box.
export const PLACE_ZOOM = 17;
