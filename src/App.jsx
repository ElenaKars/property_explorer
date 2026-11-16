import MapView from './components/MapView.jsx';
import Sidebar from './components/Sidebar.jsx';

export default function App() {
  return (
    <div className="layout">
      <Sidebar />
      <main className="layout__map">
        <MapView />
      </main>
    </div>
  );
}
