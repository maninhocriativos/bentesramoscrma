import { createClient } from 'npm:@supabase/supabase-js@2';
import webpush from 'npm:web-push@3';

// Envia notificação push pros dispositivos inscritos de um ou mais usuários.
// Chamada só de dentro do sistema (outras Edge Functions, ex: zapi-webhook
// numa mensagem nova) — nunca pelo navegador do usuário final — por isso
// verify_jwt=false + secret compartilhado, mesmo padrão de zapi-webhook.
// Usa service_role pra ler inscrições de QUALQUER usuário (não só de quem
// chamou), o que só faz sentido vindo de dentro do próprio backend.

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'content-type, x-push-secret',
};

const supabaseAdmin = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

const PUSH_SECRET = Deno.env.get('PUSH_SEND_SECRET');

webpush.setVapidDetails(
  Deno.env.get('VAPID_SUBJECT') || 'mailto:contato@bentesramoscrm.com.br',
  Deno.env.get('VAPID_PUBLIC_KEY')!,
  Deno.env.get('VAPID_PRIVATE_KEY')!,
);

interface PushPayload {
  user_ids: string[];
  title: string;
  body: string;
  url?: string;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  const secret = req.headers.get('x-push-secret');
  if (!PUSH_SECRET || secret !== PUSH_SECRET) {
    return new Response(JSON.stringify({ error: 'Não autorizado' }), {
      status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  try {
    const { user_ids, title, body, url }: PushPayload = await req.json();
    if (!user_ids?.length || !title || !body) {
      return new Response(JSON.stringify({ error: 'user_ids, title e body são obrigatórios' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { data: subs, error } = await supabaseAdmin
      .from('push_subscriptions')
      .select('id, endpoint, p256dh, auth_key')
      .in('user_id', user_ids);
    if (error) throw error;

    const payload = JSON.stringify({ title, body, data: { url: url || '/' } });
    const deadIds: string[] = [];
    let sent = 0;

    await Promise.all((subs || []).map(async (sub) => {
      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth_key } },
          payload,
        );
        sent++;
      } catch (err: any) {
        // 404/410 = inscrição expirada/revogada no navegador — limpa do banco
        if (err?.statusCode === 404 || err?.statusCode === 410) {
          deadIds.push(sub.id);
        } else {
          console.error('[push-send] falha ao enviar', sub.id, err?.message || err);
        }
      }
    }));

    if (deadIds.length) {
      await supabaseAdmin.from('push_subscriptions').delete().in('id', deadIds);
    }

    return new Response(JSON.stringify({ sent, total: subs?.length || 0, removed: deadIds.length }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Erro desconhecido';
    console.error('[push-send]', message);
    return new Response(JSON.stringify({ error: message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
