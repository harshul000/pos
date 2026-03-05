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

const ProtectedRoute = ({ children }) => {
  const { user, loading, isAdmin } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-pulse text-xl">Loading...</div>
      </div>
    );
  }

  if (!user || !isAdmin()) {
    return <Navigate to="/admin/login" replace />;
  }

  return children;
};

function App() {
  return (
    <AuthProvider>
      <CartProvider>
        <div className="App">
          <BrowserRouter>
            <Routes>
              <Route path="/order" element={<CustomerOrder />} />
              <Route path="/order-status/:orderId" element={<OrderStatusPage />} />
              
              <Route path="/qr/:qrToken" element={<CustomerOrder />} />
              <Route path="/qr/:qrToken/menu" element={<CustomerOrder />} />
              <Route path="/qr/:qrToken/checkout" element={<CustomerOrder />} />
              <Route path="/qr/:qrToken/order/:orderId" element={<OrderStatusPage />} />

              <Route path="/admin/login" element={<AdminLogin />} />
              
              <Route
                path="/admin/dashboard"
                element={
                  <ProtectedRoute>
                    <AdminDashboard />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/admin/live-orders"
                element={
                  <ProtectedRoute>
                    <LiveOrders />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/admin/orders"
                element={
                  <ProtectedRoute>
                    <OrdersList />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/admin/menu"
                element={
                  <ProtectedRoute>
                    <MenuManagement />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/admin/tables"
                element={
                  <ProtectedRoute>
                    <TableManagement />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/admin/analytics"
                element={
                  <ProtectedRoute>
                    <Analytics />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/admin/settings"
                element={
                  <ProtectedRoute>
                    <Settings />
                  </ProtectedRoute>
                }
              />

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
