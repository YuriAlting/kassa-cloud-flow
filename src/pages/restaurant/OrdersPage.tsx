import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, X, ChevronRight, Package, Clock, User, MapPin, CreditCard, Utensils, ShoppingBag, Phone, Bike, Bell, Calendar, Filter } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';

interface OrderItem {
  id: string;
  name_snapshot: string;
  quantity: number;
  unit_price: number;
}

interface OnlineOrder {
  customer_name: string;
  customer_phone: string;
  order_type: string;
  street: string | null;
  housenumber: string | null;
  postcode: string | null;
  city: string | null;
  notes: string | null;
  delivery_cost: number;
}

interface Order {
  id: string;
  order_number: number;
  source: string;
  status: string;
  total_amount: number;
  created_at: string;
  table_id: string | null;
  created_by: string | null;
  payment_method_id: string | null;
}

interface OrderDetail extends Order {
  items: OrderItem[];
  table_name?: string;
  staff_name?: string;
  payment_method?: string;
  online_info?: OnlineOrder | null;
}

const STATUS_COLORS: Record<string, string> = {
  pending:   'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
  preparing: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
  ready:     'bg-purple-500/20 text-purple-400 border-purple-500/30',
  delivered: 'bg-green-500/20 text-green-400 border-green-500/30',
  completed: 'bg-green-500/20 text-green-400 border-green-500/30',
};

const STATUS_NL: Record<string, string> = {
  pending:   'Nieuw',
  preparing: 'In bereiding',
  ready:     'Klaar',
  delivered: 'Bezorgd',
  completed: 'Afgerond',
};

type DateFilter = 'vandaag' | 'week' | 'maand' | 'aangepast';
type PlatformFilter = 'alle' | 'online' | 'pos';

function getDateRange(filter: DateFilter, customFrom: string, customTo: string): { from: string; to: string } {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  const toDate = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  if (filter === 'vandaag') { const today = toDate(now); return { from: today, to: today }; }
  if (filter === 'week') {
    const day = now.getDay() || 7;
    const monday = new Date(now);
    monday.setDate(now.getDate() - day + 1);
    return { from: toDate(monday), to: toDate(now) };
  }
  if (filter === 'maand') {
    return { from: toDate(new Date(now.getFullYear(), now.getMonth(), 1)), to: toDate(now) };
  }
  return { from: customFrom, to: customTo };
}

