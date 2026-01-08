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

    const { action, subscriberId, message, searchTerm } = await req.json();
    console.log(`ManyChat action: ${action}`, { subscriberId, searchTerm });

    const headers = {
      'Authorization': `Bearer ${MANYCHAT_API_KEY}`,
      'Content-Type': 'application/json',
    };

    let result;

    switch (action) {
      case 'buscar_por_nome': {
        // Busca subscribers por nome
        const url = new URL(`${MANYCHAT_API_URL}/fb/subscriber/findByName`);
        url.searchParams.append('name', searchTerm);
        
        const response = await fetch(url.toString(), {
          method: 'GET',
          headers,
        });
        
        const data = await response.json();
        console.log('Busca por nome:', data);
        
        if (data.status === 'success' && data.data) {
          result = {
            status: 'success',
            data: data.data.map((sub: any) => ({
              id: sub.id,
              nome: sub.name || `${sub.first_name || ''} ${sub.last_name || ''}`.trim(),
              foto: sub.profile_pic,
              canal: sub.subscribed_source || 'facebook',
              telefone: sub.phone,
              email: sub.email,
            })),
          };
        } else {
          result = data;
        }
        break;
      }

      case 'buscar_por_telefone': {
        // Busca subscriber por telefone
        const url = new URL(`${MANYCHAT_API_URL}/fb/subscriber/findBySystemField`);
        url.searchParams.append('field_name', 'phone');
        url.searchParams.append('field_value', searchTerm);
        
        const response = await fetch(url.toString(), {
          method: 'GET',
          headers,
        });
        
        const data = await response.json();
        console.log('Busca por telefone:', data);
        result = data;
        break;
      }

      case 'buscar_subscriber': {
        // Busca informações de um subscriber específico por ID
        const url = new URL(`${MANYCHAT_API_URL}/fb/subscriber/getInfo`);
        url.searchParams.append('subscriber_id', subscriberId);
        
        const response = await fetch(url.toString(), {
          method: 'GET',
          headers,
        });
        
        const data = await response.json();
        console.log('Subscriber info raw:', JSON.stringify(data));
        
        // Normalizar resposta para extrair nome corretamente
        if (data.status === 'success' && data.data) {
          const sub = data.data;
          const nome = sub.name || `${sub.first_name || ''} ${sub.last_name || ''}`.trim() || null;
          const telefone = sub.whatsapp_phone || sub.phone || sub.wa_id || null;
          
          result = {
            status: 'success',
            data: {
              ...sub,
              nome,
              name: nome,
              telefone,
              phone: telefone,
            }
          };
        } else {
          result = data;
        }
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
        const body = await req.json();
        const response = await fetch(`${MANYCHAT_API_URL}/fb/subscriber/addTag`, {
          method: 'POST',
          headers,
          body: JSON.stringify({
            subscriber_id: subscriberId,
            tag_id: body.tagId,
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
