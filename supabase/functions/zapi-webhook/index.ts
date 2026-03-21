const serve = Deno.serve;
import { createClient } from "npm:@supabase/supabase-js@2";
import { normalizePhone, gerarSubscriberId, identificarInstanciaOrigem, getZapiConfig, sendText } from '../_shared/zapi-helper.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-webhook-secret',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

// ============================================
// DETECÇÃO DE TRÁFEGO PAGO (CTWA - Click to WhatsApp Ads)
// ============================================
interface TrafficSourceResult {
  isTraffic: boolean;
  source: string | null;
  detectionMethod: 'ctwa_metadata' | 'message_content' | 'instance_traffic' | null;
  adData: {
    adContext: any;
    ctwaClid: string | null;
    adId: string | null;
    campaignName: string | null;
  } | null;
}

// Mensagem padrão que vem do anúncio Click to WhatsApp
const TRAFFIC_MESSAGE_PATTERN = 'quero saber se tenho dinheiro a receber';

// ============================================
// INSTÂNCIAS DEDICADAS A TRÁFEGO
// Qualquer mensagem recebida nesses números é automaticamente classificada como tráfego
// ============================================
const TRAFFIC_INSTANCE_PHONES = [
  // Com 9º dígito (padrão)
  '5592985888190',
  '92985888190',
  '985888190',

  // Sem 9º dígito (alguns callbacks da Z-API vêm assim)
  '559285888190',
  '9285888190',
  '85888190',

  // Sufixo “estável” entre as duas variações acima
  '5888190'
];

// ============================================
// INSTÂNCIAS DO ESCRITÓRIO (NÃO SÃO TRÁFEGO)
// Leads que chegam por esses números são do escritório/contato direto
// ============================================
const OFFICE_INSTANCE_PHONES = [
  '5592991604348',
  '92991604348',
  '991604348',
  '91604348'
];

