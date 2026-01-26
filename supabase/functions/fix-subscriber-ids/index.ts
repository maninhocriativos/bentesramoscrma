import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    // 1. Buscar mensagens com subscriber_id zapi_ que têm lead_id
    const { data: messages, error: msgError } = await supabase
      .from('manychat_mensagens')
      .select('id, subscriber_id, lead_id')
      .like('subscriber_id', 'zapi_%')
      .not('lead_id', 'is', null);

    if (msgError) throw msgError;

    let fixed = 0;
    let skipped = 0;
    const results: any[] = [];

    for (const msg of messages || []) {
      // Buscar subscriber correto pelo lead_id
      const { data: sub } = await supabase
        .from('manychat_subscribers')
        .select('subscriber_id, nome')
        .eq('lead_id', msg.lead_id)
        .not('subscriber_id', 'like', 'zapi_%')
        .maybeSingle();

      if (sub?.subscriber_id && sub.subscriber_id !== msg.subscriber_id) {
        // Atualizar para o subscriber_id correto
        const { error: updateError } = await supabase
          .from('manychat_mensagens')
          .update({ subscriber_id: sub.subscriber_id })
          .eq('id', msg.id);

        if (!updateError) {
          fixed++;
          results.push({
            id: msg.id,
            from: msg.subscriber_id,
            to: sub.subscriber_id,
            nome: sub.nome
          });
        }
      } else {
        skipped++;
      }
    }

    return new Response(JSON.stringify({
      success: true,
      total: messages?.length || 0,
      fixed,
      skipped,
      results: results.slice(0, 20)
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Error:', error);
    return new Response(JSON.stringify({ 
      error: error instanceof Error ? error.message : 'Unknown error' 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
