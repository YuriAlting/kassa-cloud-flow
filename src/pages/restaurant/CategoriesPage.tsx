import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, Pencil, Trash2, X, Check } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface Category {
  id: string;
  name: string;
  sort_order: number;
  is_active: boolean;
}

export default function CategoriesPage() {
  const { profile } = useAuth();
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState({ name: '', sort_order: 0, is_active: true });
  const [showAdd, setShowAdd] = useState(false);

  const restaurantId = profile?.restaurant_id;

  useEffect(() => {
    if (restaurantId) load();
  }, [restaurantId]);

  async function load() {
    const { data } = await supabase
      .from('categories')
      .select('*')
      .eq('restaurant_id', restaurantId!)
      .order('sort_order');
    setCategories(data || []);
    setLoading(false);
  }

  const resetForm = () => {
    setForm({ name: '', sort_order: 0, is_active: true });
    setEditId(null);
    setShowAdd(false);
  };

  const handleSave = async () => {
    if (!form.name.trim()) return;

    if (editId) {
      const { error } = await supabase.from('categories').update({
        name: form.name,
        sort_order: form.sort_order,
        is_active: form.is_active,
      }).eq('id', editId);
      if (error) { toast.error('Fout bij opslaan'); return; }
      toast.success('Categorie bijgewerkt');
    } else {
      const { error } = await supabase.from('categories').insert({
        restaurant_id: restaurantId!,
        name: form.name,
        sort_order: form.sort_order,
        is_active: form.is_active,
      });
      if (error) { toast.error('Fout bij aanmaken'); return; }
      toast.success('Categorie aangemaakt');
    }
    resetForm();
    load();
  };

  const handleEdit = (cat: Category) => {
    setForm({ name: cat.name, sort_order: cat.sort_order, is_active: cat.is_active });
    setEditId(cat.id);
    setShowAdd(true);
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from('categories').delete().eq('id', id);
    if (error) { toast.error('Fout bij verwijderen'); return; }
    toast.success('Categorie verwijderd');
    load();
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold">Categorieën</h2>
        <motion.button
          whileTap={{ scale: 0.95 }}
          onClick={() => { resetForm(); setShowAdd(true); }}
          className="touch-target px-4 py-2 rounded-lg bg-primary text-primary-foreground font-medium flex items-center gap-2 text-sm"
        >
          <Plus className="w-4 h-4" /> Toevoegen
        </motion.button>
      </div>

      <AnimatePresence>
        {showAdd && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="surface p-5 space-y-4">
            <h3 className="font-semibold">{editId ? 'Categorie bewerken' : 'Nieuwe categorie'}</h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <input
                value={form.name}
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                placeholder="Naam"
                className="px-4 py-3 rounded-lg bg-secondary text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
              />
              <input
                type="number"
                value={form.sort_order}
                onChange={e => setForm(f => ({ ...f, sort_order: parseInt(e.target.value) || 0 }))}
                placeholder="Volgorde"
                className="px-4 py-3 rounded-lg bg-secondary text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
              />
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.is_active}
                  onChange={e => setForm(f => ({ ...f, is_active: e.target.checked }))}
                  className="w-5 h-5 rounded accent-primary"
                />
                <span className="text-sm">Actief</span>
              </label>
            </div>
            <div className="flex gap-3">
              <motion.button whileTap={{ scale: 0.95 }} onClick={handleSave} className="px-5 py-2 rounded-lg bg-primary text-primary-foreground font-medium text-sm flex items-center gap-2">
                <Check className="w-4 h-4" /> Opslaan
              </motion.button>
              <motion.button whileTap={{ scale: 0.95 }} onClick={resetForm} className="px-5 py-2 rounded-lg bg-secondary text-secondary-foreground font-medium text-sm flex items-center gap-2">
                <X className="w-4 h-4" /> Annuleren
              </motion.button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="surface overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-border">
              <th className="text-left px-5 py-3 text-sm text-muted-foreground font-medium">Naam</th>
              <th className="text-left px-5 py-3 text-sm text-muted-foreground font-medium">Volgorde</th>
              <th className="text-left px-5 py-3 text-sm text-muted-foreground font-medium">Status</th>
              <th className="text-right px-5 py-3 text-sm text-muted-foreground font-medium">Acties</th>
            </tr>
          </thead>
          <tbody>
            {categories.map(cat => (
              <tr key={cat.id} className="border-b border-border last:border-0">
                <td className="px-5 py-3 font-medium">{cat.name}</td>
                <td className="px-5 py-3 text-muted-foreground">{cat.sort_order}</td>
                <td className="px-5 py-3">
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${cat.is_active ? 'bg-success/20 text-success' : 'bg-destructive/20 text-destructive'}`}>
                    {cat.is_active ? 'Actief' : 'Inactief'}
                  </span>
                </td>
                <td className="px-5 py-3 text-right">
                  <div className="flex gap-2 justify-end">
                    <motion.button whileTap={{ scale: 0.9 }} onClick={() => handleEdit(cat)} className="p-2 rounded-lg bg-secondary hover:bg-muted">
                      <Pencil className="w-4 h-4" />
                    </motion.button>
                    <motion.button whileTap={{ scale: 0.9 }} onClick={() => handleDelete(cat.id)} className="p-2 rounded-lg bg-secondary hover:bg-destructive/20">
                      <Trash2 className="w-4 h-4 text-destructive" />
                    </motion.button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {categories.length === 0 && !loading && (
          <p className="text-center text-muted-foreground py-12">Nog geen categorieën. Maak er een aan.</p>
        )}
      </div>
    </div>
  );
}
