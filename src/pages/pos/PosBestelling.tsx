import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Minus, Plus, Percent, ArrowLeft, Trash2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { usePosStore } from '@/stores/posStore';
import { useAuth } from '@/contexts/AuthContext';
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
}

interface Category {
  id: string;
  name: string;
}

const CATEGORY_COLORS: Record<string, string> = {
  'Friet': 'bg-amber-600',
  'Snacks': 'bg-orange-600',
  'Burgers': 'bg-red-700',
  'Broodjes': 'bg-yellow-700',
  'Turkse Pizza': 'bg-rose-700',
  'Kapsalon & Box': 'bg-purple-700',
  'Schotels': 'bg-indigo-700',
  'Menus': 'bg-blue-700',
  "Pizza's": 'bg-green-700',
  'Extras': 'bg-teal-700',
  'Dranken': 'bg-cyan-700',
};

export default function PosBestelling() {
  const navigate = useNavigate();
  const store = usePosStore();
  const { user, profile, loading: authLoading } = useAuth();

  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [activeCategoryId, setActiveCategoryId] = useState<string>('');
  const [showKorting, setShowKorting] = useState(false);
  const [showAfrekenen, setShowAfrekenen] = useState(false);
  const [confirmClear, setConfirmClear] = useState(false);
  const [productOptions, setProductOptions] = useState<Record<string, ProductOption[]>>({});
  const [optionsModal, setOptionsModal] = useState<{ item: MenuItem } | null>(null);

  const restaurantId = profile?.restaurant_id;

  useEffect(() => {
    if (authLoading) return;
    if (!user || !restaurantId) {
      navigate('/login');
      return;
    }
    store.setRestaurant(restaurantId, '');
    store.setProfile(profile!.id, profile!.full_name || 'Gebruiker');
    loadData();
  }, [authLoading, user, restaurantId]);

  async function loadData() {
    const [{ data: cats }, { data: items }] = await Promise.all([
      supabase.from('categories').select('id, name').eq('restaurant_id', restaurantId!).eq('is_active', true).order('sort_order'),
      supabase.from('menu_items').select('id, name, price, category_id').eq('restaurant_id', restaurantId!).eq('is_active', true).order('sort_order'),
    ]);

    if (cats) {
      setCategories(cats);
      if (cats.length > 0) setActiveCategoryId(cats[0].id);
    }
    if (items) {
      setMenuItems(items);
      const itemIds = items.map(i => i.id);
      if (itemIds.length > 0) {
        const { data: opts } = await supabase.from('product_options').select('id, menu_item_id, name, price').in('menu_item_id', itemIds);
        if (opts) {
          const grouped: Record<string, ProductOption[]> = {};
          opts.forEach(o => {
            if (!grouped[o.menu_item_id]) grouped[o.menu_item_id] = [];
            grouped[o.menu_item_id].push({ id: o.id, name: o.name, price: o.price, menu_item_id: o.menu_item_id });
          });
          setProductOptions(grouped);
        }
      }
    }
  }

  const filtered = menuItems.filter(p => p.category_id === activeCategoryId);
  const activeCatName = categories.find(c => c.id === activeCategoryId)?.name || '';
  const subtotaal = store.getSubtotaal();
  const totaal = store.getTotaal();

  const backPath = '/restaurant/plattegrond';

  const handleClear = () => {
    if (confirmClear) {
      store.clearOrder();
      setConfirmClear(false);
    } else {
      setConfirmClear(true);
      setTimeout(() => setConfirmClear(false), 3000);
    }
  };

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (showAfrekenen) {
    return <PosAfrekenen onClose={() => setShowAfrekenen(false)} />;
  }

  return (
    <div className="h-[calc(100vh-0px)] flex flex-col bg-background overflow-hidden">
      {/* Header */}
      <header className="flex items-center gap-3 px-4 py-2 border-b border-border shrink-0">
        <motion.button
          whileTap={{ scale: 0.9 }}
          onClick={() => navigate(backPath)}
          className="w-10 h-10 flex items-center justify-center rounded-lg bg-secondary"
        >
          <ArrowLeft className="w-5 h-5 text-foreground" />
        </motion.button>
        <span className="font-semibold text-foreground text-lg">Kassa</span>
        <span className="text-sm text-muted-foreground">{profile?.full_name}</span>
      </header>

      <div className="flex-1 flex overflow-hidden">
        {/* Left — Category sidebar */}
        <div className="w-[140px] shrink-0 overflow-y-auto border-r border-border bg-card flex flex-col gap-1 p-2">
          {categories.map(cat => {
            const colorClass = CATEGORY_COLORS[cat.name] || 'bg-secondary';
            const isActive = activeCategoryId === cat.id;
            return (
              <motion.button
                key={cat.id}
                whileTap={{ scale: 0.95 }}
                onClick={() => setActiveCategoryId(cat.id)}
                className={`w-full py-4 px-2 rounded-lg font-semibold text-sm text-center transition-all ${colorClass} ${
                  isActive ? 'ring-2 ring-foreground scale-[1.02] brightness-125' : 'opacity-75 hover:opacity-90'
                } text-white`}
              >
                {cat.name}
              </motion.button>
            );
          })}
        </div>

        {/* Center — Product grid */}
        <div className="flex-1 overflow-y-auto p-3">
          <div className="grid grid-cols-3 lg:grid-cols-4 gap-2">
            {filtered.map(item => (
              <motion.button
                key={item.id}
                whileTap={{ scale: 0.95 }}
                onClick={() => {
                  const opts = productOptions[item.id];
                  if (opts && opts.length > 0) {
                    setOptionsModal({ item });
                  } else {
                    store.addItem({ id: item.id, name: item.name, price: item.price });
                  }
                }}
                className="bg-card border border-border rounded-xl p-3 flex flex-col justify-between min-h-[90px] hover:bg-secondary transition-colors text-left"
              >
                <span className="font-semibold text-sm text-foreground leading-tight">{item.name}</span>
                <span className="text-primary font-bold text-base mt-1">€{Number(item.price).toFixed(2)}</span>
              </motion.button>
            ))}
          </div>
          {filtered.length === 0 && (
            <p className="text-center text-muted-foreground py-16">Geen producten in {activeCatName}</p>
          )}
        </div>

        {/* Right — Cart */}
        <div className="w-[320px] shrink-0 flex flex-col bg-card border-l border-border">
          <div className="px-4 py-3 border-b border-border">
            <h2 className="font-bold text-foreground">Bestelling</h2>
            <span className="text-xs text-muted-foreground">{store.orderItems.length} items</span>
          </div>

          <div className="flex-1 overflow-y-auto">
            <AnimatePresence>
              {store.orderItems.map(item => (
                <motion.div
                  key={item.id}
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  className="px-3 py-2 border-b border-border"
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-medium text-foreground flex-1 mr-2 leading-tight">{item.name_snapshot}</span>
                    <span className="text-sm font-semibold text-foreground whitespace-nowrap">€{(item.unit_price * item.quantity).toFixed(2)}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <motion.button
                      whileTap={{ scale: 0.8 }}
                      onClick={() => store.updateItemQuantity(item.menu_item_id, -1)}
                      className="w-8 h-8 rounded-md bg-secondary flex items-center justify-center"
                    >
                      {item.quantity === 1 ? <Trash2 className="w-3.5 h-3.5 text-destructive" /> : <Minus className="w-3.5 h-3.5 text-foreground" />}
                    </motion.button>
                    <span className="font-bold text-foreground w-6 text-center text-sm">{item.quantity}</span>
                    <motion.button
                      whileTap={{ scale: 0.8 }}
                      onClick={() => store.updateItemQuantity(item.menu_item_id, 1)}
                      className="w-8 h-8 rounded-md bg-secondary flex items-center justify-center"
                    >
                      <Plus className="w-3.5 h-3.5 text-foreground" />
                    </motion.button>
                    <span className="text-xs text-muted-foreground ml-auto">á €{item.unit_price.toFixed(2)}</span>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>

            {store.orderItems.length === 0 && (
              <p className="text-center text-muted-foreground py-12 text-sm">Tik op een product</p>
            )}
          </div>

          {/* Cart footer */}
          <div className="border-t border-border p-3 space-y-2 shrink-0">
            {store.korting > 0 && (
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">
                  Korting ({store.kortingType === 'percentage' ? `${store.korting}%` : `€${store.korting.toFixed(2)}`})
                </span>
                <span className="text-destructive">-€{(subtotaal - totaal).toFixed(2)}</span>
              </div>
            )}
            <div className="flex justify-between text-xl font-bold">
              <span className="text-foreground">Totaal</span>
              <span className="text-primary">€{totaal.toFixed(2)}</span>
            </div>

            <div className="flex gap-2">
              <motion.button
                whileTap={{ scale: 0.95 }}
                onClick={() => setShowKorting(true)}
                disabled={store.orderItems.length === 0}
                className="flex-1 py-3 rounded-lg bg-secondary text-secondary-foreground font-medium flex items-center justify-center gap-1 disabled:opacity-40 text-sm"
              >
                <Percent className="w-4 h-4" /> Korting
              </motion.button>
              {store.orderItems.length > 0 && (
                <motion.button
                  whileTap={{ scale: 0.95 }}
                  onClick={handleClear}
                  className="py-3 px-4 rounded-lg bg-destructive/20 text-destructive font-medium text-sm"
                >
                  {confirmClear ? 'Bevestig' : 'Leeg'}
                </motion.button>
              )}
            </div>

            <motion.button
              whileTap={{ scale: 0.95 }}
              onClick={() => setShowAfrekenen(true)}
              disabled={store.orderItems.length === 0}
              className="w-full py-4 rounded-lg bg-primary text-primary-foreground font-bold text-lg disabled:opacity-40"
            >
              Afrekenen
            </motion.button>
          </div>
        </div>
      </div>

      {showKorting && <PosKortingModal onClose={() => setShowKorting(false)} />}
      {optionsModal && (
        <PosOptionsModal
          itemName={optionsModal.item.name}
          options={productOptions[optionsModal.item.id] || []}
          onSelect={(opt) => {
            store.addItem({
              id: optionsModal.item.id,
              name: `${optionsModal.item.name} - ${opt.name}`,
              price: opt.price,
            });
            setOptionsModal(null);
          }}
          onClose={() => setOptionsModal(null)}
        />
      )}
    </div>
  );
}
