import { MapContainer, ScaleControl, TileLayer } from 'react-leaflet';
import { DEFAULT_CITY, MAP_LIMITS, TILE_LAYER } from '../config.js';

export default function MapView() {
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
    </MapContainer>
  );
}
