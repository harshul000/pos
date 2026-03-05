import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Separator } from '@/components/ui/separator';
import { useCart } from '@/contexts/CartContext';
import { toast } from 'sonner';
import { Trash2, ArrowLeft } from 'lucide-react';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const CheckoutPage = () => {
  const { qrToken } = useParams();
  const navigate = useNavigate();
  const { cart, updateQuantity, clearCart, getCartTotal } = useCart();
  
  const [guestName, setGuestName] = useState('');
  const [notes, setNotes] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('online');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (cart.length === 0) {
      navigate(`/qr/${qrToken}/menu`);
    }
  }, [cart, qrToken, navigate]);

  const subtotal = getCartTotal();
  const tax = subtotal * 0.05;
  const total = subtotal + tax;

  const handlePlaceOrder = async () => {
    if (!guestName.trim()) {
      toast.error('Please enter your name');
      return;
    }

    setLoading(true);
    try {
      const orderData = {
        guest_name: guestName,
        items: cart.map(item => ({
          menu_item_id: item.id,
          quantity: item.quantity,
          special_instructions: null
        })),
        notes: notes || null
      };

      const response = await axios.post(`${API}/qr/${qrToken}/order`, orderData);
      const order = response.data;

      if (paymentMethod === 'online') {
        const paymentResponse = await axios.post(
          `${API}/payments/razorpay/order?order_id=${order.id}`
        );
        
        const options = {
          key: paymentResponse.data.key_id,
          amount: paymentResponse.data.amount,
          currency: paymentResponse.data.currency,
          order_id: paymentResponse.data.razorpay_order_id,
          name: 'DH POS',
          description: `Order ${order.order_number}`,
          handler: async (razorpayResponse) => {
            try {
              await axios.post(`${API}/payments/razorpay/verify`, {
                razorpay_order_id: razorpayResponse.razorpay_order_id,
                razorpay_payment_id: razorpayResponse.razorpay_payment_id,
                razorpay_signature: razorpayResponse.razorpay_signature
              });
              
              clearCart();
              toast.success('Payment successful!');
              navigate(`/qr/${qrToken}/order/${order.id}`);
            } catch (error) {
              toast.error('Payment verification failed');
            }
          },
          prefill: {
            name: guestName
          },
          theme: {
            color: '#1A2E05'
          }
        };

        const razorpay = new window.Razorpay(options);
        razorpay.open();
      } else {
        clearCart();
        toast.success('Order placed! Pay at counter.');
        navigate(`/qr/${qrToken}/order/${order.id}`);
      }
    } catch (error) {
      toast.error('Failed to place order');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F5F5F0] pb-8">
      <div className="bg-[#1A2E05] text-white py-6 px-4 sticky top-0 z-10 shadow-lg">
        <div className="max-w-4xl mx-auto flex items-center gap-4">
          <Button
            onClick={() => navigate(`/qr/${qrToken}/menu`)}
            variant="ghost"
            size="sm"
            className="text-white hover:bg-white/10"
            data-testid="back-to-menu-button"
          >
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <h1 className="text-2xl font-bold" style={{ fontFamily: "'Playfair Display', serif" }}>
            Checkout
          </h1>
        </div>
      </div>

      <div className="max-w-4xl mx-auto p-4 mt-4">
        <div className="bg-white/60 backdrop-blur-md rounded-xl p-6 border border-white/20 mb-6">
          <h2 className="text-xl font-bold text-[#1A2E05] mb-4">Order Items</h2>
          
          {cart.map((item) => (
            <div key={item.id} className="flex items-center gap-4 py-3 border-b border-slate-200 last:border-0" data-testid={`cart-item-${item.id}`}>
              <img
                src={item.image_url}
                alt={item.name}
                className="w-16 h-16 object-cover rounded-lg"
              />
              <div className="flex-1">
                <h3 className="font-semibold text-[#1A2E05]">{item.name}</h3>
                <p className="text-sm text-slate-600">₹{item.price} × {item.quantity}</p>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  onClick={() => updateQuantity(item.id, item.quantity - 1)}
                  size="sm"
                  variant="outline"
                  className="h-8 w-8 p-0"
                  data-testid={`decrease-${item.id}`}
                >
                  -
                </Button>
                <span className="w-8 text-center font-bold">{item.quantity}</span>
                <Button
                  onClick={() => updateQuantity(item.id, item.quantity + 1)}
                  size="sm"
                  variant="outline"
                  className="h-8 w-8 p-0"
                  data-testid={`increase-${item.id}`}
                >
                  +
                </Button>
                <Button
                  onClick={() => updateQuantity(item.id, 0)}
                  size="sm"
                  variant="ghost"
                  className="text-red-600 hover:text-red-700 hover:bg-red-50"
                  data-testid={`remove-${item.id}`}
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
              <div className="font-bold text-[#1A2E05]">₹{(item.price * item.quantity).toFixed(2)}</div>
            </div>
          ))}
        </div>

        <div className="bg-white/60 backdrop-blur-md rounded-xl p-6 border border-white/20 mb-6">
          <h2 className="text-xl font-bold text-[#1A2E05] mb-4">Your Details</h2>
          
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Name *</label>
              <Input
                value={guestName}
                onChange={(e) => setGuestName(e.target.value)}
                placeholder="Enter your name"
                className="bg-white/50"
                data-testid="guest-name-input"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Special Instructions (Optional)</label>
              <Textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Any special requests?"
                rows={3}
                className="bg-white/50"
                data-testid="special-instructions-input"
              />
            </div>
          </div>
        </div>

        <div className="bg-white/60 backdrop-blur-md rounded-xl p-6 border border-white/20 mb-6">
          <h2 className="text-xl font-bold text-[#1A2E05] mb-4">Payment Method</h2>
          
          <div className="space-y-3">
            <button
              onClick={() => setPaymentMethod('online')}
              className={`w-full p-4 rounded-lg border-2 text-left transition-all ${
                paymentMethod === 'online'
                  ? 'border-[#1A2E05] bg-[#1A2E05]/5'
                  : 'border-slate-300 hover:border-slate-400'
              }`}
              data-testid="payment-online"
            >
              <div className="font-semibold text-[#1A2E05]">Pay Now</div>
              <div className="text-sm text-slate-600">Pay securely with Razorpay</div>
            </button>
            
            <button
              onClick={() => setPaymentMethod('counter')}
              className={`w-full p-4 rounded-lg border-2 text-left transition-all ${
                paymentMethod === 'counter'
                  ? 'border-[#1A2E05] bg-[#1A2E05]/5'
                  : 'border-slate-300 hover:border-slate-400'
              }`}
              data-testid="payment-counter"
            >
              <div className="font-semibold text-[#1A2E05]">Pay at Counter</div>
              <div className="text-sm text-slate-600">Cash/Card/UPI at counter</div>
            </button>
          </div>
        </div>

        <div className="bg-white/60 backdrop-blur-md rounded-xl p-6 border border-white/20 mb-6">
          <h2 className="text-xl font-bold text-[#1A2E05] mb-4">Order Summary</h2>
          
          <div className="space-y-2">
            <div className="flex justify-between text-slate-700">
              <span>Subtotal</span>
              <span>₹{subtotal.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-slate-700">
              <span>Tax (5%)</span>
              <span>₹{tax.toFixed(2)}</span>
            </div>
            <Separator />
            <div className="flex justify-between text-xl font-bold text-[#1A2E05]">
              <span>Total</span>
              <span data-testid="total-amount">₹{total.toFixed(2)}</span>
            </div>
          </div>
        </div>

        <Button
          onClick={handlePlaceOrder}
          disabled={loading || !guestName.trim()}
          className="w-full bg-[#D4AF37] hover:bg-[#D4AF37]/90 text-[#0F172A] rounded-full py-6 text-lg font-bold shadow-lg disabled:opacity-50"
          data-testid="place-order-button"
        >
          {loading ? 'Processing...' : `Place Order - ₹${total.toFixed(2)}`}
        </Button>
      </div>
    </div>
  );
};

export default CheckoutPage;
