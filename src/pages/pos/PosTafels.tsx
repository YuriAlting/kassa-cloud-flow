import { useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { usePosStore } from '@/stores/posStore';

// Tables (tafels) have been removed from the schema.
// Redirect to bestelling page directly.
export default function PosTafels() {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const { restaurantId } = usePosStore();

  useEffect(() => {
    if (!restaurantId) {
      navigate(`/pos/${slug}`);
    } else {
      navigate(`/pos/${slug}/bestelling`);
    }
  }, [restaurantId, slug, navigate]);

  return null;
}
