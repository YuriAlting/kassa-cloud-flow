import { useState, useEffect } from 'react';
import { Link, Outlet, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { UtensilsCrossed, Tag, CreditCard, ShoppingCart, LogOut, LayoutDashboard, Monitor, Map, ClipboardList } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';

export default function RestaurantDashboard() {
  const navigate = useNavigate();
  const { profile, signOut, loading } = useAuth();
  const [restaurantName, setRestaurantName] = useState('');

  useEffect(() => {
    if (loading) return;
    if (!profile || (profile.role !== 'owner' && profile.role !== 'staff')) {
      navigate('/login');
      return;
    }
    if (profile.restaurant_id) {
      supabase
        .from('restaurants')
        .select('name')
        .eq('id', profile.restaurant_id)
        .single()
        .then(({ data }) => {
          if (data) setRestaurantName(data.name);
        });
    }
  }, [profile, loading]);

  const handleLogout = async () => {
    await signOut();
    navigate('/login');
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const isStaff = profile?.role === 'staff';

  const navItems = isStaff
    ? [
        { label: 'Plattegrond', path: '/restaurant/dashboard', icon: Map },
        { label: 'Bestellingen', path: '/restaurant/bestellingen', icon: ClipboardList },
      ]
    : [
        { label: 'Overzicht', path: '/restaurant/dashboard', icon: LayoutDashboard },
        { label: 'Plattegrond', path: '/restaurant/plattegrond', icon: Map },
        { label: 'Menu', path: '/restaurant/menu', icon: UtensilsCrossed },
        { label: 'Categorieën', path: '/restaurant/categories', icon: Tag },
        { label: 'Betaalmethoden', path: '/restaurant/payments', icon: CreditCard },
        { label: 'Bestellingen', path: '/restaurant/orders', icon: ShoppingCart },
        { label: 'POS Kassa', path: '/pos/bestelling', icon: Monitor },
      ];

  return (
    <div className="min-h-screen flex">
      {/* Sidebar */}
      <aside className="w-64 border-r border-border flex flex-col bg-card">
        <div className="p-5 border-b border-border">
          <h1 className="text-lg font-bold text-primary">AIA Kassa</h1>
          <p className="text-sm text-muted-foreground truncate">{restaurantName}</p>
        </div>

        <nav className="flex-1 p-3 space-y-1">
          {navItems.map(item => (
            <Link key={item.path} to={item.path}>
              <motion.div
                whileTap={{ scale: 0.97 }}
                className="flex items-center gap-3 px-4 py-3 rounded-lg text-secondary-foreground hover:bg-secondary transition-colors"
              >
                <item.icon className="w-5 h-5 text-muted-foreground" />
                <span className="font-medium text-sm">{item.label}</span>
              </motion.div>
            </Link>
          ))}
        </nav>

        <div className="p-3 border-t border-border">
          <motion.button
            whileTap={{ scale: 0.95 }}
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-lg text-muted-foreground hover:bg-secondary transition-colors"
          >
            <LogOut className="w-5 h-5" />
            <span className="font-medium text-sm">Uitloggen</span>
          </motion.button>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-y-auto">
        <Outlet />
      </main>
    </div>
  );
}
