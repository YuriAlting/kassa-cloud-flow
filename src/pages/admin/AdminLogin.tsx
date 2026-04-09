import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { supabase } from '@/lib/supabase';

export default function AdminLogin() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    const { data, error: authError } = await supabase.auth.signInWithPassword({ email, password });

    if (authError || !data.user) {
      setError('Ongeldige inloggegevens');
      setLoading(false);
      return;
    }

    // Check superadmin role
    const { data: roleData } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', data.user.id)
      .eq('role', 'superadmin')
      .single();

    if (!roleData) {
      setError('Geen toegang');
      await supabase.auth.signOut();
      setLoading(false);
      return;
    }

    navigate('/admin/dashboard');
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <motion.form
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        onSubmit={handleLogin}
        className="surface w-full max-w-sm p-8 space-y-6"
      >
        <div className="text-center">
          <h1 className="text-2xl font-bold text-primary">KassaCloud</h1>
          <p className="text-muted-foreground text-sm mt-1">Superadmin</p>
        </div>

        <div className="space-y-4">
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
        </div>

        {error && <p className="text-destructive text-sm text-center">{error}</p>}

        <motion.button
          whileTap={{ scale: 0.95 }}
          type="submit"
          disabled={loading}
          className="touch-target w-full py-3 rounded-lg bg-primary text-primary-foreground font-bold disabled:opacity-50"
        >
          {loading ? 'Inloggen...' : 'Inloggen'}
        </motion.button>
      </motion.form>
    </div>
  );
}
