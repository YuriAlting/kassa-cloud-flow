import { useAuth } from '@/contexts/AuthContext';
import { Navigate } from 'react-router-dom';
import RestaurantOverview from './RestaurantOverview';

export default function DashboardRouter() {
  const { profile } = useAuth();
  // Staff homepage is plattegrond — redirect there
  if (profile?.role === 'staff') return <Navigate to="/restaurant/plattegrond" replace />;
  return <RestaurantOverview />;
}
