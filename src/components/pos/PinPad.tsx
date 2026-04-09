import { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface PinPadProps {
  onSubmit: (pin: string) => void;
  onCancel?: () => void;
  title?: string;
  error?: boolean;
}

export function PinPad({ onSubmit, onCancel, title = 'Voer PIN in', error }: PinPadProps) {
  const [pin, setPin] = useState('');
  const [shaking, setShaking] = useState(false);

  const handleDigit = useCallback((d: string) => {
    setPin(prev => {
      const next = prev + d;
      if (next.length === 4) {
        onSubmit(next);
        return '';
      }
      return next;
    });
  }, [onSubmit]);

  const handleClear = () => setPin('');
  const handleBackspace = () => setPin(prev => prev.slice(0, -1));

  // Trigger shake from parent via error prop
  if (error && !shaking) {
    setShaking(true);
    setTimeout(() => setShaking(false), 400);
    setPin('');
  }

  const digits = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', '⌫'];

  return (
    <div className="flex flex-col items-center gap-6">
      <p className="text-lg font-medium text-muted-foreground">{title}</p>
      
      <motion.div
        className="flex gap-3"
        animate={shaking ? { x: [0, -8, 8, -8, 8, 0] } : {}}
        transition={{ duration: 0.3 }}
      >
        {[0, 1, 2, 3].map(i => (
          <div
            key={i}
            className={`w-4 h-4 rounded-full transition-colors ${
              i < pin.length ? 'bg-primary' : 'bg-muted'
            }`}
          />
        ))}
      </motion.div>

      <div className="grid grid-cols-3 gap-3">
        {digits.map((d, i) => {
          if (d === '') return <div key={i} />;
          if (d === '⌫') {
            return (
              <motion.button
                key={i}
                whileTap={{ scale: 0.9 }}
                onClick={handleBackspace}
                className="touch-target flex items-center justify-center rounded-lg bg-secondary text-secondary-foreground text-xl font-medium"
              >
                ⌫
              </motion.button>
            );
          }
          return (
            <motion.button
              key={i}
              whileTap={{ scale: 0.9 }}
              onClick={() => handleDigit(d)}
              className="touch-target w-[72px] h-[72px] flex items-center justify-center rounded-lg bg-secondary text-foreground text-2xl font-semibold hover:bg-surface-hover transition-colors"
            >
              {d}
            </motion.button>
          );
        })}
      </div>

      {onCancel && (
        <button onClick={onCancel} className="text-muted-foreground text-sm mt-2">
          Annuleren
        </button>
      )}
    </div>
  );
}
