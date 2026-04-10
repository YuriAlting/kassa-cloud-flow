import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Check, ArrowLeft, MapPin, Clock, Package } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { usePosStore } from '@/stores/posStore';
import { useAuth } from '@/contexts/AuthContext';

interface TableItem {
  id: string;
  table_number: string;
  seats: number;
  shape: string;
  position_x: number;
  position_y: number;
  status: string;
  is_takeaway: boolean;
  floor_section_id: string | null;
}

interface FloorSection {
  id: string;
  name: string;
  sort_order: number;
}

interface Props {
  onClose: () => void;
}

const STATUS_COLORS: Record<string, { bg: string; border: string }> = {
  vrij: { bg: 'hsl(142 76% 36%)', border: 'hsl(142 76% 46%)' },
  bezet: { bg: 'hsl(0 72% 51%)', border: 'hsl(0 72% 61%)' },
  geleverd: { bg: 'hsl(142 76% 25%)', border: 'hsl(142 76% 35%)' },
  rekening: { bg: 'hsl(38 92% 50%)', border: 'hsl(38 92% 60%)' },
};

export function PosAfrekenen({ onClose }: Props) {
  const navigate = useNavigate();
  const store = usePosStore();
  const { profile } = useAuth();
  const totaal = store.getTotaal();

  // Step: 'choice' | 'payment_takeaway' | 'select_table' | 'saving' | 'done'
  const [step, setStep] = useState<string>('choice');
  const [betaalwijze, setBetaalwijze] = useState<string | null>(null);
  const [gegeven, setGegeven] = useState('');
  const [saving, setSaving] = useState(false);

  // Floor plan state for 'hier opeten'
  const [sections, setSections] = useState<FloorSection[]>([]);
  const [tables, setTables] = useState<TableItem[]>([]);
  const [activeSection, setActiveSection] = useState<string | null>(null);

  const gegevenNum = parseFloat(gegeven) || 0;
  const wisselgeld = gegevenNum - totaal;

  const restaurantId = profile?.restaurant_id || store.restaurantId;

  const loadFloorPlan = useCallback(async () => {
    if (!restaurantId) return;
    const [secRes, tabRes] = await Promise.all([
      supabase.from('floor_sections').select('*').eq('restaurant_id', restaurantId).order('sort_order'),
      supabase.from('tables').select('*').eq('restaurant_id', restaurantId),
    ]);
    const secs = (secRes.data || []) as FloorSection[];
    setSections(secs);
    setTables((tabRes.data || []) as TableItem[]);
    if (secs.length > 0) setActiveSection(secs[0].id);
  }, [restaurantId]);

  useEffect(() => {
    if (step === 'select_table') loadFloorPlan();
  }, [step, loadFloorPlan]);

  const saveOrder = async (tableId: string | null, orderType: 'dine_in' | 'takeaway') => {
    setSaving(true);
    setStep('saving');

    const orderPayload: Record<string, unknown> = {
      restaurant_id: restaurantId,
      created_by: store.profileId || profile?.id,
      total_amount: totaal,
      source: 'pos',
      status: 'pending',
    };

    if (orderType === 'dine_in' && tableId) {
      orderPayload.table_id = tableId;
    }

    const { data: order } = await supabase.from('orders').insert(orderPayload as any).select('id').single();

    if (order) {
      const orderItems = store.orderItems.map(i => ({
        order_id: order.id,
        menu_item_id: i.menu_item_id,
        name_snapshot: i.name_snapshot,
        unit_price: i.unit_price,
        quantity: i.quantity,
      }));
      await supabase.from('order_items').insert(orderItems);

      if (orderType === 'dine_in' && tableId) {
        await supabase.from('tables').update({ status: 'bezet' }).eq('id', tableId);
      }
    }

    setStep('done');
    setTimeout(() => {
      store.clearOrder();
      navigate('/restaurant/plattegrond');
    }, 1500);
  };

  const handleTakeawayConfirm = () => {
    if (!betaalwijze) return;
    if (betaalwijze === 'contant' && gegevenNum < totaal) return;
    saveOrder(null, 'takeaway');
  };

  const handleTableSelect = (table: TableItem) => {
    if (table.status !== 'vrij' || table.is_takeaway) return;
    saveOrder(table.id, 'dine_in');
  };

  // Done screen
  if (step === 'done' || step === 'saving') {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} className="flex flex-col items-center gap-4">
          <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring', stiffness: 200 }}
            className="w-24 h-24 rounded-full bg-primary/20 flex items-center justify-center">
            <Check className="w-12 h-12 text-primary" />
          </motion.div>
          <p className="text-xl font-bold text-foreground">Betaling voltooid!</p>
          <p className="text-sm text-muted-foreground">Bestelling naar keuken verzonden</p>
        </motion.div>
      </div>
    );
  }

  // Step: choice (Meenemen / Hier opeten)
  if (step === 'choice') {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-6">
        <div className="bg-card border border-border rounded-2xl w-full max-w-sm p-6 space-y-6 shadow-2xl">
          <div className="flex items-center gap-3">
            <motion.button whileTap={{ scale: 0.9 }} onClick={onClose} className="w-10 h-10 flex items-center justify-center rounded-lg bg-secondary">
              <ArrowLeft className="w-5 h-5 text-foreground" />
            </motion.button>
            <h2 className="text-xl font-bold text-foreground">Afrekenen</h2>
          </div>

          <div className="text-center">
            <p className="text-muted-foreground text-sm">Totaal</p>
            <p className="text-4xl font-bold text-primary">€{totaal.toFixed(2)}</p>
          </div>

          <p className="text-sm text-muted-foreground text-center">Wat wil de klant?</p>

          <div className="space-y-3">
            <motion.button whileTap={{ scale: 0.95 }} onClick={() => setStep('payment_takeaway')}
              className="w-full py-4 rounded-xl bg-secondary text-foreground font-bold text-lg flex items-center justify-center gap-3">
              <Package className="w-5 h-5" /> Meenemen
            </motion.button>
            <motion.button whileTap={{ scale: 0.95 }} onClick={() => setStep('select_table')}
              className="w-full py-4 rounded-xl bg-primary text-primary-foreground font-bold text-lg flex items-center justify-center gap-3">
              <MapPin className="w-5 h-5" /> Hier opeten
            </motion.button>
          </div>
        </div>
      </div>
    );
  }

  // Step: payment for takeaway (Pin / Cash)
  if (step === 'payment_takeaway') {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-6">
        <div className="bg-card border border-border rounded-2xl w-full max-w-md p-6 space-y-6 shadow-2xl">
          <div className="flex items-center gap-3">
            <motion.button whileTap={{ scale: 0.9 }} onClick={() => setStep('choice')} className="w-10 h-10 flex items-center justify-center rounded-lg bg-secondary">
              <ArrowLeft className="w-5 h-5 text-foreground" />
            </motion.button>
            <h2 className="text-xl font-bold text-foreground">Meenemen</h2>
          </div>

          <div className="text-center">
            <p className="text-muted-foreground text-sm">Totaal</p>
            <p className="text-4xl font-bold text-primary">€{totaal.toFixed(2)}</p>
          </div>

          <div className="space-y-2">
            <p className="text-sm font-medium text-muted-foreground">Betaalwijze</p>
            <div className="grid grid-cols-2 gap-2">
              {['contant', 'pin'].map(m => (
                <motion.button key={m} whileTap={{ scale: 0.95 }} onClick={() => setBetaalwijze(m)}
                  className={`py-3 rounded-lg font-medium text-sm capitalize ${
                    betaalwijze === m ? 'bg-primary text-primary-foreground' : 'bg-secondary text-secondary-foreground'
                  }`}>
                  {m === 'contant' ? '💵 Contant' : '💳 PIN'}
                </motion.button>
              ))}
            </div>
          </div>

          <AnimatePresence>
            {betaalwijze === 'contant' && (
              <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="space-y-2">
                <p className="text-sm font-medium text-muted-foreground">Gegeven bedrag</p>
                <input type="number" step="0.01" value={gegeven} onChange={e => setGegeven(e.target.value)} placeholder="0.00"
                  className="w-full px-4 py-3 rounded-lg bg-secondary text-foreground text-lg font-bold text-center focus:outline-none focus:ring-2 focus:ring-primary" />
                {gegevenNum >= totaal && (
                  <p className="text-center text-lg font-bold text-primary">Wisselgeld: €{wisselgeld.toFixed(2)}</p>
                )}
              </motion.div>
            )}
          </AnimatePresence>

          <motion.button whileTap={{ scale: 0.95 }} onClick={handleTakeawayConfirm}
            disabled={!betaalwijze || saving || (betaalwijze === 'contant' && gegevenNum < totaal)}
            className="w-full py-4 rounded-lg bg-primary text-primary-foreground font-bold text-lg disabled:opacity-40">
            Bevestig betaling
          </motion.button>
        </div>
      </div>
    );
  }

  // Step: select table for 'hier opeten'
  if (step === 'select_table') {
    const sectionTables = tables.filter(t => !t.is_takeaway && t.floor_section_id === activeSection && t.status === 'vrij');
    return (
      <div className="min-h-screen flex flex-col p-6">
        <div className="flex items-center gap-3 mb-6">
          <motion.button whileTap={{ scale: 0.9 }} onClick={() => setStep('choice')} className="w-10 h-10 flex items-center justify-center rounded-lg bg-secondary">
            <ArrowLeft className="w-5 h-5 text-foreground" />
          </motion.button>
          <h2 className="text-xl font-bold text-foreground">Kies een tafel</h2>
          <p className="text-sm text-muted-foreground">€{totaal.toFixed(2)}</p>
        </div>

        {/* Section tabs */}
        <div className="flex gap-2 mb-4">
          {sections.map(sec => (
            <motion.button key={sec.id} whileTap={{ scale: 0.95 }} onClick={() => setActiveSection(sec.id)}
              className={`px-5 py-2.5 rounded-lg text-sm font-bold transition-colors ${
                activeSection === sec.id ? 'bg-primary text-primary-foreground' : 'bg-secondary text-muted-foreground hover:text-foreground'
              }`}>
              {sec.name}
            </motion.button>
          ))}
        </div>

        {/* Free tables grid */}
        <div className="flex-1 grid grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
          {sectionTables.map(table => {
            const colors = STATUS_COLORS[table.status] || STATUS_COLORS.vrij;
            return (
              <motion.button key={table.id} whileTap={{ scale: 0.9 }} onClick={() => handleTableSelect(table)}
                className="aspect-square rounded-xl flex flex-col items-center justify-center text-white font-bold text-lg border-2 cursor-pointer"
                style={{ backgroundColor: colors.bg, borderColor: colors.border }}>
                {table.table_number}
                <span className="text-xs font-normal mt-1 opacity-80">{table.seats} stoelen</span>
              </motion.button>
            );
          })}
          {sectionTables.length === 0 && (
            <p className="col-span-full text-center text-muted-foreground py-16">Geen vrije tafels in deze sectie</p>
          )}
        </div>
      </div>
    );
  }

  return null;
}
