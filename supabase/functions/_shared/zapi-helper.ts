/**
 * Z-API Helper - Utilitário centralizado para envio de mensagens WhatsApp via Z-API
 * SUPORTA MÚLTIPLAS INSTÂNCIAS
 */

import { createClient } from "npm:@supabase/supabase-js@2";

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

export interface ZapiConfig {
  instance_id: string;
  token: string;
  client_token?: string;
  webhook_secret?: string;
  name?: string;
  phone_number?: string;
}

export interface ZapiSendResult {
  success: boolean;
  messageId?: string;
  error?: string;
  provider: 'zapi';
  instance_name?: string;
}

/**
 * Normaliza número de telefone para formato internacional brasileiro
 */
export function normalizePhone(phone: string): string {
  // Remove caracteres não numéricos
  let cleaned = phone.replace(/\D/g, '');
  
  // Adiciona código do Brasil se não tiver
  if (cleaned.length === 10 || cleaned.length === 11) {
    cleaned = '55' + cleaned;
  }
  
  return cleaned;
}

/**
 * Busca todas as instâncias Z-API ativas
 */
export async function getAllZapiInstances(supabase: any): Promise<ZapiConfig[]> {
  const { data: instances } = await supabase
    .from('zapi_instances')
    .select('*')
    .eq('is_active', true)
    .order('is_default', { ascending: false });

  if (!instances || instances.length === 0) {
    console.log('[Z-API Helper] Nenhuma instância Z-API ativa');
    return [];
  }

  return instances.map((inst: any) => ({
    instance_id: inst.instance_id,
    token: inst.token,
    client_token: inst.client_token,
    webhook_secret: inst.webhook_secret,
    name: inst.name,
    phone_number: inst.phone_number
  }));
}

/**
 * Busca configuração Z-API do banco de dados (instância padrão ou específica)
 */
export async function getZapiConfig(supabase: any, instanceId?: string): Promise<ZapiConfig | null> {
  let query = supabase
    .from('zapi_instances')
    .select('*')
    .eq('is_active', true);

  if (instanceId) {
    query = query.eq('instance_id', instanceId);
  } else {
    query = query.eq('is_default', true);
  }

  const { data: instance } = await query.maybeSingle();

  // Fallback: se não encontrou na nova tabela, tentar legado
  if (!instance) {
    console.log('[Z-API Helper] Buscando config legado...');
    const { data: config } = await supabase
      .from('integrations_config')
      .select('*')
      .eq('provider', 'zapi')
      .single();

    if (!config?.is_active) {
      console.log('[Z-API Helper] Integração não ativa');
      return null;
    }

    const legacyInstanceId = config.config_json?.instance_id;
    const token = config.config_json?.token;
    const clientToken = config.config_json?.client_token;

    if (!legacyInstanceId || !token) {
      console.log('[Z-API Helper] Credenciais faltando');
      return null;
    }

    return {
      instance_id: legacyInstanceId,
      token: token,
      client_token: clientToken,
      webhook_secret: config.config_json?.webhook_secret,
      name: 'Legado'
    };
  }

  return {
    instance_id: instance.instance_id,
    token: instance.token,
    client_token: instance.client_token,
    webhook_secret: instance.webhook_secret,
    name: instance.name,
    phone_number: instance.phone_number
  };
}

/**
 * Envia mensagem de texto via Z-API
 */
export async function sendText(
  config: ZapiConfig,
  phone: string,
  message: string
): Promise<ZapiSendResult> {
  const cleanPhone = normalizePhone(phone);
  
  try {
    console.log(`[Z-API Helper] Enviando texto para ${cleanPhone} via ${config.name || 'default'}`);
    
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (config.client_token) {
      headers['Client-Token'] = config.client_token;
    }
    
    const response = await fetch(
      `https://api.z-api.io/instances/${config.instance_id}/token/${config.token}/send-text`,
      {
        method: 'POST',
        headers,
        body: JSON.stringify({ phone: cleanPhone, message })
      }
    );

    const data = await response.json();
    
    if (response.ok && !data.error) {
      return { 
        success: true, 
        messageId: data.messageId || data.id,
        provider: 'zapi',
        instance_name: config.name
      };
    }
    
    console.log('[Z-API Helper] Erro:', data);
    return { 
      success: false, 
      error: data.error || data.message || 'Erro desconhecido',
      provider: 'zapi' 
    };
  } catch (error: any) {
    console.error('[Z-API Helper] Exceção:', error);
    return { 
      success: false, 
      error: error.message,
      provider: 'zapi' 
    };
  }
}

/**
 * Envia imagem via Z-API
 */
export async function sendImage(
  config: ZapiConfig,
  phone: string,
  imageUrl: string,
  caption?: string
): Promise<ZapiSendResult> {
  const cleanPhone = normalizePhone(phone);
  
  try {
    console.log(`[Z-API Helper] Enviando imagem para ${cleanPhone}`);
    
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (config.client_token) {
      headers['Client-Token'] = config.client_token;
    }
    
    const response = await fetch(
      `https://api.z-api.io/instances/${config.instance_id}/token/${config.token}/send-image`,
      {
        method: 'POST',
        headers,
        body: JSON.stringify({ 
          phone: cleanPhone, 
          image: imageUrl,
          caption: caption || ''
        })
      }
    );

    const data = await response.json();
    
    if (response.ok && !data.error) {
      return { success: true, messageId: data.messageId, provider: 'zapi' };
    }
    
    return { success: false, error: data.error || 'Erro ao enviar imagem', provider: 'zapi' };
  } catch (error: any) {
    return { success: false, error: error.message, provider: 'zapi' };
  }
}

