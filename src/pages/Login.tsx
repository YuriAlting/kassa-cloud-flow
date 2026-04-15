import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '@/integrations/supabase/client';
import { ArrowLeft, Delete } from 'lucide-react';

type Step = 'name' | 'pin' | 'superadmin';

export default function Login() {
  const navigate = useNavigate();
  const [step, setStep] = useState<Step>('name');
  const [name, setName] = useState('');
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // Superadmin
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const submitName = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setError('');
    setPin('');
    setStep('pin');
  };

  const pressDigit = (d: string) => {
    if (loading || pin.length >= 4) return;
    const next = pin + d;
    setPin(next);
    if (next.length === 4) submitPin(next);
  };

  const submitPin = async (code: string) => {
    setLoading(true);
    setError('');

    // Lookup via RPC: name + PIN â†’ email
    const { data: userEmail, error: rpcError } = await supabase.rpc('verify_pin_login', {
      p_display_name: name.trim().toLowerCase(),
      p_pin_code: code,
    });

    if (rpcError || !userEmail) {
      setError('Naam of PIN niet gevonden. Probeer opnieuw.');
      setPin('');
      setLoading(false);
      return;
    }

    // Sign in with email + PIN as password
    const { data: auth, error: authError } = await supabase.auth.signInWithPassword({
      email: userEmail,
      password: code,
    });

    if (authError || !auth.user) {
      setError('Inloggen mislukt. Vraag de beheerder om je PIN opnieuw in te stellen.');
      setPin('');
      setLoading(false);
      return;
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', auth.user.id)
      .single();

    setLoading(false);
    if (profile?.role === 'owner') navigate('/restaurant/dashboard');
    else navigate('/restaurant/plattegrond');
  };

  const submitSuperadmin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    const { data, error: authError } = await supabase.auth.signInWithPassword({ email, password });

    if (authError || !data.user) {
      setError('Ongeldige inloggegevens');
      setLoading(false);
      return;
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', data.user.id)
      .maybeSingle();

    setLoading(false);
    if (profile?.role === 'superadmin') navigate('/admin/dashboard');
    else if (profile?.role === 'owner') navigate('/restaurant/dashboard');
    else navigate('/restaurant/plattegrond');
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-background relative overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-br from-primary/10 via-background to-background" />
      <div className="absolute top-[-20%] left-[-10%] w-[500px] h-[500px] rounded-full bg-primary/5 blur-3xl" />

      <div className="relative z-10 w-full max-w-sm space-y-6">
        <div className="text-center">
          <h1 className="text-4xl font-extrabold text-primary tracking-tight">AIA Kassa</h1>
          <p className="text-muted-foreground text-sm mt-1">Made by AI Amsterdam</p>
        </div>

        <AnimatePresence mode="wait">

          {/* â”€â”€ NAAM â”€â”€ */}
          {step === 'name' && (
            <motion.form key="name" onSubmit={submitName}
              initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -12 }}
              className="surface p-6 space-y-5">
              <h2 className="text-lg font-bold text-foreground text-center">Welkom terug!</h2>
              <input
                autoFocus
                type="text"
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="Jouw naam"
                required
                className="w-full px-4 py-3 rounded-xl bg-secondary text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary text-lg"
              />
              <motion.button whileTap={{ scale: 0.97 }} type="submit"
                className="w-full py-4 rounded-xl bg-primary text-primary-foreground font-bold text-lg">
                Verder →
              </motion.button>
              <div className="text-center">
                <button type="button" onClick={() => { setStep('superadmin'); setError(''); }}
                  className="text-xs text-muted-foreground hover:text-foreground transition-colors">
                  Superadmin
                </button>
              </div>
            </motion.form>
          )}

          {/* â”€â”€ PIN â”€â”€ */}
          {step === 'pin' && (
            <motion.div key="pin"
              initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -12 }}
              className="surface p-6 space-y-6">
              <div className="flex items-center gap-3">
                <button onClick={() => { setStep('name'); setPin(''); setError(''); }}
                  className="p-2 rounded-lg bg-secondary">
                  <ArrowLeft className="w-4 h-4" />
                </button>
                <div>
                  <h2 className="font-bold text-lg">{name}</h2>
                  <p className="text-xs text-muted-foreground">Voer je 4-cijferige PIN in</p>
                </div>
              </div>

              {/* PIN dots */}
              <div className="flex justify-center gap-5">
                {[0, 1, 2, 3].map(i => (
                  <motion.div key={i}
                    animate={{ scale: pin.length > i ? 1.15 : 1 }}
                    transition={{ type: 'spring', stiffness: 400 }}
                    className={`w-5 h-5 rounded-full border-2 transition-colors ${
                      pin.length > i
                        ? 'bg-primary border-primary'
                        : 'border-muted-foreground bg-transparent'
                    }`}
                  />
                ))}
              </div>

              {error && (
                <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                  className="text-destructive text-sm text-center -mt-2">
                  {error}
                </motion.p>
              )}

              {/* Numpad */}
              <div className="grid grid-cols-3 gap-3">
                {['1','2','3','4','5','6','7','8','9'].map(d => (
                  <motion.button key={d} whileTap={{ scale: 0.82 }} onClick={() => pressDigit(d)}
                    disabled={loading || pin.length >= 4}
                    className="py-5 rounded-xl bg-secondary text-foreground font-bold text-2xl hover:bg-muted transition-colors disabled:opacity-40">
                    {d}
                  </motion.button>
                ))}
                <div />
                <motion.button whileTap={{ scale: 0.82 }} onClick={() => pressDigit('0')}
                  disabled={loading || pin.length >= 4}
                  className="py-5 rounded-xl bg-secondary text-foreground font-bold text-2xl hover:bg-muted transition-colors disabled:opacity-40">
                  0
                </motion.button>
                <motion.button whileTap={{ scale: 0.82 }}
                  onClick={() => { setPin(p => p.slice(0, -1)); setError(''); }}
                  disabled={loading}
                  className="py-5 rounded-xl bg-secondary text-muted-foreground hover:bg-muted transition-colors flex items-center justify-center">
                  <Delete className="w-6 h-6" />
                </motion.button>
              </div>

              {loading && (
                <div className="flex justify-center">
                  <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                </div>
              )}
            </motion.div>
          )}

          {/* â”€â”€ SUPERADMIN â”€â”€ */}
          {step === 'superadmin' && (
            <motion.form key="superadmin" onSubmit={submitSuperadmin}
              initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -12 }}
              className="surface p-6 space-y-4">
              <div className="flex items-center gap-3">
                <button type="button" onClick={() => { setStep('name'); setError(''); }}
                  className="p-2 rounded-lg bg-secondary">
                  <ArrowLeft className="w-4 h-4" />
                </button>
                <h2 className="font-bold text-lg">Superadmin</h2>
              </div>
              <input type="email" value={email} onChange={e => setEmail(e.target.value)}
                placeholder="E-mailadres" required autoComplete="email"
                className="w-full px-4 py-3 rounded-xl bg-secondary text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary" />
              <input type="password" value={password} onChange={e => setPassword(e.target.value)}
                placeholder="Wachtwoord" required minLength={8}
                className="w-full px-4 py-3 rounded-xl bg-secondary text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary" />
              {error && <p className="text-destructive text-sm text-center">{error}</p>}
              <motion.button whileTap={{ scale: 0.97 }} type="submit" disabled={loading}
                className="w-full py-3 rounded-xl bg-primary text-primary-foreground font-bold text-lg disabled:opacity-50">
                {loading ? 'Inloggen...' : 'Inloggen'}
              </motion.button>
            </motion.form>
          )}

        </AnimatePresence>
      </div>
    </div>
  );
}
