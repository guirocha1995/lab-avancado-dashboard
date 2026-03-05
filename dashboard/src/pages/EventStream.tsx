import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Activity,
  Filter,
  Trash2,
  ArrowDown,
  ArrowUp,
  Plus,
  MessageSquare,
  Zap,
  Radio,
  Server,
  Code,
  Shield,
  Workflow,
  Cog,
} from 'lucide-react';
import { EventCard } from '../components/EventCard';
import type { EventLogEntry } from '../types';

type SourceFilter = 'all' | 'service-bus' | 'event-grid' | 'event-hubs' | 'app-service' | 'functions' | 'apim' | 'logic-app' | 'durable';
type SeverityFilter = 'all' | 'info' | 'success' | 'warning' | 'error';

const sourceOptions: { key: SourceFilter; label: string; icon: React.FC<{ size?: number; className?: string }> }[] = [
  { key: 'all', label: 'Todos', icon: Filter },
  { key: 'service-bus', label: 'Service Bus', icon: MessageSquare },
  { key: 'event-grid', label: 'Event Grid', icon: Zap },
  { key: 'event-hubs', label: 'Event Hubs', icon: Radio },
  { key: 'app-service', label: 'App Service', icon: Server },
  { key: 'functions', label: 'Functions', icon: Code },
  { key: 'apim', label: 'APIM', icon: Shield },
  { key: 'logic-app', label: 'Logic App', icon: Workflow },
  { key: 'durable', label: 'Durable Functions', icon: Cog },
];

const severityOptions: { key: SeverityFilter; label: string; color: string }[] = [
  { key: 'all', label: 'Todos', color: 'bg-gray-200' },
  { key: 'info', label: 'Info', color: 'bg-blue-500' },
  { key: 'success', label: 'Sucesso', color: 'bg-green-500' },
  { key: 'warning', label: 'Aviso', color: 'bg-amber-500' },
  { key: 'error', label: 'Erro', color: 'bg-red-500' },
];

const severityDotColor: Record<string, string> = {
  info: 'severity-dot-info',
  success: 'severity-dot-success',
  warning: 'severity-dot-warning',
  error: 'severity-dot-error',
};

interface EventStreamProps {
  events: EventLogEntry[];
  connected: boolean;
  clientCount: number;
  onClear: () => void;
}

