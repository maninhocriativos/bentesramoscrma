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
 * Sempre garante o 9º dígito para celulares (evita duplicatas 8-dig vs 9-dig)
 */
export function normalizePhone(phone: string): string {
  // Remove caracteres não numéricos
  let cleaned = phone.replace(/\D/g, '');
  
  // Adiciona código do Brasil se não tiver
  if (cleaned.length === 10 || cleaned.length === 11) {
    cleaned = '55' + cleaned;
  }
  
  // Garantir 9º dígito para celulares brasileiros
  // Formato esperado: 55 + DDD(2) + 9 + 8dígitos = 13 dígitos
  // Se temos 12 dígitos (55 + DDD + 8dígitos), o celular está sem o 9
  if (cleaned.length === 12 && cleaned.startsWith('55')) {
    const ddd = cleaned.substring(2, 4);
    const localNumber = cleaned.substring(4);
    // Celulares começam com dígitos 6-9; fixos começam com 2-5
    if (localNumber.length === 8 && /^[6-9]/.test(localNumber)) {
      cleaned = `55${ddd}9${localNumber}`;
    }
  }
  
  return cleaned;
}

/**
 * Busca todas as instâncias Z-API ativas
 */
export async function getAllZapiInstances(supabase: any): Promise<(ZapiConfig & { id: string })[]> {
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
    id: inst.id,
    instance_id: inst.instance_id,
    token: inst.token,
    client_token: inst.client_token,
    webhook_secret: inst.webhook_secret,
    name: inst.name,
    phone_number: inst.phone_number
  }));
}

/**
 * Identifica qual instância Z-API recebeu a mensagem
 * PRIORIDADE: connectedPhone > phone_number > instance_id
 * O connectedPhone é o número que realmente recebeu a mensagem
 */
export async function identificarInstanciaOrigem(
  supabase: any, 
  body: any
): Promise<{ instanceId: string; instanceName: string; config: ZapiConfig } | null> {
  // PRIORIDADE 1: connectedPhone (número que RECEBEU a mensagem - mais confiável)
  const connectedPhone = body.connectedPhone;
  
  // PRIORIDADE 2: Campos alternativos de telefone destino
  const toPhone = body.to || body.phone_to || body.destination;
  
  // PRIORIDADE 3: instance_id do payload (menos confiável - pode estar desatualizado)
  const payloadInstanceId = body.instance_id || body.instanceId;
  
  // Buscar todas as instâncias ativas
  const instances = await getAllZapiInstances(supabase);
  
  if (instances.length === 0) {
    console.log('[Z-API Helper] ⚠️ Nenhuma instância ativa encontrada');
    return null;
  }
  
  // MATCH 1: Por connectedPhone (número real que recebeu)
  if (connectedPhone) {
    const cleanConnected = connectedPhone.replace(/\D/g, '');
    const matched = instances.find(i => {
      if (!i.phone_number) return false;
      const cleanInstance = i.phone_number.replace(/\D/g, '');
      
      // Match exato
      if (cleanInstance === cleanConnected) return true;
      
      // Match por últimos 8-11 dígitos (ignora código país e nono dígito)
      const last8Connected = cleanConnected.slice(-8);
      const last8Instance = cleanInstance.slice(-8);
      if (last8Connected === last8Instance) return true;
      
      // Match parcial mais flexível
      if (cleanConnected.endsWith(cleanInstance.slice(-9)) ||
          cleanInstance.endsWith(cleanConnected.slice(-9))) return true;
      
      return false;
    });
    if (matched) {
      console.log(`[Z-API Helper] ✅ Instância identificada por connectedPhone: ${matched.name} (${connectedPhone})`);
      return { instanceId: matched.id, instanceName: matched.name || 'Default', config: matched };
    }
    console.log(`[Z-API Helper] ⚠️ connectedPhone ${connectedPhone} não encontrado nas instâncias cadastradas. Instâncias: ${instances.map(i => i.phone_number).join(', ')}`);
  }
  
  // MATCH 2: Por telefone destino alternativo
  if (toPhone) {
    const cleanTo = normalizePhone(toPhone);
    const matched = instances.find(i => {
      if (!i.phone_number) return false;
      const cleanInstance = normalizePhone(i.phone_number);
      return cleanInstance === cleanTo || 
             cleanTo.endsWith(cleanInstance.slice(-11)) ||
             cleanInstance.endsWith(cleanTo.slice(-11));
    });
    if (matched) {
      console.log(`[Z-API Helper] ✅ Instância identificada por toPhone: ${matched.name}`);
      return { instanceId: matched.id, instanceName: matched.name || 'Default', config: matched };
    }
  }
  
  // MATCH 3: Por instance_id (menos confiável - fallback)
  if (payloadInstanceId) {
    const matched = instances.find(i => i.instance_id === payloadInstanceId);
    if (matched) {
      console.log(`[Z-API Helper] ⚠️ Instância identificada por instance_id (fallback): ${matched.name}`);
      return { instanceId: matched.id, instanceName: matched.name || 'Default', config: matched };
    }
  }
  
  // FALLBACK: retornar a instância padrão
  const defaultInstance = instances[0];
  console.log(`[Z-API Helper] ⚠️ Usando instância padrão (fallback): ${defaultInstance.name}`);
  return { 
    instanceId: defaultInstance.id, 
    instanceName: defaultInstance.name || 'Default', 
    config: defaultInstance 
  };
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
    .select('id, nome, telefone, linha_whatsapp, tipo_origem')
    .eq('id', leadId)
    .single();

  if (error || !lead?.telefone) {
    return { 
      success: false, 
      error: 'Lead não encontrado ou sem telefone',
      provider: 'zapi' 
    };
  }

  // Resolver instância correta baseado na origem do lead
  const instanceId = await resolveInstanceForLead(supabase, lead);

  return await enviarMensagemZapi(supabase, lead.telefone, message, {
    leadId: lead.id,
    subscriberNome: lead.nome || 'Cliente',
    context,
    instanceId
  });
}

