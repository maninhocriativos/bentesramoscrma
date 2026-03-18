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
const ESCAVADOR_API_KEY = Deno.env.get('ESCAVADOR_API_KEY');

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
- PRIMEIRO, peça o CPF do cliente para localizar os processos (caso não tenha sido fornecido ainda)
- Se o CPF já foi fornecido e há dados do Escavador no [CONTEXTO], apresente TODOS os processos ATIVOS de forma clara e organizada
- Formate CADA processo assim:
  📋 *Processo:* [número CNJ formatado]
  ⚖️ *Tipo:* [classe processual]
  🏛️ *Tribunal:* [tribunal]
  📍 *Vara:* [órgão julgador]
  📊 *Status:* [status atual]
  📅 *Última movimentação:* [data e descrição]
- Se houver MÚLTIPLOS processos, liste TODOS separadamente com numeração (1️⃣, 2️⃣, 3️⃣ etc.)
- Informe ao cliente a quantidade total de processos encontrados no início da resposta
- Se existirem processos ARQUIVADOS, mencione brevemente ao final ("Além desses, há X processo(s) já arquivado(s)")
- Se não encontrar processos para o CPF, informe educadamente e sugira verificar o número
- Nunca invente informações — se não tiver dados, diga que vai verificar
- Se o cliente forneceu o nome mas não o CPF, peça o CPF para fazer a busca oficial

