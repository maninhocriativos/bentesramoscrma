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

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const payload = await req.json();
    console.log('ManyChat Webhook recebido:', JSON.stringify(payload, null, 2));

    // ManyChat envia diferentes tipos de eventos
    // Estrutura típica: { subscriber, message, page_id, ... }
    const {
      subscriber,
      message,
      page_id,
      last_input_text,
      custom_fields,
    } = payload;

    if (!subscriber) {
      console.log('Payload sem subscriber, ignorando');
      return new Response(JSON.stringify({ success: true, message: 'No subscriber data' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const subscriberId = subscriber.id?.toString() || subscriber.user_id?.toString();
    const subscriberNome = subscriber.name || 
      `${subscriber.first_name || ''} ${subscriber.last_name || ''}`.trim() || 
      'Desconhecido';
    const subscriberFoto = subscriber.profile_pic || subscriber.picture;
    const canal = subscriber.source || subscriber.channel || 'facebook';
    const telefone = subscriber.phone || custom_fields?.phone;
    const email = subscriber.email || custom_fields?.email;

    // Upsert subscriber
    const { data: subscriberData, error: subscriberError } = await supabase
      .from('manychat_subscribers')
      .upsert({
        subscriber_id: subscriberId,
        nome: subscriberNome,
        foto: subscriberFoto,
        telefone: telefone,
        email: email,
        canal: canal,
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
    const messageContent = last_input_text || message?.text || message?.content;
    
    if (messageContent) {
      const messageType = message?.type || 'text';
      
      const { data: messageData, error: messageError } = await supabase
        .from('manychat_mensagens')
        .insert({
          subscriber_id: subscriberId,
          subscriber_nome: subscriberNome,
          subscriber_foto: subscriberFoto,
          canal: canal,
          conteudo: messageContent,
          tipo: messageType,
          direcao: 'entrada',
          lead_id: subscriberData?.lead_id || null,
          metadata: {
            page_id,
            custom_fields,
            raw_message: message,
          },
        })
        .select()
        .single();

      if (messageError) {
        console.error('Erro ao salvar mensagem:', messageError);
      } else {
        console.log('Mensagem salva:', messageData);
      }
    }

    // Responder com sucesso para o ManyChat
    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'Webhook processado com sucesso',
        subscriber_id: subscriberId,
      }), 
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );

  } catch (error) {
    console.error('Erro no webhook ManyChat:', error);
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
