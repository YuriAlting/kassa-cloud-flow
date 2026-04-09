import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { ShoppingCart, DollarSign, TrendingUp, TrendingDown } from 'lucide-react';
import { motion } from 'framer-motion';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts';

const PAYMENT_COLORS = ['hsl(var(--primary))', 'hsl(var(--accent))', 'hsl(142 76% 36%)', 'hsl(280 65% 60%)'];

function getWeekRange(weeksAgo: number) {
  const now = new Date();
  const dayOfWeek = now.getDay() === 0 ? 7 : now.getDay(); // Monday=1
  const monday = new Date(now);
  monday.setDate(now.getDate() - dayOfWeek + 1 - weeksAgo * 7);
  monday.setHours(0, 0, 0, 0);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  sunday.setHours(23, 59, 59, 999);
  return { start: monday.toISOString(), end: sunday.toISOString() };
}

export default function RestaurantOverview() {
  const { profile } = useAuth();
  const [stats, setStats] = useState({ orders: 0, revenue: 0 });
  const [weeklyRevenue, setWeeklyRevenue] = useState({ thisWeek: 0, lastWeek: 0 });
  const [paymentDist, setPaymentDist] = useState<{ name: string; count: number }[]>([]);

  useEffect(() => {
    if (!profile?.restaurant_id) return;
    const restaurantId = profile.restaurant_id;
    const today = new Date().toISOString().split('T')[0];

    // Today's stats
    supabase
      .from('orders')
      .select('total_amount')
      .eq('restaurant_id', restaurantId)
      .gte('created_at', today)
      .then(({ data }) => {
        setStats({
          orders: data?.length || 0,
          revenue: data?.reduce((s, o) => s + Number(o.total_amount), 0) || 0,
        });
      });

    // Weekly revenue comparison
    const thisWeekRange = getWeekRange(0);
    const lastWeekRange = getWeekRange(1);

    Promise.all([
      supabase
        .from('orders')
        .select('total_amount')
        .eq('restaurant_id', restaurantId)
        .gte('created_at', thisWeekRange.start)
        .lte('created_at', thisWeekRange.end),
      supabase
        .from('orders')
        .select('total_amount')
        .eq('restaurant_id', restaurantId)
        .gte('created_at', lastWeekRange.start)
        .lte('created_at', lastWeekRange.end),
    ]).then(([thisWeekRes, lastWeekRes]) => {
      setWeeklyRevenue({
        thisWeek: thisWeekRes.data?.reduce((s, o) => s + Number(o.total_amount), 0) || 0,
        lastWeek: lastWeekRes.data?.reduce((s, o) => s + Number(o.total_amount), 0) || 0,
      });
    });

    // Payment method distribution
    supabase
      .from('orders')
      .select('payment_method_id, payment_methods(name)')
      .eq('restaurant_id', restaurantId)
      .not('payment_method_id', 'is', null)
      .then(({ data }) => {
        if (!data) return;
        const counts: Record<string, number> = {};
        data.forEach((o: any) => {
          const name = o.payment_methods?.name || 'Onbekend';
          counts[name] = (counts[name] || 0) + 1;
        });
        setPaymentDist(Object.entries(counts).map(([name, count]) => ({ name, count })));
      });
  }, [profile?.restaurant_id]);

  const weekDiff = weeklyRevenue.lastWeek > 0
    ? ((weeklyRevenue.thisWeek - weeklyRevenue.lastWeek) / weeklyRevenue.lastWeek) * 100
    : weeklyRevenue.thisWeek > 0 ? 100 : 0;
  const weekUp = weekDiff >= 0;

  const totalPayments = paymentDist.reduce((s, p) => s + p.count, 0);

  const kpiCards = [
    { label: 'Bestellingen vandaag', value: stats.orders, icon: ShoppingCart },
    { label: 'Omzet vandaag', value: `€${stats.revenue.toFixed(2)}`, icon: DollarSign },
  ];

  return (
    <div className="p-6 space-y-6">
      <h2 className="text-xl font-bold">Overzicht</h2>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
        {kpiCards.map(c => (
          <motion.div key={c.label} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="surface p-5">
            <div className="flex items-center gap-3 mb-2">
              <c.icon className="w-5 h-5 text-primary" />
              <span className="text-sm text-muted-foreground">{c.label}</span>
            </div>
            <p className="text-2xl font-bold">{c.value}</p>
          </motion.div>
        ))}

        {/* Weekly Revenue Comparison */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="surface p-5">
          <div className="flex items-center gap-3 mb-2">
            {weekUp ? (
              <TrendingUp className="w-5 h-5 text-green-500" />
            ) : (
              <TrendingDown className="w-5 h-5 text-red-500" />
            )}
            <span className="text-sm text-muted-foreground">Week vergelijking</span>
          </div>
          <p className="text-2xl font-bold">€{weeklyRevenue.thisWeek.toFixed(2)}</p>
          <div className="flex items-center gap-2 mt-1">
            <span className={`text-sm font-semibold ${weekUp ? 'text-green-500' : 'text-red-500'}`}>
              {weekUp ? '+' : ''}{weekDiff.toFixed(1)}%
            </span>
            <span className="text-xs text-muted-foreground">
              vs vorige week (€{weeklyRevenue.lastWeek.toFixed(2)})
            </span>
          </div>
        </motion.div>
      </div>

      {/* Payment Method Distribution */}
      {paymentDist.length > 0 && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="surface p-5">
          <h3 className="font-semibold mb-4">Betaalmethode verdeling</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-center">
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={paymentDist}
                    dataKey="count"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    outerRadius={90}
                    innerRadius={50}
                    paddingAngle={3}
                    label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                  >
                    {paymentDist.map((_, i) => (
                      <Cell key={i} fill={PAYMENT_COLORS[i % PAYMENT_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value: number) => [`${value} bestellingen`, 'Aantal']} />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="space-y-3">
              {paymentDist.map((p, i) => (
                <div key={p.name} className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div
                      className="w-3 h-3 rounded-full"
                      style={{ backgroundColor: PAYMENT_COLORS[i % PAYMENT_COLORS.length] }}
                    />
                    <span className="font-medium">{p.name}</span>
                  </div>
                  <div className="text-right">
                    <span className="font-semibold">{p.count}</span>
                    <span className="text-sm text-muted-foreground ml-2">
                      ({totalPayments > 0 ? ((p.count / totalPayments) * 100).toFixed(1) : 0}%)
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </motion.div>
      )}
    </div>
  );
}
