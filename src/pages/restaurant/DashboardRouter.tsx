import { useAuth } from '@/contexts/AuthContext';
import RestaurantOverview from './RestaurantOverview';
import FloorPlanPage from './FloorPlanPage';

export default function DashboardRouter() {
  const { profile } = useAuth();
  if (profile?.role === 'staff') return <FloorPlanPage />;
  return <RestaurantOverview />;
}
