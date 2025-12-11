import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const MANYCHAT_API_URL = 'https://api.manychat.com';

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const MANYCHAT_API_KEY = Deno.env.get('MANYCHAT_API_KEY');
    if (!MANYCHAT_API_KEY) {
      throw new Error('MANYCHAT_API_KEY não configurada');
    }

    const { action, subscriberId, message, pageId } = await req.json();
    console.log(`ManyChat action: ${action}`, { subscriberId, pageId });

    const headers = {
      'Authorization': `Bearer ${MANYCHAT_API_KEY}`,
      'Content-Type': 'application/json',
    };

    let result;

    switch (action) {
      case 'listar_subscribers': {
        // Lista todos os subscribers (contatos)
        const response = await fetch(`${MANYCHAT_API_URL}/fb/subscriber/getSubscribers`, {
          method: 'POST',
          headers,
          body: JSON.stringify({
            page_id: pageId,
          }),
        });
        result = await response.json();
        console.log('Subscribers listados:', result);
        break;
      }

      case 'buscar_subscriber': {
        // Busca informações de um subscriber específico
        const response = await fetch(`${MANYCHAT_API_URL}/fb/subscriber/getInfo`, {
          method: 'GET',
          headers,
        });
        
        // ManyChat usa query params para este endpoint
        const url = new URL(`${MANYCHAT_API_URL}/fb/subscriber/getInfo`);
        url.searchParams.append('subscriber_id', subscriberId);
        
        const infoResponse = await fetch(url.toString(), {
          method: 'GET',
          headers,
        });
        result = await infoResponse.json();
        console.log('Subscriber info:', result);
        break;
      }

      case 'enviar_mensagem': {
        // Envia mensagem para um subscriber
        const response = await fetch(`${MANYCHAT_API_URL}/fb/sending/sendContent`, {
          method: 'POST',
          headers,
          body: JSON.stringify({
            subscriber_id: subscriberId,
            data: {
              version: 'v2',
              content: {
                messages: [
                  {
                    type: 'text',
                    text: message,
                  },
                ],
              },
            },
          }),
        });
        result = await response.json();
        console.log('Mensagem enviada:', result);
        break;
      }

      case 'buscar_conversas': {
        // Busca histórico de conversas usando a API de threads
        // ManyChat não tem um endpoint direto para histórico, mas podemos usar custom fields
        // ou integrar com webhooks para armazenar mensagens
        
        // Por enquanto, vamos buscar os subscribers e seus dados
        const subscribersResponse = await fetch(`${MANYCHAT_API_URL}/fb/subscriber/getSubscribers`, {
          method: 'POST',
          headers,
          body: JSON.stringify({
            page_id: pageId,
          }),
        });
        
        const subscribersData = await subscribersResponse.json();
        
        if (subscribersData.status === 'success' && subscribersData.data) {
          result = {
            status: 'success',
            data: subscribersData.data.map((sub: any) => ({
              id: sub.id,
              nome: sub.name || sub.first_name + ' ' + sub.last_name,
              foto: sub.profile_pic,
              canal: sub.subscribed_source || 'facebook',
              ultimaMensagem: sub.last_interaction,
              telefone: sub.phone,
              email: sub.email,
            })),
          };
        } else {
          result = subscribersData;
        }
        break;
      }

      case 'buscar_tags': {
        // Busca todas as tags disponíveis
        const response = await fetch(`${MANYCHAT_API_URL}/fb/page/getTags`, {
          method: 'GET',
          headers,
        });
        result = await response.json();
        break;
      }

      case 'adicionar_tag': {
        const { tagId } = await req.json();
        const response = await fetch(`${MANYCHAT_API_URL}/fb/subscriber/addTag`, {
          method: 'POST',
          headers,
          body: JSON.stringify({
            subscriber_id: subscriberId,
            tag_id: tagId,
          }),
        });
        result = await response.json();
        break;
      }

      default:
        throw new Error(`Ação não reconhecida: ${action}`);
    }

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Erro ManyChat:', error);
    return new Response(
      JSON.stringify({ 
        status: 'error', 
        error: error instanceof Error ? error.message : 'Erro desconhecido' 
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});
