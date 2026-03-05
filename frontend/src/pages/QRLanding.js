import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { Button } from '@/components/ui/button';
import { ArrowRight, Utensils } from 'lucide-react';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const QRLanding = () => {
  const { qrToken } = useParams();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchQRData();
  }, [qrToken]);

  const fetchQRData = async () => {
    try {
      const response = await axios.get(`${API}/qr/${qrToken}`);
      setData(response.data);
    } catch (err) {
      setError('Invalid QR code');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F5F5F0]">
        <div className="animate-pulse text-[#1A2E05] text-xl font-medium">Loading...</div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F5F5F0] p-4">
        <div className="text-center">
          <h1 className="text-3xl font-bold text-[#1A2E05] mb-4">Invalid QR Code</h1>
          <p className="text-slate-600">Please scan a valid QR code from your table.</p>
        </div>
      </div>
    );
  }

  const { table, outlet } = data;

  return (
    <div className="min-h-screen bg-[#F5F5F0]">
      <div 
        className="relative h-[60vh] bg-cover bg-center"
        style={{ backgroundImage: `url(${outlet.image_url})` }}
      >
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-black/30 to-black/70" />
        <div className="absolute bottom-0 left-0 right-0 p-8 text-white">
          <div className="max-w-4xl mx-auto">
            <div className="inline-block bg-[#D4AF37] text-[#0F172A] px-4 py-2 rounded-full text-sm font-bold mb-4">
              Table {table.table_number}
            </div>
            <h1 
              className="text-5xl md:text-6xl font-bold mb-4"
              style={{ fontFamily: "'Playfair Display', serif" }}
              data-testid="outlet-name"
            >
              {outlet.name}
            </h1>
            <p className="text-lg md:text-xl text-slate-200 max-w-2xl">
              {outlet.description}
            </p>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto p-8 -mt-12">
        <div className="bg-white/60 backdrop-blur-md rounded-xl shadow-xl p-8 border border-white/20">
          <div className="flex items-center gap-3 mb-6">
            <Utensils className="w-8 h-8 text-[#D4AF37]" />
            <h2 className="text-3xl font-bold text-[#1A2E05]">Welcome!</h2>
          </div>
          
          <p className="text-slate-700 text-lg mb-8 leading-relaxed">
            Browse our delicious menu and place your order directly from your table. 
            Your order will be sent straight to our kitchen.
          </p>

          <Button
            onClick={() => navigate(`/qr/${qrToken}/menu`)}
            className="w-full bg-[#1A2E05] hover:bg-[#1A2E05]/90 text-white rounded-full py-6 text-lg font-medium shadow-lg hover:shadow-xl transition-all active:scale-95"
            data-testid="view-menu-button"
          >
            View Menu & Order
            <ArrowRight className="ml-2 w-5 h-5" />
          </Button>
        </div>
      </div>
    </div>
  );
};

export default QRLanding;
