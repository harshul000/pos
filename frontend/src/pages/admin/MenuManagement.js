import React, { useEffect, useState } from 'react';
import api from '@/utils/api';
import AdminLayout from '@/components/AdminLayout';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { Leaf } from 'lucide-react';

const MenuManagement = () => {
  const [menuItems, setMenuItems] = useState([]);
  const [categories, setCategories] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [outletId, setOutletId] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const outletsRes = await api.get('/admin/outlets');
      if (outletsRes.data.length > 0) {
        const firstOutlet = outletsRes.data[0].id;
        setOutletId(firstOutlet);
        
        const [itemsRes, catsRes] = await Promise.all([
          api.get(`/admin/menu/items?outlet_id=${firstOutlet}`),
          api.get(`/admin/menu/categories?outlet_id=${firstOutlet}`)
        ]);
        
        setMenuItems(itemsRes.data);
        setCategories(catsRes.data);
      }
    } catch (error) {
      console.error('Failed to fetch menu:', error);
    } finally {
      setLoading(false);
    }
  };

  const toggleAvailability = async (itemId) => {
    try {
      await api.patch(`/admin/menu/items/${itemId}/toggle-availability`);
      toast.success('Item availability updated');
      fetchData();
    } catch (error) {
      toast.error('Failed to update availability');
    }
  };

  const filteredItems = selectedCategory === 'all'
    ? menuItems
    : menuItems.filter(item => item.category_id === selectedCategory);

  if (loading) {
    return (
      <AdminLayout>
        <div className="flex items-center justify-center h-96">
          <div className="animate-pulse text-xl">Loading menu...</div>
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <div data-testid="menu-management-page">
        <h1 className="text-3xl font-bold text-slate-900 mb-6">Menu Management</h1>

        <div className="flex gap-2 mb-6 flex-wrap">
          <Button
            onClick={() => setSelectedCategory('all')}
            variant={selectedCategory === 'all' ? 'default' : 'outline'}
            data-testid="category-all"
          >
            All Items
          </Button>
          {categories.map(cat => (
            <Button
              key={cat.id}
              onClick={() => setSelectedCategory(cat.id)}
              variant={selectedCategory === cat.id ? 'default' : 'outline'}
              data-testid={`category-${cat.name.toLowerCase()}`}
            >
              {cat.name}
            </Button>
          ))}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredItems.map(item => (
            <Card key={item.id} className="p-6" data-testid={`menu-item-${item.id}`}>
              {item.image_url && (
                <img
                  src={item.image_url}
                  alt={item.name}
                  className="w-full h-48 object-cover rounded-lg mb-4"
                />
              )}
              
              <div className="flex items-start justify-between mb-2">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="text-lg font-bold">{item.name}</h3>
                    {item.is_veg && <Leaf className="w-4 h-4 text-green-600" />}
                  </div>
                  <p className="text-sm text-slate-600 mb-2">{item.description}</p>
                </div>
              </div>
              
              <div className="flex items-center justify-between">
                <Badge className="text-lg px-3 py-1">₹{item.price}</Badge>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-slate-600">Available</span>
                  <Switch
                    checked={item.is_available}
                    onCheckedChange={() => toggleAvailability(item.id)}
                    data-testid={`availability-toggle-${item.id}`}
                  />
                </div>
              </div>
            </Card>
          ))}
        </div>

        {filteredItems.length === 0 && (
          <Card className="p-12 text-center">
            <p className="text-slate-600">No menu items found</p>
          </Card>
        )}
      </div>
    </AdminLayout>
  );
};

export default MenuManagement;
