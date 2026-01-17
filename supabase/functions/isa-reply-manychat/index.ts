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
const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY');

// ============================================================
// PROMPT SISTEMA DA ISA - ORQUESTRADORA CENTRAL
// ============================================================
const ISA_SYSTEM_PROMPT = `Você é a ISA, assistente jurídica virtual e ORQUESTRADORA CENTRAL do escritório Bentes & Ramos Advocacia.

## SUA IDENTIDADE
- Nome: Isa (Inteligência de Suporte Advocatício)
- Papel: Recepcionista inteligente, triagista e coordenadora de leads
- Tom: Profissional, empática, eficiente, humana (não robótica)

## SUAS CAPACIDADES ESPECIAIS
🎙️ **ÁUDIO**: Você CONSEGUE ouvir e entender áudios - eles são transcritos automaticamente
🖼️ **IMAGEM**: Você CONSEGUE ver e analisar imagens e documentos enviados
📄 **DOCUMENTOS**: Você extrai dados de RG, CPF, comprovantes automaticamente
📝 **CONTRATOS**: Você pode enviar contratos para assinatura digital

## ÁREAS DE ATUAÇÃO (EXCLUSIVAS)
✅ **Direito Bancário**: 
   - Revisão de contratos bancários
   - Juros abusivos e anatocismo
   - Seguro prestamista (vendas casadas)
   - Financiamentos de veículos
   - Empréstimos consignados
   - Cartões de crédito

✅ **Direito Aéreo**:
   - Cancelamento/atraso de voos
   - Extravio de bagagem
   - Overbooking
   - Reembolsos

## ÁREAS QUE NÃO ATENDEMOS
❌ Trabalhista, Previdenciário, Família, Criminal, Imobiliário, Tributário

Se o cliente mencionar essas áreas, decline educadamente:
"Agradeço seu contato! Infelizmente nosso escritório é especializado em Direito Bancário e Aéreo. Recomendo buscar um advogado especializado na área [X]. Posso ajudar com alguma questão bancária ou de viagens aéreas?"

## FLUXO DE ATENDIMENTO (STATE MACHINE)

### 1. NEW → TRIAGE
- Cliente acabou de chegar
- PRIMEIRO: Cumprimente e pergunte qual é o problema
- NÃO sugira agendamento sem entender o caso

### 2. TRIAGE → CLASSIFIED  
- Identificar tipo do caso (Bancário ou Aéreo)
- Fazer perguntas para qualificar:
  - Bancário: Qual banco? Tipo de contrato? Valor? Há quanto tempo?
  - Aéreo: Qual companhia? Data do voo? O que aconteceu?

### 3. CLASSIFIED → DATA_CAPTURE
- Caso qualificado, coletar dados para contrato:
  - Nome completo
  - CPF
  - RG  
  - Endereço
  - Data de nascimento
- Solicitar documentos: "Por favor, me envie uma foto do seu RG ou CNH"

### 4. DATA_CAPTURE → CONTRACT_SENT
- Com dados coletados, informar que o contrato será enviado
- Enviar contrato via Clicksign

### 5. CONTRACT_SENT → DOCS_PENDING
- Aguardar assinatura
- Cobrar documentos pendentes do caso

### 6. DOCS_PENDING → READY_FOR_LAWYER
- Documentos recebidos
- Caso pronto para análise do advogado

## REGRAS DE COMPORTAMENTO

1. **ENTENDA PRIMEIRO**: Nunca sugira agendamento sem entender o problema
2. **RESPOSTAS CURTAS**: Máximo 3-4 linhas para WhatsApp
3. **SEMPRE TERMINE COM PERGUNTA**: Mantenha o diálogo fluindo
4. **RECONHEÇA MÍDIA**: Se receber áudio/foto, mencione que entendeu
5. **NUNCA INVENTE**: Se não souber, diga que vai verificar
6. **CONFIRME DADOS**: Repita dados importantes para confirmar
7. **USE EMOJIS COM MODERAÇÃO**: 1-2 por mensagem, profissional

## QUANDO RECEBER DOCUMENTOS
- Agradeça: "Recebi seu documento, estou analisando..."
- Se extrair dados: "Confirmando: seu nome é [X] e CPF [Y], correto?"
- Se não conseguir ler: "Não consegui ler bem o documento. Pode enviar uma foto mais nítida?"

## QUANDO RECEBER ÁUDIO
- Sempre confirme: "Entendi sua mensagem de áudio..."
- Responda ao conteúdo transcrito
- Se não entender: "Não consegui ouvir bem, pode repetir ou digitar?"

## HORÁRIOS DE ATENDIMENTO
- Agendamentos: Segunda, Quarta e Sexta
- Horários: 09h às 17h (exceto 12h-14h)
- Fuso: América/Manaus (UTC-4)
`;

