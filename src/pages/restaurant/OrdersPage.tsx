import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, X, ChevronRight, Package, Clock, User, MapPin, CreditCard, Utensils, ShoppingBag, Phone, Bike, Bell } from 'lucide-react';
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

export default function OrdersPage() {
  const { profile } = useAuth();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<OrderDetail | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [newOnlineOrder, setNewOnlineOrder] = useState(false);

  useEffect(() => {
    if (!profile?.restaurant_id) return;

    // Initieel laden
    supabase
      .from('orders')
      .select('id, order_number, source, status, total_amount, created_at, table_id, created_by, payment_method_id')
      .eq('restaurant_id', profile.restaurant_id)
      .order('created_at', { ascending: false })
      .limit(200)
      .then(({ data }) => {
        setOrders(data || []);
        setLoading(false);
      });

    // Realtime — nieuwe bestellingen van bestelsite verschijnen direct
    const channel = supabase
      .channel('orders-realtime')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'orders',
          filter: `restaurant_id=eq.${profile.restaurant_id}`,
        },
        (payload) => {
          const newOrder = payload.new as Order;
          setOrders(prev => [newOrder, ...prev]);
          // Toon melding bij online bestelling
          if (newOrder.source === 'online') {
            setNewOnlineOrder(true);
            setTimeout(() => setNewOnlineOrder(false), 5000);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [profile?.restaurant_id]);

  const filtered = orders.filter(o =>
    search.trim() === '' ||
    String(o.order_number).includes(search.trim()) ||
    o.status.toLowerCase().includes(search.toLowerCase()) ||
    o.source.toLowerCase().includes(search.toLowerCase())
  );

  const openDetail = async (order: Order) => {
    setLoadingDetail(true);
    setSelected({ ...order, items: [] });

    const [{ data: itemsData }, { data: tableData }, { data: staffData }, { data: payData }, { data: onlineData }] = await Promise.all([
      supabase.from('order_items').select('id, name_snapshot, quantity, unit_price').eq('order_id', order.id),
      order.table_id
        ? supabase.from('tables').select('name').eq('id', order.table_id).single()
        : Promise.resolve({ data: null }),
      order.created_by
        ? supabase.from('profiles').select('full_name').eq('id', order.created_by).single()
        : Promise.resolve({ data: null }),
      order.payment_method_id
        ? supabase.from('payment_methods').select('name').eq('id', order.payment_method_id).single()
        : Promise.resolve({ data: null }),
      // Haal klantgegevens op voor online bestellingen
      order.source === 'online'
        ? supabase.from('online_orders').select('customer_name, customer_phone, order_type, street, housenumber, postcode, city, notes, delivery_cost').eq('order_id', order.id).maybeSingle()
        : Promise.resolve({ data: null }),
    ]);

    setSelected({
      ...order,
      items: itemsData || [],
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

  const NEXT_STATUS: Record<string, string> = {
    pending: 'preparing',
    preparing: 'ready',
    ready: 'delivered',
  };

  const NEXT_LABEL: Record<string, string> = {
    pending: 'Start bereiding',
    preparing: 'Markeer klaar',
    ready: 'Bezorgd / Opgehaald',
  };

  return (
    <div className="p-6 space-y-5">

      {/* Realtime melding nieuwe online bestelling */}
      <AnimatePresence>
        {newOnlineOrder && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="fixed top-4 right-4 z-50 bg-primary text-primary-foreground px-5 py-3 rounded-xl shadow-lg flex items-center gap-3 font-semibold"
          >
            <Bell className="w-5 h-5 animate-bounce" />
            Nieuwe online bestelling binnengekornen!
          </motion.div>
        )}
      </AnimatePresence>

      <div className="flex items-center justify-between gap-4">
        <h2 className="text-xl font-bold">Bestellingen</h2>
        <div className="flex items-center gap-2 bg-secondary rounded-lg px-3 py-2 flex-1 max-w-xs">
          <Search className="w-4 h-4 text-muted-foreground shrink-0" />
          <input
            type="text"
            placeholder="Zoek op bonnummer..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="bg-transparent text-sm text-foreground placeholder:text-muted-foreground outline-none flex-1"
          />
          {search && (
            <button onClick={() => setSearch('')}>
              <X className="w-4 h-4 text-muted-foreground" />
            </button>
          )}
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
              <motion.tr
                key={o.id}
                whileHover={{ backgroundColor: 'rgba(255,255,255,0.03)' }}
                onClick={() => openDetail(o)}
                className={`border-b border-border last:border-0 cursor-pointer ${o.source === 'online' && o.status === 'pending' ? 'bg-yellow-500/5' : ''}`}
              >
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
            {search ? `Geen bestellingen gevonden voor "${search}"` : 'Nog geen bestellingen'}
          </p>
        )}
      </div>

      {/* === DETAIL MODAL === */}
      <AnimatePresence>
        {selected && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelected(null)}
              className="fixed inset-0 z-40 bg-black/60"
            />
            <motion.div
              initial={{ opacity: 0, x: 60 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 60 }}
              className="fixed right-0 top-0 bottom-0 z-50 w-full max-w-md bg-card border-l border-border flex flex-col shadow-2xl"
            >
              {/* Header */}
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
                    {/* Status + type */}
                    <div className="flex gap-3 flex-wrap">
                      <span className={`px-3 py-1.5 rounded-full text-sm font-medium border ${STATUS_COLORS[selected.status] || 'bg-secondary text-secondary-foreground border-border'}`}>
                        {STATUS_NL[selected.status] || selected.status}
                      </span>
                      <span className="px-3 py-1.5 rounded-full text-sm font-medium bg-secondary text-secondary-foreground border border-border flex items-center gap-1.5">
                        {selected.source === 'pos'
                          ? <><Utensils className="w-3.5 h-3.5" /> In de zaak</>
                          : selected.online_info?.order_type === 'bezorgen'
                          ? <><Bike className="w-3.5 h-3.5" /> Bezorgen</>
                          : <><ShoppingBag className="w-3.5 h-3.5" /> Afhalen</>
                        }
                      </span>
                    </div>

                    {/* Online klantgegevens */}
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
                              <span>
                                {selected.online_info.street} {selected.online_info.housenumber},<br />
                                {selected.online_info.postcode} {selected.online_info.city}
                              </span>
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

                    {/* POS info blokken */}
                    {selected.source === 'pos' && (
                      <div className="grid grid-cols-2 gap-3">
                        {selected.table_name && (
                          <div className="bg-secondary rounded-xl p-4 space-y-1">
                            <div className="flex items-center gap-2 text-muted-foreground text-xs font-medium">
                              <MapPin className="w-3.5 h-3.5" /> Tafel
                            </div>
                            <p className="font-semibold">{selected.table_name}</p>
                          </div>
                        )}
                        {selected.staff_name && (
                          <div className="bg-secondary rounded-xl p-4 space-y-1">
                            <div className="flex items-center gap-2 text-muted-foreground text-xs font-medium">
                              <User className="w-3.5 h-3.5" /> Medewerker
                            </div>
                            <p className="font-semibold">{selected.staff_name}</p>
                          </div>
                        )}
                        {selected.payment_method && (
                          <div className="bg-secondary rounded-xl p-4 space-y-1">
                            <div className="flex items-center gap-2 text-muted-foreground text-xs font-medium">
                              <CreditCard className="w-3.5 h-3.5" /> Betaalmethode
                            </div>
                            <p className="font-semibold">{selected.payment_method}</p>
                          </div>
                        )}
                        <div className="bg-secondary rounded-xl p-4 space-y-1">
                          <div className="flex items-center gap-2 text-muted-foreground text-xs font-medium">
                            <Clock className="w-3.5 h-3.5" /> Besteltijd
                          </div>
                          <p className="font-semibold">
                            {new Date(selected.created_at).toLocaleTimeString('nl-NL', { hour: '2-digit', minute: '2-digit' })}
                          </p>
                        </div>
                      </div>
                    )}

                    {/* Producten */}
                    <div>
                      <h4 className="font-semibold mb-3 flex items-center gap-2">
                        <Package className="w-4 h-4" /> Bestelde producten
                      </h4>
                      <div className="space-y-2">
                        {selected.items.map(item => (
                          <div key={item.id} className="flex items-center justify-between bg-secondary rounded-lg px-4 py-3">
                            <div className="flex items-center gap-3">
                              <span className="w-7 h-7 rounded-full bg-primary/20 text-primary text-xs font-bold flex items-center justify-center">
                                {item.quantity}×
                              </span>
                              <span className="text-sm font-medium">{item.name_snapshot}</span>
                            </div>
                            <span className="text-sm font-semibold text-primary">
                              €{(item.unit_price * item.quantity).toFixed(2)}
                            </span>
                          </div>
                        ))}
                        {selected.items.length === 0 && (
                          <p className="text-sm text-muted-foreground text-center py-4">Geen items gevonden</p>
                        )}
                      </div>
                    </div>

                    {/* Status bijwerken knop */}
                    {NEXT_STATUS[selected.status] && (
                      <motion.button
                        whileTap={{ scale: 0.97 }}
                        onClick={() => updateStatus(selected.id, NEXT_STATUS[selected.status])}
                        className="w-full py-3 rounded-xl bg-primary text-primary-foreground font-bold text-sm"
                      >
                        {NEXT_LABEL[selected.status]}
                      </motion.button>
                    )}
                  </>
                )}
              </div>

              {/* Footer totaal */}
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