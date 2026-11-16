import { formatArea, formatCount, formatPercent, formatTimestamp } from '../lib/format.js';

export default function ResultsPanel({ selection, buildings, analysis }) {
  if (!selection || selection.error) return null;

  const { status, data, error, retry } = buildings;

  return (
    <section className="panel" aria-labelledby="results-title" aria-busy={status === 'loading'}>
      <h2 id="results-title" className="panel__title">Buildings</h2>

      <div aria-live="polite">
        {status === 'loading' && (
          <div className="loading">
            <span className="spinner" aria-hidden="true" />
            <div>
              <p>Loading buildings from OpenStreetMap…</p>
              <p className="hint">Public servers can take up to a minute when busy.</p>
            </div>
          </div>
        )}

        {status === 'error' && (
          <>
            <p className="message message--error" role="alert">{error}</p>
            <div className="actions">
              <button type="button" className="button" onClick={retry}>
                Retry
              </button>
            </div>
          </>
        )}

        {status === 'success' && data && analysis && (
          <>
            <dl className="stats">
              <div className="stat">
                <dt>Building coverage</dt>
                <dd>{formatPercent(analysis.coverageRatio)}</dd>
              </div>
              <div className="stat">
                <dt>Footprint area</dt>
                <dd>{formatArea(analysis.footprintAreaM2)}</dd>
              </div>
            </dl>
            <p className="hint">
              {formatCount(analysis.buildingCount, 'building')} in the area
              {analysis.clippedCount > 0 &&
                `, ${analysis.clippedCount} cut at the boundary (only the part inside counts)`}
              .
              {analysis.skipped > 0 &&
                ` ${formatCount(analysis.skipped, 'outline')} skipped because the OSM geometry is incomplete.`}
            </p>
            {formatTimestamp(data.timestamp) && (
              <p className="hint">OSM data as of {formatTimestamp(data.timestamp)}</p>
            )}
          </>
        )}
      </div>

      <p className="credit">
        Buildings via{' '}
        <a href="https://wiki.openstreetmap.org/wiki/Overpass_API" target="_blank" rel="noreferrer">
          Overpass API
        </a>
        {status === 'success' && data?.source ? ` (${data.source})` : ''} · data ©{' '}
        <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">
          OpenStreetMap
        </a>{' '}
        contributors, ODbL
      </p>
    </section>
  );
}
