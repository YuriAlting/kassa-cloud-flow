import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface PaymentMethod {
  id: string;
  name: string;
  is_active: boolean;
}

const DEFAULT_METHODS = ['cash', 'pin', 'ideal'];

export default function PaymentMethodsPage() {
  const { profile } = useAuth();
  const [methods, setMethods] = useState<PaymentMethod[]>([]);
  const [loading, setLoading] = useState(true);

  const restaurantId = profile?.restaurant_id;

  useEffect(() => {
    if (restaurantId) load();
  }, [restaurantId]);

  async function load() {
    const { data } = await supabase
      .from('payment_methods')
      .select('*')
      .eq('restaurant_id', restaurantId!)
      .order('name');

    if (data && data.length > 0) {
      setMethods(data);
    } else {
      // Auto-create defaults
      const inserts = DEFAULT_METHODS.map(name => ({
        restaurant_id: restaurantId!,
        name,
        is_active: true,
      }));
      await supabase.from('payment_methods').insert(inserts);
      const { data: fresh } = await supabase
        .from('payment_methods')
        .select('*')
        .eq('restaurant_id', restaurantId!)
        .order('name');
      setMethods(fresh || []);
    }
    setLoading(false);
  }

  const toggle = async (id: string, current: boolean) => {
    const { error } = await supabase
      .from('payment_methods')
      .update({ is_active: !current })
      .eq('id', id);
    if (error) { toast.error('Fout bij opslaan'); return; }
    setMethods(m => m.map(p => p.id === id ? { ...p, is_active: !current } : p));
    toast.success('Bijgewerkt');
  };

  const labelMap: Record<string, string> = {
    cash: '💵 Contant',
    pin: '💳 PIN',
    ideal: '🏦 iDEAL',
  };

  return (
    <div className="p-6 space-y-6">
      <h2 className="text-xl font-bold">Betaalmethoden</h2>
      <p className="text-muted-foreground text-sm">Schakel betaalmethoden in of uit voor jouw restaurant.</p>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {methods.map(m => (
          <motion.button
            key={m.id}
            whileTap={{ scale: 0.97 }}
            onClick={() => toggle(m.id, m.is_active)}
            className={`surface p-6 text-center transition-all border-2 ${
              m.is_active
                ? 'border-primary bg-primary/10'
                : 'border-border opacity-60'
            }`}
          >
            <p className="text-2xl mb-2">{labelMap[m.name]?.split(' ')[0] || '💳'}</p>
            <p className="font-semibold">{labelMap[m.name]?.split(' ').slice(1).join(' ') || m.name}</p>
            <p className={`text-xs mt-2 font-medium ${m.is_active ? 'text-success' : 'text-muted-foreground'}`}>
              {m.is_active ? 'Actief' : 'Uitgeschakeld'}
            </p>
          </motion.button>
        ))}
      </div>

      {loading && (
        <div className="flex justify-center py-12">
          <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      )}
    </div>
  );
}