function detectTrafficSource(body: any, messageContent?: string, instancePhone?: string | null): TrafficSourceResult {
  // ============================================
  // MÉTODO -1: VERIFICAR SE É INSTÂNCIA DO ESCRITÓRIO (NUNCA classificar como tráfego)
  // ============================================
  if (instancePhone) {
    const cleanInstancePhone = instancePhone.replace(/\D/g, '');
    const isOfficeInstance = OFFICE_INSTANCE_PHONES.some(phone => 
      cleanInstancePhone === phone || cleanInstancePhone.endsWith(phone)
    );
    
    if (isOfficeInstance) {
      console.log('[Traffic Detection] 📞 Office instance detected - NOT traffic:', {
        instancePhone,
        classifiedAs: 'whatsapp_direto'
      });
      
      return { isTraffic: false, source: null, detectionMethod: null, adData: null };
    }
  }
  // ============================================
  // MÉTODO 0: DETECÇÃO POR INSTÂNCIA DE TRÁFEGO
  // Se a mensagem chegou numa instância dedicada a tráfego, é automaticamente tráfego
  // ============================================
  if (instancePhone) {
    const cleanInstancePhone = instancePhone.replace(/\D/g, '');
    const isTrafficInstance = TRAFFIC_INSTANCE_PHONES.some(phone => 
      cleanInstancePhone === phone || cleanInstancePhone.endsWith(phone)
    );
    
    if (isTrafficInstance) {
      console.log('[Traffic Detection] ✅ DETECTED PAID TRAFFIC via TRAFFIC INSTANCE:', {
        instancePhone,
        source: 'meta_ads'
      });
      
      return {
        isTraffic: true,
        source: 'meta_ads',
        detectionMethod: 'instance_traffic',
        adData: {
          adContext: null,
          ctwaClid: null,
          adId: null,
          campaignName: 'traffic_instance_auto'
        }
      };
    }
  }
  
  // Verificar múltiplos formatos possíveis de metadados de anúncio
  // O WhatsApp/Z-API pode enviar em diferentes campos dependendo do provedor
  const adContext = body.context?.ad || body.referral || body.ad || body.contextInfo?.ad;
  const ctwaClid = body.context?.ctwa_clid || body.ctwa_clid || body.ctwa || 
                   adContext?.ctwa || body.contextInfo?.ctwa_clid;
  
  // Campos adicionais do Meta Click to WhatsApp
  const entryPoint = body.entry_point || body.entryPoint || body.context?.entry_point;
  const sourceUrl = adContext?.source?.url || body.sourceUrl;
  
  console.log('[Traffic Detection] Checking:', {
    hasAdContext: !!adContext,
    hasCtwaClid: !!ctwaClid,
    hasEntryPoint: !!entryPoint,
    hasSourceUrl: !!sourceUrl,
    instancePhone,
    messageContent: messageContent?.substring(0, 50),
    bodyKeys: Object.keys(body).slice(0, 10)
  });
  
  // MÉTODO 1: Detecção por metadados do anúncio (CTWA)
  if (adContext || ctwaClid || entryPoint === 'ctwa') {
    // Detectar plataforma de origem
    let source = 'meta_ads';
    const bodyStr = JSON.stringify(body).toLowerCase();
    
    // Tentar identificar se é Instagram ou Facebook
    if (bodyStr.includes('instagram') || sourceUrl?.includes('instagram')) {
      source = 'instagram_ads';
    } else if (bodyStr.includes('facebook') || bodyStr.includes('fb.me') || sourceUrl?.includes('facebook')) {
      source = 'facebook_ads';
    }
    
    // Extrair dados do anúncio para analytics
    const adId = adContext?.source?.id || adContext?.id || null;
    const campaignName = adContext?.title || adContext?.campaign || null;
    
    console.log('[Traffic Detection] ✅ DETECTED PAID TRAFFIC via CTWA metadata:', {
      source,
      adId,
      campaignName,
      ctwaClid: ctwaClid ? 'present' : 'absent'
    });
    
    return {
      isTraffic: true,
      source,
      detectionMethod: 'ctwa_metadata',
      adData: {
        adContext,
        ctwaClid: ctwaClid || null,
        adId,
        campaignName
      }
    };
  }
  
  // MÉTODO 2: Detecção por conteúdo da mensagem (mensagem padrão do anúncio)
  // "Quero saber se tenho dinheiro a receber."
  // Este é o texto enviado automaticamente quando o usuário clica no anúncio
  if (messageContent) {
    const normalizedMessage = messageContent.toLowerCase().trim().replace(/[.!?]+$/, '');
    
    // Verificar padrão exato da mensagem de tráfego
    const isTrafficMessage = normalizedMessage.includes(TRAFFIC_MESSAGE_PATTERN);
    
    // TAMBÉM detectar variações comuns da mensagem do anúncio
    const trafficVariations = [
      'quero saber se tenho dinheiro',
      'tenho dinheiro a receber',
      'dinheiro a receber',
      'quero saber sobre dinheiro'
    ];
    const isTrafficVariation = trafficVariations.some(v => normalizedMessage.includes(v));
    
    if (isTrafficMessage || isTrafficVariation) {
      console.log('[Traffic Detection] ✅ DETECTED PAID TRAFFIC via MESSAGE CONTENT:', {
        message: messageContent.substring(0, 60),
        pattern: TRAFFIC_MESSAGE_PATTERN,
        matchedVariation: isTrafficVariation
      });
      
      return {
        isTraffic: true,
        source: 'meta_ads', // Assumir Meta Ads quando detectado por mensagem
        detectionMethod: 'message_content',
        adData: {
          adContext: null,
          ctwaClid: null,
          adId: null,
          campaignName: 'auto_detected_by_message'
        }
      };
    }
  }
  
  console.log('[Traffic Detection] No paid traffic markers found, classifying as direct');
  return { isTraffic: false, source: null, detectionMethod: null, adData: null };
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  // Webhook authentication
  const ZAPI_SECRET = Deno.env.get('ZAPI_WEBHOOK_SECRET');
  if (ZAPI_SECRET) {
    const receivedToken = req.headers.get('x-zapi-token') || new URL(req.url).searchParams.get('token');
    if (receivedToken !== ZAPI_SECRET) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: corsHeaders });
    }
  }

  const startTime = Date.now();
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    const body = await req.json();
    const webhookSecret = req.headers.get('x-webhook-secret');
    
    console.log('[Z-API Webhook] Received:', JSON.stringify(body).substring(0, 500));

    // ============================================
    // IDENTIFICAR INSTÂNCIA DE ORIGEM
    // ============================================
    const instanceInfo = await identificarInstanciaOrigem(supabase, body);
    const zapiInstanceId = instanceInfo?.instanceId || null;
    const zapiInstanceName = instanceInfo?.instanceName || 'Unknown';
    const zapiConfig = instanceInfo?.config || null;

    console.log(`[Z-API Webhook] Instância identificada: ${zapiInstanceName}`);

    if (!zapiConfig) {
      // Fallback para config legado
      const { data: legacyConfig } = await supabase
        .from('integrations_config')
        .select('*')
        .eq('provider', 'zapi')
        .maybeSingle();
      
      if (!legacyConfig?.is_active) {
        console.log('[Z-API Webhook] Integration not active');
        return new Response(JSON.stringify({ error: 'Integration not active' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
    }

    // Validar webhook secret se configurado
    const webhookSecretConfig = zapiConfig?.webhook_secret || null;
    if (webhookSecretConfig && webhookSecret !== webhookSecretConfig) {
      console.log('[Z-API Webhook] Invalid webhook secret');
      await logIntegration(supabase, 'zapi', 'inbound', body, null, 'error', 'Invalid webhook secret', null, startTime);
      return new Response(JSON.stringify({ error: 'Invalid secret' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Normalizar evento Z-API para formato interno PRIMEIRO
    // (precisamos da mensagem para detectar tráfego pelo conteúdo)
    const normalized = normalizeZapiEvent(body);
    
    // ============================================
    // DETECTAR TRÁFEGO PAGO (instância, metadados OU mensagem do anúncio)
    // ============================================
    // IMPORTANTE: Usar connectedPhone do body (mais confiável) ao invés de phone_number do config
    const connectedPhoneForDetection = body.connectedPhone || body.phone?.replace('@c.us', '') || zapiConfig?.phone_number || null;
    console.log('[Z-API Webhook] Instance detection using connectedPhone:', connectedPhoneForDetection);
    const trafficSource = detectTrafficSource(body, normalized.message || undefined, connectedPhoneForDetection);
    
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

    // Buscar ou criar lead pelo telefone (PASSANDO DADOS DE TRÁFEGO E INSTÂNCIA)
    // NOTA: Isa responde leads de TRÁFEGO PAGO (detectado via metadados do anúncio OU mensagem padrão)
    const { leadId, isNewLead } = await findOrCreateLead(supabase, normalized, trafficSource, connectedPhoneForDetection);

    // Se lead já existia e detectamos tráfego pago (via metadados OU mensagem), atualizar origem
    // IMPORTANTE: Isso garante que leads criados antes da detecção de tráfego sejam atualizados
    if (leadId && !isNewLead && trafficSource.isTraffic) {
      console.log(`[Z-API Webhook] 🔄 Existing lead detected with traffic source, updating...`);
      await updateLeadTrafficSource(supabase, leadId, trafficSource);
    }

    // ============================================
    // AUTOMAÇÃO DE FOLLOW-UP DE TRÁFEGO
    // ============================================
    if (leadId && !normalized.fromMe) {
      // Atualizar last_contact_at
      await supabase
        .from('leads_juridicos')
        .update({ last_contact_at: new Date().toISOString() })
        .eq('id', leadId);

      // Marcar lead_followups como respondido se existir
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

      // 🆕 MARCAR TRAFFIC FOLLOWUP COMO RESPONDIDO
      await supabase
        .from('traffic_followups')
        .update({ 
          status: 'responded', 
          automation_active: false,
          last_inbound_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq('lead_id', leadId)
        .eq('automation_active', true);
    }

      // ============================================
      // 📢 DETECÇÃO DE OPT-IN DA CAMPANHA (resposta "SIM")
      // Se o contato respondeu SIM e está na lista de campanha, dispara a mensagem principal
      // ============================================
      if (normalized.message && !normalized.fromMe) {
        const msgLower = normalized.message.toLowerCase().trim();
        const isOptinReply = msgLower === 'sim' || msgLower === 'sim!' || msgLower === 'sim.' || 
                             msgLower === 'quero' || msgLower === 'quero sim' || msgLower === 'tenho interesse';
        
        if (isOptinReply && normalized.phone) {
          const phoneNorm = normalizePhone(normalized.phone);
          try {
            // Buscar recipient da campanha que está aguardando opt-in
            const { data: campaignRecipient } = await supabase
              .from('campaign_recipients')
              .select('id, nome, telefone_normalizado, campaign_name')
              .eq('telefone_normalizado', phoneNorm)
              .eq('stage', 'optin_sent')
              .maybeSingle();
            
            if (campaignRecipient) {
              console.log(`[Z-API Webhook] 📢 Campaign opt-in detected from ${campaignRecipient.nome} (${phoneNorm})`);
              
              // Marcar como aceito
              await supabase
                .from('campaign_recipients')
                .update({ stage: 'accepted', accepted_at: new Date().toISOString(), updated_at: new Date().toISOString() })
                .eq('id', campaignRecipient.id);
              
              // Disparar mensagem de campanha automaticamente (fire-and-forget)
              supabase.functions.invoke('campaign-optin-dispatch', {
                body: {
                  action: 'send_campaign',
                  recipient_id: campaignRecipient.id,
                  telefone: campaignRecipient.telefone_normalizado,
                  nome: campaignRecipient.nome,
                }
              }).then((res: any) => {
                console.log(`[Z-API Webhook] 📢 Campaign message dispatched for ${campaignRecipient.nome}:`, res.data);
              }).catch((err: any) => {
                console.error(`[Z-API Webhook] 📢 Campaign dispatch error:`, err);
              });
            }
          } catch (campaignErr) {
            console.error('[Z-API Webhook] Campaign opt-in check error:', campaignErr);
          }
        }
      }

    // 🆕 INSCREVER LEAD DE TRÁFEGO NO FOLLOW-UP (se for novo lead de tráfego)
    if (leadId && isNewLead && trafficSource.isTraffic && normalized.phone) {
      try {
        // Verificar se já está inscrito
        const { data: existingFollowup } = await supabase
          .from('traffic_followups')
          .select('id')
          .eq('lead_id', leadId)
          .maybeSingle();
        
        if (!existingFollowup) {
          const firstStageDelay = 10; // 10 minutos
          const nextMessageAt = new Date(Date.now() + firstStageDelay * 60 * 1000);
          
          await supabase.from('traffic_followups').insert({
            lead_id: leadId,
            subscriber_id: gerarSubscriberId(normalized.phone),
            telefone: normalizePhone(normalized.phone),
            status: 'new',
            automation_active: true,
            current_stage: null,
            next_message_at: nextMessageAt.toISOString()
          });
          
          console.log(`[Z-API Webhook] 📊 Lead de tráfego inscrito no follow-up: ${leadId}`);
        }
      } catch (enrollErr) {
        console.error('[Z-API Webhook] Error enrolling in traffic followup:', enrollErr);
      }
    }

    // Gerar subscriber_id único baseado no telefone
    const subscriberId = gerarSubscriberId(normalized.phone!);
    
    // IMPORTANTE: Criar ou atualizar subscriber ANTES de salvar mensagem
    // Isso garante que o chat vai mostrar a conversa
    console.log('[Z-API Webhook] Upserting subscriber:', subscriberId);
    
    // Extrair connectedPhone para identificar a instância (usado para badges)
    const connectedPhone = body.connectedPhone || 
                           body.phone?.replace('@c.us', '') ||
                           zapiConfig?.phone_number || 
                           null;
    
    // Determinar linha_whatsapp baseado no número conectado
    const cleanConnPhoneForLine = connectedPhone?.replace(/\D/g, '') || '';
    const isOfficeNumber = OFFICE_INSTANCE_PHONES.some(phone => 
      cleanConnPhoneForLine === phone || cleanConnPhoneForLine.endsWith(phone)
    );
    const isTrafficNumber = TRAFFIC_INSTANCE_PHONES.some(phone => 
      cleanConnPhoneForLine === phone || cleanConnPhoneForLine.endsWith(phone)
    );
    
    const linhaWhatsapp = isOfficeNumber ? 'bentes_ramos_antigo' : 
                          isTrafficNumber ? 'trafego_isa' : 'indefinido';
    const empresaTag = isOfficeNumber ? 'BENTES_RAMOS' : null;
    
    const { error: subError } = await supabase
      .from('manychat_subscribers')
      .upsert({
        subscriber_id: subscriberId,
        nome: normalized.name || normalized.phone,
        telefone: normalized.phone,
        canal: 'whatsapp',
        lead_id: leadId,
        ultima_interacao: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        // Salvar o número conectado para identificar a instância (badge Tráfego/Bentes Ramos)
        instance_name: connectedPhone,
        // Novos campos para separação Bentes Ramos vs Tráfego
        linha_whatsapp: linhaWhatsapp,
        empresa_tag: empresaTag
      }, { 
        onConflict: 'subscriber_id',
        ignoreDuplicates: false 
      });
    
    if (subError) {
      console.error('[Z-API Webhook] Error upserting subscriber:', subError);
    }

    // ============================================
    // AUTO-TAGGING: Adicionar tag "Bentes Ramos" para contatos do escritório
    // ============================================
    const cleanConnectedPhone = connectedPhone?.replace(/\D/g, '') || '';
    const isFromOffice = OFFICE_INSTANCE_PHONES.some(phone => 
      cleanConnectedPhone === phone || cleanConnectedPhone.endsWith(phone)
    );
    
    if (isFromOffice) {
      try {
        // Buscar ID da tag "Bentes Ramos"
        const { data: bentesTag } = await supabase
          .from('chat_tags')
          .select('id')
          .eq('name', 'Bentes Ramos')
          .single();
        
        if (bentesTag) {
          // Adicionar tag ao subscriber (ignora se já existir)
          await supabase
            .from('subscriber_tags')
            .upsert({
              subscriber_id: subscriberId,
              tag_id: bentesTag.id,
              reason: 'Auto: contato via número do escritório'
            }, { 
              onConflict: 'subscriber_id,tag_id',
              ignoreDuplicates: true 
            });
          
          console.log('[Z-API Webhook] 🏷️ Tag "Bentes Ramos" aplicada ao subscriber:', subscriberId);
        }
      } catch (tagErr) {
        console.error('[Z-API Webhook] Error applying Bentes Ramos tag:', tagErr);
      }
    }

    // Salvar mensagem - com prevenção de duplicatas por message_id
    if (normalized.message && leadId) {
      console.log('[Z-API Webhook] Saving message for subscriber:', subscriberId, 'messageId:', normalized.messageId, 'fromMe:', normalized.fromMe);

      // Definir direção: entrada (cliente) ou saída (atendente/sistema)
      const direcaoMensagem = normalized.fromMe ? 'saida' : 'entrada';
      
      // Para mensagens de SAÍDA (fromMe=true), verificar se já foi salva pelo CRM
      // Mensagens enviadas pela interface do chat já são salvas com sent_via: 'chat_interface'
      // Aqui salvamos APENAS mensagens enviadas diretamente pelo WhatsApp do celular
      if (normalized.fromMe && normalized.messageId) {
        const { data: existingOutbound } = await supabase
          .from('manychat_mensagens')
          .select('id')
          .or(`metadata->>message_id.eq.${normalized.messageId},metadata->>zapi_message_id.eq.${normalized.messageId}`)
          .maybeSingle();
        
        if (existingOutbound) {
          console.log('[Z-API Webhook] Outbound message already exists, skipping:', normalized.messageId);
          return new Response(JSON.stringify({ 
            success: true, 
            lead_id: leadId,
            skipped: true,
            reason: 'outbound_already_saved'
          }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }
        
        // Salvar mensagem de saída do atendente (enviada pelo celular)
        console.log('[Z-API Webhook] 📤 Saving OUTBOUND message from attendant (sent via phone)');
      }

      // Conteúdo salvo: para mídia, priorizar URL (para renderizar no chat)
      const conteudoToSave =
        (normalized.messageType === 'audio' || normalized.messageType === 'image' || normalized.messageType === 'video' || normalized.messageType === 'document')
          ? (normalized.mediaUrl || normalized.message)
          : normalized.message;
      
      // IMPORTANTE: Verificar se mensagem já existe pelo message_id para evitar duplicatas
      // Se já existe, NÃO processar novamente (evita chamadas duplicadas à Isa)
      if (normalized.messageId) {
        const { data: existingMsg } = await supabase
          .from('manychat_mensagens')
          .select('id')
          .eq('metadata->>message_id', normalized.messageId)
          .maybeSingle();
        
        if (existingMsg) {
          console.log('[Z-API Webhook] ⚠️ Message already exists, SKIPPING ENTIRE PROCESSING:', normalized.messageId);
          // RETORNAR AQUI - não processar novamente, não chamar a Isa
          return new Response(JSON.stringify({ 
            success: true, 
            lead_id: leadId,
            skipped: true,
            reason: 'message_already_processed',
            message_id: normalized.messageId
          }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }
        
        // Salvar nova mensagem com a direção correta
        const { data: savedMsg, error: msgError } = await supabase.from('manychat_mensagens').insert({
          subscriber_id: subscriberId,
          subscriber_nome: normalized.fromMe ? 'Atendente' : (normalized.name || normalized.phone),
          conteudo: conteudoToSave,
          canal: 'whatsapp',
          tipo: normalized.messageType || 'text',
          direcao: direcaoMensagem,
          lead_id: leadId,
          metadata: { 
            source: 'zapi', 
            original: body,
            message_id: normalized.messageId,
            media_url: normalized.mediaUrl,
            caption: normalized.caption,
            file_name: normalized.fileName,
            from_me: normalized.fromMe,
            sent_via: normalized.fromMe ? 'whatsapp_phone' : null,
            // Identificação da instância Z-API
            instance_id: zapiInstanceId,
            instance_name: zapiInstanceName,
            // Adicionar dados de tráfego se disponíveis
            traffic_source: trafficSource.isTraffic ? trafficSource.source : null,
            ctwa_clid: trafficSource.adData?.ctwaClid || null
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
      } else {
        // Sem message_id, salvar normalmente (fallback)
        const { data: savedMsg, error: msgError } = await supabase.from('manychat_mensagens').insert({
          subscriber_id: subscriberId,
          subscriber_nome: normalized.fromMe ? 'Atendente' : (normalized.name || normalized.phone),
          conteudo: conteudoToSave,
          canal: 'whatsapp',
          tipo: normalized.messageType || 'text',
          direcao: direcaoMensagem,
          lead_id: leadId,
          metadata: { 
            source: 'zapi', 
            original: body,
            message_id: null,
            media_url: normalized.mediaUrl,
            caption: normalized.caption,
            file_name: normalized.fileName,
            from_me: normalized.fromMe,
            sent_via: normalized.fromMe ? 'whatsapp_phone' : null,
            // Identificação da instância Z-API
            instance_id: zapiInstanceId,
            instance_name: zapiInstanceName,
            traffic_source: trafficSource.isTraffic ? trafficSource.source : null,
            ctwa_clid: trafficSource.adData?.ctwaClid || null
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

    // ============================================
    // LÓGICA DE ACIONAMENTO DA ISA
    // ISA só responde leads de:
    // 1. Tráfego pago (número 92 98588-8190)
    // 2. API Meta (Facebook Lead Ads)
    // Leads do escritório (92 99160-4348) são EXCLUSIVAMENTE atendimento humano
    // ============================================
    if (normalized.message && leadId && !normalized.fromMe) {
      // Buscar estado atual do lead com campos de segmentação
      const { data: lead } = await supabase
        .from('leads_juridicos')
        .select('lead_state, nome, status, isa_ativa, tipo_origem, linha_whatsapp, fonte_trafego')
        .eq('id', leadId)
        .single();

      // Verificar se atendimento humano está ativo
      const { data: subscriber } = await supabase
        .from('manychat_subscribers')
        .select('atendimento_humano, linha_whatsapp')
        .eq('lead_id', leadId)
        .maybeSingle();

      // ============================================
      // REGRA PRINCIPAL: ISA SÓ ATENDE NO NÚMERO DE TRÁFEGO
      // ============================================
      // Para evitar responder “pelo número errado”, a Isa só responde quando a
      // mensagem ENTRA pela linha de tráfego (92 98588-8190).
      // Mesmo que o lead tenha tipo_origem=trafego, se ele falar pelo número do
      // escritório (92 99160-4348), NÃO acionamos a Isa.
      // ============================================

      // Linha de WhatsApp da mensagem atual (derivada do connectedPhone do webhook)
      const isTrafficLine = linhaWhatsapp === 'trafego_isa';

      // Origem do lead (anúncio) / API Meta Lead Ads
      const isTrafficOrigin = lead?.tipo_origem === 'trafego' || trafficSource.isTraffic;
      const isMetaLeadAds = lead?.fonte_trafego?.includes('facebook') || lead?.fonte_trafego?.includes('meta');

      const isaExplicitlyDisabled = lead?.isa_ativa === false;
      const humanAttendanceActive = subscriber?.atendimento_humano === true;

// ISA só atende se a mensagem entrou na linha de tráfego
      const shouldIsaRespond = isTrafficLine
        && !isaExplicitlyDisabled
        && !humanAttendanceActive;
      
      console.log(`[Z-API Webhook] ISA Decision for lead ${leadId}:`, {
        isTrafficLine,
        isTrafficOrigin,
        isMetaLeadAds,
        isaExplicitlyDisabled,
        humanAttendanceActive,
        shouldIsaRespond,
        linhaWhatsapp,
        leadLinhaWhatsapp: lead?.linha_whatsapp,
        tipoOrigem: lead?.tipo_origem,
        fonteTrafego: lead?.fonte_trafego
      });

      if (shouldIsaRespond && lead) {
        // ============================================
        // LOCK DE PROCESSAMENTO: Evitar chamadas duplicadas à ISA
        // Usa message_id + lead_id como chave única
        // ============================================
        const lockKey = `isa_msg_${normalized.messageId || Date.now()}_${leadId}`;
        
        // Verificar se já existe um lock recente (últimos 60 segundos)
        const { data: existingLock } = await supabase
          .from('system_events')
          .select('id')
          .eq('tipo', 'isa_processing_lock')
          .eq('dados->>lock_key', lockKey)
          .gte('created_at', new Date(Date.now() - 60000).toISOString())
          .maybeSingle();
        
        if (existingLock) {
          console.log(`[Z-API Webhook] ⚠️ ISA processing lock active for ${lockKey}, skipping duplicate call`);
          return new Response(JSON.stringify({ 
            success: true, 
            lead_id: leadId,
            skipped: true,
            reason: 'isa_processing_locked'
          }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }
        
        // Criar lock
        await supabase.from('system_events').insert({
          tipo: 'isa_processing_lock',
          fonte: 'zapi_webhook',
          dados: { lock_key: lockKey, lead_id: leadId, message_id: normalized.messageId }
        });
        
        try {
          console.log(`[Z-API Webhook] ✅ Calling isa-auto-process for TRAFFIC lead ${leadId} (lock: ${lockKey})`);
          
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

          if (!isaError && isaResponse?.response && zapiConfig) {
            // Enviar resposta via Z-API usando a mesma instância que recebeu a mensagem
            const sendResult = await sendText(
              zapiConfig, 
              normalized.phone!, 
              isaResponse.response
            );
            
            if (sendResult.success) {
              // Salvar resposta da Isa no histórico
              await supabase.from('manychat_mensagens').insert({
                subscriber_id: gerarSubscriberId(normalized.phone!),
                subscriber_nome: 'Isa',
                lead_id: leadId,
                conteudo: isaResponse.response,
                direcao: 'saida',
                tipo: 'text',
                canal: 'whatsapp',
                metadata: { 
                  source: 'zapi', 
                  context: 'isa_auto_response',
                  message_id: sendResult.messageId,
                  instance_id: zapiInstanceId,
                  instance_name: zapiInstanceName,
                  sent_via: 'isa_auto'
                }
              });
              
              console.log(`[Z-API Webhook] ✅ Isa response sent to ${normalized.phone} via ${zapiInstanceName}`);
            } else {
              console.error('[Z-API Webhook] Failed to send Isa response:', sendResult.error);
            }
          } else if (isaError) {
            console.error('[Z-API Webhook] Isa error:', isaError);
          }
        } catch (isaErr) {
          console.error('[Z-API Webhook] Error calling Isa:', isaErr);
        }
      } else if (!humanAttendanceActive && linhaWhatsapp === 'bentes_ramos_antigo') {
        // ============================================
        // ISA ESCRITÓRIO — Atende clientes do escritório
        // Consulta processos, agenda, documentos e financeiro
        // ============================================
        
        // Check if Isa Escritório is globally disabled
        const { data: isaEscSetting } = await supabase
          .from('app_settings')
          .select('value')
          .eq('key', 'ISA_ESCRITORIO_ENABLED')
          .maybeSingle();
        
        const isaEscEnabled = isaEscSetting?.value !== 'false';
        
        if (!isaEscEnabled) {
          console.log(`[Z-API Webhook] 🏢 Isa Escritório DESATIVADA globalmente — ignorando mensagem de ${normalized.phone}`);
        } else {
        console.log(`[Z-API Webhook] 🏢 OFFICE lead - calling isa-escritorio-reply for lead ${leadId}`);
        
        // ============================================
        // FORÇAR INSTÂNCIA DO ESCRITÓRIO PARA ENVIO
        // Não usar zapiConfig genérico — buscar explicitamente a instância
        // do escritório pelo phone_number para garantir roteamento correto
        // ============================================
        const officePhones = ['559291604348', '5592991604348'];
        const { data: officeInstance } = await supabase
          .from('zapi_instances')
          .select('*')
          .eq('is_active', true)
          .or(officePhones.map(p => `phone_number.eq.${p}`).join(','))
          .maybeSingle();
        
        const officeConfig: any = officeInstance ? {
          instance_id: officeInstance.instance_id,
          token: officeInstance.token,
          client_token: officeInstance.client_token,
          name: officeInstance.name,
          phone_number: officeInstance.phone_number,
        } : null;
        
        console.log(`[Z-API Webhook] 🏢 [ROUTING] Instância para envio:`, {
          office_found: !!officeConfig,
          office_name: officeConfig?.name || 'N/A',
          office_instance_id: officeConfig?.instance_id || 'N/A',
          office_phone: officeConfig?.phone_number || 'N/A',
          generic_zapiConfig_name: zapiConfig?.name || 'N/A',
          generic_zapiConfig_instance_id: zapiConfig?.instance_id || 'N/A',
          match: officeConfig?.instance_id === zapiConfig?.instance_id ? '✅ SAME' : '❌ DIFFERENT — bug would have occurred!',
        });
        
        // Usar officeConfig se encontrado, senão fallback para zapiConfig
        const sendConfig = officeConfig || zapiConfig;
        
        // Lock por LEAD (não por mensagem) para evitar duplicatas quando
        // o cliente envia múltiplas mensagens rápidas (ex: imagem + emoji)
        const lockKeyEscritorio = `isa_esc_lead_${leadId}`;
        const { data: existingEscLock } = await supabase
          .from('system_events')
          .select('id')
          .eq('tipo', 'isa_processing_lock')
          .eq('dados->>lock_key', lockKeyEscritorio)
          .gte('created_at', new Date(Date.now() - 15000).toISOString())
          .maybeSingle();
        
        if (!existingEscLock) {
          await supabase.from('system_events').insert({
            tipo: 'isa_processing_lock',
            fonte: 'zapi_webhook',
            dados: { lock_key: lockKeyEscritorio, lead_id: leadId, message_id: normalized.messageId }
          });
          
          try {
            const mediaUrlEsc = normalized.mediaUrl || 
              normalized.media?.audioUrl || 
              normalized.media?.imageUrl || 
              normalized.media?.documentUrl ||
              normalized.media?.link ||
              normalized.media?.url;
            
            const mensagemEsc = (normalized.messageType === 'audio' || normalized.messageType === 'image' || normalized.messageType === 'document') && mediaUrlEsc
              ? mediaUrlEsc
              : normalized.message;
            
            const { data: escResponse, error: escError } = await supabase.functions.invoke('isa-escritorio-reply', {
              body: {
                lead_id: leadId,
                mensagem: mensagemEsc,
                subscriber_id: gerarSubscriberId(normalized.phone),
                subscriber_nome: normalized.name || lead.nome || normalized.phone,
                tipo_mensagem: normalized.messageType,
                media_url: mediaUrlEsc
              }
            });

            if (!escError && escResponse?.response && sendConfig) {
              console.log(`[Z-API Webhook] 🏢 [SEND] Enviando via ${sendConfig.name} (instance_id: ${sendConfig.instance_id}) para ${normalized.phone}`);
              
              const sendResult = await sendText(
                sendConfig, 
                normalized.phone!, 
                escResponse.response
              );
              
              if (sendResult.success) {
                await supabase.from('manychat_mensagens').insert({
                  subscriber_id: gerarSubscriberId(normalized.phone!),
                  subscriber_nome: 'Isa Escritório',
                  lead_id: leadId,
                  conteudo: escResponse.response,
                  direcao: 'saida',
                  tipo: 'text',
                  canal: 'whatsapp',
                  metadata: { 
                    source: 'zapi', 
                    context: 'isa_escritorio_response',
                    message_id: sendResult.messageId,
                    instance_id: officeInstance?.id || zapiInstanceId,
                    instance_name: sendConfig.name || zapiInstanceName,
                    sent_via: 'isa_escritorio',
                    routing_debug: {
                      generic_config: zapiConfig?.name,
                      office_config: officeConfig?.name,
                      used_config: sendConfig.name,
                      was_corrected: officeConfig?.instance_id !== zapiConfig?.instance_id
                    }
                  }
                });
                
                console.log(`[Z-API Webhook] ✅ Isa Escritório response sent to ${normalized.phone} via ${sendConfig.name}`);
              }
            } else if (escError) {
              console.error('[Z-API Webhook] Isa Escritório error:', escError);
            }
          } catch (escErr) {
            console.error('[Z-API Webhook] Error calling Isa Escritório:', escErr);
          }
        }
        } // end isaEscEnabled check
      } else {
        if (humanAttendanceActive) {
          console.log(`[Z-API Webhook] 👤 Human attendance active for lead ${leadId}, skipping Isa`);
        } else if (isaExplicitlyDisabled) {
          console.log(`[Z-API Webhook] 🚫 Isa explicitly disabled for lead ${leadId}`);
        }
      }
    }

    // Log sucesso
    await logIntegration(supabase, 'zapi', 'inbound', body, { 
      lead_id: leadId, 
      is_new_lead: isNewLead,
      traffic_source: trafficSource,
      normalized 
    }, 'ok', null, leadId, startTime);

    return new Response(JSON.stringify({ 
      success: true, 
      lead_id: leadId,
      is_new_lead: isNewLead,
      traffic_detected: trafficSource.isTraffic,
      traffic_source: trafficSource.source
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
    // Extrair URL do sticker para renderização
    mediaUrl = body.sticker.stickerUrl || body.sticker.link || body.sticker.url || body.sticker.imageUrl;
    message = mediaUrl || '[Sticker]';
    messageType = 'sticker';
    media = body.sticker;
  } else if (body.location) {
    // Extrair dados completos de localização
    const lat = body.location.latitude;
    const lng = body.location.longitude;
    const locName = body.location.name || body.location.address || '';
    message = `[Localização: ${lat}, ${lng}]${locName ? ` - ${locName}` : ''}`;
    messageType = 'location';
    media = body.location;
    mediaUrl = `https://www.google.com/maps?q=${lat},${lng}`;
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

// ============================================
// BUSCAR DADOS DO FORMULÁRIO DO FACEBOOK LEAD ADS VIA API GRAPH
// Quando detectamos CTWA, temos o sourceId que pode ser usado para buscar dados adicionais
// ============================================
async function fetchFacebookLeadData(sourceId: string | null): Promise<{
  email: string | null;
  phone: string | null;
  name: string | null;
} | null> {
  if (!sourceId) return null;
  
  const accessToken = Deno.env.get('META_ACCESS_TOKEN');
  if (!accessToken) {
    console.log('[FB Lead Fetch] META_ACCESS_TOKEN not configured');
    return null;
  }
  
  try {
    // O sourceId pode ser o ID do ad ou da lead_gen
    // Tentamos buscar como lead primeiro
    console.log('[FB Lead Fetch] Attempting to fetch lead data for sourceId:', sourceId);
    
    // Primeiro, tentar buscar leads recentes da página
    // Nota: Isso requer permissões de leads_retrieval na página
    const leadResponse = await fetch(
      `https://graph.facebook.com/v20.0/${sourceId}?fields=id,field_data,created_time&access_token=${accessToken}`
    );
    
    if (leadResponse.ok) {
      const leadData = await leadResponse.json();
      console.log('[FB Lead Fetch] Lead data found:', leadData);
      
      if (leadData.field_data) {
        let email: string | null = null;
        let phone: string | null = null;
        let name: string | null = null;
        
        for (const field of leadData.field_data) {
          const fieldName = field.name?.toLowerCase() || '';
          const value = field.values?.[0] || null;
          
          if (fieldName.includes('email')) {
            email = value;
          } else if (fieldName.includes('phone') || fieldName.includes('telefone') || fieldName.includes('whatsapp')) {
            phone = value;
          } else if (fieldName.includes('name') || fieldName.includes('nome') || fieldName === 'full_name') {
            name = value;
          }
        }
        
        return { email, phone, name };
      }
    } else {
      const error = await leadResponse.json();
      console.log('[FB Lead Fetch] Failed to fetch lead:', error?.error?.message || 'Unknown error');
    }
    
    return null;
  } catch (err) {
    console.error('[FB Lead Fetch] Error fetching lead data:', err);
    return null;
  }
}

async function findOrCreateLead(
  supabase: any, 
  data: { phone: string | null; name: string | null },
  trafficSource: TrafficSourceResult,
  instancePhone?: string | null
): Promise<{ leadId: string | null; isNewLead: boolean }> {
  if (!data.phone) return { leadId: null, isNewLead: false };

  const phoneSuffix = data.phone.slice(-9);
  
  // Buscar lead existente
  const { data: existingLead } = await supabase
    .from('leads_juridicos')
    .select('id, email, telefone')
    .ilike('telefone', `%${phoneSuffix}%`)
    .limit(1)
    .maybeSingle();

  if (existingLead) {
    // Se temos dados de tráfego, tentar buscar email do Facebook
    if (trafficSource.isTraffic && !existingLead.email) {
      const sourceId = trafficSource.adData?.adId || null;
      const fbData = await fetchFacebookLeadData(sourceId);
      
      if (fbData?.email) {
        console.log('[Z-API Webhook] 📧 Updating lead with email from FB:', fbData.email);
        await supabase
          .from('leads_juridicos')
          .update({ 
            email: fbData.email.toLowerCase(),
            updated_at: new Date().toISOString()
          })
          .eq('id', existingLead.id);
      }
    }
    
    return { leadId: existingLead.id, isNewLead: false };
  }

  // Se é tráfego, tentar buscar dados adicionais do Facebook antes de criar
  let emailFromFb: string | null = null;
  let phoneFromFb: string | null = null;
  let nameFromFb: string | null = null;
  
  if (trafficSource.isTraffic) {
    const sourceId = trafficSource.adData?.adId || null;
    const fbData = await fetchFacebookLeadData(sourceId);
    
    if (fbData) {
      emailFromFb = fbData.email;
      phoneFromFb = fbData.phone;
      nameFromFb = fbData.name;
      console.log('[Z-API Webhook] 📊 FB Lead Data found:', { email: emailFromFb, phone: phoneFromFb, name: nameFromFb });
    }
  }

  // Criar novo lead com detecção de tráfego
  // REGRA: Isa só responde leads de TRÁFEGO PAGO (detectado via metadados do anúncio CTWA)
  let fonteTrafego = 'organico';
  let canalOrigem = 'whatsapp';
  let tipoOrigem = 'whatsapp_direto'; // Padrão: contato direto (não automatizado pela Isa)
  
  // Detectar se é do escritório (número Bentes Ramos)
  const cleanInstancePhone = instancePhone?.replace(/\D/g, '') || '';
  const isFromOffice = OFFICE_INSTANCE_PHONES.some(phone => 
    cleanInstancePhone === phone || cleanInstancePhone.endsWith(phone)
  );
  
  // Detectar se é do número de tráfego
  const isFromTrafficLine = TRAFFIC_INSTANCE_PHONES.some(phone => 
    cleanInstancePhone === phone || cleanInstancePhone.endsWith(phone)
  );
  
  // Se detectamos tráfego pago (via metadados do anúncio Click to WhatsApp OU número de tráfego)
  if (trafficSource.isTraffic || isFromTrafficLine) {
    fonteTrafego = trafficSource.source || 'meta_ads';
    tipoOrigem = 'trafego';
    console.log(`[Z-API Webhook] 🎯 NEW LEAD FROM PAID TRAFFIC: ${fonteTrafego}`);
  }
  
  // Determinar linha_whatsapp
  const linhaWhatsapp = isFromOffice ? 'bentes_ramos_antigo' : 
                        (isFromTrafficLine || trafficSource.isTraffic) ? 'trafego_isa' : 'indefinido';
  
  // Determinar configurações Isa baseado na linha
  const isaAtiva = !isFromOffice; // ISA desativada para escritório
  const ownerTipo = isFromOffice ? 'humano' : 'isa';
  const empresaTag = isFromOffice ? 'BENTES_RAMOS' : null;
  
  // Determinar status inicial baseado na origem
  // - Escritório (Bentes Ramos): status "Bentes Ramos" 
  // - Tráfego/Outros: status "Lead Frio"
  const initialStatus = isFromOffice ? 'Bentes Ramos' : 'Lead Frio';
  const leadOrigin = isFromOffice 
    ? 'Escritório' 
    : (trafficSource.isTraffic ? 'Tráfego Pago' : 'WhatsApp Z-API');
  
  // Determinar se é lead de tráfego (somente por metadados do anúncio)
  const isTrafficLead = trafficSource.isTraffic || isFromTrafficLine;
  
  // Usar nome do FB se disponível, senão usar o do WhatsApp
  const leadName = nameFromFb || data.name || `Contato ${data.phone}`;
  
  const { data: newLead, error } = await supabase
    .from('leads_juridicos')
    .insert({
      nome: leadName,
      telefone: data.phone,
      email: emailFromFb?.toLowerCase() || null, // Email do formulário do FB
      status: initialStatus,
      lead_state: 'NEW',
      origem: leadOrigin,
      fonte_trafego: fonteTrafego,
      canal_origem: canalOrigem,
      tipo_origem: tipoOrigem,
      // Novos campos para separação Bentes Ramos vs Tráfego
      linha_whatsapp: linhaWhatsapp,
      empresa_tag: empresaTag,
      owner_tipo: ownerTipo,
      isa_ativa: isaAtiva,
      whatsapp_numero_destino: instancePhone,
      resumo_ia: isFromOffice
        ? `Lead do ESCRITÓRIO (Bentes Ramos). Contato direto em ${new Date().toLocaleDateString('pt-BR')}. ISA DESATIVADA - atendimento humano direto.`
        : isTrafficLead 
          ? `Lead de TRÁFEGO PAGO (${fonteTrafego}). Veio de anúncio Click to WhatsApp em ${new Date().toLocaleDateString('pt-BR')}.${emailFromFb ? ` Email: ${emailFromFb}` : ''}`
          : `Lead criado automaticamente via Z-API (WhatsApp direto). Primeiro contato em ${new Date().toLocaleDateString('pt-BR')}.`
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
    reason: isTrafficLead 
      ? `Lead criado via Click to WhatsApp (${fonteTrafego})`
      : 'Lead criado via webhook Z-API'
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

  // Registrar evento de criação com dados de atribuição
  await supabase.from('system_events').insert({
    tipo: trafficSource.isTraffic ? 'atribuicao' : 'lead',
    fonte: trafficSource.isTraffic ? 'meta_ads' : 'zapi-webhook',
    acao: trafficSource.isTraffic ? 'lead_from_ctwa' : 'lead_criado',
    lead_id: newLead.id,
    dados: {
      phone: data.phone,
      name: leadName,
      email: emailFromFb,
      provider: 'zapi',
      fonte_trafego: fonteTrafego,
      canal_origem: canalOrigem,
      tipo_origem: tipoOrigem,
      // Dados de atribuição para analytics
      ad_id: trafficSource.adData?.adId || null,
      campaign: trafficSource.adData?.campaignName || null,
      ctwa_clid: trafficSource.adData?.ctwaClid || null,
      source: trafficSource.source
    }
  });

  console.log(`[Z-API Webhook] Created new lead: ${newLead.id} (tipo_origem: ${tipoOrigem}, fonte: ${fonteTrafego}, email: ${emailFromFb || 'N/A'})`);

  return { leadId: newLead.id, isNewLead: true };
}

// Atualizar lead existente se detectarmos tráfego pago (via metadados do anúncio OU mensagem)
async function updateLeadTrafficSource(
  supabase: any,
  leadId: string,
  trafficSource: TrafficSourceResult
): Promise<void> {
  // Só atualiza se tiver tráfego detectado
  if (!trafficSource.isTraffic) return;
  
  // Verificar se lead ainda está como 'indefinido' ou 'whatsapp_direto'
  const { data: lead } = await supabase
    .from('leads_juridicos')
    .select('tipo_origem, fonte_trafego')
    .eq('id', leadId)
    .single();
  
  // Atualizar se não é tráfego ainda (indefinido ou whatsapp_direto)
  if (lead && lead.tipo_origem !== 'trafego') {
    console.log(`[Z-API Webhook] 🔄 Updating existing lead ${leadId} with traffic source (method: ${trafficSource.detectionMethod})`);
    
    const fonteTrafego = trafficSource.source || 'meta_ads';
    
    await supabase
      .from('leads_juridicos')
      .update({
        tipo_origem: 'trafego',
        fonte_trafego: fonteTrafego,
        origem: 'Tráfego Pago',
        updated_at: new Date().toISOString()
      })
      .eq('id', leadId);
    
    // Também inscrever no traffic_followups se não estiver
    const { data: existingFollowup } = await supabase
      .from('traffic_followups')
      .select('id')
      .eq('lead_id', leadId)
      .maybeSingle();
    
    if (!existingFollowup) {
      const { data: leadData } = await supabase
        .from('leads_juridicos')
        .select('telefone')
        .eq('id', leadId)
        .single();
      
      if (leadData?.telefone) {
        const firstStageDelay = 3; // 3 minutos para o Menu de Triagem
        const nextMessageAt = new Date(Date.now() + firstStageDelay * 60 * 1000);
        
        await supabase.from('traffic_followups').insert({
          lead_id: leadId,
          subscriber_id: gerarSubscriberId(leadData.telefone),
          telefone: normalizePhone(leadData.telefone),
          status: 'new',
          automation_active: true,
          current_stage: null,
          next_message_at: nextMessageAt.toISOString()
        });
        
        console.log(`[Z-API Webhook] 📊 Existing lead ${leadId} enrolled in traffic followup`);
      }
    }
    
    // Registrar evento de atualização
    await supabase.from('system_events').insert({
      tipo: 'atribuicao',
      fonte: trafficSource.detectionMethod === 'message_content' ? 'message_detection' : 'meta_ads',
      acao: 'lead_atribuido_trafego',
      lead_id: leadId,
      dados: {
        previous_tipo_origem: lead.tipo_origem,
        new_tipo_origem: 'trafego',
        fonte_trafego: fonteTrafego,
        detection_method: trafficSource.detectionMethod,
        ad_id: trafficSource.adData?.adId,
        campaign: trafficSource.adData?.campaignName,
        ctwa_clid: trafficSource.adData?.ctwaClid
      }
    });
    
    console.log(`[Z-API Webhook] ✅ Lead ${leadId} updated to traffic source: ${fonteTrafego}`);
  } else if (lead?.tipo_origem === 'trafego') {
    console.log(`[Z-API Webhook] Lead ${leadId} already marked as traffic, no update needed`);
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
