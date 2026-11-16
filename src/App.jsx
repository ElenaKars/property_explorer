import { useState } from 'react';
import MapView from './components/MapView.jsx';
import Sidebar from './components/Sidebar.jsx';

export default function App() {
  const [selectedPlace, setSelectedPlace] = useState(null);

  return (
    <div className="layout">
      <Sidebar onPlaceSelect={setSelectedPlace} selectedPlaceId={selectedPlace?.id} />
      <main className="layout__map">
        <MapView selectedPlace={selectedPlace} />
      </main>
    </div>
  );
}
