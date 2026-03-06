import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { ChevronLeft, PlusCircle, CreditCard, Banknote, Smartphone, Hotel, Gift, Printer } from 'lucide-react';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const PAYMENT_METHODS = [
    { id: 'cash', label: 'Cash', icon: Banknote, color: 'from-green-500 to-emerald-500' },
    { id: 'upi', label: 'UPI', icon: Smartphone, color: 'from-purple-500 to-violet-500' },
    { id: 'card', label: 'Card', icon: CreditCard, color: 'from-blue-500 to-cyan-500' },
    { id: 'room_charge', label: 'Room Charge', icon: Hotel, color: 'from-orange-500 to-amber-500' },
    { id: 'complimentary', label: 'Complimentary', icon: Gift, color: 'from-pink-500 to-rose-500' },
];

const STATUS_FLOW = ['pending', 'confirmed', 'preparing', 'ready', 'served'];

export default function OrderDetail() {
    const { orderId } = useParams();
    const { token } = useAuth();
    const navigate = useNavigate();
    const headers = { Authorization: `Bearer ${token}` };

    const [order, setOrder] = useState(null);
    const [loading, setLoading] = useState(true);
    const [paymentMode, setPaymentMode] = useState(false);
    const [selectedPM, setSelectedPM] = useState('cash');
    const [amountTendered, setAmountTendered] = useState('');
    const [changeResult, setChangeResult] = useState(null);
    const [updatingStatus, setUpdatingStatus] = useState(false);

    const fetchOrder = async () => {
        try {
            const { data } = await axios.get(`${API}/waiter/orders/${orderId}`, { headers });
            setOrder(data);
        } catch {
            toast.error('Order not found');
            navigate('/waiter/orders');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { fetchOrder(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

    const updateStatus = async (newStatus) => {
        setUpdatingStatus(true);
        try {
            await axios.patch(`${API}/waiter/orders/${orderId}/status?new_status=${newStatus}`, {}, { headers });
            await fetchOrder();
            toast.success(`Status updated to ${newStatus}`);
        } catch {
            toast.error('Failed to update status');
        } finally {
            setUpdatingStatus(false);
        }
    };

    const markPayment = async () => {
        try {
            const { data } = await axios.post(`${API}/waiter/orders/${orderId}/payment`, {
                method: selectedPM,
                amount_tendered: selectedPM === 'cash' && amountTendered ? parseFloat(amountTendered) : null,
            }, { headers });
            setChangeResult(data);
            await fetchOrder();
            toast.success('Payment recorded!');
            setPaymentMode(false);
        } catch {
            toast.error('Failed to record payment');
        }
    };

    const handlePrint = () => window.print();

    if (loading) return <div className="text-center text-gray-500 py-20">Loading…</div>;
    if (!order) return null;

    const isClosed = ['completed', 'cancelled'].includes(order.status);
    const currentStatusIdx = STATUS_FLOW.indexOf(order.status);

    return (
        <div className="max-w-2xl mx-auto">
            {/* Header */}
            <div className="flex items-center gap-3 mb-6">
                <button onClick={() => navigate(-1)} className="w-9 h-9 rounded-xl bg-gray-800 flex items-center justify-center text-gray-400 hover:text-white">
                    <ChevronLeft size={18} />
                </button>
                <div>
                    <h1 className="text-white font-bold text-xl">#{order.order_number}</h1>
                    <p className="text-gray-400 text-sm">
                        Table {order.table_number || 'Takeaway'} · {order.cover_count || 1} cover{order.cover_count > 1 ? 's' : ''}
                        {order.guest_name && ` · ${order.guest_name}`}
                    </p>
                </div>
            </div>

            {/* Status stepper */}
            {!isClosed && (
                <div className="bg-gray-900 border border-gray-800 rounded-2xl p-4 mb-4">
                    <p className="text-gray-400 text-sm font-medium mb-3">Order Status</p>
                    <div className="flex items-center gap-1 overflow-x-auto">
                        {STATUS_FLOW.map((s, i) => {
                            const isActive = s === order.status;
                            const isDone = i < currentStatusIdx;
                            return (
                                <React.Fragment key={s}>
                                    <button
                                        onClick={() => !isClosed && i === currentStatusIdx + 1 && updateStatus(s)}
                                        disabled={updatingStatus || isClosed || i !== currentStatusIdx + 1}
                                        className={`px-2.5 py-1.5 rounded-lg text-xs font-medium border whitespace-nowrap transition-all ${isActive ? 'bg-orange-500 border-orange-500 text-white' :
                                                isDone ? 'bg-green-500/15 border-green-500/30 text-green-400' :
                                                    i === currentStatusIdx + 1 ? 'border-gray-600 text-gray-400 hover:border-orange-500/50 hover:text-orange-400 cursor-pointer' :
                                                        'border-gray-800 text-gray-600 cursor-not-allowed'
                                            }`}
                                    >
                                        {isDone ? '✓ ' : ''}{s.charAt(0).toUpperCase() + s.slice(1)}
                                    </button>
                                    {i < STATUS_FLOW.length - 1 && <div className="w-3 h-px bg-gray-700 flex-shrink-0" />}
                                </React.Fragment>
                            );
                        })}
                    </div>
                    <p className="text-gray-600 text-xs mt-2">Click the next status to advance the order</p>
                </div>
            )}

            {/* Items */}
            <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden mb-4">
                <div className="p-4 border-b border-gray-800">
                    <p className="text-white font-semibold">Items ({order.items?.length || 0})</p>
                </div>
                {order.items?.map((item, i) => (
                    <div key={item.id} className={`flex items-center gap-3 px-4 py-3 text-sm ${i > 0 ? 'border-t border-gray-800' : ''}`}>
                        <span className="text-gray-500 w-5 text-center">{item.quantity}×</span>
                        <div className="flex-1">
                            <p className="text-white">{item.menu_item_name || item.menu_item_id}</p>
                            {item.special_instructions && (
                                <p className="text-gray-500 text-xs">{item.special_instructions}</p>
                            )}
                        </div>
                        <span className="text-gray-300">₹{item.subtotal?.toFixed(2)}</span>
                    </div>
                ))}
                <div className="border-t border-gray-700 bg-gray-800/50 p-4 space-y-1.5 text-sm">
                    <div className="flex justify-between text-gray-400"><span>Subtotal</span><span>₹{order.subtotal?.toFixed(2)}</span></div>
                    <div className="flex justify-between text-gray-400"><span>GST (5%)</span><span>₹{order.tax_amount?.toFixed(2)}</span></div>
                    {order.discount_amount > 0 && (
                        <div className="flex justify-between text-green-400"><span>Discount</span><span>-₹{order.discount_amount?.toFixed(2)}</span></div>
                    )}
                    <div className="flex justify-between text-white font-bold text-base pt-1 border-t border-gray-700"><span>Total</span><span>₹{order.total_amount?.toFixed(2)}</span></div>
                </div>
            </div>

            {/* Change result */}
            {changeResult && changeResult.change_amount > 0 && (
                <div className="bg-green-500/10 border border-green-500/30 rounded-2xl p-4 mb-4 text-center">
                    <p className="text-green-400 text-sm font-medium">Return to Customer</p>
                    <p className="text-green-300 text-3xl font-bold mt-1">₹{changeResult.change_amount.toFixed(2)}</p>
                </div>
            )}

            {/* Notes */}
            {order.notes && (
                <div className="bg-gray-900 border border-gray-800 rounded-2xl p-4 mb-4">
                    <p className="text-gray-400 text-sm font-medium mb-1">Order Notes</p>
                    <p className="text-white text-sm">{order.notes}</p>
                </div>
            )}

            {/* Actions */}
            {!isClosed && (
                <>
                    {!paymentMode ? (
                        <div className="flex gap-3">
                            <button
                                onClick={() => navigate('/waiter/new-order')}
                                className="flex items-center gap-2 px-4 py-2.5 bg-gray-800 text-white rounded-xl text-sm hover:bg-gray-700"
                            >
                                <PlusCircle size={15} /> Add Items
                            </button>
                            <button onClick={handlePrint} className="flex items-center gap-2 px-4 py-2.5 bg-gray-800 text-white rounded-xl text-sm hover:bg-gray-700">
                                <Printer size={15} /> Print
                            </button>
                            <button
                                onClick={() => setPaymentMode(true)}
                                className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-gradient-to-r from-orange-500 to-amber-500 text-white rounded-xl font-semibold hover:from-orange-600 hover:to-amber-600"
                            >
                                <CreditCard size={17} /> Mark as Paid
                            </button>
                        </div>
                    ) : (
                        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5 space-y-4">
                            <h3 className="text-white font-semibold text-lg">Select Payment Method</h3>
                            <div className="grid grid-cols-2 gap-2">
                                {PAYMENT_METHODS.map(({ id, label, icon: Icon, color }) => (
                                    <button
                                        key={id}
                                        onClick={() => setSelectedPM(id)}
                                        className={`flex items-center gap-2.5 p-3 rounded-xl border text-sm font-medium transition-all ${selectedPM === id ? `bg-gradient-to-r ${color} text-white border-transparent` : 'bg-gray-800 border-gray-700 text-gray-300 hover:border-gray-500'
                                            }`}
                                    >
                                        <Icon size={16} />
                                        {label}
                                    </button>
                                ))}
                            </div>

                            {selectedPM === 'cash' && (
                                <div>
                                    <label className="text-gray-400 text-sm mb-2 block">Amount Tendered (optional — for change)</label>
                                    <div className="relative">
                                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 font-medium">₹</span>
                                        <input
                                            type="number"
                                            value={amountTendered}
                                            onChange={e => setAmountTendered(e.target.value)}
                                            placeholder={order.total_amount?.toFixed(2)}
                                            className="w-full bg-gray-800 border border-gray-700 text-white rounded-xl pl-7 pr-4 py-2.5 text-sm focus:outline-none focus:border-orange-500"
                                        />
                                    </div>
                                    {amountTendered && parseFloat(amountTendered) >= order.total_amount && (
                                        <p className="text-green-400 text-sm mt-2 font-medium">
                                            Change: ₹{(parseFloat(amountTendered) - order.total_amount).toFixed(2)}
                                        </p>
                                    )}
                                </div>
                            )}

                            <div className="flex gap-3">
                                <button onClick={() => setPaymentMode(false)} className="px-4 py-2.5 bg-gray-800 text-gray-300 rounded-xl text-sm hover:bg-gray-700">Cancel</button>
                                <button onClick={markPayment} className="flex-1 py-2.5 bg-gradient-to-r from-orange-500 to-amber-500 text-white rounded-xl font-semibold hover:from-orange-600 hover:to-amber-600">
                                    Confirm Payment · ₹{order.total_amount?.toFixed(2)}
                                </button>
                            </div>
                        </div>
                    )}
                </>
            )}

            {isClosed && (
                <div className="text-center py-6 text-gray-500">
                    <p className="mb-1">Order {order.status === 'completed' ? 'completed' : 'cancelled'}</p>
                    {order.payment_method && <p className="text-sm">Paid via <span className="text-white capitalize">{order.payment_method.replace('_', ' ')}</span></p>}
                </div>
            )}
        </div>
    );
}
