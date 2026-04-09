import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { ShoppingCart, DollarSign, BarChart3, LogOut } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export default function PosDashboard() {
  const navigate = useNavigate();
  const { user, profile, loading: authLoading, signOut } = useAuth();

  const [stats, setStats] = useState({ omzet: 0, orders: 0 });
  const [topProducts, setTopProducts] = useState<{ name: string; count: number }[]>([]);
  const [restaurantName, setRestaurantName] = useState('');

  useEffect(() => {
    if (authLoading) return;
    if (!user || !profile?.restaurant_id) {
      navigate('/login');
      return;
    }
    // Staff should never see this page — redirect to floor plan
    if (profile.role === 'staff') {
      navigate('/restaurant/dashboard', { replace: true });
      return;
    }
    loadRestaurant();
    loadStats();
  }, [authLoading, user, profile]);

  async function loadRestaurant() {
    const { data } = await supabase.from('restaurants').select('name').eq('id', profile!.restaurant_id!).single();
    if (data) setRestaurantName(data.name);
  }

  async function loadStats() {
    const restaurantId = profile!.restaurant_id!;
    const today = new Date().toISOString().split('T')[0];
    const { data: orders } = await supabase.from('orders').select('total_amount').eq('restaurant_id', restaurantId).gte('created_at', today);
    const omzet = orders?.reduce((s, o) => s + Number(o.total_amount), 0) || 0;
    setStats({ omzet, orders: orders?.length || 0 });

    const { data: orderIds } = await supabase.from('orders').select('id').eq('restaurant_id', restaurantId).gte('created_at', today);
    if (orderIds && orderIds.length > 0) {
      const { data: items } = await supabase.from('order_items').select('name_snapshot, quantity').in('order_id', orderIds.map(o => o.id));
      const productCounts: Record<string, number> = {};
      items?.forEach(item => { productCounts[item.name_snapshot] = (productCounts[item.name_snapshot] || 0) + item.quantity; });
      setTopProducts(Object.entries(productCounts).map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count).slice(0, 10));
    }
  }

  const handleLogout = async () => { await signOut(); navigate('/login'); };

  if (authLoading) {
    return (<div className="min-h-screen flex items-center justify-center"><div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" /></div>);
  }

  const statCards = [
    { label: 'Omzet vandaag', value: `€${stats.omzet.toFixed(2)}`, icon: DollarSign },
    { label: 'Bestellingen', value: stats.orders, icon: ShoppingCart },
  ];

  return (
    <div className="min-h-screen p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">{restaurantName}</h1>
          <p className="text-muted-foreground">Dashboard — {profile?.full_name || 'Gebruiker'}</p>
        </div>
        <motion.button whileTap={{ scale: 0.95 }} onClick={handleLogout}
          className="touch-target px-5 py-3 rounded-lg bg-secondary text-secondary-foreground font-medium flex items-center gap-2">
          <LogOut className="w-4 h-4" /> Uitloggen
        </motion.button>
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map(card => (
          <motion.div key={card.label} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="surface p-5">
            <div className="flex items-center gap-3 mb-2"><card.icon className="w-5 h-5 text-primary" /><span className="text-sm text-muted-foreground">{card.label}</span></div>
            <p className="text-2xl font-bold">{card.value}</p>
          </motion.div>
        ))}
      </div>
      {topProducts.length > 0 && (
        <div className="surface p-5">
          <h3 className="font-semibold mb-4">Top producten vandaag</h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={topProducts} layout="vertical">
              <XAxis type="number" stroke="hsl(0 0% 55%)" />
              <YAxis type="category" dataKey="name" width={120} stroke="hsl(0 0% 55%)" tick={{ fontSize: 12 }} />
              <Tooltip contentStyle={{ background: 'hsl(0 0% 8%)', border: 'none', borderRadius: 8 }} labelStyle={{ color: 'hsl(0 0% 95%)' }} />
              <Bar dataKey="count" fill="hsl(38 92% 50%)" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