### 🎙️ ÁUDIOS E IMAGENS
- Você pode OUVIR áudios (aparecem como [ÁUDIO TRANSCRITO]) — responda normalmente ao conteúdo
- Você pode VER imagens (aparecem como [IMAGEM ANALISADA]) — responda sobre o que foi identificado
- Se receber um documento/imagem de comprovante, extrato ou contrato, analise e informe o que identificou

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
1. Mensagens curtas (3-4 linhas máx), exceto quando apresentando dados de processos
2. Use o nome do cliente quando disponível
3. Emojis com moderação (1-2 por mensagem)
4. Sempre confirme informações antes de passar
5. Se não souber, diga que vai verificar — nunca invente
6. Use *negrito* para destacar informações importantes (formato WhatsApp)
`;

// ============================================================
// DETECTAR CPF NA MENSAGEM
// ============================================================
function extractCPF(message: string): string | null {
  // CPF com pontuação: 123.456.789-00
  const formatted = message.match(/\d{3}[.\s]?\d{3}[.\s]?\d{3}[-.\s]?\d{2}/);
  if (formatted) {
    const cpf = formatted[0].replace(/[^\d]/g, '');
    if (cpf.length === 11) return cpf;
  }
  // Sequência de 11 dígitos
  const raw = message.match(/\b(\d{11})\b/);
  if (raw) return raw[1];
  return null;
}

// ============================================================
// BUSCAR PROCESSOS NO ESCAVADOR POR CPF
// ============================================================
async function buscarProcessosPorCPF(cpf: string): Promise<{ processos: any[]; error: string | null }> {
  if (!ESCAVADOR_API_KEY) {
    return { processos: [], error: 'ESCAVADOR_API_KEY não configurada' };
  }

  const cpfLimpo = cpf.replace(/[^\d]/g, '');
  console.log(`[ISA-ESCRITORIO] 🔍 Buscando processos por CPF: ${cpfLimpo}`);

  try {
    const response = await fetch(
      `https://api.escavador.com/api/v2/envolvido/processos?cpf_cnpj=${cpfLimpo}`,
      {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${ESCAVADOR_API_KEY}`,
          'X-Requested-With': 'XMLHttpRequest',
          'Content-Type': 'application/json',
        },
      }
    );

    if (!response.ok) {
      if (response.status === 402) {
        return { processos: [], error: 'Créditos do Escavador insuficientes' };
      }
      return { processos: [], error: `Erro HTTP ${response.status}` };
    }

    const data = await response.json();
    const items = data.items || data.data || [];
    console.log(`[ISA-ESCRITORIO] ✅ Encontrados ${items.length} processos`);
    return { processos: items, error: null };
  } catch (err: any) {
    console.error(`[ISA-ESCRITORIO] ❌ Erro Escavador:`, err);
    return { processos: [], error: err.message };
  }
}

// ============================================================
// BUSCAR DETALHES DE UM PROCESSO POR CNJ NO ESCAVADOR
// ============================================================
async function buscarDetalhesProcesso(cnj: string): Promise<any | null> {
  if (!ESCAVADOR_API_KEY) return null;

  try {
    const response = await fetch(
      `https://api.escavador.com/api/v2/processos/numero_cnj/${encodeURIComponent(cnj)}`,
      {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${ESCAVADOR_API_KEY}`,
          'X-Requested-With': 'XMLHttpRequest',
          'Content-Type': 'application/json',
        },
      }
    );

    if (!response.ok) return null;
    const data = await response.json();

    // Fetch movimentações
    try {
      const movResp = await fetch(
        `https://api.escavador.com/api/v2/processos/numero_cnj/${encodeURIComponent(cnj)}/movimentacoes?pagina=1&quantidade=5`,
        {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${ESCAVADOR_API_KEY}`,
            'X-Requested-With': 'XMLHttpRequest',
            'Content-Type': 'application/json',
          },
        }
      );
      if (movResp.ok) {
        const movData = await movResp.json();
        data._movimentacoes = movData?.items || movData?.data || [];
      }
    } catch { /* ignore */ }

    return data;
  } catch {
    return null;
  }
}

// ============================================================
// FORMATAR DADOS DO ESCAVADOR PARA CONTEXTO DA IA
// ============================================================
function formatarProcessosEscavador(processos: any[], detalhes: Map<string, any>): string {
  if (processos.length === 0) {
    return '\n[RESULTADO BUSCA ESCAVADOR]\nNenhum processo encontrado para este CPF.';
  }

  // Separar ativos de arquivados
  const processosComStatus = processos.map((proc) => {
    const cnj = proc.numero_cnj || proc.numero_processo || '';
    const detalhe = detalhes.get(cnj);
    const fonte = detalhe?.fontes?.find((f: any) => f.tipo === 'TRIBUNAL') || detalhe?.fontes?.[0];
    const statusPredito = fonte?.status_predito || detalhe?.status_predito;
    const isAtivo = statusPredito !== 'INATIVO' && statusPredito !== 'BAIXADO';
    return { proc, cnj, detalhe, fonte, isAtivo, statusPredito };
  });

  const ativos = processosComStatus.filter(p => p.isAtivo);
  const arquivados = processosComStatus.filter(p => !p.isAtivo);

  const parts: string[] = [];
  parts.push(`\n[RESULTADO BUSCA ESCAVADOR - ${processos.length} processo(s) encontrado(s), ${ativos.length} ativo(s), ${arquivados.length} arquivado(s)]`);

  // Formatar TODOS os processos ativos
  const processosParaDetalhar = ativos.length > 0 ? ativos : processosComStatus.slice(0, 5);
  
  for (let i = 0; i < processosParaDetalhar.length; i++) {
    const { proc, cnj, detalhe, fonte, isAtivo, statusPredito } = processosParaDetalhar[i];
    const capa = fonte?.capa || {};

    parts.push(`\n${i + 1}️⃣ Processo: ${cnj || 'Sem número'}`);
    
    const classe = capa.classe || fonte?.classe?.nome || proc.titulo_classe || proc.classe || 'Não informado';
    parts.push(`   Tipo/Classe: ${classe}`);

    const tribunal = fonte?.tribunal?.sigla || fonte?.sigla || proc.tribunal || 'Não informado';
    parts.push(`   Tribunal: ${tribunal}`);

    const orgao = capa.orgao_julgador || fonte?.orgao_julgador?.nome || 'Não informado';
    parts.push(`   Vara/Órgão: ${orgao}`);

    let status = 'Em Andamento';
    if (statusPredito === 'INATIVO' || statusPredito === 'BAIXADO') status = 'Arquivado';
    else if (statusPredito === 'SUSPENSO') status = 'Suspenso';
    parts.push(`   Status: ${status}`);

    const assunto = capa.assunto || capa.assuntos_normalizados?.[0]?.nome || proc.assunto || '';
    if (assunto) parts.push(`   Assunto: ${assunto}`);

    const valorCausa = capa.valor_causa?.valor || proc.valor_causa;
    if (valorCausa) parts.push(`   Valor da Causa: R$ ${Number(valorCausa).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`);

    const dataDistrib = capa.data_distribuicao || fonte?.data_inicio || proc.data_inicio;
    if (dataDistrib) {
      parts.push(`   Data Distribuição: ${new Date(dataDistrib).toLocaleDateString('pt-BR')}`);
    }

    const envolvidos = fonte?.envolvidos || detalhe?.envolvidos || [];
    if (envolvidos.length > 0) {
      parts.push(`   Partes:`);
      for (const env of envolvidos.slice(0, 6)) {
        const nome = env.nome || env.pessoa?.nome || 'Desconhecido';
        const polo = env.polo === 'ATIVO' ? '(Autor)' : env.polo === 'PASSIVO' ? '(Réu)' : '';
        parts.push(`   - ${nome} ${polo}`);
      }
    }

    const movs = detalhe?._movimentacoes || [];
    if (movs.length > 0) {
      parts.push(`   Últimas movimentações:`);
      for (const mov of movs.slice(0, 3)) {
        const dataMov = mov.data || mov.data_hora;
        const dataStr = dataMov ? new Date(dataMov).toLocaleDateString('pt-BR') : 'N/A';
        const titulo = mov.classificacao_predita?.nome || mov.titulo || mov.conteudo || 'Movimentação';
        const complemento = mov.conteudo || mov.complemento || '';
        parts.push(`   - ${dataStr}: ${titulo}${complemento ? ` — ${complemento.substring(0, 120)}` : ''}`);
      }
    }
  }

  // Mencionar arquivados resumidamente
  if (arquivados.length > 0 && ativos.length > 0) {
    parts.push(`\n📁 Além dos processos ativos, há ${arquivados.length} processo(s) já arquivado(s):`);
    for (const arq of arquivados.slice(0, 5)) {
      const classe = arq.fonte?.capa?.classe || arq.proc.titulo_classe || arq.proc.classe || '';
      parts.push(`   - ${arq.cnj || 'Sem número'}${classe ? ` (${classe})` : ''} — Arquivado`);
    }
  }

  return parts.join('\n');
}

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
      parts.push(`\n[PROCESSOS] Nenhum processo vinculado a este cliente no sistema interno.`);
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

    // Financeiro
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
      max_tokens: 800,
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
  if (response.includes('[TRANSFERIR_HUMANO]')) {
    console.log('[ISA-ESCRITORIO] 🔄 Transferindo para humano');
    
    await supabase
      .from('leads_juridicos')
      .update({ isa_ativa: false })
      .eq('id', leadId);

    await supabase
      .from('manychat_subscribers')
      .update({ atendimento_humano: true })
      .eq('lead_id', leadId);

    await supabase.from('system_events').insert({
      tipo: 'handoff_humano',
      fonte: 'isa_escritorio',
      dados: { lead_id: leadId, motivo: 'transferencia_solicitada' }
    });
  }

  if (response.includes('[AGENDAR_ADVOGADO]')) {
    console.log('[ISA-ESCRITORIO] 📅 Solicitação de agendamento');
    
    await supabase.from('system_events').insert({
      tipo: 'agendamento_solicitado',
      fonte: 'isa_escritorio',
      dados: { lead_id: leadId, motivo: 'cliente_quer_falar_advogado' }
    });
  }

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

    // ============================================================
    // DETECTAR CPF E BUSCAR NO ESCAVADOR
    // ============================================================
    let escavadorContext = '';
    const cpfDetectado = extractCPF(processedMessage);

    if (cpfDetectado) {
      console.log(`[ISA-ESCRITORIO] 🔍 CPF detectado: ${cpfDetectado}`);

      // Buscar processos por CPF
      const { processos, error: escError } = await buscarProcessosPorCPF(cpfDetectado);

      if (escError) {
        console.error(`[ISA-ESCRITORIO] Erro Escavador: ${escError}`);
        escavadorContext = `\n[RESULTADO BUSCA ESCAVADOR]\nErro ao consultar: ${escError}. Informe ao cliente que houve uma falha temporária e tente novamente.`;
      } else if (processos.length === 0) {
        escavadorContext = `\n[RESULTADO BUSCA ESCAVADOR]\nNenhum processo encontrado para o CPF ${cpfDetectado}. Informe ao cliente que não foram localizados processos vinculados a este CPF.`;
      } else {
        // Buscar detalhes dos primeiros processos (max 3 para economizar créditos)
        const detalhesMap = new Map<string, any>();
        const detailPromises = processos.slice(0, 3).map(async (proc: any) => {
          const cnj = proc.numero_cnj || proc.numero_processo;
          if (cnj) {
            const detalhe = await buscarDetalhesProcesso(cnj);
            if (detalhe) detalhesMap.set(cnj, detalhe);
          }
        });
        await Promise.all(detailPromises);

        escavadorContext = formatarProcessosEscavador(processos, detalhesMap);
      }

      // Registrar busca
      await supabase.from('system_events').insert({
        tipo: 'escavador_cpf_search',
        fonte: 'isa_escritorio',
        dados: { lead_id, cpf: cpfDetectado, resultados: processos?.length || 0 }
      });
    }

    // Buscar contexto completo do lead
    const context = await getLeadFullContext(lead_id, supabase);

    // Combinar contextos
    const fullContext = context + escavadorContext;

    // Gerar resposta
    const response = await generateResponse(processedMessage, fullContext);

    // Limpar tags da resposta para envio
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
