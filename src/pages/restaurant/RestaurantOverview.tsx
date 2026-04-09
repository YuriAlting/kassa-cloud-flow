import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { ShoppingCart, DollarSign } from 'lucide-react';
import { motion } from 'framer-motion';

export default function RestaurantOverview() {
  const { profile } = useAuth();
  const [stats, setStats] = useState({ orders: 0, revenue: 0 });

  useEffect(() => {
    if (!profile?.restaurant_id) return;
    const today = new Date().toISOString().split('T')[0];

    supabase
      .from('orders')
      .select('total_amount')
      .eq('restaurant_id', profile.restaurant_id)
      .gte('created_at', today)
      .then(({ data }) => {
        setStats({
          orders: data?.length || 0,
          revenue: data?.reduce((s, o) => s + Number(o.total_amount), 0) || 0,
        });
      });
  }, [profile?.restaurant_id]);

  const cards = [
    { label: 'Bestellingen vandaag', value: stats.orders, icon: ShoppingCart },
    { label: 'Omzet vandaag', value: `€${stats.revenue.toFixed(2)}`, icon: DollarSign },
  ];

  return (
    <div className="p-6 space-y-6">
      <h2 className="text-xl font-bold">Overzicht</h2>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {cards.map(c => (
          <motion.div key={c.label} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="surface p-5">
            <div className="flex items-center gap-3 mb-2">
              <c.icon className="w-5 h-5 text-primary" />
              <span className="text-sm text-muted-foreground">{c.label}</span>
            </div>
            <p className="text-2xl font-bold">{c.value}</p>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
