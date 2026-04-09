import { useAuth } from '@/contexts/AuthContext';
import RestaurantOverview from './RestaurantOverview';
import StaffDashboard from './StaffDashboard';

export default function DashboardRouter() {
  const { profile } = useAuth();
  if (profile?.role === 'staff') return <StaffDashboard />;
  return <RestaurantOverview />;
}
