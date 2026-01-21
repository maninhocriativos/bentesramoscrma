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

    const body = await req.json();
    const { action, subscriberId, message, searchTerm, type } = body;
    console.log(`[ManyChat] Action: ${action}`, { subscriberId, type, messageLength: message?.length });

    const headers = {
      'Authorization': `Bearer ${MANYCHAT_API_KEY}`,
      'Content-Type': 'application/json',
    };

    let result;

    switch (action) {
      case 'buscar_por_nome': {
        const url = new URL(`${MANYCHAT_API_URL}/fb/subscriber/findByName`);
        url.searchParams.append('name', searchTerm);
        
        const response = await fetch(url.toString(), {
          method: 'GET',
          headers,
        });
        
        const data = await response.json();
        console.log('[ManyChat] Busca por nome:', data.status);
        
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
        const url = new URL(`${MANYCHAT_API_URL}/fb/subscriber/findBySystemField`);
        url.searchParams.append('field_name', 'phone');
        url.searchParams.append('field_value', searchTerm);
        
        const response = await fetch(url.toString(), {
          method: 'GET',
          headers,
        });
        
        const data = await response.json();
        console.log('[ManyChat] Busca por telefone:', data.status);
        result = data;
        break;
      }

      case 'buscar_subscriber': {
        const url = new URL(`${MANYCHAT_API_URL}/fb/subscriber/getInfo`);
        url.searchParams.append('subscriber_id', subscriberId);
        
        const response = await fetch(url.toString(), {
          method: 'GET',
          headers,
        });
        
        const data = await response.json();
        console.log('[ManyChat] Subscriber info:', data.status);
        
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
        // Tentar primeiro com sendContent (dentro da janela de 24h)
        console.log(`[ManyChat] Enviando mensagem para subscriber ${subscriberId}`);
        
        let sendSuccess = false;
        let sendResult: any = null;

        // Método 1: sendContent (para conversas ativas - janela 24h)
        try {
          const contentResponse = await fetch(`${MANYCHAT_API_URL}/fb/sending/sendContent`, {
            method: 'POST',
            headers,
            body: JSON.stringify({
              subscriber_id: parseInt(subscriberId) || subscriberId,
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
          
          sendResult = await contentResponse.json();
          console.log('[ManyChat] sendContent response:', JSON.stringify(sendResult));
          
          if (sendResult.status === 'success') {
            sendSuccess = true;
          }
        } catch (e) {
          console.log('[ManyChat] sendContent failed:', e);
        }

        // Método 2: sendFlow com message_tag se sendContent falhou (fora da janela 24h)
        if (!sendSuccess) {
          console.log('[ManyChat] Tentando com message_tag ACCOUNT_UPDATE...');
          try {
            const taggedResponse = await fetch(`${MANYCHAT_API_URL}/fb/sending/sendContent`, {
              method: 'POST',
              headers,
              body: JSON.stringify({
                subscriber_id: parseInt(subscriberId) || subscriberId,
                message_tag: 'ACCOUNT_UPDATE',
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
            
            sendResult = await taggedResponse.json();
            console.log('[ManyChat] sendContent with tag response:', JSON.stringify(sendResult));
            
            if (sendResult.status === 'success') {
              sendSuccess = true;
            }
          } catch (e) {
            console.log('[ManyChat] sendContent with tag failed:', e);
          }
        }

        // Método 3: API direta de WhatsApp se disponível
        if (!sendSuccess && body.phone) {
          console.log('[ManyChat] Tentando via WhatsApp API...');
          try {
            // Para WhatsApp, usar endpoint específico se disponível
            const waResponse = await fetch(`${MANYCHAT_API_URL}/fb/sending/sendContent`, {
              method: 'POST',
              headers,
              body: JSON.stringify({
                subscriber_id: parseInt(subscriberId) || subscriberId,
                data: {
                  version: 'v2',
                  content: {
                    type: 'whatsapp',
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
            
            const waResult = await waResponse.json();
            console.log('[ManyChat] WhatsApp response:', JSON.stringify(waResult));
            
            if (waResult.status === 'success') {
              sendSuccess = true;
              sendResult = waResult;
            }
          } catch (e) {
            console.log('[ManyChat] WhatsApp send failed:', e);
          }
        }

        result = sendResult || { status: 'error', message: 'Falha ao enviar mensagem' };
        
        if (sendSuccess) {
          console.log('[ManyChat] ✅ Mensagem enviada com sucesso');
        } else {
          console.log('[ManyChat] ❌ Falha no envio:', result);
        }
        break;
      }

      case 'buscar_tags': {
        const response = await fetch(`${MANYCHAT_API_URL}/fb/page/getTags`, {
          method: 'GET',
          headers,
        });
        result = await response.json();
        break;
      }

      case 'adicionar_tag': {
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
    console.error('[ManyChat] Erro:', error);
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
