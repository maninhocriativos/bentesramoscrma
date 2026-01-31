import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Função para criar hash SHA-256
async function sha256Hash(text: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(text);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

// Normalizar telefone para formato E.164 (apenas números com DDI 55)
function normalizePhone(phone: string | null | undefined): string | null {
  if (!phone) return null;
  
  // Remove tudo que não é número
  let cleaned = phone.replace(/\D/g, '');
  
  // Se começar com 0, remove
  if (cleaned.startsWith('0')) {
    cleaned = cleaned.substring(1);
  }
  
  // Se não começar com 55, adiciona
  if (!cleaned.startsWith('55')) {
    cleaned = '55' + cleaned;
  }
  
  return cleaned;
}

// Normalizar email (lowercase, trim)
function normalizeEmail(email: string | null | undefined): string | null {
  if (!email) return null;
  return email.toLowerCase().trim();
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const PIXEL_ID = Deno.env.get('META_PIXEL_ID');
    const ACCESS_TOKEN = Deno.env.get('META_ACCESS_TOKEN');
    // Nome do CRM exigido pelo guia de integração de CRM da Meta (lead_event_source)
    // Pode ser sobrescrito via secret/env se você quiser personalizar.
    const CRM_EVENT_SOURCE = Deno.env.get('META_LEAD_EVENT_SOURCE') || 'Bentes ramos-CRM';

    if (!PIXEL_ID || !ACCESS_TOKEN) {
      console.error('[Meta CAPI] Missing PIXEL_ID or ACCESS_TOKEN');
      return new Response(
        JSON.stringify({ error: 'Meta API credentials not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { 
      lead_id, 
      facebook_lead_id,
      email, 
      phone, 
      event_name = 'Purchase', 
      value = 0,
      status,
      // Opcional: permite enviar explícito do frontend, mas mantemos um default seguro
      lead_event_source
    } = await req.json();

    console.log('[Meta CAPI] Received event request:', { 
      lead_id, 
      facebook_lead_id,
      event_name, 
      value, 
      status,
      hasEmail: !!email,
      hasPhone: !!phone
    });

    // Preparar user_data com hashes
    const userData: Record<string, string> = {};

    // Adicionar lead_id do Facebook se disponível (melhora a qualidade do evento)
    if (facebook_lead_id) {
      userData.lead_id = facebook_lead_id;
    }

    // Hash do email normalizado
    if (email) {
      const normalizedEmail = normalizeEmail(email);
      if (normalizedEmail) {
        userData.em = await sha256Hash(normalizedEmail);
        console.log('[Meta CAPI] Email hashed successfully');
      }
    }

    // Hash do telefone normalizado (E.164 com DDI 55)
    if (phone) {
      const normalizedPhone = normalizePhone(phone);
      if (normalizedPhone) {
        userData.ph = await sha256Hash(normalizedPhone);
        console.log('[Meta CAPI] Phone hashed successfully:', normalizedPhone.substring(0, 4) + '***');
      }
    }

    // Verificar se temos dados de usuário suficientes
    if (Object.keys(userData).length === 0) {
      console.warn('[Meta CAPI] No user data to send (no email, phone, or lead_id)');
      return new Response(
        JSON.stringify({ 
          success: false, 
          warning: 'No user data available for event matching' 
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Construir payload do evento
    const eventPayload = {
      data: [
        {
          event_name: event_name,
          event_time: Math.floor(Date.now() / 1000),
          action_source: 'system_generated',
          user_data: userData,
          custom_data: {
            currency: 'BRL',
            value: parseFloat(value) || 0,
            // Campos esperados no guia de CRM da Meta
            event_source: 'crm',
            lead_event_source: (lead_event_source || CRM_EVENT_SOURCE),
            lead_status: status,
            internal_lead_id: lead_id
          }
        }
      ],
      access_token: ACCESS_TOKEN
    };

    console.log('[Meta CAPI] Sending event to Meta:', {
      event_name,
      event_time: eventPayload.data[0].event_time,
      user_data_keys: Object.keys(userData),
      value: eventPayload.data[0].custom_data.value
    });

    // Enviar para Meta Conversions API
    const metaResponse = await fetch(
      `https://graph.facebook.com/v20.0/${PIXEL_ID}/events`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(eventPayload)
      }
    );

    const metaResult = await metaResponse.json();

    if (!metaResponse.ok) {
      console.error('[Meta CAPI] Error from Meta API:', metaResult);
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: metaResult.error?.message || 'Failed to send event to Meta',
          details: metaResult 
        }),
        { status: metaResponse.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('[Meta CAPI] Event sent successfully:', metaResult);

    // Logar o evento no integration_logs
    try {
      const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
      const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
      const supabase = createClient(supabaseUrl, supabaseKey);

      await supabase.from('integration_logs').insert({
        provider: 'meta_capi',
        direction: 'outbound',
        endpoint: `https://graph.facebook.com/v20.0/${PIXEL_ID}/events`,
        status: 'success',
        lead_id: lead_id || null,
        payload_json: {
          event_name,
          value,
          status,
          user_data_fields: Object.keys(userData)
        },
        response_json: metaResult
      });
    } catch (logError) {
      console.warn('[Meta CAPI] Failed to log event:', logError);
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        events_received: metaResult.events_received,
        fbtrace_id: metaResult.fbtrace_id
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('[Meta CAPI] Unexpected error:', error);
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});