export default function OrdersPage() {
  const { profile } = useAuth();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<OrderDetail | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [newOnlineOrder, setNewOnlineOrder] = useState(false);

  const today = new Date().toISOString().split('T')[0];
  const [dateFilter, setDateFilter] = useState<DateFilter>('vandaag');
  const [platformFilter, setPlatformFilter] = useState<PlatformFilter>('alle');
  const [customFrom, setCustomFrom] = useState(today);
  const [customTo, setCustomTo] = useState(today);
  const [showFilters, setShowFilters] = useState(false);

  useEffect(() => {
    if (!profile?.restaurant_id) return;
    loadOrders();
  }, [profile?.restaurant_id, dateFilter, customFrom, customTo]);

  const loadOrders = async () => {
    if (!profile?.restaurant_id) return;
    setLoading(true);
    const { from, to } = getDateRange(dateFilter, customFrom, customTo);
    const { data } = await supabase
      .from('orders')
      .select('id, order_number, source, status, total_amount, created_at, table_id, created_by, payment_method_id')
      .eq('restaurant_id', profile.restaurant_id)
      .gte('created_at', `${from}T00:00:00`)
      .lte('created_at', `${to}T23:59:59`)
      .order('created_at', { ascending: false })
      .limit(500);
    setOrders(data || []);
    setLoading(false);
  };

  useEffect(() => {
    if (!profile?.restaurant_id) return;
    const channel = supabase
      .channel('orders-realtime')
      .on('postgres_changes', {
        event: 'INSERT', schema: 'public', table: 'orders',
        filter: `restaurant_id=eq.${profile.restaurant_id}`,
      }, (payload) => {
        const newOrder = payload.new as Order;
        setOrders(prev => [newOrder, ...prev]);
        if (newOrder.source === 'online') {
          setNewOnlineOrder(true);
          setTimeout(() => setNewOnlineOrder(false), 5000);
        }
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [profile?.restaurant_id]);

  const filtered = orders.filter(o => {
    const matchSearch = search.trim() === '' ||
      String(o.order_number).includes(search.trim()) ||
      o.status.toLowerCase().includes(search.toLowerCase()) ||
      o.source.toLowerCase().includes(search.toLowerCase());
    const matchPlatform = platformFilter === 'alle' ||
      (platformFilter === 'online' && o.source === 'online') ||
      (platformFilter === 'pos' && o.source === 'pos');
    return matchSearch && matchPlatform;
  });

  const totalRevenue = filtered.reduce((sum, o) => sum + Number(o.total_amount), 0);
  const onlineCount = filtered.filter(o => o.source === 'online').length;
  const posCount = filtered.filter(o => o.source === 'pos').length;

  const openDetail = async (order: Order) => {
    setLoadingDetail(true);
    setSelected({ ...order, items: [] });
    const [{ data: itemsData }, { data: tableData }, { data: staffData }, { data: payData }, { data: onlineData }] = await Promise.all([
      supabase.from('order_items').select('id, name_snapshot, quantity, unit_price').eq('order_id', order.id),
      order.table_id ? supabase.from('tables').select('name').eq('id', order.table_id).single() : Promise.resolve({ data: null }),
      order.created_by ? supabase.from('profiles').select('full_name').eq('id', order.created_by).single() : Promise.resolve({ data: null }),
      order.payment_method_id ? supabase.from('payment_methods').select('name').eq('id', order.payment_method_id).single() : Promise.resolve({ data: null }),
      order.source === 'online' ? (supabase.from('online_orders' as any).select('customer_name, customer_phone, order_type, street, housenumber, postcode, city, notes, delivery_cost').eq('order_id', order.id).maybeSingle() as any) : Promise.resolve({ data: null }),
    ]);
    setSelected({
      ...order, items: itemsData || [],
      table_name: (tableData as any)?.name,
      staff_name: (staffData as any)?.full_name,
      payment_method: (payData as any)?.name,
      online_info: onlineData as OnlineOrder | null,
    });
    setLoadingDetail(false);
  };

  const updateStatus = async (orderId: string, newStatus: string) => {
    await supabase.from('orders').update({ status: newStatus }).eq('id', orderId);
    setSelected(prev => prev ? { ...prev, status: newStatus } : null);
    setOrders(prev => prev.map(o => o.id === orderId ? { ...o, status: newStatus } : o));
  };

  const NEXT_STATUS: Record<string, string> = { pending: 'preparing', preparing: 'ready', ready: 'delivered' };
  const NEXT_LABEL: Record<string, string> = { pending: 'Start bereiding', preparing: 'Markeer klaar', ready: 'Bezorgd / Opgehaald' };
  const DATE_LABELS: Record<DateFilter, string> = { vandaag: 'Vandaag', week: 'Deze week', maand: 'Deze maand', aangepast: 'Aangepast' };

  return (
    <div className="p-6 space-y-5">
      <AnimatePresence>
        {newOnlineOrder && (
          <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }}
            className="fixed top-4 right-4 z-50 bg-primary text-primary-foreground px-5 py-3 rounded-xl shadow-lg flex items-center gap-3 font-semibold">
            <Bell className="w-5 h-5 animate-bounce" /> Nieuwe online bestelling binnengekomen!
          </motion.div>
        )}
      </AnimatePresence>

      <div className="flex items-center justify-between gap-4 flex-wrap">
        <h2 className="text-xl font-bold">Bestellingen</h2>
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-2 bg-secondary rounded-lg px-3 py-2">
            <Search className="w-4 h-4 text-muted-foreground shrink-0" />
            <input type="text" placeholder="Zoek op bonnummer..."
              value={search} onChange={e => setSearch(e.target.value)}
              className="bg-transparent text-sm text-foreground placeholder:text-muted-foreground outline-none w-40" />
            {search && <button onClick={() => setSearch('')}><X className="w-4 h-4 text-muted-foreground" /></button>}
          </div>
          <button onClick={() => setShowFilters(!showFilters)}
            className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${showFilters ? 'bg-primary text-primary-foreground' : 'bg-secondary text-foreground'}`}>
            <Filter className="w-4 h-4" /> Filters
            {(dateFilter !== 'vandaag' || platformFilter !== 'alle') && (
              <span className="w-2 h-2 rounded-full bg-yellow-400" />
            )}
          </button>
        </div>
      </div>

      <AnimatePresence>
        {showFilters && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
            className="surface p-4 space-y-4 overflow-hidden">
            <div className="flex flex-wrap gap-6">
              <div>
                <p className="text-xs font-semibold text-muted-foreground mb-2 flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5" /> Periode
                </p>
                <div className="flex gap-2 flex-wrap">
                  {(['vandaag', 'week', 'maand', 'aangepast'] as DateFilter[]).map(f => (
                    <button key={f} onClick={() => setDateFilter(f)}
                      className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${dateFilter === f ? 'bg-primary text-primary-foreground' : 'bg-secondary text-muted-foreground hover:text-foreground'}`}>
                      {DATE_LABELS[f]}
                    </button>
                  ))}
                </div>
                {dateFilter === 'aangepast' && (
                  <div className="flex items-center gap-2 mt-3">
                    <input type="date" value={customFrom} onChange={e => setCustomFrom(e.target.value)}
                      className="px-3 py-1.5 rounded-lg bg-secondary text-foreground text-sm border border-border focus:outline-none focus:ring-2 focus:ring-primary" />
                    <span className="text-muted-foreground text-sm">tot</span>
                    <input type="date" value={customTo} onChange={e => setCustomTo(e.target.value)}
                      className="px-3 py-1.5 rounded-lg bg-secondary text-foreground text-sm border border-border focus:outline-none focus:ring-2 focus:ring-primary" />
                    <button onClick={loadOrders}
                      className="px-3 py-1.5 rounded-lg bg-primary text-primary-foreground text-sm font-medium">
                      Toepassen
                    </button>
                  </div>
                )}
              </div>
              <div>
                <p className="text-xs font-semibold text-muted-foreground mb-2 flex items-center gap-1.5">
                  <ShoppingBag className="w-3.5 h-3.5" /> Platform
                </p>
                <div className="flex gap-2">
                  {([
                    { value: 'alle' as PlatformFilter, label: 'Alle', Icon: null },
                    { value: 'online' as PlatformFilter, label: 'Online', Icon: ShoppingBag },
                    { value: 'pos' as PlatformFilter, label: 'In Zaak', Icon: Utensils },
                  ]).map(({ value, label, Icon }) => (
                    <button key={value} onClick={() => setPlatformFilter(value)}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${platformFilter === value ? 'bg-primary text-primary-foreground' : 'bg-secondary text-muted-foreground hover:text-foreground'}`}>
                      {Icon && <Icon className="w-3.5 h-3.5" />}
                      {label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
            {(dateFilter !== 'vandaag' || platformFilter !== 'alle') && (
              <button onClick={() => { setDateFilter('vandaag'); setPlatformFilter('alle'); }}
                className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1">
                <X className="w-3 h-3" /> Filters wissen
              </button>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      <div className="grid grid-cols-3 gap-3">
        <div className="surface p-4 rounded-xl space-y-1">
          <p className="text-xs text-muted-foreground">Totale omzet</p>
          <p className="text-xl font-bold text-primary">€{totalRevenue.toFixed(2)}</p>
        </div>
        <div className="surface p-4 rounded-xl space-y-1">
          <p className="text-xs text-muted-foreground flex items-center gap-1"><ShoppingBag className="w-3 h-3" /> Online</p>
          <p className="text-xl font-bold">{onlineCount}</p>
        </div>
        <div className="surface p-4 rounded-xl space-y-1">
          <p className="text-xs text-muted-foreground flex items-center gap-1"><Utensils className="w-3 h-3" /> In zaak</p>
          <p className="text-xl font-bold">{posCount}</p>
        </div>
      </div>

      <div className="surface overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-border">
              <th className="text-left px-5 py-3 text-sm text-muted-foreground font-medium">#</th>
              <th className="text-left px-5 py-3 text-sm text-muted-foreground font-medium">Bron</th>
              <th className="text-left px-5 py-3 text-sm text-muted-foreground font-medium">Status</th>
              <th className="text-right px-5 py-3 text-sm text-muted-foreground font-medium">Totaal</th>
              <th className="text-right px-5 py-3 text-sm text-muted-foreground font-medium">Datum</th>
              <th className="px-5 py-3" />
            </tr>
          </thead>
          <tbody>
            {filtered.map(o => (
              <motion.tr key={o.id} whileHover={{ backgroundColor: 'rgba(255,255,255,0.03)' }}
                onClick={() => openDetail(o)}
                className={`border-b border-border last:border-0 cursor-pointer ${o.source === 'online' && o.status === 'pending' ? 'bg-yellow-500/5' : ''}`}>
                <td className="px-5 py-3 font-medium">
                  #{o.order_number}
                  {o.source === 'online' && o.status === 'pending' && (
                    <span className="ml-2 w-2 h-2 rounded-full bg-yellow-400 inline-block animate-pulse" />
                  )}
                </td>
                <td className="px-5 py-3 text-sm text-muted-foreground">
                  <span className="flex items-center gap-1.5">
                    {o.source === 'pos' ? <Utensils className="w-3.5 h-3.5" /> : <ShoppingBag className="w-3.5 h-3.5" />}
                    {o.source === 'pos' ? 'In zaak' : 'Online'}
                  </span>
                </td>
                <td className="px-5 py-3">
                  <span className={`px-2 py-1 rounded-full text-xs font-medium border ${STATUS_COLORS[o.status] || 'bg-secondary text-secondary-foreground border-border'}`}>
                    {STATUS_NL[o.status] || o.status}
                  </span>
                </td>
                <td className="px-5 py-3 text-right font-semibold text-primary">€{Number(o.total_amount).toFixed(2)}</td>
                <td className="px-5 py-3 text-right text-sm text-muted-foreground">
                  {new Date(o.created_at).toLocaleString('nl-NL', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                </td>
                <td className="px-5 py-3 text-right">
                  <ChevronRight className="w-4 h-4 text-muted-foreground inline" />
                </td>
              </motion.tr>
            ))}
          </tbody>
        </table>
        {filtered.length === 0 && !loading && (
          <p className="text-center text-muted-foreground py-12">
            {search ? `Geen bestellingen gevonden voor "${search}"` : `Geen bestellingen voor ${DATE_LABELS[dateFilter].toLowerCase()}`}
          </p>
        )}
        {loading && (
          <div className="flex justify-center py-8">
            <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        )}
      </div>

      <AnimatePresence>
        {selected && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setSelected(null)} className="fixed inset-0 z-40 bg-black/60" />
            <motion.div initial={{ opacity: 0, x: 60 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 60 }}
              className="fixed right-0 top-0 bottom-0 z-50 w-full max-w-md bg-card border-l border-border flex flex-col shadow-2xl">
              <div className="flex items-center justify-between px-6 py-4 border-b border-border">
                <div>
                  <h3 className="text-lg font-bold">Bestelling #{selected.order_number}</h3>
                  <p className="text-sm text-muted-foreground">
                    {new Date(selected.created_at).toLocaleString('nl-NL', { weekday: 'long', day: '2-digit', month: 'long', hour: '2-digit', minute: '2-digit' })}
                  </p>
                </div>
                <button onClick={() => setSelected(null)} className="p-2 rounded-lg hover:bg-secondary">
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="flex-1 overflow-y-auto p-6 space-y-6">
                {loadingDetail ? (
                  <div className="flex justify-center py-12">
                    <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                  </div>
                ) : (
                  <>
                    <div className="flex gap-3 flex-wrap">
                      <span className={`px-3 py-1.5 rounded-full text-sm font-medium border ${STATUS_COLORS[selected.status] || 'bg-secondary text-secondary-foreground border-border'}`}>
                        {STATUS_NL[selected.status] || selected.status}
                      </span>
                      <span className="px-3 py-1.5 rounded-full text-sm font-medium bg-secondary text-secondary-foreground border border-border flex items-center gap-1.5">
                        {selected.source === 'pos' ? <><Utensils className="w-3.5 h-3.5" /> In de zaak</>
                          : selected.online_info?.order_type === 'bezorgen' ? <><Bike className="w-3.5 h-3.5" /> Bezorgen</>
                          : <><ShoppingBag className="w-3.5 h-3.5" /> Afhalen</>}
                      </span>
                    </div>
                    {selected.source === 'online' && selected.online_info && (
                      <div className="bg-primary/5 border border-primary/20 rounded-xl p-4 space-y-3">
                        <h4 className="font-semibold text-sm flex items-center gap-2 text-primary">
                          <User className="w-4 h-4" /> Klantgegevens
                        </h4>
                        <div className="space-y-2 text-sm">
                          <div className="flex items-center gap-2">
                            <User className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                            <span className="font-semibold">{selected.online_info.customer_name}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <Phone className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                            <a href={`tel:${selected.online_info.customer_phone}`} className="text-primary hover:underline">
                              {selected.online_info.customer_phone}
                            </a>
                          </div>
                          {selected.online_info.order_type === 'bezorgen' && (
                            <div className="flex items-start gap-2">
                              <MapPin className="w-3.5 h-3.5 text-muted-foreground shrink-0 mt-0.5" />
                              <span>{selected.online_info.street} {selected.online_info.housenumber},<br />{selected.online_info.postcode} {selected.online_info.city}</span>
                            </div>
                          )}
                          {selected.online_info.notes && (
                            <div className="flex items-start gap-2">
                              <Clock className="w-3.5 h-3.5 text-muted-foreground shrink-0 mt-0.5" />
                              <span className="text-muted-foreground italic">{selected.online_info.notes}</span>
                            </div>
                          )}
                          {selected.online_info.delivery_cost > 0 && (
                            <div className="flex items-center gap-2 pt-1 border-t border-primary/10">
                              <Bike className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                              <span className="text-muted-foreground">Bezorgkosten: €{Number(selected.online_info.delivery_cost).toFixed(2)}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                    {selected.source === 'pos' && (
                      <div className="grid grid-cols-2 gap-3">
                        {selected.table_name && (
                          <div className="bg-secondary rounded-xl p-4 space-y-1">
                            <div className="flex items-center gap-2 text-muted-foreground text-xs font-medium"><MapPin className="w-3.5 h-3.5" /> Tafel</div>
                            <p className="font-semibold">{selected.table_name}</p>
                          </div>
                        )}
                        {selected.staff_name && (
                          <div className="bg-secondary rounded-xl p-4 space-y-1">
                            <div className="flex items-center gap-2 text-muted-foreground text-xs font-medium"><User className="w-3.5 h-3.5" /> Medewerker</div>
                            <p className="font-semibold">{selected.staff_name}</p>
                          </div>
                        )}
                        {selected.payment_method && (
                          <div className="bg-secondary rounded-xl p-4 space-y-1">
                            <div className="flex items-center gap-2 text-muted-foreground text-xs font-medium"><CreditCard className="w-3.5 h-3.5" /> Betaalmethode</div>
                            <p className="font-semibold">{selected.payment_method}</p>
                          </div>
                        )}
                        <div className="bg-secondary rounded-xl p-4 space-y-1">
                          <div className="flex items-center gap-2 text-muted-foreground text-xs font-medium"><Clock className="w-3.5 h-3.5" /> Besteltijd</div>
                          <p className="font-semibold">{new Date(selected.created_at).toLocaleTimeString('nl-NL', { hour: '2-digit', minute: '2-digit' })}</p>
                        </div>
                      </div>
                    )}
                    <div>
                      <h4 className="font-semibold mb-3 flex items-center gap-2"><Package className="w-4 h-4" /> Bestelde producten</h4>
                      <div className="space-y-2">
                        {selected.items.map(item => (
                          <div key={item.id} className="flex items-center justify-between bg-secondary rounded-lg px-4 py-3">
                            <div className="flex items-center gap-3">
                              <span className="w-7 h-7 rounded-full bg-primary/20 text-primary text-xs font-bold flex items-center justify-center">{item.quantity}×</span>
                              <span className="text-sm font-medium">{item.name_snapshot}</span>
                            </div>
                            <span className="text-sm font-semibold text-primary">€{(item.unit_price * item.quantity).toFixed(2)}</span>
                          </div>
                        ))}
                        {selected.items.length === 0 && <p className="text-sm text-muted-foreground text-center py-4">Geen items gevonden</p>}
                      </div>
                    </div>
                    {NEXT_STATUS[selected.status] && (
                      <motion.button whileTap={{ scale: 0.97 }}
                        onClick={() => updateStatus(selected.id, NEXT_STATUS[selected.status])}
                        className="w-full py-3 rounded-xl bg-primary text-primary-foreground font-bold text-sm">
                        {NEXT_LABEL[selected.status]}
                      </motion.button>
                    )}
                  </>
                )}
              </div>
              <div className="border-t border-border px-6 py-4">
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground font-medium">Totaal</span>
                  <span className="text-2xl font-bold text-primary">€{Number(selected.total_amount).toFixed(2)}</span>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}