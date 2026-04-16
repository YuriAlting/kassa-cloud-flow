import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, Pencil, Trash2, X, Check, Search, ChevronDown, ChevronRight } from 'lucide-react';
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
  sort_order: number;
  is_active: boolean;
}

type Tab = 'menu' | 'categories';

export default function MenuPage() {
  const { profile } = useAuth();
  const [items, setItems] = useState<MenuItem[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>('menu');
  const [search, setSearch] = useState('');
  const [expandedCats, setExpandedCats] = useState<Set<string>>(new Set());

  // Menu form
  const [editMenuId, setEditMenuId] = useState<string | null>(null);
  const [showMenuForm, setShowMenuForm] = useState(false);
  const [menuForm, setMenuForm] = useState({ name: '', description: '', price: 0, category_id: '', is_active: true, sort_order: 0 });

  // Category form
  const [editCatId, setEditCatId] = useState<string | null>(null);
  const [showCatForm, setShowCatForm] = useState(false);
  const [catForm, setCatForm] = useState({ name: '', sort_order: 0, is_active: true });

  const restaurantId = profile?.restaurant_id;

  useEffect(() => {
    if (restaurantId) loadAll();
  }, [restaurantId]);

  async function loadAll() {
    const [{ data: menuData }, { data: catData }] = await Promise.all([
      supabase.from('menu_items').select('*').eq('restaurant_id', restaurantId!).order('sort_order'),
      supabase.from('categories').select('id, name, sort_order, is_active').eq('restaurant_id', restaurantId!).order('sort_order'),
    ]);
    setItems(menuData || []);
    setCategories(catData || []);
    // Open alle categorieën standaard
    if (catData) setExpandedCats(new Set(catData.map(c => c.id)));
    setLoading(false);
  }

  const toggleCat = (id: string) => {
    setExpandedCats(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  // === MENU HANDLERS ===
  const resetMenuForm = () => {
    setMenuForm({ name: '', description: '', price: 0, category_id: '', is_active: true, sort_order: 0 });
    setEditMenuId(null);
    setShowMenuForm(false);
  };

  const handleMenuSave = async () => {
    if (!menuForm.name.trim()) return;
    const payload = {
      name: menuForm.name,
      description: menuForm.description || null,
      price: menuForm.price,
      category_id: menuForm.category_id || null,
      is_active: menuForm.is_active,
      sort_order: menuForm.sort_order,
    };
    if (editMenuId) {
      const { error } = await supabase.from('menu_items').update(payload).eq('id', editMenuId);
      if (error) { toast.error('Fout bij opslaan'); return; }
      toast.success('Product bijgewerkt');
    } else {
      const { error } = await supabase.from('menu_items').insert({ ...payload, restaurant_id: restaurantId! });
      if (error) { toast.error('Fout bij aanmaken'); return; }
      toast.success('Product aangemaakt');
    }
    resetMenuForm();
    loadAll();
  };

  const handleMenuEdit = (item: MenuItem) => {
    setMenuForm({ name: item.name, description: item.description || '', price: item.price, category_id: item.category_id || '', is_active: item.is_active, sort_order: item.sort_order });
    setEditMenuId(item.id);
    setShowMenuForm(true);
  };

  const handleMenuDelete = async (id: string) => {
    const { error } = await supabase.from('menu_items').delete().eq('id', id);
    if (error) { toast.error('Fout bij verwijderen'); return; }
    toast.success('Product verwijderd');
    loadAll();
  };

  // === CATEGORY HANDLERS ===
  const resetCatForm = () => {
    setCatForm({ name: '', sort_order: 0, is_active: true });
    setEditCatId(null);
    setShowCatForm(false);
  };

  const handleCatSave = async () => {
    if (!catForm.name.trim()) return;
    if (editCatId) {
      const { error } = await supabase.from('categories').update({ name: catForm.name, sort_order: catForm.sort_order, is_active: catForm.is_active }).eq('id', editCatId);
      if (error) { toast.error('Fout bij opslaan'); return; }
      toast.success('Categorie bijgewerkt');
    } else {
      const { error } = await supabase.from('categories').insert({ restaurant_id: restaurantId!, name: catForm.name, sort_order: catForm.sort_order, is_active: catForm.is_active });
      if (error) { toast.error('Fout bij aanmaken'); return; }
      toast.success('Categorie aangemaakt');
    }
    resetCatForm();
    loadAll();
  };

  const handleCatEdit = (cat: Category) => {
    setCatForm({ name: cat.name, sort_order: cat.sort_order, is_active: cat.is_active });
    setEditCatId(cat.id);
    setShowCatForm(true);
  };

  const handleCatDelete = async (id: string) => {
    const { error } = await supabase.from('categories').delete().eq('id', id);
    if (error) { toast.error('Fout bij verwijderen'); return; }
    toast.success('Categorie verwijderd');
    loadAll();
  };

  // Gefilterde items voor zoeken
  const searchedItems = search.trim()
    ? items.filter(i => i.name.toLowerCase().includes(search.toLowerCase()) || (i.description || '').toLowerCase().includes(search.toLowerCase()))
    : null;

  return (
    <div className="p-6 space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex gap-1 bg-secondary rounded-lg p-1">
          <button
            onClick={() => setTab('menu')}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${tab === 'menu' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'}`}
          >
            Menu
          </button>
          <button
            onClick={() => setTab('categories')}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${tab === 'categories' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'}`}
          >
            Categorieën
          </button>
        </div>

        <div className="flex items-center gap-3">
          {tab === 'menu' && (
            <div className="flex items-center gap-2 bg-secondary rounded-lg px-3 py-2">
              <Search className="w-4 h-4 text-muted-foreground shrink-0" />
              <input
                type="text"
                placeholder="Zoek product..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="bg-transparent text-sm text-foreground placeholder:text-muted-foreground outline-none w-40"
              />
              {search && <button onClick={() => setSearch('')}><X className="w-4 h-4 text-muted-foreground" /></button>}
            </div>
          )}
          <motion.button
            whileTap={{ scale: 0.95 }}
            onClick={() => { if (tab === 'menu') { resetMenuForm(); setShowMenuForm(true); } else { resetCatForm(); setShowCatForm(true); } }}
            className="px-4 py-2 rounded-lg bg-primary text-primary-foreground font-medium flex items-center gap-2 text-sm"
          >
            <Plus className="w-4 h-4" /> Toevoegen
          </motion.button>
        </div>
      </div>

      {/* === MENU TAB === */}
      {tab === 'menu' && (
        <div className="space-y-4">
          {/* Formulier */}
          <AnimatePresence>
            {showMenuForm && (
              <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="surface p-5 space-y-4">
                <h3 className="font-semibold">{editMenuId ? 'Product bewerken' : 'Nieuw product'}</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  <input value={menuForm.name} onChange={e => setMenuForm(f => ({ ...f, name: e.target.value }))} placeholder="Naam"
                    className="px-4 py-3 rounded-lg bg-secondary text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary" />
                  <input value={menuForm.description} onChange={e => setMenuForm(f => ({ ...f, description: e.target.value }))} placeholder="Beschrijving"
                    className="px-4 py-3 rounded-lg bg-secondary text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary" />
                  <input type="number" step="0.01" value={menuForm.price} onChange={e => setMenuForm(f => ({ ...f, price: parseFloat(e.target.value) || 0 }))} placeholder="Prijs"
                    className="px-4 py-3 rounded-lg bg-secondary text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary" />
                  <select value={menuForm.category_id} onChange={e => setMenuForm(f => ({ ...f, category_id: e.target.value }))}
                    className="px-4 py-3 rounded-lg bg-secondary text-foreground focus:outline-none focus:ring-2 focus:ring-primary">
                    <option value="">Geen categorie</option>
                    {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                  <input type="number" value={menuForm.sort_order} onChange={e => setMenuForm(f => ({ ...f, sort_order: parseInt(e.target.value) || 0 }))} placeholder="Volgorde"
                    className="px-4 py-3 rounded-lg bg-secondary text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary" />
                  <label className="flex items-center gap-3 cursor-pointer">
                    <input type="checkbox" checked={menuForm.is_active} onChange={e => setMenuForm(f => ({ ...f, is_active: e.target.checked }))} className="w-5 h-5 rounded accent-primary" />
                    <span className="text-sm">Actief</span>
                  </label>
                </div>
                <div className="flex gap-3">
                  <motion.button whileTap={{ scale: 0.95 }} onClick={handleMenuSave} className="px-5 py-2 rounded-lg bg-primary text-primary-foreground font-medium text-sm flex items-center gap-2">
                    <Check className="w-4 h-4" /> Opslaan
                  </motion.button>
                  <motion.button whileTap={{ scale: 0.95 }} onClick={resetMenuForm} className="px-5 py-2 rounded-lg bg-secondary text-secondary-foreground font-medium text-sm flex items-center gap-2">
                    <X className="w-4 h-4" /> Annuleren
                  </motion.button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Zoekresultaten — platte lijst */}
          {searchedItems ? (
            <div className="surface overflow-hidden">
              <div className="px-5 py-3 border-b border-border text-sm text-muted-foreground">
                {searchedItems.length} resultaat{searchedItems.length !== 1 ? 'en' : ''} voor "{search}"
              </div>
              {searchedItems.map(item => (
                <div key={item.id} className="flex items-center justify-between px-5 py-3 border-b border-border last:border-0">
                  <div>
                    <p className="font-medium">{item.name}</p>
                    {item.description && <p className="text-xs text-muted-foreground">{item.description}</p>}
                    <p className="text-xs text-muted-foreground mt-0.5">{categories.find(c => c.id === item.category_id)?.name || '—'}</p>
                  </div>
                  <div className="flex items-center gap-4">
                    <span className="font-semibold text-primary">€{Number(item.price).toFixed(2)}</span>
                    <div className="flex gap-2">
                      <motion.button whileTap={{ scale: 0.9 }} onClick={() => handleMenuEdit(item)} className="p-2 rounded-lg bg-secondary hover:bg-muted"><Pencil className="w-4 h-4" /></motion.button>
                      <motion.button whileTap={{ scale: 0.9 }} onClick={() => handleMenuDelete(item.id)} className="p-2 rounded-lg bg-secondary hover:bg-destructive/20"><Trash2 className="w-4 h-4 text-destructive" /></motion.button>
                    </div>
                  </div>
                </div>
              ))}
              {searchedItems.length === 0 && <p className="text-center text-muted-foreground py-10">Geen producten gevonden</p>}
            </div>
          ) : (
            /* Gegroepeerd per categorie */
            <div className="space-y-3">
              {/* Producten zonder categorie */}
              {items.filter(i => !i.category_id).length > 0 && (
                <div className="surface overflow-hidden">
                  <div className="px-5 py-3 border-b border-border bg-secondary/50">
                    <span className="font-semibold text-sm text-muted-foreground">Geen categorie</span>
                  </div>
                  {items.filter(i => !i.category_id).map(item => (
                    <div key={item.id} className="flex items-center justify-between px-5 py-3 border-b border-border last:border-0">
                      <div>
                        <p className="font-medium">{item.name}</p>
                        {item.description && <p className="text-xs text-muted-foreground">{item.description}</p>}
                      </div>
                      <div className="flex items-center gap-4">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${item.is_active ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>
                          {item.is_active ? 'Actief' : 'Inactief'}
                        </span>
                        <span className="font-semibold text-primary">€{Number(item.price).toFixed(2)}</span>
                        <div className="flex gap-2">
                          <motion.button whileTap={{ scale: 0.9 }} onClick={() => handleMenuEdit(item)} className="p-2 rounded-lg bg-secondary hover:bg-muted"><Pencil className="w-4 h-4" /></motion.button>
                          <motion.button whileTap={{ scale: 0.9 }} onClick={() => handleMenuDelete(item.id)} className="p-2 rounded-lg bg-secondary hover:bg-destructive/20"><Trash2 className="w-4 h-4 text-destructive" /></motion.button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Per categorie */}
              {categories.map(cat => {
                const catItems = items.filter(i => i.category_id === cat.id);
                const isOpen = expandedCats.has(cat.id);
                return (
                  <div key={cat.id} className="surface overflow-hidden">
                    <button
                      onClick={() => toggleCat(cat.id)}
                      className="w-full flex items-center justify-between px-5 py-3 border-b border-border bg-secondary/50 hover:bg-secondary transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        {isOpen ? <ChevronDown className="w-4 h-4 text-muted-foreground" /> : <ChevronRight className="w-4 h-4 text-muted-foreground" />}
                        <span className="font-semibold">{cat.name}</span>
                        <span className="text-xs text-muted-foreground bg-secondary px-2 py-0.5 rounded-full">{catItems.length}</span>
                      </div>
                      <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${cat.is_active ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>
                        {cat.is_active ? 'Actief' : 'Inactief'}
                      </span>
                    </button>
                    <AnimatePresence>
                      {isOpen && (
                        <motion.div initial={{ height: 0 }} animate={{ height: 'auto' }} exit={{ height: 0 }} className="overflow-hidden">
                          {catItems.length === 0 && (
                            <p className="text-center text-muted-foreground py-6 text-sm">Geen producten in deze categorie</p>
                          )}
                          {catItems.map(item => (
                            <div key={item.id} className="flex items-center justify-between px-5 py-3 border-b border-border last:border-0">
                              <div>
                                <p className="font-medium">{item.name}</p>
                                {item.description && <p className="text-xs text-muted-foreground">{item.description}</p>}
                              </div>
                              <div className="flex items-center gap-4">
                                <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${item.is_active ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>
                                  {item.is_active ? 'Actief' : 'Inactief'}
                                </span>
                                <span className="font-semibold text-primary">€{Number(item.price).toFixed(2)}</span>
                                <div className="flex gap-2">
                                  <motion.button whileTap={{ scale: 0.9 }} onClick={() => handleMenuEdit(item)} className="p-2 rounded-lg bg-secondary hover:bg-muted"><Pencil className="w-4 h-4" /></motion.button>
                                  <motion.button whileTap={{ scale: 0.9 }} onClick={() => handleMenuDelete(item.id)} className="p-2 rounded-lg bg-secondary hover:bg-destructive/20"><Trash2 className="w-4 h-4 text-destructive" /></motion.button>
                                </div>
                              </div>
                            </div>
                          ))}
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* === CATEGORIEËN TAB === */}
      {tab === 'categories' && (
        <div className="space-y-4">
          <AnimatePresence>
            {showCatForm && (
              <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="surface p-5 space-y-4">
                <h3 className="font-semibold">{editCatId ? 'Categorie bewerken' : 'Nieuwe categorie'}</h3>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <input value={catForm.name} onChange={e => setCatForm(f => ({ ...f, name: e.target.value }))} placeholder="Naam"
                    className="px-4 py-3 rounded-lg bg-secondary text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary" />
                  <input type="number" value={catForm.sort_order} onChange={e => setCatForm(f => ({ ...f, sort_order: parseInt(e.target.value) || 0 }))} placeholder="Volgorde"
                    className="px-4 py-3 rounded-lg bg-secondary text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary" />
                  <label className="flex items-center gap-3 cursor-pointer">
                    <input type="checkbox" checked={catForm.is_active} onChange={e => setCatForm(f => ({ ...f, is_active: e.target.checked }))} className="w-5 h-5 rounded accent-primary" />
                    <span className="text-sm">Actief</span>
                  </label>
                </div>
                <div className="flex gap-3">
                  <motion.button whileTap={{ scale: 0.95 }} onClick={handleCatSave} className="px-5 py-2 rounded-lg bg-primary text-primary-foreground font-medium text-sm flex items-center gap-2">
                    <Check className="w-4 h-4" /> Opslaan
                  </motion.button>
                  <motion.button whileTap={{ scale: 0.95 }} onClick={resetCatForm} className="px-5 py-2 rounded-lg bg-secondary text-secondary-foreground font-medium text-sm flex items-center gap-2">
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
                  <th className="text-left px-5 py-3 text-sm text-muted-foreground font-medium">Producten</th>
                  <th className="text-left px-5 py-3 text-sm text-muted-foreground font-medium">Volgorde</th>
                  <th className="text-left px-5 py-3 text-sm text-muted-foreground font-medium">Status</th>
                  <th className="text-right px-5 py-3 text-sm text-muted-foreground font-medium">Acties</th>
                </tr>
              </thead>
              <tbody>
                {categories.map(cat => (
                  <tr key={cat.id} className="border-b border-border last:border-0">
                    <td className="px-5 py-3 font-medium">{cat.name}</td>
                    <td className="px-5 py-3 text-muted-foreground text-sm">{items.filter(i => i.category_id === cat.id).length} producten</td>
                    <td className="px-5 py-3 text-muted-foreground">{cat.sort_order}</td>
                    <td className="px-5 py-3">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${cat.is_active ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>
                        {cat.is_active ? 'Actief' : 'Inactief'}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-right">
                      <div className="flex gap-2 justify-end">
                        <motion.button whileTap={{ scale: 0.9 }} onClick={() => handleCatEdit(cat)} className="p-2 rounded-lg bg-secondary hover:bg-muted"><Pencil className="w-4 h-4" /></motion.button>
                        <motion.button whileTap={{ scale: 0.9 }} onClick={() => handleCatDelete(cat.id)} className="p-2 rounded-lg bg-secondary hover:bg-destructive/20"><Trash2 className="w-4 h-4 text-destructive" /></motion.button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {categories.length === 0 && !loading && (
              <p className="text-center text-muted-foreground py-12">Nog geen categorieën.</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}