const serve = Deno.serve;
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
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
    const { to_phone, message, type = 'text', provider = 'zapi', lead_id, file_name, instance_id, message_id } = await req.json();

    // delete/edit exigem message_id
    if ((type === 'delete' || type === 'edit') && !message_id) {
      return new Response(JSON.stringify({ error: `Missing message_id for ${type}` }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // delete também precisa do telefone para query param da Z-API
    if (!to_phone) {
      return new Response(JSON.stringify({ error: 'Missing to_phone' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // tipos diferentes de delete/block precisam de message
    if (type !== 'delete' && type !== 'block' && type !== 'unblock' && !message) {
      return new Response(JSON.stringify({ error: 'Missing message' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    console.log(`[Send Message] Provider: ${provider}, Phone: ${to_phone}, Type: ${type}`);

    let config: any = null;

    // NOVA LÓGICA: Primeiro buscar na tabela de múltiplas instâncias
    if (provider === 'zapi') {
      let query = supabase
        .from('zapi_instances')
        .select('*')
        .eq('is_active', true);

      if (instance_id) {
        query = query.eq('instance_id', instance_id);
      } else {
        query = query.eq('is_default', true);
      }

      const { data: instance } = await query.maybeSingle();

      if (instance) {
        config = {
          is_active: true,
          config_json: {
            instance_id: instance.instance_id,
            token: instance.token,
            client_token: instance.client_token,
          },
          name: instance.name
        };
        console.log(`[Send Message] Using instance: ${instance.name}`);
      }
    }

    // Fallback para config legado
    if (!config) {
      const { data: legacyConfig } = await supabase
        .from('integrations_config')
        .select('*')
        .eq('provider', provider)
        .single();
      config = legacyConfig;
    }

    if (!config?.is_active) {
      return new Response(JSON.stringify({ error: `${provider} integration not active` }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    let result: { success: boolean; data?: any; error?: string; messageId?: string };
    let success = false;

    if (provider === 'zapi') {
      result = await sendViaZapi(config.config_json, to_phone, message || '', type, file_name, message_id);
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
      endpoint: type === 'delete' ? 'delete-message' : type === 'edit' ? 'edit-message' : type === 'block' ? 'block-contact' : type === 'unblock' ? 'unblock-contact' : 'send-message',
      payload_json: { to_phone, message: (message || '').substring(0, 100), type, message_id },
      response_json: result.data,
      status: success ? 'ok' : 'error',
      error_message: success ? null : result.error,
      lead_id,
      duration_ms: Date.now() - startTime
    });

    // IMPORTANTE: NÃO salvar mensagem aqui - quem chama zapi-send já salva
    // Isso evita duplicação de mensagens. O salvamento é responsabilidade do chamador:
    // - ChatInbox salva após enviar
    // - isa-auto-process salva após enviar resposta da Isa
    
    // Apenas atualizar ultima_interacao do subscriber se houver lead
    if (success && lead_id) {
      const phoneClean = to_phone.replace(/\D/g, '');
      const normalizedPhone = phoneClean.startsWith('55') ? phoneClean : '55' + phoneClean;
      
      await supabase
        .from('manychat_subscribers')
        .update({ ultima_interacao: new Date().toISOString() })
        .or(`telefone.ilike.%${phoneClean.slice(-9)}%,subscriber_id.eq.zapi_${normalizedPhone}`)
        .eq('lead_id', lead_id);
    }

    return new Response(JSON.stringify({ 
      success,
      data: result.data,
      error: result.error,
      messageId: result.messageId
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

async function sendViaZapi(
  config: any, 
  phone: string, 
  message: string, 
  type: string = 'text',
  fileName?: string,
  messageId?: string
): Promise<{ success: boolean; data?: any; error?: string; messageId?: string }> {
  const instanceId = config.instance_id;
  const token = config.token;
  const clientToken = config.client_token;

  if (!instanceId || !token) {
    return { success: false, error: 'Missing Z-API credentials' };
  }

  // Normalizar telefone
  let cleanPhone = phone.replace(/\D/g, '');
  if (cleanPhone.length === 10 || cleanPhone.length === 11) {
    cleanPhone = '55' + cleanPhone;
  }

  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (clientToken) {
    headers['Client-Token'] = clientToken;
  }

  const baseUrl = `https://api.z-api.io/instances/${instanceId}/token/${token}`;

  try {
    let endpoint: string;
    let body: Record<string, any>;

    const parseJsonSafe = async (response: Response) => {
      const raw = await response.text();
      if (!raw) return {};
      try {
        return JSON.parse(raw);
      } catch {
        return { raw };
      }
    };

    // Escolher endpoint baseado no tipo de mídia
    switch (type) {
      case 'image':
        endpoint = `${baseUrl}/send-image`;
        body = {
          phone: cleanPhone,
          image: message, // URL da imagem
        };
        break;

      case 'audio':
        endpoint = `${baseUrl}/send-audio`;
        body = {
          phone: cleanPhone,
          audio: message, // URL do áudio
        };
        break;

      case 'video':
        endpoint = `${baseUrl}/send-video`;
        body = {
          phone: cleanPhone,
          video: message, // URL do vídeo
        };
        break;

      case 'document':
        endpoint = `${baseUrl}/send-document/pdf`;
        // Para PDFs, usar endpoint específico
        const isPdf = message.toLowerCase().includes('.pdf');
        if (!isPdf) {
          endpoint = `${baseUrl}/send-document/docx`;
        }

        // Extrair nome do arquivo da URL se não fornecido
        const extractedFileName = fileName || message.split('/').pop()?.split('?')[0] || 'documento.pdf';

        body = {
          phone: cleanPhone,
          document: message, // URL do documento
          fileName: extractedFileName,
        };
        console.log(`[Z-API Send] Sending document: ${extractedFileName}`);
        break;

      case 'delete': {
        if (!messageId) {
          return { success: false, error: 'Missing message_id for delete' };
        }

        const query = new URLSearchParams({
          messageId,
          phone: cleanPhone,
          owner: 'true',
        });
        endpoint = `${baseUrl}/messages?${query.toString()}`;
        console.log(`[Z-API Send] Deleting message: ${messageId}, phone: ${cleanPhone}`);

        const deleteResponse = await fetch(endpoint, {
          method: 'DELETE',
          headers,
          signal: AbortSignal.timeout(10_000),
        });
        const deleteData = await parseJsonSafe(deleteResponse);
        console.log('[Z-API Send] Delete Response:', JSON.stringify(deleteData).substring(0, 300));

        if (deleteResponse.ok && !deleteData.error) {
          return { success: true, data: deleteData };
        }
        return {
          success: false,
          error: deleteData.error || deleteData.message || 'Z-API delete error',
          data: deleteData,
        };
      }

      case 'edit': {
        if (!messageId) {
          return { success: false, error: 'Missing message_id for edit' };
        }

        endpoint = `${baseUrl}/send-text`;
        const editBody = {
          phone: cleanPhone,
          message,
          editMessageId: messageId,
        };

        console.log(`[Z-API Send] Editing message: ${messageId}, phone: ${cleanPhone}`);
        const editResponse = await fetch(endpoint, {
          method: 'POST',
          headers,
          body: JSON.stringify(editBody),
          signal: AbortSignal.timeout(10_000),
        });
        const editData = await parseJsonSafe(editResponse);
        console.log('[Z-API Send] Edit Response:', JSON.stringify(editData).substring(0, 300));

        if (editResponse.ok && !editData.error) {
          return { success: true, data: editData };
        }
        return {
          success: false,
          error: editData.error || editData.message || 'Z-API edit error',
          data: editData,
        };
      }

      case 'block':
      case 'unblock': {
        endpoint = `${baseUrl}/contacts/modify-blocked`;
        const blockBody = {
          phone: cleanPhone,
          action: type, // "block" or "unblock"
        };

        console.log(`[Z-API Send] ${type} contact: ${cleanPhone}`);
        const blockResponse = await fetch(endpoint, {
          method: 'POST',
          headers,
          body: JSON.stringify(blockBody),
          signal: AbortSignal.timeout(10_000),
        });
        const blockData = await parseJsonSafe(blockResponse);
        console.log(`[Z-API Send] ${type} Response:`, JSON.stringify(blockData).substring(0, 300));

        if (blockResponse.ok && !blockData.error) {
          return { success: true, data: blockData };
        }
        return {
          success: false,
          error: blockData.error || blockData.message || `Z-API ${type} error`,
          data: blockData,
        };
      }

      default:
        // Texto simples
        endpoint = `${baseUrl}/send-text`;
        body = {
          phone: cleanPhone,
          message: message
        };
    }

    console.log(`[Z-API Send] Endpoint: ${endpoint}, Type: ${type}, Phone: ${cleanPhone}`);

    const response = await fetch(endpoint, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(10_000),
    });

    const data = await parseJsonSafe(response);
    console.log('[Z-API Send] Response:', JSON.stringify(data).substring(0, 300));
    
    if (response.ok && !data.error) {
      return { 
        success: true, 
        data,
        messageId: data.messageId || data.id
      };
    } else {
      return { 
        success: false, 
        error: data.error || data.message || 'Z-API error', 
        data 
      };
    }
  } catch (error) {
    console.error('[Z-API Send] Exception:', error);
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
      }),
      signal: AbortSignal.timeout(10_000),
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
