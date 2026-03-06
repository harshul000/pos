import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '@/contexts/AuthContext';
import { RefreshCw, Receipt } from 'lucide-react';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const STATUS_LABELS = {
    pending: { label: 'Pending', cls: 'bg-yellow-500/15 text-yellow-300 border-yellow-500/30' },
    confirmed: { label: 'Confirmed', cls: 'bg-blue-500/15 text-blue-300 border-blue-500/30' },
    preparing: { label: 'Preparing', cls: 'bg-orange-500/15 text-orange-300 border-orange-500/30' },
    ready: { label: 'Ready!', cls: 'bg-green-500/15 text-green-300 border-green-500/30' },
    served: { label: 'Served', cls: 'bg-purple-500/15 text-purple-300 border-purple-500/30' },
    completed: { label: 'Paid', cls: 'bg-gray-600/30 text-gray-400 border-gray-600/30' },
    cancelled: { label: 'Cancelled', cls: 'bg-red-500/15 text-red-400 border-red-500/30' },
};

export default function MyOrders() {
    const { token } = useAuth();
    const navigate = useNavigate();
    const [orders, setOrders] = useState([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);

    const headers = { Authorization: `Bearer ${token}` };

    const fetchOrders = async (silent = false) => {
        if (!silent) setLoading(true);
        else setRefreshing(true);
        try {
            const { data } = await axios.get(`${API}/waiter/orders`, { headers });
            setOrders(data);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    useEffect(() => {
        fetchOrders();
        const interval = setInterval(() => fetchOrders(true), 30000);
        return () => clearInterval(interval);
    }, []); // eslint-disable-line react-hooks/exhaustive-deps

    const active = orders.filter(o => !['completed', 'cancelled'].includes(o.status));
    const closed = orders.filter(o => ['completed', 'cancelled'].includes(o.status));

    const OrderCard = ({ order }) => {
        const s = STATUS_LABELS[order.status] || { label: order.status, cls: '' };
        return (
            <div
                onClick={() => navigate(`/waiter/orders/${order.id}`)}
                className="bg-gray-900 border border-gray-800 rounded-2xl p-4 cursor-pointer hover:border-orange-500/40 transition-all"
            >
                <div className="flex items-center justify-between mb-2">
                    <span className="text-white font-bold">#{order.order_number}</span>
                    <span className={`text-xs px-2.5 py-1 rounded-full border font-medium ${s.cls}`}>{s.label}</span>
                </div>
                <div className="flex items-center gap-3 text-sm text-gray-400">
                    <span>Table {order.table_number || 'Takeaway'}</span>
                    <span>·</span>
                    <span>{order.items?.length || 0} items</span>
                    <span>·</span>
                    <span className="text-white font-semibold">₹{order.total_amount?.toFixed(2)}</span>
                </div>
                <div className="text-gray-600 text-xs mt-1">
                    {new Date(order.created_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                </div>
            </div>
        );
    };

    return (
        <div>
            <div className="flex items-center justify-between mb-6">
                <h1 className="text-2xl font-bold text-white">My Orders Today</h1>
                <button
                    onClick={() => fetchOrders(true)}
                    className={`flex items-center gap-2 px-4 py-2 rounded-xl bg-gray-800 text-gray-300 hover:text-white text-sm transition-all ${refreshing ? 'animate-pulse' : ''}`}
                >
                    <RefreshCw size={14} className={refreshing ? 'animate-spin' : ''} /> Refresh
                </button>
            </div>

            {loading ? (
                <div className="text-center text-gray-500 py-20">Loading orders…</div>
            ) : orders.length === 0 ? (
                <div className="text-center text-gray-600 py-20">
                    <Receipt size={48} className="mx-auto mb-4 opacity-30" />
                    <p>No orders yet today</p>
                </div>
            ) : (
                <div className="space-y-6">
                    {active.length > 0 && (
                        <div>
                            <h2 className="text-sm font-semibold text-orange-400 uppercase tracking-wider mb-3">Active ({active.length})</h2>
                            <div className="grid gap-3">
                                {active.map(o => <OrderCard key={o.id} order={o} />)}
                            </div>
                        </div>
                    )}
                    {closed.length > 0 && (
                        <div>
                            <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">Closed ({closed.length})</h2>
                            <div className="grid gap-3">
                                {closed.map(o => <OrderCard key={o.id} order={o} />)}
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
