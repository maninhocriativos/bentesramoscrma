import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const manychatApiKey = Deno.env.get('MANYCHAT_API_KEY')!;

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    // Buscar subscribers com nome "Desconhecido" ou sem nome, ou com nome com colchetes
    const { data: subscribers, error } = await supabase
      .from('manychat_subscribers')
      .select('*')
      .or('nome.is.null,nome.eq.Desconhecido,nome.eq.Sem nome,nome.like.[%]')
      .not('subscriber_id', 'like', 'manual_%')
      .not('subscriber_id', 'like', 'test_%')
      .not('subscriber_id', 'like', 'api_%')
      .not('subscriber_id', 'like', 'teste_%')
      .not('subscriber_id', 'like', 'webhook_%');

    if (error) throw error;

    console.log(`[SYNC] Encontrados ${subscribers?.length || 0} contatos para atualizar`);

    let updated = 0;
    const results: any[] = [];

    for (const sub of subscribers || []) {
      try {
        // Buscar dados do ManyChat
        const url = new URL('https://api.manychat.com/fb/subscriber/getInfo');
        url.searchParams.append('subscriber_id', sub.subscriber_id);
        
        const mcResponse = await fetch(url.toString(), {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${manychatApiKey}`,
            'Content-Type': 'application/json',
          },
        });

        if (!mcResponse.ok) {
          console.log(`[SYNC] Erro ao buscar ${sub.subscriber_id}:`, mcResponse.status);
          continue;
        }

        const mcData = await mcResponse.json();
        
        if (mcData.status === 'success' && mcData.data) {
          const data = mcData.data;
          // Limpar colchetes do nome
          let nome = data.name || `${data.first_name || ''} ${data.last_name || ''}`.trim();
          if (nome) nome = nome.replace(/^\[|\]$/g, '').trim();
          
          let telefone = data.whatsapp_phone || data.phone || sub.telefone;
          if (telefone) telefone = String(telefone).replace(/^\[|\]$/g, '').trim();
          
          // Detectar canal correto baseado no telefone
          let canal = sub.canal;
          if (telefone) {
            const telLimpo = telefone.replace(/\D/g, '');
            if (telLimpo.startsWith('55') && telLimpo.length >= 12) {
              canal = 'whatsapp';
            }
          }
          
          if (nome && nome !== '' && nome !== 'Desconhecido') {
            const { error: updateError } = await supabase
              .from('manychat_subscribers')
              .update({ 
                nome, 
                telefone,
                canal,
                foto: data.profile_pic || sub.foto,
                updated_at: new Date().toISOString() 
              })
              .eq('subscriber_id', sub.subscriber_id);

            if (!updateError) {
              updated++;
              results.push({ subscriber_id: sub.subscriber_id, nome, telefone, canal });
              console.log(`[SYNC] ✅ Atualizado: ${sub.subscriber_id} -> ${nome} (${canal})`);
            }
          }
        }
      } catch (e) {
        console.log(`[SYNC] Erro ao processar ${sub.subscriber_id}:`, e);
      }
    }

    console.log(`[SYNC] Concluído. ${updated} contatos atualizados.`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        total: subscribers?.length || 0,
        updated,
        results 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('[SYNC] Erro:', error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});