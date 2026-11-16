import { useEffect, useRef, useState } from 'react';
import { Rectangle, useMap } from 'react-leaflet';
import L from 'leaflet';

// Drags shorter than this (in screen pixels) count as a click and are ignored.
const MIN_DRAG_PX = 6;

const DRAFT_STYLE = { color: '#2563eb', weight: 2, dashArray: '6 4', fillOpacity: 0.08 };

/**
 * While `active`, a pointer drag on the map draws a rectangle.
 * Uses native Pointer Events so mouse, pen and touch all work.
 * Calls onComplete({ south, west, north, east }) or onCancel() (Escape).
 */
export default function RectangleTool({ active, onComplete, onCancel }) {
  const map = useMap();
  const [draft, setDraft] = useState(null);
  const callbacksRef = useRef({ onComplete, onCancel });

  useEffect(() => {
    callbacksRef.current = { onComplete, onCancel };
  }, [onComplete, onCancel]);

  useEffect(() => {
    if (!active) return undefined;

    const container = map.getContainer();
    const handlers = ['dragging', 'doubleClickZoom', 'touchZoom', 'boxZoom'];
    const wasEnabled = handlers.map((name) => map[name]?.enabled());
    handlers.forEach((name) => map[name]?.disable());
    container.classList.add('is-drawing');

    let start = null; // { pointerId, latlng, point }

    const toDraft = (a, b) => [
      [a.lat, a.lng],
      [b.lat, b.lng],
    ];

    function handlePointerDown(event) {
      if (start) return; // ignore extra fingers
      if (event.pointerType === 'mouse' && event.button !== 0) return;
      if (event.target.closest('.leaflet-control')) return;

      event.preventDefault();
      container.setPointerCapture?.(event.pointerId);
      const latlng = map.mouseEventToLatLng(event);
      start = { pointerId: event.pointerId, latlng, point: map.mouseEventToContainerPoint(event) };
      setDraft(toDraft(latlng, latlng));
    }

    function handlePointerMove(event) {
      if (!start || event.pointerId !== start.pointerId) return;
      setDraft(toDraft(start.latlng, map.mouseEventToLatLng(event)));
    }

    function handlePointerUp(event) {
      if (!start || event.pointerId !== start.pointerId) return;
      const { latlng, point } = start;
      start = null;
      setDraft(null);

      const endPoint = map.mouseEventToContainerPoint(event);
      if (endPoint.distanceTo(point) < MIN_DRAG_PX) return;

      const bounds = L.latLngBounds(latlng, map.mouseEventToLatLng(event));
      callbacksRef.current.onComplete({
        south: bounds.getSouth(),
        west: bounds.getWest(),
        north: bounds.getNorth(),
        east: bounds.getEast(),
      });
    }

    function handlePointerCancel(event) {
      if (!start || event.pointerId !== start.pointerId) return;
      start = null;
      setDraft(null);
    }

    function handleKeyDown(event) {
      if (event.key !== 'Escape') return;
      start = null;
      setDraft(null);
      callbacksRef.current.onCancel();
    }

    container.addEventListener('pointerdown', handlePointerDown);
    container.addEventListener('pointermove', handlePointerMove);
    container.addEventListener('pointerup', handlePointerUp);
    container.addEventListener('pointercancel', handlePointerCancel);
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      container.removeEventListener('pointerdown', handlePointerDown);
      container.removeEventListener('pointermove', handlePointerMove);
      container.removeEventListener('pointerup', handlePointerUp);
      container.removeEventListener('pointercancel', handlePointerCancel);
      document.removeEventListener('keydown', handleKeyDown);
      container.classList.remove('is-drawing');
      handlers.forEach((name, i) => {
        if (wasEnabled[i]) map[name]?.enable();
      });
      setDraft(null);
    };
  }, [active, map]);

  return draft ? <Rectangle bounds={draft} pathOptions={DRAFT_STYLE} interactive={false} /> : null;
}
