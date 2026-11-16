import { useCallback, useEffect, useState } from 'react';
import { fetchBuildings } from '../services/overpass.js';

const IDLE = { status: 'idle', data: null, error: null };
const LOADING = { status: 'loading', data: null, error: null };

/**
 * Loads building outlines for a valid selection.
 * status: 'idle' | 'loading' | 'success' | 'error'
 *
 * The stored result is tagged with the bounds and attempt it belongs to;
 * anything else is derived as "loading", so the effect never has to reset
 * state synchronously and stale responses are ignored.
 */
export function useBuildingData(selection) {
  const bounds = selection && !selection.error ? selection.bounds : null;
  const [attempt, setAttempt] = useState(0);
  const [result, setResult] = useState({ bounds: null, attempt: 0, ...IDLE });

  useEffect(() => {
    if (!bounds) return undefined;

    const controller = new AbortController();
    const settle = (next) => {
      if (!controller.signal.aborted) setResult({ bounds, attempt, ...next });
    };

    // Deferred start: React StrictMode mounts effects twice in development,
    // and the first run is cleaned up before any request is sent.
    const timer = setTimeout(async () => {
      try {
        const data = await fetchBuildings(bounds, { signal: controller.signal });
        settle({ status: 'success', data, error: null });
      } catch (err) {
        settle({
          status: 'error',
          data: null,
          error: err?.message || 'Loading buildings failed. Please try again.',
        });
      }
    }, 0);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [bounds, attempt]);

  const retry = useCallback(() => setAttempt((n) => n + 1), []);

  let state = IDLE;
  if (bounds) {
    const isCurrent = result.bounds === bounds && result.attempt === attempt;
    state = isCurrent ? result : LOADING;
  }

  return { status: state.status, data: state.data, error: state.error, retry };
}
