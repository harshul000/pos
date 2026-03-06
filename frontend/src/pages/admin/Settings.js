import React, { useState, useEffect } from 'react';
import axios from 'axios';
import AdminLayout from '@/components/AdminLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import { UserPlus, Trash2, ToggleLeft, ToggleRight, Users, Save, Eye, EyeOff, Link } from 'lucide-react';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const Settings = () => {
  const { token } = useAuth();
  const headers = { Authorization: `Bearer ${token}` };

  const [settings, setSettings] = useState({
    hotel_sso_enabled: 'false',
    hotel_sso_secret: '',
    hotel_saas_url: '',
    tax_percentage: '5',
    service_charge_enabled: 'false',
    service_charge_percentage: '10',
  });
  const [settingsLoading, setSettingsLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showSecret, setShowSecret] = useState(false);

  // Waiter management state
  const [waiters, setWaiters] = useState([]);
  const [waitersLoading, setWaitersLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newWaiter, setNewWaiter] = useState({ full_name: '', email: '', password: '', phone: '' });
  const [addingWaiter, setAddingWaiter] = useState(false);

  useEffect(() => {
    fetchSettings();
    fetchWaiters();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const fetchSettings = async () => {
    setSettingsLoading(true);
    try {
      const { data } = await axios.get(`${API}/admin/app-settings`, { headers });
      setSettings(data);
    } catch (err) {
      console.warn('Could not load settings:', err.response?.status);
    } finally {
      setSettingsLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await axios.put(`${API}/admin/app-settings`, settings, { headers });
      toast.success('Settings saved!');
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  const set = (key, value) => setSettings(prev => ({ ...prev, [key]: value }));

  // ─── Waiter management ─────────────────────────────────────────────────────

  const fetchWaiters = async () => {
    setWaitersLoading(true);
    try {
      const { data } = await axios.get(`${API}/admin/waiters`, { headers });
      setWaiters(data);
    } catch (err) {
      console.warn('Could not load waiters:', err.response?.status);
    } finally {
      setWaitersLoading(false);
    }
  };

  const addWaiter = async (e) => {
    e.preventDefault();
    if (!newWaiter.full_name || !newWaiter.email || !newWaiter.password) {
      toast.error('Name, email and password are required');
      return;
    }
    setAddingWaiter(true);
    try {
      await axios.post(`${API}/admin/waiters`, newWaiter, { headers });
      toast.success(`Waiter ${newWaiter.full_name} created!`);
      setNewWaiter({ full_name: '', email: '', password: '', phone: '' });
      setShowAddForm(false);
      fetchWaiters();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to create waiter');
    } finally {
      setAddingWaiter(false);
    }
  };

  const toggleWaiter = async (id) => {
    try {
      const { data } = await axios.patch(`${API}/admin/waiters/${id}/toggle`, {}, { headers });
      setWaiters(ws => ws.map(w => w.id === id ? data : w));
      toast.success(data.is_active ? 'Waiter activated' : 'Waiter deactivated');
    } catch {
      toast.error('Failed to update waiter');
    }
  };

  const deleteWaiter = async (id, name) => {
    if (!window.confirm(`Delete ${name}? This cannot be undone.`)) return;
    try {
      await axios.delete(`${API}/admin/waiters/${id}`, { headers });
      setWaiters(ws => ws.filter(w => w.id !== id));
      toast.success('Waiter deleted');
    } catch {
      toast.error('Failed to delete waiter');
    }
  };

  return (
    <AdminLayout>
      <div data-testid="settings-page">
        <h1 className="text-3xl font-bold text-slate-900 mb-6">Settings</h1>

        <div className="space-y-6">

          {/* ── Staff & Waiters ── */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2"><Users size={18} /> Staff & Waiters</CardTitle>
                <Button onClick={() => setShowAddForm(!showAddForm)} size="sm" className="flex items-center gap-2 bg-[#0F172A] hover:bg-[#0F172A]/90">
                  <UserPlus size={15} /> Add Waiter
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {showAddForm && (
                <form onSubmit={addWaiter} className="border border-slate-200 rounded-xl p-4 space-y-3 bg-slate-50">
                  <p className="text-sm font-semibold text-slate-700">New Waiter Account</p>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs text-slate-500 mb-1 block">Full Name *</label>
                      <Input value={newWaiter.full_name} onChange={e => setNewWaiter({ ...newWaiter, full_name: e.target.value })} placeholder="e.g. Rahul Kumar" required />
                    </div>
                    <div>
                      <label className="text-xs text-slate-500 mb-1 block">Phone</label>
                      <Input value={newWaiter.phone} onChange={e => setNewWaiter({ ...newWaiter, phone: e.target.value })} placeholder="9876543210" type="tel" />
                    </div>
                    <div>
                      <label className="text-xs text-slate-500 mb-1 block">Email *</label>
                      <Input value={newWaiter.email} onChange={e => setNewWaiter({ ...newWaiter, email: e.target.value })} placeholder="waiter@restaurant.com" type="email" required />
                    </div>
                    <div>
                      <label className="text-xs text-slate-500 mb-1 block">Password *</label>
                      <Input value={newWaiter.password} onChange={e => setNewWaiter({ ...newWaiter, password: e.target.value })} placeholder="Min 8 characters" type="password" required />
                    </div>
                  </div>
                  <div className="flex gap-2 justify-end">
                    <Button type="button" variant="outline" size="sm" onClick={() => setShowAddForm(false)}>Cancel</Button>
                    <Button type="submit" size="sm" disabled={addingWaiter} className="bg-[#0F172A] hover:bg-[#0F172A]/90">
                      {addingWaiter ? 'Creating…' : 'Create Waiter'}
                    </Button>
                  </div>
                </form>
              )}
              {waitersLoading ? (
                <p className="text-slate-500 text-sm text-center py-4">Loading staff…</p>
              ) : waiters.length === 0 ? (
                <p className="text-slate-400 text-sm text-center py-4">No waiters yet. Click <strong>Add Waiter</strong> to create one.</p>
              ) : (
                <div className="divide-y divide-slate-100">
                  {waiters.map(w => (
                    <div key={w.id} className="flex items-center gap-3 py-3">
                      <div className="w-9 h-9 rounded-full bg-orange-100 flex items-center justify-center text-orange-600 font-bold text-sm">
                        {w.full_name?.charAt(0) || 'W'}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className={`text-sm font-medium ${w.is_active ? 'text-slate-800' : 'text-slate-400 line-through'}`}>{w.full_name}</p>
                        <p className="text-xs text-slate-400">{w.email}{w.phone ? ` · ${w.phone}` : ''}</p>
                      </div>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${w.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                        {w.is_active ? 'Active' : 'Inactive'}
                      </span>
                      <button onClick={() => toggleWaiter(w.id)} title={w.is_active ? 'Deactivate' : 'Activate'} className="text-slate-400 hover:text-blue-500 transition-colors">
                        {w.is_active ? <ToggleRight size={20} className="text-green-500" /> : <ToggleLeft size={20} />}
                      </button>
                      <button onClick={() => deleteWaiter(w.id, w.full_name)} title="Delete" className="text-slate-300 hover:text-red-500 transition-colors">
                        <Trash2 size={15} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* ── Tax & Service Charge ── */}
          <Card>
            <CardHeader><CardTitle>Tax & Service Charge</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Tax Percentage (%)</label>
                <Input type="number" value={settings.tax_percentage} onChange={e => set('tax_percentage', e.target.value)} data-testid="tax-percentage-input" />
              </div>
              <Separator />
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-medium">Enable Service Charge</div>
                  <div className="text-sm text-slate-600">Add service charge to orders</div>
                </div>
                <Switch checked={settings.service_charge_enabled === 'true'} onCheckedChange={v => set('service_charge_enabled', v ? 'true' : 'false')} data-testid="service-charge-toggle" />
              </div>
              {settings.service_charge_enabled === 'true' && (
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Service Charge (%)</label>
                  <Input type="number" value={settings.service_charge_percentage} onChange={e => set('service_charge_percentage', e.target.value)} />
                </div>
              )}
            </CardContent>
          </Card>

          {/* ── Hotel SaaS Integration ── */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><Link size={17} /> Hotel PMS Integration (SSO)</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-medium">Enable Hotel SSO</div>
                  <div className="text-sm text-slate-600">Allow Hotel PMS users to log in to POS automatically</div>
                </div>
                <Switch
                  checked={settings.hotel_sso_enabled === 'true'}
                  onCheckedChange={v => set('hotel_sso_enabled', v ? 'true' : 'false')}
                  data-testid="hotel-sso-toggle"
                />
              </div>

              <Separator />

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Hotel PMS Base URL</label>
                <Input
                  type="url"
                  placeholder="https://api.yourhotel.com"
                  value={settings.hotel_saas_url}
                  onChange={e => set('hotel_saas_url', e.target.value)}
                  data-testid="hotel-url-input"
                />
                <p className="text-xs text-slate-400 mt-1">The base URL of the Hotel PMS backend</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Shared JWT Secret</label>
                <div className="relative">
                  <Input
                    type={showSecret ? 'text' : 'password'}
                    placeholder="Enter the shared JWT secret from Hotel PMS .env"
                    value={settings.hotel_sso_secret}
                    onChange={e => set('hotel_sso_secret', e.target.value)}
                    className="pr-10 font-mono text-xs"
                    data-testid="hotel-secret-input"
                  />
                  <button
                    type="button"
                    onClick={() => setShowSecret(!showSecret)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700"
                  >
                    {showSecret ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                </div>
                <p className="text-xs text-slate-400 mt-1">
                  Must match <code className="bg-slate-100 px-1 rounded">JWT_SECRET_KEY</code> in the Hotel PMS backend <code className="bg-slate-100 px-1 rounded">.env</code>
                </p>
              </div>

              {settings.hotel_sso_enabled === 'true' && settings.hotel_sso_secret && (
                <div className="bg-green-50 border border-green-200 rounded-xl p-3 text-sm text-green-800">
                  ✅ SSO is active — Hotel PMS users with a valid JWT will be auto-logged into POS
                </div>
              )}
              {settings.hotel_sso_enabled === 'false' && (
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-sm text-amber-800">
                  ⚠️ SSO is currently disabled — toggle it on and enter the shared secret to activate
                </div>
              )}
            </CardContent>
          </Card>

          <Button
            onClick={handleSave}
            disabled={saving || settingsLoading}
            className="w-full bg-[#0F172A] hover:bg-[#0F172A]/90 py-6 text-lg font-medium flex items-center justify-center gap-2"
            data-testid="save-settings-button"
          >
            <Save size={18} />
            {saving ? 'Saving…' : 'Save All Settings'}
          </Button>
        </div>
      </div>
    </AdminLayout>
  );
};

export default Settings;