// ============================================================
// PROCESSAR MÍDIA (ÁUDIO/IMAGEM)
// ============================================================
async function processMedia(
  mediaUrl: string,
  mediaType: string,
  leadId: string | null,
  supabase: any
): Promise<{ processed: boolean; content: string; extractedData?: any }> {
  console.log('[ISA-REPLY] 📦 Processando mídia:', mediaType, mediaUrl?.substring(0, 50));

  try {
    const response = await fetch(`${supabaseUrl}/functions/v1/isa-multimodal`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${supabaseServiceKey}`,
      },
      body: JSON.stringify({
        action: 'process_media',
        mediaUrl,
        mediaType,
        leadId,
      }),
    });

    if (!response.ok) {
      console.error('[ISA-REPLY] Erro ao processar mídia:', response.status);
      return { processed: false, content: '' };
    }

    const result = await response.json();
    console.log('[ISA-REPLY] Resultado do processamento:', result);

    if (result.success) {
      if (result.transcription) {
        return { 
          processed: true, 
          content: `[ÁUDIO TRANSCRITO]: "${result.transcription}"` 
        };
      }
      if (result.analysis) {
        return { 
          processed: true, 
          content: `[IMAGEM ANALISADA]: ${result.analysis}` 
        };
      }
      if (result.documentType) {
        return {
          processed: true,
          content: `[DOCUMENTO ${result.documentType} RECEBIDO E PROCESSADO]`,
          extractedData: result.data
        };
      }
    }

    return { processed: false, content: '' };
  } catch (error) {
    console.error('[ISA-REPLY] Erro ao processar mídia:', error);
    return { processed: false, content: '' };
  }
}

// ============================================================
// BUSCAR CONTEXTO COMPLETO DO LEAD
// ============================================================
async function getLeadContext(leadId: string, supabase: any): Promise<string> {
  try {
    const response = await fetch(`${supabaseUrl}/functions/v1/isa-multimodal`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${supabaseServiceKey}`,
      },
      body: JSON.stringify({
        action: 'get_lead_context',
        leadId,
      }),
    });

    if (!response.ok) return '';

    const result = await response.json();
    if (!result.success || !result.context) return '';

    const ctx = result.context;
    const lead = ctx.lead;
    const classification = ctx.classification;
    const contractData = ctx.contractData;

    let contextStr = `
[CONTEXTO COMPLETO DO LEAD]
📋 Nome: ${lead?.nome || 'Não identificado'}
📱 Telefone: ${lead?.telefone || 'N/A'}
📧 Email: ${lead?.email || 'N/A'}
🔄 Estado atual: ${lead?.lead_state || 'NEW'}
📊 Status: ${lead?.status || 'Lead Frio'}
`;

    if (classification) {
      contextStr += `
🏷️ Classificação: ${classification.case_type || 'Não classificado'}
📝 Subtipo: ${classification.sub_type || 'N/A'}
💡 Resumo: ${classification.summary || 'N/A'}
`;
    }

    if (contractData) {
      contextStr += `
📄 Dados contratuais coletados:
- CPF: ${contractData.cpf || '❌ Pendente'}
- RG: ${contractData.rg || '❌ Pendente'}
- Endereço: ${contractData.endereco || '❌ Pendente'}
- Data nasc: ${contractData.data_nascimento || '❌ Pendente'}
`;
    }

    if (ctx.docsChecklist?.length > 0) {
      const recebidos = ctx.docsChecklist.filter((d: any) => d.received);
      const pendentes = ctx.docsChecklist.filter((d: any) => !d.received);
      contextStr += `
📑 Documentos: ${recebidos.length} recebidos, ${pendentes.length} pendentes
`;
      if (pendentes.length > 0) {
        contextStr += `   Pendentes: ${pendentes.map((d: any) => d.doc_label).join(', ')}\n`;
      }
    }

    if (ctx.compromissos?.length > 0) {
      const proximoCompromisso = ctx.compromissos.find((c: any) => new Date(c.data_inicio) > new Date());
      if (proximoCompromisso) {
        contextStr += `📅 Próximo compromisso: ${proximoCompromisso.titulo} em ${new Date(proximoCompromisso.data_inicio).toLocaleDateString('pt-BR')}\n`;
      }
    }

    contextStr += `
📊 Métricas:
- Total mensagens: ${ctx.totalMensagens}
- Dias desde contato: ${ctx.diasDesdeContato}
`;

    // Histórico das últimas mensagens
    if (ctx.mensagens?.length > 0) {
      contextStr += `
[HISTÓRICO RECENTE - Últimas ${Math.min(ctx.mensagens.length, 15)} mensagens]
`;
      const ultimasMsgs = ctx.mensagens.slice(0, 15).reverse();
      for (const msg of ultimasMsgs) {
        const origem = msg.direcao === 'entrada' ? 'CLIENTE' : 'ISA/EQUIPE';
        contextStr += `[${origem}] ${msg.conteudo?.substring(0, 150)}${msg.conteudo?.length > 150 ? '...' : ''}\n`;
      }
    }

    return contextStr;
  } catch (error) {
    console.error('[ISA-REPLY] Erro ao buscar contexto:', error);
    return '';
  }
}

