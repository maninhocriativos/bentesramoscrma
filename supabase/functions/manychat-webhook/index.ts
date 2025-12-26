import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

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
    console.log('ManyChat Webhook recebido:', JSON.stringify(payload, null, 2));

    let subscriberId: string | undefined;
    let subscriberNome: string | undefined;
    let telefone: string | undefined;
    let messageContent: string | undefined;
    let direcao = 'entrada';
    let canal = 'whatsapp';
    let metadata: Record<string, unknown> = {};

    // Formato customizado do usuário
    if (payload['Id do Manychat'] || payload['Nome do Usuário']) {
      subscriberId = payload['Id do Manychat']?.toString();
      subscriberNome = payload['Nome do Usuário'] || 'Desconhecido';
      telefone = payload['Numero Whatsapp'];
      
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
      };
      console.log('Formato customizado detectado, direção:', direcao);
    } 
    // Formato padrão ManyChat
    else if (payload.subscriber) {
      const { subscriber, message, page_id, last_input_text, custom_fields } = payload;
      subscriberId = subscriber.id?.toString() || subscriber.user_id?.toString();
      subscriberNome = subscriber.name || 
        `${subscriber.first_name || ''} ${subscriber.last_name || ''}`.trim() || 
        'Desconhecido';
      telefone = subscriber.phone || custom_fields?.phone;
      messageContent = last_input_text || message?.text || message?.content;
      canal = subscriber.source || subscriber.channel || 'facebook';
      metadata = {
        page_id,
        custom_fields,
        raw_message: message,
        subscriber_foto: subscriber.profile_pic || subscriber.picture,
        email: subscriber.email || custom_fields?.email,
      };
      console.log('Formato padrão ManyChat detectado');
    }
    // Formato simplificado
    else {
      subscriberId = payload.subscriber_id?.toString() || payload.id?.toString() || `manual_${Date.now()}`;
      subscriberNome = payload.nome || payload.name || 'Desconhecido';
      telefone = payload.telefone || payload.phone || payload.whatsapp;
      messageContent = payload.mensagem || payload.message || payload.pergunta;
      metadata = { raw: payload };
      console.log('Formato simplificado detectado');
    }

    if (!subscriberId) {
      console.log('Nenhum subscriber_id encontrado, gerando um');
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
      console.log('Lead já vinculado ao subscriber:', leadId);
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
          console.log('Lead encontrado por telefone:', leadByPhone.nome, leadId);
        }
      }
      
      // Se não encontrou por telefone, buscar por nome
      if (!leadId && subscriberNome && subscriberNome !== 'Desconhecido') {
        const { data: leadByName } = await supabase
          .from('leads_juridicos')
          .select('id, nome')
          .ilike('nome', `%${subscriberNome}%`)
          .limit(1)
          .maybeSingle();
        
        if (leadByName) {
          leadId = leadByName.id;
          console.log('Lead encontrado por nome:', leadByName.nome, leadId);
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
      console.error('Erro ao salvar subscriber:', subscriberError);
    } else {
      console.log('Subscriber salvo/atualizado:', subscriberData);
    }

    // Salvar mensagem se houver conteúdo
    if (messageContent) {
      const { data: messageData, error: messageError } = await supabase
        .from('manychat_mensagens')
        .insert({
          subscriber_id: subscriberId,
          subscriber_nome: subscriberNome,
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
        console.error('Erro ao salvar mensagem:', messageError);
      } else {
        console.log('Mensagem salva:', messageData);
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
      console.error('Erro ao registrar evento:', eventError);
    } else {
      console.log('Evento registrado no system_events');
    }

    // Responder com sucesso
    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'Webhook processado com sucesso',
        subscriber_id: subscriberId,
        subscriber_nome: subscriberNome,
        lead_id: leadId,
      }), 
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );

  } catch (error) {
    console.error('Erro no webhook ManyChat:', error);

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
      console.error('Erro ao registrar evento de erro:', e);
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
