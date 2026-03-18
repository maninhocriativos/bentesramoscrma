import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY');

// ============================================================
// PROMPT DA ISA ESCRITÓRIO — ATENDIMENTO AO CLIENTE BENTES & RAMOS
// ============================================================
const ISA_ESCRITORIO_PROMPT = `Você é a Isa Escritório, assistente virtual do escritório Bentes & Ramos Advocacia.

## SUA IDENTIDADE
- Nome: Isa (Assistente do Escritório)
- Papel: Atender clientes existentes do escritório, informar status de processos, agendar reuniões e auxiliar com documentos e financeiro
- Tom: Profissional, cordial, eficiente e acolhedora

## PRINCÍPIOS
1. Você atende CLIENTES EXISTENTES do escritório (não leads de tráfego)
2. NUNCA dê parecer jurídico ou prometa resultados
3. Seja objetiva e eficiente nas respostas
4. Sempre confirme dados antes de informar status

## SUAS CAPACIDADES

### 📋 CONSULTA DE PROCESSOS
Quando o cliente perguntar sobre o andamento do processo:
- Use os dados do [CONTEXTO] para informar o status atual
- Informe a última movimentação registrada
- Se não houver processo vinculado, pergunte o número do CNJ ou nome completo
- Nunca invente informações — se não tiver dados, diga que vai verificar

### 📅 AGENDA / FALAR COM ADVOGADO
Quando o cliente quiser falar com o advogado:
- Informe que vai verificar a disponibilidade na agenda
- Inclua a tag [AGENDAR_ADVOGADO] na resposta
- Pergunte preferência de dia e horário
- Horários: Segunda, Quarta e Sexta, 09h-17h (exceto 12h-14h), fuso Manaus

### 📄 DOCUMENTOS
Quando o cliente perguntar sobre documentos:
- Informe quais documentos estão pendentes (do contexto)
- Oriente sobre como enviar (foto ou PDF pelo WhatsApp)
- Confirme o recebimento quando enviarem

### 💰 FINANCEIRO
Quando o cliente perguntar sobre valores, parcelas ou honorários:
- Informe o status das parcelas (do contexto)
- Se houver parcelas vencidas, informe de forma gentil
- Para dúvidas sobre valores específicos, encaminhe para o escritório
- Inclua a tag [FINANCEIRO_DUVIDA] se necessário

## QUANDO TRANSFERIR PARA HUMANO
Inclua [TRANSFERIR_HUMANO] quando:
1. O cliente pedir explicitamente para falar com uma pessoa
2. A dúvida for sobre valores de honorários não disponíveis no contexto
3. O assunto for complexo e fora do seu escopo
4. Houver reclamação ou insatisfação

## REGRAS DE COMUNICAÇÃO
1. Mensagens curtas (3-4 linhas máx)
2. Use o nome do cliente quando disponível
3. Emojis com moderação (1-2 por mensagem)
4. Sempre confirme informações antes de passar
5. Se não souber, diga que vai verificar — nunca invente
`;

