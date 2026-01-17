import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-webhook-secret',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    const body = await req.json();
    const webhookSecret = req.headers.get('x-webhook-secret');
    
    console.log('[Z-API Webhook] Received:', JSON.stringify(body).substring(0, 500));

    // Verificar configuração do Z-API
    const { data: zapiConfig } = await supabase
      .from('integrations_config')
      .select('*')
      .eq('provider', 'zapi')
      .single();

    if (!zapiConfig?.is_active) {
      console.log('[Z-API Webhook] Integration not active');
      return new Response(JSON.stringify({ error: 'Integration not active' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Validar webhook secret se configurado
    const configSecret = zapiConfig.config_json?.webhook_secret;
    if (configSecret && webhookSecret !== configSecret) {
      console.log('[Z-API Webhook] Invalid webhook secret');
      await logIntegration(supabase, 'zapi', 'inbound', body, null, 'error', 'Invalid webhook secret', null, startTime);
      return new Response(JSON.stringify({ error: 'Invalid secret' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Normalizar evento Z-API para formato interno
    const normalized = normalizeZapiEvent(body);
    
    if (!normalized.phone) {
      console.log('[Z-API Webhook] No phone found in payload');
      await logIntegration(supabase, 'zapi', 'inbound', body, null, 'error', 'No phone in payload', null, startTime);
      return new Response(JSON.stringify({ error: 'No phone' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Buscar ou criar lead pelo telefone
    const leadId = await findOrCreateLead(supabase, normalized);

    // Atualizar last_contact_at
    if (leadId) {
      await supabase
        .from('leads_juridicos')
        .update({ last_contact_at: new Date().toISOString() })
        .eq('id', leadId);
    }

    // Salvar mensagem
    if (normalized.message && leadId) {
      await supabase.from('manychat_mensagens').insert({
        subscriber_id: `zapi_${normalized.phone}`,
        subscriber_nome: normalized.name || normalized.phone,
        conteudo: normalized.message,
        canal: 'whatsapp',
        tipo: normalized.messageType || 'text',
        direcao: 'entrada',
        lead_id: leadId,
        metadata: { source: 'zapi', original: body }
      });
    }

    // Se é mensagem de texto, acionar Isa para processar
    if (normalized.message && leadId && normalized.messageType === 'text') {
      // Buscar estado atual do lead
      const { data: lead } = await supabase
        .from('leads_juridicos')
        .select('lead_state, nome')
        .eq('id', leadId)
        .single();

      if (lead) {
        // Chamar isa-auto-process ou ai-chat para responder
        try {
          const { data: isaResponse, error: isaError } = await supabase.functions.invoke('isa-auto-process', {
            body: {
              lead_id: leadId,
              message: normalized.message,
              lead_state: lead.lead_state || 'NEW',
              channel: 'zapi'
            }
          });

          if (!isaError && isaResponse?.response) {
            // Enviar resposta via Z-API
            await sendZapiMessage(supabase, zapiConfig.config_json, normalized.phone, isaResponse.response);
          }
        } catch (isaErr) {
          console.error('[Z-API Webhook] Error calling Isa:', isaErr);
        }
      }
    }

    // Log sucesso
    await logIntegration(supabase, 'zapi', 'inbound', body, { lead_id: leadId, normalized }, 'ok', null, leadId, startTime);

    return new Response(JSON.stringify({ 
      success: true, 
      lead_id: leadId 
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('[Z-API Webhook] Error:', errorMessage);
    
    await logIntegration(supabase, 'zapi', 'inbound', null, null, 'error', errorMessage, null, startTime);

    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});

function normalizeZapiEvent(body: any): {
  phone: string | null;
  name: string | null;
  message: string | null;
  messageId: string | null;
  messageType: string;
  timestamp: string;
  media: any | null;
} {
  // Z-API pode enviar diferentes formatos
  const phone = body.phone || body.from || body.sender?.phone || body.chatId?.replace('@c.us', '');
  const name = body.senderName || body.sender?.name || body.pushName;
  
  let message = null;
  let messageType = 'text';
  let media = null;

  if (body.text?.message || body.message?.text || body.text) {
    message = body.text?.message || body.message?.text || body.text;
    messageType = 'text';
  } else if (body.audio) {
    message = '[Áudio recebido]';
    messageType = 'audio';
    media = body.audio;
  } else if (body.image) {
    message = '[Imagem recebida]';
    messageType = 'image';
    media = body.image;
  } else if (body.document) {
    message = '[Documento recebido]';
    messageType = 'document';
    media = body.document;
  } else if (body.video) {
    message = '[Vídeo recebido]';
    messageType = 'video';
    media = body.video;
  }

  return {
    phone: phone ? normalizePhone(phone) : null,
    name,
    message,
    messageId: body.messageId || body.id,
    messageType,
    timestamp: body.timestamp ? new Date(body.timestamp * 1000).toISOString() : new Date().toISOString(),
    media
  };
}

function normalizePhone(phone: string): string {
  // Remove caracteres não numéricos
  let cleaned = phone.replace(/\D/g, '');
  
  // Adiciona código do Brasil se não tiver
  if (cleaned.length === 10 || cleaned.length === 11) {
    cleaned = '55' + cleaned;
  }
  
  return cleaned;
}

async function findOrCreateLead(supabase: any, data: { phone: string | null; name: string | null }): Promise<string | null> {
  if (!data.phone) return null;

  const phoneSuffix = data.phone.slice(-9);
  
  // Buscar lead existente
  const { data: existingLead } = await supabase
    .from('leads_juridicos')
    .select('id')
    .ilike('telefone', `%${phoneSuffix}%`)
    .limit(1)
    .maybeSingle();

  if (existingLead) {
    return existingLead.id;
  }

  // Criar novo lead
  const { data: newLead, error } = await supabase
    .from('leads_juridicos')
    .insert({
      nome: data.name || `Contato ${data.phone}`,
      telefone: data.phone,
      status: 'Lead Frio',
      lead_state: 'NEW',
      origem: 'WhatsApp',
      resumo_ia: `Lead criado automaticamente via Z-API. Primeiro contato em ${new Date().toLocaleDateString('pt-BR')}.`
    })
    .select('id')
    .single();

  if (error) {
    console.error('[Z-API Webhook] Error creating lead:', error);
    return null;
  }

  // Registrar estado inicial
  await supabase.from('lead_state_history').insert({
    lead_id: newLead.id,
    from_state: null,
    to_state: 'NEW',
    changed_by: 'zapi',
    reason: 'Lead criado via webhook Z-API'
  });

  return newLead.id;
}

async function sendZapiMessage(supabase: any, config: any, phone: string, message: string): Promise<boolean> {
  const instanceId = config.instance_id;
  const token = config.token;

  if (!instanceId || !token) {
    console.log('[Z-API] Missing instance_id or token');
    return false;
  }

  try {
    const response = await fetch(`https://api.z-api.io/instances/${instanceId}/token/${token}/send-text`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        phone: phone,
        message: message
      })
    });

    const result = await response.json();
    
    // Log outbound
    await supabase.from('integration_logs').insert({
      provider: 'zapi',
      direction: 'outbound',
      endpoint: 'send-text',
      payload_json: { phone, message: message.substring(0, 100) },
      response_json: result,
      status: response.ok ? 'ok' : 'error',
      error_message: response.ok ? null : JSON.stringify(result)
    });

    return response.ok;
  } catch (error) {
    console.error('[Z-API] Error sending message:', error);
    return false;
  }
}

async function logIntegration(
  supabase: any, 
  provider: string, 
  direction: string, 
  payload: any, 
  response: any, 
  status: string, 
  error: string | null,
  leadId: string | null,
  startTime: number
): Promise<void> {
  try {
    await supabase.from('integration_logs').insert({
      provider,
      direction,
      payload_json: payload,
      response_json: response,
      status,
      error_message: error,
      lead_id: leadId,
      duration_ms: Date.now() - startTime
    });
  } catch (e) {
    console.error('[Log] Error logging integration:', e);
  }
}
