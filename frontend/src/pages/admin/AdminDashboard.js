import React, { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import api from '@/utils/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { DollarSign, ShoppingBag, TrendingUp, Users } from 'lucide-react';
import AdminLayout from '@/components/AdminLayout';

const AdminDashboard = () => {
  const { user } = useAuth();
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [outletId, setOutletId] = useState(null);

  useEffect(() => {
    fetchOutletsAndStats();
  }, []);

  const fetchOutletsAndStats = async () => {
    try {
      const outletsRes = await api.get('/admin/outlets');
      if (outletsRes.data.length > 0) {
        const firstOutlet = outletsRes.data[0].id;
        setOutletId(firstOutlet);
        const statsRes = await api.get(`/admin/dashboard/${firstOutlet}`);
        setStats(statsRes.data);
      }
    } catch (error) {
      console.error('Failed to fetch dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <AdminLayout>
        <div className="flex items-center justify-center h-96">
          <div className="animate-pulse text-xl">Loading dashboard...</div>
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <div className="space-y-6" data-testid="admin-dashboard">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Dashboard</h1>
          <p className="text-slate-600 mt-1">Welcome back, {user?.full_name}</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-slate-600">Today's Revenue</CardTitle>
              <DollarSign className="w-4 h-4 text-slate-400" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold" data-testid="todays-revenue">₹{stats?.todays_revenue?.toFixed(2) || '0.00'}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-slate-600">Today's Orders</CardTitle>
              <ShoppingBag className="w-4 h-4 text-slate-400" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold" data-testid="todays-orders">{stats?.todays_orders || 0}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-slate-600">Avg Order Value</CardTitle>
              <TrendingUp className="w-4 h-4 text-slate-400" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold" data-testid="avg-order-value">₹{stats?.avg_order_value?.toFixed(2) || '0.00'}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-slate-600">Active Tables</CardTitle>
              <Users className="w-4 h-4 text-slate-400" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold" data-testid="active-tables">{stats?.active_tables || 0}</div>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Revenue Trend (Last 7 Days)</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={stats?.revenue_trend || []}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" />
                <YAxis />
                <Tooltip />
                <Line type="monotone" dataKey="revenue" stroke="#D4AF37" strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Top Selling Items Today</CardTitle>
          </CardHeader>
          <CardContent>
            {stats?.top_items && stats.top_items.length > 0 ? (
              <div className="space-y-3">
                {stats.top_items.map((item, index) => (
                  <div key={index} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                    <div>
                      <div className="font-medium text-slate-900">{item.name || 'Unknown Item'}</div>
                      <div className="text-sm text-slate-600">{item.quantity} orders</div>
                    </div>
                    <div className="text-lg font-bold text-[#D4AF37]">₹{item.price || 0}</div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-slate-600">No orders today</div>
            )}
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
};

export default AdminDashboard;
