import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '@/integrations/supabase/client';
import { usePosStore } from '@/stores/posStore';

interface StaffProfile {
  id: string;
  full_name: string;
  role: string;
}

export default function PosLogin() {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const { setRestaurant, setProfile } = usePosStore();

  const [restaurant, setRestaurantData] = useState<{ id: string; name: string } | null>(null);
  const [staff, setStaff] = useState<StaffProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loginError, setLoginError] = useState('');
  const [loggingIn, setLoggingIn] = useState(false);

  useEffect(() => {
    async function load() {
      const { data: rest } = await supabase
        .from('restaurants')
        .select('id, name')
        .eq('slug', slug)
        .eq('is_active', true)
        .single();

      if (!rest) {
        navigate('/');
        return;
      }

      setRestaurantData(rest);
      setRestaurant(rest.id, rest.name);
      setLoading(false);
    }
    load();
  }, [slug]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError('');
    setLoggingIn(true);

    const { data, error } = await supabase.auth.signInWithPassword({ email, password });

    if (error || !data.user) {
      setLoginError('Ongeldige inloggegevens');
      setLoggingIn(false);
      return;
    }

    // Check profile belongs to this restaurant
    const { data: profile } = await supabase
      .from('profiles')
      .select('id, full_name, role, restaurant_id')
      .eq('id', data.user.id)
      .single();

    if (!profile) {
      setLoginError('Geen profiel gevonden');
      await supabase.auth.signOut();
      setLoggingIn(false);
      return;
    }

    // Superadmin can access any restaurant, others must match
    if (profile.role !== 'superadmin' && profile.restaurant_id !== restaurant?.id) {
      setLoginError('Geen toegang tot dit restaurant');
      await supabase.auth.signOut();
      setLoggingIn(false);
      return;
    }

    setProfile(profile.id, profile.full_name || 'Gebruiker');

    if (profile.role === 'owner' || profile.role === 'superadmin') {
      navigate(`/pos/${slug}/dashboard`);
    } else {
      navigate(`/pos/${slug}/bestelling`);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-sm flex flex-col items-center gap-8"
      >
        <div className="text-center">
          <h1 className="text-3xl font-bold text-primary">{restaurant?.name}</h1>
          <p className="text-muted-foreground mt-1">KassaCloud POS</p>
        </div>

        <form onSubmit={handleLogin} className="w-full space-y-4">
          <input
            type="email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            placeholder="E-mail"
            required
            className="w-full px-4 py-3 rounded-lg bg-secondary text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
          />
          <input
            type="password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            placeholder="Wachtwoord"
            required
            className="w-full px-4 py-3 rounded-lg bg-secondary text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
          />
          {loginError && <p className="text-destructive text-sm text-center">{loginError}</p>}
          <motion.button
            whileTap={{ scale: 0.95 }}
            type="submit"
            disabled={loggingIn}
            className="touch-target w-full py-4 rounded-lg bg-primary text-primary-foreground font-bold text-lg disabled:opacity-50"
          >
            {loggingIn ? 'Inloggen...' : 'Inloggen'}
          </motion.button>
        </form>
      </motion.div>
    </div>
  );
}
