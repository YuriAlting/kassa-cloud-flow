import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, Pencil, Trash2, X, Check } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface MenuItem {
  id: string;
  name: string;
  description: string | null;
  price: number;
  category_id: string | null;
  is_active: boolean;
  sort_order: number;
}

interface Category {
  id: string;
  name: string;
}

export default function MenuPage() {
  const { profile } = useAuth();
  const [items, setItems] = useState<MenuItem[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [editId, setEditId] = useState<string | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({
    name: '', description: '', price: 0, category_id: '', is_active: true, sort_order: 0,
  });

  const restaurantId = profile?.restaurant_id;

  useEffect(() => {
    if (restaurantId) {
      loadAll();
    }
  }, [restaurantId]);

  async function loadAll() {
    const [{ data: menuData }, { data: catData }] = await Promise.all([
      supabase.from('menu_items').select('*').eq('restaurant_id', restaurantId!).order('sort_order'),
      supabase.from('categories').select('id, name').eq('restaurant_id', restaurantId!).order('sort_order'),
    ]);
    setItems(menuData || []);
    setCategories(catData || []);
    setLoading(false);
  }

  const resetForm = () => {
    setForm({ name: '', description: '', price: 0, category_id: '', is_active: true, sort_order: 0 });
    setEditId(null);
    setShowAdd(false);
  };

  const handleSave = async () => {
    if (!form.name.trim()) return;

    const payload = {
      name: form.name,
      description: form.description || null,
      price: form.price,
      category_id: form.category_id || null,
      is_active: form.is_active,
      sort_order: form.sort_order,
    };

    if (editId) {
      const { error } = await supabase.from('menu_items').update(payload).eq('id', editId);
      if (error) { toast.error('Fout bij opslaan'); return; }
      toast.success('Product bijgewerkt');
    } else {
      const { error } = await supabase.from('menu_items').insert({ ...payload, restaurant_id: restaurantId! });
      if (error) { toast.error('Fout bij aanmaken'); return; }
      toast.success('Product aangemaakt');
    }
    resetForm();
    loadAll();
  };

  const handleEdit = (item: MenuItem) => {
    setForm({
      name: item.name,
      description: item.description || '',
      price: item.price,
      category_id: item.category_id || '',
      is_active: item.is_active,
      sort_order: item.sort_order,
    });
    setEditId(item.id);
    setShowAdd(true);
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from('menu_items').delete().eq('id', id);
    if (error) { toast.error('Fout bij verwijderen'); return; }
    toast.success('Product verwijderd');
    loadAll();
  };

  const getCategoryName = (id: string | null) => categories.find(c => c.id === id)?.name || '—';

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold">Menu</h2>
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
            <h3 className="font-semibold">{editId ? 'Product bewerken' : 'Nieuw product'}</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              <input
                value={form.name}
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                placeholder="Naam"
                className="px-4 py-3 rounded-lg bg-secondary text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
              />
              <input
                value={form.description}
                onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                placeholder="Beschrijving"
                className="px-4 py-3 rounded-lg bg-secondary text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
              />
              <input
                type="number"
                step="0.01"
                value={form.price}
                onChange={e => setForm(f => ({ ...f, price: parseFloat(e.target.value) || 0 }))}
                placeholder="Prijs"
                className="px-4 py-3 rounded-lg bg-secondary text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
              />
              <select
                value={form.category_id}
                onChange={e => setForm(f => ({ ...f, category_id: e.target.value }))}
                className="px-4 py-3 rounded-lg bg-secondary text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
              >
                <option value="">Geen categorie</option>
                {categories.map(c => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
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
              <th className="text-left px-5 py-3 text-sm text-muted-foreground font-medium">Categorie</th>
              <th className="text-right px-5 py-3 text-sm text-muted-foreground font-medium">Prijs</th>
              <th className="text-left px-5 py-3 text-sm text-muted-foreground font-medium">Status</th>
              <th className="text-right px-5 py-3 text-sm text-muted-foreground font-medium">Acties</th>
            </tr>
          </thead>
          <tbody>
            {items.map(item => (
              <tr key={item.id} className="border-b border-border last:border-0">
                <td className="px-5 py-3">
                  <p className="font-medium">{item.name}</p>
                  {item.description && <p className="text-xs text-muted-foreground">{item.description}</p>}
                </td>
                <td className="px-5 py-3 text-muted-foreground text-sm">{getCategoryName(item.category_id)}</td>
                <td className="px-5 py-3 text-right font-semibold text-primary">€{Number(item.price).toFixed(2)}</td>
                <td className="px-5 py-3">
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${item.is_active ? 'bg-success/20 text-success' : 'bg-destructive/20 text-destructive'}`}>
                    {item.is_active ? 'Actief' : 'Inactief'}
                  </span>
                </td>
                <td className="px-5 py-3 text-right">
                  <div className="flex gap-2 justify-end">
                    <motion.button whileTap={{ scale: 0.9 }} onClick={() => handleEdit(item)} className="p-2 rounded-lg bg-secondary hover:bg-muted">
                      <Pencil className="w-4 h-4" />
                    </motion.button>
                    <motion.button whileTap={{ scale: 0.9 }} onClick={() => handleDelete(item.id)} className="p-2 rounded-lg bg-secondary hover:bg-destructive/20">
                      <Trash2 className="w-4 h-4 text-destructive" />
                    </motion.button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {items.length === 0 && !loading && (
          <p className="text-center text-muted-foreground py-12">Nog geen producten. Voeg er een toe.</p>
        )}
      </div>
    </div>
  );
}
