import React, { useState, useEffect, useCallback } from 'react';
import {
  Server,
  MessageSquare,
  Code,
  Zap,
  Radio,
  AlertTriangle,
  BarChart3,
  GitBranch,
  Shield,
  Workflow,
  Cog,
  CheckCircle,
  CreditCard,
  ClipboardCheck,
} from 'lucide-react';
import type { EventLogEntry } from '../types';
import type { NodeState } from '../components/PipelineNode';

interface PipelineNodeDef {
  id: string;
  icon: React.FC<{ size?: number; className?: string }>;
  label: string;
  sublabel: string;
  count: number;
  state: NodeState;
  errors: number;
  avgLatency: number;
  lastEventTime: string | null;
  matchSources: string[];
  matchEventTypes: string[];
}

const iconColor: Record<NodeState, string> = {
  idle: 'text-gray-400',
  active: 'text-azure-500',
  success: 'text-green-500',
  error: 'text-red-500',
};

const ringColor: Record<NodeState, string> = {
  idle: 'ring-gray-200 bg-gray-50',
  active: 'ring-azure-300 bg-azure-50',
  success: 'ring-green-300 bg-green-50',
  error: 'ring-red-300 bg-red-50',
};

const nodeAnimation: Record<NodeState, string> = {
  idle: '',
  active: 'node-active',
  success: 'node-success',
  error: 'node-error',
};

