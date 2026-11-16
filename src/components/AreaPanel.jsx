import { ANALYSIS } from '../config.js';
import { formatArea, formatDistance } from '../lib/format.js';

export default function AreaPanel({ selection, isDrawing, onStartDrawing, onCancelDrawing, onClear }) {
  return (
    <section className="panel" aria-labelledby="area-title">
      <h2 id="area-title" className="panel__title">Analysis area</h2>

      <div aria-live="polite">
        {isDrawing ? (
          <p className="message">
            Drag on the map to draw a rectangle. Press Esc to cancel.
          </p>
        ) : selection ? (
          <>
            <dl className="stats">
              <div className="stat">
                <dt>Size</dt>
                <dd>
                  {formatDistance(selection.widthM)} × {formatDistance(selection.heightM)}
                </dd>
              </div>
              <div className="stat">
                <dt>Area</dt>
                <dd>{formatArea(selection.areaM2)}</dd>
              </div>
            </dl>
            {selection.error && (
              <p className="message message--error" role="alert">{selection.error}</p>
            )}
          </>
        ) : (
          <p className="empty">No area selected yet.</p>
        )}
      </div>

      <div className="actions">
        {isDrawing ? (
          <button type="button" className="button button--secondary" onClick={onCancelDrawing}>
            Cancel drawing
          </button>
        ) : (
          <>
            <button type="button" className="button" onClick={onStartDrawing}>
              {selection ? 'Redraw rectangle' : 'Draw rectangle'}
            </button>
            {selection && (
              <button type="button" className="button button--secondary" onClick={onClear}>
                Clear
              </button>
            )}
          </>
        )}
      </div>

      <p className="hint">Maximum area: {formatArea(ANALYSIS.maxAreaM2)}.</p>
    </section>
  );
}
