import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Função para detectar automaticamente o canal baseado no payload
function detectChannel(payload: Record<string, unknown>): string {
  // 1. Campo explícito de canal (prioridade máxima)
  if (payload.canal) {
    return normalizeChannel(String(payload.canal));
  }
  if (payload.channel) {
    return normalizeChannel(String(payload.channel));
  }

  // 2. Verificar no subscriber
  const subscriber = payload.subscriber as Record<string, unknown> | undefined;
  if (subscriber) {
    if (subscriber.source) return normalizeChannel(String(subscriber.source));
    if (subscriber.channel) return normalizeChannel(String(subscriber.channel));
    
    // IMPORTANTE: WhatsApp tem prioridade quando wa_id está presente
    if (subscriber.whatsapp_phone || subscriber.wa_phone || subscriber.wa_id) return 'whatsapp';
    if (subscriber.ig_id || subscriber.instagram_id) return 'instagram';
    if (subscriber.messenger_id || subscriber.psid) return 'facebook';
  }

  // 3. Verificar por campos específicos de cada plataforma no payload raiz
  // PRIORIZAR WhatsApp quando tem telefone brasileiro (começa com 55)
  const telefone = payload.telefone || payload.phone || payload['Numero Whatsapp'] || 
    (subscriber as Record<string, unknown>)?.phone || 
    (subscriber as Record<string, unknown>)?.whatsapp_phone;
  
  if (telefone) {
    const tel = String(telefone).replace(/\D/g, '');
    // Telefone brasileiro (55) ou com formato internacional típico de WhatsApp
    if (tel.startsWith('55') && tel.length >= 12) {
      return 'whatsapp';
    }
    // Qualquer telefone com 10+ dígitos provavelmente é WhatsApp
    if (tel.length >= 10) {
      return 'whatsapp';
    }
  }

  // WhatsApp explícito
  if (payload.wa_id || payload.whatsapp_id || payload['Numero Whatsapp'] || payload.whatsapp_phone) {
    return 'whatsapp';
  }
  // Instagram
  if (payload.ig_id || payload.instagram_id || payload.ig_user_id) {
    return 'instagram';
  }
  // Facebook Messenger
  if (payload.psid || payload.messenger_id || payload.page_id) {
    return 'facebook';
  }

  // 4. Verificar na mensagem
  const message = payload.message as Record<string, unknown> | undefined;
  if (message) {
    if (message.source) return normalizeChannel(String(message.source));
    if (message.channel) return normalizeChannel(String(message.channel));
  }

  // 5. Verificar custom_fields
  const customFields = payload.custom_fields as Record<string, unknown> | undefined;
  if (customFields) {
    if (customFields.channel) return normalizeChannel(String(customFields.channel));
    if (customFields.source) return normalizeChannel(String(customFields.source));
  }

  // 6. Verificar por palavras-chave no payload inteiro (último recurso)
  const payloadStr = JSON.stringify(payload).toLowerCase();
  if (payloadStr.includes('"wa_') || payloadStr.includes('whatsapp')) {
    return 'whatsapp';
  }
  if (payloadStr.includes('instagram') || payloadStr.includes('"ig_')) {
    return 'instagram';
  }
  if (payloadStr.includes('messenger')) {
    return 'facebook';
  }

  // Default: se tem telefone, assume WhatsApp (mais comum)
  if (telefone) {
    return 'whatsapp';
  }

  return 'facebook';
}

