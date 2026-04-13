import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '@/integrations/supabase/client';
import { ArrowLeft, Plus, Trash2, Key, UserCog, Clock } from 'lucide-react';

type Staff = {
  id: string;
  full_name: string;
  display_name: string;
  role: string;
  pin_code: string;
};

type Log = {
  id: string;
  display_name: string;
  last_sign_in_at: string;
};

export default function SettingsPage() {
  const navigate = useNavigate();
  const [staff, setStaff] = useState<Staff[]>([]);
  const [logs, setLogs] = useState<Log[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'staff' | 'log'>('staff');

  // Modals
  const [showCreate, setShowCreate] = useState(false);
  const [showPin, setShowPin] = useState<Staff | null>(null);
  const [showRole, setShowRole] = useState<Staff | null>(null);

  // Form state
  const [newName, setNewName] = useState('');
  const [newPin, setNewPin] = useState('');
  const [newRole, setNewRole] = useState('staff');
  const [editPin, setEditPin] = useState('');
  const [editRole, setEditRole] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const callFunction = async (action: string, payload = {}) => {
    const { data: { session } } = await supabase.auth.getSession();
    const res = await fetch(
      `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/admin-users`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token}`,
        },
        body: JSON.stringify({ action, ...payload }),
      }
    );
    return res.json();
  };

  const loadStaff = async () => {
    setLoading(true);
    const result = await callFunction('list_staff');
    if (result.data) setStaff(result.data);
    setLoading(false);
  };

  const loadLogs = async () => {
    const result = await callFunction('list_staff');
    if (result.data) {
      // Haal last_sign_in_at op via auth
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/admin-users`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session?.access_token}`,
          },
          body: JSON.stringify({ action: 'list_logs' }),
        }
      );
      const logResult = await res.json();
      if (logResult.data) setLogs(logResult.data);
    }
  };

  useEffect(() => {
    loadStaff();
  }, []);

  const handleCreate = async () => {
    if (!newName || newPin.length !== 4) {
      setError('Vul een naam en 4-cijferige PIN in.');
      return;
    }
    setSaving(true);
    setError('');
    const result = await callFunction('create_user', { display_name: newName, pin: newPin, role: newRole });
    setSaving(false);
    if (result.success) {
      setSuccess('Account aangemaakt!');
      setShowCreate(false);
      setNewName(''); setNewPin(''); setNewRole('staff');
      loadStaff();
    } else {
      setError(result.error || 'Fout bij aanmaken.');
    }
  };

  const handleDelete = async (member: Staff) => {
    if (!confirm(`Weet je zeker dat je ${member.display_name} wilt verwijderen?`)) return;
    await callFunction('delete_user', { user_id: member.id });
    setSuccess(`${member.display_name} verwijderd.`);
    loadStaff();
  };

  const handleUpdatePin = async () => {
    if (editPin.length !== 4) { setError('PIN moet 4 cijfers zijn.'); return; }
    setSaving(true);
    setError('');
    const result = await callFunction('update_pin', { user_id: showPin!.id, new_pin: editPin });
    setSaving(false);
    if (result.success) {
      setSuccess('PIN gewijzigd!');
      setShowPin(null);
      setEditPin('');
      loadStaff();
    } else {
      setError(result.error || 'Fout bij wijzigen.');
    }
  };

  const handleUpdateRole = async () => {
    setSaving(true);
    setError('');
    const result = await callFunction('update_role', { user_id: showRole!.id, new_role: editRole });
    setSaving(false);
    if (result.success) {
      setSuccess('Rol gewijzigd!');
      setShowRole(null);
      loadStaff();
    } else {
      setError(result.error || 'Fout bij wijzigen.');
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
          <button onClick={() => { setTab('log'); loadLogs(); }}
            className={`px-4 py-2 rounded-xl font-semibold text-sm transition-colors ${tab === 'log' ? 'bg-primary text-primary-foreground' : 'bg-secondary text-muted-foreground'}`}>
            Activiteit log
          </button>
        </div>

        {/* Staff tab */}
        {tab === 'staff' && (
          <div className="space-y-4">
            <button onClick={() => setShowCreate(true)}
              className="flex items-center gap-2 px-4 py-3 rounded-xl bg-primary text-primary-foreground font-semibold w-full justify-center">
              <Plus className="w-4 h-4" /> Medewerker toevoegen
            </button>

            {loading ? (
              <div className="flex justify-center py-8">
                <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
              </div>
            ) : (
              <div className="space-y-3">
                {staff.map(member => (
                  <div key={member.id} className="surface p-4 flex items-center justify-between">
                    <div>
                      <p className="font-bold">{member.display_name}</p>
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
                      <button onClick={() => handleDelete(member)}
                        className="p-2 rounded-lg bg-destructive/20 hover:bg-destructive/40 transition-colors text-destructive" title="Verwijderen">
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
            {logs.length === 0 ? (
              <p className="text-muted-foreground text-center py-8">Geen activiteit gevonden.</p>
            ) : (
              logs.map(log => (
                <div key={log.id} className="surface p-4 flex items-center gap-3">
                  <Clock className="w-4 h-4 text-muted-foreground" />
                  <div>
                    <p className="font-semibold">{log.display_name}</p>
                    <p className="text-xs text-muted-foreground">
                      Laatste login: {log.last_sign_in_at ? new Date(log.last_sign_in_at).toLocaleString('nl-NL') : 'Nog niet ingelogd'}
                    </p>
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </div>

      {/* Modal: Account aanmaken */}
      <AnimatePresence>
        {showCreate && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 flex items-center justify-center p-6 z-50">
            <motion.div initial={{ scale: 0.95 }} animate={{ scale: 1 }} exit={{ scale: 0.95 }}
              className="surface p-6 w-full max-w-sm space-y-4">
              <h2 className="font-bold text-lg">Medewerker toevoegen</h2>
              <input type="text" value={newName} onChange={e => setNewName(e.target.value)}
                placeholder="Naam" className="w-full px-4 py-3 rounded-xl bg-secondary text-foreground focus:outline-none focus:ring-2 focus:ring-primary" />
              <input type="text" value={newPin} onChange={e => setNewPin(e.target.value.replace(/\D/g, '').slice(0, 4))}
                placeholder="4-cijferige PIN" className="w-full px-4 py-3 rounded-xl bg-secondary text-foreground focus:outline-none focus:ring-2 focus:ring-primary" />
              <select value={newRole} onChange={e => setNewRole(e.target.value)}
                className="w-full px-4 py-3 rounded-xl bg-secondary text-foreground focus:outline-none focus:ring-2 focus:ring-primary">
                <option value="staff">Staff</option>
                <option value="owner">Owner</option>
              </select>
              {error && <p className="text-destructive text-sm">{error}</p>}
              <div className="flex gap-3">
                <button onClick={() => { setShowCreate(false); setError(''); }}
                  className="flex-1 py-3 rounded-xl bg-secondary font-semibold">Annuleren</button>
                <button onClick={handleCreate} disabled={saving}
                  className="flex-1 py-3 rounded-xl bg-primary text-primary-foreground font-semibold disabled:opacity-50">
                  {saving ? 'Bezig...' : 'Aanmaken'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Modal: PIN wijzigen */}
      <AnimatePresence>
        {showPin && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 flex items-center justify-center p-6 z-50">
            <motion.div initial={{ scale: 0.95 }} animate={{ scale: 1 }} exit={{ scale: 0.95 }}
              className="surface p-6 w-full max-w-sm space-y-4">
              <h2 className="font-bold text-lg">PIN wijzigen — {showPin.display_name}</h2>
              <input type="text" value={editPin} onChange={e => setEditPin(e.target.value.replace(/\D/g, '').slice(0, 4))}
                placeholder="Nieuwe 4-cijferige PIN" className="w-full px-4 py-3 rounded-xl bg-secondary text-foreground focus:outline-none focus:ring-2 focus:ring-primary" />
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
              <h2 className="font-bold text-lg">Rol wijzigen — {showRole.display_name}</h2>
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