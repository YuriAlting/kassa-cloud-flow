
-- Drop old tables
DROP TABLE IF EXISTS public.shifts CASCADE;
DROP TABLE IF EXISTS public.orders CASCADE;
DROP TABLE IF EXISTS public.medewerkers CASCADE;
DROP TABLE IF EXISTS public.producten CASCADE;
DROP TABLE IF EXISTS public.tafels CASCADE;
DROP TABLE IF EXISTS public.user_roles CASCADE;

-- Drop old enum and function
DROP FUNCTION IF EXISTS public.has_role CASCADE;
DROP TYPE IF EXISTS public.app_role CASCADE;

-- Drop existing restaurants if needed (will recreate)
DROP TABLE IF EXISTS public.restaurants CASCADE;

-- ============================================
-- ENUM for roles
-- ============================================
CREATE TYPE public.app_role AS ENUM ('superadmin', 'owner', 'staff');

-- ============================================
-- TABLES
-- ============================================

CREATE TABLE public.restaurants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  address TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  restaurant_id UUID REFERENCES public.restaurants(id) ON DELETE SET NULL,
  role public.app_role NOT NULL DEFAULT 'staff',
  full_name TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id UUID NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true
);

CREATE TABLE public.menu_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id UUID NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  category_id UUID REFERENCES public.categories(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  description TEXT,
  price NUMERIC NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  sort_order INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE public.payment_methods (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id UUID NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true
);

CREATE TABLE public.orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id UUID NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  order_number SERIAL,
  source TEXT NOT NULL DEFAULT 'pos',
  status TEXT NOT NULL DEFAULT 'pending',
  total_amount NUMERIC NOT NULL DEFAULT 0,
  payment_method_id UUID REFERENCES public.payment_methods(id) ON DELETE SET NULL,
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.order_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  menu_item_id UUID REFERENCES public.menu_items(id) ON DELETE SET NULL,
  quantity INTEGER NOT NULL DEFAULT 1,
  unit_price NUMERIC NOT NULL DEFAULT 0,
  name_snapshot TEXT NOT NULL
);

-- ============================================
-- HELPER FUNCTIONS (security definer to avoid RLS recursion)
-- ============================================

CREATE OR REPLACE FUNCTION public.get_user_role()
RETURNS public.app_role
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role FROM public.profiles WHERE id = auth.uid()
$$;

CREATE OR REPLACE FUNCTION public.get_user_restaurant_id()
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT restaurant_id FROM public.profiles WHERE id = auth.uid()
$$;

-- ============================================
-- ENABLE RLS
-- ============================================

ALTER TABLE public.restaurants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.menu_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_methods ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;

-- ============================================
-- RLS POLICIES: restaurants
-- ============================================

CREATE POLICY "Superadmin can do everything with restaurants"
  ON public.restaurants FOR ALL TO authenticated
  USING (get_user_role() = 'superadmin')
  WITH CHECK (get_user_role() = 'superadmin');

CREATE POLICY "Owner can read own restaurant"
  ON public.restaurants FOR SELECT TO authenticated
  USING (id = get_user_restaurant_id());

-- ============================================
-- RLS POLICIES: profiles
-- ============================================

CREATE POLICY "Superadmin can read all profiles"
  ON public.profiles FOR SELECT TO authenticated
  USING (get_user_role() = 'superadmin');

CREATE POLICY "Users can read own profile"
  ON public.profiles FOR SELECT TO authenticated
  USING (id = auth.uid());

CREATE POLICY "Users can update own profile"
  ON public.profiles FOR UPDATE TO authenticated
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

CREATE POLICY "Allow insert own profile on signup"
  ON public.profiles FOR INSERT TO authenticated
  WITH CHECK (id = auth.uid());

-- ============================================
-- RLS POLICIES: categories
-- ============================================

CREATE POLICY "Superadmin full access categories"
  ON public.categories FOR ALL TO authenticated
  USING (get_user_role() = 'superadmin')
  WITH CHECK (get_user_role() = 'superadmin');

CREATE POLICY "Owner/staff can read own restaurant categories"
  ON public.categories FOR SELECT TO authenticated
  USING (restaurant_id = get_user_restaurant_id());

CREATE POLICY "Owner/staff can write own restaurant categories"
  ON public.categories FOR INSERT TO authenticated
  WITH CHECK (restaurant_id = get_user_restaurant_id());

CREATE POLICY "Owner/staff can update own restaurant categories"
  ON public.categories FOR UPDATE TO authenticated
  USING (restaurant_id = get_user_restaurant_id())
  WITH CHECK (restaurant_id = get_user_restaurant_id());

