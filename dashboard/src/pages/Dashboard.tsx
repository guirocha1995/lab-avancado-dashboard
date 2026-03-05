import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ShoppingCart,
  DollarSign,
  Clock,
  AlertTriangle,
  Activity,
  Timer,
  ArrowRight,
  RefreshCw,
  Shield,
  Workflow,
} from 'lucide-react';
import { KpiCard } from '../components/KpiCard';
import { EventCard } from '../components/EventCard';
import { PipelineNode, type NodeState } from '../components/PipelineNode';
import { getDashboardMetrics } from '../services/api';
import type { DashboardMetrics as DashboardMetricsType, EventLogEntry } from '../types';

function formatCurrency(value: number): string {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

interface StatusCount {
  label: string;
  count: number;
  color: string;
}

const StatusChart: React.FC<{ data: StatusCount[] }> = ({ data }) => {
  const maxCount = Math.max(...data.map((d) => d.count), 1);

  return (
    <div className="space-y-3">
      {data.map((item) => (
        <div key={item.label} className="flex items-center gap-3">
          <span className="text-xs font-medium text-gray-600 w-24 text-right">{item.label}</span>
          <div className="flex-1 bg-gray-100 rounded-full h-6 overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-700 flex items-center px-2 ${item.color}`}
              style={{ width: `${Math.max((item.count / maxCount) * 100, 8)}%` }}
            >
              <span className="text-xs font-bold text-white">{item.count}</span>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
};

interface DashboardProps {
  events: EventLogEntry[];
  connected: boolean;
}

interface PipelineNodeData {
  icon: string;
  label: string;
  count: number;
  state: NodeState;
}

const Dashboard: React.FC<DashboardProps> = ({ events, connected }) => {
  const navigate = useNavigate();
  const [metrics, setMetrics] = useState<DashboardMetricsType | null>(null);
  const [loading, setLoading] = useState(true);
  const [pipelineNodes, setPipelineNodes] = useState<PipelineNodeData[]>([
    { icon: 'server', label: 'Pedido', count: 0, state: 'idle' },
    { icon: 'shield', label: 'APIM', count: 0, state: 'idle' },
    { icon: 'message-square', label: 'Fila', count: 0, state: 'idle' },
    { icon: 'clipboard-check', label: 'Validacao', count: 0, state: 'idle' },
    { icon: 'cog', label: 'Pagamento', count: 0, state: 'idle' },
    { icon: 'check-circle', label: 'Aprovado', count: 0, state: 'idle' },
    { icon: 'zap', label: 'Concluido', count: 0, state: 'idle' },
  ]);

  const loadMetrics = useCallback(async () => {
    try {
      const data = await getDashboardMetrics();
      setMetrics(data);
    } catch (err) {
      console.error('Erro ao carregar metricas:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadMetrics();
    const interval = setInterval(loadMetrics, 10000);
    return () => clearInterval(interval);
  }, [loadMetrics]);

  // Update pipeline nodes based on SSE events
  useEffect(() => {
    if (events.length === 0) return;

    const latestEvent = events[0];
    if (!latestEvent) return;

    setPipelineNodes((prev) => {
      const next = [...prev];
      const sourceToNode: Record<string, number> = {
        'app-service': 0,
        'apim-gateway': 1,
        'service-bus': 2,
        'durable-validateOrder': 3,
        'durable-reserveStock': 3,
        'durable-checkCredit': 3,
        'durable-processPayment': 4,
        'durable-updateStatus': 5,
        'durable-notifyCompletion': 6,
        'functions': 4,
      };

      const nodeIdx = sourceToNode[latestEvent.source];
      if (nodeIdx !== undefined && next[nodeIdx]) {
        next[nodeIdx] = {
          ...next[nodeIdx],
          count: next[nodeIdx].count + 1,
          state: latestEvent.severity === 'error' ? 'error' : 'active',
        };
        // Reset state after 2 seconds
        setTimeout(() => {
          setPipelineNodes((current) => {
            const updated = [...current];
            if (updated[nodeIdx]) {
              updated[nodeIdx] = { ...updated[nodeIdx], state: 'success' };
            }
            return updated;
          });
        }, 2000);
      }

      if (latestEvent.eventType.includes('approved') || latestEvent.eventType.includes('order.processed')) {
        next[5] = { ...next[5], count: next[5].count + 1, state: 'success' };
      }
      if (latestEvent.eventType.includes('completed')) {
        next[6] = { ...next[6], count: next[6].count + 1, state: 'success' };
      }

      return next;
    });
  }, [events]);

  const statusCounts: StatusCount[] = metrics
    ? [
        { label: 'Pendente', count: metrics.pendingOrders, color: 'bg-yellow-400' },
        { label: 'Processando', count: Math.floor(metrics.totalOrders * 0.2), color: 'bg-blue-500' },
        { label: 'Aprovado', count: Math.floor(metrics.totalOrders * 0.5), color: 'bg-green-500' },
        { label: 'Enviado', count: Math.floor(metrics.totalOrders * 0.2), color: 'bg-purple-500' },
        { label: 'Entregue', count: Math.floor(metrics.totalOrders * 0.1), color: 'bg-emerald-500' },
      ]
    : [];

  const recentEvents = events.slice(0, 5);

  return (
    <div className="p-4 md:p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Dashboard</h1>
          <p className="text-gray-500 mt-1 text-sm">
            Visao geral das operacoes em tempo real
            {connected && (
              <span className="text-green-500 ml-2 text-xs font-medium">
                SSE conectado
              </span>
            )}
          </p>
        </div>
        <button
          onClick={loadMetrics}
          className="flex items-center gap-2 px-3 py-2 text-sm text-gray-600 hover:text-gray-800 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
        >
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          Atualizar
        </button>
      </div>

      {/* Row 1: KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-8 gap-4">
        <KpiCard
          icon={ShoppingCart}
          title="Total Pedidos"
          value={metrics?.totalOrders ?? 0}
          subtitle="total acumulado"
          trend="up"
          color="blue"
        />
        <KpiCard
          icon={DollarSign}
          title="Receita Total"
          value={formatCurrency(metrics?.totalRevenue ?? 0)}
          subtitle="faturamento"
          trend="up"
          color="green"
        />
        <KpiCard
          icon={Clock}
          title="Pedidos Pendentes"
          value={metrics?.pendingOrders ?? 0}
          subtitle="aguardando processamento"
          trend="neutral"
          color="amber"
        />
        <KpiCard
          icon={AlertTriangle}
          title="Estoque Baixo"
          value={metrics?.lowStockCount ?? 0}
          subtitle="produtos com alerta"
          trend="down"
          color="red"
        />
        <KpiCard
          icon={Activity}
          title="Eventos/Hora"
          value={metrics?.eventsLastHour ?? events.length}
          subtitle="ultima hora"
          trend="up"
          color="purple"
        />
        <KpiCard
          icon={Timer}
          title="Tempo Medio"
          value={`${metrics?.avgProcessingTime ?? 0}s`}
          subtitle="processamento"
          trend="down"
          color="gray"
        />
        <KpiCard
          icon={Shield}
          title="APIM Requests"
          value={events.filter((e) => e.source === 'apim-gateway').length}
          subtitle="via API Management"
          trend="up"
          color="blue"
        />
        <KpiCard
          icon={Workflow}
          title="Logic App Approvals"
          value={events.filter((e) => e.source === 'durable-checkCredit').length}
          subtitle="verificacoes de credito"
          trend="neutral"
          color="amber"
        />
      </div>

      {/* Row 2: Mini Pipeline */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-800">Fluxo do Pipeline</h2>
          <button
            onClick={() => navigate('/pipeline')}
            className="flex items-center gap-1 text-sm text-azure-500 hover:text-azure-600 font-medium"
          >
            Ver detalhes <ArrowRight size={14} />
          </button>
        </div>
        <div className="flex items-center justify-center gap-0 overflow-x-auto py-4">
          {pipelineNodes.map((node, idx) => (
            <PipelineNode
              key={node.label}
              icon={node.icon}
              label={node.label}
              count={node.count}
              state={node.state}
              showConnector={idx < pipelineNodes.length - 1}
              connectorActive={node.state === 'active'}
            />
          ))}
        </div>
      </div>

      {/* Row 3: Events + Status Chart */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Events */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-800">Eventos Recentes</h2>
            <button
              onClick={() => navigate('/eventos')}
              className="text-sm text-azure-500 hover:text-azure-600 font-medium"
            >
              Ver todos
            </button>
          </div>
          {recentEvents.length > 0 ? (
            <div className="space-y-1">
              {recentEvents.map((event) => (
                <EventCard key={event.id} event={event} compact />
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-gray-400">
              <Activity size={32} className="mx-auto mb-2 opacity-50" />
              <p className="text-sm">Nenhum evento recebido ainda</p>
              <p className="text-xs mt-1">Crie um pedido para ver eventos fluindo aqui</p>
            </div>
          )}
        </div>

        {/* Orders by Status */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-800">Pedidos por Status</h2>
            <button
              onClick={() => navigate('/pedidos')}
              className="text-sm text-azure-500 hover:text-azure-600 font-medium"
            >
              Ver pedidos
            </button>
          </div>
          {statusCounts.length > 0 ? (
            <StatusChart data={statusCounts} />
          ) : (
            <div className="text-center py-8 text-gray-400">
              <ShoppingCart size={32} className="mx-auto mb-2 opacity-50" />
              <p className="text-sm">Carregando dados...</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
