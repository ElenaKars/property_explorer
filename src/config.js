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

export const ANALYSIS = {
  // Largest rectangle accepted for analysis. Keeps Overpass queries small
  // and fair to the shared public servers.
  maxAreaM2: 1_000_000, // 1 km² = 100 ha
};

// Overpass API instances, tried in order. Only a retryable failure (busy,
// server error, timeout, network) moves on to the next one; requests are
// never sent in parallel. See https://wiki.openstreetmap.org/wiki/Overpass_API
export const OVERPASS = {
  endpoints: [
    {
      name: 'Overpass Europe (dresel.systems)',
      url: 'https://ovp.dresel.systems/api/interpreter',
      // This instance only holds European data.
      coverage: { south: 34, west: -25, north: 72, east: 45 },
    },
    {
      name: 'Overpass main instance (overpass-api.de)',
      url: 'https://overpass-api.de/api/interpreter',
      coverage: null, // worldwide
    },
  ],
  serverTimeoutSec: 25, // [timeout:…] sent with the query
  requestTimeoutMs: 45000, // includes time waiting in the server's queue
  minIntervalMs: 1000,
  cooldownMs: 30000, // pause an instance after HTTP 429/406, per its policy
};
