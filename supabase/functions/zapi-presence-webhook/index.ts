const serve = Deno.serve;
import { createClient } from "npm:@supabase/supabase-js@2";
import { gerarSubscriberId } from '../_shared/zapi-helper.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-webhook-secret',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

// Webhook de presença do Z-API ("chat-presence"): notifica quando o CONTATO
// (não a equipe) está digitando/gravando áudio no WhatsApp dele. Só repassa
// pro front via broadcast em tempo real — não grava nada no banco (evento
// efêmero, dispara a cada tecla digitada do lado do contato).
serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const body = await req.json().catch(() => ({}));
    const { type, phone, status } = body || {};

    if (type !== 'PresenceChatCallback' || !phone || !status) {
      return new Response(JSON.stringify({ ok: true, ignored: true }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const subscriberId = gerarSubscriberId(phone);
    const typing = status === 'COMPOSING' || status === 'RECORDING';

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const channel = supabase.channel('whatsapp-customer-typing');
    await channel.send({
      type: 'broadcast',
      event: 'typing',
      payload: { subscriber_id: subscriberId, typing, status },
    });

    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('[zapi-presence-webhook] erro:', err);
    return new Response(JSON.stringify({ ok: false }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
