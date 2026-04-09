import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/contexts/AuthContext";
import Index from "./pages/Index";
import NotFound from "./pages/NotFound";
import Login from "./pages/Login";
import PosLogin from "./pages/pos/PosLogin";
import PosTafels from "./pages/pos/PosTafels";
import PosBestelling from "./pages/pos/PosBestelling";
import PosDashboard from "./pages/pos/PosDashboard";
import AdminLogin from "./pages/admin/AdminLogin";
import AdminDashboard from "./pages/admin/AdminDashboard";
import RestaurantDashboard from "./pages/restaurant/RestaurantDashboard";
import RestaurantOverview from "./pages/restaurant/RestaurantOverview";
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
            {/* POS Terminal */}
            <Route path="/pos/:slug" element={<PosLogin />} />
            <Route path="/pos/:slug/tafels" element={<PosTafels />} />
            <Route path="/pos/:slug/bestelling" element={<PosBestelling />} />
            <Route path="/pos/:slug/dashboard" element={<PosDashboard />} />
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
