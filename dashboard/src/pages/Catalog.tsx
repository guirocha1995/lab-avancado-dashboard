import React, { useState, useEffect, useMemo } from 'react';
import { Search, Package } from 'lucide-react';
import { getProducts } from '../services/api';
import type { Product } from '../types';

function formatCurrency(value: number): string {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function stockColor(stock: number): { bg: string; text: string; label: string } {
  if (stock > 20) return { bg: 'bg-green-100', text: 'text-green-700', label: 'Em estoque' };
  if (stock >= 5) return { bg: 'bg-yellow-100', text: 'text-yellow-700', label: 'Estoque baixo' };
  return { bg: 'bg-red-100', text: 'text-red-700', label: 'Critico' };
}

const categoryColors: Record<string, string> = {
  'Eletronicos': 'bg-blue-100 text-blue-700',
  'Vestuario': 'bg-purple-100 text-purple-700',
  'Alimentos': 'bg-green-100 text-green-700',
  'Casa': 'bg-amber-100 text-amber-700',
  'Esportes': 'bg-red-100 text-red-700',
  'Livros': 'bg-indigo-100 text-indigo-700',
  'Beleza': 'bg-pink-100 text-pink-700',
};

const Catalog: React.FC = () => {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

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

  const categories = useMemo(() => {
    const cats = new Set(products.map((p) => p.category));
    return Array.from(cats).sort();
  }, [products]);

  const filteredProducts = useMemo(() => {
    return products.filter((p) => {
      const matchSearch =
        search === '' ||
        p.name.toLowerCase().includes(search.toLowerCase()) ||
        p.description.toLowerCase().includes(search.toLowerCase());
      const matchCategory = selectedCategory === null || p.category === selectedCategory;
      return matchSearch && matchCategory;
    });
  }, [products, search, selectedCategory]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-azure-500" />
        <span className="ml-3 text-gray-500">Carregando catalogo...</span>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-800">Catalogo de Produtos</h1>
        <p className="text-gray-500 mt-1 text-sm">
          {filteredProducts.length} produto{filteredProducts.length !== 1 ? 's' : ''} encontrado{filteredProducts.length !== 1 ? 's' : ''}
        </p>
      </div>

      {/* Search + Filters */}
      <div className="space-y-3">
        {/* Search bar */}
        <div className="relative">
          <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por nome ou descricao..."
            className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-azure-500 focus:border-azure-500"
          />
        </div>

        {/* Category filters */}
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setSelectedCategory(null)}
            className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
              selectedCategory === null
                ? 'bg-azure-500 text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            Todos
          </button>
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat === selectedCategory ? null : cat)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                selectedCategory === cat
                  ? 'bg-azure-500 text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* Product Grid */}
      {filteredProducts.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filteredProducts.map((product) => {
            const stock = stockColor(product.stock);
            const catColor = categoryColors[product.category] ?? 'bg-gray-100 text-gray-700';

            return (
              <div
                key={product.id}
                className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden hover:shadow-md transition-shadow"
              >
                {/* Image placeholder */}
                <div className="h-40 bg-gradient-to-br from-gray-100 to-gray-50 flex items-center justify-center">
                  {product.imageUrl ? (
                    <img
                      src={product.imageUrl}
                      alt={product.name}
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        (e.target as HTMLImageElement).style.display = 'none';
                        (e.target as HTMLImageElement).parentElement!.innerHTML =
                          '<div class="flex items-center justify-center h-full"><svg class="w-12 h-12 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"/></svg></div>';
                      }}
                    />
                  ) : (
                    <Package size={48} className="text-gray-300" />
                  )}
                </div>

                {/* Content */}
                <div className="p-4">
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <h3 className="font-semibold text-gray-800 text-sm leading-tight">{product.name}</h3>
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium whitespace-nowrap ${catColor}`}>
                      {product.category}
                    </span>
                  </div>

                  <p className="text-xs text-gray-500 mb-3 line-clamp-2">{product.description}</p>

                  <div className="flex items-center justify-between">
                    <span className="text-lg font-bold text-azure-700">{formatCurrency(product.price)}</span>
                    <div className="flex items-center gap-1.5">
                      <span className={`w-2 h-2 rounded-full ${
                        product.stock > 20 ? 'bg-green-500' : product.stock >= 5 ? 'bg-yellow-500' : 'bg-red-500'
                      }`} />
                      <span className={`text-xs font-medium ${stock.text}`}>
                        {product.stock} un.
                      </span>
                    </div>
                  </div>

                  {/* Stock bar */}
                  <div className="mt-2">
                    <div className="w-full bg-gray-100 rounded-full h-1.5">
                      <div
                        className={`h-1.5 rounded-full transition-all duration-300 ${
                          product.stock > 20 ? 'bg-green-500' : product.stock >= 5 ? 'bg-yellow-500' : 'bg-red-500'
                        }`}
                        style={{ width: `${Math.min((product.stock / 100) * 100, 100)}%` }}
                      />
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="text-center py-12">
          <Package size={48} className="mx-auto text-gray-300 mb-3" />
          <p className="text-gray-500 text-sm">Nenhum produto encontrado</p>
          <p className="text-gray-400 text-xs mt-1">Tente ajustar os filtros ou termo de busca</p>
        </div>
      )}
    </div>
  );
};

export default Catalog;