CREATE POLICY "Owner/staff can delete own restaurant categories"
  ON public.categories FOR DELETE TO authenticated
  USING (restaurant_id = get_user_restaurant_id());

-- ============================================
-- RLS POLICIES: menu_items
-- ============================================

CREATE POLICY "Superadmin full access menu_items"
  ON public.menu_items FOR ALL TO authenticated
  USING (get_user_role() = 'superadmin')
  WITH CHECK (get_user_role() = 'superadmin');

CREATE POLICY "Owner/staff can read own restaurant menu_items"
  ON public.menu_items FOR SELECT TO authenticated
  USING (restaurant_id = get_user_restaurant_id());

CREATE POLICY "Owner/staff can write own restaurant menu_items"
  ON public.menu_items FOR INSERT TO authenticated
  WITH CHECK (restaurant_id = get_user_restaurant_id());

CREATE POLICY "Owner/staff can update own restaurant menu_items"
  ON public.menu_items FOR UPDATE TO authenticated
  USING (restaurant_id = get_user_restaurant_id())
  WITH CHECK (restaurant_id = get_user_restaurant_id());

CREATE POLICY "Owner/staff can delete own restaurant menu_items"
  ON public.menu_items FOR DELETE TO authenticated
  USING (restaurant_id = get_user_restaurant_id());

-- ============================================
-- RLS POLICIES: payment_methods
-- ============================================

CREATE POLICY "Superadmin full access payment_methods"
  ON public.payment_methods FOR ALL TO authenticated
  USING (get_user_role() = 'superadmin')
  WITH CHECK (get_user_role() = 'superadmin');

CREATE POLICY "Owner can read own restaurant payment_methods"
  ON public.payment_methods FOR SELECT TO authenticated
  USING (restaurant_id = get_user_restaurant_id());

CREATE POLICY "Owner can write own restaurant payment_methods"
  ON public.payment_methods FOR INSERT TO authenticated
  WITH CHECK (restaurant_id = get_user_restaurant_id() AND get_user_role() = 'owner');

CREATE POLICY "Owner can update own restaurant payment_methods"
  ON public.payment_methods FOR UPDATE TO authenticated
  USING (restaurant_id = get_user_restaurant_id() AND get_user_role() = 'owner')
  WITH CHECK (restaurant_id = get_user_restaurant_id() AND get_user_role() = 'owner');

CREATE POLICY "Owner can delete own restaurant payment_methods"
  ON public.payment_methods FOR DELETE TO authenticated
  USING (restaurant_id = get_user_restaurant_id() AND get_user_role() = 'owner');

-- ============================================
-- RLS POLICIES: orders
-- ============================================

CREATE POLICY "Superadmin full access orders"
  ON public.orders FOR ALL TO authenticated
  USING (get_user_role() = 'superadmin')
  WITH CHECK (get_user_role() = 'superadmin');

CREATE POLICY "Owner/staff can read own restaurant orders"
  ON public.orders FOR SELECT TO authenticated
  USING (restaurant_id = get_user_restaurant_id());

CREATE POLICY "Owner/staff can write own restaurant orders"
  ON public.orders FOR INSERT TO authenticated
  WITH CHECK (restaurant_id = get_user_restaurant_id());

CREATE POLICY "Owner/staff can update own restaurant orders"
  ON public.orders FOR UPDATE TO authenticated
  USING (restaurant_id = get_user_restaurant_id())
  WITH CHECK (restaurant_id = get_user_restaurant_id());

-- ============================================
-- RLS POLICIES: order_items
-- ============================================

CREATE POLICY "Superadmin full access order_items"
  ON public.order_items FOR ALL TO authenticated
  USING (get_user_role() = 'superadmin')
  WITH CHECK (get_user_role() = 'superadmin');

CREATE POLICY "Owner/staff can read own restaurant order_items"
  ON public.order_items FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.orders o
    WHERE o.id = order_id AND o.restaurant_id = get_user_restaurant_id()
  ));

CREATE POLICY "Owner/staff can write own restaurant order_items"
  ON public.order_items FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.orders o
    WHERE o.id = order_id AND o.restaurant_id = get_user_restaurant_id()
  ));

CREATE POLICY "Owner/staff can update own restaurant order_items"
  ON public.order_items FOR UPDATE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.orders o
    WHERE o.id = order_id AND o.restaurant_id = get_user_restaurant_id()
  ));
