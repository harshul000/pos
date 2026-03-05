import React, { useEffect, useState } from 'react';
import api from '@/utils/api';
import AdminLayout from '@/components/AdminLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { LineChart, Line, BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

const Analytics = () => {
  const [analytics, setAnalytics] = useState(null);
  const [period, setPeriod] = useState('7d');
  const [outletId, setOutletId] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, [period]);

  const fetchData = async () => {
    try {
      const outletsRes = await api.get('/admin/outlets');
      if (outletsRes.data.length > 0) {
        const firstOutlet = outletsRes.data[0].id;
        setOutletId(firstOutlet);
        
        const analyticsRes = await api.get(`/admin/analytics/${firstOutlet}?period=${period}`);
        setAnalytics(analyticsRes.data);
      }
    } catch (error) {
      console.error('Failed to fetch analytics:', error);
    } finally {
      setLoading(false);
    }
  };

  const COLORS = ['#1A2E05', '#D4AF37', '#0F172A', '#64748B'];

  if (loading) {
    return (
      <AdminLayout>
        <div className="flex items-center justify-center h-96">
          <div className="animate-pulse text-xl">Loading analytics...</div>
        </div>
      </AdminLayout>
    );
  }

  const orderTypeData = analytics?.order_type_breakdown
    ? Object.entries(analytics.order_type_breakdown).map(([name, value]) => ({ name, value }))
    : [];

  return (
    <AdminLayout>
      <div data-testid="analytics-page">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-3xl font-bold text-slate-900">Analytics</h1>
          <div className="flex gap-2">
            <Button
              onClick={() => setPeriod('7d')}
              variant={period === '7d' ? 'default' : 'outline'}
              data-testid="period-7d"
            >
              7 Days
            </Button>
            <Button
              onClick={() => setPeriod('30d')}
              variant={period === '30d' ? 'default' : 'outline'}
              data-testid="period-30d"
            >
              30 Days
            </Button>
            <Button
              onClick={() => setPeriod('90d')}
              variant={period === '90d' ? 'default' : 'outline'}
              data-testid="period-90d"
            >
              90 Days
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
          <Card>
            <CardHeader>
              <CardTitle>Total Revenue</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-4xl font-bold text-[#D4AF37]">₹{analytics?.total_revenue?.toFixed(2) || '0.00'}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Total Orders</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-4xl font-bold text-[#1A2E05]">{analytics?.total_orders || 0}</div>
            </CardContent>
          </Card>
        </div>

        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Revenue Trend</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={analytics?.revenue_trend || []}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Line type="monotone" dataKey="revenue" stroke="#D4AF37" strokeWidth={2} />
                <Line type="monotone" dataKey="orders" stroke="#1A2E05" strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Order Type Distribution</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={orderTypeData}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={(entry) => entry.name}
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {orderTypeData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Peak Hours</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={analytics?.peak_hours || []}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="hour" />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="orders" fill="#1A2E05" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>
      </div>
    </AdminLayout>
  );
};

export default Analytics;
