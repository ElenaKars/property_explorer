import SearchPanel from './SearchPanel.jsx';

export default function Sidebar({ onPlaceSelect, selectedPlaceId }) {
  return (
    <aside className="sidebar" aria-label="Analysis panel">
      <header className="sidebar__header">
        <h1 className="sidebar__title">Property Explorer</h1>
        <p className="sidebar__subtitle">
          Building footprint coverage from OpenStreetMap data
        </p>
      </header>

      <SearchPanel onSelect={onPlaceSelect} selectedId={selectedPlaceId} />

      <section className="panel" aria-labelledby="how-title">
        <h2 id="how-title" className="panel__title">How it works</h2>
        <ol className="steps">
          <li>Search for an address or city.</li>
          <li>Draw a rectangle on the map.</li>
          <li>Review footprint area and coverage.</li>
        </ol>
      </section>

      <section className="panel" aria-labelledby="results-title">
        <h2 id="results-title" className="panel__title">Analysis</h2>
        <p className="empty">No area selected yet.</p>
      </section>

      <footer className="sidebar__footer">
        <p>
          Building data from OpenStreetMap is volunteer-mapped and may be
          incomplete. It is not official cadastral data.
        </p>
      </footer>
    </aside>
  );
}
