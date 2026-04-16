import { useState, useEffect, useMemo } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { ShoppingCart, DollarSign, TrendingUp, TrendingDown, BarChart3, CreditCard } from 'lucide-react';
import { motion } from 'framer-motion';
import {
  PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend,
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
} from 'recharts';

const COLORS = ['hsl(38 92% 50%)', 'hsl(217 91% 60%)', 'hsl(142 76% 36%)', 'hsl(280 65% 60%)', 'hsl(0 84% 60%)'];
const PAY_COLORS: Record<string, string> = {
  'Pin':      'hsl(217 91% 60%)',
  'pin':      'hsl(217 91% 60%)',
  'PIN':      'hsl(217 91% 60%)',
  'Cash':     'hsl(142 76% 36%)',
  'cash':     'hsl(142 76% 36%)',
  'Contant':  'hsl(142 76% 36%)',
  'Online':   'hsl(38 92% 50%)',
  'Onbekend': 'hsl(0 0% 40%)',
};
const DAY_LABELS = ['Ma', 'Di', 'Wo', 'Do', 'Vr', 'Za', 'Zo'];

type CompareMode = 'last_week' | 'yesterday' | 'avg_7' | 'avg_30';

function startOfDay(d: Date) {
  const r = new Date(d);
  r.setHours(0, 0, 0, 0);
  return r;
}

function getMondayOfWeek(weeksAgo: number) {
  const now = new Date();
  const dow = now.getDay() === 0 ? 7 : now.getDay();
  const mon = new Date(now);
  mon.setDate(now.getDate() - dow + 1 - weeksAgo * 7);
  return startOfDay(mon);
}

function getPayColor(name: string) {
  return PAY_COLORS[name] || `hsl(${Math.abs(name.charCodeAt(0) * 37) % 360} 70% 55%)`;
}