// ============================================================
// GERAR RESPOSTA COM IA
// ============================================================
async function generateResponse(
  message: string,
  context: string,
  threadId?: string
): Promise<{ response: string; threadId?: string }> {
  
  const apiUrl = LOVABLE_API_KEY 
    ? 'https://ai.gateway.lovable.dev/v1/chat/completions'
    : 'https://api.openai.com/v1/chat/completions';
  
  const apiKey = LOVABLE_API_KEY || OPENAI_API_KEY;

  if (!apiKey) {
    throw new Error('Nenhuma API key configurada (LOVABLE_API_KEY ou OPENAI_API_KEY)');
  }

  const fullPrompt = `${ISA_SYSTEM_PROMPT}

${context}

[NOVA MENSAGEM DO CLIENTE]
${message}

Responda de forma natural, curta (máximo 3-4 linhas) e sempre termine com uma pergunta ou call-to-action.`;

  try {
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: LOVABLE_API_KEY ? 'google/gemini-3-flash-preview' : 'gpt-4o',
        messages: [
          { role: 'system', content: ISA_SYSTEM_PROMPT },
          { role: 'user', content: `${context}\n\n[NOVA MENSAGEM DO CLIENTE]\n${message}` }
        ],
        max_tokens: 500,
        temperature: 0.7,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      console.error('[ISA-REPLY] Erro na API:', error);
      throw new Error(`API error: ${response.status}`);
    }

    const data = await response.json();
    const resposta = data.choices?.[0]?.message?.content || '';

    return { response: resposta, threadId };
  } catch (error) {
    console.error('[ISA-REPLY] Erro ao gerar resposta:', error);
    throw error;
  }
}

// ============================================================
// ENVIAR RESPOSTA VIA MANYCHAT
// ============================================================
async function sendToManyChat(
  subscriberId: string,
  message: string
): Promise<boolean> {
  try {
    // Primeira tentativa - envio normal
    let response = await fetch('https://api.manychat.com/fb/sending/sendContent', {
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
            messages: [{ type: 'text', text: message }]
          }
        }
      }),
    });

    let result = await response.json();
    
    // Se falhar por inatividade, tentar com message_tag
    if (result.code === 3011 || result.status === 'error') {
      console.log('[ISA-REPLY] Tentando com message_tag ACCOUNT_UPDATE...');
      
      response = await fetch('https://api.manychat.com/fb/sending/sendContent', {
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
              messages: [{ type: 'text', text: message }]
            }
          }
        }),
      });

      result = await response.json();
    }

    console.log('[ISA-REPLY] Resposta ManyChat:', result.status);
    return result.status === 'success';
  } catch (error) {
    console.error('[ISA-REPLY] Erro ao enviar para ManyChat:', error);
    return false;
  }
}

