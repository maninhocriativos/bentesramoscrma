import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-api-key',
};

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const MANYCHAT_API_KEY = Deno.env.get('MANYCHAT_API_KEY')!;

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    const body = await req.json();
    console.log('[ISA-REPLY] Payload recebido:', JSON.stringify(body));

    // Extrair dados do payload
    const subscriberId = body.subscriber_id?.toString().replace(/^\[|\]$/g, '').trim();
    const mensagem = body.last_input_text || body.message || body.text || '';
    const nome = body.full_name || body.name || body.first_name || 'Cliente';
    const telefone = body.phone || body.wa_id || '';
    const canal = body.channel || 'whatsapp';

    if (!subscriberId) {
      console.log('[ISA-REPLY] Subscriber ID não encontrado');
      return new Response(JSON.stringify({ 
        success: false, 
        error: 'subscriber_id obrigatório' 
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (!mensagem || mensagem.trim() === '') {
      console.log('[ISA-REPLY] Mensagem vazia, ignorando');
      return new Response(JSON.stringify({ 
        success: true, 
        skipped: true,
        reason: 'mensagem vazia' 
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log('[ISA-REPLY] Processando mensagem de:', nome, '- Mensagem:', mensagem.substring(0, 100));

    // Buscar subscriber e lead vinculado para contexto
    const { data: subscriber } = await supabase
      .from('manychat_subscribers')
      .select('lead_id, nome')
      .eq('subscriber_id', subscriberId)
      .maybeSingle();

    // Buscar ou criar thread para o subscriber
    let threadId: string | null = null;
    const { data: threadData } = await supabase
      .from('app_settings')
      .select('value')
      .eq('key', `manychat_thread_${subscriberId}`)
      .maybeSingle();

    if (threadData) {
      threadId = threadData.value;
      console.log('[ISA-REPLY] Thread existente encontrada:', threadId);
    }

    // Buscar contexto do lead para enriquecer a mensagem
    let contextPrefix = '';
    if (subscriber?.lead_id) {
      const { data: lead } = await supabase
        .from('leads_juridicos')
        .select('nome, status, tipo_acao, resumo_ia, telefone, email')
        .eq('id', subscriber.lead_id)
        .maybeSingle();

      if (lead) {
        contextPrefix = `[CONTEXTO DO CLIENTE - Nome: ${lead.nome || nome}, Status: ${lead.status || 'Novo'}, Tipo de Ação: ${lead.tipo_acao || 'Não definido'}]\n\n`;
      }
    }

    // Detectar se é áudio/mídia
    const isMedia = mensagem.match(/\.(ogg|mp3|wav|jpg|jpeg|png|gif|mp4|webm|pdf)/i);
    const mediaNote = isMedia ? '[O cliente enviou um arquivo de mídia/áudio. Peça para descrever em texto]\n\n' : '';

    // Montar mensagem com contexto
    const mensagemCompleta = `${contextPrefix}${mediaNote}[Mensagem do cliente via WhatsApp - responda de forma curta, máximo 300 caracteres]\n\nCliente (${nome}): ${mensagem}`;

    console.log('[ISA-REPLY] Chamando ai-chat com o agente GPT...');

    // Chamar a edge function ai-chat que já tem o agente GPT configurado
    const aiChatResponse = await fetch(`${supabaseUrl}/functions/v1/ai-chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${supabaseServiceKey}`,
      },
      body: JSON.stringify({
        message: mensagemCompleta,
        threadId: threadId,
      }),
    });

    if (!aiChatResponse.ok) {
      const errorText = await aiChatResponse.text();
      console.error('[ISA-REPLY] Erro ai-chat:', aiChatResponse.status, errorText);
      throw new Error(`ai-chat error: ${aiChatResponse.status} - ${errorText}`);
    }

    const aiData = await aiChatResponse.json();
    let respostaIsa = aiData.response || '';
    const newThreadId = aiData.threadId;

    console.log('[ISA-REPLY] Resposta do agente GPT:', respostaIsa?.substring(0, 200));
    console.log('[ISA-REPLY] Thread ID:', newThreadId);

    // Salvar thread ID para manter contexto
    if (newThreadId && newThreadId !== threadId) {
      await supabase.from('app_settings').upsert({
        key: `manychat_thread_${subscriberId}`,
        value: newThreadId,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'key' });
      console.log('[ISA-REPLY] Thread salva para próximas mensagens');
    }

    if (!respostaIsa) {
      console.error('[ISA-REPLY] Resposta vazia do agente');
      throw new Error('Resposta vazia do agente GPT');
    }

    // Truncar resposta para WhatsApp se necessário (máximo 4096, mas queremos ~300 para UX)
    if (respostaIsa.length > 500) {
      respostaIsa = respostaIsa.substring(0, 497) + '...';
    }

    // Salvar resposta no banco
    await supabase.from('manychat_mensagens').insert({
      subscriber_id: subscriberId,
      subscriber_nome: subscriber?.nome || nome,
      conteudo: respostaIsa,
      canal: canal,
      tipo: 'text',
      direcao: 'saida',
      lead_id: subscriber?.lead_id,
    });

    // Enviar resposta via ManyChat API com message_tag para contatos inativos
    console.log('[ISA-REPLY] Enviando para ManyChat...');
    
    // Primeiro tentar sem message_tag (para contatos ativos nas últimas 24h)
    let manychatResponse = await fetch('https://api.manychat.com/fb/sending/sendContent', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${MANYCHAT_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        subscriber_id: parseInt(subscriberId),
        data: {
          version: 'v2',
          content: {
            messages: [{ type: 'text', text: respostaIsa }]
          }
        }
      }),
    });

    let manychatResult = await manychatResponse.json();
    console.log('[ISA-REPLY] Resposta ManyChat:', JSON.stringify(manychatResult));

    // Se falhar por inatividade (código 3011), tentar com message_tag
    if (manychatResult.code === 3011 || manychatResult.status === 'error') {
      console.log('[ISA-REPLY] Tentando com message_tag ACCOUNT_UPDATE...');
      
      manychatResponse = await fetch('https://api.manychat.com/fb/sending/sendContent', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${MANYCHAT_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          subscriber_id: parseInt(subscriberId),
          message_tag: 'ACCOUNT_UPDATE',
          data: {
            version: 'v2',
            content: {
              messages: [{ type: 'text', text: respostaIsa }]
            }
          }
        }),
      });

      manychatResult = await manychatResponse.json();
      console.log('[ISA-REPLY] Resposta com message_tag:', JSON.stringify(manychatResult));
    }

    // Registrar evento no sistema
    await supabase.from('system_events').insert({
      tipo: 'ia_resposta',
      fonte: 'isa-reply-manychat',
      acao: 'resposta_gpt_enviada',
      lead_id: subscriber?.lead_id,
      dados: {
        subscriber_id: subscriberId,
        mensagem_recebida: mensagem.substring(0, 200),
        resposta_enviada: respostaIsa.substring(0, 500),
        thread_id: newThreadId,
        canal,
      },
      processado: true,
    });

    return new Response(JSON.stringify({
      success: true,
      resposta: respostaIsa,
      subscriber_id: subscriberId,
      thread_id: newThreadId,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('[ISA-REPLY] Erro:', error);
    
    return new Response(JSON.stringify({
      success: false,
      error: error instanceof Error ? error.message : 'Erro desconhecido',
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