/**
 * Resolve a instância Z-API correta para enviar mensagem a um lead.
 * REGRA ESTRITA:
 * - Clientes Bentes Ramos (559291604348) → responder APENAS pela instância Bentes Ramos
 * - Clientes de Tráfego (559285888190) → responder APENAS pela instância Tráfego
 */
export async function resolveInstanceForLead(
  supabase: any,
  lead: { linha_whatsapp?: string | null; tipo_origem?: string | null; id?: string }
): Promise<string | undefined> {
  const linhaWhatsapp = lead.linha_whatsapp || 'indefinido';
  const tipoOrigem = lead.tipo_origem || 'indefinido';

  // Determinar se é tráfego
  const isTrafego = linhaWhatsapp === 'trafego' || linhaWhatsapp === 'trafego_isa' ||
                    tipoOrigem === 'trafego' || tipoOrigem === 'trafego_isa';

  // Buscar todas as instâncias ativas
  const { data: instances } = await supabase
    .from('zapi_instances')
    .select('instance_id, is_default, name')
    .eq('is_active', true)
    .order('is_default', { ascending: false });

  if (!instances || instances.length === 0) return undefined;

  let target;
  if (isTrafego) {
    // Tráfego → instância NÃO default (Bentes Ramos-2)
    target = instances.find((i: any) => !i.is_default) || instances[0];
  } else {
    // Bentes Ramos / orgânico → instância default (Bentes Ramos)
    target = instances.find((i: any) => i.is_default) || instances[0];
  }

  console.log(`[Z-API Helper] 📱 Roteamento: linha=${linhaWhatsapp}, tipo=${tipoOrigem}, isTrafego=${isTrafego} → ${target.name}`);
  return target.instance_id;
}

/**
 * Envia vídeo via Z-API
 */
export async function sendVideo(
  config: ZapiConfig,
  phone: string,
  videoUrl: string,
  caption?: string
): Promise<ZapiSendResult> {
  const cleanPhone = normalizePhone(phone);
  try {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (config.client_token) headers['Client-Token'] = config.client_token;
    const response = await fetch(
      `https://api.z-api.io/instances/${config.instance_id}/token/${config.token}/send-video`,
      { method: 'POST', headers, body: JSON.stringify({ phone: cleanPhone, video: videoUrl, caption: caption || '' }) }
    );
    const data = await response.json();
    if (response.ok && !data.error) return { success: true, messageId: data.messageId, provider: 'zapi' };
    return { success: false, error: data.error || 'Erro ao enviar vídeo', provider: 'zapi' };
  } catch (error: any) {
    return { success: false, error: error.message, provider: 'zapi' };
  }
}

/**
 * Envia mensagem com lista de botões via Z-API
 */
export async function sendButtonList(
  config: ZapiConfig,
  phone: string,
  message: string,
  buttons: { id: string; label: string }[]
): Promise<ZapiSendResult> {
  const cleanPhone = normalizePhone(phone);
  try {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (config.client_token) headers['Client-Token'] = config.client_token;
    const response = await fetch(
      `https://api.z-api.io/instances/${config.instance_id}/token/${config.token}/send-button-list`,
      {
        method: 'POST', headers,
        body: JSON.stringify({ phone: cleanPhone, message, buttonList: { buttons } }),
      }
    );
    const data = await response.json();
    if (response.ok && !data.error) return { success: true, messageId: data.messageId, provider: 'zapi' };
    // Fallback: send as plain text if buttons not supported
    console.warn('[Z-API Helper] Button list failed, sending as text');
    return await sendText(config, phone, message + '\n\n1️⃣ Sim, autorizo\n2️⃣ Não, obrigado');
  } catch (error: any) {
    return { success: false, error: error.message, provider: 'zapi' };
  }
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
