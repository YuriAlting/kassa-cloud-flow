import { motion } from 'framer-motion';
import { X } from 'lucide-react';

interface ProductOption {
  id: string;
  name: string;
  price: number;
}

interface PosOptionsModalProps {
  itemName: string;
  options: ProductOption[];
  onSelect: (option: ProductOption) => void;
  onClose: () => void;
}

export function PosOptionsModal({ itemName, options, onSelect, onClose }: PosOptionsModalProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={onClose}>
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        onClick={e => e.stopPropagation()}
        className="bg-card border border-border rounded-2xl p-6 w-full max-w-md mx-4 space-y-4"
      >
        <div className="flex items-center justify-between">
          <h3 className="font-bold text-lg">{itemName}</h3>
          <button onClick={onClose} className="p-2 rounded-lg bg-secondary">
            <X className="w-4 h-4" />
          </button>
        </div>
        <p className="text-sm text-muted-foreground">Kies een optie:</p>
        <div className="grid grid-cols-1 gap-2">
          {options.map(opt => (
            <motion.button
              key={opt.id}
              whileTap={{ scale: 0.97 }}
              onClick={() => onSelect(opt)}
              className="flex items-center justify-between px-4 py-3 rounded-xl bg-secondary hover:bg-muted transition-colors"
            >
              <span className="font-medium">{opt.name}</span>
              <span className="font-semibold text-primary">€{Number(opt.price).toFixed(2)}</span>
            </motion.button>
          ))}
        </div>
      </motion.div>
    </div>
  );
}
