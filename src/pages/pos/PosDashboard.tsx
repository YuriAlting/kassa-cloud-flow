import { useState, useEffect } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { Users, ShoppingCart, DollarSign, Package, Table2, UserCog, BarChart3, ArrowLeft } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { usePosStore } from '@/stores/posStore';

export default function PosDashboard() {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const { restaurantId, restaurantNaam, medewerkerNaam } = usePosStore();

  const [stats, setStats] = useState({ omzet: 0, orders: 0, openTafels: 0, staffOnline: 0 });
  const [topProducts, setTopProducts] = useState<{ naam: string; count: number }[]>([]);

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
      .select('totaal, items')
      .eq('restaurant_id', restaurantId)
      .gte('aangemaakt_op', today);

    const omzet = orders?.reduce((s, o) => s + Number(o.totaal), 0) || 0;

    const { count: openTafels } = await supabase
      .from('tafels')
      .select('id', { count: 'exact', head: true })
      .eq('restaurant_id', restaurantId)
      .neq('status', 'vrij');

    const { count: staffOnline } = await supabase
      .from('shifts')
      .select('id', { count: 'exact', head: true })
      .eq('restaurant_id', restaurantId)
      .is('uitgelogd_op', null);

    setStats({
      omzet,
      orders: orders?.length || 0,
      openTafels: openTafels || 0,
      staffOnline: staffOnline || 0,
    });

    // Top products
    const productCounts: Record<string, number> = {};
    orders?.forEach(o => {
      const items = o.items as { naam: string; aantal: number }[];
      items?.forEach(item => {
        productCounts[item.naam] = (productCounts[item.naam] || 0) + item.aantal;
      });
    });
    const sorted = Object.entries(productCounts)
      .map(([naam, count]) => ({ naam, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);
    setTopProducts(sorted);
  }

  const statCards = [
    { label: 'Omzet vandaag', value: `€${stats.omzet.toFixed(2)}`, icon: DollarSign },
    { label: 'Bestellingen', value: stats.orders, icon: ShoppingCart },
    { label: 'Bezette tafels', value: stats.openTafels, icon: Table2 },
    { label: 'Staff online', value: stats.staffOnline, icon: Users },
  ];

  const navItems = [
    { label: 'POS Terminal', path: `/pos/${slug}/tafels`, icon: ShoppingCart },
    { label: 'Producten', path: `/pos/${slug}/producten`, icon: Package },
    { label: 'Tafels', path: `/pos/${slug}/tafelbeheer`, icon: Table2 },
    { label: 'Medewerkers', path: `/pos/${slug}/medewerkers`, icon: UserCog },
    { label: 'Rapporten', path: `/pos/${slug}/rapporten`, icon: BarChart3 },
  ];

  return (
    <div className="min-h-screen p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">{restaurantNaam}</h1>
          <p className="text-muted-foreground">Dashboard — {medewerkerNaam}</p>
        </div>
        <motion.button
          whileTap={{ scale: 0.95 }}
          onClick={() => navigate(`/pos/${slug}`)}
          className="touch-target px-5 py-3 rounded-lg bg-secondary text-secondary-foreground font-medium"
        >
          Uitloggen
        </motion.button>
      </div>

      {/* Stats */}
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

      {/* Quick nav */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
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

      {/* Top products chart */}
      {topProducts.length > 0 && (
        <div className="surface p-5">
          <h3 className="font-semibold mb-4">Top producten vandaag</h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={topProducts} layout="vertical">
              <XAxis type="number" stroke="hsl(0 0% 55%)" />
              <YAxis type="category" dataKey="naam" width={120} stroke="hsl(0 0% 55%)" tick={{ fontSize: 12 }} />
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
