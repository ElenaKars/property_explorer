import { useCallback, useState } from 'react';
import MapView from './components/MapView.jsx';
import Sidebar from './components/Sidebar.jsx';
import { createSelection } from './lib/selection.js';

export default function App() {
  const [selectedPlace, setSelectedPlace] = useState(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [selection, setSelection] = useState(null);

  const startDrawing = useCallback(() => setIsDrawing(true), []);
  const cancelDrawing = useCallback(() => setIsDrawing(false), []);
  const clearSelection = useCallback(() => setSelection(null), []);
  const handleAreaDrawn = useCallback((bounds) => {
    setIsDrawing(false);
    setSelection(createSelection(bounds));
  }, []);

  return (
    <div className="layout">
      <Sidebar
        onPlaceSelect={setSelectedPlace}
        selectedPlaceId={selectedPlace?.id}
        area={{
          selection,
          isDrawing,
          onStartDrawing: startDrawing,
          onCancelDrawing: cancelDrawing,
          onClear: clearSelection,
        }}
      />
      <main className="layout__map">
        <MapView
          selectedPlace={selectedPlace}
          selection={selection}
          isDrawing={isDrawing}
          onAreaDrawn={handleAreaDrawn}
          onDrawCancel={cancelDrawing}
        />
      </main>
    </div>
  );
}
