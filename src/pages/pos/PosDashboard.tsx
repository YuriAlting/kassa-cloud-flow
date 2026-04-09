import { useState, useEffect } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { ShoppingCart, DollarSign, BarChart3, ArrowLeft } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { usePosStore } from '@/stores/posStore';

export default function PosDashboard() {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const { restaurantId, restaurantName, profileName } = usePosStore();

  const [stats, setStats] = useState({ omzet: 0, orders: 0 });
  const [topProducts, setTopProducts] = useState<{ name: string; count: number }[]>([]);

  useEffect(() => {
    if (!restaurantId) {
      navigate(`/pos/${slug}`);
      return;
    }
    loadStats();
  }, [restaurantId]);

  async function loadStats() {
    const today = new Date().toISOString().split('T')[0];

    const { data: orders } = await supabase
      .from('orders')
      .select('total_amount')
      .eq('restaurant_id', restaurantId)
      .gte('created_at', today);

    const omzet = orders?.reduce((s, o) => s + Number(o.total_amount), 0) || 0;

    setStats({
      omzet,
      orders: orders?.length || 0,
    });

    // Top products from order_items
    const { data: orderIds } = await supabase
      .from('orders')
      .select('id')
      .eq('restaurant_id', restaurantId!)
      .gte('created_at', today);

    if (orderIds && orderIds.length > 0) {
      const { data: items } = await supabase
        .from('order_items')
        .select('name_snapshot, quantity')
        .in('order_id', orderIds.map(o => o.id));

      const productCounts: Record<string, number> = {};
      items?.forEach(item => {
        productCounts[item.name_snapshot] = (productCounts[item.name_snapshot] || 0) + item.quantity;
      });
      const sorted = Object.entries(productCounts)
        .map(([name, count]) => ({ name, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 10);
      setTopProducts(sorted);
    }
  }

  const statCards = [
    { label: 'Omzet vandaag', value: `€${stats.omzet.toFixed(2)}`, icon: DollarSign },
    { label: 'Bestellingen', value: stats.orders, icon: ShoppingCart },
  ];

  const navItems = [
    { label: 'Nieuwe bestelling', path: `/pos/${slug}/bestelling`, icon: ShoppingCart },
    { label: 'Rapporten', path: `/pos/${slug}/rapporten`, icon: BarChart3 },
  ];

  return (
    <div className="min-h-screen p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">{restaurantName}</h1>
          <p className="text-muted-foreground">Dashboard — {profileName}</p>
        </div>
        <motion.button
          whileTap={{ scale: 0.95 }}
          onClick={() => { usePosStore.getState().logout(); navigate(`/pos/${slug}`); }}
          className="touch-target px-5 py-3 rounded-lg bg-secondary text-secondary-foreground font-medium"
        >
          Uitloggen
        </motion.button>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map(card => (
          <motion.div
            key={card.label}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="surface p-5"
          >
            <div className="flex items-center gap-3 mb-2">
              <card.icon className="w-5 h-5 text-primary" />
              <span className="text-sm text-muted-foreground">{card.label}</span>
            </div>
            <p className="text-2xl font-bold">{card.value}</p>
          </motion.div>
        ))}
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {navItems.map(item => (
          <Link key={item.path} to={item.path}>
            <motion.div
              whileTap={{ scale: 0.95 }}
              className="surface surface-hover p-4 flex items-center gap-3"
            >
              <item.icon className="w-5 h-5 text-primary" />
              <span className="font-medium">{item.label}</span>
            </motion.div>
          </Link>
        ))}
      </div>

      {topProducts.length > 0 && (
        <div className="surface p-5">
          <h3 className="font-semibold mb-4">Top producten vandaag</h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={topProducts} layout="vertical">
              <XAxis type="number" stroke="hsl(0 0% 55%)" />
              <YAxis type="category" dataKey="name" width={120} stroke="hsl(0 0% 55%)" tick={{ fontSize: 12 }} />
              <Tooltip
                contentStyle={{ background: 'hsl(0 0% 8%)', border: 'none', borderRadius: 8 }}
                labelStyle={{ color: 'hsl(0 0% 95%)' }}
              />
              <Bar dataKey="count" fill="hsl(38 92% 50%)" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
