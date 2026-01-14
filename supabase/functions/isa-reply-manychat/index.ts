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
      .select('lead_id, nome, atendimento_humano')
      .eq('subscriber_id', subscriberId)
      .maybeSingle();

    // 🛑 VERIFICAR ATENDIMENTO HUMANO - Isa para de responder
    if (subscriber?.atendimento_humano) {
      console.log('[ISA-REPLY] ⏸️ Atendimento humano ativo, Isa não responde');
      return new Response(JSON.stringify({ 
        success: true, 
        skipped: true,
        reason: 'atendimento_humano_ativo' 
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

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

    // Buscar contexto COMPLETO do lead para enriquecer a mensagem
    let contextPrefix = '';
    let historicoConversa = '';
    
    if (subscriber?.lead_id) {
      // Buscar dados do lead
      const { data: lead } = await supabase
        .from('leads_juridicos')
        .select('nome, status, tipo_acao, resumo_ia, telefone, email')
        .eq('id', subscriber.lead_id)
        .maybeSingle();

      // Buscar histórico de mensagens (últimas 25)
      const { data: mensagensHist } = await supabase
        .from('manychat_mensagens')
        .select('conteudo, direcao, created_at')
        .eq('lead_id', subscriber.lead_id)
        .order('created_at', { ascending: false })
        .limit(25);
      
      // Buscar histórico de interações (últimas 10)
      const { data: interacoesHist } = await supabase
        .from('interacoes')
        .select('tipo, resumo, detalhes, direcao, data_interacao')
        .eq('cliente_id', subscriber.lead_id)
        .order('data_interacao', { ascending: false })
        .limit(10);

      if (lead) {
        contextPrefix = `[CONTEXTO DO CLIENTE]
Nome: ${lead.nome || nome}
Status: ${lead.status || 'Lead Frio'}
Tipo de Ação: ${lead.tipo_acao || 'NÃO IDENTIFICADO AINDA'}
Resumo: ${lead.resumo_ia || 'Sem resumo - PRECISA ENTENDER O CASO PRIMEIRO'}
`;
      }

      // Formatar histórico completo
      const historicoCompleto = [
        ...(mensagensHist || []).map(m => ({
          origem: m.direcao === 'entrada' ? 'CLIENTE' : 'BOT/EQUIPE',
          conteudo: m.conteudo,
          data: m.created_at,
        })),
        ...(interacoesHist || []).map(i => ({
          origem: i.direcao === 'entrada' ? 'CLIENTE' : 'EQUIPE',
          conteudo: `[${i.tipo}] ${i.resumo}${i.detalhes ? ': ' + i.detalhes : ''}`,
          data: i.data_interacao,
        })),
      ].sort((a, b) => new Date(a.data).getTime() - new Date(b.data).getTime());

      if (historicoCompleto.length > 0) {
        historicoConversa = '\n[HISTÓRICO DA CONVERSA - Leia TUDO para entender o contexto]\n' + 
          historicoCompleto.slice(-25).map(h => `[${h.origem}] ${h.conteudo}`).join('\n') + '\n';
      }
    }

    // Detectar se é áudio/mídia
    const isMedia = mensagem.match(/\.(ogg|mp3|wav|jpg|jpeg|png|gif|mp4|webm|pdf)/i);
    const mediaNote = isMedia ? '[O cliente enviou um arquivo de mídia/áudio. Peça para descrever em texto]\n\n' : '';

    // Regras de comportamento inteligente
    const regrasComportamento = `
⚠️ REGRAS CRÍTICAS DE COMPORTAMENTO:

1. SE O TIPO DE AÇÃO AINDA NÃO FOI IDENTIFICADO:
   - NÃO sugira agendamento imediatamente!
   - PRIMEIRO pergunte qual é o problema/questão do cliente
   - Exemplo: "Olá! Como posso ajudá-lo hoje? Tem alguma questão sobre Direito Bancário ou problemas com voos?"

2. APÓS ENTENDER O CASO:
   - Se for área que atendemos (Bancário/Aéreo) → Qualifique e sugira agendamento
   - Se NÃO for nossa área → Decline educadamente com a mensagem padrão de recusa

3. NOSSO ESCRITÓRIO ATENDE APENAS:
   ✅ Direito Bancário (juros abusivos, financiamentos, seguro prestamista)
   ✅ Questões Aéreas (cancelamentos, atrasos, bagagens)

4. NÃO ATENDEMOS (RECUSE IMEDIATAMENTE):
   ❌ Trabalhista, Previdenciário, Família, Criminal, Imobiliário

5. RESPONDA SEMPRE DE FORMA CURTA (máximo 3-4 linhas)
`;

    // Montar mensagem com contexto completo
    const mensagemCompleta = `${contextPrefix}${historicoConversa}${regrasComportamento}${mediaNote}
[NOVA MENSAGEM DO CLIENTE - Analise o histórico acima antes de responder]
Cliente (${nome}): ${mensagem}`;

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
