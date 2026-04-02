import React, { useEffect, useState } from 'react';
import api from '@/utils/api';
import AdminLayout from '@/components/AdminLayout';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { Printer } from 'lucide-react';
import { printBill } from '@/utils/printBill';

const LiveOrders = () => {
  const [orders, setOrders] = useState([]);
  const [outletId, setOutletId] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchOutletAndOrders();
    const interval = setInterval(fetchOrders, 10000);
    return () => clearInterval(interval);
  }, []);

  const fetchOutletAndOrders = async () => {
    try {
      const outletsRes = await api.get('/admin/outlets');
      if (outletsRes.data.length > 0) {
        const firstOutlet = outletsRes.data[0].id;
        setOutletId(firstOutlet);
        await fetchOrders(firstOutlet);
      }
    } catch (error) {
      console.error('Failed to fetch orders:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchOrders = async (outlet = outletId) => {
    if (!outlet) return;
    try {
      const response = await api.get(`/admin/live-orders/${outlet}`);
      setOrders(response.data);
    } catch (error) {
      console.error('Failed to fetch live orders:', error);
    }
  };

  const updateStatus = async (orderId, newStatus) => {
    try {
      await api.patch(`/orders/${orderId}/status?status=${newStatus}`);
      toast.success('Order status updated');
      fetchOrders();
    } catch (error) {
      toast.error('Failed to update status');
    }
  };

  const statusColumns = {
    pending: orders.filter(o => o.status === 'pending'),
    confirmed: orders.filter(o => o.status === 'confirmed'),
    preparing: orders.filter(o => o.status === 'preparing'),
    ready: orders.filter(o => o.status === 'ready')
  };

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
      <div data-testid="live-orders-page">
        <h1 className="text-3xl font-bold text-slate-900 mb-6">Live Orders / Kitchen Display</h1>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {Object.entries(statusColumns).map(([status, statusOrders]) => (
            <div key={status} className="space-y-3">
              <h2 className="text-lg font-bold capitalize bg-slate-800 text-white p-3 rounded-lg">
                {status} ({statusOrders.length})
              </h2>

              {statusOrders.map(order => (
                <Card key={order.id} className="p-4 border-l-4 border-l-blue-500" data-testid={`order-card-${order.order_number}`}>
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <div className="font-bold text-lg">{order.order_number}</div>
                      <div className="text-sm text-slate-600">Table {order.table_number || 'N/A'}</div>
                    </div>
                    <Badge>{order.order_type}</Badge>
                  </div>

                  <div className="space-y-2 mb-4">
                    {order.items.map((item, idx) => (
                      <div key={idx} className="text-sm">
                        <span className="font-medium">{item.quantity}x</span> {item.menu_item_name || 'Item'}
                      </div>
                    ))}
                  </div>

                  <div className="flex flex-col gap-2">
                    {status === 'pending' && (
                      <Button
                        onClick={() => updateStatus(order.id, 'confirmed')}
                        size="sm"
                        className="w-full"
                        data-testid="confirm-order"
                      >
                        Confirm
                      </Button>
                    )}
                    {status === 'confirmed' && (
                      <Button
                        onClick={() => updateStatus(order.id, 'preparing')}
                        size="sm"
                        className="w-full"
                        data-testid="start-preparing"
                      >
                        Start Preparing
                      </Button>
                    )}
                    {status === 'preparing' && (
                      <Button
                        onClick={() => updateStatus(order.id, 'ready')}
                        size="sm"
                        className="w-full"
                        data-testid="mark-ready"
                      >
                        Mark Ready
                      </Button>
                    )}
                    {status === 'ready' && (
                      <Button
                        onClick={() => updateStatus(order.id, 'served')}
                        size="sm"
                        className="w-full bg-green-600 hover:bg-green-700"
                        data-testid="mark-served"
                      >
                        Mark Served
                      </Button>
                    )}
                    <Button
                      onClick={() => printBill(order)}
                      size="sm"
                      variant="outline"
                      className="w-full flex gap-2 items-center"
                    >
                      <Printer size={14} /> Print Bill
                    </Button>
                  </div>
                </Card>
              ))}

              {statusOrders.length === 0 && (
                <div className="text-center py-8 text-slate-500 bg-slate-100 rounded-lg">
                  No {status} orders
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </AdminLayout>
  );
};

export default LiveOrders;
