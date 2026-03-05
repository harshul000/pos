import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import {
  LayoutDashboard,
  ShoppingBag,
  UtensilsCrossed,
  Table2,
  BarChart3,
  Settings,
  LogOut,
  Monitor
} from 'lucide-react';

const AdminLayout = ({ children }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { logout, user } = useAuth();

  const menuItems = [
    { path: '/admin/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
    { path: '/admin/live-orders', icon: Monitor, label: 'Live Orders' },
    { path: '/admin/orders', icon: ShoppingBag, label: 'Orders' },
    { path: '/admin/menu', icon: UtensilsCrossed, label: 'Menu' },
    { path: '/admin/tables', icon: Table2, label: 'Tables' },
    { path: '/admin/qr-code', icon: Table2, label: 'QR Code' },
    { path: '/admin/analytics', icon: BarChart3, label: 'Analytics' },
    { path: '/admin/settings', icon: Settings, label: 'Settings' },
  ];

  const handleLogout = () => {
    logout();
    navigate('/admin/login');
  };

  return (
    <div className="flex h-screen bg-slate-50">
      <aside className="w-64 bg-[#0F172A] text-white flex flex-col" data-testid="admin-sidebar">
        <div className="p-6 border-b border-slate-700">
          <h1 className="text-2xl font-bold" style={{ fontFamily: "'Playfair Display', serif" }}>
            DH POS
          </h1>
          <p className="text-sm text-slate-400 mt-1">{user?.full_name}</p>
        </div>

        <nav className="flex-1 p-4 space-y-2">
          {menuItems.map((item) => {
            const Icon = item.icon;
            const isActive = location.pathname === item.path;
            
            return (
              <button
                key={item.path}
                onClick={() => navigate(item.path)}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all ${
                  isActive
                    ? 'bg-[#D4AF37] text-[#0F172A] font-semibold'
                    : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                }`}
                data-testid={`nav-${item.label.toLowerCase().replace(' ', '-')}`}
              >
                <Icon className="w-5 h-5" />
                {item.label}
              </button>
            );
          })}
        </nav>

        <div className="p-4 border-t border-slate-700">
          <Button
            onClick={handleLogout}
            variant="ghost"
            className="w-full text-slate-300 hover:bg-slate-800 hover:text-white justify-start"
            data-testid="logout-button"
          >
            <LogOut className="w-5 h-5 mr-3" />
            Logout
          </Button>
        </div>
      </aside>

      <main className="flex-1 overflow-auto">
        <div className="p-8">
          {children}
        </div>
      </main>
    </div>
  );
};

export default AdminLayout;
