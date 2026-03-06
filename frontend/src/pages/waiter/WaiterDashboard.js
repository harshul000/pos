import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '@/contexts/AuthContext';
import { PlusCircle, ClipboardList, CheckCircle2, Clock, Users } from 'lucide-react';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

export default function WaiterDashboard() {
    const { token, user } = useAuth();
    const navigate = useNavigate();
    const [orders, setOrders] = useState([]);
    const [loading, setLoading] = useState(true);

    const headers = { Authorization: `Bearer ${token}` };

    useEffect(() => {
        fetchOrders();
        const interval = setInterval(fetchOrders, 30000);
        return () => clearInterval(interval);
    }, []); // eslint-disable-line react-hooks/exhaustive-deps

    const fetchOrders = async () => {
        try {
            const { data } = await axios.get(`${API}/waiter/orders`, { headers });
            setOrders(data);
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    const active = orders.filter(o => !['completed', 'cancelled'].includes(o.status));
    const completed = orders.filter(o => o.status === 'completed');
    const totalCovers = active.reduce((s, o) => s + (o.cover_count || 1), 0);

    const statusColor = {
        pending: 'bg-yellow-500/20 text-yellow-300 border-yellow-500/30',
        confirmed: 'bg-blue-500/20 text-blue-300 border-blue-500/30',
        preparing: 'bg-orange-500/20 text-orange-300 border-orange-500/30',
        ready: 'bg-green-500/20 text-green-300 border-green-500/30',
        served: 'bg-purple-500/20 text-purple-300 border-purple-500/30',
        completed: 'bg-gray-500/20 text-gray-400 border-gray-500/30',
    };

    return (
        <div>
            {/* Header */}
            <div className="flex items-center justify-between mb-8">
                <div>
                    <h1 className="text-2xl font-bold text-white">
                        Good {new Date().getHours() < 12 ? 'Morning' : new Date().getHours() < 17 ? 'Afternoon' : 'Evening'}, {user?.full_name?.split(' ')[0]}! 👋
                    </h1>
                    <p className="text-gray-400 text-sm mt-1">{new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' })}</p>
                </div>
                <button
                    onClick={() => navigate('/waiter/new-order')}
                    className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-orange-500 to-amber-500 text-white rounded-xl font-semibold hover:from-orange-600 hover:to-amber-600 transition-all shadow-lg shadow-orange-500/25"
                >
                    <PlusCircle size={18} />
                    New Order
                </button>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-3 gap-4 mb-8">
                {[
                    { label: 'Active Orders', value: active.length, icon: ClipboardList, color: 'from-orange-500 to-amber-500' },
                    { label: 'Completed Today', value: completed.length, icon: CheckCircle2, color: 'from-green-500 to-emerald-500' },
                    { label: 'Guests Serving', value: totalCovers, icon: Users, color: 'from-blue-500 to-cyan-500' },
                ].map(({ label, value, icon: Icon, color }) => (
                    <div key={label} className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
                        <div className={`w-11 h-11 rounded-xl bg-gradient-to-br ${color} flex items-center justify-center mb-3`}>
                            <Icon size={20} className="text-white" />
                        </div>
                        <p className="text-3xl font-bold text-white">{loading ? '–' : value}</p>
                        <p className="text-gray-400 text-sm mt-1">{label}</p>
                    </div>
                ))}
            </div>

            {/* Active orders list */}
            <div>
                <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                    <Clock size={18} className="text-orange-400" />
                    My Active Orders
                </h2>
                {loading ? (
                    <div className="text-gray-500 text-center py-12">Loading…</div>
                ) : active.length === 0 ? (
                    <div className="text-center py-16 text-gray-600">
                        <ClipboardList size={48} className="mx-auto mb-4 opacity-30" />
                        <p className="text-lg">No active orders</p>
                        <p className="text-sm mt-1">Tap <strong className="text-orange-400">New Order</strong> to create one</p>
                    </div>
                ) : (
                    <div className="grid gap-3">
                        {active.map(order => (
                            <div
                                key={order.id}
                                onClick={() => navigate(`/waiter/orders/${order.id}`)}
                                className="bg-gray-900 border border-gray-800 rounded-2xl p-4 cursor-pointer hover:border-orange-500/40 transition-all"
                            >
                                <div className="flex items-center justify-between">
                                    <div>
                                        <span className="text-white font-bold text-lg">#{order.order_number}</span>
                                        <span className="text-gray-500 text-sm ml-3">Table {order.table_number || 'Takeaway'}</span>
                                    </div>
                                    <span className={`text-xs px-2.5 py-1 rounded-full border font-medium capitalize ${statusColor[order.status] || ''}`}>
                                        {order.status}
                                    </span>
                                </div>
                                <div className="flex items-center gap-4 mt-2 text-sm text-gray-400">
                                    <span>{order.items?.length || 0} items</span>
                                    <span>·</span>
                                    <span>{order.cover_count || 1} cover{order.cover_count > 1 ? 's' : ''}</span>
                                    <span>·</span>
                                    <span className="text-white font-semibold">₹{order.total_amount?.toFixed(2)}</span>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
