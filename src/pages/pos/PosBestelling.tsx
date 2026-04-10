import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Minus, Plus, Percent, ArrowLeft, Trash2, Search, X, MessageSquare } from 'lucide-react';
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

const CATEGORY_COLORS: Record<string, { base: string; light: string; bg: string }> = {
  'Friet':           { base: '#D45500', light: '#FF8C33', bg: '#FF6B00' },
  'Snacks':          { base: '#C43820', light: '#FF6347', bg: '#E84525' },
  'Burgers':         { base: '#9E1830', light: '#E0334A', bg: '#C41E3A' },
  'Broodjes':        { base: '#8F5A08', light: '#CCA040', bg: '#B8700A' },
  'Turkse Pizza':    { base: '#A8266A', light: '#E8509E', bg: '#D63384' },
  'Kapsalon & Box':  { base: '#5E2170', light: '#A54DC0', bg: '#7B2D8E' },
  'Schotels':        { base: '#3E2E7E', light: '#8060C8', bg: '#5B3F9E' },
  'Menus':           { base: '#1E3FA0', light: '#5580E0', bg: '#2D5BCA' },
  "Pizza's":         { base: '#1E8535', light: '#50D070', bg: '#28A745' },
  'Extras':          { base: '#128090', light: '#40C8D8', bg: '#17A2B8' },
  'Dranken':         { base: '#146E80', light: '#3BB8CE', bg: '#1B8A9E' },
};

const DEFAULT_COLOR = { base: '#444466', light: '#6666AA', bg: '#555580' };

