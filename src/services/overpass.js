// Overpass API client for building footprints.
//
// Usage guidance (https://wiki.openstreetmap.org/wiki/Overpass_API):
// - one query per analysis, small bounding boxes only (size capped in config)
// - no parallel requests; consecutive requests are spaced out
// - after HTTP 429/406, pause that instance (cooldown) instead of retrying
// - results are cached in memory

import { OVERPASS } from '../config.js';
import { createThrottle } from '../lib/throttle.js';

const MAX_CACHE_ENTRIES = 10;
const cache = new Map();
const cooldownUntil = new Map(); // endpoint url -> epoch ms
const reserveSlot = createThrottle(OVERPASS.minIntervalMs);

export class OverpassError extends Error {
  constructor(message, { retryable = false, status, cause } = {}) {
    super(message, { cause });
    this.name = 'OverpassError';
    this.retryable = retryable;
    this.status = status;
  }
}

/** Overpass QL for building outlines (ways and multipolygon relations) in a bbox. */
export function buildBuildingQuery(
  { south, west, north, east },
  timeoutSec = OVERPASS.serverTimeoutSec,
) {
  const bbox = [south, west, north, east].map((v) => v.toFixed(7)).join(',');
  return [
    `[out:json][timeout:${timeoutSec}];`,
    '(',
    `  way["building"]["building"!="no"](${bbox});`,
    `  relation["building"]["building"!="no"]["type"="multipolygon"](${bbox});`,
    ');',
    'out geom;',
  ].join('\n');
}

function covers(coverage, { south, west, north, east }) {
  if (!coverage) return true;
  return (
    south >= coverage.south &&
    north <= coverage.north &&
    west >= coverage.west &&
    east <= coverage.east
  );
}

function messageForStatus(status) {
  if (status === 429 || status === 406) {
    return 'The Overpass server is busy with other requests. Please wait 30 seconds and retry.';
  }
  if (status === 504 || status === 503 || status === 502) {
    return 'The Overpass server is overloaded right now. Please retry in a minute.';
  }
  if (status === 400) {
    return 'The Overpass server rejected the building query.';
  }
  return `The building request failed (HTTP ${status}).`;
}

/** Validate an Overpass JSON response, including errors reported in `remark`. */
export function parseOverpassResponse(data) {
  if (!data || !Array.isArray(data.elements)) {
    throw new OverpassError('Unexpected response from the Overpass server.', { retryable: true });
  }

  // Overpass reports runtime errors with HTTP 200 and a `remark`; the
  // elements are then incomplete, so never compute results from them.
  if (typeof data.remark === 'string' && /error/i.test(data.remark)) {
    if (/memory/i.test(data.remark)) {
      throw new OverpassError(
        'This area contains too much data for the server. Try a smaller rectangle.',
      );
    }
    if (/timed out|timeout/i.test(data.remark)) {
      throw new OverpassError(
        'The building query timed out on the server. Try a smaller area or retry later.',
        { retryable: true },
      );
    }
    throw new OverpassError(`The Overpass server reported an error: ${data.remark}`, {
      retryable: true,
    });
  }

  return {
    elements: data.elements,
    timestamp: data.osm3s?.timestamp_osm_base ?? null,
  };
}

async function queryEndpoint(endpoint, query, signal) {
  const timeout = AbortSignal.timeout(OVERPASS.requestTimeoutMs);
  const combined = signal ? AbortSignal.any([signal, timeout]) : timeout;

  let data;
  try {
    const response = await fetch(endpoint.url, {
      method: 'POST',
      body: new URLSearchParams({ data: query }),
      signal: combined,
    });

    if (!response.ok) {
      const { status } = response;
      if (status === 429 || status === 406) {
        cooldownUntil.set(endpoint.url, Date.now() + OVERPASS.cooldownMs);
      }
      throw new OverpassError(messageForStatus(status), {
        status,
        retryable: status === 429 || status === 406 || status >= 500,
      });
    }

    data = await response.json();
  } catch (err) {
    if (signal?.aborted) throw signal.reason;
    if (err instanceof OverpassError) throw err;
    if (err?.name === 'TimeoutError') {
      throw new OverpassError(
        'The Overpass server took too long to respond. Please retry later.',
        { retryable: true, cause: err },
      );
    }
    if (err instanceof SyntaxError) {
      throw new OverpassError('Unexpected response from the Overpass server.', {
        retryable: true,
        cause: err,
      });
    }
    throw new OverpassError(
      'Could not reach the Overpass server. Check your internet connection.',
      { retryable: true, cause: err },
    );
  }

  return parseOverpassResponse(data);
}

/**
 * Fetch building outlines inside `bounds`.
 * @returns {Promise<{ elements: object[], timestamp: string|null, source: string }>}
 * Rejects with the abort reason when `signal` aborts, otherwise with OverpassError.
 */
export async function fetchBuildings(bounds, { signal } = {}) {
  const query = buildBuildingQuery(bounds);
  const cached = cache.get(query);
  if (cached) return cached;

  const candidates = OVERPASS.endpoints.filter((endpoint) => covers(endpoint.coverage, bounds));
  let lastError = null;

  for (const endpoint of candidates) {
    const coolingMs = (cooldownUntil.get(endpoint.url) ?? 0) - Date.now();
    if (coolingMs > 0) {
      lastError = new OverpassError(
        `The Overpass server is busy. Please wait ${Math.ceil(coolingMs / 1000)} seconds and retry.`,
        { retryable: true },
      );
      continue;
    }

    await reserveSlot(signal);
    signal?.throwIfAborted(); // cancelled before the request was sent

    try {
      const result = { ...(await queryEndpoint(endpoint, query, signal)), source: endpoint.name };
      if (cache.size >= MAX_CACHE_ENTRIES) cache.delete(cache.keys().next().value);
      cache.set(query, result);
      return result;
    } catch (err) {
      if (signal?.aborted || !(err instanceof OverpassError) || !err.retryable) throw err;
      lastError = err;
    }
  }

  throw lastError ?? new OverpassError('No Overpass server is configured for this area.');
}
