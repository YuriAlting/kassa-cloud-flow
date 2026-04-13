import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';

interface Order {
  id: string;
  order_number: number;
  source: string;
  status: string;
  total_amount: number;
  created_at: string;
}

export default function OrdersPage() {
  const { profile } = useAuth();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!profile?.restaurant_id) return;
    supabase
      .from('orders')
      .select('id, order_number, source, status, total_amount, created_at')
      .eq('restaurant_id', profile.restaurant_id)
      .order('created_at', { ascending: false })
      .limit(100)
      .then(({ data }) => {
        setOrders(data || []);
        setLoading(false);
      });
  }, [profile?.restaurant_id]);

  const statusColors: Record<string, string> = {
    pending: 'bg-yellow-500/20 text-yellow-400',
    confirmed: 'bg-blue-500/20 text-blue-400',
    ready: 'bg-purple-500/20 text-purple-400',
    completed: 'bg-success/20 text-success',
  };

  return (
    <div className="p-6 space-y-6">
      <h2 className="text-xl font-bold">Bestellingen</h2>

      <div className="surface overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-border">
              <th className="text-left px-5 py-3 text-sm text-muted-foreground font-medium">#</th>
              <th className="text-left px-5 py-3 text-sm text-muted-foreground font-medium">Bron</th>
              <th className="text-left px-5 py-3 text-sm text-muted-foreground font-medium">Status</th>
              <th className="text-right px-5 py-3 text-sm text-muted-foreground font-medium">Totaal</th>
              <th className="text-right px-5 py-3 text-sm text-muted-foreground font-medium">Datum</th>
            </tr>
          </thead>
          <tbody>
            {orders.map(o => (
              <tr key={o.id} className="border-b border-border last:border-0">
                <td className="px-5 py-3 font-medium">#{o.order_number}</td>
                <td className="px-5 py-3 text-sm text-muted-foreground capitalize">{o.source}</td>
                <td className="px-5 py-3">
                  <span className={`px-2 py-1 rounded-full text-xs font-medium capitalize ${statusColors[o.status] || 'bg-secondary text-secondary-foreground'}`}>
                    {o.status}
                  </span>
                </td>
                <td className="px-5 py-3 text-right font-semibold text-primary">€{Number(o.total_amount).toFixed(2)}</td>
                <td className="px-5 py-3 text-right text-sm text-muted-foreground">
                  {new Date(o.created_at).toLocaleString('nl-NL', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {orders.length === 0 && !loading && (
          <p className="text-center text-muted-foreground py-12">Nog geen bestellingen</p>
        )}
      </div>
    </div>
  );
}
