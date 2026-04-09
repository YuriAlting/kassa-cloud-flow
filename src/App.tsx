import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import Index from "./pages/Index";
import NotFound from "./pages/NotFound";
import PosLogin from "./pages/pos/PosLogin";
import PosTafels from "./pages/pos/PosTafels";
import PosBestelling from "./pages/pos/PosBestelling";
import PosDashboard from "./pages/pos/PosDashboard";
import AdminLogin from "./pages/admin/AdminLogin";
import AdminDashboard from "./pages/admin/AdminDashboard";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Index />} />
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
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
