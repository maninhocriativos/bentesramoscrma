import { createClient } from 'npm:@supabase/supabase-js@2';

// Inscreve/remove a inscrição de push do usuário logado (staff, CRM interno
// — não confundir com a Área do Cliente). Usa o JWT normal do Supabase Auth
// (verify_jwt padrão, sem config.toml) e o client com a chave anon repassando
// o Authorization do chamador — RLS de push_subscriptions já restringe cada
// linha a user_id = auth.uid(), então não precisa de service role aqui.

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  const authHeader = req.headers.get('Authorization') || '';
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_ANON_KEY')!,
    { global: { headers: { Authorization: authHeader } } }
  );

  try {
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Não autorizado' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const body = await req.json();

    if (body.action === 'unsubscribe') {
      const { error } = await supabase.from('push_subscriptions').delete().eq('endpoint', body.endpoint);
      if (error) throw error;
      return new Response(JSON.stringify({ ok: true }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const { endpoint, keys } = body.subscription ?? body;
    if (!endpoint || !keys?.p256dh || !keys?.auth) {
      return new Response(JSON.stringify({ error: 'Subscription inválida' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { error } = await supabase.from('push_subscriptions').upsert({
      user_id: user.id,
      endpoint,
      p256dh: keys.p256dh,
      auth_key: keys.auth,
      user_agent: req.headers.get('user-agent') || null,
    }, { onConflict: 'user_id,endpoint' });

    if (error) throw error;

    return new Response(JSON.stringify({ ok: true }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Erro desconhecido';
    console.error('[push-subscribe]', message);
    return new Response(JSON.stringify({ error: message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
