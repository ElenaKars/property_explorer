import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const EU = 'ovp.dresel.systems';
const MAIN = 'overpass-api.de';
const BERLIN = { south: 52.5, west: 13.4, north: 52.501, east: 13.402 };
const NEW_YORK = { south: 40.7, west: -74.01, north: 40.705, east: -74.0 };

const json = (body, status = 200) => () => new Response(JSON.stringify(body), { status });
const text = (status) => () => new Response('error page', { status });
const okBody = {
  osm3s: { timestamp_osm_base: '2026-11-16T10:00:00Z' },
  elements: [{ type: 'way', id: 1 }],
};

let api;
let calls;

// Route mocked fetch calls by host. A handler is a function returning a
// Response, or an Error to throw (network failure).
function route(handlers) {
  calls = [];
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url, options) => {
      const host = new URL(url).host;
      calls.push({ host, body: String(options?.body ?? '') });
      const handler = handlers[host];
      if (handler instanceof Error) throw handler;
      return handler(options);
    }),
  );
}

beforeEach(async () => {
  // Fresh module state (cache, cooldowns, throttle) for every test.
  vi.resetModules();
  vi.useFakeTimers({ toFake: ['Date'] });
  const { OVERPASS } = await import('../config.js');
  OVERPASS.minIntervalMs = 0; // request spacing is covered by the Nominatim tests
  api = await import('./overpass.js');
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('buildBuildingQuery', () => {
  it('queries building ways and multipolygon relations in south,west,north,east order', () => {
    const query = api.buildBuildingQuery(BERLIN);
    expect(query).toContain('[out:json][timeout:25];');
    expect(query).toContain('way["building"]["building"!="no"](52.5000000,13.4000000,52.5010000,13.4020000);');
    expect(query).toContain('relation["building"]["building"!="no"]["type"="multipolygon"]');
    expect(query).toContain('out geom;');
  });
});

describe('fetchBuildings', () => {
  it('uses the primary instance and returns elements, timestamp and source', async () => {
    route({ [EU]: json(okBody) });
    const result = await api.fetchBuildings(BERLIN);

    expect(calls.map((c) => c.host)).toEqual([EU]);
    expect(decodeURIComponent(calls[0].body)).toContain('way["building"]');
    expect(result.elements).toHaveLength(1);
    expect(result.timestamp).toBe('2026-11-16T10:00:00Z');
    expect(result.source).toMatch(/Europe/);
  });

  it.each([
    ['HTTP 504', text(504)],
    ['HTTP 429', text(429)],
    ['a network error', new TypeError('fetch failed')],
    ['a server-side timeout remark', json({ elements: [], remark: 'runtime error: Query timed out in "query" at line 3 after 26 seconds.' })],
  ])('falls back to the main instance after %s', async (_, failure) => {
    route({ [EU]: failure, [MAIN]: json(okBody) });
    const result = await api.fetchBuildings(BERLIN);

    expect(calls.map((c) => c.host)).toEqual([EU, MAIN]);
    expect(result.source).toMatch(/main/);
  });

  it.each([
    ['HTTP 400', text(400), /rejected/],
    ['an out-of-memory remark', json({ elements: [], remark: 'runtime error: Query run out of memory' }), /too much data/],
  ])('does not fall back after %s', async (_, failure, message) => {
    route({ [EU]: failure, [MAIN]: json(okBody) });
    await expect(api.fetchBuildings(BERLIN)).rejects.toThrow(message);
    expect(calls.map((c) => c.host)).toEqual([EU]);
  });

  it('reports the last error when every instance fails', async () => {
    route({ [EU]: text(503), [MAIN]: text(504) });
    await expect(api.fetchBuildings(BERLIN)).rejects.toMatchObject({
      name: 'OverpassError',
      message: expect.stringMatching(/overloaded/),
    });
  });

  it('pauses an instance for 30 s after HTTP 429', async () => {
    route({ [EU]: text(429), [MAIN]: json(okBody) });
    await api.fetchBuildings(BERLIN);

    route({ [EU]: json(okBody), [MAIN]: json(okBody) });
    await api.fetchBuildings({ ...BERLIN, north: 52.5011 });
    expect(calls.map((c) => c.host)).toEqual([MAIN]); // EU skipped during cooldown

    vi.advanceTimersByTime(31_000);
    await api.fetchBuildings({ ...BERLIN, north: 52.5012 });
    expect(calls.map((c) => c.host)).toEqual([MAIN, EU]); // EU used again
  });

  it('sends boxes outside Europe to the worldwide instance only', async () => {
    route({ [EU]: json(okBody), [MAIN]: json(okBody) });
    await api.fetchBuildings(NEW_YORK);
    expect(calls.map((c) => c.host)).toEqual([MAIN]);
  });

  it('answers a repeated query from the cache', async () => {
    route({ [EU]: json(okBody) });
    await api.fetchBuildings(BERLIN);
    await api.fetchBuildings(BERLIN);
    expect(calls).toHaveLength(1);
  });

  // Behaves like real fetch: rejects with the signal's reason on abort.
  const hangUntilAborted = ({ signal }) =>
    new Promise((_, reject) => {
      if (signal.aborted) reject(signal.reason);
      signal.addEventListener('abort', () => reject(signal.reason));
    });

  it('sends nothing when cancelled before the request starts', async () => {
    route({ [EU]: json(okBody), [MAIN]: json(okBody) });
    const controller = new AbortController();
    const pending = api.fetchBuildings(BERLIN, { signal: controller.signal });
    controller.abort();

    await expect(pending).rejects.toMatchObject({ name: 'AbortError' });
    expect(calls).toHaveLength(0);
  });

  it('rejects with the abort reason mid-request and does not try another instance', async () => {
    route({ [EU]: hangUntilAborted, [MAIN]: json(okBody) });
    const controller = new AbortController();
    const pending = api.fetchBuildings(BERLIN, { signal: controller.signal });
    await vi.waitFor(() => expect(calls).toHaveLength(1));
    controller.abort();

    await expect(pending).rejects.toMatchObject({ name: 'AbortError' });
    expect(calls.map((c) => c.host)).toEqual([EU]);
  });
});

describe('parseOverpassResponse', () => {
  it('rejects a response without an elements array', () => {
    expect(() => api.parseOverpassResponse({ foo: 1 })).toThrow(/Unexpected response/);
  });

  it('accepts a missing timestamp', () => {
    expect(api.parseOverpassResponse({ elements: [] })).toEqual({ elements: [], timestamp: null });
  });
});
