import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Função para detectar automaticamente o canal baseado no payload
function detectChannel(payload: Record<string, unknown>): string {
  // 1. Campo explícito de canal
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
    
    // Detectar por campos específicos do subscriber
    if (subscriber.ig_id || subscriber.instagram_id) return 'instagram';
    if (subscriber.whatsapp_phone || subscriber.wa_phone) return 'whatsapp';
    if (subscriber.messenger_id || subscriber.psid) return 'facebook';
  }

  // 3. Verificar por campos específicos de cada plataforma no payload raiz
  // Instagram
  if (payload.ig_id || payload.instagram_id || payload.ig_user_id) {
    return 'instagram';
  }
  // WhatsApp
  if (payload.wa_id || payload.whatsapp_id || payload['Numero Whatsapp'] || payload.whatsapp_phone) {
    return 'whatsapp';
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

  // 5. Verificar por padrão de telefone (WhatsApp geralmente tem telefone)
  const telefone = payload.telefone || payload.phone || payload['Numero Whatsapp'];
  if (telefone && String(telefone).match(/^\+?\d{10,15}$/)) {
    return 'whatsapp';
  }

  // 6. Verificar custom_fields
  const customFields = payload.custom_fields as Record<string, unknown> | undefined;
  if (customFields) {
    if (customFields.channel) return normalizeChannel(String(customFields.channel));
    if (customFields.source) return normalizeChannel(String(customFields.source));
  }

  // 7. Verificar por palavras-chave no payload inteiro
  const payloadStr = JSON.stringify(payload).toLowerCase();
  if (payloadStr.includes('instagram') || payloadStr.includes('"ig_')) {
    return 'instagram';
  }
  if (payloadStr.includes('whatsapp') || payloadStr.includes('"wa_')) {
    return 'whatsapp';
  }
  if (payloadStr.includes('messenger') || payloadStr.includes('facebook')) {
    return 'facebook';
  }

  // Default
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
      subscriberNome = subscriber.name || 
        `${subscriber.first_name || ''} ${subscriber.last_name || ''}`.trim() || 
        'Desconhecido';
      telefone = subscriber.phone || subscriber.whatsapp_phone || custom_fields?.phone;
      email = subscriber.email || custom_fields?.email;
      subscriberFoto = subscriber.profile_pic || subscriber.picture || subscriber.avatar;
      messageContent = last_input_text || message?.text || message?.content;
      
      metadata = {
        page_id,
        custom_fields,
        raw_message: message,
        ig_id: subscriber.ig_id,
        psid: subscriber.psid,
        wa_id: subscriber.wa_id,
        source_format: 'manychat_standard',
      };
      console.log('📋 Formato padrão ManyChat detectado');
    }
    // Formato simplificado / genérico
    else {
      subscriberId = payload.subscriber_id?.toString() || payload.id?.toString() || `manual_${Date.now()}`;
      subscriberNome = payload.nome || payload.name || 'Desconhecido';
      telefone = payload.telefone || payload.phone || payload.whatsapp;
      email = payload.email;
      subscriberFoto = payload.foto || payload.picture || payload.avatar;
      messageContent = payload.mensagem || payload.message || payload.pergunta || payload.text;
      direcao = payload.direcao || payload.direction || 'entrada';
      
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
      const { data: messageData, error: messageError } = await supabase
        .from('manychat_mensagens')
        .insert({
          subscriber_id: subscriberId,
          subscriber_nome: subscriberNome,
          subscriber_foto: subscriberFoto,
          canal: canal,
          conteudo: messageContent,
          tipo: 'text',
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
      }
    }

    // REGISTRAR EVENTO NO SYSTEM_EVENTS para aparecer no API Hub
    const { error: eventError } = await supabase
      .from('system_events')
      .insert({
        tipo: 'mensagem',
        fonte: 'manychat',
        acao: direcao === 'entrada' ? 'mensagem_recebida' : 'mensagem_enviada',
        entidade_tipo: 'manychat_mensagem',
        entidade_id: subscriberId,
        lead_id: leadId,
        dados: {
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