import { useState } from 'react';
import { motion } from 'framer-motion';
import { X } from 'lucide-react';
import { usePosStore } from '@/stores/posStore';

interface Props {
  onClose: () => void;
}

export function PosKortingModal({ onClose }: Props) {
  const store = usePosStore();
  const [mode, setMode] = useState<'percentage' | 'vast' | 'voucher'>('percentage');
  const [value, setValue] = useState('');

  const subtotaal = store.getSubtotaal();
  const numValue = parseFloat(value) || 0;

  let nieuwTotaal = subtotaal;
  if (mode === 'percentage') {
    nieuwTotaal = subtotaal * (1 - numValue / 100);
  } else if (mode === 'vast') {
    nieuwTotaal = Math.max(0, subtotaal - numValue);
  }

  const quickPercentages = [5, 10, 15, 20, 25];

  const handleConfirm = () => {
    if (mode === 'percentage' || mode === 'vast') {
      store.setKorting(numValue, mode);
    }
    onClose();
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm"
    >
      <motion.div
        initial={{ scale: 0.95 }}
        animate={{ scale: 1 }}
        className="surface w-full max-w-md p-6 space-y-6"
      >
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold">Korting</h2>
          <button onClick={onClose}><X className="w-5 h-5" /></button>
        </div>

        {/* Mode selector */}
        <div className="grid grid-cols-3 gap-2">
          {(['percentage', 'vast', 'voucher'] as const).map(m => (
            <motion.button
              key={m}
              whileTap={{ scale: 0.95 }}
              onClick={() => { setMode(m); setValue(''); }}
              className={`touch-target py-3 rounded-lg font-medium capitalize ${
                mode === m ? 'bg-primary text-primary-foreground' : 'bg-secondary text-secondary-foreground'
              }`}
            >
              {m === 'percentage' ? 'Percentage' : m === 'vast' ? 'Vast bedrag' : 'Voucher'}
            </motion.button>
          ))}
        </div>

        {mode === 'percentage' && (
          <div className="space-y-4">
            <div className="flex gap-2 flex-wrap">
              {quickPercentages.map(p => (
                <motion.button
                  key={p}
                  whileTap={{ scale: 0.9 }}
                  onClick={() => setValue(String(p))}
                  className={`touch-target px-5 py-3 rounded-lg font-medium ${
                    value === String(p) ? 'bg-primary text-primary-foreground' : 'bg-secondary text-secondary-foreground'
                  }`}
                >
                  {p}%
                </motion.button>
              ))}
            </div>
            <input
              type="number"
              value={value}
              onChange={e => setValue(e.target.value)}
              placeholder="Aangepast %"
              className="w-full px-4 py-3 rounded-lg bg-secondary text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>
        )}

        {mode === 'vast' && (
          <input
            type="number"
            value={value}
            onChange={e => setValue(e.target.value)}
            placeholder="Bedrag in €"
            className="w-full px-4 py-3 rounded-lg bg-secondary text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
          />
        )}

        {mode === 'voucher' && (
          <input
            type="text"
            value={value}
            onChange={e => setValue(e.target.value)}
            placeholder="Voucher code"
            className="w-full px-4 py-3 rounded-lg bg-secondary text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
          />
        )}

        <div className="text-center space-y-1">
          <p className="text-sm text-muted-foreground">Subtotaal: €{subtotaal.toFixed(2)}</p>
          <p className="text-2xl font-bold text-primary">Nieuw totaal: €{nieuwTotaal.toFixed(2)}</p>
        </div>

        <div className="flex gap-3">
          <motion.button
            whileTap={{ scale: 0.95 }}
            onClick={onClose}
            className="flex-1 touch-target py-3 rounded-lg bg-secondary text-secondary-foreground font-medium"
          >
            Annuleren
          </motion.button>
          <motion.button
            whileTap={{ scale: 0.95 }}
            onClick={handleConfirm}
            disabled={!numValue && mode !== 'voucher'}
            className="flex-1 touch-target py-3 rounded-lg bg-primary text-primary-foreground font-bold disabled:opacity-40"
          >
            Bevestigen
          </motion.button>
        </div>
      </motion.div>
    </motion.div>
  );
}
