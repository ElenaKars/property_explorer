import { useState } from 'react';
import { GEOCODER } from '../config.js';
import { useGeocodeSearch } from '../hooks/useGeocodeSearch.js';

function splitLabel(label) {
  const [name, ...rest] = label.split(', ');
  return { name, detail: rest.join(', ') };
}

// Short human-readable kind, e.g. "Street", "Square", "City".
function placeKind({ category, type }) {
  if (category === 'highway') return 'Street';
  if (category === 'building') return 'Building';
  if (!type || type === 'yes') return null;
  const text = type.replace(/_/g, ' ');
  return text.charAt(0).toUpperCase() + text.slice(1);
}

export default function SearchPanel({ onSelect, selectedId }) {
  const [input, setInput] = useState('');
  const { status, query, results, error, search } = useGeocodeSearch();

  const trimmed = input.trim();
  const isLoading = status === 'loading';
  const canSubmit = trimmed.length >= GEOCODER.minQueryLength && !isLoading;

  function handleSubmit(event) {
    event.preventDefault();
    if (canSubmit) search(trimmed);
  }

  return (
    <section className="panel" aria-labelledby="search-title">
      <h2 id="search-title" className="panel__title">Search</h2>

      <form className="search" role="search" onSubmit={handleSubmit}>
        <label htmlFor="search-input" className="visually-hidden">
          Address or city in Germany
        </label>
        <input
          id="search-input"
          className="search__input"
          type="search"
          placeholder="Address or city, e.g. Leipzig"
          value={input}
          onChange={(event) => setInput(event.target.value)}
          autoComplete="off"
          enterKeyHint="search"
        />
        <button type="submit" className="button" disabled={!canSubmit}>
          {isLoading ? 'Searching…' : 'Search'}
        </button>
      </form>

      <div className="search__status" aria-live="polite">
        {status === 'error' && (
          <p className="message message--error" role="alert">{error}</p>
        )}
        {status === 'success' && results.length === 0 && (
          <p className="message">No places found for “{query}” in Germany.</p>
        )}
      </div>

      {status === 'success' && results.length > 0 && (
        <ul className="results" aria-label="Search results">
          {results.map((place) => {
            const { name, detail } = splitLabel(place.label);
            const kind = placeKind(place);
            const isActive = place.id === selectedId;
            return (
              <li key={place.id}>
                <button
                  type="button"
                  className={`result${isActive ? ' result--active' : ''}`}
                  aria-pressed={isActive}
                  title={place.label}
                  onClick={() => onSelect(place)}
                >
                  <span className="result__name">
                    {name}
                    {kind && <span className="result__kind">{kind}</span>}
                  </span>
                  {detail && <span className="result__detail">{detail}</span>}
                </button>
              </li>
            );
          })}
        </ul>
      )}

      <p className="credit">
        Search by{' '}
        <a href="https://nominatim.org/" target="_blank" rel="noreferrer">
          Nominatim
        </a>{' '}
        · data ©{' '}
        <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">
          OpenStreetMap
        </a>{' '}
        contributors
      </p>
    </section>
  );
}
