import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import {
    ChevronRight, ChevronLeft, Search, Plus, Minus, X,
    Users, UtensilsCrossed, ShoppingBag, CheckCircle2,
    Printer, ArrowRight
} from 'lucide-react';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const ORDER_TYPES = ['dine_in', 'takeaway'];
const STATUS_COLORS = { available: '#22c55e', occupied: '#ef4444', reserved: '#f59e0b' };

export default function NewOrder() {
    const { token } = useAuth();
    const navigate = useNavigate();
    const headers = { Authorization: `Bearer ${token}` };

    const [step, setStep] = useState(1);
    const [loading, setLoading] = useState(false);

    // Step 1
    const [outlets, setOutlets] = useState([]);
    const [selectedOutlet, setSelectedOutlet] = useState(null);
    const [selectedTable, setSelectedTable] = useState(null);
    const [coverCount, setCoverCount] = useState(1);
    const [orderType, setOrderType] = useState('dine_in');

    // Step 2
    const [menu, setMenu] = useState([]);
    const [activeCategory, setActiveCategory] = useState(null);
    const [search, setSearch] = useState('');
    const [cart, setCart] = useState({});

    // Step 3
    const [guestName, setGuestName] = useState('');
    const [notes, setNotes] = useState('');

    // Step 4
    const [createdOrder, setCreatedOrder] = useState(null);

    useEffect(() => {
        axios.get(`${API}/waiter/tables`, { headers }).then(({ data }) => {
            setOutlets(data);
            if (data.length > 0) setSelectedOutlet(data[0]);
        });
    }, []); // eslint-disable-line react-hooks/exhaustive-deps

    useEffect(() => {
        if (selectedOutlet) {
            axios.get(`${API}/waiter/menu/${selectedOutlet.outlet_id}`, { headers }).then(({ data }) => {
                setMenu(data);
                setActiveCategory(data[0]?.category_id || null);
            });
        }
    }, [selectedOutlet]); // eslint-disable-line react-hooks/exhaustive-deps

    const addToCart = (item) => setCart(prev => ({
        ...prev,
        [item.id]: { ...item, qty: (prev[item.id]?.qty || 0) + 1 }
    }));

    const removeFromCart = (itemId) => setCart(prev => {
        const updated = { ...prev };
        if (updated[itemId]?.qty > 1) updated[itemId] = { ...updated[itemId], qty: updated[itemId].qty - 1 };
        else delete updated[itemId];
        return updated;
    });

    const cartItems = Object.values(cart);
    const subtotal = cartItems.reduce((s, i) => s + i.price * i.qty, 0);
    const tax = subtotal * 0.05;
    const total = subtotal + tax;

    const filteredItems = (menu.find(c => c.category_id === activeCategory)?.items || [])
        .filter(i => !search || i.name.toLowerCase().includes(search.toLowerCase()));

    const allItems = menu.flatMap(c => c.items);
    const searchResults = search ? allItems.filter(i => i.name.toLowerCase().includes(search.toLowerCase())) : null;
    const displayItems = searchResults || filteredItems;

    const confirmOrder = async () => {
        if (cartItems.length === 0) { toast.error('Add at least one item'); return; }
        setLoading(true);
        try {
            const { data } = await axios.post(`${API}/waiter/orders`, {
                outlet_id: selectedOutlet.outlet_id,
                table_id: selectedTable?.id || null,
                guest_name: guestName || null,
                cover_count: coverCount,
                order_type: orderType,
                notes: notes || null,
                items: cartItems.map(i => ({ menu_item_id: i.id, quantity: i.qty })),
            }, { headers });
            setCreatedOrder(data);
            setStep(4);
        } catch (err) {
            toast.error(err.response?.data?.detail || 'Failed to create order');
        } finally {
            setLoading(false);
        }
    };

    const stepLabels = ['Table', 'Items', 'Review', 'Done'];

    return (
        <div className="max-w-6xl mx-auto">
            {/* Header + Stepper */}
            <div className="mb-6">
                <h1 className="text-2xl font-bold text-white mb-4">New Order</h1>
                <div className="flex items-center gap-2">
                    {stepLabels.map((label, i) => {
                        const num = i + 1;
                        const active = step === num;
                        const done = step > num;
                        return (
                            <React.Fragment key={label}>
                                <div className={`flex items-center gap-2 px-4 py-1.5 rounded-full text-sm font-medium transition-all ${active ? 'bg-orange-500 text-white' : done ? 'bg-green-500/20 text-green-400' : 'bg-gray-800 text-gray-500'
                                    }`}>
                                    {done ? <CheckCircle2 size={14} /> : <span className="w-4 text-center">{num}</span>}
                                    {label}
                                </div>
                                {i < 3 && <ChevronRight size={14} className="text-gray-700" />}
                            </React.Fragment>
                        );
                    })}
                </div>
            </div>

            {/* ── STEP 1: Table ── */}
            {step === 1 && (
                <div className="space-y-6">
                    {/* Outlet selector */}
                    {outlets.length > 1 && (
                        <div>
                            <p className="text-gray-400 text-sm font-medium mb-2">Outlet</p>
                            <div className="flex gap-2 flex-wrap">
                                {outlets.map(o => (
                                    <button
                                        key={o.outlet_id}
                                        onClick={() => { setSelectedOutlet(o); setSelectedTable(null); }}
                                        className={`px-4 py-2 rounded-xl text-sm font-medium border transition-all ${selectedOutlet?.outlet_id === o.outlet_id
                                                ? 'bg-orange-500 border-orange-500 text-white'
                                                : 'bg-gray-900 border-gray-700 text-gray-300 hover:border-orange-500/50'
                                            }`}
                                    >
                                        {o.outlet_name}
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Order type */}
                    <div>
                        <p className="text-gray-400 text-sm font-medium mb-2">Order Type</p>
                        <div className="flex gap-2">
                            {ORDER_TYPES.map(t => (
                                <button
                                    key={t}
                                    onClick={() => { setOrderType(t); if (t === 'takeaway') setSelectedTable(null); }}
                                    className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium border transition-all ${orderType === t ? 'bg-orange-500 border-orange-500 text-white' : 'bg-gray-900 border-gray-700 text-gray-300 hover:border-orange-500/50'
                                        }`}
                                >
                                    {t === 'dine_in' ? <UtensilsCrossed size={15} /> : <ShoppingBag size={15} />}
                                    {t === 'dine_in' ? 'Dine In' : 'Takeaway'}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Cover count */}
                    <div>
                        <p className="text-gray-400 text-sm font-medium mb-2">Covers (Guests)</p>
                        <div className="flex items-center gap-3">
                            <button onClick={() => setCoverCount(Math.max(1, coverCount - 1))} className="w-9 h-9 rounded-full bg-gray-800 text-white flex items-center justify-center hover:bg-gray-700">
                                <Minus size={16} />
                            </button>
                            <div className="flex items-center gap-2 text-white font-bold text-xl min-w-[2rem] text-center">
                                <Users size={18} className="text-orange-400" />
                                {coverCount}
                            </div>
                            <button onClick={() => setCoverCount(coverCount + 1)} className="w-9 h-9 rounded-full bg-orange-500 text-white flex items-center justify-center hover:bg-orange-600">
                                <Plus size={16} />
                            </button>
                        </div>
                    </div>

                    {/* Tables */}
                    {orderType === 'dine_in' && selectedOutlet && (
                        <div>
                            <p className="text-gray-400 text-sm font-medium mb-3">Select Table</p>
                            <div className="grid grid-cols-4 sm:grid-cols-6 gap-3">
                                {selectedOutlet.tables.map(table => {
                                    const color = STATUS_COLORS[table.status] || '#6b7280';
                                    const isSelected = selectedTable?.id === table.id;
                                    const isOccupied = table.status === 'occupied';
                                    return (
                                        <button
                                            key={table.id}
                                            onClick={() => !isOccupied && setSelectedTable(isSelected ? null : table)}
                                            disabled={isOccupied}
                                            title={`Table ${table.table_number} (${table.status}) — ${table.capacity} seats`}
                                            className={`aspect-square rounded-2xl border-2 flex flex-col items-center justify-center transition-all ${isOccupied ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer hover:scale-105'
                                                } ${isSelected ? 'border-orange-500 bg-orange-500/20' : 'border-gray-700 bg-gray-900'}`}
                                        >
                                            <div className="w-3 h-3 rounded-full mb-1" style={{ backgroundColor: color }} />
                                            <span className="text-white text-xs font-bold">{table.table_number}</span>
                                            <span className="text-gray-500 text-[9px]">{table.capacity}p</span>
                                        </button>
                                    );
                                })}
                            </div>
                            {selectedTable && (
                                <p className="text-orange-400 text-sm mt-3">✓ Table {selectedTable.table_number} selected ({selectedTable.capacity} seats)</p>
                            )}
                        </div>
                    )}

                    <div className="flex justify-end">
                        <button
                            onClick={() => setStep(2)}
                            disabled={orderType === 'dine_in' && !selectedTable}
                            className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-orange-500 to-amber-500 text-white rounded-xl font-semibold hover:from-orange-600 hover:to-amber-600 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                        >
                            Choose Items <ChevronRight size={18} />
                        </button>
                    </div>
                </div>
            )}

            {/* ── STEP 2: Menu ── */}
            {step === 2 && (
                <div className="flex gap-4 h-[calc(100vh-16rem)]">
                    {/* Left: Menu */}
                    <div className="flex-1 flex flex-col min-w-0">
                        {/* Search */}
                        <div className="relative mb-4">
                            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
                            <input
                                value={search}
                                onChange={e => setSearch(e.target.value)}
                                placeholder="Search menu items…"
                                className="w-full bg-gray-900 border border-gray-700 text-white rounded-xl pl-9 pr-4 py-2.5 text-sm focus:outline-none focus:border-orange-500"
                            />
                            {search && (
                                <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white">
                                    <X size={15} />
                                </button>
                            )}
                        </div>

                        {/* Category tabs */}
                        {!search && (
                            <div className="flex gap-2 overflow-x-auto pb-2 mb-4 scrollbar-hide">
                                {menu.map(cat => (
                                    <button
                                        key={cat.category_id}
                                        onClick={() => setActiveCategory(cat.category_id)}
                                        className={`px-3 py-1.5 rounded-xl text-xs font-medium whitespace-nowrap border transition-all ${activeCategory === cat.category_id
                                                ? 'bg-orange-500 border-orange-500 text-white'
                                                : 'bg-gray-900 border-gray-700 text-gray-400 hover:border-orange-500/50'
                                            }`}
                                    >
                                        {cat.category_name}
                                    </button>
                                ))}
                            </div>
                        )}

                        {/* Items grid */}
                        <div className="flex-1 overflow-y-auto grid grid-cols-2 gap-3 pr-1">
                            {displayItems.map(item => {
                                const inCart = cart[item.id]?.qty || 0;
                                return (
                                    <div key={item.id} className="bg-gray-900 border border-gray-800 rounded-2xl p-3 flex flex-col">
                                        <div className="flex items-start justify-between mb-2">
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center gap-1.5 mb-0.5">
                                                    <div className={`w-2.5 h-2.5 rounded-full border ${item.is_veg ? 'border-green-500 bg-green-500' : 'border-red-500 bg-red-500'}`} />
                                                    <span className="text-white text-sm font-medium truncate">{item.name}</span>
                                                </div>
                                                {item.description && (
                                                    <p className="text-gray-500 text-xs line-clamp-1">{item.description}</p>
                                                )}
                                                <p className="text-gray-400 text-xs mt-1">~{item.prep_time_minutes}m</p>
                                            </div>
                                        </div>
                                        <div className="flex items-center justify-between mt-auto">
                                            <span className="text-orange-400 font-bold">₹{item.price.toFixed(0)}</span>
                                            {inCart === 0 ? (
                                                <button
                                                    onClick={() => addToCart(item)}
                                                    className="w-8 h-8 rounded-full bg-orange-500 flex items-center justify-center text-white hover:bg-orange-600 transition-all"
                                                >
                                                    <Plus size={15} />
                                                </button>
                                            ) : (
                                                <div className="flex items-center gap-1">
                                                    <button onClick={() => removeFromCart(item.id)} className="w-7 h-7 rounded-full bg-gray-700 flex items-center justify-center text-white hover:bg-gray-600">
                                                        <Minus size={12} />
                                                    </button>
                                                    <span className="text-white font-bold text-sm w-5 text-center">{inCart}</span>
                                                    <button onClick={() => addToCart(item)} className="w-7 h-7 rounded-full bg-orange-500 flex items-center justify-center text-white hover:bg-orange-600">
                                                        <Plus size={12} />
                                                    </button>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    {/* Right: Cart */}
                    <div className="w-64 bg-gray-900 border border-gray-800 rounded-2xl p-4 flex flex-col">
                        <h3 className="text-white font-semibold mb-3">Order Summary</h3>
                        <div className="text-xs text-gray-500 mb-3">
                            {selectedTable ? `Table ${selectedTable.table_number}` : 'Takeaway'} · {coverCount} cover{coverCount > 1 ? 's' : ''}
                        </div>
                        <div className="flex-1 overflow-y-auto space-y-2">
                            {cartItems.length === 0 ? (
                                <p className="text-gray-600 text-sm text-center pt-8">No items yet</p>
                            ) : cartItems.map(item => (
                                <div key={item.id} className="flex items-center gap-2 text-sm">
                                    <span className="text-gray-400 w-5 text-center">{item.qty}×</span>
                                    <span className="text-white flex-1 truncate">{item.name}</span>
                                    <span className="text-gray-400">₹{(item.price * item.qty).toFixed(0)}</span>
                                </div>
                            ))}
                        </div>
                        {cartItems.length > 0 && (
                            <div className="border-t border-gray-800 mt-3 pt-3 space-y-1 text-sm">
                                <div className="flex justify-between text-gray-400"><span>Subtotal</span><span>₹{subtotal.toFixed(2)}</span></div>
                                <div className="flex justify-between text-gray-400"><span>GST 5%</span><span>₹{tax.toFixed(2)}</span></div>
                                <div className="flex justify-between text-white font-bold text-base mt-1"><span>Total</span><span>₹{total.toFixed(2)}</span></div>
                            </div>
                        )}
                        <div className="flex gap-2 mt-4">
                            <button onClick={() => setStep(1)} className="flex items-center gap-1 px-3 py-2 rounded-xl text-gray-400 hover:text-white bg-gray-800 text-sm">
                                <ChevronLeft size={14} /> Back
                            </button>
                            <button
                                onClick={() => setStep(3)}
                                disabled={cartItems.length === 0}
                                className="flex-1 flex items-center justify-center gap-1 py-2 bg-gradient-to-r from-orange-500 to-amber-500 text-white rounded-xl text-sm font-semibold disabled:opacity-40"
                            >
                                Review <ArrowRight size={14} />
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ── STEP 3: Review ── */}
            {step === 3 && (
                <div className="max-w-lg mx-auto">
                    <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 space-y-5">
                        <h2 className="text-white font-bold text-lg">Review & Confirm</h2>

                        <div className="grid grid-cols-2 gap-3 text-sm">
                            <div className="bg-gray-800 rounded-xl p-3">
                                <p className="text-gray-400 text-xs mb-1">Table</p>
                                <p className="text-white font-medium">{selectedTable ? `Table ${selectedTable.table_number}` : 'Takeaway'}</p>
                            </div>
                            <div className="bg-gray-800 rounded-xl p-3">
                                <p className="text-gray-400 text-xs mb-1">Covers</p>
                                <p className="text-white font-medium">{coverCount} guest{coverCount > 1 ? 's' : ''}</p>
                            </div>
                        </div>

                        {/* Guest name */}
                        <div>
                            <label className="text-gray-400 text-sm mb-2 block">Guest Name (optional)</label>
                            <input
                                value={guestName}
                                onChange={e => setGuestName(e.target.value)}
                                placeholder="Enter guest name"
                                className="w-full bg-gray-800 border border-gray-700 text-white rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-orange-500"
                            />
                        </div>

                        {/* Notes */}
                        <div>
                            <label className="text-gray-400 text-sm mb-2 block">Order Notes</label>
                            <textarea
                                value={notes}
                                onChange={e => setNotes(e.target.value)}
                                placeholder="e.g. no onions, allergy to nuts…"
                                rows={2}
                                className="w-full bg-gray-800 border border-gray-700 text-white rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-orange-500 resize-none"
                            />
                        </div>

                        {/* Items */}
                        <div className="border border-gray-800 rounded-xl overflow-hidden">
                            {cartItems.map((item, i) => (
                                <div key={item.id} className={`flex items-center gap-3 px-4 py-2.5 text-sm ${i > 0 ? 'border-t border-gray-800' : ''}`}>
                                    <span className="text-gray-500 w-5">{item.qty}×</span>
                                    <span className="text-white flex-1">{item.name}</span>
                                    <span className="text-gray-400">₹{(item.price * item.qty).toFixed(2)}</span>
                                </div>
                            ))}
                            <div className="border-t border-gray-700 bg-gray-800 px-4 py-3 space-y-1 text-sm">
                                <div className="flex justify-between text-gray-400"><span>Subtotal</span><span>₹{subtotal.toFixed(2)}</span></div>
                                <div className="flex justify-between text-gray-400"><span>GST (5%)</span><span>₹{tax.toFixed(2)}</span></div>
                                <div className="flex justify-between text-white font-bold text-base mt-1"><span>Total</span><span>₹{total.toFixed(2)}</span></div>
                            </div>
                        </div>

                        <div className="flex gap-3">
                            <button onClick={() => setStep(2)} className="flex items-center gap-1 px-4 py-2.5 rounded-xl text-gray-400 hover:text-white bg-gray-800 text-sm">
                                <ChevronLeft size={14} /> Edit
                            </button>
                            <button
                                onClick={confirmOrder}
                                disabled={loading}
                                className="flex-1 flex items-center justify-center gap-2 py-3 bg-gradient-to-r from-orange-500 to-amber-500 text-white rounded-xl font-semibold hover:from-orange-600 hover:to-amber-600 disabled:opacity-40"
                            >
                                {loading ? 'Placing order…' : '✓ Place Order'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ── STEP 4: Confirmation ── */}
            {step === 4 && createdOrder && (
                <div className="max-w-md mx-auto text-center py-8">
                    <div className="w-20 h-20 rounded-full bg-green-500/20 border-2 border-green-500 flex items-center justify-center mx-auto mb-6">
                        <CheckCircle2 size={36} className="text-green-400" />
                    </div>
                    <h2 className="text-white text-2xl font-bold mb-2">Order Placed!</h2>
                    <p className="text-gray-400 mb-1">Order Number</p>
                    <p className="text-orange-400 text-3xl font-mono font-bold mb-6">#{createdOrder.order_number}</p>

                    <div className="bg-gray-900 border border-gray-800 rounded-2xl p-4 text-left mb-6 space-y-2 text-sm">
                        <div className="flex justify-between"><span className="text-gray-400">Table</span><span className="text-white">{createdOrder.table_number || 'Takeaway'}</span></div>
                        <div className="flex justify-between"><span className="text-gray-400">Covers</span><span className="text-white">{createdOrder.cover_count || coverCount}</span></div>
                        <div className="flex justify-between"><span className="text-gray-400">Items</span><span className="text-white">{createdOrder.items?.length}</span></div>
                        <div className="flex justify-between"><span className="text-gray-400">Total</span><span className="text-orange-400 font-bold">₹{createdOrder.total_amount?.toFixed(2)}</span></div>
                    </div>

                    <div className="flex gap-3">
                        <button
                            onClick={() => navigate(`/waiter/orders/${createdOrder.id}`)}
                            className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-gray-800 text-white rounded-xl text-sm hover:bg-gray-700"
                        >
                            <Printer size={15} /> View Bill
                        </button>
                        <button
                            onClick={() => { setStep(1); setCart({}); setSelectedTable(null); setCreatedOrder(null); setGuestName(''); setNotes(''); setCoverCount(1); }}
                            className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-gradient-to-r from-orange-500 to-amber-500 text-white rounded-xl text-sm font-semibold"
                        >
                            <Plus size={15} /> New Order
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
