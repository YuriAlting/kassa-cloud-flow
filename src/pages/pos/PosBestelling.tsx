import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, Minus, Plus, X, Percent, ArrowLeft } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { usePosStore } from '@/stores/posStore';
import { PosKortingModal } from '@/components/pos/PosKortingModal';
import { PosAfrekenen } from '@/components/pos/PosAfrekenen';
import { PosOptionsModal } from '@/components/pos/PosOptionsModal';

interface ProductOption {
  id: string;
  name: string;
  price: number;
  menu_item_id: string;
}

interface MenuItem {
  id: string;
  name: string;
  price: number;
  category_id: string;
  category_name?: string;
}

interface Category {
  id: string;
  name: string;
}

export default function PosBestelling() {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const store = usePosStore();

  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [activeCategoryId, setActiveCategoryId] = useState<string>('');
  const [zoek, setZoek] = useState('');
  const [showKorting, setShowKorting] = useState(false);
  const [showAfrekenen, setShowAfrekenen] = useState(false);
  const [noteItemId, setNoteItemId] = useState<string | null>(null);
  const [confirmClear, setConfirmClear] = useState(false);
  const [productOptions, setProductOptions] = useState<Record<string, ProductOption[]>>({});
  const [optionsModal, setOptionsModal] = useState<{ item: MenuItem } | null>(null);

  useEffect(() => {
    if (!store.restaurantId) {
      navigate(`/pos/${slug}`);
      return;
    }
    loadData();
  }, [store.restaurantId]);

  async function loadData() {
    const [{ data: cats }, { data: items }] = await Promise.all([
      supabase
        .from('categories')
        .select('id, name')
        .eq('restaurant_id', store.restaurantId!)
        .eq('is_active', true)
        .order('sort_order'),
      supabase
        .from('menu_items')
        .select('id, name, price, category_id')
        .eq('restaurant_id', store.restaurantId!)
        .eq('is_active', true)
        .order('sort_order'),
    ]);

    if (cats) {
      setCategories(cats);
      if (cats.length > 0) setActiveCategoryId(cats[0].id);
    }
    if (items) setMenuItems(items);
  }

  const filtered = menuItems.filter(p => {
    if (zoek) return p.name.toLowerCase().includes(zoek.toLowerCase());
    return p.category_id === activeCategoryId;
  });

  const subtotaal = store.getSubtotaal();
  const totaal = store.getTotaal();

  const handleClear = () => {
    if (confirmClear) {
      store.clearOrder();
      setConfirmClear(false);
    } else {
      setConfirmClear(true);
      setTimeout(() => setConfirmClear(false), 3000);
    }
  };

  if (showAfrekenen) {
    return <PosAfrekenen slug={slug!} onClose={() => setShowAfrekenen(false)} />;
  }

  return (
    <div className="min-h-screen flex flex-col">
      <header className="flex items-center gap-4 px-6 py-3 border-b border-border">
        <motion.button
          whileTap={{ scale: 0.9 }}
          onClick={() => navigate(`/pos/${slug}/dashboard`)}
          className="touch-target flex items-center justify-center rounded-lg bg-secondary"
        >
          <ArrowLeft className="w-5 h-5" />
        </motion.button>
        <div>
          <span className="font-semibold">Bestelling</span>
          <span className="text-sm text-muted-foreground ml-3">{store.profileName}</span>
        </div>
      </header>

      <div className="flex-1 flex overflow-hidden">
        {/* Left — products */}
        <div className="flex-[63] flex flex-col border-r border-border">
          <div className="flex gap-2 px-4 py-3 overflow-x-auto border-b border-border">
            {categories.map(cat => (
              <motion.button
                key={cat.id}
                whileTap={{ scale: 0.95 }}
                onClick={() => { setActiveCategoryId(cat.id); setZoek(''); }}
                className={`touch-target px-5 py-3 rounded-lg font-medium whitespace-nowrap transition-colors ${
                  activeCategoryId === cat.id && !zoek
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-secondary text-secondary-foreground'
                }`}
              >
                {cat.name}
              </motion.button>
            ))}
          </div>

          <div className="px-4 py-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input
                type="text"
                value={zoek}
                onChange={e => setZoek(e.target.value)}
                placeholder="Zoek product..."
                className="w-full pl-10 pr-4 py-3 rounded-lg bg-secondary text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-4">
            <div className="grid grid-cols-3 lg:grid-cols-4 gap-3">
              {filtered.map(item => (
                <motion.button
                  key={item.id}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => store.addItem({ id: item.id, name: item.name, price: item.price })}
                  className="surface surface-hover p-4 text-left"
                >
                  <p className="font-medium text-sm leading-tight">{item.name}</p>
                  <p className="text-primary font-semibold mt-1">€{Number(item.price).toFixed(2)}</p>
                </motion.button>
              ))}
            </div>
            {filtered.length === 0 && (
              <p className="text-center text-muted-foreground py-16">Geen producten gevonden</p>
            )}
          </div>
        </div>

        {/* Right — order */}
        <div className="flex-[37] flex flex-col bg-card">
          <div className="px-4 py-3 border-b border-border">
            <h2 className="font-semibold">Bestelling</h2>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-2">
            <AnimatePresence>
              {store.orderItems.map(item => (
                <motion.div
                  key={item.id}
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  className="surface p-3"
                >
                  <div className="flex items-center gap-3">
                    <motion.button
                      whileTap={{ scale: 0.8 }}
                      onClick={() => store.updateItemQuantity(item.menu_item_id, -1)}
                      className="w-8 h-8 rounded-md bg-secondary flex items-center justify-center"
                    >
                      <Minus className="w-4 h-4" />
                    </motion.button>
                    <span className="font-semibold w-6 text-center">{item.quantity}</span>
                    <motion.button
                      whileTap={{ scale: 0.8 }}
                      onClick={() => store.updateItemQuantity(item.menu_item_id, 1)}
                      className="w-8 h-8 rounded-md bg-secondary flex items-center justify-center"
                    >
                      <Plus className="w-4 h-4" />
                    </motion.button>
                    <span className="flex-1 text-sm font-medium">{item.name_snapshot}</span>
                    <span className="font-semibold text-sm">€{(item.unit_price * item.quantity).toFixed(2)}</span>
                  </div>
                  {item.notitie && (
                    <p className="text-xs text-muted-foreground mt-1 ml-[88px]">📝 {item.notitie}</p>
                  )}
                  {noteItemId === item.menu_item_id && (
                    <motion.div initial={{ height: 0 }} animate={{ height: 'auto' }} className="mt-2">
                      <input
                        autoFocus
                        type="text"
                        placeholder="Notitie (bijv. geen ui)"
                        defaultValue={item.notitie || ''}
                        onBlur={e => {
                          store.setItemNotitie(item.menu_item_id, e.target.value);
                          setNoteItemId(null);
                        }}
                        onKeyDown={e => {
                          if (e.key === 'Enter') {
                            store.setItemNotitie(item.menu_item_id, (e.target as HTMLInputElement).value);
                            setNoteItemId(null);
                          }
                        }}
                        className="w-full px-3 py-2 rounded bg-secondary text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                      />
                    </motion.div>
                  )}
                  <button
                    onClick={() => setNoteItemId(noteItemId === item.menu_item_id ? null : item.menu_item_id)}
                    className="text-xs text-muted-foreground mt-1 ml-[88px] hover:text-foreground"
                  >
                    {noteItemId === item.menu_item_id ? 'Sluiten' : 'Notitie'}
                  </button>
                </motion.div>
              ))}
            </AnimatePresence>

            {store.orderItems.length === 0 && (
              <p className="text-center text-muted-foreground py-16 text-sm">
                Tik op een product om toe te voegen
              </p>
            )}
          </div>

          <div className="border-t border-border p-4 space-y-3">
            {store.korting > 0 && (
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">
                  Korting ({store.kortingType === 'percentage' ? `${store.korting}%` : `€${store.korting.toFixed(2)}`})
                </span>
                <span className="text-destructive">-€{(subtotaal - totaal).toFixed(2)}</span>
              </div>
            )}
            <div className="flex justify-between text-lg font-bold">
              <span>Totaal</span>
              <span className="text-primary">€{totaal.toFixed(2)}</span>
            </div>

            <div className="flex gap-2">
              <motion.button
                whileTap={{ scale: 0.95 }}
                onClick={() => setShowKorting(true)}
                disabled={store.orderItems.length === 0}
                className="touch-target flex-1 py-3 rounded-lg bg-secondary text-secondary-foreground font-medium flex items-center justify-center gap-2 disabled:opacity-40"
              >
                <Percent className="w-4 h-4" />
                Korting
              </motion.button>
            </div>

            <motion.button
              whileTap={{ scale: 0.95 }}
              onClick={() => setShowAfrekenen(true)}
              disabled={store.orderItems.length === 0}
              className="touch-target w-full py-4 rounded-lg bg-primary text-primary-foreground font-bold text-lg disabled:opacity-40"
            >
              Afrekenen
            </motion.button>

            {store.orderItems.length > 0 && (
              <button
                onClick={handleClear}
                className="w-full text-center text-sm text-muted-foreground hover:text-destructive"
              >
                {confirmClear ? 'Bevestig leegmaken' : 'Leegmaken'}
              </button>
            )}
          </div>
        </div>
      </div>

      {showKorting && <PosKortingModal onClose={() => setShowKorting(false)} />}
    </div>
  );
}
