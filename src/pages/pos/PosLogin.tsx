import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '@/lib/supabase';
import { usePosStore } from '@/stores/posStore';
import { PinPad } from '@/components/pos/PinPad';

interface Medewerker {
  id: string;
  naam: string;
  rol: string;
}

export default function PosLogin() {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const { setRestaurant, setMedewerker } = usePosStore();

  const [restaurant, setRestaurantData] = useState<{ id: string; naam: string } | null>(null);
  const [medewerkers, setMedewerkers] = useState<Medewerker[]>([]);
  const [selectedMedewerker, setSelectedMedewerker] = useState<Medewerker | null>(null);
  const [pinError, setPinError] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const { data: rest } = await supabase
        .from('restaurants')
        .select('id, naam')
        .eq('slug', slug)
        .eq('actief', true)
        .single();

      if (!rest) {
        navigate('/');
        return;
      }

      setRestaurantData(rest);
      setRestaurant(rest.id, rest.naam);

      const { data: mw } = await supabase
        .from('medewerkers')
        .select('id, naam, rol')
        .eq('restaurant_id', rest.id)
        .eq('actief', true)
        .order('naam');

      setMedewerkers(mw || []);
      setLoading(false);
    }
    load();
  }, [slug]);

  const handlePinSubmit = async (pin: string) => {
    if (!selectedMedewerker) return;

    const { data } = await supabase
      .from('medewerkers')
      .select('id, naam, rol')
      .eq('id', selectedMedewerker.id)
      .eq('pincode', pin)
      .single();

    if (data) {
      setMedewerker(data.id, data.naam);

      // Log shift
      await supabase.from('shifts').insert({
        medewerker_id: data.id,
        restaurant_id: restaurant!.id,
      });

      if (data.rol === 'manager' || data.rol === 'eigenaar') {
        navigate(`/pos/${slug}/dashboard`);
      } else {
        navigate(`/pos/${slug}/tafels`);
      }
    } else {
      setPinError(true);
      setTimeout(() => setPinError(false), 500);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md flex flex-col items-center gap-8"
      >
        <div className="text-center">
          <h1 className="text-3xl font-bold text-primary">{restaurant?.naam}</h1>
          <p className="text-muted-foreground mt-1">KassaCloud POS</p>
        </div>

        <AnimatePresence mode="wait">
          {!selectedMedewerker ? (
            <motion.div
              key="staff-list"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="w-full space-y-3"
            >
              <p className="text-center text-muted-foreground mb-4">Selecteer medewerker</p>
              {medewerkers.map(mw => (
                <motion.button
                  key={mw.id}
                  whileTap={{ scale: 0.97 }}
                  onClick={() => setSelectedMedewerker(mw)}
                  className="w-full touch-target surface surface-hover flex items-center px-5 py-4 text-lg font-medium"
                >
                  <span className="w-10 h-10 rounded-full bg-primary/20 text-primary flex items-center justify-center font-bold mr-4">
                    {mw.naam.charAt(0)}
                  </span>
                  {mw.naam}
                  <span className="ml-auto text-sm text-muted-foreground capitalize">{mw.rol}</span>
                </motion.button>
              ))}
              {medewerkers.length === 0 && (
                <p className="text-center text-muted-foreground py-8">
                  Geen medewerkers gevonden. Voeg medewerkers toe via het admin panel.
                </p>
              )}
            </motion.div>
          ) : (
            <motion.div
              key="pin-entry"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex flex-col items-center"
            >
              <p className="text-lg font-medium mb-2">{selectedMedewerker.naam}</p>
              <PinPad
                onSubmit={handlePinSubmit}
                onCancel={() => setSelectedMedewerker(null)}
                error={pinError}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  );
}