function formatTime(iso: string | null): string {
  if (!iso) return '--';
  return new Date(iso).toLocaleTimeString('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

const initialNodes: PipelineNodeDef[] = [
  {
    id: 'order-created',
    icon: Server,
    label: 'Pedido Criado',
    sublabel: 'App Service',
    count: 0,
    state: 'idle',
    errors: 0,
    avgLatency: 0,
    lastEventTime: null,
    matchSources: ['app-service'],
    matchEventTypes: ['order.created', 'order.received'],
  },
  {
    id: 'apim-gateway',
    icon: Shield,
    label: 'APIM Gateway',
    sublabel: 'API Management',
    count: 0,
    state: 'idle',
    errors: 0,
    avgLatency: 0,
    lastEventTime: null,
    matchSources: ['apim-gateway'],
    matchEventTypes: ['order.queued'],
  },
  {
    id: 'service-bus-queue',
    icon: MessageSquare,
    label: 'Fila Service Bus',
    sublabel: 'Queue',
    count: 0,
    state: 'idle',
    errors: 0,
    avgLatency: 0,
    lastEventTime: null,
    matchSources: ['service-bus'],
    matchEventTypes: ['queue.message.sent', 'queue.message.received', 'order.queued'],
  },
  {
    id: 'validate-order',
    icon: ClipboardCheck,
    label: 'Validacao',
    sublabel: 'Durable: validateOrder',
    count: 0,
    state: 'idle',
    errors: 0,
    avgLatency: 0,
    lastEventTime: null,
    matchSources: ['durable-validateOrder'],
    matchEventTypes: ['order.validating'],
  },
  {
    id: 'reserve-stock',
    icon: Code,
    label: 'Reserva Estoque',
    sublabel: 'Durable: reserveStock',
    count: 0,
    state: 'idle',
    errors: 0,
    avgLatency: 0,
    lastEventTime: null,
    matchSources: ['durable-reserveStock'],
    matchEventTypes: ['stock.reserving'],
  },
  {
    id: 'check-credit',
    icon: CreditCard,
    label: 'Verificacao Credito',
    sublabel: 'Durable: checkCredit',
    count: 0,
    state: 'idle',
    errors: 0,
    avgLatency: 0,
    lastEventTime: null,
    matchSources: ['durable-checkCredit'],
    matchEventTypes: ['order.credit-check'],
  },
  {
    id: 'process-payment',
    icon: Cog,
    label: 'Pagamento',
    sublabel: 'Durable: processPayment',
    count: 0,
    state: 'idle',
    errors: 0,
    avgLatency: 0,
    lastEventTime: null,
    matchSources: ['durable-processPayment'],
    matchEventTypes: ['order.payment'],
  },
  {
    id: 'update-status',
    icon: CheckCircle,
    label: 'Aprovacao',
    sublabel: 'Durable: updateStatus',
    count: 0,
    state: 'idle',
    errors: 0,
    avgLatency: 0,
    lastEventTime: null,
    matchSources: ['durable-updateStatus'],
    matchEventTypes: ['order.approved'],
  },
  {
    id: 'service-bus-topic',
    icon: MessageSquare,
    label: 'Topico Service Bus',
    sublabel: 'Topic',
    count: 0,
    state: 'idle',
    errors: 0,
    avgLatency: 0,
    lastEventTime: null,
    matchSources: ['service-bus'],
    matchEventTypes: ['topic.message.published', 'order.published', 'order.completed'],
  },
];

const branchANodes: PipelineNodeDef[] = [
  {
    id: 'notify-stock',
    icon: Code,
    label: 'Estoque',
    sublabel: 'Function: notifyStock',
    count: 0,
    state: 'idle',
    errors: 0,
    avgLatency: 0,
    lastEventTime: null,
    matchSources: ['function-notifyStock'],
    matchEventTypes: ['stock.checked', 'stock.updated', 'stock.low'],
  },
  {
    id: 'event-grid',
    icon: Zap,
    label: 'Event Grid',
    sublabel: 'Low Stock Alert',
    count: 0,
    state: 'idle',
    errors: 0,
    avgLatency: 0,
    lastEventTime: null,
    matchSources: ['event-grid', 'function-handleStockAlert'],
    matchEventTypes: ['stock.low', 'stock.alert', 'inventory.low-stock'],
  },
  {
    id: 'handle-alert',
    icon: AlertTriangle,
    label: 'Alerta',
    sublabel: 'Function: handleStockAlert',
    count: 0,
    state: 'idle',
    errors: 0,
    avgLatency: 0,
    lastEventTime: null,
    matchSources: ['function-handleStockAlert'],
    matchEventTypes: ['stock.alert'],
  },
];

const branchCNodes: PipelineNodeDef[] = [
  {
    id: 'logic-app-credit',
    icon: Workflow,
    label: 'Logic App',
    sublabel: 'Credit Approval',
    count: 0,
    state: 'idle',
    errors: 0,
    avgLatency: 0,
    lastEventTime: null,
    matchSources: ['logic-app-credit', 'durable-checkCredit'],
    matchEventTypes: ['order.credit-check'],
  },
  {
    id: 'logic-app-stock-alert',
    icon: Workflow,
    label: 'Logic App',
    sublabel: 'Stock Alert Email',
    count: 0,
    state: 'idle',
    errors: 0,
    avgLatency: 0,
    lastEventTime: null,
    matchSources: ['logic-app-stock-alert'],
    matchEventTypes: ['stock.alert.email'],
  },
];

const branchBNodes: PipelineNodeDef[] = [
  {
    id: 'event-hubs',
    icon: Radio,
    label: 'Telemetria',
    sublabel: 'Event Hubs',
    count: 0,
    state: 'idle',
    errors: 0,
    avgLatency: 0,
    lastEventTime: null,
    matchSources: ['event-hubs'],
    matchEventTypes: ['telemetry.sent', 'telemetry.received'],
  },
  {
    id: 'process-telemetry',
    icon: BarChart3,
    label: 'Agregacao',
    sublabel: 'Function: processTelemetry',
    count: 0,
    state: 'idle',
    errors: 0,
    avgLatency: 0,
    lastEventTime: null,
    matchSources: ['function-processTelemetry'],
    matchEventTypes: ['telemetry.received', 'telemetry.processed', 'telemetry.aggregated'],
  },
];

interface PipelineProps {
  events: EventLogEntry[];
  connected: boolean;
}

function updateNode(node: PipelineNodeDef, event: EventLogEntry): PipelineNodeDef | null {
  const matchesSource = node.matchSources.includes(event.source);
  const matchesType = node.matchEventTypes.some((t) =>
    event.eventType.toLowerCase().includes(t.toLowerCase())
  );

  if (!matchesSource && !matchesType) return null;

  return {
    ...node,
    count: node.count + 1,
    state: event.severity === 'error' ? 'error' : 'active',
    errors: event.severity === 'error' ? node.errors + 1 : node.errors,
    lastEventTime: event.createdAt,
    avgLatency: node.avgLatency > 0
      ? Math.round((node.avgLatency + Math.random() * 200 + 50) / 2)
      : Math.round(Math.random() * 200 + 50),
  };
}

function PipelineNodeVisual({
  node,
  showConnector,
  connectorActive,
}: {
  node: PipelineNodeDef;
  showConnector?: boolean;
  connectorActive?: boolean;
}) {
  const Icon = node.icon;

  return (
    <div className="flex items-center">
      <div className="flex flex-col items-center gap-1.5">
        <div className="relative">
          <div
            className={`w-16 h-16 rounded-full ring-2 ${ringColor[node.state]} ${nodeAnimation[node.state]} flex items-center justify-center transition-all duration-300`}
          >
            <Icon size={24} className={iconColor[node.state]} />
          </div>
          {node.count > 0 && (
            <span className="absolute -top-1 -right-1 bg-azure-500 text-white text-[10px] font-bold rounded-full min-w-[20px] h-5 flex items-center justify-center px-1 shadow-sm">
              {node.count > 999 ? '999+' : node.count}
            </span>
          )}
          {node.errors > 0 && (
            <span className="absolute -bottom-1 -right-1 bg-red-500 text-white text-[10px] font-bold rounded-full min-w-[16px] h-4 flex items-center justify-center px-1 shadow-sm">
              {node.errors}
            </span>
          )}
        </div>
        <div className="text-center max-w-[90px]">
          <p className="text-xs font-semibold text-gray-700 leading-tight">{node.label}</p>
          <p className="text-[10px] text-gray-400 leading-tight">{node.sublabel}</p>
        </div>
      </div>

      {showConnector && (
        <div className="relative w-10 h-0.5 bg-gray-200 mx-0.5 mt-[-28px]">
          {connectorActive && (
            <div className="absolute inset-0 overflow-hidden">
              <div className="flow-dot absolute top-[-2px] w-1.5 h-1.5 rounded-full bg-azure-500" />
              <div className="flow-dot absolute top-[-2px] w-1.5 h-1.5 rounded-full bg-azure-500" />
              <div className="flow-dot absolute top-[-2px] w-1.5 h-1.5 rounded-full bg-azure-500" />
            </div>
          )}
        </div>
      )}
    </div>
  );
}

const Pipeline: React.FC<PipelineProps> = ({ events, connected }) => {
  const [mainNodes, setMainNodes] = useState(initialNodes);
  const [branchA, setBranchA] = useState(branchANodes);
  const [branchB, setBranchB] = useState(branchBNodes);
  const [branchC, setBranchC] = useState(branchCNodes);
  const [processedEventCount, setProcessedEventCount] = useState(0);

  const resetActiveStates = useCallback(() => {
    const resetNode = (n: PipelineNodeDef): PipelineNodeDef =>
      n.state === 'active' ? { ...n, state: 'success' } : n;
    setMainNodes((prev) => prev.map(resetNode));
    setBranchA((prev) => prev.map(resetNode));
    setBranchB((prev) => prev.map(resetNode));
    setBranchC((prev) => prev.map(resetNode));
  }, []);

  useEffect(() => {
    if (events.length <= processedEventCount) return;

    const newEvents = events.slice(0, events.length - processedEventCount);
    setProcessedEventCount(events.length);

    for (const event of newEvents) {
      setMainNodes((prev) =>
        prev.map((node) => {
          const updated = updateNode(node, event);
          return updated ?? node;
        })
      );
      setBranchA((prev) =>
        prev.map((node) => {
          const updated = updateNode(node, event);
          return updated ?? node;
        })
      );
      setBranchB((prev) =>
        prev.map((node) => {
          const updated = updateNode(node, event);
          return updated ?? node;
        })
      );
      setBranchC((prev) =>
        prev.map((node) => {
          const updated = updateNode(node, event);
          return updated ?? node;
        })
      );
    }

    // Reset active states after 2.5 seconds
    const timer = setTimeout(resetActiveStates, 2500);
    return () => clearTimeout(timer);
  }, [events, processedEventCount, resetActiveStates]);

  const allNodes = [...mainNodes, ...branchA, ...branchB, ...branchC];
  const totalProcessed = allNodes.reduce((s, n) => s + n.count, 0);
  const totalErrors = allNodes.reduce((s, n) => s + n.errors, 0);

  return (
    <div className="p-4 md:p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <GitBranch size={24} className="text-azure-500" />
          <div>
            <h1 className="text-2xl font-bold text-gray-800">Pipeline de Mensageria</h1>
            <p className="text-gray-500 mt-0.5 text-sm">
              Visualizacao do fluxo de eventos em tempo real
              {connected && (
                <span className="text-green-500 ml-2 text-xs font-medium">
                  Conectado
                </span>
              )}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-4 text-sm">
          <div className="text-center">
            <p className="text-xl font-bold text-azure-600">{totalProcessed}</p>
            <p className="text-xs text-gray-400">Processados</p>
          </div>
          <div className="text-center">
            <p className="text-xl font-bold text-red-500">{totalErrors}</p>
            <p className="text-xs text-gray-400">Erros</p>
          </div>
        </div>
      </div>

      {/* Pipeline Diagram */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 overflow-x-auto">
        <h2 className="text-sm font-semibold text-gray-600 uppercase tracking-wider mb-6">
          Fluxo de Processamento
        </h2>

        <div className="min-w-[1200px]">
          {/* Main pipeline row */}
          <div className="flex items-start justify-center mb-2">
            {mainNodes.map((node, idx) => (
              <PipelineNodeVisual
                key={node.id}
                node={node}
                showConnector={idx < mainNodes.length - 1}
                connectorActive={node.state === 'active'}
              />
            ))}
          </div>

          {/* Branch indicator from topic node */}
          <div className="flex justify-center">
            <div className="ml-[520px] flex flex-col items-center">
              <div className="w-0.5 h-6 bg-gray-200" />
              <div className="flex items-center gap-0">
                <div className="w-[180px] h-0.5 bg-gray-200" />
                <div className="w-2 h-2 rounded-full bg-gray-300" />
                <div className="w-[180px] h-0.5 bg-gray-200" />
              </div>
              <div className="flex gap-[320px]">
                <div className="w-0.5 h-6 bg-gray-200" />
                <div className="w-0.5 h-6 bg-gray-200" />
              </div>
            </div>
          </div>

          {/* Branch labels */}
          <div className="flex justify-center gap-[120px] mb-4">
            <div className="text-center">
              <span className="text-[10px] font-semibold text-purple-500 bg-purple-50 px-2 py-0.5 rounded-full">
                Branch A: Estoque
              </span>
            </div>
            <div className="text-center">
              <span className="text-[10px] font-semibold text-blue-500 bg-blue-50 px-2 py-0.5 rounded-full">
                Branch B: Telemetria
              </span>
            </div>
            <div className="text-center">
              <span className="text-[10px] font-semibold text-orange-500 bg-orange-50 px-2 py-0.5 rounded-full">
                Branch C: Logic Apps
              </span>
            </div>
          </div>

          {/* Branch rows */}
          <div className="flex justify-center gap-[40px]">
            {/* Branch A: Stock */}
            <div className="flex items-start">
              {branchA.map((node, idx) => (
                <PipelineNodeVisual
                  key={node.id}
                  node={node}
                  showConnector={idx < branchA.length - 1}
                  connectorActive={node.state === 'active'}
                />
              ))}
            </div>

            {/* Branch B: Telemetry */}
            <div className="flex items-start">
              {branchB.map((node, idx) => (
                <PipelineNodeVisual
                  key={node.id}
                  node={node}
                  showConnector={idx < branchB.length - 1}
                  connectorActive={node.state === 'active'}
                />
              ))}
            </div>

            {/* Branch C: Logic Apps */}
            <div className="flex items-start">
              {branchC.map((node, idx) => (
                <PipelineNodeVisual
                  key={node.id}
                  node={node}
                  showConnector={idx < branchC.length - 1}
                  connectorActive={node.state === 'active'}
                />
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Stats Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100">
          <h2 className="text-lg font-semibold text-gray-800">Estatisticas por Nodo</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 text-left">
                <th className="px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Nodo</th>
                <th className="px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Servico</th>
                <th className="px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider text-right">Total Processados</th>
                <th className="px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider text-right">Latencia Media</th>
                <th className="px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider text-right">Erros</th>
                <th className="px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Ultimo Evento</th>
                <th className="px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider text-center">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {allNodes.map((node) => {
                const Icon = node.icon;
                return (
                  <tr key={node.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-5 py-3 font-medium text-gray-800">
                      <div className="flex items-center gap-2">
                        <Icon size={14} className={iconColor[node.state]} />
                        {node.label}
                      </div>
                    </td>
                    <td className="px-5 py-3 text-gray-500 text-xs">{node.sublabel}</td>
                    <td className="px-5 py-3 text-right font-mono text-gray-800">{node.count}</td>
                    <td className="px-5 py-3 text-right font-mono text-gray-600">
                      {node.avgLatency > 0 ? `${node.avgLatency}ms` : '--'}
                    </td>
                    <td className="px-5 py-3 text-right">
                      <span className={`font-mono ${node.errors > 0 ? 'text-red-600 font-medium' : 'text-gray-400'}`}>
                        {node.errors}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-gray-500 font-mono text-xs">
                      {formatTime(node.lastEventTime)}
                    </td>
                    <td className="px-5 py-3 text-center">
                      <span
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium ${
                          node.state === 'idle'
                            ? 'bg-gray-100 text-gray-500'
                            : node.state === 'active'
                            ? 'bg-blue-100 text-blue-600'
                            : node.state === 'success'
                            ? 'bg-green-100 text-green-600'
                            : 'bg-red-100 text-red-600'
                        }`}
                      >
                        <span
                          className={`w-1.5 h-1.5 rounded-full ${
                            node.state === 'idle'
                              ? 'bg-gray-400'
                              : node.state === 'active'
                              ? 'bg-blue-500 animate-pulse'
                              : node.state === 'success'
                              ? 'bg-green-500'
                              : 'bg-red-500'
                          }`}
                        />
                        {node.state === 'idle' ? 'Ocioso' : node.state === 'active' ? 'Ativo' : node.state === 'success' ? 'OK' : 'Erro'}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Legend */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
        <h3 className="text-sm font-semibold text-gray-600 mb-3">Legenda</h3>
        <div className="flex flex-wrap gap-6 text-xs text-gray-500">
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded-full bg-gray-100 ring-1 ring-gray-200" />
            <span>Ocioso - sem atividade</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded-full bg-azure-50 ring-1 ring-azure-300 node-active" />
            <span>Ativo - processando evento</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded-full bg-green-50 ring-1 ring-green-300" />
            <span>Sucesso - ultimo evento OK</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded-full bg-red-50 ring-1 ring-red-300" />
            <span>Erro - falha detectada</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Pipeline;
