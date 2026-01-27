import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { normalizePhone, gerarSubscriberId } from '../_shared/zapi-helper.ts';

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
    
    // IMPORTANTE: Ignorar mensagens de grupos - apenas conversas individuais
    if (normalized.isGroup) {
      console.log('[Z-API Webhook] Ignorando mensagem de grupo');
      return new Response(JSON.stringify({ success: true, skipped: true, reason: 'group_message' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
    
    // Ignorar reações
    if (normalized.messageType === 'reaction' || !normalized.message) {
      console.log('[Z-API Webhook] Ignorando reação ou mensagem vazia');
      return new Response(JSON.stringify({ success: true, skipped: true, reason: 'reaction_or_empty' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
    
    if (!normalized.phone) {
      console.log('[Z-API Webhook] No phone found in payload');
      await logIntegration(supabase, 'zapi', 'inbound', body, null, 'error', 'No phone in payload', null, startTime);
      return new Response(JSON.stringify({ error: 'No phone' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Buscar ou criar lead pelo telefone
    const { leadId, isNewLead } = await findOrCreateLead(supabase, normalized);

    // Atualizar last_contact_at e marcar followup como respondido APENAS em mensagens de entrada
    if (leadId && !normalized.fromMe) {
      await supabase
        .from('leads_juridicos')
        .update({ last_contact_at: new Date().toISOString() })
        .eq('id', leadId);

      // Marcar followup como respondido se existir
      await supabase
        .from('lead_followups')
        .update({ 
          respondido: true, 
          respondido_em: new Date().toISOString(),
          last_inbound_at: new Date().toISOString(),
          waiting_reply: false
        })
        .eq('lead_id', leadId)
        .eq('respondido', false);
    }

    // Gerar subscriber_id único baseado no telefone
    const subscriberId = gerarSubscriberId(normalized.phone!);
    
    // IMPORTANTE: Criar ou atualizar subscriber ANTES de salvar mensagem
    // Isso garante que o chat vai mostrar a conversa
    console.log('[Z-API Webhook] Upserting subscriber:', subscriberId);
    
    const { error: subError } = await supabase
      .from('manychat_subscribers')
      .upsert({
        subscriber_id: subscriberId,
        nome: normalized.name || normalized.phone,
        telefone: normalized.phone,
        canal: 'whatsapp',
        lead_id: leadId,
        ultima_interacao: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }, { 
        onConflict: 'subscriber_id',
        ignoreDuplicates: false 
      });
    
    if (subError) {
      console.error('[Z-API Webhook] Error upserting subscriber:', subError);
    }

    // Salvar mensagem - com prevenção de duplicatas por message_id
    if (normalized.message && leadId) {
      console.log('[Z-API Webhook] Saving message for subscriber:', subscriberId, 'messageId:', normalized.messageId, 'fromMe:', normalized.fromMe);

      const direcao = normalized.fromMe ? 'saida' : 'entrada';

      // Conteúdo salvo: para mídia, priorizar URL (para renderizar no chat)
      const conteudoToSave =
        (normalized.messageType === 'audio' || normalized.messageType === 'image' || normalized.messageType === 'video' || normalized.messageType === 'document')
          ? (normalized.mediaUrl || normalized.message)
          : normalized.message;
      
      // IMPORTANTE: Verificar se mensagem já existe pelo message_id para evitar duplicatas
      if (normalized.messageId) {
        const { data: existingMsg } = await supabase
          .from('manychat_mensagens')
          .select('id')
          .eq('metadata->>message_id', normalized.messageId)
          .maybeSingle();
        
        if (existingMsg) {
          console.log('[Z-API Webhook] Message already exists, skipping:', normalized.messageId);
          // Ainda precisamos chamar a Isa, então continuamos
        } else {
          // Salvar nova mensagem
          const { data: savedMsg, error: msgError } = await supabase.from('manychat_mensagens').insert({
            subscriber_id: subscriberId,
            subscriber_nome: normalized.name || normalized.phone,
            conteudo: conteudoToSave,
            canal: 'whatsapp',
            tipo: normalized.messageType || 'text',
            direcao,
            lead_id: leadId,
            metadata: { 
              source: 'zapi', 
              original: body,
              message_id: normalized.messageId,
              media_url: normalized.mediaUrl,
              caption: normalized.caption,
              file_name: normalized.fileName,
              from_me: normalized.fromMe === true
            }
          }).select().single();

          if (msgError) {
            console.error('[Z-API Webhook] Error saving message:', msgError);
          } else {
            console.log('[Z-API Webhook] Message saved:', savedMsg?.id);
          }

          // Registrar interação apenas para entrada (cliente)
          if (!normalized.fromMe) {
            await supabase.from('interacoes').insert({
              cliente_id: leadId,
              tipo: 'WhatsApp',
              direcao: 'Entrada',
              resumo: normalized.messageType === 'text' 
                ? normalized.message.substring(0, 100) 
                : `[${normalized.messageType}]`,
              detalhes: normalized.message
            });
          }
        }
      } else {
        // Sem message_id, salvar normalmente (fallback)
        const { data: savedMsg, error: msgError } = await supabase.from('manychat_mensagens').insert({
          subscriber_id: subscriberId,
          subscriber_nome: normalized.name || normalized.phone,
          conteudo: conteudoToSave,
          canal: 'whatsapp',
          tipo: normalized.messageType || 'text',
          direcao,
          lead_id: leadId,
          metadata: { 
            source: 'zapi', 
            original: body,
            message_id: null,
            media_url: normalized.mediaUrl,
            caption: normalized.caption,
            file_name: normalized.fileName,
            from_me: normalized.fromMe === true
          }
        }).select().single();

        if (msgError) {
          console.error('[Z-API Webhook] Error saving message:', msgError);
        } else {
          console.log('[Z-API Webhook] Message saved:', savedMsg?.id);
        }

        // Registrar interação apenas para entrada (cliente)
        if (!normalized.fromMe) {
          await supabase.from('interacoes').insert({
            cliente_id: leadId,
            tipo: 'WhatsApp',
            direcao: 'Entrada',
            resumo: normalized.messageType === 'text' 
              ? normalized.message.substring(0, 100) 
              : `[${normalized.messageType}]`,
            detalhes: normalized.message
          });
        }
      }
    }

    // Se é mensagem, acionar Isa para processar
    if (normalized.message && leadId && !normalized.fromMe) {
      // Buscar estado atual do lead
      const { data: lead } = await supabase
        .from('leads_juridicos')
        .select('lead_state, nome, status')
        .eq('id', leadId)
        .single();

      // Verificar se atendimento humano está ativo
      const { data: subscriber } = await supabase
        .from('manychat_subscribers')
        .select('atendimento_humano')
        .eq('lead_id', leadId)
        .maybeSingle();

      // Só aciona Isa se não tiver atendimento humano ativo
      if (lead && !subscriber?.atendimento_humano) {
        try {
          console.log(`[Z-API Webhook] Calling isa-auto-process for lead ${leadId}`);
          
          // Determinar a URL de mídia para transcrição/análise
          const mediaUrlToProcess = normalized.mediaUrl || 
            normalized.media?.audioUrl || 
            normalized.media?.imageUrl || 
            normalized.media?.link ||
            normalized.media?.url;
          
          // Para áudio/imagem, enviar a URL para processamento
          const mensagemParaProcessar = (normalized.messageType === 'audio' || normalized.messageType === 'image') && mediaUrlToProcess
            ? mediaUrlToProcess  // Enviar URL para transcrição/análise
            : normalized.message;
          
          console.log(`[Z-API Webhook] Tipo: ${normalized.messageType}, mediaUrl: ${mediaUrlToProcess ? 'presente' : 'ausente'}`);
          
          const { data: isaResponse, error: isaError } = await supabase.functions.invoke('isa-auto-process', {
            body: {
              lead_id: leadId,
              mensagem: mensagemParaProcessar,
              lead_state: lead.lead_state || 'NEW',
              canal: 'zapi',
              subscriber_id: gerarSubscriberId(normalized.phone),
              subscriber_nome: normalized.name || lead.nome || normalized.phone,
              tipo_mensagem: normalized.messageType,
              media_url: mediaUrlToProcess
            }
          });

          if (!isaError && isaResponse?.response) {
            // Enviar resposta via Z-API
            await sendZapiMessage(
              supabase, 
              zapiConfig.config_json, 
              normalized.phone, 
              isaResponse.response,
              leadId,
              normalized.name || lead.nome
            );
            
            console.log(`[Z-API Webhook] Isa response sent to ${normalized.phone}`);
          } else if (isaError) {
            console.error('[Z-API Webhook] Isa error:', isaError);
          }
        } catch (isaErr) {
          console.error('[Z-API Webhook] Error calling Isa:', isaErr);
        }
      } else if (subscriber?.atendimento_humano) {
        console.log(`[Z-API Webhook] Human attendance active for lead ${leadId}, skipping Isa`);
      }
    }

    // Log sucesso
    await logIntegration(supabase, 'zapi', 'inbound', body, { 
      lead_id: leadId, 
      is_new_lead: isNewLead,
      normalized 
    }, 'ok', null, leadId, startTime);

    return new Response(JSON.stringify({ 
      success: true, 
      lead_id: leadId,
      is_new_lead: isNewLead
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
  isGroup: boolean;
  mediaUrl: string | null;
  caption: string | null;
  fileName: string | null;
  fromMe: boolean;
} {
  // Z-API pode enviar diferentes formatos
  const rawPhone = body.phone || body.from || body.sender?.phone || body.chatId?.replace('@c.us', '');
  const name = body.senderName || body.sender?.name || body.pushName;

  // Alguns payloads sinalizam que a mensagem foi enviada por nós (eco de saída)
  const fromMe =
    body.fromMe === true ||
    body.fromMe === 'true' ||
    body?.message?.fromMe === true ||
    body?.sender?.isMe === true ||
    body?.self === true ||
    body?.isMe === true;
  
  // IMPORTANTE: Detectar se é grupo (formato: 559292304411-1521765965 ou contém "-")
  const isGroup = body.isGroup === true || (rawPhone && rawPhone.includes('-'));
  
  // Para grupos, usar participantPhone (quem enviou) em vez do ID do grupo
  let phone = rawPhone;
  if (isGroup && body.participantPhone) {
    phone = body.participantPhone;
  }
  
  let message = null;
  let messageType = 'text';
  let media = null;
  let mediaUrl: string | null = null;
  let caption: string | null = null;
  let fileName: string | null = null;

  // Extrair texto - Z-API pode enviar em diversos formatos:
  // 1. body.text.message (formato padrão)
  // 2. body.text (string simples)
  // 3. body.message.text
  // 4. body.message (string simples)
  // 5. body.body (alternativo)
  if (body.text?.message) {
    message = body.text.message;
  } else if (typeof body.text === 'string' && body.text) {
    message = body.text;
  } else if (body.message?.text) {
    message = body.message.text;
  } else if (typeof body.message === 'string' && body.message) {
    message = body.message;
  } else if (typeof body.body === 'string' && body.body) {
    message = body.body;
  } else if (body.audio) {
    // Extrair URL do áudio para transcrição
    mediaUrl = body.audio.audioUrl || body.audio.link || body.audio.url;
    message = mediaUrl || '[Áudio recebido]';
    messageType = 'audio';
    media = body.audio;
  } else if (body.image) {
    // Extrair URL da imagem para análise
    mediaUrl = body.image.imageUrl || body.image.link || body.image.url;
    caption = body.image.caption || null;
    message = caption || mediaUrl || '[Imagem recebida]';
    messageType = 'image';
    media = body.image;
  } else if (body.document) {
    mediaUrl = body.document.documentUrl || body.document.link || body.document.url;
    fileName = body.document.fileName || null;
    message = fileName || mediaUrl || '[Documento recebido]';
    messageType = 'document';
    media = body.document;
  } else if (body.video) {
    mediaUrl = body.video.videoUrl || body.video.link || body.video.url;
    message = '[Vídeo recebido]';
    messageType = 'video';
    media = body.video;
  } else if (body.sticker) {
    message = '[Sticker]';
    messageType = 'sticker';
    media = body.sticker;
  } else if (body.location) {
    message = `[Localização: ${body.location.latitude}, ${body.location.longitude}]`;
    messageType = 'location';
    media = body.location;
  } else if (body.reaction) {
    // Reações - ignorar
    message = null;
    messageType = 'reaction';
  }

  console.log('[Z-API Normalize] Extracted:', { 
    message: message ? message.substring(0, 50) : 'null', 
    type: messageType,
    isGroup,
    mediaUrl: mediaUrl ? 'presente' : 'ausente',
    rawPhone,
    phone
  });

  return {
    phone: phone ? normalizePhone(phone) : null,
    name,
    message,
    messageId: body.messageId || body.id || body.zapiMessageId,
    messageType,
    timestamp: body.timestamp ? new Date(body.timestamp * 1000).toISOString() : new Date().toISOString(),
    media,
    isGroup,
    mediaUrl,
    caption,
    fileName,
    fromMe,
  };
}

async function findOrCreateLead(
  supabase: any, 
  data: { phone: string | null; name: string | null }
): Promise<{ leadId: string | null; isNewLead: boolean }> {
  if (!data.phone) return { leadId: null, isNewLead: false };

  const phoneSuffix = data.phone.slice(-9);
  
  // Buscar lead existente
  const { data: existingLead } = await supabase
    .from('leads_juridicos')
    .select('id')
    .ilike('telefone', `%${phoneSuffix}%`)
    .limit(1)
    .maybeSingle();

  if (existingLead) {
    return { leadId: existingLead.id, isNewLead: false };
  }

  // Criar novo lead
  // Detectar fonte de tráfego baseado no nome/contexto
  let fonteTrafego = 'organico'; // default
  let canalOrigem = 'whatsapp';
  
  // Heurística simples: nomes com certos padrões podem indicar tráfego pago
  // Em produção, isso viria de UTMs ou metadata do anúncio
  const { data: newLead, error } = await supabase
    .from('leads_juridicos')
    .insert({
      nome: data.name || `Contato ${data.phone}`,
      telefone: data.phone,
      status: 'Lead Frio',
      lead_state: 'NEW',
      origem: 'WhatsApp Z-API',
      fonte_trafego: fonteTrafego,
      canal_origem: canalOrigem,
      resumo_ia: `Lead criado automaticamente via Z-API. Primeiro contato em ${new Date().toLocaleDateString('pt-BR')}.`
    })
    .select('id')
    .single();

  if (error) {
    console.error('[Z-API Webhook] Error creating lead:', error);
    return { leadId: null, isNewLead: false };
  }

  // Registrar estado inicial
  await supabase.from('lead_state_history').insert({
    lead_id: newLead.id,
    from_state: null,
    to_state: 'NEW',
    changed_by: 'zapi',
    reason: 'Lead criado via webhook Z-API'
  });

  // Criar registro de followup na NOVA tabela zapi_followups
  const subscriberId = gerarSubscriberId(data.phone);
  const nextFollowupAt = new Date(Date.now() + 10 * 60 * 1000).toISOString(); // 10 min para FAST_1
  
  await supabase.from('zapi_followups').insert({
    lead_id: newLead.id,
    subscriber_id: subscriberId,
    telefone: data.phone,
    status: 'ativo',
    next_followup_at: nextFollowupAt,
    stage_fast: 0,
    stage_slow: 0
  });

  // Também criar na tabela legada para compatibilidade
  await supabase.from('lead_followups').insert({
    lead_id: newLead.id,
    subscriber_id: subscriberId,
    canal: 'whatsapp',
    status: 'aguardando',
    primeiro_contato_em: new Date().toISOString(),
    last_inbound_at: new Date().toISOString(),
    followup_stage_fast: 0,
    followup_stage_slow: 0
  });

  // Registrar evento de criação
  await supabase.from('system_events').insert({
    tipo: 'lead',
    fonte: 'zapi-webhook',
    acao: 'lead_criado',
    lead_id: newLead.id,
    dados: {
      phone: data.phone,
      name: data.name,
      provider: 'zapi',
      fonte_trafego: fonteTrafego,
      canal_origem: canalOrigem
    }
  });

  console.log(`[Z-API Webhook] Created new lead: ${newLead.id} (${fonteTrafego}/${canalOrigem})`);

  return { leadId: newLead.id, isNewLead: true };
}

async function sendZapiMessage(
  supabase: any, 
  config: any, 
  phone: string, 
  message: string,
  leadId?: string,
  leadNome?: string
): Promise<boolean> {
  const instanceId = config.instance_id;
  const token = config.token;

  if (!instanceId || !token) {
    console.log('[Z-API] Missing instance_id or token');
    return false;
  }

  const cleanPhone = normalizePhone(phone);

  try {
    const response = await fetch(`https://api.z-api.io/instances/${instanceId}/token/${token}/send-text`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        phone: cleanPhone,
        message: message
      })
    });

    const result = await response.json();
    
    // Registrar mensagem de saída
    if (response.ok && leadId) {
      await supabase.from('manychat_mensagens').insert({
        subscriber_id: gerarSubscriberId(cleanPhone),
        subscriber_nome: leadNome || 'Isa',
        lead_id: leadId,
        conteudo: message,
        direcao: 'saida',
        tipo: 'text',
        canal: 'whatsapp',
        metadata: { 
          source: 'zapi', 
          context: 'isa_auto_response',
          message_id: result.messageId 
        }
      });
    }

    // Log outbound
    await supabase.from('integration_logs').insert({
      provider: 'zapi',
      direction: 'outbound',
      endpoint: 'send-text',
      payload_json: { phone: cleanPhone, message: message.substring(0, 100) },
      response_json: result,
      status: response.ok ? 'ok' : 'error',
      error_message: response.ok ? null : JSON.stringify(result),
      lead_id: leadId
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
