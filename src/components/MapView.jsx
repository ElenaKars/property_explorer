import { useEffect } from 'react';
import { MapContainer, Marker, Popup, ScaleControl, TileLayer, useMap } from 'react-leaflet';
import { DEFAULT_CITY, MAP_LIMITS, PLACE_ZOOM, TILE_LAYER } from '../config.js';

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

export default function MapView({ selectedPlace }) {
  return (
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
    </MapContainer>
  );
}
