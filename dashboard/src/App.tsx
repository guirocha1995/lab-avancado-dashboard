import { Routes, Route, Navigate } from 'react-router-dom';
import { Layout } from './components/Layout';
import { useEventStream } from './services/sse';
import Dashboard from './pages/Dashboard';
import Catalog from './pages/Catalog';
import Orders from './pages/Orders';
import CreateOrder from './pages/CreateOrder';
import EventStream from './pages/EventStream';
import Pipeline from './pages/Pipeline';

export default function App() {
  const { events, connected, clientCount, clearEvents } = useEventStream();

  return (
    <Routes>
      <Route element={<Layout connected={connected} clientCount={clientCount} />}>
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        <Route
          path="/dashboard"
          element={<Dashboard events={events} connected={connected} />}
        />
        <Route path="/catalogo" element={<Catalog />} />
        <Route path="/pedidos" element={<Orders events={events} />} />
        <Route path="/pedidos/novo" element={<CreateOrder />} />
        <Route
          path="/eventos"
          element={
            <EventStream
              events={events}
              connected={connected}
              clientCount={clientCount}
              onClear={clearEvents}
            />
          }
        />
        <Route
          path="/pipeline"
          element={<Pipeline events={events} connected={connected} />}
        />
      </Route>
    </Routes>
  );
}
