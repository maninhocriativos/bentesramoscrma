import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
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
    const { to_phone, message, provider = 'zapi', lead_id, attachments } = await req.json();

    if (!to_phone || !message) {
      return new Response(JSON.stringify({ error: 'Missing to_phone or message' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    console.log(`[Send Message] Provider: ${provider}, Phone: ${to_phone}`);

    // Buscar configuração do provider
    const { data: config } = await supabase
      .from('integrations_config')
      .select('*')
      .eq('provider', provider)
      .single();

    if (!config?.is_active) {
      return new Response(JSON.stringify({ error: `${provider} integration not active` }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    let result;
    let success = false;

    if (provider === 'zapi') {
      result = await sendViaZapi(config.config_json, to_phone, message);
      success = result.success;
    } else if (provider === 'fiqon') {
      result = await sendViaFiqon(config.config_json, to_phone, message);
      success = result.success;
    } else {
      return new Response(JSON.stringify({ error: 'Unsupported provider' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Log outbound
    await supabase.from('integration_logs').insert({
      provider,
      direction: 'outbound',
      endpoint: 'send-message',
      payload_json: { to_phone, message: message.substring(0, 100) },
      response_json: result.data,
      status: success ? 'ok' : 'error',
      error_message: success ? null : result.error,
      lead_id,
      duration_ms: Date.now() - startTime
    });

    // Salvar mensagem enviada
    if (success && lead_id) {
      await supabase.from('manychat_mensagens').insert({
        subscriber_id: `${provider}_${to_phone}`,
        subscriber_nome: 'Escritório',
        conteudo: message,
        canal: 'whatsapp',
        tipo: 'text',
        direcao: 'saida',
        lead_id,
        metadata: { source: provider }
      });

      // Registrar interação
      await supabase.from('interacoes').insert({
        cliente_id: lead_id,
        tipo: 'WhatsApp',
        resumo: message.substring(0, 100),
        detalhes: message,
        direcao: 'Saída'
      });
    }

    return new Response(JSON.stringify({ 
      success,
      data: result.data,
      error: result.error
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('[Send Message] Error:', errorMessage);

    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});

async function sendViaZapi(config: any, phone: string, message: string): Promise<{ success: boolean; data?: any; error?: string }> {
  const instanceId = config.instance_id;
  const token = config.token;

  if (!instanceId || !token) {
    return { success: false, error: 'Missing Z-API credentials' };
  }

  // Normalizar telefone
  let cleanPhone = phone.replace(/\D/g, '');
  if (cleanPhone.length === 10 || cleanPhone.length === 11) {
    cleanPhone = '55' + cleanPhone;
  }

  try {
    const response = await fetch(`https://api.z-api.io/instances/${instanceId}/token/${token}/send-text`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        phone: cleanPhone,
        message: message
      })
    });

    const data = await response.json();
    
    if (response.ok) {
      return { success: true, data };
    } else {
      return { success: false, error: data.error || 'Z-API error', data };
    }
  } catch (error) {
    return { success: false, error: String(error) };
  }
}

async function sendViaFiqon(config: any, phone: string, message: string): Promise<{ success: boolean; data?: any; error?: string }> {
  const baseUrl = config.base_url;
  const apiKey = config.api_key;

  if (!baseUrl || !apiKey) {
    return { success: false, error: 'Missing FiqOn credentials' };
  }

  // Normalizar telefone
  let cleanPhone = phone.replace(/\D/g, '');
  if (cleanPhone.length === 10 || cleanPhone.length === 11) {
    cleanPhone = '55' + cleanPhone;
  }

  try {
    const response = await fetch(`${baseUrl}/messages/send`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        to: cleanPhone,
        text: message
      })
    });

    const data = await response.json();
    
    if (response.ok) {
      return { success: true, data };
    } else {
      return { success: false, error: data.error || 'FiqOn error', data };
    }
  } catch (error) {
    return { success: false, error: String(error) };
  }
}
