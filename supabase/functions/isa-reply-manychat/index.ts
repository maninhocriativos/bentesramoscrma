import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-api-key',
};

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const MANYCHAT_API_KEY = Deno.env.get('MANYCHAT_API_KEY')!;
const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY')!;

const SYSTEM_PROMPT = `Você é a Isa, assistente virtual do escritório de advocacia Bentes Ramos. Você é profissional, empática e objetiva.

REGRAS IMPORTANTES:
1. Seja acolhedora e profissional
2. NUNCA dê parecer jurídico ou diagnóstico do caso - diga que precisa de uma consulta para avaliar
3. Foque em coletar informações: nome completo, telefone, email, resumo do problema
4. Sugira agendar uma consulta quando apropriado
5. Responda de forma concisa (máximo 300 caracteres por mensagem para WhatsApp)
6. Use emojis com moderação (máximo 1-2 por mensagem)
7. Se o cliente já informou os dados, agradeça e confirme que um advogado entrará em contato

ÁREAS DE ATUAÇÃO DO ESCRITÓRIO:
- Direito Trabalhista (demissões, verbas rescisórias, FGTS)
- Direito do Consumidor (bancos, financiamentos, negativações)
- Direito Previdenciário (aposentadoria, auxílios)
- Direito Civil (contratos, dívidas)

FLUXO IDEAL:
1. Saudar e perguntar como pode ajudar
2. Entender o problema brevemente
3. Coletar dados de contato (nome, telefone, email)
4. Confirmar que um advogado analisará o caso
5. Oferecer agendar uma consulta

Se o cliente mandar áudio ou imagem, diga que recebeu e peça para descrever o problema por texto.`;

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

    // Buscar histórico de conversa recente (últimas 10 mensagens)
    const { data: historicoMensagens } = await supabase
      .from('manychat_mensagens')
      .select('conteudo, direcao, created_at, tipo')
      .eq('subscriber_id', subscriberId)
      .order('created_at', { ascending: false })
      .limit(10);

    // Buscar lead vinculado para contexto
    const { data: subscriber } = await supabase
      .from('manychat_subscribers')
      .select('lead_id, nome')
      .eq('subscriber_id', subscriberId)
      .maybeSingle();

    let leadContext = '';
    if (subscriber?.lead_id) {
      const { data: lead } = await supabase
        .from('leads_juridicos')
        .select('nome, status, tipo_acao, resumo_ia')
        .eq('id', subscriber.lead_id)
        .maybeSingle();

      if (lead) {
        leadContext = `
CONTEXTO DO CLIENTE:
- Nome: ${lead.nome || nome}
- Status: ${lead.status || 'Novo contato'}
- Tipo de ação: ${lead.tipo_acao || 'Não definido'}
- Histórico: ${lead.resumo_ia || 'Primeiro contato'}`;
      }
    }

    // Montar histórico de conversa para contexto
    const historicoFormatado = (historicoMensagens || [])
      .reverse()
      .map(m => {
        const role = m.direcao === 'entrada' ? 'Cliente' : 'Isa';
        const tipoIndicador = m.tipo && m.tipo !== 'text' ? ` [${m.tipo}]` : '';
        return `${role}${tipoIndicador}: ${m.conteudo}`;
      })
      .join('\n');

    // Detectar se é áudio/mídia
    const isMedia = mensagem.match(/\.(ogg|mp3|wav|jpg|jpeg|png|gif|mp4|webm|pdf)/i);
    const mediaNote = isMedia ? '\n[NOTA: O cliente enviou um arquivo de mídia/áudio]' : '';

    // Preparar mensagens para a IA
    const messages = [
      { role: 'system', content: SYSTEM_PROMPT + leadContext },
      { 
        role: 'user', 
        content: `${historicoFormatado ? `HISTÓRICO DA CONVERSA:\n${historicoFormatado}\n\n` : ''}MENSAGEM ATUAL DO CLIENTE (${nome}):${mediaNote}
${mensagem}

Responda de forma curta e direta (máximo 300 caracteres). Lembre-se que é WhatsApp.`
      }
    ];

    console.log('[ISA-REPLY] Chamando Lovable AI...');

    // Chamar Lovable AI
    const aiResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages,
        max_tokens: 200,
        temperature: 0.7,
      }),
    });

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      console.error('[ISA-REPLY] Erro Lovable AI:', aiResponse.status, errorText);
      
      if (aiResponse.status === 429) {
        return new Response(JSON.stringify({ 
          success: false, 
          error: 'Rate limit exceeded. Try again later.' 
        }), {
          status: 429,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      
      if (aiResponse.status === 402) {
        return new Response(JSON.stringify({ 
          success: false, 
          error: 'Payment required. Add funds to Lovable AI.' 
        }), {
          status: 402,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      
      throw new Error(`AI Gateway error: ${aiResponse.status}`);
    }

    const aiData = await aiResponse.json();
    const respostaIsa = aiData.choices?.[0]?.message?.content || '';

    if (!respostaIsa) {
      console.error('[ISA-REPLY] Resposta vazia da IA');
      throw new Error('Resposta vazia da IA');
    }

    console.log('[ISA-REPLY] Resposta da Isa:', respostaIsa.substring(0, 100));

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

    // Enviar resposta via ManyChat API v2 (sendContent)
    console.log('[ISA-REPLY] Enviando para ManyChat...');
    
    const manychatResponse = await fetch('https://api.manychat.com/fb/sending/sendContent', {
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
            messages: [
              {
                type: 'text',
                text: respostaIsa,
              }
            ]
          }
        }
      }),
    });

    const manychatResult = await manychatResponse.json();
    console.log('[ISA-REPLY] Resposta ManyChat:', JSON.stringify(manychatResult));

    if (!manychatResponse.ok || manychatResult.status !== 'success') {
      console.error('[ISA-REPLY] Erro ao enviar para ManyChat:', manychatResult);
      
      // Tentar formato alternativo (API mais antiga)
      console.log('[ISA-REPLY] Tentando formato alternativo...');
      const altResponse = await fetch('https://api.manychat.com/fb/subscriber/sendContent', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${MANYCHAT_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          subscriber_id: subscriberId,
          data: {
            version: 'v2',
            content: {
              type: 'text',
              text: respostaIsa
            }
          }
        }),
      });

      const altResult = await altResponse.json();
      console.log('[ISA-REPLY] Resposta alternativa ManyChat:', JSON.stringify(altResult));
    }

    // Registrar evento no sistema
    await supabase.from('system_events').insert({
      tipo: 'ia_resposta',
      fonte: 'isa-reply-manychat',
      acao: 'resposta_enviada',
      lead_id: subscriber?.lead_id,
      dados: {
        subscriber_id: subscriberId,
        mensagem_recebida: mensagem.substring(0, 200),
        resposta_enviada: respostaIsa,
        canal,
      },
      processado: true,
    });

    return new Response(JSON.stringify({
      success: true,
      resposta: respostaIsa,
      subscriber_id: subscriberId,
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