const EventStream: React.FC<EventStreamProps> = ({ events, connected, clientCount, onClear }) => {
  const navigate = useNavigate();
  const [sourceFilter, setSourceFilter] = useState<SourceFilter>('all');
  const [severityFilter, setSeverityFilter] = useState<SeverityFilter>('all');
  const [eventTypeFilter, setEventTypeFilter] = useState('');
  const [autoScroll, setAutoScroll] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);

  const filteredEvents = useMemo(() => {
    return events.filter((e) => {
      if (sourceFilter !== 'all') {
        if (sourceFilter === 'apim') {
          if (!e.source.startsWith('apim')) return false;
        } else if (sourceFilter === 'logic-app') {
          if (!e.source.startsWith('logic-app')) return false;
        } else if (sourceFilter === 'durable') {
          if (!e.source.startsWith('durable-')) return false;
        } else if (e.source !== sourceFilter) {
          return false;
        }
      }
      if (severityFilter !== 'all' && e.severity !== severityFilter) return false;
      if (eventTypeFilter && !e.eventType.toLowerCase().includes(eventTypeFilter.toLowerCase())) return false;
      return true;
    });
  }, [events, sourceFilter, severityFilter, eventTypeFilter]);

  const eventTypes = useMemo(() => {
    const types = new Set(events.map((e) => e.eventType));
    return Array.from(types).sort();
  }, [events]);

  // Auto-scroll to top (newest) when new events arrive
  useEffect(() => {
    if (autoScroll && scrollRef.current) {
      scrollRef.current.scrollTop = 0;
    }
  }, [filteredEvents.length, autoScroll]);

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)]">
      {/* Header bar */}
      <div className="px-4 md:px-6 py-4 bg-white border-b border-gray-200 flex-shrink-0">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-3">
            <Activity size={24} className="text-azure-500" />
            <div>
              <h1 className="text-xl font-bold text-gray-800">Eventos em Tempo Real</h1>
              <p className="text-xs text-gray-500">
                {filteredEvents.length} evento{filteredEvents.length !== 1 ? 's' : ''}
                {' | '}
                <span className={connected ? 'text-green-600' : 'text-red-500'}>
                  {clientCount} conectado{clientCount !== 1 ? 's' : ''}
                </span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setAutoScroll(!autoScroll)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                autoScroll
                  ? 'bg-azure-50 text-azure-600 border-azure-200'
                  : 'bg-gray-50 text-gray-500 border-gray-200'
              }`}
            >
              {autoScroll ? <ArrowUp size={12} /> : <ArrowDown size={12} />}
              Auto-scroll {autoScroll ? 'ON' : 'OFF'}
            </button>
            <button
              onClick={onClear}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border border-gray-200 text-gray-500 hover:text-red-600 hover:border-red-200 transition-colors"
            >
              <Trash2 size={12} />
              Limpar
            </button>
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-3 items-center">
          {/* Source filter */}
          <div className="flex gap-1 bg-gray-100 p-1 rounded-lg">
            {sourceOptions.map((opt) => {
              const Icon = opt.icon;
              return (
                <button
                  key={opt.key}
                  onClick={() => setSourceFilter(opt.key)}
                  className={`flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${
                    sourceFilter === opt.key
                      ? 'bg-white text-gray-800 shadow-sm'
                      : 'text-gray-500 hover:text-gray-700'
                  }`}
                  title={opt.label}
                >
                  <Icon size={12} />
                  <span className="hidden md:inline">{opt.label}</span>
                </button>
              );
            })}
          </div>

          {/* Severity filter */}
          <div className="flex gap-1 bg-gray-100 p-1 rounded-lg">
            {severityOptions.map((opt) => (
              <button
                key={opt.key}
                onClick={() => setSeverityFilter(opt.key)}
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${
                  severityFilter === opt.key
                    ? 'bg-white text-gray-800 shadow-sm'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                {opt.key !== 'all' && (
                  <span className={`w-2 h-2 rounded-full ${opt.color}`} />
                )}
                {opt.label}
              </button>
            ))}
          </div>

          {/* Event type filter */}
          <div className="flex-1 min-w-[200px]">
            <select
              value={eventTypeFilter}
              onChange={(e) => setEventTypeFilter(e.target.value)}
              className="w-full px-3 py-1.5 border border-gray-200 rounded-lg text-xs text-gray-600 focus:outline-none focus:ring-2 focus:ring-azure-500"
            >
              <option value="">Todos os tipos de evento</option>
              {eventTypes.map((type) => (
                <option key={type} value={type}>{type}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Event feed */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto event-stream-scroll"
      >
        {filteredEvents.length > 0 ? (
          <div className="p-4 md:px-6">
            {/* Timeline with vertical line */}
            <div className="relative">
              {/* Vertical timeline line */}
              <div className="absolute left-[11px] top-2 bottom-2 w-0.5 bg-gradient-to-b from-gray-200 via-gray-300 to-gray-200" />

              <div className="space-y-3">
                {filteredEvents.map((event) => (
                  <div key={event.id} className="flex gap-3">
                    {/* Timeline dot */}
                    <div className="relative z-10 flex-shrink-0 mt-4">
                      <div
                        className={`w-[10px] h-[10px] rounded-full ring-2 ring-white ${
                          severityDotColor[event.severity] ?? 'severity-dot-info'
                        }`}
                      />
                    </div>

                    {/* Event card */}
                    <div className="flex-1 min-w-0">
                      <EventCard event={event} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center h-full text-center px-4">
            <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mb-4">
              <Activity size={36} className="text-gray-300" />
            </div>
            <h3 className="text-lg font-semibold text-gray-600 mb-1">Nenhum evento ainda</h3>
            <p className="text-sm text-gray-400 mb-4 max-w-sm">
              Crie um pedido para ver eventos fluindo aqui. Cada etapa do processamento
              gera eventos que aparecem nesta tela em tempo real.
            </p>
            <button
              onClick={() => navigate('/pedidos/novo')}
              className="flex items-center gap-2 px-4 py-2.5 bg-azure-500 text-white rounded-lg hover:bg-azure-600 transition-colors font-medium text-sm"
            >
              <Plus size={16} />
              Criar Pedido
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default EventStream;
