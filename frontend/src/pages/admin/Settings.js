import React, { useState } from 'react';
import AdminLayout from '@/components/AdminLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { toast } from 'sonner';

const Settings = () => {
  const [settings, setSettings] = useState({
    taxPercentage: 5,
    serviceChargeEnabled: false,
    serviceChargePercentage: 10,
    cashEnabled: true,
    razorpayEnabled: true,
    upiEnabled: true,
    cardEnabled: true,
    hotelSaasEnabled: false,
    hotelSaasUrl: '',
    hotelSaasSecret: ''
  });

  const handleSave = () => {
    toast.success('Settings saved successfully');
  };

  return (
    <AdminLayout>
      <div data-testid="settings-page">
        <h1 className="text-3xl font-bold text-slate-900 mb-6">Settings</h1>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Tax & Service Charge</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Tax Percentage (%)</label>
                <Input
                  type="number"
                  value={settings.taxPercentage}
                  onChange={(e) => setSettings({ ...settings, taxPercentage: parseFloat(e.target.value) })}
                  data-testid="tax-percentage-input"
                />
              </div>
              
              <Separator />
              
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-medium">Enable Service Charge</div>
                  <div className="text-sm text-slate-600">Add service charge to orders</div>
                </div>
                <Switch
                  checked={settings.serviceChargeEnabled}
                  onCheckedChange={(checked) => setSettings({ ...settings, serviceChargeEnabled: checked })}
                  data-testid="service-charge-toggle"
                />
              </div>
              
              {settings.serviceChargeEnabled && (
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Service Charge (%)</label>
                  <Input
                    type="number"
                    value={settings.serviceChargePercentage}
                    onChange={(e) => setSettings({ ...settings, serviceChargePercentage: parseFloat(e.target.value) })}
                  />
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Payment Methods</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-medium">Cash</div>
                  <div className="text-sm text-slate-600">Accept cash payments</div>
                </div>
                <Switch
                  checked={settings.cashEnabled}
                  onCheckedChange={(checked) => setSettings({ ...settings, cashEnabled: checked })}
                  data-testid="cash-toggle"
                />
              </div>
              
              <Separator />
              
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-medium">Razorpay</div>
                  <div className="text-sm text-slate-600">Accept online payments via Razorpay</div>
                </div>
                <Switch
                  checked={settings.razorpayEnabled}
                  onCheckedChange={(checked) => setSettings({ ...settings, razorpayEnabled: checked })}
                  data-testid="razorpay-toggle"
                />
              </div>
              
              <Separator />
              
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-medium">UPI</div>
                  <div className="text-sm text-slate-600">Accept UPI payments</div>
                </div>
                <Switch
                  checked={settings.upiEnabled}
                  onCheckedChange={(checked) => setSettings({ ...settings, upiEnabled: checked })}
                />
              </div>
              
              <Separator />
              
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-medium">Card</div>
                  <div className="text-sm text-slate-600">Accept card payments</div>
                </div>
                <Switch
                  checked={settings.cardEnabled}
                  onCheckedChange={(checked) => setSettings({ ...settings, cardEnabled: checked })}
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Hotel SaaS Integration</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-medium">Enable Hotel SSO</div>
                  <div className="text-sm text-slate-600">Allow guests to login using hotel credentials</div>
                </div>
                <Switch
                  checked={settings.hotelSaasEnabled}
                  onCheckedChange={(checked) => setSettings({ ...settings, hotelSaasEnabled: checked })}
                  data-testid="hotel-sso-toggle"
                />
              </div>
              
              {settings.hotelSaasEnabled && (
                <>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">Hotel SaaS Base URL</label>
                    <Input
                      type="url"
                      placeholder="https://api.dhsolutions.com"
                      value={settings.hotelSaasUrl}
                      onChange={(e) => setSettings({ ...settings, hotelSaasUrl: e.target.value })}
                      data-testid="hotel-url-input"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">Shared JWT Secret</label>
                    <Input
                      type="password"
                      placeholder="Enter shared secret"
                      value={settings.hotelSaasSecret}
                      onChange={(e) => setSettings({ ...settings, hotelSaasSecret: e.target.value })}
                      data-testid="hotel-secret-input"
                    />
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          <Button
            onClick={handleSave}
            className="w-full bg-[#1A2E05] hover:bg-[#1A2E05]/90 py-6 text-lg font-medium"
            data-testid="save-settings-button"
          >
            Save Settings
          </Button>
        </div>
      </div>
    </AdminLayout>
  );
};

export default Settings;
