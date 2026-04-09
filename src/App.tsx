import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/contexts/AuthContext";
import Index from "./pages/Index";
import NotFound from "./pages/NotFound";
import Login from "./pages/Login";
import PosDashboard from "./pages/pos/PosDashboard";
import PosBestelling from "./pages/pos/PosBestelling";
import AdminLogin from "./pages/admin/AdminLogin";
import AdminDashboard from "./pages/admin/AdminDashboard";
import RestaurantDashboard from "./pages/restaurant/RestaurantDashboard";
import DashboardRouter from "./pages/restaurant/DashboardRouter";
import MenuPage from "./pages/restaurant/MenuPage";
import CategoriesPage from "./pages/restaurant/CategoriesPage";
import PaymentMethodsPage from "./pages/restaurant/PaymentMethodsPage";
import OrdersPage from "./pages/restaurant/OrdersPage";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/login" element={<Login />} />
            {/* Restaurant Owner/Staff */}
            <Route path="/restaurant" element={<RestaurantDashboard />}>
              <Route path="dashboard" element={<RestaurantOverview />} />
              <Route path="menu" element={<MenuPage />} />
              <Route path="categories" element={<CategoriesPage />} />
              <Route path="payments" element={<PaymentMethodsPage />} />
              <Route path="orders" element={<OrdersPage />} />
            </Route>
            {/* POS Terminal — no slug needed */}
            <Route path="/pos/dashboard" element={<PosDashboard />} />
            <Route path="/pos/bestelling" element={<PosBestelling />} />
            {/* Superadmin */}
            <Route path="/admin" element={<AdminLogin />} />
            <Route path="/admin/dashboard" element={<AdminDashboard />} />
            {/* Catch-all */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
