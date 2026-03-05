import React, { useState } from 'react';
import {
  MessageSquare,
  Zap,
  Radio,
  Server,
  Code,
  ChevronDown,
  ChevronUp,
  Shield,
  Workflow,
  Cog,
} from 'lucide-react';
import type { EventLogEntry } from '../types';

const sourceConfig: Record<string, { icon: React.FC<{ size?: number; className?: string }>; label: string; color: string }> = {
  'service-bus': { icon: MessageSquare, label: 'Service Bus', color: 'text-purple-500' },
  'event-grid': { icon: Zap, label: 'Event Grid', color: 'text-amber-500' },
  'event-hubs': { icon: Radio, label: 'Event Hubs', color: 'text-blue-500' },
  'app-service': { icon: Server, label: 'App Service', color: 'text-green-500' },
  'functions': { icon: Code, label: 'Functions', color: 'text-cyan-500' },
  'apim-gateway': { icon: Shield, label: 'APIM Gateway', color: 'text-indigo-500' },
  'durable-validateOrder': { icon: Cog, label: 'Validacao', color: 'text-teal-500' },
  'durable-reserveStock': { icon: Cog, label: 'Reserva Estoque', color: 'text-teal-500' },
  'durable-checkCredit': { icon: Cog, label: 'Verificacao Credito', color: 'text-teal-500' },
  'durable-processPayment': { icon: Cog, label: 'Pagamento', color: 'text-teal-500' },
  'durable-updateStatus': { icon: Cog, label: 'Atualizacao Status', color: 'text-teal-500' },
  'durable-notifyCompletion': { icon: Cog, label: 'Conclusao', color: 'text-teal-500' },
  'logic-app-credit': { icon: Workflow, label: 'Logic App (Credito)', color: 'text-orange-500' },
  'logic-app-stock-alert': { icon: Workflow, label: 'Logic App (Estoque)', color: 'text-orange-500' },
};

const severityBarColors: Record<string, string> = {
  info: 'bg-blue-500',
  success: 'bg-green-500',
  warning: 'bg-amber-500',
  error: 'bg-red-500',
};

interface EventCardProps {
  event: EventLogEntry;
  compact?: boolean;
}

function formatTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleTimeString('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

export const EventCard: React.FC<EventCardProps> = ({ event, compact = false }) => {
  const [expanded, setExpanded] = useState(false);
  const source = sourceConfig[event.source] ?? sourceConfig['app-service'];
  const SourceIcon = source.icon;
  const barColor = severityBarColors[event.severity] ?? severityBarColors.info;

  if (compact) {
    return (
      <div className="event-enter flex items-center gap-3 py-2 px-3 hover:bg-gray-50 rounded-lg transition-colors">
        <div className={`w-1 h-8 rounded-full ${barColor} flex-shrink-0`} />
        <span className="text-xs text-gray-400 font-mono w-16 flex-shrink-0">
          {formatTime(event.createdAt)}
        </span>
        <SourceIcon size={14} className={`${source.color} flex-shrink-0`} />
        <span className="text-sm text-gray-700 truncate flex-1">{event.eventType}</span>
        {event.orderId && (
          <span className="text-xs text-azure-500 font-mono flex-shrink-0">
            #{event.orderId.slice(0, 8)}
          </span>
        )}
      </div>
    );
  }

  return (
    <div
      className={`event-enter bg-white rounded-lg border border-gray-100 shadow-sm overflow-hidden hover:shadow-md transition-shadow`}
    >
      <div className="flex">
        {/* Severity bar */}
        <div className={`w-1.5 ${barColor} flex-shrink-0`} />

        {/* Content */}
        <div className="flex-1 p-3">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <span className="text-xs text-gray-400 font-mono flex-shrink-0">
                {formatTime(event.createdAt)}
              </span>
              <span className="text-sm font-semibold text-gray-800 truncate">
                {event.eventType}
              </span>
            </div>
            <button
              onClick={() => setExpanded(!expanded)}
              className="text-gray-400 hover:text-gray-600 flex-shrink-0 p-0.5"
            >
              {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            </button>
          </div>

          <div className="flex items-center gap-2 mt-1.5">
            <div className="flex items-center gap-1">
              <SourceIcon size={12} className={source.color} />
              <span className="text-xs text-gray-500">{source.label}</span>
            </div>
            {event.orderId && (
              <span className="text-xs bg-azure-50 text-azure-600 px-1.5 py-0.5 rounded font-mono">
                #{event.orderId.slice(0, 8)}
              </span>
            )}
            <span
              className={`text-xs px-1.5 py-0.5 rounded ${
                event.severity === 'info'
                  ? 'bg-blue-50 text-blue-600'
                  : event.severity === 'success'
                  ? 'bg-green-50 text-green-600'
                  : event.severity === 'warning'
                  ? 'bg-amber-50 text-amber-600'
                  : 'bg-red-50 text-red-600'
              }`}
            >
              {event.severity}
            </span>
          </div>

          {/* Expandable payload */}
          {expanded && (
            <div className="mt-3 bg-gray-900 rounded-md p-3 overflow-x-auto">
              <pre className="text-xs text-green-400 font-mono whitespace-pre-wrap break-all">
                {JSON.stringify(event.payload, null, 2)}
              </pre>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default EventCard;
