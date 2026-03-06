import React from 'react';
import { NavLink, useNavigate, Outlet } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { LayoutDashboard, ClipboardList, PlusCircle, LogOut, UtensilsCrossed } from 'lucide-react';

const navItems = [
    { label: 'Dashboard', to: '/waiter/dashboard', icon: LayoutDashboard },
    { label: 'New Order', to: '/waiter/new-order', icon: PlusCircle },
    { label: 'My Orders', to: '/waiter/orders', icon: ClipboardList },
];

export default function WaiterLayout() {
    const { user, logout } = useAuth();
    const navigate = useNavigate();

    const handleLogout = () => {
        logout();
        navigate('/admin/login');
    };

    return (
        <div className="min-h-screen bg-gray-950 flex">
            {/* Sidebar */}
            <aside className="w-64 bg-gray-900 border-r border-gray-800 flex flex-col fixed h-screen z-30">
                {/* Brand */}
                <div className="p-5 border-b border-gray-800">
                    <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-orange-500 to-amber-500 flex items-center justify-center">
                            <UtensilsCrossed size={18} className="text-white" />
                        </div>
                        <div>
                            <p className="text-white font-bold text-sm">DH POS</p>
                            <p className="text-orange-400 text-xs font-medium">Waiter Portal</p>
                        </div>
                    </div>
                </div>

                {/* Nav */}
                <nav className="flex-1 p-3 space-y-1">
                    {navItems.map(({ label, to, icon: Icon }) => (
                        <NavLink
                            key={to}
                            to={to}
                            className={({ isActive }) =>
                                `flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${isActive
                                    ? 'bg-orange-500/20 text-orange-400 border border-orange-500/30'
                                    : 'text-gray-400 hover:text-white hover:bg-gray-800'
                                }`
                            }
                        >
                            <Icon size={17} />
                            {label}
                        </NavLink>
                    ))}
                </nav>

                {/* User & Logout */}
                <div className="p-4 border-t border-gray-800">
                    <div className="flex items-center gap-3 mb-3 p-2 rounded-xl bg-gray-800">
                        <div className="w-8 h-8 rounded-full bg-orange-500 flex items-center justify-center text-white text-xs font-bold">
                            {user?.full_name?.charAt(0) || 'W'}
                        </div>
                        <div className="flex-1 min-w-0">
                            <p className="text-white text-sm font-medium truncate">{user?.full_name || 'Waiter'}</p>
                            <p className="text-gray-400 text-xs">Staff</p>
                        </div>
                    </div>
                    <button
                        onClick={handleLogout}
                        className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-gray-400 hover:text-red-400 hover:bg-red-400/10 text-sm transition-all"
                    >
                        <LogOut size={15} />
                        Sign Out
                    </button>
                </div>
            </aside>

            {/* Main */}
            <main className="ml-64 flex-1 p-6">
                <Outlet />
            </main>
        </div>
    );
}
