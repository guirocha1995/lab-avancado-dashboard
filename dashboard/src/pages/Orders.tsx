import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Plus, ChevronDown, ChevronUp, ClipboardList } from 'lucide-react';
import { getOrders } from '../services/api';
import { StatusBadge, type OrderStatus } from '../components/StatusBadge';
import type { Order, EventLogEntry } from '../types';

function formatCurrency(value: number): string {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function shortId(id: string): string {
  return id.slice(0, 8).toUpperCase();
}

type FilterTab = 'all' | 'pending' | 'processing' | 'approved' | 'shipped';

const filterTabs: { key: FilterTab; label: string }[] = [
  { key: 'all', label: 'Todos' },
  { key: 'pending', label: 'Pendentes' },
  { key: 'processing', label: 'Processando' },
  { key: 'approved', label: 'Aprovados' },
  { key: 'shipped', label: 'Enviados' },
];

interface OrdersProps {
  events: EventLogEntry[];
}

const Orders: React.FC<OrdersProps> = ({ events }) => {
  const navigate = useNavigate();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [activeTab, setActiveTab] = useState<FilterTab>('all');
  const [expandedOrderId, setExpandedOrderId] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const data = await getOrders();
        setOrders(data);
      } catch (err) {
        console.error('Erro ao carregar pedidos:', err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  // Real-time status updates via SSE
  useEffect(() => {
    if (events.length === 0) return;
    const latestEvent = events[0];
    if (!latestEvent || !latestEvent.orderId) return;

    setOrders((prev) =>
      prev.map((order) => {
        if (order.id !== latestEvent.orderId) return order;

        const payload = latestEvent.payload as Record<string, unknown>;
        const newStatus = payload.newStatus as OrderStatus | undefined;
        if (newStatus) {
          return { ...order, status: newStatus, updatedAt: latestEvent.createdAt };
        }
        return order;
      })
    );
  }, [events]);

  const filteredOrders = useMemo(() => {
    return orders
      .filter((o) => {
        if (activeTab !== 'all' && o.status !== activeTab) return false;
        if (search) {
          const q = search.toLowerCase();
          return (
            o.id.toLowerCase().includes(q) ||
            o.customerName.toLowerCase().includes(q)
          );
        }
        return true;
      })
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [orders, activeTab, search]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-azure-500" />
        <span className="ml-3 text-gray-500">Carregando pedidos...</span>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Pedidos</h1>
          <p className="text-gray-500 mt-1 text-sm">
            {filteredOrders.length} pedido{filteredOrders.length !== 1 ? 's' : ''}
          </p>
        </div>
        <button
          onClick={() => navigate('/pedidos/novo')}
          className="flex items-center gap-2 px-4 py-2.5 bg-azure-500 text-white rounded-lg hover:bg-azure-600 transition-colors font-medium text-sm"
        >
          <Plus size={16} />
          Novo Pedido
        </button>
      </div>

      {/* Search + Filter Tabs */}
      <div className="space-y-3">
        <div className="relative">
          <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por cliente ou ID do pedido..."
            className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-azure-500 focus:border-azure-500"
          />
        </div>

        <div className="flex gap-1 bg-gray-100 p-1 rounded-lg w-fit">
          {filterTabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`px-4 py-1.5 rounded-md text-xs font-medium transition-colors ${
                activeTab === tab.key
                  ? 'bg-white text-gray-800 shadow-sm'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Orders Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 text-left">
                <th className="px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">ID</th>
                <th className="px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Cliente</th>
                <th className="px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Total</th>
                <th className="px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Status</th>
                <th className="px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Data</th>
                <th className="px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider w-10"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filteredOrders.map((order) => {
                const isExpanded = expandedOrderId === order.id;
                return (
                  <React.Fragment key={order.id}>
                    <tr
                      className="hover:bg-gray-50 cursor-pointer transition-colors"
                      onClick={() => setExpandedOrderId(isExpanded ? null : order.id)}
                    >
                      <td className="px-5 py-3 font-mono text-azure-600 font-medium text-xs">
                        {shortId(order.id)}
                      </td>
                      <td className="px-5 py-3 text-gray-800 font-medium">{order.customerName}</td>
                      <td className="px-5 py-3 text-gray-800 font-medium">{formatCurrency(order.totalAmount)}</td>
                      <td className="px-5 py-3">
                        <StatusBadge status={order.status} />
                      </td>
                      <td className="px-5 py-3 text-gray-500 text-xs">{formatDate(order.createdAt)}</td>
                      <td className="px-5 py-3 text-gray-400">
                        {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                      </td>
                    </tr>
                    {/* Expanded detail row */}
                    {isExpanded && (
                      <tr>
                        <td colSpan={6} className="px-5 py-4 bg-gray-50">
                          <div className="space-y-3">
                            <h4 className="text-xs font-semibold text-gray-600 uppercase">Itens do Pedido</h4>
                            {order.items && order.items.length > 0 ? (
                              <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
                                <table className="w-full text-sm">
                                  <thead>
                                    <tr className="bg-gray-50 text-left">
                                      <th className="px-4 py-2 text-xs font-medium text-gray-500">Produto</th>
                                      <th className="px-4 py-2 text-xs font-medium text-gray-500 text-right">Qtd</th>
                                      <th className="px-4 py-2 text-xs font-medium text-gray-500 text-right">Preco Unit.</th>
                                      <th className="px-4 py-2 text-xs font-medium text-gray-500 text-right">Subtotal</th>
                                    </tr>
                                  </thead>
                                  <tbody className="divide-y divide-gray-100">
                                    {order.items.map((item) => (
                                      <tr key={item.id}>
                                        <td className="px-4 py-2 text-gray-700">{item.productName}</td>
                                        <td className="px-4 py-2 text-gray-600 text-right">{item.quantity}</td>
                                        <td className="px-4 py-2 text-gray-600 text-right">{formatCurrency(item.unitPrice)}</td>
                                        <td className="px-4 py-2 text-gray-800 font-medium text-right">
                                          {formatCurrency(item.quantity * item.unitPrice)}
                                        </td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                            ) : (
                              <p className="text-xs text-gray-400">Nenhum item encontrado</p>
                            )}
                            <div className="flex items-center justify-between text-xs text-gray-500">
                              <span>Atualizado: {formatDate(order.updatedAt)}</span>
                              <span className="font-mono">ID: {order.id}</span>
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}
              {filteredOrders.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-5 py-12 text-center">
                    <ClipboardList size={40} className="mx-auto text-gray-300 mb-3" />
                    <p className="text-gray-500 text-sm">Nenhum pedido encontrado</p>
                    <p className="text-gray-400 text-xs mt-1">Tente ajustar os filtros ou crie um novo pedido</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default Orders;
