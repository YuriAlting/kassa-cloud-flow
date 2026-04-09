import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { motion } from 'framer-motion';
import { Clock, ChevronRight, Package, Flame, CheckCircle, Truck } from 'lucide-react';

type OrderStatus = 'pending' | 'preparing' | 'ready' | 'delivered';

interface OrderItem {
  name_snapshot: string;
  quantity: number;
}

interface Order {
  id: string;
  order_number: number;
  status: string;
  source: string;
  created_at: string;
  items: OrderItem[];
}

const STATUS_COLUMNS: { key: OrderStatus; label: string; color: string; bgClass: string; borderClass: string; icon: typeof Package }[] = [
  { key: 'pending', label: 'Nieuw', color: 'hsl(217 91% 60%)', bgClass: 'bg-blue-500/10', borderClass: 'border-blue-500/30', icon: Package },
  { key: 'preparing', label: 'In Bereiding', color: 'hsl(38 92% 50%)', bgClass: 'bg-orange-500/10', borderClass: 'border-orange-500/30', icon: Flame },
  { key: 'ready', label: 'Klaar', color: 'hsl(142 76% 36%)', bgClass: 'bg-green-500/10', borderClass: 'border-green-500/30', icon: CheckCircle },
  { key: 'delivered', label: 'Bezorgd / Opgehaald', color: 'hsl(0 0% 55%)', bgClass: 'bg-muted/30', borderClass: 'border-muted-foreground/20', icon: Truck },
];

const NEXT_STATUS: Record<string, OrderStatus | null> = {
  pending: 'preparing',
  preparing: 'ready',
  ready: 'delivered',
  delivered: null,
};

const NEXT_LABEL: Record<string, string> = {
  pending: 'Start bereiding',
  preparing: 'Markeer klaar',
  ready: 'Bezorgd / Opgehaald',
};

export default function StaffDashboard() {
  const { profile } = useAuth();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);

  const restaurantId = profile?.restaurant_id;

  const fetchOrders = useCallback(async () => {
    if (!restaurantId) return;
    const today = new Date().toISOString().split('T')[0];

    const { data: ordersData } = await supabase
      .from('orders')
      .select('id, order_number, status, source, created_at')
      .eq('restaurant_id', restaurantId)
      .gte('created_at', today)
      .order('created_at', { ascending: false });

    if (!ordersData || ordersData.length === 0) {
      setOrders([]);
      setLoading(false);
      return;
    }

    const orderIds = ordersData.map(o => o.id);
    const { data: itemsData } = await supabase
      .from('order_items')
      .select('order_id, name_snapshot, quantity')
      .in('order_id', orderIds);

    const itemsByOrder: Record<string, OrderItem[]> = {};
    itemsData?.forEach(i => {
      if (!itemsByOrder[i.order_id]) itemsByOrder[i.order_id] = [];
      itemsByOrder[i.order_id].push({ name_snapshot: i.name_snapshot, quantity: i.quantity });
    });

    setOrders(ordersData.map(o => ({ ...o, items: itemsByOrder[o.id] || [] })));
    setLoading(false);
  }, [restaurantId]);

  useEffect(() => {
    fetchOrders();
    const interval = setInterval(fetchOrders, 30000);
    return () => clearInterval(interval);
  }, [fetchOrders]);

  const moveOrder = async (orderId: string, newStatus: OrderStatus) => {
    await supabase.from('orders').update({ status: newStatus }).eq('id', orderId);
    setOrders(prev => prev.map(o => o.id === orderId ? { ...o, status: newStatus } : o));
  };

  const formatTime = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleTimeString('nl-NL', { hour: '2-digit', minute: '2-digit' });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 h-full flex flex-col">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-foreground">Bestellingen Vandaag</h1>
        <span className="text-sm text-muted-foreground">{orders.length} bestelling(en)</span>
      </div>

      <div className="flex-1 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 min-h-0">
        {STATUS_COLUMNS.map(col => {
          const colOrders = orders.filter(o => o.status === col.key);
          return (
            <div key={col.key} className={`flex flex-col rounded-xl border ${col.borderClass} ${col.bgClass} overflow-hidden`}>
              {/* Column header */}
              <div className="flex items-center gap-2 px-4 py-3 border-b" style={{ borderColor: col.color + '33' }}>
                <col.icon className="w-5 h-5" style={{ color: col.color }} />
                <span className="font-bold text-base" style={{ color: col.color }}>{col.label}</span>
                <span className="ml-auto text-xs font-semibold rounded-full px-2 py-0.5" style={{ backgroundColor: col.color + '22', color: col.color }}>
                  {colOrders.length}
                </span>
              </div>

              {/* Cards */}
              <div className="flex-1 overflow-y-auto p-3 space-y-3">
                {colOrders.length === 0 && (
                  <p className="text-center text-muted-foreground text-sm py-8">Geen bestellingen</p>
                )}
                {colOrders.map(order => (
                  <motion.div
                    key={order.id}
                    layout
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="bg-card border border-border rounded-lg p-4 shadow-sm"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-lg font-bold text-foreground">#{order.order_number}</span>
                      <div className="flex items-center gap-1 text-muted-foreground text-xs">
                        <Clock className="w-3 h-3" />
                        {formatTime(order.created_at)}
                      </div>
                    </div>

                    <span className="inline-block text-xs font-medium rounded px-2 py-0.5 mb-3"
                      style={{
                        backgroundColor: order.source === 'pos' ? 'hsl(217 91% 60% / 0.15)' : 'hsl(142 76% 36% / 0.15)',
                        color: order.source === 'pos' ? 'hsl(217 91% 60%)' : 'hsl(142 76% 36%)',
                      }}
                    >
                      {order.source === 'pos' ? 'POS' : 'Online'}
                    </span>

                    <ul className="space-y-1 mb-3">
                      {order.items.map((item, i) => (
                        <li key={i} className="text-sm text-foreground flex justify-between">
                          <span>{item.name_snapshot}</span>
                          <span className="text-muted-foreground font-medium">×{item.quantity}</span>
                        </li>
                      ))}
                      {order.items.length === 0 && (
                        <li className="text-xs text-muted-foreground italic">Geen items</li>
                      )}
                    </ul>

                    {NEXT_STATUS[order.status] && (
                      <motion.button
                        whileTap={{ scale: 0.95 }}
                        onClick={() => moveOrder(order.id, NEXT_STATUS[order.status]!)}
                        className="w-full flex items-center justify-center gap-2 rounded-lg py-2.5 text-sm font-bold text-white transition-colors"
                        style={{ backgroundColor: STATUS_COLUMNS.find(c => c.key === NEXT_STATUS[order.status])?.color || col.color }}
                      >
                        {NEXT_LABEL[order.status]}
                        <ChevronRight className="w-4 h-4" />
                      </motion.button>
                    )}
                  </motion.div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
