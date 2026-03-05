import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { toast } from 'sonner';
import { Lock, Mail } from 'lucide-react';

const AdminLogin = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    const result = await login(email, password);
    
    if (result.success) {
      toast.success('Login successful');
      navigate('/admin/dashboard');
    } else {
      toast.error(result.error || 'Invalid credentials');
    }
    
    setLoading(false);
  };

  return (
    <div 
      className="min-h-screen flex items-center justify-center p-4"
      style={{
        backgroundImage: 'url(https://images.unsplash.com/photo-1768949005507-8c0f571285f4?crop=entropy&cs=srgb&fm=jpg&q=85)',
        backgroundSize: 'cover',
        backgroundPosition: 'center'
      }}
    >
      <div className="absolute inset-0 bg-black/50" />
      
      <Card className="relative w-full max-w-md p-8 bg-white/95 backdrop-blur-sm shadow-2xl" data-testid="admin-login-form">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-[#0F172A] mb-2" style={{ fontFamily: "'Playfair Display', serif" }}>
            DH POS Admin
          </h1>
          <p className="text-slate-600">Sign in to manage your restaurant</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">Email</label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
              <Input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="admin@dhpos.com"
                className="pl-10"
                required
                data-testid="email-input"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">Password</label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
              <Input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="pl-10"
                required
                data-testid="password-input"
              />
            </div>
          </div>

          <Button
            type="submit"
            disabled={loading}
            className="w-full bg-[#0F172A] hover:bg-[#0F172A]/90 text-white py-6 text-lg font-medium rounded-lg"
            data-testid="login-button"
          >
            {loading ? 'Signing in...' : 'Sign In'}
          </Button>
        </form>

        <div className="mt-6 text-center text-sm text-slate-600">
          <p>Demo: admin@dhpos.com / Admin@123</p>
        </div>
      </Card>
    </div>
  );
};

export default AdminLogin;
