import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, Navigate } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/contexts/AuthContext";
import Index from "./pages/Index";
import NotFound from "./pages/NotFound";
import Login from "./pages/Login";
import PosBestelling from "./pages/pos/PosBestelling";
import AdminLogin from "./pages/admin/AdminLogin";
import AdminDashboard from "./pages/admin/AdminDashboard";
import AdminFloorPlan from "./pages/admin/AdminFloorPlan";
import RestaurantDashboard from "./pages/restaurant/RestaurantDashboard";
import DashboardRouter from "./pages/restaurant/DashboardRouter";
import MenuPage from "./pages/restaurant/MenuPage";
import CategoriesPage from "./pages/restaurant/CategoriesPage";
import OrdersPage from "./pages/restaurant/OrdersPage";
import StaffDashboard from "./pages/restaurant/StaffDashboard";
import FloorPlanPage from "./pages/restaurant/FloorPlanPage";
import SettingsPage from "./pages/restaurant/SettingsPage";
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
              <Route path="dashboard" element={<DashboardRouter />} />
              <Route path="menu" element={<MenuPage />} />
              <Route path="categories" element={<CategoriesPage />} />
              <Route path="orders" element={<OrdersPage />} />
              <Route path="bestellingen" element={<StaffDashboard />} />
              <Route path="plattegrond" element={<FloorPlanPage />} />
              <Route path="instellingen" element={<SettingsPage />} />
              <Route path="kassa" element={<PosBestelling />} />
            </Route>
            {/* Redirect old POS routes */}
            <Route path="/pos/dashboard" element={<Navigate to="/restaurant/dashboard" replace />} />
            <Route path="/pos/bestelling" element={<Navigate to="/restaurant/kassa" replace />} />
            {/* Superadmin */}
            <Route path="/admin" element={<AdminLogin />} />
            <Route path="/admin/dashboard" element={<AdminDashboard />} />
            <Route path="/admin/plattegrond" element={<AdminFloorPlan />} />
            {/* Catch-all */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