// ============================================================
// BUSCAR CONTEXTO DO LEAD (processos, docs, financeiro, agenda)
// ============================================================
async function getLeadFullContext(leadId: string, supabase: any): Promise<string> {
  try {
    const parts: string[] = [];

    // Lead info
    const { data: lead } = await supabase
      .from('leads_juridicos')
      .select('*')
      .eq('id', leadId)
      .single();

    if (lead) {
      parts.push(`[DADOS DO CLIENTE]`);
      parts.push(`Nome: ${lead.nome || 'Não identificado'}`);
      parts.push(`Telefone: ${lead.telefone || 'N/A'}`);
      parts.push(`Email: ${lead.email || 'N/A'}`);
      parts.push(`Status: ${lead.status || 'N/A'}`);
      parts.push(`Estado: ${lead.lead_state || 'N/A'}`);
    }

    // Processos vinculados
    const { data: processos } = await supabase
      .from('processos')
      .select('*, movimentacoes:processo_movimentacoes(titulo, data_movimentacao, descricao)')
      .eq('lead_id', leadId)
      .order('created_at', { ascending: false })
      .limit(5);

    if (processos?.length > 0) {
      parts.push(`\n[PROCESSOS DO CLIENTE]`);
      for (const proc of processos) {
        parts.push(`📋 Processo: ${proc.numero_cnj || 'Sem CNJ'}`);
        parts.push(`   Tipo: ${proc.tipo_acao || 'N/A'}`);
        parts.push(`   Tribunal: ${proc.tribunal || 'N/A'}`);
        parts.push(`   Status: ${proc.status || 'Ativo'}`);
        parts.push(`   Última atualização: ${proc.ultima_verificacao || proc.updated_at || 'N/A'}`);
        
        // Últimas movimentações
        const movs = proc.movimentacoes?.slice(0, 3) || [];
        if (movs.length > 0) {
          parts.push(`   Últimas movimentações:`);
          for (const mov of movs) {
            const data = mov.data_movimentacao ? new Date(mov.data_movimentacao).toLocaleDateString('pt-BR') : 'N/A';
            parts.push(`   - ${data}: ${mov.titulo}${mov.descricao ? ` — ${mov.descricao.substring(0, 100)}` : ''}`);
          }
        }
      }
    } else {
      parts.push(`\n[PROCESSOS] Nenhum processo vinculado a este cliente.`);
    }

    // Documentos pendentes
    const { data: docs } = await supabase
      .from('lead_docs_checklist')
      .select('doc_label, received, doc_type')
      .eq('lead_id', leadId);

    if (docs?.length > 0) {
      const pendentes = docs.filter((d: any) => !d.received);
      const recebidos = docs.filter((d: any) => d.received);
      parts.push(`\n[DOCUMENTOS]`);
      parts.push(`Recebidos: ${recebidos.length} | Pendentes: ${pendentes.length}`);
      if (pendentes.length > 0) {
        parts.push(`Docs pendentes: ${pendentes.map((d: any) => d.doc_label).join(', ')}`);
      }
    }

    // Compromissos futuros
    const { data: compromissos } = await supabase
      .from('compromissos')
      .select('titulo, data_inicio, tipo')
      .eq('lead_id', leadId)
      .gte('data_inicio', new Date().toISOString())
      .order('data_inicio', { ascending: true })
      .limit(3);

    if (compromissos?.length > 0) {
      parts.push(`\n[AGENDA]`);
      for (const c of compromissos) {
        const data = new Date(c.data_inicio).toLocaleDateString('pt-BR', { 
          weekday: 'long', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' 
        });
        parts.push(`📅 ${c.titulo} — ${data} (${c.tipo})`);
      }
    }

    // Financeiro: Honorários e parcelas
    const { data: honorarios } = await supabase
      .from('honorarios')
      .select('*, parcelas:parcelas_honorarios(valor, data_vencimento, status)')
      .eq('cliente_id', leadId)
      .limit(3);

    if (honorarios?.length > 0) {
      parts.push(`\n[FINANCEIRO]`);
      for (const hon of honorarios) {
        parts.push(`💰 Honorário: R$ ${hon.valor_total?.toLocaleString('pt-BR')} (${hon.status || 'ativo'})`);
        const parcelas = hon.parcelas || [];
        const vencidas = parcelas.filter((p: any) => p.status === 'vencida' || (p.status !== 'paga' && new Date(p.data_vencimento) < new Date()));
        const proximas = parcelas.filter((p: any) => p.status !== 'paga' && new Date(p.data_vencimento) >= new Date()).slice(0, 2);
        
        if (vencidas.length > 0) {
          parts.push(`   ⚠️ ${vencidas.length} parcela(s) vencida(s)`);
        }
        if (proximas.length > 0) {
          for (const p of proximas) {
            parts.push(`   Próxima: R$ ${p.valor} vence em ${new Date(p.data_vencimento).toLocaleDateString('pt-BR')}`);
          }
        }
      }
    }

    // Despesas
    const { data: despesas } = await supabase
      .from('despesas')
      .select('descricao, valor, status, data_despesa')
      .eq('cliente_id', leadId)
      .eq('status', 'pendente')
      .limit(5);

    if (despesas?.length > 0) {
      parts.push(`\n[DESPESAS PENDENTES]`);
      for (const d of despesas) {
        parts.push(`- ${d.descricao}: R$ ${d.valor} (${d.status})`);
      }
    }

    // Histórico recente de mensagens
    const { data: mensagens } = await supabase
      .from('manychat_mensagens')
      .select('conteudo, direcao, created_at')
      .eq('lead_id', leadId)
      .order('created_at', { ascending: false })
      .limit(10);

    if (mensagens?.length > 0) {
      parts.push(`\n[HISTÓRICO RECENTE]`);
      const msgs = mensagens.reverse();
      for (const m of msgs) {
        const origem = m.direcao === 'entrada' ? 'CLIENTE' : 'ESCRITÓRIO';
        parts.push(`[${origem}] ${m.conteudo?.substring(0, 120)}`);
      }
    }

    return parts.join('\n');
  } catch (error) {
    console.error('[ISA-ESCRITORIO] Erro ao buscar contexto:', error);
    return '[Erro ao carregar contexto do cliente]';
  }
}

// ============================================================
// GERAR RESPOSTA COM IA
// ============================================================
async function generateResponse(message: string, context: string): Promise<string> {
  const apiUrl = LOVABLE_API_KEY 
    ? 'https://ai.gateway.lovable.dev/v1/chat/completions'
    : 'https://api.openai.com/v1/chat/completions';
  
  const apiKey = LOVABLE_API_KEY || OPENAI_API_KEY;

  if (!apiKey) {
    throw new Error('Nenhuma API key configurada (LOVABLE_API_KEY ou OPENAI_API_KEY)');
  }

  const response = await fetch(apiUrl, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: LOVABLE_API_KEY ? 'google/gemini-3-flash-preview' : 'gpt-4o',
      messages: [
        { role: 'system', content: ISA_ESCRITORIO_PROMPT },
        { role: 'user', content: `${context}\n\n[NOVA MENSAGEM DO CLIENTE]\n${message}` }
      ],
      max_tokens: 500,
      temperature: 0.6,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    console.error('[ISA-ESCRITORIO] Erro na API:', error);
    throw new Error(`API error: ${response.status}`);
  }

  const data = await response.json();
  return data.choices?.[0]?.message?.content || 'Desculpe, não consegui processar sua mensagem. Vou encaminhar para nossa equipe.';
}

