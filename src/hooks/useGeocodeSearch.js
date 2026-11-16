import { useCallback, useEffect, useRef, useState } from 'react';
import { searchPlaces } from '../services/nominatim.js';

const INITIAL_STATE = { status: 'idle', query: '', results: [], error: null };

/**
 * Submit-driven place search. A new search cancels the previous one, and
 * stale responses never overwrite newer state.
 * status: 'idle' | 'loading' | 'success' | 'error'
 */
export function useGeocodeSearch() {
  const [state, setState] = useState(INITIAL_STATE);
  const controllerRef = useRef(null);

  useEffect(() => () => controllerRef.current?.abort(), []);

  const search = useCallback(async (query) => {
    controllerRef.current?.abort();
    const controller = new AbortController();
    controllerRef.current = controller;

    setState({ status: 'loading', query, results: [], error: null });

    try {
      const results = await searchPlaces(query, { signal: controller.signal });
      if (controller.signal.aborted) return;
      setState({ status: 'success', query, results, error: null });
    } catch (err) {
      if (controller.signal.aborted) return;
      setState({
        status: 'error',
        query,
        results: [],
        error: err?.message || 'Search failed. Please try again.',
      });
    }
  }, []);

  return { ...state, search };
}
