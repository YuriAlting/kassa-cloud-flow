import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Check, ArrowLeft } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { usePosStore } from '@/stores/posStore';

interface Props {
  slug: string;
  onClose: () => void;
}

export function PosAfrekenen({ slug, onClose }: Props) {
  const navigate = useNavigate();
  const store = usePosStore();
  const totaal = store.getTotaal();

  const [betaalwijze, setBetaalwijze] = useState<string | null>(null);
  const [gegeven, setGegeven] = useState('');
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);

  const gegevenNum = parseFloat(gegeven) || 0;
  const wisselgeld = gegevenNum - totaal;

  const handleConfirm = async () => {
    if (!betaalwijze) return;
    if (betaalwijze === 'contant' && gegevenNum < totaal) return;

    setSaving(true);

    // Create order
    const { data: order } = await supabase.from('orders').insert({
      restaurant_id: store.restaurantId,
      created_by: store.profileId,
      total_amount: totaal,
      source: 'pos',
      status: 'completed',
    }).select('id').single();

    // Create order items
    if (order) {
      const orderItems = store.orderItems.map(i => ({
        order_id: order.id,
        menu_item_id: i.menu_item_id,
        name_snapshot: i.name_snapshot,
        unit_price: i.unit_price,
        quantity: i.quantity,
      }));

      await supabase.from('order_items').insert(orderItems);
    }

    setDone(true);
    setTimeout(() => {
      store.clearOrder();
      navigate(`/pos/${slug}/dashboard`);
    }, 1500);
  };

  if (done) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} className="flex flex-col items-center gap-4">
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: 'spring', stiffness: 200 }}
            className="w-24 h-24 rounded-full bg-success flex items-center justify-center"
          >
            <Check className="w-12 h-12 text-success-foreground" />
          </motion.div>
          <p className="text-xl font-bold">Betaling voltooid!</p>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-md space-y-8">
        <div className="flex items-center gap-4">
          <motion.button whileTap={{ scale: 0.9 }} onClick={onClose} className="w-10 h-10 rounded-lg bg-secondary flex items-center justify-center">
            <ArrowLeft className="w-5 h-5" />
          </motion.button>
          <h1 className="text-xl font-bold">Afrekenen</h1>
        </div>

        <div className="text-center">
          <p className="text-muted-foreground text-sm">Te betalen</p>
          <p className="text-5xl font-bold text-primary">€{totaal.toFixed(2)}</p>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <motion.button
            whileTap={{ scale: 0.95 }}
            onClick={() => setBetaalwijze('pin')}
            className={`touch-target p-6 rounded-lg font-bold text-lg ${
              betaalwijze === 'pin' ? 'bg-primary text-primary-foreground' : 'bg-secondary text-secondary-foreground'
            }`}
          >
            💳 PIN
          </motion.button>
          <motion.button
            whileTap={{ scale: 0.95 }}
            onClick={() => setBetaalwijze('contant')}
            className={`touch-target p-6 rounded-lg font-bold text-lg ${
              betaalwijze === 'contant' ? 'bg-primary text-primary-foreground' : 'bg-secondary text-secondary-foreground'
            }`}
          >
            💵 Contant
          </motion.button>
        </div>

        <AnimatePresence>
          {betaalwijze === 'contant' && (
            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="space-y-4">
              <input
                type="number"
                value={gegeven}
                onChange={e => setGegeven(e.target.value)}
                placeholder="Gegeven bedrag"
                autoFocus
                className="w-full px-4 py-4 rounded-lg bg-secondary text-foreground text-xl text-center font-semibold focus:outline-none focus:ring-2 focus:ring-primary"
              />
              {gegevenNum > 0 && (
                <div className="text-center">
                  <p className="text-sm text-muted-foreground">Wisselgeld</p>
                  <p className={`text-3xl font-bold ${wisselgeld >= 0 ? 'text-success' : 'text-destructive'}`}>
                    €{wisselgeld.toFixed(2)}
                  </p>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        <motion.button
          whileTap={{ scale: 0.95 }}
          onClick={handleConfirm}
          disabled={!betaalwijze || saving || (betaalwijze === 'contant' && gegevenNum < totaal)}
          className="touch-target w-full py-4 rounded-lg bg-primary text-primary-foreground font-bold text-lg disabled:opacity-40"
        >
          {saving ? 'Verwerken...' : 'Bevestig betaling'}
        </motion.button>
      </motion.div>
    </div>
  );
}
