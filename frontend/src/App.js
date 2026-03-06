import React from "react";
import "./App.css";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "./contexts/AuthContext";
import { CartProvider } from "./contexts/CartContext";
import { Toaster } from "./components/ui/sonner";

import CustomerOrder from "./pages/CustomerOrder";
import OrderStatusPage from "./pages/OrderStatusPage";

import AdminLogin from "./pages/admin/AdminLogin";
import AdminDashboard from "./pages/admin/AdminDashboard";
import LiveOrders from "./pages/admin/LiveOrders";
import OrdersList from "./pages/admin/OrdersList";
import MenuManagement from "./pages/admin/MenuManagement";
import TableManagement from "./pages/admin/TableManagement";
import Analytics from "./pages/admin/Analytics";
import Settings from "./pages/admin/Settings";
import QRCodePage from "./pages/admin/QRCodePage";
import SSOPage from "./pages/SSOPage";

import WaiterLayout from "./pages/waiter/WaiterLayout";
import WaiterDashboard from "./pages/waiter/WaiterDashboard";
import NewOrder from "./pages/waiter/NewOrder";
import MyOrders from "./pages/waiter/MyOrders";
import OrderDetail from "./pages/waiter/OrderDetail";

// Guard for admin-only routes
const ProtectedRoute = ({ children }) => {
  const { user, loading, isAdmin } = useAuth();
  if (loading) return <div className="min-h-screen flex items-center justify-center"><div className="animate-pulse text-xl text-white">Loading...</div></div>;
  if (!user || !isAdmin()) return <Navigate to="/admin/login" replace />;
  return children;
};

// Guard for waiter routes (staff role)
const WaiterRoute = ({ children }) => {
  const { user, loading } = useAuth();
  if (loading) return <div className="min-h-screen flex items-center justify-center bg-gray-950"><div className="animate-pulse text-xl text-white">Loading...</div></div>;
  if (!user) return <Navigate to="/admin/login" replace />;
  if (!['staff', 'super_admin', 'pos_admin'].includes(user.role)) return <Navigate to="/admin/login" replace />;
  return children;
};

function App() {
  return (
    <AuthProvider>
      <CartProvider>
        <div className="App">
          <BrowserRouter>
            <Routes>
              {/* Public / QR */}
              <Route path="/order" element={<CustomerOrder />} />
              <Route path="/order-status/:orderId" element={<OrderStatusPage />} />
              <Route path="/qr/:qrToken" element={<CustomerOrder />} />
              <Route path="/qr/:qrToken/menu" element={<CustomerOrder />} />
              <Route path="/qr/:qrToken/checkout" element={<CustomerOrder />} />
              <Route path="/qr/:qrToken/order/:orderId" element={<OrderStatusPage />} />
              <Route path="/sso" element={<SSOPage />} />

              {/* Auth */}
              <Route path="/admin/login" element={<AdminLogin />} />

              {/* Admin routes */}
              <Route path="/admin/dashboard" element={<ProtectedRoute><AdminDashboard /></ProtectedRoute>} />
              <Route path="/admin/live-orders" element={<ProtectedRoute><LiveOrders /></ProtectedRoute>} />
              <Route path="/admin/orders" element={<ProtectedRoute><OrdersList /></ProtectedRoute>} />
              <Route path="/admin/menu" element={<ProtectedRoute><MenuManagement /></ProtectedRoute>} />
              <Route path="/admin/tables" element={<ProtectedRoute><TableManagement /></ProtectedRoute>} />
              <Route path="/admin/analytics" element={<ProtectedRoute><Analytics /></ProtectedRoute>} />
              <Route path="/admin/settings" element={<ProtectedRoute><Settings /></ProtectedRoute>} />
              <Route path="/admin/qr-code" element={<ProtectedRoute><QRCodePage /></ProtectedRoute>} />

              {/* Waiter portal */}
              <Route path="/waiter" element={<WaiterRoute><WaiterLayout /></WaiterRoute>}>
                <Route index element={<Navigate to="/waiter/dashboard" replace />} />
                <Route path="dashboard" element={<WaiterDashboard />} />
                <Route path="new-order" element={<NewOrder />} />
                <Route path="orders" element={<MyOrders />} />
                <Route path="orders/:orderId" element={<OrderDetail />} />
              </Route>

              {/* Catch-all */}
              <Route path="/" element={<Navigate to="/admin/login" replace />} />
              <Route path="*" element={<Navigate to="/admin/login" replace />} />
            </Routes>
          </BrowserRouter>
          <Toaster position="top-right" richColors />
        </div>
      </CartProvider>
    </AuthProvider>
  );
}

export default App;
