import React, { useEffect, useState } from 'react';
import api from '@/utils/api';
import AdminLayout from '@/components/AdminLayout';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Search, ChevronDown, ChevronUp, Printer } from 'lucide-react';
import { printBill } from '@/utils/printBill';

const OrdersList = () => {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expandedOrder, setExpandedOrder] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    fetchOrders();
  }, []);

  const fetchOrders = async () => {
    try {
      const response = await api.get('/orders');
      setOrders(response.data);
    } catch (error) {
      console.error('Failed to fetch orders:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredOrders = orders.filter(order =>
    order.order_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
    order.guest_name?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading) {
    return (
      <AdminLayout>
        <div className="flex items-center justify-center h-96">
          <div className="animate-pulse text-xl">Loading orders...</div>
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <div data-testid="orders-list-page">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-3xl font-bold text-slate-900">Orders</h1>
        </div>

        <div className="relative mb-6">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
          <Input
            placeholder="Search orders by number or guest name..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
            data-testid="search-orders-input"
          />
        </div>

        <div className="space-y-4">
          {filteredOrders.map(order => (
            <Card key={order.id} className="p-6">
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-4 mb-2">
                    <div className="text-xl font-bold">{order.order_number}</div>
                    <Badge>{order.status}</Badge>
                    <Badge variant="outline">{order.order_type}</Badge>
                  </div>
                  <div className="text-sm text-slate-600">
                    {order.guest_name} • Table {order.table_number || 'N/A'} • {new Date(order.created_at).toLocaleString()}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-2xl font-bold text-[#D4AF37]">₹{order.total_amount}</div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setExpandedOrder(expandedOrder === order.id ? null : order.id)}
                    data-testid={`expand-order-${order.id}`}
                  >
                    {expandedOrder === order.id ? <ChevronUp /> : <ChevronDown />}
                  </Button>
                </div>
              </div>

              {expandedOrder === order.id && (
                <div className="mt-4 pt-4 border-t border-slate-200">
                  <h3 className="font-bold mb-3">Order Items</h3>
                  <div className="space-y-2">
                    {order.items.map((item, idx) => (
                      <div key={idx} className="flex justify-between text-sm">
                        <span>{item.quantity}x Item</span>
                        <span className="font-medium">₹{item.subtotal}</span>
                      </div>
                    ))}
                  </div>
                  <div className="mt-4 pt-4 border-t border-slate-200 space-y-2">
                    <div className="flex justify-between text-sm">
                      <span>Subtotal</span>
                      <span>₹{order.subtotal}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span>Tax</span>
                      <span>₹{order.tax_amount}</span>
                    </div>
                    <div className="flex justify-between font-bold">
                      <span>Total</span>
                      <span>₹{order.total_amount}</span>
                    </div>
                  </div>
                  <div className="mt-4 flex justify-end">
                    <Button
                      onClick={() => printBill(order)}
                      variant="outline"
                      size="sm"
                      className="flex gap-2 items-center"
                    >
                      <Printer size={14} /> Print Bill
                    </Button>
                  </div>
                </div>
              )}
            </Card>
          ))}

          {filteredOrders.length === 0 && (
            <Card className="p-12 text-center">
              <p className="text-slate-600">No orders found</p>
            </Card>
          )}
        </div>
      </div>
    </AdminLayout>
  );
};

export default OrdersList;
