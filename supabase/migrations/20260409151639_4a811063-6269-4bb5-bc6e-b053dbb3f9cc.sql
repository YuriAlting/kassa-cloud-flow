
-- Create floor_sections table
CREATE TABLE public.floor_sections (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  restaurant_id UUID NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0
);

ALTER TABLE public.floor_sections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Superadmin full access floor_sections" ON public.floor_sections FOR ALL TO authenticated
  USING (get_user_role() = 'superadmin') WITH CHECK (get_user_role() = 'superadmin');

CREATE POLICY "Owner/staff can read own floor_sections" ON public.floor_sections FOR SELECT TO authenticated
  USING (restaurant_id = get_user_restaurant_id());

CREATE POLICY "Owner/staff can insert own floor_sections" ON public.floor_sections FOR INSERT TO authenticated
  WITH CHECK (restaurant_id = get_user_restaurant_id());

CREATE POLICY "Owner/staff can update own floor_sections" ON public.floor_sections FOR UPDATE TO authenticated
  USING (restaurant_id = get_user_restaurant_id()) WITH CHECK (restaurant_id = get_user_restaurant_id());

CREATE POLICY "Owner/staff can delete own floor_sections" ON public.floor_sections FOR DELETE TO authenticated
  USING (restaurant_id = get_user_restaurant_id());

-- Create tables table
CREATE TABLE public.tables (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  restaurant_id UUID NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  floor_section_id UUID REFERENCES public.floor_sections(id) ON DELETE SET NULL,
  table_number TEXT NOT NULL,
  seats INTEGER NOT NULL DEFAULT 4,
  shape TEXT NOT NULL DEFAULT 'square',
  position_x NUMERIC NOT NULL DEFAULT 0,
  position_y NUMERIC NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'vrij',
  is_takeaway BOOLEAN NOT NULL DEFAULT false
);

ALTER TABLE public.tables ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Superadmin full access tables" ON public.tables FOR ALL TO authenticated
  USING (get_user_role() = 'superadmin') WITH CHECK (get_user_role() = 'superadmin');

CREATE POLICY "Owner/staff can read own tables" ON public.tables FOR SELECT TO authenticated
  USING (restaurant_id = get_user_restaurant_id());

CREATE POLICY "Owner/staff can insert own tables" ON public.tables FOR INSERT TO authenticated
  WITH CHECK (restaurant_id = get_user_restaurant_id());

CREATE POLICY "Owner/staff can update own tables" ON public.tables FOR UPDATE TO authenticated
  USING (restaurant_id = get_user_restaurant_id()) WITH CHECK (restaurant_id = get_user_restaurant_id());

CREATE POLICY "Owner/staff can delete own tables" ON public.tables FOR DELETE TO authenticated
  USING (restaurant_id = get_user_restaurant_id());