// ============================================================
// PROCESSAR TAGS DE AÇÃO NA RESPOSTA
// ============================================================
async function processActionTags(response: string, leadId: string, supabase: any): Promise<void> {
  // [TRANSFERIR_HUMANO]
  if (response.includes('[TRANSFERIR_HUMANO]')) {
    console.log('[ISA-ESCRITORIO] 🔄 Transferindo para humano');
    
    // Desativar Isa e ativar atendimento humano
    await supabase
      .from('leads_juridicos')
      .update({ isa_ativa: false })
      .eq('id', leadId);

    await supabase
      .from('manychat_subscribers')
      .update({ atendimento_humano: true })
      .eq('lead_id', leadId);

    // Registrar evento
    await supabase.from('system_events').insert({
      tipo: 'handoff_humano',
      fonte: 'isa_escritorio',
      dados: { lead_id: leadId, motivo: 'transferencia_solicitada' }
    });
  }

  // [AGENDAR_ADVOGADO]
  if (response.includes('[AGENDAR_ADVOGADO]')) {
    console.log('[ISA-ESCRITORIO] 📅 Solicitação de agendamento');
    
    await supabase.from('system_events').insert({
      tipo: 'agendamento_solicitado',
      fonte: 'isa_escritorio',
      dados: { lead_id: leadId, motivo: 'cliente_quer_falar_advogado' }
    });
  }

  // [FINANCEIRO_DUVIDA]
  if (response.includes('[FINANCEIRO_DUVIDA]')) {
    console.log('[ISA-ESCRITORIO] 💰 Dúvida financeira');
    
    await supabase.from('system_events').insert({
      tipo: 'duvida_financeira',
      fonte: 'isa_escritorio',
      dados: { lead_id: leadId }
    });
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
    console.log('[ISA-ESCRITORIO] 📨 Payload:', JSON.stringify(body).substring(0, 300));

    const { lead_id, mensagem, subscriber_id, subscriber_nome, tipo_mensagem, media_url } = body;

    if (!lead_id || !mensagem) {
      return new Response(JSON.stringify({ 
        success: false, 
        error: 'lead_id e mensagem são obrigatórios' 
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Verificar se atendimento humano está ativo
    const { data: subscriber } = await supabase
      .from('manychat_subscribers')
      .select('atendimento_humano')
      .eq('lead_id', lead_id)
      .maybeSingle();

    if (subscriber?.atendimento_humano) {
      console.log('[ISA-ESCRITORIO] ⏸️ Atendimento humano ativo, ignorando');
      return new Response(JSON.stringify({ 
        success: true, 
        skipped: true,
        reason: 'atendimento_humano_ativo' 
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Processar mídia se presente (áudio/imagem)
    let processedMessage = mensagem;
    if (media_url && (tipo_mensagem === 'audio' || tipo_mensagem === 'image')) {
      try {
        const mediaResponse = await fetch(`${supabaseUrl}/functions/v1/isa-multimodal`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${supabaseServiceKey}`,
          },
          body: JSON.stringify({
            action: 'process_media',
            mediaUrl: media_url,
            mediaType: tipo_mensagem,
            leadId: lead_id,
          }),
        });

        if (mediaResponse.ok) {
          const mediaResult = await mediaResponse.json();
          if (mediaResult.success) {
            if (mediaResult.transcription) {
              processedMessage = `[ÁUDIO TRANSCRITO]: "${mediaResult.transcription}"`;
            } else if (mediaResult.analysis) {
              processedMessage = `[IMAGEM/DOC ANALISADO]: ${mediaResult.analysis}`;
            }
          }
        }
      } catch (e) {
        console.error('[ISA-ESCRITORIO] Erro ao processar mídia:', e);
      }
    }

    // Buscar contexto completo do lead
    const context = await getLeadFullContext(lead_id, supabase);

    // Gerar resposta
    const response = await generateResponse(processedMessage, context);

    // Limpar tags da resposta para envio (não exibir pro cliente)
    const cleanResponse = response
      .replace(/\[TRANSFERIR_HUMANO\]\s*/g, '')
      .replace(/\[AGENDAR_ADVOGADO\]\s*/g, '')
      .replace(/\[FINANCEIRO_DUVIDA\]\s*/g, '')
      .trim();

    // Processar tags de ação
    await processActionTags(response, lead_id, supabase);

    console.log('[ISA-ESCRITORIO] ✅ Resposta gerada:', cleanResponse.substring(0, 100));

    return new Response(JSON.stringify({ 
      success: true, 
      response: cleanResponse 
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
    console.error('[ISA-ESCRITORIO] Erro:', errorMessage);
    
    return new Response(JSON.stringify({ 
      success: false, 
      error: errorMessage 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
