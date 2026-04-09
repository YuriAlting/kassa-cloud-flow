import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { supabase } from '@/lib/supabase';
import { usePosStore } from '@/stores/posStore';

interface Tafel {
  id: string;
  naam: string;
  zone: string;
  status: string;
  capaciteit: number;
}

const statusColors: Record<string, string> = {
  vrij: 'border-status-vrij',
  bezet: 'border-status-bezet',
  bestelling: 'border-status-bestelling',
  gereserveerd: 'border-status-gereserveerd',
};

const statusLabels: Record<string, string> = {
  vrij: 'Vrij',
  bezet: 'Bezet',
  bestelling: 'Open bestelling',
  gereserveerd: 'Gereserveerd',
};

export default function PosTafels() {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const { restaurantId, medewerkerNaam, setTafel, logout } = usePosStore();

  const [tafels, setTafels] = useState<Tafel[]>([]);
  const [zones, setZones] = useState<string[]>([]);
  const [activeZone, setActiveZone] = useState<string>('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!restaurantId) {
      navigate(`/pos/${slug}`);
      return;
    }
    loadTafels();
  }, [restaurantId]);

  async function loadTafels() {
    const { data } = await supabase
      .from('tafels')
      .select('*')
      .eq('restaurant_id', restaurantId)
      .order('volgorde');

    if (data) {
      setTafels(data);
      const uniqueZones = [...new Set(data.map(t => t.zone))];
      setZones(uniqueZones);
      if (uniqueZones.length > 0 && !activeZone) {
        setActiveZone(uniqueZones[0]);
      }
    }
    setLoading(false);
  }

  const filteredTafels = tafels.filter(t => t.zone === activeZone);

  const handleTafelClick = (tafel: Tafel) => {
    setTafel(tafel.id, tafel.naam);
    navigate(`/pos/${slug}/bestelling`);
  };

  const handleLosseVerkoop = () => {
    setTafel(null, null);
    navigate(`/pos/${slug}/bestelling`);
  };

  const handleLogout = () => {
    logout();
    navigate(`/pos/${slug}`);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col">
      {/* Header */}
      <header className="flex items-center justify-between px-6 py-4 border-b border-border">
        <div>
          <span className="text-sm text-muted-foreground">Ingelogd als</span>
          <span className="ml-2 font-semibold">{medewerkerNaam}</span>
        </div>
        <div className="flex gap-3">
          <motion.button
            whileTap={{ scale: 0.95 }}
            onClick={handleLosseVerkoop}
            className="touch-target px-5 py-3 rounded-lg bg-primary text-primary-foreground font-medium"
          >
            Losse verkoop
          </motion.button>
          <motion.button
            whileTap={{ scale: 0.95 }}
            onClick={handleLogout}
            className="touch-target px-5 py-3 rounded-lg bg-secondary text-secondary-foreground font-medium"
          >
            Wissel
          </motion.button>
        </div>
      </header>

      {/* Zone tabs */}
      <div className="flex gap-2 px-6 py-3 overflow-x-auto border-b border-border">
        {zones.map(zone => (
          <motion.button
            key={zone}
            whileTap={{ scale: 0.95 }}
            onClick={() => setActiveZone(zone)}
            className={`touch-target px-6 py-3 rounded-lg font-medium transition-colors ${
              activeZone === zone
                ? 'bg-primary text-primary-foreground'
                : 'bg-secondary text-secondary-foreground'
            }`}
          >
            {zone}
          </motion.button>
        ))}
      </div>

      {/* Table grid */}
      <div className="flex-1 p-6">
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
          {filteredTafels.map(tafel => (
            <motion.button
              key={tafel.id}
              whileTap={{ scale: 0.95 }}
              onClick={() => handleTafelClick(tafel)}
              className={`surface p-5 flex flex-col items-center gap-2 border-2 transition-colors ${
                statusColors[tafel.status] || 'border-border'
              }`}
            >
              <span className="text-xl font-bold">{tafel.naam}</span>
              <span className="text-sm text-muted-foreground">
                {statusLabels[tafel.status] || tafel.status}
              </span>
              <span className="text-xs text-muted-foreground">{tafel.capaciteit} pers.</span>
            </motion.button>
          ))}
        </div>

        {filteredTafels.length === 0 && (
          <p className="text-center text-muted-foreground py-16">
            Geen tafels in deze zone. Voeg tafels toe via het beheer.
          </p>
        )}
      </div>

      {/* Legend */}
      <div className="flex gap-6 justify-center px-6 py-3 border-t border-border text-sm text-muted-foreground">
        <span className="flex items-center gap-2"><span className="w-3 h-3 rounded-full bg-status-vrij" /> Vrij</span>
        <span className="flex items-center gap-2"><span className="w-3 h-3 rounded-full bg-status-bezet" /> Bezet</span>
        <span className="flex items-center gap-2"><span className="w-3 h-3 rounded-full bg-status-bestelling" /> Bestelling</span>
        <span className="flex items-center gap-2"><span className="w-3 h-3 rounded-full bg-status-gereserveerd" /> Gereserveerd</span>
      </div>
    </div>
  );
}
