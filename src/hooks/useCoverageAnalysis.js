import { useMemo } from 'react';
import { analyzeCoverage, summarizeExclusions } from '../lib/analysis.js';
import { osmToBuildingFeatures } from '../lib/osm.js';

/** Derive footprint/coverage figures once building data has loaded. */
export function useCoverageAnalysis(selection, buildings) {
  const { status, data } = buildings;

  return useMemo(() => {
    if (status !== 'success' || !data || !selection) return null;
    const { features, excludedFeatures, skipped } = osmToBuildingFeatures(data.elements);
    return {
      ...analyzeCoverage(features, selection.bounds),
      skipped,
      excluded: summarizeExclusions(excludedFeatures, selection.bounds),
    };
  }, [status, data, selection]);
}
