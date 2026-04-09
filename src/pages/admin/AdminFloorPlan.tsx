import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import FloorPlanPage from '@/pages/restaurant/FloorPlanPage';

export default function AdminFloorPlan() {
  const navigate = useNavigate();

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { navigate('/admin'); return; }
      const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single();
      if (!profile || profile.role !== 'superadmin') navigate('/admin');
    })();
  }, []);

  return (
    <div className="min-h-screen">
      <FloorPlanPage />
    </div>
  );
}
