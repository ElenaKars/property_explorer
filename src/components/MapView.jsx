import { useEffect } from 'react';
import {
  MapContainer,
  Marker,
  Popup,
  Rectangle,
  ScaleControl,
  TileLayer,
  useMap,
} from 'react-leaflet';
import { DEFAULT_CITY, MAP_LIMITS, PLACE_ZOOM, TILE_LAYER } from '../config.js';
import { toLeafletBounds } from '../lib/geometry.js';
import RectangleTool from './RectangleTool.jsx';

const SELECTION_STYLE = { color: '#2563eb', weight: 2, fillOpacity: 0.06 };
const INVALID_SELECTION_STYLE = { color: '#e11d48', weight: 2, dashArray: '4 4', fillOpacity: 0.06 };

function prefersReducedMotion() {
  return window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
}

// Moves the map to the selected search result.
function FocusPlace({ place }) {
  const map = useMap();

  useEffect(() => {
    if (!place) return;
    const animate = !prefersReducedMotion();
    if (place.bounds) {
      map.flyToBounds(place.bounds, { maxZoom: PLACE_ZOOM, animate, duration: 0.8 });
    } else {
      map.flyTo([place.lat, place.lng], PLACE_ZOOM, { animate, duration: 0.8 });
    }
  }, [map, place]);

  return null;
}

export default function MapView({
  selectedPlace,
  selection,
  isDrawing,
  onAreaDrawn,
  onDrawCancel,
}) {
  return (
    <>
      <MapContainer
        className="map"
        center={DEFAULT_CITY.center}
        zoom={DEFAULT_CITY.zoom}
        minZoom={MAP_LIMITS.minZoom}
        maxZoom={MAP_LIMITS.maxZoom}
        scrollWheelZoom
      >
        <TileLayer
          url={TILE_LAYER.url}
          attribution={TILE_LAYER.attribution}
          maxZoom={TILE_LAYER.maxZoom}
        />
        <ScaleControl position="bottomleft" imperial={false} />

        <FocusPlace place={selectedPlace} />
        {selectedPlace && (
          <Marker
            key={selectedPlace.id}
            position={[selectedPlace.lat, selectedPlace.lng]}
            alt={selectedPlace.label}
          >
            <Popup>{selectedPlace.label}</Popup>
          </Marker>
        )}

        {selection && (
          <Rectangle
            bounds={toLeafletBounds(selection.bounds)}
            pathOptions={selection.error ? INVALID_SELECTION_STYLE : SELECTION_STYLE}
            interactive={false}
          />
        )}

        <RectangleTool active={isDrawing} onComplete={onAreaDrawn} onCancel={onDrawCancel} />
      </MapContainer>

      {isDrawing && (
        <div className="map-hint" role="status">
          <span>Drag on the map to draw a rectangle.</span>
          <button type="button" className="map-hint__cancel" onClick={onDrawCancel}>
            Cancel
          </button>
        </div>
      )}
    </>
  );
}
