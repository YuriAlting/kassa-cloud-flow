import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // Maak admin client met service role key
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    );

    // Verificeer dat de aanvrager een owner is
    const authHeader = req.headers.get('Authorization');
    const supabaseUser = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader! } } }
    );

    const { data: { user }, error: userError } = await supabaseUser.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: 'Niet ingelogd' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('role, restaurant_id')
      .eq('id', user.id)
      .single();

    if (profile?.role !== 'owner' && profile?.role !== 'superadmin') {
      return new Response(JSON.stringify({ error: 'Geen toegang' }), {
        status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const { action, ...payload } = await req.json();

    // ── Lijst van staff ophalen ──
    if (action === 'list_staff') {
      const { data, error } = await supabaseAdmin
        .from('profiles')
        .select('id, full_name, display_name, role, pin_code')
        .eq('restaurant_id', profile.restaurant_id)
        .neq('role', 'superadmin');

      if (error) throw error;
      return new Response(JSON.stringify({ data }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // ── Account aanmaken ──
    if (action === 'create_user') {
      const { display_name, pin, role } = payload;
      const email = `${display_name.toLowerCase().replace(/\s/g, '')}_${Date.now()}@internal.aiakassa.nl`;

      const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
        email,
        password: pin,
        email_confirm: true,
      });

      if (createError) throw createError;

      await supabaseAdmin.from('profiles').insert({
        id: newUser.user!.id,
        full_name: display_name,
        display_name,
        pin_code: pin,
        role,
        restaurant_id: profile.restaurant_id,
      });

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // ── Account verwijderen ──
    if (action === 'delete_user') {
      const { user_id } = payload;
      await supabaseAdmin.from('profiles').delete().eq('id', user_id);
      await supabaseAdmin.auth.admin.deleteUser(user_id);

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // ── PIN wijzigen ──
    if (action === 'update_pin') {
      const { user_id, new_pin } = payload;

      await supabaseAdmin.auth.admin.updateUserById(user_id, { password: new_pin });
      await supabaseAdmin.from('profiles').update({ pin_code: new_pin }).eq('id', user_id);

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // ── Rol wijzigen ──
    if (action === 'update_role') {
      const { user_id, new_role } = payload;
      await supabaseAdmin.from('profiles').update({ role: new_role }).eq('id', user_id);

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    return new Response(JSON.stringify({ error: 'Onbekende actie' }), {
      status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});