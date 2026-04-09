import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Plus, LogOut } from 'lucide-react';
import { supabase } from '@/lib/supabase';

interface Restaurant {
  id: string;
  naam: string;
  slug: string;
  actief: boolean;
  aangemaakt_op: string;
  ordersToday: number;
  revenueToday: number;
}

export default function AdminDashboard() {
  const navigate = useNavigate();
  const [restaurants, setRestaurants] = useState<Restaurant[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [newNaam, setNewNaam] = useState('');
  const [newSlug, setNewSlug] = useState('');
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    checkAuth();
    loadRestaurants();

    // Realtime subscription
    const channel = supabase
      .channel('admin-orders')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'orders' }, () => {
        loadRestaurants();
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  async function checkAuth() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { navigate('/admin'); return; }

    const { data: role } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .eq('role', 'superadmin')
      .single();

    if (!role) { navigate('/admin'); }
  }

  async function loadRestaurants() {
    const today = new Date().toISOString().split('T')[0];

    const { data: rests } = await supabase
      .from('restaurants')
      .select('*')
      .order('aangemaakt_op', { ascending: false });

    if (!rests) { setLoading(false); return; }

    const { data: orders } = await supabase
      .from('orders')
      .select('restaurant_id, totaal')
      .gte('aangemaakt_op', today);

    const enriched = rests.map(r => {
      const rOrders = orders?.filter(o => o.restaurant_id === r.id) || [];
      return {
        ...r,
        ordersToday: rOrders.length,
        revenueToday: rOrders.reduce((s, o) => s + Number(o.totaal), 0),
      };
    });

    setRestaurants(enriched);
    setLoading(false);
  }

  const handleCreate = async () => {
    if (!newNaam || !newSlug) return;
    setCreating(true);

    await supabase.from('restaurants').insert({
      naam: newNaam,
      slug: newSlug.toLowerCase().replace(/[^a-z0-9-]/g, ''),
    });

    setNewNaam('');
    setNewSlug('');
    setShowCreate(false);
    setCreating(false);
    loadRestaurants();
  };

  const toggleActive = async (id: string, actief: boolean) => {
    await supabase.from('restaurants').update({ actief: !actief }).eq('id', id);
    loadRestaurants();
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate('/admin');
  };

  return (
    <div className="min-h-screen p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-primary">KassaCloud</h1>
          <p className="text-muted-foreground">Superadmin Dashboard</p>
        </div>
        <div className="flex gap-3">
          <motion.button
            whileTap={{ scale: 0.95 }}
            onClick={() => setShowCreate(true)}
            className="touch-target px-5 py-3 rounded-lg bg-primary text-primary-foreground font-medium flex items-center gap-2"
          >
            <Plus className="w-4 h-4" /> Nieuw restaurant
          </motion.button>
          <motion.button
            whileTap={{ scale: 0.95 }}
            onClick={handleLogout}
            className="touch-target px-5 py-3 rounded-lg bg-secondary text-secondary-foreground font-medium"
          >
            <LogOut className="w-4 h-4" />
          </motion.button>
        </div>
      </div>

      {/* Create form */}
      {showCreate && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          className="surface p-6 space-y-4"
        >
          <h3 className="font-semibold">Nieuw restaurant aanmaken</h3>
          <div className="grid grid-cols-2 gap-4">
            <input
              value={newNaam}
              onChange={e => { setNewNaam(e.target.value); setNewSlug(e.target.value.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')); }}
              placeholder="Naam"
              className="px-4 py-3 rounded-lg bg-secondary text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
            />
            <input
              value={newSlug}
              onChange={e => setNewSlug(e.target.value)}
              placeholder="Slug (url)"
              className="px-4 py-3 rounded-lg bg-secondary text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>
          <div className="flex gap-3">
            <motion.button whileTap={{ scale: 0.95 }} onClick={handleCreate} disabled={creating}
              className="touch-target px-6 py-3 rounded-lg bg-primary text-primary-foreground font-medium disabled:opacity-50"
            >
              {creating ? 'Aanmaken...' : 'Aanmaken'}
            </motion.button>
            <motion.button whileTap={{ scale: 0.95 }} onClick={() => setShowCreate(false)}
              className="touch-target px-6 py-3 rounded-lg bg-secondary text-secondary-foreground font-medium"
            >
              Annuleren
            </motion.button>
          </div>
        </motion.div>
      )}

      {/* Restaurants table */}
      <div className="surface overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-border">
              <th className="text-left px-5 py-4 text-sm text-muted-foreground font-medium">Restaurant</th>
              <th className="text-left px-5 py-4 text-sm text-muted-foreground font-medium">Status</th>
              <th className="text-right px-5 py-4 text-sm text-muted-foreground font-medium">Orders vandaag</th>
              <th className="text-right px-5 py-4 text-sm text-muted-foreground font-medium">Omzet vandaag</th>
              <th className="text-right px-5 py-4 text-sm text-muted-foreground font-medium">Acties</th>
            </tr>
          </thead>
          <tbody>
            {restaurants.map(r => (
              <motion.tr
                key={r.id}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="border-b border-border last:border-0"
              >
                <td className="px-5 py-4">
                  <p className="font-medium">{r.naam}</p>
                  <p className="text-sm text-muted-foreground">/{r.slug}</p>
                </td>
                <td className="px-5 py-4">
                  <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                    r.actief ? 'bg-success/20 text-success' : 'bg-destructive/20 text-destructive'
                  }`}>
                    {r.actief ? 'Actief' : 'Inactief'}
                  </span>
                </td>
                <td className="px-5 py-4 text-right font-semibold">{r.ordersToday}</td>
                <td className="px-5 py-4 text-right font-semibold text-primary">€{r.revenueToday.toFixed(2)}</td>
                <td className="px-5 py-4 text-right">
                  <motion.button
                    whileTap={{ scale: 0.9 }}
                    onClick={() => toggleActive(r.id, r.actief)}
                    className="px-3 py-1 rounded-lg bg-secondary text-secondary-foreground text-sm font-medium"
                  >
                    {r.actief ? 'Deactiveren' : 'Activeren'}
                  </motion.button>
                </td>
              </motion.tr>
            ))}
          </tbody>
        </table>
        {restaurants.length === 0 && !loading && (
          <p className="text-center text-muted-foreground py-12">Nog geen restaurants aangemaakt</p>
        )}
      </div>
    </div>
  );
}
