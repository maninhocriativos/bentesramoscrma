import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const MANYCHAT_API_URL = 'https://api.manychat.com';
// ManyChat usa /fb/ para Messenger e /wa/ para WhatsApp - vamos tentar ambos

interface ManyChatSubscriber {
  id: string;
  page_id?: string;
  user_id?: string;
  first_name?: string;
  last_name?: string;
  name?: string;
  gender?: string;
  profile_pic?: string;
  locale?: string;
  language?: string;
  timezone?: string;
  subscribed?: string;
  last_interaction?: string;
  last_seen?: string;
  is_followup_enabled?: boolean;
  ig_id?: string;
  ig_username?: string;
  whatsapp_phone?: string;
  phone?: string;
  email?: string;
  has_opt_in_sms?: boolean;
  has_opt_in_email?: boolean;
  custom_fields?: any;
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey);
  const MANYCHAT_API_KEY = Deno.env.get('MANYCHAT_API_KEY');

  if (!MANYCHAT_API_KEY) {
    return new Response(
      JSON.stringify({ success: false, error: 'MANYCHAT_API_KEY não configurada' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }

  try {
    const { mode = 'full' } = await req.json().catch(() => ({}));
    console.log(`[FULL-SYNC] Iniciando sincronização completa (modo: ${mode})...`);

    const headers = {
      'Authorization': `Bearer ${MANYCHAT_API_KEY}`,
      'Content-Type': 'application/json',
    };

    // 1. Buscar TODOS os subscribers do ManyChat usando paginação
    let allSubscribers: ManyChatSubscriber[] = [];
    let hasMore = true;
    let offset = 0;
    const limit = 100;

    console.log('[FULL-SYNC] Buscando subscribers do ManyChat...');
    console.log('[FULL-SYNC] API Key prefix:', MANYCHAT_API_KEY?.substring(0, 15) + '...');

    // Tentar primeiro com WhatsApp (/wa/), depois com Facebook (/fb/)
    const endpoints = [
      { prefix: '/wa', name: 'WhatsApp' },
      { prefix: '/fb', name: 'Facebook' }
    ];

    for (const endpoint of endpoints) {
      if (allSubscribers.length > 0) break;
      
      console.log(`[FULL-SYNC] Tentando endpoint ${endpoint.name}...`);
      hasMore = true;
      offset = 0;

      while (hasMore) {
        try {
          // Usar endpoint de busca com paginação
          const url = new URL(`${MANYCHAT_API_URL}${endpoint.prefix}/subscriber/getSubscribers`);
          url.searchParams.append('limit', limit.toString());
          url.searchParams.append('offset', offset.toString());

          console.log('[FULL-SYNC] Chamando:', url.toString());
          const response = await fetch(url.toString(), {
            method: 'GET',
            headers,
          });

          console.log('[FULL-SYNC] Status:', response.status);

          if (!response.ok) {
            const errorText = await response.text();
            console.log(`[FULL-SYNC] Erro ${endpoint.name}: ${response.status}`);
            
            // Tentar fallback findByName
            const fallbackUrl = new URL(`${MANYCHAT_API_URL}${endpoint.prefix}/subscriber/findByName`);
            fallbackUrl.searchParams.append('name', 'a'); // Buscar por letra comum
            
            console.log('[FULL-SYNC] Tentando findByName:', fallbackUrl.toString());
            const fallbackResponse = await fetch(fallbackUrl.toString(), {
              method: 'GET',
              headers,
            });
            
            console.log('[FULL-SYNC] findByName status:', fallbackResponse.status);
            
            if (fallbackResponse.ok) {
              const fallbackData = await fallbackResponse.json();
              console.log('[FULL-SYNC] findByName resultado:', fallbackData.status, 'qtd:', fallbackData.data?.length || 0);
              if (fallbackData.status === 'success' && fallbackData.data) {
                allSubscribers = fallbackData.data;
              }
            }
            hasMore = false;
            break;
          }

          const data = await response.json();
          console.log('[FULL-SYNC] Response status:', data.status, 'qtd:', data.data?.length || 0);
          console.log(`[FULL-SYNC] Página ${offset / limit + 1}: ${data.data?.length || 0} subscribers`);

          if (data.status === 'success' && data.data && data.data.length > 0) {
            allSubscribers = [...allSubscribers, ...data.data];
            offset += limit;
            hasMore = data.data.length === limit;
          } else {
            hasMore = false;
          }
        } catch (e) {
          console.error('[FULL-SYNC] Erro na paginação:', e);
          hasMore = false;
        }
      }
    }

    console.log(`[FULL-SYNC] Total de subscribers encontrados: ${allSubscribers.length}`);

    // 2. Para cada subscriber, buscar detalhes completos e salvar
    let created = 0;
    let updated = 0;
    let errors = 0;
    const results: any[] = [];

    for (const sub of allSubscribers) {
      try {
        // Buscar detalhes completos do subscriber
        const detailUrl = new URL(`${MANYCHAT_API_URL}/fb/subscriber/getInfo`);
        detailUrl.searchParams.append('subscriber_id', sub.id);

        const detailResponse = await fetch(detailUrl.toString(), {
          method: 'GET',
          headers,
        });

        let fullData = sub;
        if (detailResponse.ok) {
          const detailJson = await detailResponse.json();
          if (detailJson.status === 'success' && detailJson.data) {
            fullData = detailJson.data;
          }
        }

        // Normalizar dados
        let nome = fullData.name || `${fullData.first_name || ''} ${fullData.last_name || ''}`.trim();
        if (nome) nome = nome.replace(/^\[|\]$/g, '').trim();
        if (!nome || nome === '') nome = 'Desconhecido';

        let telefone = fullData.whatsapp_phone || fullData.phone || null;
        if (telefone) telefone = String(telefone).replace(/^\[|\]$/g, '').trim();

        // Detectar canal
        let canal = 'facebook';
        if (fullData.ig_id || fullData.ig_username) {
          canal = 'instagram';
        } else if (telefone) {
          const telLimpo = telefone.replace(/\D/g, '');
          if (telLimpo.startsWith('55') && telLimpo.length >= 12) {
            canal = 'whatsapp';
          }
        }

        const subscriberData = {
          subscriber_id: sub.id,
          nome,
          telefone,
          email: fullData.email || null,
          foto: fullData.profile_pic || null,
          canal,
          ultima_interacao: fullData.last_interaction || fullData.last_seen || new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };

        // Verificar se já existe
        const { data: existing } = await supabase
          .from('manychat_subscribers')
          .select('id, lead_id')
          .eq('subscriber_id', sub.id)
          .single();

        if (existing) {
          // Atualizar mantendo lead_id
          const { error: updateError } = await supabase
            .from('manychat_subscribers')
            .update(subscriberData)
            .eq('subscriber_id', sub.id);

          if (!updateError) {
            updated++;
            results.push({ ...subscriberData, action: 'updated' });
          } else {
            errors++;
          }
        } else {
          // Criar novo
          const { error: insertError } = await supabase
            .from('manychat_subscribers')
            .insert(subscriberData);

          if (!insertError) {
            created++;
            results.push({ ...subscriberData, action: 'created' });
          } else {
            errors++;
          }
        }

        // Buscar histórico de mensagens do subscriber (se disponível)
        if (mode === 'full') {
          try {
            // ManyChat não tem endpoint público para histórico de mensagens
            // As mensagens são capturadas em tempo real via webhook
            // Podemos buscar custom fields e tags para enriquecer o contexto
            
            if (fullData.custom_fields) {
              console.log(`[FULL-SYNC] Custom fields para ${sub.id}:`, fullData.custom_fields);
            }
          } catch (e) {
            // Ignorar erros de busca de mensagens
          }
        }

      } catch (e) {
        console.error(`[FULL-SYNC] Erro ao processar ${sub.id}:`, e);
        errors++;
      }
    }

    // 3. Registrar evento de sincronização
    await supabase.from('system_events').insert({
      tipo: 'integracao',
      fonte: 'manychat-full-sync',
      acao: 'sync_completo',
      dados: {
        total: allSubscribers.length,
        created,
        updated,
        errors,
      },
    });

    console.log(`[FULL-SYNC] Concluído. Criados: ${created}, Atualizados: ${updated}, Erros: ${errors}`);

    return new Response(
      JSON.stringify({
        success: true,
        total: allSubscribers.length,
        created,
        updated,
        errors,
        results: results.slice(0, 50), // Limitar resultados na resposta
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('[FULL-SYNC] Erro geral:', error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});