// Normaliza o nome do canal para formato padrão
function normalizeChannel(channel: string): string {
  const normalized = channel.toLowerCase().trim();
  
  // Instagram
  if (normalized.includes('instagram') || normalized === 'ig') {
    return 'instagram';
  }
  
  // WhatsApp
  if (normalized.includes('whatsapp') || normalized === 'wa' || normalized === 'waba') {
    return 'whatsapp';
  }
  
  // Telegram
  if (normalized.includes('telegram') || normalized === 'tg') {
    return 'telegram';
  }
  
  // SMS
  if (normalized === 'sms') {
    return 'sms';
  }
  
  // Facebook/Messenger
  if (normalized.includes('facebook') || normalized.includes('messenger') || normalized === 'fb') {
    return 'facebook';
  }
  
  return normalized || 'facebook';
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  );

  try {
    const payload = await req.json();
    console.log('📩 ManyChat Webhook recebido:', JSON.stringify(payload, null, 2));

    let subscriberId: string | undefined;
    let subscriberNome: string | undefined;
    let subscriberFoto: string | undefined;
    let telefone: string | undefined;
    let email: string | undefined;
    let facebookLeadId: string | undefined;
    let messageContent: string | undefined;
    let direcao = 'entrada';
    let metadata: Record<string, unknown> = {};

    // Detectar canal automaticamente
    const canal = detectChannel(payload);
    console.log('📱 Canal detectado:', canal);

    // Formato customizado do usuário (Make.com)
    if (payload['Id do Manychat'] || payload['Nome do Usuário']) {
      subscriberId = payload['Id do Manychat']?.toString();
      subscriberNome = payload['Nome do Usuário'] || 'Desconhecido';
      telefone = payload['Numero Whatsapp'] || payload['Telefone'];
      
      if (payload['Resposta do Bot'] || payload['Direcao'] === 'saida') {
        messageContent = payload['Resposta do Bot'] || payload['Mensagem'];
        direcao = 'saida';
      } else {
        messageContent = payload['Pergunta do Usuário'] || payload['Mensagem'];
        direcao = 'entrada';
      }
      
      metadata = {
        thread_id: payload['Thread ID'],
        formato: payload['Formato'],
        interrupcao: payload['Interrupção'],
        source_format: 'custom_makecom',
      };
      console.log('📋 Formato customizado detectado, direção:', direcao);
    } 
    // Formato padrão ManyChat API
    else if (payload.subscriber) {
      const { subscriber, message, page_id, last_input_text, custom_fields } = payload;
      subscriberId = subscriber.id?.toString() || subscriber.user_id?.toString();
      
      // Limpar colchetes que vem do ManyChat
      const cleanBrackets = (val: unknown) => typeof val === 'string' ? val.replace(/^\[|\]$/g, '').trim() : val;
      
      subscriberNome = cleanBrackets(subscriber.name) as string || 
        `${cleanBrackets(subscriber.first_name) || ''} ${cleanBrackets(subscriber.last_name) || ''}`.trim() || 
        'Desconhecido';
      telefone = (cleanBrackets(subscriber.phone) || cleanBrackets(subscriber.whatsapp_phone) || cleanBrackets(custom_fields?.phone)) as string | undefined;
      email = (cleanBrackets(subscriber.email) || cleanBrackets(custom_fields?.email)) as string | undefined;
      subscriberFoto = (subscriber.profile_pic || subscriber.picture || subscriber.avatar) as string | undefined;
      messageContent = (cleanBrackets(last_input_text) || cleanBrackets(message?.text) || cleanBrackets(message?.content)) as string | undefined;
      
      // Extrair facebook_lead_id para atribuição de conversões (Meta CAPI)
      facebookLeadId = (cleanBrackets(payload.facebook_lead_id) || 
        cleanBrackets(payload.fb_lead_id) || 
        cleanBrackets(payload.lead_id) ||
        cleanBrackets(custom_fields?.facebook_lead_id) ||
        cleanBrackets(custom_fields?.fb_lead_id)) as string | undefined;
      
      if (facebookLeadId) {
        console.log('📊 Facebook Lead ID capturado:', facebookLeadId);
      }
      
      metadata = {
        page_id,
        custom_fields,
        raw_message: message,
        ig_id: subscriber.ig_id,
        psid: subscriber.psid,
        wa_id: subscriber.wa_id,
        facebook_lead_id: facebookLeadId,
        source_format: 'manychat_standard',
      };
      console.log('📋 Formato padrão ManyChat detectado');
    }
    // Formato simplificado / genérico
    else {
      // Função para limpar colchetes
      const cleanBrackets = (val: unknown) => typeof val === 'string' ? val.replace(/^\[|\]$/g, '').trim() : val;
      
      const rawSubscriberId = payload.subscriber_id?.toString() || payload.id?.toString();
      subscriberId = rawSubscriberId ? cleanBrackets(rawSubscriberId) as string : `manual_${Date.now()}`;
      
      // Suportar first_name + last_name além de nome/name
      const firstName = cleanBrackets(payload.first_name || payload.name?.split(' ')[0]) as string || '';
      const lastName = cleanBrackets(payload.last_name || '') as string || '';
      const fullName = cleanBrackets(payload.nome || payload.name || payload.full_name) as string;
      
      subscriberNome = fullName || 
        (firstName || lastName ? `${firstName} ${lastName}`.trim() : 'Desconhecido');
      
      telefone = cleanBrackets(payload.telefone || payload.phone || payload.whatsapp || payload['Numero Whatsapp']) as string | undefined;
      email = cleanBrackets(payload.email) as string | undefined;
      subscriberFoto = (payload.foto || payload.picture || payload.avatar) as string | undefined;
      messageContent = cleanBrackets(payload.mensagem || payload.message || payload.pergunta || payload.text || payload.last_input_text) as string | undefined;
      direcao = (payload.direcao || payload.direction || 'entrada') as string;
      
      metadata = { 
        raw: payload,
        source_format: 'simplified',
      };
      console.log('📋 Formato simplificado detectado');
    }

    if (!subscriberId) {
      console.log('⚠️ Nenhum subscriber_id encontrado, gerando um');
      subscriberId = `webhook_${Date.now()}`;
    }

    // Tentar vincular automaticamente com lead existente
    let leadId: string | null = null;
    
    // Primeiro, verificar se já existe subscriber com lead vinculado
    const { data: existingSubscriber } = await supabase
      .from('manychat_subscribers')
      .select('lead_id')
      .eq('subscriber_id', subscriberId)
      .maybeSingle();
    
    if (existingSubscriber?.lead_id) {
      leadId = existingSubscriber.lead_id;
      console.log('🔗 Lead já vinculado ao subscriber:', leadId);
    } else {
      // Buscar lead pelo telefone (normalizado)
      if (telefone) {
        const telefoneLimpo = telefone.replace(/\D/g, '');
        const { data: leadByPhone } = await supabase
          .from('leads_juridicos')
          .select('id, nome')
          .or(`telefone.ilike.%${telefoneLimpo.slice(-9)}%,telefone.ilike.%${telefoneLimpo}%`)
          .limit(1)
          .maybeSingle();
        
        if (leadByPhone) {
          leadId = leadByPhone.id;
          console.log('📞 Lead encontrado por telefone:', leadByPhone.nome, leadId);
        }
      }
      
      // Se não encontrou por telefone, buscar por email
      if (!leadId && email) {
        const { data: leadByEmail } = await supabase
          .from('leads_juridicos')
          .select('id, nome')
          .ilike('email', email)
          .limit(1)
          .maybeSingle();
        
        if (leadByEmail) {
          leadId = leadByEmail.id;
          console.log('📧 Lead encontrado por email:', leadByEmail.nome, leadId);
        }
      }
      
      // Se não encontrou por email, buscar por nome
      if (!leadId && subscriberNome && subscriberNome !== 'Desconhecido') {
        const { data: leadByName } = await supabase
          .from('leads_juridicos')
          .select('id, nome')
          .ilike('nome', `%${subscriberNome}%`)
          .limit(1)
          .maybeSingle();
        
        if (leadByName) {
          leadId = leadByName.id;
          console.log('👤 Lead encontrado por nome:', leadByName.nome, leadId);
        }
      }
      
      // 🆕 Se não encontrou lead, CRIAR automaticamente como "Lead Frio"
      // Importante: em canais como Facebook/Instagram, o ManyChat pode não enviar telefone/email/nome.
      // Para não perder a entrada, criamos um lead “fallback” usando o subscriber_id (apenas para direção de entrada).
      const canCreateFallbackLead =
        !!subscriberId &&
        typeof subscriberId === 'string' &&
        !subscriberId.startsWith('manual_') &&
        !subscriberId.startsWith('webhook_');

      const temDadosParaCriarLead =
        (subscriberNome && subscriberNome !== 'Desconhecido') || telefone || email || canCreateFallbackLead;

      if (!leadId && temDadosParaCriarLead && direcao === 'entrada') {
        const nomeDoLead = (subscriberNome && subscriberNome !== 'Desconhecido')
          ? subscriberNome
          : telefone
            ? `Contato ${telefone}`
            : `Contato ${canal} #${subscriberId}`;

        console.log('🆕 Criando novo lead automaticamente para:', nomeDoLead);

        // Determinar origem baseado no canal
        let origem = 'ManyChat';
        if (canal === 'instagram') origem = 'Instagram';
        else if (canal === 'facebook') origem = 'Facebook';
        else if (canal === 'whatsapp') origem = 'WhatsApp';
        else if (canal === 'telegram') origem = 'Telegram';

        const { data: newLead, error: leadError } = await supabase
          .from('leads_juridicos')
          .insert({
            nome: nomeDoLead,
            telefone: telefone || null,
            email: email || null,
            facebook_lead_id: facebookLeadId || null,
            status: 'Lead Frio',
            origem: origem,
            resumo_ia: `Lead criado automaticamente via ${origem}. Primeiro contato em ${new Date().toLocaleDateString('pt-BR')}.`,
          })
          .select()
          .single();

        if (leadError) {
          console.error('❌ Erro ao criar lead:', leadError);
        } else {
          leadId = newLead.id;
          console.log('✅ Novo lead criado com sucesso:', newLead.nome, leadId);

          // Registrar evento de criação de lead (entidade_id é UUID do lead, não subscriber_id)
          await supabase.from('system_events').insert({
            tipo: 'lead',
            fonte: 'manychat',
            acao: 'lead_criado_automatico',
            entidade_tipo: 'lead',
            entidade_id: leadId,
            lead_id: leadId,
            dados: {
              nome: nomeDoLead,
              telefone: telefone,
              email: email,
              canal: canal,
              origem: origem,
              subscriber_id: subscriberId,
            },
            processado: true,
          });

          // Criar follow-up base (mantém consistência com o fluxo do api-hub)
          await supabase.from('lead_followups').insert({
            lead_id: leadId,
            subscriber_id: subscriberId,
            canal: canal,
            primeiro_contato_em: new Date().toISOString(),
            status: 'aguardando',
          });
        }
      }
    }

    // Upsert subscriber com lead_id vinculado
    const { data: subscriberData, error: subscriberError } = await supabase
      .from('manychat_subscribers')
      .upsert({
        subscriber_id: subscriberId,
        nome: subscriberNome,
        telefone: telefone,
        email: email,
        foto: subscriberFoto,
        canal: canal,
        lead_id: leadId,
        ultima_interacao: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }, {
        onConflict: 'subscriber_id',
      })
      .select()
      .single();

    if (subscriberError) {
      console.error('❌ Erro ao salvar subscriber:', subscriberError);
    } else {
      console.log('✅ Subscriber salvo/atualizado:', subscriberData);
    }

    // Salvar mensagem se houver conteúdo
    if (messageContent) {
      // Detectar tipo de mídia
      let tipoMensagem = 'text';
      const contentLower = messageContent.toString().toLowerCase();
      
      if (contentLower.match(/\.(ogg|mp3|wav|m4a|aac|opus)(\?|$)/)) {
        tipoMensagem = 'audio';
      } else if (contentLower.match(/\.(jpg|jpeg|png|gif|webp)(\?|$)/)) {
        tipoMensagem = 'image';
      } else if (contentLower.match(/\.(mp4|webm|mov)(\?|$)/)) {
        tipoMensagem = 'video';
      } else if (contentLower.match(/\.(pdf|doc|docx|xls|xlsx)(\?|$)/)) {
        tipoMensagem = 'document';
      }
      
      console.log('📎 Tipo de mensagem detectado:', tipoMensagem);
      
      const { data: messageData, error: messageError } = await supabase
        .from('manychat_mensagens')
        .insert({
          subscriber_id: subscriberId,
          subscriber_nome: subscriberNome,
          subscriber_foto: subscriberFoto,
          canal: canal,
          conteudo: messageContent,
          tipo: tipoMensagem,
          direcao: direcao,
          lead_id: leadId,
          metadata: metadata,
        })
        .select()
        .single();

      if (messageError) {
        console.error('❌ Erro ao salvar mensagem:', messageError);
      } else {
        console.log('✅ Mensagem salva:', messageData);
        
        // 🤖 CHAMAR ISA AUTO-PROCESS para processar a mensagem automaticamente
        // Apenas para mensagens de entrada com lead vinculado
        // NÃO processar mensagens do próprio bot (evita loop)
        const contentLower = messageContent?.toLowerCase().trim() || '';
        const isOwnBotMessage = contentLower.startsWith('bot diz:') || 
                                 contentLower.startsWith('isa diz:') ||
                                 contentLower.startsWith('[bot]') ||
                                 contentLower.startsWith('[isa]');
        
        if (direcao === 'entrada' && leadId && !isOwnBotMessage) {
          console.log('🤖 Acionando Isa Auto-Process...');
          try {
            const isaResponse = await fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/isa-auto-process`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
              },
              body: JSON.stringify({
                lead_id: leadId,
                subscriber_id: subscriberId,
                mensagem: messageContent,
                canal: canal,
                tipo_mensagem: tipoMensagem,
              }),
            });
            
            if (isaResponse.ok) {
              const isaResult = await isaResponse.json();
              console.log('✅ Isa processou a mensagem:', isaResult.analise);
              console.log(`   - Áudio transcrito: ${isaResult.audio_transcrito || false}`);
              console.log(`   - Ações executadas: ${isaResult.acoes_executadas?.length || 0}`);
              console.log(`   - Resposta enviada: ${isaResult.resposta_enviada}`);
            } else {
              console.error('⚠️ Erro no Isa Auto-Process:', await isaResponse.text());
            }
          } catch (isaError) {
            console.error('⚠️ Erro ao chamar Isa Auto-Process:', isaError);
            // Não bloquear o webhook por erro na Isa
          }
        }
      }
    }

    // REGISTRAR EVENTO NO SYSTEM_EVENTS para aparecer no API Hub
    // NOTA: entidade_id precisa ser UUID válido ou null
    const { error: eventError } = await supabase
      .from('system_events')
      .insert({
        tipo: 'mensagem',
        fonte: 'manychat',
        acao: direcao === 'entrada' ? 'mensagem_recebida' : 'mensagem_enviada',
        entidade_tipo: 'manychat_mensagem',
        entidade_id: leadId, // Usar lead_id (UUID) em vez de subscriber_id (string)
        lead_id: leadId,
        dados: {
          subscriber_id: subscriberId, // Guardar subscriber_id nos dados
          subscriber_nome: subscriberNome,
          conteudo: messageContent?.substring(0, 200),
          canal: canal,
          telefone: telefone,
        },
        metadata: metadata,
        processado: true,
      });

    if (eventError) {
      console.error('❌ Erro ao registrar evento:', eventError);
    } else {
      console.log('✅ Evento registrado no system_events');
    }

    // Responder com sucesso
    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'Webhook processado com sucesso',
        subscriber_id: subscriberId,
        subscriber_nome: subscriberNome,
        canal: canal,
        lead_id: leadId,
      }), 
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );

  } catch (error) {
    console.error('❌ Erro no webhook ManyChat:', error);

    // Registrar erro no system_events
    try {
      await supabase.from('system_events').insert({
        tipo: 'erro',
        fonte: 'manychat',
        acao: 'webhook_error',
        erro: error instanceof Error ? error.message : 'Erro desconhecido',
        processado: false,
      });
    } catch (e) {
      console.error('❌ Erro ao registrar evento de erro:', e);
    }

    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error instanceof Error ? error.message : 'Erro desconhecido' 
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});