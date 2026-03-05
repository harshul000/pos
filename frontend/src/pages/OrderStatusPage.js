import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import axios from 'axios';
import { Badge } from '@/components/ui/badge';
import { Clock, CheckCircle2 } from 'lucide-react';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const OrderStatusPage = () => {
  const { qrToken, orderId } = useParams();
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchOrder();
    const interval = setInterval(fetchOrder, 10000);
    return () => clearInterval(interval);
  }, [orderId]);

  const fetchOrder = async () => {
    try {
      const response = await axios.get(`${API}/orders/${orderId}`);
      setOrder(response.data);
    } catch (error) {
      console.error('Failed to fetch order:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F5F5F0]">
        <div className="animate-pulse text-[#1A2E05] text-xl font-medium">Loading order...</div>
      </div>
    );
  }

  if (!order) return null;

  const statusSteps = [
    { key: 'pending', label: 'Order Received' },
    { key: 'confirmed', label: 'Confirmed' },
    { key: 'preparing', label: 'Preparing' },
    { key: 'ready', label: 'Ready' },
    { key: 'served', label: 'Served' }
  ];

  const currentStepIndex = statusSteps.findIndex(step => step.key === order.status);

  return (
    <div className="min-h-screen bg-[#F5F5F0] p-4">
      <div className="max-w-4xl mx-auto mt-8">
        <div className="bg-white/60 backdrop-blur-md rounded-xl p-8 border border-white/20 text-center mb-6">
          <CheckCircle2 className="w-16 h-16 text-green-600 mx-auto mb-4" />
          <h1 className="text-3xl font-bold text-[#1A2E05] mb-2" style={{ fontFamily: "'Playfair Display', serif" }}>
            Order Placed Successfully!
          </h1>
          <p className="text-lg text-slate-600 mb-4">Order #{order.order_number}</p>
          <Badge className="text-lg px-4 py-2">{order.status}</Badge>
        </div>

        <div className="bg-white/60 backdrop-blur-md rounded-xl p-8 border border-white/20 mb-6">
          <h2 className="text-xl font-bold text-[#1A2E05] mb-6">Order Status</h2>
          <div className="space-y-4">
            {statusSteps.map((step, index) => {
              const isCompleted = index <= currentStepIndex;
              const isCurrent = index === currentStepIndex;
              
              return (
                <div key={step.key} className="flex items-center gap-4">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold ${
                    isCompleted ? 'bg-green-600 text-white' : 'bg-slate-200 text-slate-400'
                  }`}>
                    {index + 1}
                  </div>
                  <div className="flex-1">
                    <div className={`font-semibold ${
                      isCurrent ? 'text-[#1A2E05]' : isCompleted ? 'text-green-600' : 'text-slate-400'
                    }`}>
                      {step.label}
                    </div>
                  </div>
                  {isCurrent && <Clock className="w-5 h-5 text-[#D4AF37] animate-pulse" />}
                  {isCompleted && !isCurrent && <CheckCircle2 className="w-5 h-5 text-green-600" />}
                </div>
              );
            })}
          </div>
        </div>

        <div className="bg-white/60 backdrop-blur-md rounded-xl p-8 border border-white/20">
          <h2 className="text-xl font-bold text-[#1A2E05] mb-4">Order Details</h2>
          {order.items.map((item, index) => (
            <div key={index} className="flex justify-between py-3 border-b border-slate-200 last:border-0">
              <div>
                <span className="font-medium text-[#1A2E05]">{item.quantity}x </span>
                <span className="text-slate-700">Item</span>
              </div>
              <span className="font-bold text-[#1A2E05]">₹{item.subtotal}</span>
            </div>
          ))}
          <div className="flex justify-between py-3 mt-4 border-t-2 border-slate-300">
            <span className="text-xl font-bold text-[#1A2E05]">Total</span>
            <span className="text-xl font-bold text-[#1A2E05]">₹{order.total_amount}</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default OrderStatusPage;
