// Nominatim geocoding client.
//
// Usage policy (https://operations.osmfoundation.org/policies/nominatim/):
// - at most 1 request per second      -> enforced by `reserveSlot` below
// - no autocomplete / search-as-you-type -> callers only search on submit
// - identify the application          -> browsers send the page origin as Referer
// - cache results                     -> in-memory cache below
// - display attribution               -> shown next to the search form

import { GEOCODER } from '../config.js';
import { createThrottle } from '../lib/throttle.js';

const MAX_CACHE_ENTRIES = 50;
const cache = new Map();
const reserveSlot = createThrottle(GEOCODER.minIntervalMs);

export class GeocodeError extends Error {
  constructor(message, { status, cause } = {}) {
    super(message, { cause });
    this.name = 'GeocodeError';
    this.status = status;
  }
}

function normalizeQuery(query) {
  return query.trim().replace(/\s+/g, ' ');
}

function rememberResult(key, results) {
  if (cache.size >= MAX_CACHE_ENTRIES) {
    cache.delete(cache.keys().next().value);
  }
  cache.set(key, results);
}

/** Convert raw Nominatim jsonv2 results into the shape the UI uses. */
export function parseResults(data) {
  if (!Array.isArray(data)) {
    throw new GeocodeError('Unexpected response from the search service.');
  }

  return data
    .map((item) => {
      // jsonv2 boundingbox: [south, north, west, east] as strings
      const box = Array.isArray(item.boundingbox) ? item.boundingbox.map(Number) : [];
      const [south, north, west, east] = box;
      const hasBounds = box.length === 4 && box.every(Number.isFinite);

      return {
        id: String(item.place_id),
        label: item.display_name ?? '',
        lat: Number(item.lat),
        lng: Number(item.lon),
        category: item.category ?? item.class ?? null,
        type: item.type ?? null,
        bounds: hasBounds ? [[south, west], [north, east]] : null,
      };
    })
    .filter((place) => Number.isFinite(place.lat) && Number.isFinite(place.lng));
}

function errorForStatus(status) {
  if (status === 429) {
    return 'The search service is receiving too many requests. Please wait a moment and try again.';
  }
  if (status >= 500) {
    return 'The search service is temporarily unavailable. Please try again later.';
  }
  return `Search failed (HTTP ${status}).`;
}

/**
 * Search places in Germany.
 * @param {string} query
 * @param {{ signal?: AbortSignal }} [options]
 * @returns {Promise<Array<{id,label,lat,lng,category,type,bounds}>>}
 * Rejects with the abort reason when `signal` is aborted, otherwise with GeocodeError.
 */
export async function searchPlaces(query, { signal } = {}) {
  const q = normalizeQuery(query);
  const key = q.toLowerCase();
  if (cache.has(key)) return cache.get(key);

  await reserveSlot(signal);
  signal?.throwIfAborted(); // cancelled before the request was sent

  const params = new URLSearchParams({
    q,
    format: 'jsonv2',
    countrycodes: GEOCODER.countryCodes,
    limit: String(GEOCODER.resultLimit),
    'accept-language': GEOCODER.language,
  });

  const timeout = AbortSignal.timeout(GEOCODER.timeoutMs);
  const combined = signal ? AbortSignal.any([signal, timeout]) : timeout;

  let response;
  try {
    response = await fetch(`${GEOCODER.endpoint}?${params}`, {
      signal: combined,
      headers: { Accept: 'application/json' },
    });
  } catch (err) {
    if (signal?.aborted) throw signal.reason;
    if (err?.name === 'TimeoutError') {
      throw new GeocodeError('The search took too long. Please try again.', { cause: err });
    }
    throw new GeocodeError(
      'Could not reach the search service. Check your internet connection.',
      { cause: err },
    );
  }

  if (!response.ok) {
    throw new GeocodeError(errorForStatus(response.status), { status: response.status });
  }

  let data;
  try {
    data = await response.json();
  } catch (err) {
    throw new GeocodeError('Unexpected response from the search service.', { cause: err });
  }

  const results = parseResults(data);
  rememberResult(key, results);
  return results;
}