/**
 * Envia documento via Z-API
 */
export async function sendDocument(
  config: ZapiConfig,
  phone: string,
  documentUrl: string,
  fileName: string
): Promise<ZapiSendResult> {
  const cleanPhone = normalizePhone(phone);
  
  try {
    console.log(`[Z-API Helper] Enviando documento para ${cleanPhone}`);
    
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (config.client_token) {
      headers['Client-Token'] = config.client_token;
    }
    
    const response = await fetch(
      `https://api.z-api.io/instances/${config.instance_id}/token/${config.token}/send-document`,
      {
        method: 'POST',
        headers,
        body: JSON.stringify({ 
          phone: cleanPhone, 
          document: documentUrl,
          fileName
        })
      }
    );

    const data = await response.json();
    
    if (response.ok && !data.error) {
      return { success: true, messageId: data.messageId, provider: 'zapi' };
    }
    
    return { success: false, error: data.error || 'Erro ao enviar documento', provider: 'zapi' };
  } catch (error: any) {
    return { success: false, error: error.message, provider: 'zapi' };
  }
}

/**
 * Envia áudio via Z-API
 */
export async function sendAudio(
  config: ZapiConfig,
  phone: string,
  audioUrl: string
): Promise<ZapiSendResult> {
  const cleanPhone = normalizePhone(phone);
  
  try {
    console.log(`[Z-API Helper] Enviando áudio para ${cleanPhone}`);
    
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (config.client_token) {
      headers['Client-Token'] = config.client_token;
    }
    
    const response = await fetch(
      `https://api.z-api.io/instances/${config.instance_id}/token/${config.token}/send-audio`,
      {
        method: 'POST',
        headers,
        body: JSON.stringify({ 
          phone: cleanPhone, 
          audio: audioUrl
        })
      }
    );

    const data = await response.json();
    
    if (response.ok && !data.error) {
      return { success: true, messageId: data.messageId, provider: 'zapi' };
    }
    
    return { success: false, error: data.error || 'Erro ao enviar áudio', provider: 'zapi' };
  } catch (error: any) {
    return { success: false, error: error.message, provider: 'zapi' };
  }
}

/**
 * Função principal: envia mensagem e registra no banco
 * Substitui completamente a integração ManyChat
 */
export async function enviarMensagemZapi(
  supabase: any,
  phone: string,
  message: string,
  options?: {
    leadId?: string;
    subscriberNome?: string;
    context?: string;
    tipo?: 'text' | 'image' | 'audio' | 'document';
    instanceId?: string; // Permite especificar instância
  }
): Promise<ZapiSendResult> {
  const config = await getZapiConfig(supabase, options?.instanceId);
  
  if (!config) {
    return { 
      success: false, 
      error: 'Z-API não configurado ou inativo',
      provider: 'zapi' 
    };
  }

  const result = await sendText(config, phone, message);
  const cleanPhone = normalizePhone(phone);
  
  // Registrar mensagem no banco
  if (result.success && options?.leadId) {
    try {
      await supabase.from('manychat_mensagens').insert({
        subscriber_id: `zapi_${cleanPhone}`,
        subscriber_nome: options.subscriberNome || 'Sistema',
        lead_id: options.leadId,
        conteudo: message,
        direcao: 'saida',
        tipo: options.tipo || 'text',
        canal: 'whatsapp',
        metadata: { 
          source: 'zapi', 
          context: options.context || 'automation',
          message_id: result.messageId,
          instance_name: config.name
        }
      });
    } catch (err) {
      console.error('[Z-API Helper] Erro ao salvar mensagem:', err);
    }
  }

  // Log de integração
  await supabase.from('integration_logs').insert({
    provider: 'zapi',
    direction: 'outbound',
    endpoint: 'send-text',
    payload_json: { phone: cleanPhone, message: message.substring(0, 100), instance: config.name },
    response_json: result,
    status: result.success ? 'ok' : 'error',
    error_message: result.error,
    lead_id: options?.leadId,
    duration_ms: 0
  });

  return result;
}

/**
 * Busca telefone do lead e envia mensagem
 */
export async function enviarParaLead(
  supabase: any,
  leadId: string,
  message: string,
  context?: string
): Promise<ZapiSendResult> {
  // Buscar dados do lead
  const { data: lead, error } = await supabase
    .from('leads_juridicos')
    .select('id, nome, telefone')
    .eq('id', leadId)
    .single();

  if (error || !lead?.telefone) {
    return { 
      success: false, 
      error: 'Lead não encontrado ou sem telefone',
      provider: 'zapi' 
    };
  }

  return await enviarMensagemZapi(supabase, lead.telefone, message, {
    leadId: lead.id,
    subscriberNome: lead.nome || 'Cliente',
    context
  });
}

/**
 * Atualiza last_contact_at do lead após envio
 */
export async function atualizarContatoLead(supabase: any, leadId: string): Promise<void> {
  await supabase
    .from('leads_juridicos')
    .update({ last_contact_at: new Date().toISOString() })
    .eq('id', leadId);
}

/**
 * Cria subscriber_id no formato Z-API
 */
export function gerarSubscriberId(phone: string): string {
  return `zapi_${normalizePhone(phone)}`;
}