// ============================================================
// MAIN HANDLER
// ============================================================
serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    const body = await req.json();
    console.log('[ISA-REPLY] 📨 Payload recebido:', JSON.stringify(body).substring(0, 300));

    // Extrair dados do payload (compatível com ManyChat)
    const subscriberId = body.subscriber_id?.toString().replace(/^\[|\]$/g, '').trim();
    let mensagem = body.last_input_text || body.message || body.text || '';
    const nome = body.full_name || body.name || body.first_name || 'Cliente';
    const telefone = body.phone || body.wa_id || '';
    const canal = body.channel || 'whatsapp';
    
    // Dados de mídia
    const mediaUrl = body.media_url || body.attachment_url || body.file_url || '';
    const mediaType = body.media_type || body.attachment_type || '';

    if (!subscriberId) {
      return new Response(JSON.stringify({ 
        success: false, 
        error: 'subscriber_id obrigatório' 
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Buscar subscriber e lead vinculado
    const { data: subscriber } = await supabase
      .from('manychat_subscribers')
      .select('lead_id, nome, atendimento_humano')
      .eq('subscriber_id', subscriberId)
      .maybeSingle();

    // 🛑 Verificar atendimento humano
    if (subscriber?.atendimento_humano) {
      console.log('[ISA-REPLY] ⏸️ Atendimento humano ativo');
      return new Response(JSON.stringify({ 
        success: true, 
        skipped: true,
        reason: 'atendimento_humano_ativo' 
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const leadId = subscriber?.lead_id;

    // 📦 Processar mídia se presente
    let mediaContent = '';
    let extractedData = null;
    
    if (mediaUrl) {
      const mediaResult = await processMedia(mediaUrl, mediaType, leadId, supabase);
      if (mediaResult.processed) {
        mediaContent = mediaResult.content;
        extractedData = mediaResult.extractedData;
        console.log('[ISA-REPLY] ✅ Mídia processada:', mediaContent.substring(0, 100));
      }
    }

    // Combinar mensagem com conteúdo de mídia
    const fullMessage = mediaContent 
      ? `${mediaContent}\n\n${mensagem ? `Mensagem adicional: ${mensagem}` : ''}`
      : mensagem;

    if (!fullMessage || fullMessage.trim() === '') {
      console.log('[ISA-REPLY] Mensagem vazia, ignorando');
      return new Response(JSON.stringify({ 
        success: true, 
        skipped: true,
        reason: 'mensagem vazia' 
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log('[ISA-REPLY] 💬 Processando:', fullMessage.substring(0, 100));

    // 📋 Buscar contexto completo do lead
    let context = '';
    if (leadId) {
      context = await getLeadContext(leadId, supabase);
    } else {
      context = `[NOVO CONTATO - Sem lead vinculado ainda]\nNome informado: ${nome}\nTelefone: ${telefone}\n`;
    }

    // 🤖 Gerar resposta
    const { response: respostaIsa } = await generateResponse(fullMessage, context);

    if (!respostaIsa) {
      throw new Error('Resposta vazia da IA');
    }

    // Truncar resposta para WhatsApp (máx 500 chars)
    const respostaFinal = respostaIsa.length > 500 
      ? respostaIsa.substring(0, 497) + '...' 
      : respostaIsa;

    // 💾 Salvar resposta no banco
    await supabase.from('manychat_mensagens').insert({
      subscriber_id: subscriberId,
      subscriber_nome: subscriber?.nome || nome,
      conteudo: respostaFinal,
      canal: canal,
      tipo: 'text',
      direcao: 'saida',
      lead_id: leadId,
      metadata: extractedData ? { extracted_data: extractedData } : null,
    });

    // 📤 Enviar via ManyChat
    const enviado = await sendToManyChat(subscriberId, respostaFinal);

    // 📊 Registrar evento
    await supabase.from('system_events').insert({
      tipo: 'ia_resposta',
      fonte: 'isa-reply-manychat',
      acao: 'resposta_isa_enviada',
      lead_id: leadId,
      dados: {
        subscriber_id: subscriberId,
        mensagem_recebida: fullMessage.substring(0, 200),
        resposta_enviada: respostaFinal.substring(0, 300),
        media_processada: !!mediaContent,
        canal,
      },
      processado: enviado,
    });

    console.log('[ISA-REPLY] ✅ Resposta enviada:', respostaFinal.substring(0, 100));

    return new Response(JSON.stringify({
      success: true,
      resposta: respostaFinal,
      subscriber_id: subscriberId,
      media_processed: !!mediaContent,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('[ISA-REPLY] ❌ Erro:', error);
    
    return new Response(JSON.stringify({
      success: false,
      error: error instanceof Error ? error.message : 'Erro desconhecido',
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
