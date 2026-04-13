
CREATE TABLE public.product_options (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  menu_item_id UUID NOT NULL REFERENCES public.menu_items(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  price NUMERIC NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.product_options ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Superadmin full access product_options"
  ON public.product_options FOR ALL TO authenticated
  USING (get_user_role() = 'superadmin'::app_role)
  WITH CHECK (get_user_role() = 'superadmin'::app_role);

CREATE POLICY "Owner/staff can read own restaurant product_options"
  ON public.product_options FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.menu_items mi
    WHERE mi.id = product_options.menu_item_id
    AND mi.restaurant_id = get_user_restaurant_id()
  ));

CREATE POLICY "Owner/staff can write own restaurant product_options"
  ON public.product_options FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.menu_items mi
    WHERE mi.id = product_options.menu_item_id
    AND mi.restaurant_id = get_user_restaurant_id()
  ));

CREATE POLICY "Owner/staff can update own restaurant product_options"
  ON public.product_options FOR UPDATE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.menu_items mi
    WHERE mi.id = product_options.menu_item_id
    AND mi.restaurant_id = get_user_restaurant_id()
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.menu_items mi
    WHERE mi.id = product_options.menu_item_id
    AND mi.restaurant_id = get_user_restaurant_id()
  ));

CREATE POLICY "Owner/staff can delete own restaurant product_options"
  ON public.product_options FOR DELETE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.menu_items mi
    WHERE mi.id = product_options.menu_item_id
    AND mi.restaurant_id = get_user_restaurant_id()
  ));
