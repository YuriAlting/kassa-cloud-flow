import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Check, ArrowLeft } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { usePosStore } from '@/stores/posStore';

interface Props {
  onClose: () => void;
}

export function PosAfrekenen({ onClose }: Props) {
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

    const { data: order } = await supabase.from('orders').insert({
      restaurant_id: store.restaurantId,
      created_by: store.profileId,
      total_amount: totaal,
      source: 'pos',
      status: 'completed',
    }).select('id').single();

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
      navigate('/pos/dashboard');
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
      <div className="surface w-full max-w-md p-6 space-y-6">
        <div className="flex items-center gap-3">
          <motion.button whileTap={{ scale: 0.9 }} onClick={onClose} className="w-10 h-10 flex items-center justify-center rounded-lg bg-secondary">
            <ArrowLeft className="w-5 h-5 text-foreground" />
          </motion.button>
          <h2 className="text-xl font-bold">Afrekenen</h2>
        </div>

        <div className="text-center">
          <p className="text-muted-foreground text-sm">Totaal</p>
          <p className="text-4xl font-bold text-primary">€{totaal.toFixed(2)}</p>
        </div>

        <div className="space-y-2">
          <p className="text-sm font-medium text-muted-foreground">Betaalwijze</p>
          <div className="grid grid-cols-3 gap-2">
            {['contant', 'pin', 'ideal'].map(m => (
              <motion.button
                key={m}
                whileTap={{ scale: 0.95 }}
                onClick={() => setBetaalwijze(m)}
                className={`py-3 rounded-lg font-medium text-sm capitalize ${
                  betaalwijze === m ? 'bg-primary text-primary-foreground' : 'bg-secondary text-secondary-foreground'
                }`}
              >
                {m}
              </motion.button>
            ))}
          </div>
        </div>

        <AnimatePresence>
          {betaalwijze === 'contant' && (
            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="space-y-2">
              <p className="text-sm font-medium text-muted-foreground">Gegeven bedrag</p>
              <input
                type="number"
                step="0.01"
                value={gegeven}
                onChange={e => setGegeven(e.target.value)}
                placeholder="0.00"
                className="w-full px-4 py-3 rounded-lg bg-secondary text-foreground text-lg font-bold text-center focus:outline-none focus:ring-2 focus:ring-primary"
              />
              {gegevenNum >= totaal && (
                <p className="text-center text-lg font-bold text-primary">Wisselgeld: €{wisselgeld.toFixed(2)}</p>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        <motion.button
          whileTap={{ scale: 0.95 }}
          onClick={handleConfirm}
          disabled={!betaalwijze || saving || (betaalwijze === 'contant' && gegevenNum < totaal)}
          className="w-full py-4 rounded-lg bg-primary text-primary-foreground font-bold text-lg disabled:opacity-40"
        >
          {saving ? 'Verwerken...' : 'Bevestig betaling'}
        </motion.button>
      </div>
    </div>
  );
}
