import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '@/integrations/supabase/client';
import { ArrowLeft, Trash2, Key, UserCog, Clock, Plus, CreditCard } from 'lucide-react';

type Staff = {
  id: string;
  full_name: string;
  display_name: string;
  role: string;
  pin_code: string;
};

export default function SettingsPage() {
  const navigate = useNavigate();
  const [staff, setStaff] = useState<Staff[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'staff' | 'log' | 'betaling'>('staff');
  const [restaurantId, setRestaurantId] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('both');
  const [savingPayment, setSavingPayment] = useState(false);

  // Modals
  const [showPin, setShowPin] = useState<Staff | null>(null);
  const [showRole, setShowRole] = useState<Staff | null>(null);

  // Form state
  const [editPin, setEditPin] = useState('');
  const [editRole, setEditRole] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const loadStaff = async () => {
    setLoading(true);
    const { data: currentUser } = await supabase.auth.getUser();
    const { data: currentProfile } = await supabase
      .from('profiles')
      .select('restaurant_id')
      .eq('id', currentUser.user!.id)
      .single();

    setRestaurantId(currentProfile!.restaurant_id);

    const { data } = await supabase
      .from('profiles')
      .select('id, full_name, display_name, role, pin_code')
      .eq('restaurant_id', currentProfile!.restaurant_id)
      .neq('role', 'superadmin');

    if (data) setStaff(data);

    // Laad betaalmethode instelling
    const { data: restaurant } = await supabase
      .from('restaurants')
      .select('payment_methods')
      .eq('id', currentProfile!.restaurant_id)
      .single();

    if (restaurant?.payment_methods) setPaymentMethod(restaurant.payment_methods);
    setLoading(false);
  };

  useEffect(() => {
    loadStaff();
  }, []);

  const handleUpdatePin = async () => {
    if (editPin.length !== 4) { setError('PIN moet 4 cijfers zijn.'); return; }
    setSaving(true);
    setError('');

    const { error: profileError } = await supabase
      .from('profiles')
      .update({ pin_code: editPin })
      .eq('id', showPin!.id);

    setSaving(false);
    if (profileError) {
      setError('Fout bij wijzigen PIN.');
    } else {
      setSuccess('PIN gewijzigd! ✓');
      setShowPin(null);
      setEditPin('');
      loadStaff();
    }
  };

  const handleUpdateRole = async () => {
    setSaving(true);
    setError('');

    const { error: roleError } = await supabase
      .from('profiles')
      .update({ role: editRole as 'owner' | 'staff' })
      .eq('id', showRole!.id);

    setSaving(false);
    if (roleError) {
      setError('Fout bij wijzigen rol.');
    } else {
      setSuccess('Rol gewijzigd! ✓');
      setShowRole(null);
      loadStaff();
    }
  };

  const handleSavePayment = async () => {
    setSavingPayment(true);
    const { error } = await supabase
      .from('restaurants')
      .update({ payment_methods: paymentMethod })
      .eq('id', restaurantId);

    setSavingPayment(false);
    if (error) {
      setSuccess('');
      setError('Fout bij opslaan.');
    } else {
      setSuccess('Betaalmethode opgeslagen! ✓');
    }
  };

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-2xl mx-auto space-y-6">

        {/* Header */}
        <div className="flex items-center gap-3">
          <button onClick={() => navigate('/restaurant/dashboard')}
            className="p-2 rounded-lg bg-secondary">
            <ArrowLeft className="w-4 h-4" />
          </button>
          <h1 className="text-2xl font-bold">Instellingen</h1>
        </div>

        {/* Success melding */}
        <AnimatePresence>
          {success && (
            <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
              className="p-3 rounded-xl bg-green-500/20 text-green-400 text-sm text-center">
              {success}
              <button onClick={() => setSuccess('')} className="ml-3 underline">sluiten</button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Tabs */}
        <div className="flex gap-2">
          <button onClick={() => setTab('staff')}
            className={`px-4 py-2 rounded-xl font-semibold text-sm transition-colors ${tab === 'staff' ? 'bg-primary text-primary-foreground' : 'bg-secondary text-muted-foreground'}`}>
            Medewerkers
          </button>
          <button onClick={() => setTab('log')}
            className={`px-4 py-2 rounded-xl font-semibold text-sm transition-colors ${tab === 'log' ? 'bg-primary text-primary-foreground' : 'bg-secondary text-muted-foreground'}`}>
            Activiteit log
          </button>
          <button onClick={() => setTab('betaling')}
            className={`px-4 py-2 rounded-xl font-semibold text-sm transition-colors ${tab === 'betaling' ? 'bg-primary text-primary-foreground' : 'bg-secondary text-muted-foreground'}`}>
            Betaling
          </button>
        </div>

        {/* Staff tab */}
        {tab === 'staff' && (
          <div className="space-y-4">
            <div className="surface p-4 border border-dashed border-muted-foreground/30 rounded-xl flex items-center gap-3 opacity-60">
              <Plus className="w-4 h-4 text-muted-foreground" />
              <div>
                <p className="font-semibold text-sm">Medewerker toevoegen</p>
                <p className="text-xs text-muted-foreground">Beschikbaar na volgende Lovable deployment</p>
              </div>
            </div>

            {loading ? (
              <div className="flex justify-center py-8">
                <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
              </div>
            ) : (
              <div className="space-y-3">
                {staff.map(member => (
                  <div key={member.id} className="surface p-4 flex items-center justify-between">
                    <div>
                      <p className="font-bold">{member.display_name || member.full_name}</p>
                      <p className="text-xs text-muted-foreground capitalize">{member.role} · PIN: {member.pin_code}</p>
                    </div>
                    <div className="flex gap-2">
                      <button onClick={() => { setShowPin(member); setEditPin(''); setError(''); }}
                        className="p-2 rounded-lg bg-secondary hover:bg-muted transition-colors" title="PIN wijzigen">
                        <Key className="w-4 h-4" />
                      </button>
                      <button onClick={() => { setShowRole(member); setEditRole(member.role); setError(''); }}
                        className="p-2 rounded-lg bg-secondary hover:bg-muted transition-colors" title="Rol wijzigen">
                        <UserCog className="w-4 h-4" />
                      </button>
                      <button className="p-2 rounded-lg bg-destructive/10 text-destructive/40 cursor-not-allowed" title="Beschikbaar na deployment">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Log tab */}
        {tab === 'log' && (
          <div className="space-y-3">
            {loading ? (
              <div className="flex justify-center py-8">
                <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
              </div>
            ) : staff.length === 0 ? (
              <p className="text-muted-foreground text-center py-8">Geen medewerkers gevonden.</p>
            ) : (
              staff.map(member => (
                <div key={member.id} className="surface p-4 flex items-center gap-3">
                  <Clock className="w-4 h-4 text-muted-foreground" />
                  <div>
                    <p className="font-semibold">{member.display_name || member.full_name}</p>
                    <p className="text-xs text-muted-foreground capitalize">{member.role}</p>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* Betaling tab */}
        {tab === 'betaling' && (
          <div className="surface p-6 space-y-5">
            <div className="flex items-center gap-3">
              <CreditCard className="w-5 h-5 text-primary" />
              <h2 className="font-bold text-lg">Betaalmethodes</h2>
            </div>
            <p className="text-sm text-muted-foreground">Kies welke betaalmethodes beschikbaar zijn bij het afrekenen.</p>

            <div className="space-y-3">
              {[
                { value: 'pin', label: 'Alleen pin', desc: 'Medewerkers kunnen alleen pinnen' },
                { value: 'cash', label: 'Alleen contant', desc: 'Medewerkers kunnen alleen contant afrekenen' },
                { value: 'both', label: 'Beide', desc: 'Medewerkers kunnen kiezen tussen pin en contant' },
              ].map(option => (
                <button key={option.value} onClick={() => setPaymentMethod(option.value)}
                  className={`w-full p-4 rounded-xl border-2 text-left transition-colors ${
                    paymentMethod === option.value
                      ? 'border-primary bg-primary/10'
                      : 'border-border bg-secondary hover:bg-muted'
                  }`}>
                  <p className="font-semibold">{option.label}</p>
                  <p className="text-xs text-muted-foreground">{option.desc}</p>
                </button>
              ))}
            </div>

            <button onClick={handleSavePayment} disabled={savingPayment}
              className="w-full py-3 rounded-xl bg-primary text-primary-foreground font-semibold disabled:opacity-50">
              {savingPayment ? 'Opslaan...' : 'Opslaan'}
            </button>
          </div>
        )}
      </div>

      {/* Modal: PIN wijzigen */}
      <AnimatePresence>
        {showPin && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 flex items-center justify-center p-6 z-50">
            <motion.div initial={{ scale: 0.95 }} animate={{ scale: 1 }} exit={{ scale: 0.95 }}
              className="surface p-6 w-full max-w-sm space-y-4">
              <h2 className="font-bold text-lg">PIN wijzigen — {showPin.display_name || showPin.full_name}</h2>
              <input type="text" value={editPin} onChange={e => setEditPin(e.target.value.replace(/\D/g, '').slice(0, 4))}
                placeholder="Nieuwe 4-cijferige PIN"
                className="w-full px-4 py-3 rounded-xl bg-secondary text-foreground focus:outline-none focus:ring-2 focus:ring-primary" />
              {error && <p className="text-destructive text-sm">{error}</p>}
              <div className="flex gap-3">
                <button onClick={() => { setShowPin(null); setError(''); }}
                  className="flex-1 py-3 rounded-xl bg-secondary font-semibold">Annuleren</button>
                <button onClick={handleUpdatePin} disabled={saving}
                  className="flex-1 py-3 rounded-xl bg-primary text-primary-foreground font-semibold disabled:opacity-50">
                  {saving ? 'Bezig...' : 'Opslaan'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Modal: Rol wijzigen */}
      <AnimatePresence>
        {showRole && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 flex items-center justify-center p-6 z-50">
            <motion.div initial={{ scale: 0.95 }} animate={{ scale: 1 }} exit={{ scale: 0.95 }}
              className="surface p-6 w-full max-w-sm space-y-4">
              <h2 className="font-bold text-lg">Rol wijzigen — {showRole.display_name || showRole.full_name}</h2>
              <select value={editRole} onChange={e => setEditRole(e.target.value)}
                className="w-full px-4 py-3 rounded-xl bg-secondary text-foreground focus:outline-none focus:ring-2 focus:ring-primary">
                <option value="staff">Staff</option>
                <option value="owner">Owner</option>
              </select>
              {error && <p className="text-destructive text-sm">{error}</p>}
              <div className="flex gap-3">
                <button onClick={() => { setShowRole(null); setError(''); }}
                  className="flex-1 py-3 rounded-xl bg-secondary font-semibold">Annuleren</button>
                <button onClick={handleUpdateRole} disabled={saving}
                  className="flex-1 py-3 rounded-xl bg-primary text-primary-foreground font-semibold disabled:opacity-50">
                  {saving ? 'Bezig...' : 'Opslaan'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}