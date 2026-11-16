import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const sample = [
  {
    place_id: 135997993,
    lat: '51.3388188',
    lon: '12.3806984',
    category: 'place',
    type: 'square',
    display_name: 'Augustusplatz, Zentrum, Mitte, Leipzig, Sachsen, Deutschland',
    boundingbox: ['51.3380139', '51.3401050', '12.3788113', '12.3818072'],
  },
];

let api;
let fetchMock;

beforeEach(async () => {
  vi.resetModules(); // fresh cache and throttle per test
  vi.useFakeTimers();
  fetchMock = vi.fn(async () => new Response(JSON.stringify(sample)));
  vi.stubGlobal('fetch', fetchMock);
  api = await import('./nominatim.js');
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('parseResults', () => {
  it('maps Nominatim jsonv2 fields and reorders the bounding box for Leaflet', () => {
    expect(api.parseResults(sample)).toEqual([
      {
        id: '135997993',
        label: 'Augustusplatz, Zentrum, Mitte, Leipzig, Sachsen, Deutschland',
        lat: 51.3388188,
        lng: 12.3806984,
        category: 'place',
        type: 'square',
        bounds: [
          [51.3380139, 12.3788113],
          [51.340105, 12.3818072],
        ],
      },
    ]);
  });

  it('drops results without valid coordinates and tolerates missing bounds', () => {
    const results = api.parseResults([
      { place_id: 1, lat: 'x', lon: '1' },
      { place_id: 2, lat: '52.5', lon: '13.4' },
    ]);
    expect(results).toHaveLength(1);
    expect(results[0].bounds).toBeNull();
  });

  it('rejects a non-array response', () => {
    expect(() => api.parseResults({ error: 'x' })).toThrow(/Unexpected response/);
  });
});

describe('searchPlaces', () => {
  it('searches Germany only, in jsonv2 format', async () => {
    await api.searchPlaces('Augustusplatz Leipzig');
    const url = new URL(fetchMock.mock.calls[0][0]);
    expect(url.origin + url.pathname).toBe('https://nominatim.openstreetmap.org/search');
    expect(url.searchParams.get('q')).toBe('Augustusplatz Leipzig');
    expect(url.searchParams.get('countrycodes')).toBe('de');
    expect(url.searchParams.get('format')).toBe('jsonv2');
  });

  it('spaces consecutive requests at least 1.1 s apart (usage policy)', async () => {
    const first = api.searchPlaces('Berlin');
    const second = api.searchPlaces('Hamburg');
    await vi.advanceTimersByTimeAsync(0);
    expect(fetchMock).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(1099);
    expect(fetchMock).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(1);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    await Promise.all([first, second]);
  });

  it('answers repeated queries from the cache, ignoring case and spacing', async () => {
    await api.searchPlaces('Augustusplatz Leipzig');
    await api.searchPlaces('  augustusplatz   LEIPZIG ');
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it.each([
    [429, /too many requests/],
    [503, /temporarily unavailable/],
  ])('explains HTTP %i', async (status, message) => {
    fetchMock.mockResolvedValueOnce(new Response('', { status }));
    await expect(api.searchPlaces('Berlin')).rejects.toThrow(message);
  });

  it('explains network failures', async () => {
    fetchMock.mockRejectedValueOnce(new TypeError('fetch failed'));
    await expect(api.searchPlaces('Berlin')).rejects.toThrow(/Could not reach/);
  });

  it('rejects with AbortError when cancelled while waiting for a slot', async () => {
    await api.searchPlaces('Berlin'); // occupies the current slot
    const controller = new AbortController();
    const pending = api.searchPlaces('Hamburg', { signal: controller.signal });
    controller.abort();
    await expect(pending).rejects.toMatchObject({ name: 'AbortError' });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
