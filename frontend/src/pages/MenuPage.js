import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ShoppingCart, Plus, Minus, Leaf, Search } from 'lucide-react';
import { useCart } from '@/contexts/CartContext';
import { toast } from 'sonner';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const MenuPage = () => {
  const { qrToken } = useParams();
  const navigate = useNavigate();
  const { cart, addToCart, updateQuantity, getCartCount, getCartTotal } = useCart();
  
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [vegOnly, setVegOnly] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    fetchQRData();
  }, [qrToken]);

  const fetchQRData = async () => {
    try {
      const response = await axios.get(`${API}/qr/${qrToken}`);
      setData(response.data);
      if (response.data.menu.length > 0) {
        setSelectedCategory(response.data.menu[0].category.id);
      }
    } catch (err) {
      toast.error('Failed to load menu');
      navigate(`/qr/${qrToken}`);
    } finally {
      setLoading(false);
    }
  };

  const getItemQuantity = (itemId) => {
    const cartItem = cart.find(i => i.id === itemId);
    return cartItem ? cartItem.quantity : 0;
  };

  const handleAddToCart = (item) => {
    addToCart(item, 1);
    toast.success(`${item.name} added to cart`);
  };

  const handleIncrement = (item) => {
    const currentQty = getItemQuantity(item.id);
    updateQuantity(item.id, currentQty + 1);
  };

  const handleDecrement = (item) => {
    const currentQty = getItemQuantity(item.id);
    if (currentQty > 1) {
      updateQuantity(item.id, currentQty - 1);
    } else {
      updateQuantity(item.id, 0);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F5F5F0]">
        <div className="animate-pulse text-[#1A2E05] text-xl font-medium">Loading menu...</div>
      </div>
    );
  }

  if (!data) return null;

  const { table, outlet, menu } = data;

  const filteredMenu = menu.map(categoryData => {
    let items = categoryData.items;
    
    if (vegOnly) {
      items = items.filter(item => item.is_veg);
    }
    
    if (searchTerm) {
      items = items.filter(item =>
        item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.description?.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }
    
    return { ...categoryData, items };
  }).filter(categoryData => categoryData.items.length > 0);

  const currentCategory = filteredMenu.find(c => c.category.id === selectedCategory);

  return (
    <div className="min-h-screen bg-[#F5F5F0]">
      <div className="bg-[#1A2E05] text-white py-4 px-4 sticky top-0 z-20 shadow-lg">
        <div className="max-w-6xl mx-auto">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h1 className="text-2xl font-bold" style={{ fontFamily: "'Playfair Display', serif" }}>
                {outlet.name}
              </h1>
              <p className="text-sm text-slate-300">Table {table.table_number}</p>
            </div>
          </div>
          
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
            <input
              type="text"
              placeholder="Search menu..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-white/10 border border-white/20 rounded-full text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#D4AF37]"
              data-testid="search-menu-input"
            />
          </div>
        </div>
      </div>

      <div className="sticky top-[116px] z-10 bg-white/80 backdrop-blur-md border-b border-slate-200 py-3 px-4">
        <div className="max-w-6xl mx-auto flex items-center gap-4 overflow-x-auto">
          {menu.map(categoryData => (
            <button
              key={categoryData.category.id}
              onClick={() => setSelectedCategory(categoryData.category.id)}
              className={`px-4 py-2 rounded-full font-medium whitespace-nowrap transition-all ${
                selectedCategory === categoryData.category.id
                  ? 'bg-[#1A2E05] text-white'
                  : 'bg-white border border-slate-300 text-slate-700 hover:border-[#D4AF37]'
              }`}
              data-testid={`category-tab-${categoryData.category.name.toLowerCase()}`}
            >
              {categoryData.category.name}
            </button>
          ))}
          
          <button
            onClick={() => setVegOnly(!vegOnly)}
            className={`ml-auto px-4 py-2 rounded-full font-medium whitespace-nowrap flex items-center gap-2 transition-all ${
              vegOnly
                ? 'bg-green-600 text-white'
                : 'bg-white border border-slate-300 text-slate-700 hover:border-green-600'
            }`}
            data-testid="veg-only-toggle"
          >
            <Leaf className="w-4 h-4" />
            Veg Only
          </button>
        </div>
      </div>

      <div className="max-w-6xl mx-auto p-4 pb-32">
        {currentCategory && (
          <div>
            <h2 className="text-3xl font-bold text-[#1A2E05] mb-6 mt-4" style={{ fontFamily: "'Playfair Display', serif" }}>
              {currentCategory.category.name}
            </h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {currentCategory.items.map(item => {
                const qty = getItemQuantity(item.id);
                
                return (
                  <div
                    key={item.id}
                    className="bg-white/60 backdrop-blur-md rounded-xl overflow-hidden border border-white/20 shadow-sm hover:shadow-md transition-all group"
                    data-testid={`menu-item-${item.name.toLowerCase().replace(/\\s+/g, '-')}`}
                  >
                    {item.image_url && (
                      <div className="relative h-48 overflow-hidden">
                        <img
                          src={item.image_url}
                          alt={item.name}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                        />
                        {item.is_veg && (
                          <div className="absolute top-3 left-3 bg-green-600 text-white p-1 rounded">
                            <Leaf className="w-4 h-4" />
                          </div>
                        )}
                      </div>
                    )}
                    
                    <div className="p-4">
                      <div className="flex items-start justify-between mb-2">
                        <h3 className="text-lg font-semibold text-[#1A2E05]">{item.name}</h3>
                        <Badge variant="secondary" className="bg-[#D4AF37] text-[#0F172A] font-bold">
                          ₹{item.price}
                        </Badge>
                      </div>
                      
                      {item.description && (
                        <p className="text-sm text-slate-600 mb-3 line-clamp-2">{item.description}</p>
                      )}
                      
                      {item.prep_time_minutes && (
                        <p className="text-xs text-slate-500 mb-3">Prep time: {item.prep_time_minutes} mins</p>
                      )}
                      
                      {qty === 0 ? (
                        <Button
                          onClick={() => handleAddToCart(item)}
                          className="w-full bg-[#1A2E05] hover:bg-[#1A2E05]/90 text-white rounded-full"
                          data-testid={`add-to-cart-${item.name.toLowerCase().replace(/\\s+/g, '-')}`}
                        >
                          <Plus className="w-4 h-4 mr-2" />
                          Add to Cart
                        </Button>
                      ) : (
                        <div className="flex items-center justify-between bg-[#1A2E05] rounded-full p-1">
                          <Button
                            onClick={() => handleDecrement(item)}
                            size="sm"
                            className="bg-white text-[#1A2E05] hover:bg-slate-100 rounded-full h-8 w-8 p-0"
                            data-testid={`decrease-qty-${item.name.toLowerCase().replace(/\\s+/g, '-')}`}
                          >
                            <Minus className="w-4 h-4" />
                          </Button>
                          <span className="text-white font-bold px-4" data-testid={`item-quantity-${item.id}`}>{qty}</span>
                          <Button
                            onClick={() => handleIncrement(item)}
                            size="sm"
                            className="bg-white text-[#1A2E05] hover:bg-slate-100 rounded-full h-8 w-8 p-0"
                            data-testid={`increase-qty-${item.name.toLowerCase().replace(/\\s+/g, '-')}`}
                          >
                            <Plus className="w-4 h-4" />
                          </Button>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
        
        {filteredMenu.length === 0 && (
          <div className="text-center py-12">
            <p className="text-slate-600">No items found matching your filters.</p>
          </div>
        )}
      </div>

      {getCartCount() > 0 && (
        <div className="fixed bottom-0 left-0 right-0 bg-white/90 backdrop-blur-md border-t border-slate-200 p-4 z-20">
          <div className="max-w-6xl mx-auto">
            <Button
              onClick={() => navigate(`/qr/${qrToken}/checkout`)}
              className="w-full bg-[#D4AF37] hover:bg-[#D4AF37]/90 text-[#0F172A] rounded-full py-6 text-lg font-bold shadow-lg flex items-center justify-between"
              data-testid="view-cart-button"
            >
              <span className="flex items-center gap-2">
                <ShoppingCart className="w-5 h-5" />
                View Cart ({getCartCount()} items)
              </span>
              <span>₹{getCartTotal().toFixed(2)}</span>
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};

export default MenuPage;
