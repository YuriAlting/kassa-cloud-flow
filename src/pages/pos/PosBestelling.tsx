import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, Minus, Plus, X, Percent, ArrowLeft } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { usePosStore } from '@/stores/posStore';
import { PosKortingModal } from '@/components/pos/PosKortingModal';
import { PosAfrekenen } from '@/components/pos/PosAfrekenen';

interface Product {
  id: string;
  naam: string;
  prijs: number;
  categorie: string;
}

export default function PosBestelling() {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const store = usePosStore();

  const [producten, setProducten] = useState<Product[]>([]);
  const [categorieen, setCategorieen] = useState<string[]>([]);
  const [activeCategorie, setActiveCategorie] = useState<string>('');
  const [zoek, setZoek] = useState('');
  const [showKorting, setShowKorting] = useState(false);
  const [showAfrekenen, setShowAfrekenen] = useState(false);
  const [noteItemId, setNoteItemId] = useState<string | null>(null);
  const [confirmClear, setConfirmClear] = useState(false);

  useEffect(() => {
    if (!store.restaurantId) {
      navigate(`/pos/${slug}`);
      return;
    }
    loadProducten();
  }, [store.restaurantId]);

  async function loadProducten() {
    const { data } = await supabase
      .from('producten')
      .select('id, naam, prijs, categorie')
      .eq('restaurant_id', store.restaurantId)
      .eq('actief', true)
      .order('volgorde');

    if (data) {
      setProducten(data);
      const cats = [...new Set(data.map(p => p.categorie))];
      setCategorieen(cats);
      if (cats.length > 0) setActiveCategorie(cats[0]);
    }
  }

  const gefilterd = producten.filter(p => {
    const matchCat = !zoek && p.categorie === activeCategorie;
    const matchZoek = zoek && p.naam.toLowerCase().includes(zoek.toLowerCase());
    return matchCat || matchZoek;
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
    return (
      <PosAfrekenen
        slug={slug!}
        onClose={() => setShowAfrekenen(false)}
      />
    );
  }

  return (
    <div className="min-h-screen flex flex-col">
      {/* Header */}
      <header className="flex items-center gap-4 px-6 py-3 border-b border-border">
        <motion.button
          whileTap={{ scale: 0.9 }}
          onClick={() => navigate(`/pos/${slug}/tafels`)}
          className="touch-target flex items-center justify-center rounded-lg bg-secondary"
        >
          <ArrowLeft className="w-5 h-5" />
        </motion.button>
        <div>
          <span className="font-semibold">
            {store.selectedTafelNaam || 'Losse verkoop'}
          </span>
          <span className="text-sm text-muted-foreground ml-3">{store.medewerkerNaam}</span>
        </div>
      </header>

      <div className="flex-1 flex overflow-hidden">
        {/* Left panel — products */}
        <div className="flex-[63] flex flex-col border-r border-border">
          {/* Categories */}
          <div className="flex gap-2 px-4 py-3 overflow-x-auto border-b border-border">
            {categorieen.map(cat => (
              <motion.button
                key={cat}
                whileTap={{ scale: 0.95 }}
                onClick={() => { setActiveCategorie(cat); setZoek(''); }}
                className={`touch-target px-5 py-3 rounded-lg font-medium whitespace-nowrap transition-colors ${
                  activeCategorie === cat && !zoek
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-secondary text-secondary-foreground'
                }`}
              >
                {cat}
              </motion.button>
            ))}
          </div>

          {/* Search */}
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

          {/* Product grid */}
          <div className="flex-1 overflow-y-auto p-4">
            <div className="grid grid-cols-3 lg:grid-cols-4 gap-3">
              {gefilterd.map(product => (
                <motion.button
                  key={product.id}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => store.addItem(product)}
                  className="surface surface-hover p-4 text-left"
                >
                  <p className="font-medium text-sm leading-tight">{product.naam}</p>
                  <p className="text-primary font-semibold mt-1">€{product.prijs.toFixed(2)}</p>
                </motion.button>
              ))}
            </div>
            {gefilterd.length === 0 && (
              <p className="text-center text-muted-foreground py-16">Geen producten gevonden</p>
            )}
          </div>
        </div>

        {/* Right panel — order */}
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
                      onClick={() => store.updateItemQuantity(item.product_id, -1)}
                      className="w-8 h-8 rounded-md bg-secondary flex items-center justify-center"
                    >
                      <Minus className="w-4 h-4" />
                    </motion.button>
                    <span className="font-semibold w-6 text-center">{item.aantal}</span>
                    <motion.button
                      whileTap={{ scale: 0.8 }}
                      onClick={() => store.updateItemQuantity(item.product_id, 1)}
                      className="w-8 h-8 rounded-md bg-secondary flex items-center justify-center"
                    >
                      <Plus className="w-4 h-4" />
                    </motion.button>
                    <span className="flex-1 text-sm font-medium">{item.naam}</span>
                    <span className="font-semibold text-sm">€{(item.prijs * item.aantal).toFixed(2)}</span>
                  </div>
                  {item.notitie && (
                    <p className="text-xs text-muted-foreground mt-1 ml-[88px]">📝 {item.notitie}</p>
                  )}
                  {noteItemId === item.product_id && (
                    <motion.div initial={{ height: 0 }} animate={{ height: 'auto' }} className="mt-2">
                      <input
                        autoFocus
                        type="text"
                        placeholder="Notitie (bijv. geen ui)"
                        defaultValue={item.notitie || ''}
                        onBlur={e => {
                          store.setItemNotitie(item.product_id, e.target.value);
                          setNoteItemId(null);
                        }}
                        onKeyDown={e => {
                          if (e.key === 'Enter') {
                            store.setItemNotitie(item.product_id, (e.target as HTMLInputElement).value);
                            setNoteItemId(null);
                          }
                        }}
                        className="w-full px-3 py-2 rounded bg-secondary text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                      />
                    </motion.div>
                  )}
                  <button
                    onClick={() => setNoteItemId(noteItemId === item.product_id ? null : item.product_id)}
                    className="text-xs text-muted-foreground mt-1 ml-[88px] hover:text-foreground"
                  >
                    {noteItemId === item.product_id ? 'Sluiten' : 'Notitie'}
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

          {/* Footer */}
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

      {showKorting && (
        <PosKortingModal onClose={() => setShowKorting(false)} />
      )}
    </div>
  );
}