function getCatColor(name: string) {
  return CATEGORY_COLORS[name] || DEFAULT_COLOR;
}

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

  // #5 — Search
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);

  // #6 — Notitie editing
  const [editingNotitie, setEditingNotitie] = useState<string | null>(null);
  const [notitieText, setNotitieText] = useState('');

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

  // #5 — When searching, filter across ALL categories. Otherwise filter by active category.
  const filtered = searchQuery.trim()
    ? menuItems.filter(p => p.name.toLowerCase().includes(searchQuery.toLowerCase()))
    : menuItems.filter(p => p.category_id === activeCategoryId);

  // For search results, find which category each item belongs to (for tile color)
  function getItemColor(item: MenuItem): { base: string; light: string; bg: string } {
    if (!searchQuery.trim()) return activeColor;
    const cat = categories.find(c => c.id === item.category_id);
    return cat ? getCatColor(cat.name) : DEFAULT_COLOR;
  }

  const activeCatName = categories.find(c => c.id === activeCategoryId)?.name || '';
  const activeColor = getCatColor(activeCatName);
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

  // #6 — Start editing a notitie
  const startNotitie = (menuItemId: string, currentNotitie?: string) => {
    setEditingNotitie(menuItemId);
    setNotitieText(currentNotitie || '');
  };

  const saveNotitie = () => {
    if (editingNotitie) {
      store.setItemNotitie(editingNotitie, notitieText.trim());
      setEditingNotitie(null);
      setNotitieText('');
    }
  };

  const now = new Date();
  const timeStr = now.toLocaleTimeString('nl-NL', { hour: '2-digit', minute: '2-digit' });

  if (authLoading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0d0d1a' }}>
        <div style={{ width: 32, height: 32, border: '2px solid #fff', borderTop: '2px solid transparent', borderRadius: '50%' }} />
      </div>
    );
  }

  if (showAfrekenen) {
    return <PosAfrekenen onClose={() => setShowAfrekenen(false)} />;
  }

  return (
    <div style={{
      height: '100vh',
      display: 'flex',
      flexDirection: 'column',
      background: '#0d0d1a',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      color: '#ffffff',
      overflow: 'hidden',
    }}>
      {/* === HEADER === */}
      <header style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '8px 16px',
        background: '#111122',
        borderBottom: '1px solid #1a1a30',
        height: 48,
        flexShrink: 0,
      }}>
        <motion.button
          whileTap={{ scale: 0.9 }}
          onClick={() => navigate(backPath)}
          style={{
            background: 'none', border: 'none', color: '#4d9fff', cursor: 'pointer',
            fontSize: 14, fontWeight: 500, display: 'flex', alignItems: 'center', gap: 4,
          }}
        >
          <ArrowLeft size={16} /> Sluiten
        </motion.button>
        <span style={{ fontWeight: 700, fontSize: 16, letterSpacing: 0.5 }}>AIA Kassa</span>
        <span style={{ fontSize: 13, color: '#aab' }}>{profile?.full_name}</span>
      </header>

      {/* === CATEGORY LABEL + SEARCH BAR === */}
      <div style={{
        padding: '6px 16px 6px 126px',
        background: '#111122',
        borderBottom: '1px solid #1a1a30',
        flexShrink: 0,
        display: 'flex',
        alignItems: 'center',
        gap: 12,
      }}>
        {!isSearching && (
          <span style={{
            fontSize: 14, fontWeight: 600, color: '#fff',
            padding: '4px 12px', background: '#1a1a30', borderRadius: 4,
          }}>
            {activeCatName} ▾
          </span>
        )}

        {/* #5 — Search toggle + input */}
        {isSearching ? (
          <div style={{
            flex: 1, display: 'flex', alignItems: 'center', gap: 8,
            background: '#1a1a30', borderRadius: 6, padding: '4px 10px',
          }}>
            <Search size={16} style={{ color: '#667', flexShrink: 0 }} />
            <input
              autoFocus
              type="text"
              placeholder="Zoek product..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              style={{
                flex: 1, background: 'none', border: 'none', outline: 'none',
                color: '#fff', fontSize: 14, padding: '4px 0',
              }}
            />
            <motion.button
              whileTap={{ scale: 0.85 }}
              onClick={() => { setIsSearching(false); setSearchQuery(''); }}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#889', display: 'flex' }}
            >
              <X size={16} />
            </motion.button>
          </div>
        ) : (
          <motion.button
            whileTap={{ scale: 0.9 }}
            onClick={() => setIsSearching(true)}
            style={{
              background: '#1a1a30', border: 'none', borderRadius: 6,
              padding: '6px 10px', cursor: 'pointer', color: '#667',
              display: 'flex', alignItems: 'center', gap: 6, fontSize: 13,
            }}
          >
            <Search size={14} /> Zoeken
          </motion.button>
        )}
      </div>

      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        {/* === LEFT SIDEBAR === */}
        <div style={{
          width: 110,
          flexShrink: 0,
          overflowY: 'auto',
          background: '#0a0a16',
          padding: '8px 6px',
          display: 'flex',
          flexDirection: 'column',
          gap: 4,
        }}>
          {categories.map(cat => {
            const color = getCatColor(cat.name);
            const isActive = activeCategoryId === cat.id && !searchQuery.trim();
            return (
              <motion.button
                key={cat.id}
                whileTap={{ scale: 0.92 }}
                onClick={() => { setActiveCategoryId(cat.id); setSearchQuery(''); setIsSearching(false); }}
                style={{
                  width: '100%',
                  padding: '14px 6px',
                  borderRadius: 10,
                  border: 'none',
                  cursor: 'pointer',
                  fontWeight: 600,
                  fontSize: 12,
                  textAlign: 'center',
                  color: '#fff',
                  background: isActive
                    ? `linear-gradient(135deg, ${color.light}, ${color.base})`
                    : `linear-gradient(135deg, ${color.base}cc, ${color.base}88)`,
                  boxShadow: isActive
                    ? `0 0 16px ${color.bg}80, 0 2px 8px rgba(0,0,0,0.4)`
                    : '0 1px 4px rgba(0,0,0,0.3)',
                  opacity: isActive ? 1 : 0.7,
                  transition: 'all 0.15s ease',
                  lineHeight: 1.2,
                }}
              >
                {cat.name}
              </motion.button>
            );
          })}
        </div>

        {/* === CENTER — PRODUCT GRID === */}
        <div style={{
          flex: 1,
          overflowY: 'auto',
          padding: 10,
          background: '#12121f',
        }}>
          {/* Search results label */}
          {searchQuery.trim() && (
            <div style={{ marginBottom: 8, fontSize: 13, color: '#889' }}>
              {filtered.length} resultaat{filtered.length !== 1 ? 'en' : ''} voor "{searchQuery}"
            </div>
          )}

          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(5, 1fr)',
            gap: 6,
          }}>
            {filtered.map((item, idx) => {
              const tileColor = getItemColor(item);
              return (
                <motion.button
                  key={item.id}
                  whileTap={{ scale: 0.93 }}
                  whileHover={{ scale: 1.02 }}
                  onClick={() => {
                    const opts = productOptions[item.id];
                    if (opts && opts.length > 0) {
                      setOptionsModal({ item });
                    } else {
                      store.addItem({ id: item.id, name: item.name, price: item.price });
                    }
                  }}
                  style={{
                    position: 'relative',
                    aspectRatio: '1.15 / 1',
                    borderRadius: 8,
                    border: 'none',
                    cursor: 'pointer',
                    padding: '12px 10px',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    textAlign: 'left',
                    color: '#fff',
                    overflow: 'hidden',
                    background: `linear-gradient(145deg, ${tileColor.light}dd, ${tileColor.base})`,
                    boxShadow: `0 2px 8px rgba(0,0,0,0.35), inset 0 1px 0 ${tileColor.light}44, 0 0 20px ${tileColor.bg}18`,
                  }}
                >
                  <div style={{
                    position: 'absolute', top: 0, left: 0, right: 0, height: '45%',
                    background: 'linear-gradient(180deg, rgba(255,255,255,0.12) 0%, rgba(255,255,255,0) 100%)',
                    borderRadius: '8px 8px 0 0', pointerEvents: 'none',
                  }} />

                  <span style={{
                    fontWeight: 700, fontSize: 14, lineHeight: 1.2,
                    position: 'relative', zIndex: 1,
                    textShadow: '0 1px 3px rgba(0,0,0,0.3)',
                  }}>
                    {item.name}
                  </span>

                  <div style={{
                    display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end',
                    position: 'relative', zIndex: 1,
                  }}>
                    <span style={{ fontSize: 11, opacity: 0.7, fontWeight: 500 }}>
                      {item.name.substring(0, 1).toUpperCase()}{idx + 1}
                    </span>
                    <span style={{ fontWeight: 600, fontSize: 14, textShadow: '0 1px 2px rgba(0,0,0,0.3)' }}>
                      {Number(item.price).toFixed(2)}
                    </span>
                  </div>
                </motion.button>
              );
            })}
          </div>

          {filtered.length === 0 && (
            <p style={{ textAlign: 'center', color: '#556', padding: '60px 0', fontSize: 14 }}>
              {searchQuery.trim() ? `Geen resultaten voor "${searchQuery}"` : `Geen producten in ${activeCatName}`}
            </p>
          )}
        </div>

        {/* === RIGHT — ORDER PANEL === */}
        <div style={{
          width: 320,
          flexShrink: 0,
          display: 'flex',
          flexDirection: 'column',
          background: '#111122',
          borderLeft: '1px solid #1a1a30',
        }}>
          <div style={{
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            padding: '12px 16px', borderBottom: '1px solid #1a1a30',
          }}>
            <span style={{ fontWeight: 700, fontSize: 16 }}>
              {store.tableNumber ? `Tafel - ${store.tableNumber}` : 'Bestelling'}
            </span>
            <span style={{ color: '#4d9fff', fontSize: 13, fontWeight: 500, cursor: 'pointer' }}>Acties</span>
          </div>

          {/* Items list */}
          <div style={{ flex: 1, overflowY: 'auto' }}>
            <AnimatePresence>
              {store.orderItems.map(item => (
                <motion.div
                  key={item.id}
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  style={{ padding: '10px 16px', borderBottom: '1px solid #1a1a30' }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                    <div style={{ display: 'flex', gap: 12, alignItems: 'baseline', flex: 1, minWidth: 0 }}>
                      <span style={{ fontSize: 14, color: '#889', flexShrink: 0 }}>{item.quantity}</span>
                      <span style={{ fontSize: 14, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.name_snapshot}</span>
                    </div>
                    <span style={{ fontSize: 14, fontWeight: 600, flexShrink: 0, marginLeft: 8 }}>
                      {(item.unit_price * item.quantity).toFixed(2)}
                    </span>
                  </div>

                  {/* #6 — Notitie display */}
                  {item.notitie && editingNotitie !== item.menu_item_id && (
                    <div
                      onClick={() => startNotitie(item.menu_item_id, item.notitie)}
                      style={{
                        fontSize: 12, color: '#f0a040', fontStyle: 'italic',
                        paddingLeft: 26, marginBottom: 4, cursor: 'pointer',
                      }}
                    >
                      📝 {item.notitie}
                    </div>
                  )}

                  {/* #6 — Notitie inline editor */}
                  {editingNotitie === item.menu_item_id && (
                    <div style={{ paddingLeft: 26, marginBottom: 4, display: 'flex', gap: 4 }}>
                      <input
                        autoFocus
                        type="text"
                        placeholder="bijv. zonder ui, extra saus..."
                        value={notitieText}
                        onChange={e => setNotitieText(e.target.value)}
                        onKeyDown={e => { if (e.key === 'Enter') saveNotitie(); if (e.key === 'Escape') setEditingNotitie(null); }}
                        style={{
                          flex: 1, background: '#1a1a30', border: '1px solid #2a2a40',
                          borderRadius: 4, padding: '4px 8px', color: '#fff',
                          fontSize: 12, outline: 'none',
                        }}
                      />
                      <motion.button
                        whileTap={{ scale: 0.85 }}
                        onClick={saveNotitie}
                        style={{
                          background: '#2a4a2a', border: 'none', borderRadius: 4,
                          padding: '4px 8px', color: '#6d6', fontSize: 11,
                          fontWeight: 600, cursor: 'pointer',
                        }}
                      >
                        OK
                      </motion.button>
                      <motion.button
                        whileTap={{ scale: 0.85 }}
                        onClick={() => setEditingNotitie(null)}
                        style={{
                          background: '#3a2a2a', border: 'none', borderRadius: 4,
                          padding: '4px 8px', color: '#d66', fontSize: 11,
                          fontWeight: 600, cursor: 'pointer',
                        }}
                      >
                        ✕
                      </motion.button>
                    </div>
                  )}

                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, paddingLeft: 26 }}>
                    <motion.button
                      whileTap={{ scale: 0.8 }}
                      onClick={() => store.updateItemQuantity(item.menu_item_id, -1)}
                      style={{
                        width: 28, height: 28, borderRadius: 6,
                        background: '#1a1a30', border: 'none', cursor: 'pointer',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        color: item.quantity === 1 ? '#ff5555' : '#aab',
                      }}
                    >
                      {item.quantity === 1 ? <Trash2 size={13} /> : <Minus size={13} />}
                    </motion.button>
                    <span style={{ fontWeight: 700, fontSize: 13, width: 20, textAlign: 'center' }}>
                      {item.quantity}
                    </span>
                    <motion.button
                      whileTap={{ scale: 0.8 }}
                      onClick={() => store.updateItemQuantity(item.menu_item_id, 1)}
                      style={{
                        width: 28, height: 28, borderRadius: 6,
                        background: '#1a1a30', border: 'none', cursor: 'pointer',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        color: '#aab',
                      }}
                    >
                      <Plus size={13} />
                    </motion.button>

                    {/* #6 — Notitie button */}
                    <motion.button
                      whileTap={{ scale: 0.8 }}
                      onClick={() => startNotitie(item.menu_item_id, item.notitie)}
                      style={{
                        width: 28, height: 28, borderRadius: 6,
                        background: item.notitie ? '#2a2a15' : '#1a1a30',
                        border: 'none', cursor: 'pointer', marginLeft: 'auto',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        color: item.notitie ? '#f0a040' : '#556',
                      }}
                    >
                      <MessageSquare size={13} />
                    </motion.button>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>

            {store.orderItems.length === 0 && (
              <p style={{ textAlign: 'center', color: '#445', padding: '48px 0', fontSize: 13 }}>
                Tik op een product
              </p>
            )}
          </div>

          {/* Korting */}
          {store.korting > 0 && (
            <div style={{ padding: '6px 16px', textAlign: 'right', fontSize: 13, color: activeColor.bg }}>
              {store.kortingType === 'percentage' ? `${store.korting}%` : `€${store.korting.toFixed(2)}`}
              : {(subtotaal - totaal).toFixed(2)} ({totaal.toFixed(2)})
            </div>
          )}

          {/* Footer */}
          <div style={{ borderTop: '1px solid #1a1a30', padding: '10px 16px' }}>
            <div style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 10,
            }}>
              <span style={{ fontSize: 12, color: '#556' }}>
                {now.toLocaleDateString('nl-NL')}, {timeStr}
              </span>
              <span style={{ fontSize: 24, fontWeight: 800 }}>{totaal.toFixed(2)}</span>
            </div>

            {/* Cash / Card / Meer */}
            <div style={{ display: 'flex', gap: 6, marginBottom: 6 }}>
              {['Cash', 'Card', 'Meer'].map(label => (
                <motion.button
                  key={label}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => {
                    if (label === 'Meer') setShowKorting(true);
                    else if (store.orderItems.length > 0) setShowAfrekenen(true);
                  }}
                  disabled={store.orderItems.length === 0}
                  style={{
                    flex: 1, padding: '14px 0', borderRadius: 6,
                    background: '#1a1a30', border: 'none',
                    color: '#fff', fontWeight: 600, fontSize: 15,
                    cursor: store.orderItems.length === 0 ? 'not-allowed' : 'pointer',
                    opacity: store.orderItems.length === 0 ? 0.4 : 1,
                  }}
                >
                  {label}
                </motion.button>
              ))}
            </div>

            {/* Clear */}
            {store.orderItems.length > 0 && (
              <motion.button
                whileTap={{ scale: 0.95 }}
                onClick={handleClear}
                style={{
                  width: '100%', marginTop: 2, padding: '8px 0', borderRadius: 6,
                  background: 'rgba(255,60,60,0.12)', border: 'none',
                  color: '#ff5555', fontWeight: 600, fontSize: 12, cursor: 'pointer',
                }}
              >
                {confirmClear ? 'Bevestig — Leeg bestelling' : 'Bestelling legen'}
              </motion.button>
            )}
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