export default function RestaurantOverview() {
  const { profile } = useAuth();
  const [stats, setStats] = useState({ orders: 0, revenue: 0 });
  const [weeklyRevenue, setWeeklyRevenue] = useState({ thisWeek: 0, lastWeek: 0 });
  const [paymentDist, setPaymentDist] = useState<{ name: string; count: number; revenue: number }[]>([]);
  const [sourceDist, setSourceDist] = useState<{ name: string; count: number }[]>([]);
  const [compareMode, setCompareMode] = useState<CompareMode>('last_week');
  const [dailyThis, setDailyThis] = useState<number[]>(Array(7).fill(0));
  const [dailyCompare, setDailyCompare] = useState<number[]>(Array(7).fill(0));

  const restaurantId = profile?.restaurant_id;

  const loadAll = async () => {
    if (!restaurantId) return;
    const today = new Date().toISOString().split('T')[0];

    // Vandaag stats
    const { data: todayData } = await supabase
      .from('orders')
      .select('total_amount')
      .eq('restaurant_id', restaurantId)
      .gte('created_at', today);
    setStats({
      orders: todayData?.length || 0,
      revenue: todayData?.reduce((s, o) => s + Number(o.total_amount), 0) || 0,
    });

    // Weekomzet
    const tw = getMondayOfWeek(0);
    const twEnd = new Date(tw); twEnd.setDate(tw.getDate() + 6); twEnd.setHours(23, 59, 59, 999);
    const lw = getMondayOfWeek(1);
    const lwEnd = new Date(lw); lwEnd.setDate(lw.getDate() + 6); lwEnd.setHours(23, 59, 59, 999);
    const [a, b] = await Promise.all([
      supabase.from('orders').select('total_amount').eq('restaurant_id', restaurantId).gte('created_at', tw.toISOString()).lte('created_at', twEnd.toISOString()),
      supabase.from('orders').select('total_amount').eq('restaurant_id', restaurantId).gte('created_at', lw.toISOString()).lte('created_at', lwEnd.toISOString()),
    ]);
    setWeeklyRevenue({
      thisWeek: a.data?.reduce((s, o) => s + Number(o.total_amount), 0) || 0,
      lastWeek: b.data?.reduce((s, o) => s + Number(o.total_amount), 0) || 0,
    });

    // Betaalmethode verdeling — inclusief online bestellingen
    const { data: allOrders } = await supabase
      .from('orders')
      .select('total_amount, source, payment_method_id, payment_methods(name)')
      .eq('restaurant_id', restaurantId);

    if (allOrders) {
      const counts: Record<string, { count: number; revenue: number }> = {};
      allOrders.forEach((o: any) => {
        let name = 'Onbekend';
        if (o.source === 'online') {
          name = 'Online';
        } else if (o.payment_methods?.name) {
          name = o.payment_methods.name;
        } else if (!o.payment_method_id) {
          name = 'Onbekend';
        }
        if (!counts[name]) counts[name] = { count: 0, revenue: 0 };
        counts[name].count += 1;
        counts[name].revenue += Number(o.total_amount);
      });
      setPaymentDist(
        Object.entries(counts)
          .map(([name, v]) => ({ name, count: v.count, revenue: v.revenue }))
          .sort((a, b) => b.count - a.count)
      );
    }

    // Bestelbron verdeling
    const { data: srcData } = await supabase
      .from('orders')
      .select('source')
      .eq('restaurant_id', restaurantId);
    if (srcData) {
      const counts: Record<string, number> = {};
      srcData.forEach((o) => {
        const src = o.source === 'pos' ? 'In zaak (POS)' : o.source === 'online' ? 'Online' : o.source || 'Onbekend';
        counts[src] = (counts[src] || 0) + 1;
      });
      setSourceDist(Object.entries(counts).map(([name, count]) => ({ name, count })));
    }
  };

  useEffect(() => {
    loadAll();
  }, [restaurantId]);

  // Realtime — herlaad stats bij nieuwe bestelling
  useEffect(() => {
    if (!restaurantId) return;
    const channel = supabase
      .channel('overview-realtime')
      .on('postgres_changes', {
        event: 'INSERT', schema: 'public', table: 'orders',
        filter: `restaurant_id=eq.${restaurantId}`,
      }, () => { loadAll(); })
      .on('postgres_changes', {
        event: 'UPDATE', schema: 'public', table: 'orders',
        filter: `restaurant_id=eq.${restaurantId}`,
      }, () => { loadAll(); })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [restaurantId]);

  // Grafiek data
  useEffect(() => {
    if (!restaurantId) return;
    fetchDailyRevenue(restaurantId, getMondayOfWeek(0)).then(setDailyThis);
    if (compareMode === 'last_week') {
      fetchDailyRevenue(restaurantId, getMondayOfWeek(1)).then(setDailyCompare);
    } else if (compareMode === 'yesterday') {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const dayStart = startOfDay(yesterday).toISOString();
      const dayEnd = new Date(startOfDay(yesterday));
      dayEnd.setHours(23, 59, 59, 999);
      supabase.from('orders').select('total_amount').eq('restaurant_id', restaurantId)
        .gte('created_at', dayStart).lte('created_at', dayEnd.toISOString())
        .then(({ data }) => {
          const total = data?.reduce((s, o) => s + Number(o.total_amount), 0) || 0;
          setDailyCompare(Array(7).fill(total));
        });
    } else {
      const days = compareMode === 'avg_7' ? 7 : 30;
      const start = new Date();
      start.setDate(start.getDate() - days);
      supabase.from('orders').select('total_amount, created_at').eq('restaurant_id', restaurantId)
        .gte('created_at', startOfDay(start).toISOString())
        .then(({ data }) => {
          const avg = data?.length ? data.reduce((s, o) => s + Number(o.total_amount), 0) / days : 0;
          setDailyCompare(Array(7).fill(Number(avg.toFixed(2))));
        });
    }
  }, [restaurantId, compareMode]);

  async function fetchDailyRevenue(rid: string, monday: Date) {
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);
    sunday.setHours(23, 59, 59, 999);
    const { data } = await supabase.from('orders').select('total_amount, created_at')
      .eq('restaurant_id', rid).gte('created_at', monday.toISOString()).lte('created_at', sunday.toISOString());
    const daily = Array(7).fill(0);
    data?.forEach((o) => {
      const d = new Date(o.created_at);
      const dow = d.getDay() === 0 ? 6 : d.getDay() - 1;
      daily[dow] += Number(o.total_amount);
    });
    return daily;
  }

  const chartData = useMemo(() =>
    DAY_LABELS.map((day, i) => ({
      day,
      'Deze week': Number(dailyThis[i].toFixed(2)),
      'Vergelijking': Number(dailyCompare[i].toFixed(2)),
    })),
    [dailyThis, dailyCompare]
  );

  const weekDiff = weeklyRevenue.lastWeek > 0
    ? ((weeklyRevenue.thisWeek - weeklyRevenue.lastWeek) / weeklyRevenue.lastWeek) * 100
    : weeklyRevenue.thisWeek > 0 ? 100 : 0;
  const weekUp = weekDiff >= 0;

  const totalPayments = paymentDist.reduce((s, p) => s + p.count, 0);
  const totalSources = sourceDist.reduce((s, p) => s + p.count, 0);

  const compareModeLabels: Record<CompareMode, string> = {
    last_week: 'Vorige week', yesterday: 'Gisteren', avg_7: 'Gem. 7 dagen', avg_30: 'Gem. 30 dagen',
  };

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-7xl mx-auto">
      <h2 className="text-2xl font-bold text-foreground">Dashboard</h2>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="surface p-6 rounded-xl">
          <div className="flex items-center gap-3 mb-3">
            <div className="p-2.5 rounded-lg bg-primary/10"><ShoppingCart className="w-6 h-6 text-primary" /></div>
            <span className="text-sm text-muted-foreground font-medium">Bestellingen vandaag</span>
          </div>
          <p className="text-4xl font-extrabold text-foreground">{stats.orders}</p>
          <p className="text-xs text-muted-foreground mt-1">Totaal aantal bestellingen</p>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }} className="surface p-6 rounded-xl">
          <div className="flex items-center gap-3 mb-3">
            <div className="p-2.5 rounded-lg bg-primary/10"><DollarSign className="w-6 h-6 text-primary" /></div>
            <span className="text-sm text-muted-foreground font-medium">Omzet vandaag</span>
          </div>
          <p className="text-4xl font-extrabold text-foreground">€{stats.revenue.toFixed(2)}</p>
          <p className="text-xs text-muted-foreground mt-1">Totale omzet in euro</p>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="surface p-6 rounded-xl">
          <div className="flex items-center gap-3 mb-3">
            <div className="p-2.5 rounded-lg bg-primary/10">
              {weekUp ? <TrendingUp className="w-6 h-6 text-success" /> : <TrendingDown className="w-6 h-6 text-destructive" />}
            </div>
            <span className="text-sm text-muted-foreground font-medium">Week vergelijking</span>
          </div>
          <p className="text-4xl font-extrabold text-foreground">€{weeklyRevenue.thisWeek.toFixed(2)}</p>
          <div className="flex items-center gap-2 mt-1">
            <span className={`text-sm font-bold ${weekUp ? 'text-success' : 'text-destructive'}`}>
              {weekUp ? '+' : ''}{weekDiff.toFixed(1)}%
            </span>
            <span className="text-xs text-muted-foreground">vs vorige week (€{weeklyRevenue.lastWeek.toFixed(2)})</span>
          </div>
        </motion.div>
      </div>

      {/* Omzet grafiek */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }} className="surface p-6 rounded-xl">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6">
          <div className="flex items-center gap-3">
            <BarChart3 className="w-5 h-5 text-primary" />
            <h3 className="text-lg font-bold text-foreground">Omzet vergelijking per dag</h3>
          </div>
          <select value={compareMode} onChange={(e) => setCompareMode(e.target.value as CompareMode)}
            className="bg-secondary text-foreground border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary w-full sm:w-auto">
            {Object.entries(compareModeLabels).map(([key, label]) => (
              <option key={key} value={key}>{label}</option>
            ))}
          </select>
        </div>
        <div className="h-80">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} barGap={4}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(0 0% 20%)" />
              <XAxis dataKey="day" stroke="hsl(0 0% 55%)" fontSize={13} />
              <YAxis stroke="hsl(0 0% 55%)" fontSize={12} tickFormatter={(v) => `€${v}`} />
              <Tooltip contentStyle={{ backgroundColor: 'hsl(0 0% 8%)', border: '1px solid hsl(0 0% 15%)', borderRadius: '8px', color: 'hsl(0 0% 95%)' }}
                formatter={(value: number) => [`€${value.toFixed(2)}`, undefined]} />
              <Legend />
              <Bar dataKey="Deze week" fill="hsl(38 92% 50%)" radius={[4, 4, 0, 0]} maxBarSize={40} />
              <Bar dataKey="Vergelijking" fill="hsl(217 91% 60%)" radius={[4, 4, 0, 0]} maxBarSize={40} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </motion.div>

      {/* Betaalmethode + Bestelbron */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

        {/* Betaalmethode verdeling */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="surface p-6 rounded-xl">
          <div className="flex items-center gap-3 mb-4">
            <CreditCard className="w-5 h-5 text-primary" />
            <h3 className="text-lg font-bold text-foreground">Betaalmethode verdeling</h3>
          </div>
          {paymentDist.length > 0 ? (
            <div className="space-y-4">
              {/* Pie chart */}
              <div className="h-48">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={paymentDist} dataKey="count" nameKey="name" cx="50%" cy="50%" outerRadius={70} innerRadius={35} paddingAngle={3}>
                      {paymentDist.map((p, i) => (
                        <Cell key={i} fill={getPayColor(p.name)} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{ backgroundColor: 'hsl(0 0% 8%)', border: '1px solid hsl(0 0% 15%)', borderRadius: '8px', color: 'hsl(0 0% 95%)' }}
                      formatter={(v: number, name: string, props: any) => [`${v} bestellingen · €${props.payload.revenue?.toFixed(2)}`]}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>

              {/* Legenda met bars */}
              <div className="space-y-3">
                {paymentDist.map((p) => {
                  const pct = totalPayments > 0 ? (p.count / totalPayments) * 100 : 0;
                  const color = getPayColor(p.name);
                  return (
                    <div key={p.name} className="space-y-1">
                      <div className="flex items-center justify-between text-sm">
                        <div className="flex items-center gap-2">
                          <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: color }} />
                          <span className="font-medium text-foreground">{p.name}</span>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="text-muted-foreground text-xs">€{p.revenue.toFixed(2)}</span>
                          <span className="font-bold text-foreground">{p.count}×</span>
                          <span className="text-muted-foreground text-xs w-10 text-right">{pct.toFixed(0)}%</span>
                        </div>
                      </div>
                      {/* Progress bar */}
                      <div className="h-1.5 rounded-full bg-secondary overflow-hidden">
                        <div className="h-full rounded-full transition-all duration-500"
                          style={{ width: `${pct}%`, backgroundColor: color }} />
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Totaal */}
              <div className="pt-3 border-t border-border flex justify-between text-sm">
                <span className="text-muted-foreground">Totaal</span>
                <span className="font-bold text-foreground">
                  €{paymentDist.reduce((s, p) => s + p.revenue, 0).toFixed(2)} · {totalPayments} bestellingen
                </span>
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-10 space-y-2">
              <CreditCard className="w-10 h-10 text-muted-foreground opacity-30" />
              <p className="text-muted-foreground text-sm">Geen betaaldata beschikbaar</p>
              <p className="text-xs text-muted-foreground opacity-60">Data verschijnt zodra er betaald is via de kassa</p>
            </div>
          )}
        </motion.div>

        {/* Bestelbron verdeling */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }} className="surface p-6 rounded-xl">
          <h3 className="text-lg font-bold text-foreground mb-4">Bestelbron verdeling</h3>
          {sourceDist.length > 0 ? (
            <div className="space-y-4">
              <div className="h-48">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={sourceDist} dataKey="count" nameKey="name" cx="50%" cy="50%" outerRadius={70} innerRadius={35} paddingAngle={3}>
                      {sourceDist.map((_, i) => <Cell key={i} fill={COLORS[(i + 2) % COLORS.length]} />)}
                    </Pie>
                    <Tooltip contentStyle={{ backgroundColor: 'hsl(0 0% 8%)', border: '1px solid hsl(0 0% 15%)', borderRadius: '8px', color: 'hsl(0 0% 95%)' }}
                      formatter={(v: number) => [`${v} bestellingen`]} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="space-y-3">
                {sourceDist.map((p, i) => {
                  const pct = totalSources > 0 ? (p.count / totalSources) * 100 : 0;
                  const color = COLORS[(i + 2) % COLORS.length];
                  return (
                    <div key={p.name} className="space-y-1">
                      <div className="flex items-center justify-between text-sm">
                        <div className="flex items-center gap-2">
                          <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: color }} />
                          <span className="font-medium text-foreground">{p.name}</span>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="font-bold text-foreground">{p.count}×</span>
                          <span className="text-muted-foreground text-xs w-10 text-right">{pct.toFixed(0)}%</span>
                        </div>
                      </div>
                      <div className="h-1.5 rounded-full bg-secondary overflow-hidden">
                        <div className="h-full rounded-full transition-all duration-500"
                          style={{ width: `${pct}%`, backgroundColor: color }} />
                      </div>
                    </div>
                  );
                })}
              </div>
              <div className="pt-3 border-t border-border flex justify-between text-sm">
                <span className="text-muted-foreground">Totaal</span>
                <span className="font-bold text-foreground">{totalSources} bestellingen</span>
              </div>
            </div>
          ) : (
            <p className="text-muted-foreground text-sm">Geen brondata beschikbaar</p>
          )}
        </motion.div>
      </div>
    </div>
  );
}