import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Trash2, ShoppingCart, CheckCircle, Radio, Search } from 'lucide-react';
import { getProducts, createOrder } from '../services/api';
import type { Product } from '../types';

function formatCurrency(value: number): string {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

interface LineItem {
  productId: string;
  productName: string;
  unitPrice: number;
  quantity: number;
}

const CreateOrder: React.FC = () => {
  const navigate = useNavigate();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [createdOrderId, setCreatedOrderId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [customerName, setCustomerName] = useState('');
  const [lineItems, setLineItems] = useState<LineItem[]>([]);
  const [productSearch, setProductSearch] = useState('');
  const [showProductDropdown, setShowProductDropdown] = useState(false);

  useEffect(() => {
    async function load() {
      try {
        const data = await getProducts();
        setProducts(data);
      } catch (err) {
        console.error('Erro ao carregar produtos:', err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const filteredProducts = products.filter(
    (p) =>
      productSearch !== '' &&
      (p.name.toLowerCase().includes(productSearch.toLowerCase()) ||
        p.category.toLowerCase().includes(productSearch.toLowerCase())) &&
      !lineItems.some((li) => li.productId === p.id)
  );

  const addProduct = (product: Product) => {
    setLineItems((prev) => [
      ...prev,
      {
        productId: product.id,
        productName: product.name,
        unitPrice: product.price,
        quantity: 1,
      },
    ]);
    setProductSearch('');
    setShowProductDropdown(false);
  };

  const removeItem = (productId: string) => {
    setLineItems((prev) => prev.filter((li) => li.productId !== productId));
  };

  const updateQuantity = (productId: string, quantity: number) => {
    if (quantity < 1) return;
    setLineItems((prev) =>
      prev.map((li) => (li.productId === productId ? { ...li, quantity } : li))
    );
  };

  const grandTotal = lineItems.reduce(
    (sum, li) => sum + li.unitPrice * li.quantity,
    0
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customerName.trim()) {
      setError('Informe o nome do cliente');
      return;
    }
    if (lineItems.length === 0) {
      setError('Adicione ao menos um produto');
      return;
    }
    setError(null);
    setSubmitting(true);

    try {
      const order = await createOrder({
        customerName: customerName.trim(),
        items: lineItems.map((li) => ({
          productId: li.productId,
          quantity: li.quantity,
        })),
      });
      setCreatedOrderId(order.id);
      setSuccess(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao criar pedido');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-azure-500" />
        <span className="ml-3 text-gray-500">Carregando produtos...</span>
      </div>
    );
  }

  if (success) {
    return (
      <div className="p-4 md:p-6">
        <div className="max-w-lg mx-auto text-center py-16">
          <CheckCircle size={64} className="mx-auto text-green-500 mb-4" />
          <h2 className="text-2xl font-bold text-gray-800 mb-2">Pedido Criado!</h2>
          <p className="text-gray-500 mb-1">
            O pedido foi enviado para processamento via Service Bus.
          </p>
          <p className="text-xs font-mono text-gray-400 mb-6">
            ID: {createdOrderId}
          </p>

          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <button
              onClick={() => navigate('/pedidos')}
              className="flex items-center justify-center gap-2 px-5 py-2.5 bg-azure-500 text-white rounded-lg hover:bg-azure-600 transition-colors font-medium text-sm"
            >
              <ShoppingCart size={16} />
              Ver Pedidos
            </button>
            <button
              onClick={() => navigate('/eventos')}
              className="flex items-center justify-center gap-2 px-5 py-2.5 bg-gray-800 text-white rounded-lg hover:bg-gray-900 transition-colors font-medium text-sm"
            >
              <Radio size={16} />
              Acompanhar em tempo real
            </button>
            <button
              onClick={() => {
                setSuccess(false);
                setCreatedOrderId(null);
                setCustomerName('');
                setLineItems([]);
              }}
              className="flex items-center justify-center gap-2 px-5 py-2.5 bg-white text-gray-700 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors font-medium text-sm"
            >
              <Plus size={16} />
              Novo Pedido
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-800">Novo Pedido</h1>
        <p className="text-gray-500 mt-1 text-sm">
          Crie um pedido para acionar o fluxo de mensageria
        </p>
      </div>

      <form onSubmit={handleSubmit} className="max-w-3xl space-y-6">
        {/* Error message */}
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
            {error}
          </div>
        )}

        {/* Customer name */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
          <label className="block text-sm font-semibold text-gray-700 mb-2">
            Nome do Cliente
          </label>
          <input
            type="text"
            value={customerName}
            onChange={(e) => setCustomerName(e.target.value)}
            placeholder="Ex: Maria Silva"
            className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-azure-500 focus:border-azure-500"
          />
        </div>

        {/* Product selector */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
          <label className="block text-sm font-semibold text-gray-700 mb-2">
            Adicionar Produtos
          </label>
          <div className="relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              value={productSearch}
              onChange={(e) => {
                setProductSearch(e.target.value);
                setShowProductDropdown(true);
              }}
              onFocus={() => setShowProductDropdown(true)}
              placeholder="Buscar produto para adicionar..."
              className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-azure-500 focus:border-azure-500"
            />

            {/* Dropdown */}
            {showProductDropdown && filteredProducts.length > 0 && (
              <div className="absolute z-10 mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                {filteredProducts.map((product) => (
                  <button
                    key={product.id}
                    type="button"
                    onClick={() => addProduct(product)}
                    className="w-full text-left px-4 py-3 hover:bg-gray-50 flex items-center justify-between border-b border-gray-50 last:border-b-0"
                  >
                    <div>
                      <p className="text-sm font-medium text-gray-800">{product.name}</p>
                      <p className="text-xs text-gray-500">{product.category} - Estoque: {product.stock}</p>
                    </div>
                    <span className="text-sm font-semibold text-azure-600">{formatCurrency(product.price)}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Click outside to close dropdown */}
          {showProductDropdown && (
            <div
              className="fixed inset-0 z-0"
              onClick={() => setShowProductDropdown(false)}
            />
          )}
        </div>

        {/* Line items */}
        {lineItems.length > 0 && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="px-5 py-3 border-b border-gray-100">
              <h3 className="text-sm font-semibold text-gray-700">
                Itens do Pedido ({lineItems.length})
              </h3>
            </div>
            <div className="divide-y divide-gray-100">
              {lineItems.map((item) => (
                <div key={item.productId} className="px-5 py-3 flex items-center gap-4">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-800 truncate">{item.productName}</p>
                    <p className="text-xs text-gray-500">{formatCurrency(item.unitPrice)} /un.</p>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => updateQuantity(item.productId, item.quantity - 1)}
                      className="w-7 h-7 flex items-center justify-center rounded bg-gray-100 text-gray-600 hover:bg-gray-200 text-sm font-bold"
                    >
                      -
                    </button>
                    <span className="text-sm font-medium w-8 text-center">{item.quantity}</span>
                    <button
                      type="button"
                      onClick={() => updateQuantity(item.productId, item.quantity + 1)}
                      className="w-7 h-7 flex items-center justify-center rounded bg-gray-100 text-gray-600 hover:bg-gray-200 text-sm font-bold"
                    >
                      +
                    </button>
                  </div>

                  <span className="text-sm font-semibold text-gray-800 w-24 text-right">
                    {formatCurrency(item.unitPrice * item.quantity)}
                  </span>

                  <button
                    type="button"
                    onClick={() => removeItem(item.productId)}
                    className="text-red-400 hover:text-red-600 p-1"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              ))}
            </div>

            {/* Total */}
            <div className="px-5 py-4 bg-gray-50 flex items-center justify-between border-t border-gray-200">
              <span className="text-sm font-semibold text-gray-700">Total</span>
              <span className="text-xl font-bold text-azure-700">{formatCurrency(grandTotal)}</span>
            </div>
          </div>
        )}

        {/* Submit */}
        <button
          type="submit"
          disabled={submitting || lineItems.length === 0 || !customerName.trim()}
          className={`w-full flex items-center justify-center gap-2 px-6 py-3 rounded-lg font-medium text-sm transition-colors ${
            submitting || lineItems.length === 0 || !customerName.trim()
              ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
              : 'bg-azure-500 text-white hover:bg-azure-600'
          }`}
        >
          {submitting ? (
            <>
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
              Enviando...
            </>
          ) : (
            <>
              <ShoppingCart size={16} />
              Criar Pedido
            </>
          )}
        </button>

        <p className="text-xs text-gray-400 text-center">
          Ao criar o pedido, uma mensagem sera enviada ao Service Bus para processamento assincrono.
          Acompanhe o fluxo na pagina de Eventos.
        </p>
      </form>
    </div>
  );
};

export default CreateOrder;
