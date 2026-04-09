
-- Create app roles enum
CREATE TYPE public.app_role AS ENUM ('superadmin');

-- Create user_roles table for superadmin access
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL,
  UNIQUE (user_id, role)
);
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Security definer function to check roles (avoids RLS recursion)
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

-- Restaurants table
CREATE TABLE public.restaurants (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  naam TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  actief BOOLEAN DEFAULT true,
  printnode_api_key TEXT,
  printnode_kassa_id TEXT,
  printnode_keuken_1 TEXT,
  printnode_keuken_2 TEXT,
  printnode_keuken_3 TEXT,
  aangemaakt_op TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.restaurants ENABLE ROW LEVEL SECURITY;

-- Medewerkers table
CREATE TABLE public.medewerkers (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  restaurant_id UUID REFERENCES public.restaurants(id) ON DELETE CASCADE NOT NULL,
  naam TEXT NOT NULL,
  pincode TEXT NOT NULL,
  rol TEXT DEFAULT 'medewerker',
  actief BOOLEAN DEFAULT true
);
ALTER TABLE public.medewerkers ENABLE ROW LEVEL SECURITY;

-- Shifts table
CREATE TABLE public.shifts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  medewerker_id UUID REFERENCES public.medewerkers(id) ON DELETE CASCADE,
  restaurant_id UUID REFERENCES public.restaurants(id) ON DELETE CASCADE,
  ingelogd_op TIMESTAMPTZ DEFAULT now(),
  uitgelogd_op TIMESTAMPTZ
);
ALTER TABLE public.shifts ENABLE ROW LEVEL SECURITY;

-- Producten table
CREATE TABLE public.producten (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  restaurant_id UUID REFERENCES public.restaurants(id) ON DELETE CASCADE NOT NULL,
  naam TEXT NOT NULL,
  prijs NUMERIC(10,2) NOT NULL,
  categorie TEXT NOT NULL,
  actief BOOLEAN DEFAULT true,
  volgorde INTEGER DEFAULT 0
);
ALTER TABLE public.producten ENABLE ROW LEVEL SECURITY;

-- Tafels table
CREATE TABLE public.tafels (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  restaurant_id UUID REFERENCES public.restaurants(id) ON DELETE CASCADE NOT NULL,
  naam TEXT NOT NULL,
  zone TEXT NOT NULL,
  capaciteit INTEGER DEFAULT 4,
  status TEXT DEFAULT 'vrij',
  volgorde INTEGER DEFAULT 0
);
ALTER TABLE public.tafels ENABLE ROW LEVEL SECURITY;

-- Orders table
CREATE TABLE public.orders (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  restaurant_id UUID REFERENCES public.restaurants(id) ON DELETE CASCADE,
  tafel_id UUID REFERENCES public.tafels(id),
  medewerker_id UUID REFERENCES public.medewerkers(id),
  items JSONB NOT NULL,
  totaal NUMERIC(10,2) NOT NULL,
  korting NUMERIC(10,2) DEFAULT 0,
  korting_type TEXT,
  betaalwijze TEXT,
  bron TEXT DEFAULT 'balie',
  status TEXT DEFAULT 'nieuw',
  aangemaakt_op TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;

-- Helper function: get restaurant_id for a medewerker linked to current auth user
-- For now, RLS uses service role for superadmin, and we'll use a custom claim approach
-- We'll use a simpler approach: superadmins bypass via function, restaurants accessed via API

-- RLS Policies for user_roles
CREATE POLICY "Superadmins can view all roles" ON public.user_roles
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'superadmin'));

-- RLS Policies for restaurants
CREATE POLICY "Superadmins can do everything with restaurants" ON public.restaurants
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'superadmin'))
  WITH CHECK (public.has_role(auth.uid(), 'superadmin'));

CREATE POLICY "Public can read active restaurants by slug" ON public.restaurants
  FOR SELECT TO anon
  USING (actief = true);

-- RLS Policies for medewerkers
CREATE POLICY "Superadmins can manage all medewerkers" ON public.medewerkers
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'superadmin'))
  WITH CHECK (public.has_role(auth.uid(), 'superadmin'));

CREATE POLICY "Anon can read medewerkers for login" ON public.medewerkers
  FOR SELECT TO anon
  USING (actief = true);

-- RLS Policies for shifts
CREATE POLICY "Superadmins can manage all shifts" ON public.shifts
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'superadmin'))
  WITH CHECK (public.has_role(auth.uid(), 'superadmin'));

CREATE POLICY "Anon can insert shifts" ON public.shifts
  FOR INSERT TO anon
  WITH CHECK (true);

CREATE POLICY "Anon can read own restaurant shifts" ON public.shifts
  FOR SELECT TO anon
  USING (true);

CREATE POLICY "Anon can update shifts" ON public.shifts
  FOR UPDATE TO anon
  USING (true);

-- RLS Policies for producten
CREATE POLICY "Superadmins can manage all producten" ON public.producten
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'superadmin'))
  WITH CHECK (public.has_role(auth.uid(), 'superadmin'));

CREATE POLICY "Anon can read active producten" ON public.producten
  FOR SELECT TO anon
  USING (actief = true);

-- RLS Policies for tafels
CREATE POLICY "Superadmins can manage all tafels" ON public.tafels
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'superadmin'))
  WITH CHECK (public.has_role(auth.uid(), 'superadmin'));

CREATE POLICY "Anon can read tafels" ON public.tafels
  FOR SELECT TO anon
  USING (true);

CREATE POLICY "Anon can update tafels" ON public.tafels
  FOR UPDATE TO anon
  USING (true);

-- RLS Policies for orders
CREATE POLICY "Superadmins can manage all orders" ON public.orders
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'superadmin'))
  WITH CHECK (public.has_role(auth.uid(), 'superadmin'));

CREATE POLICY "Anon can insert orders" ON public.orders
  FOR INSERT TO anon
  WITH CHECK (true);

CREATE POLICY "Anon can read orders" ON public.orders
  FOR SELECT TO anon
  USING (true);

CREATE POLICY "Anon can update orders" ON public.orders
  FOR UPDATE TO anon
  USING (true);
