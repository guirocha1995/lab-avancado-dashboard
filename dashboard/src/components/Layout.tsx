import React, { useState } from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import {
  LayoutDashboard,
  ShoppingBag,
  ClipboardList,
  Activity,
  GitBranch,
  Plus,
  Menu,
  X,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';

interface LayoutProps {
  connected: boolean;
  clientCount: number;
}

const navItems = [
  { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/catalogo', label: 'Catalogo', icon: ShoppingBag },
  { to: '/pedidos', label: 'Pedidos', icon: ClipboardList },
  { to: '/pedidos/novo', label: 'Novo Pedido', icon: Plus },
  { to: '/eventos', label: 'Eventos', icon: Activity },
  { to: '/pipeline', label: 'Pipeline', icon: GitBranch },
];

export const Layout: React.FC<LayoutProps> = ({ connected, clientCount }) => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);

  return (
    <div className="flex h-screen bg-gray-50">
      {/* Sidebar */}
      <aside
        className={`
          fixed inset-y-0 left-0 z-30 bg-gray-900 text-white transform transition-all duration-200
          lg:relative lg:translate-x-0
          ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
          ${collapsed ? 'w-16' : 'w-64'}
        `}
      >
        {/* Logo */}
        <div className="flex items-center justify-between h-16 px-4 bg-gray-950">
          <div className="flex items-center gap-2 overflow-hidden">
            <div className="w-8 h-8 bg-azure-500 rounded-lg flex items-center justify-center font-bold text-xs flex-shrink-0">
              OPS
            </div>
            {!collapsed && (
              <span className="font-semibold text-sm whitespace-nowrap">Operations Dashboard</span>
            )}
          </div>
          <button
            className="lg:hidden text-white flex-shrink-0"
            onClick={() => setSidebarOpen(false)}
          >
            <X size={20} />
          </button>
        </div>

        {/* Navigation */}
        <nav className="mt-6 px-2">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/pedidos'}
              onClick={() => setSidebarOpen(false)}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-lg mb-1 text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-azure-500 text-white shadow-md'
                    : 'text-gray-300 hover:bg-gray-800 hover:text-white'
                } ${collapsed ? 'justify-center' : ''}`
              }
              title={collapsed ? item.label : undefined}
            >
              <item.icon size={18} className="flex-shrink-0" />
              {!collapsed && item.label}
            </NavLink>
          ))}
        </nav>

        {/* Collapse button (desktop only) */}
        <button
          className="hidden lg:flex absolute bottom-16 left-0 right-0 justify-center py-2 text-gray-500 hover:text-gray-300 transition-colors"
          onClick={() => setCollapsed(!collapsed)}
        >
          {collapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
        </button>

        {/* Footer */}
        {!collapsed && (
          <div className="absolute bottom-4 left-0 right-0 px-4">
            <div className="text-xs text-gray-500 text-center leading-relaxed">
              Lab Avancado - Azure Retail
            </div>
          </div>
        )}
      </aside>

      {/* Overlay (mobile) */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-20 bg-black/50 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <header className="h-16 bg-white border-b border-gray-200 flex items-center justify-between px-4 shadow-sm flex-shrink-0">
          <div className="flex items-center gap-3">
            <button
              className="lg:hidden text-gray-600 hover:text-gray-900"
              onClick={() => setSidebarOpen(true)}
            >
              <Menu size={24} />
            </button>
            <h1 className="text-lg font-semibold text-gray-800 hidden sm:block">
              Retail Operations Dashboard
            </h1>
          </div>

          <div className="flex items-center gap-3">
            {/* SSE Connection Indicator */}
            <div
              className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium border ${
                connected
                  ? 'bg-green-50 text-green-700 border-green-200'
                  : 'bg-red-50 text-red-700 border-red-200'
              }`}
            >
              <span
                className={`w-2 h-2 rounded-full ${
                  connected ? 'bg-green-500 animate-pulse' : 'bg-red-500'
                }`}
              />
              {connected ? 'CONECTADO' : 'DESCONECTADO'}
              {connected && clientCount > 0 && (
                <span className="text-green-500 ml-1">({clientCount})</span>
              )}
            </div>

            {/* Lab badge */}
            <div className="bg-azure-100 text-azure-700 px-3 py-1 rounded-full text-xs font-medium hidden sm:flex">
              LAB AVANCADO
            </div>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
};

export default Layout;
