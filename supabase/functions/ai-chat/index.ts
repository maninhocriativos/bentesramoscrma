const serve = Deno.serve;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const ANTHROPIC_API_KEY    = Deno.env.get('ANTHROPIC_API_KEY');
const SUPABASE_URL         = Deno.env.get('SUPABASE_URL');
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

const MODEL         = 'claude-sonnet-4-6';
const MAX_TOKENS    = 4096;
const MAX_HISTORY   = 20; // mensagens anteriores carregadas do banco
const MAX_TOOL_ITER = 8;  // iterações máximas do loop de tool use

// ─── System Prompts ────────────────────────────────────────────────────────────

const SYSTEM_PROMPT = `Você é Isa, assistente jurídica inteligente do escritório Bentes Ramos Advogados.

PERSONALIDADE: Profissional, empática, direta e competente. Responde em português brasileiro.

CAPACIDADES:
- Análise e qualificação de leads jurídicos
- Consulta e resumo de processos judiciais
- Gestão de tarefas e prazos
- Agendamento via Cal.com e agenda interna
- Registro de interações com clientes
- Follow-up e automação de fluxos do escritório
- Controle de contratos

REGRAS:
1. Use as ferramentas disponíveis para consultar dados reais — nunca invente informações
2. Seja precisa com datas, status e valores
3. Para ações irreversíveis (agendamento, tarefas), confirme detalhes antes de executar se houver ambiguidade
4. Responda de forma estruturada quando houver múltiplas informações
5. Quando receber contexto do sistema entre [CONTEXTO DO SISTEMA] e [FIM DO CONTEXTO], use esses dados para respostas atualizadas`;

const DONNA_SYSTEM_PROMPT = `Você é Donn@, assistente de análise e gestão estratégica do escritório Bentes Ramos Advogados.

PERSONALIDADE: Analítica, precisa, proativa e orientada a dados. Fala português brasileiro com linguagem clara e objetiva.

CAPACIDADES:
- Geração de relatórios e indicadores de performance do escritório
- Análise de clientes, processos, tarefas e prazos com precisão
- Identificação de padrões, tendências e anomalias nos dados
- Monitoramento financeiro: honorários, parcelas, inadimplência
- Insights estratégicos baseados em dados reais
- Cadastro e gestão de clientes, processos e tarefas

REGRAS:
1. Use as ferramentas disponíveis para consultar dados reais — nunca invente números ou porcentagens
2. Seja extremamente precisa com valores, datas e percentuais
3. Apresente dados de forma estruturada: use listas, totais e comparações quando relevante
4. Para relatórios, organize em seções claras com resumo executivo no início
5. Proponha ações concretas quando identificar problemas ou oportunidades
6. Quando receber contexto do sistema entre [CONTEXTO DO SISTEMA] e [FIM DO CONTEXTO], use esses dados como base da análise`;

// ─── Tools (formato Anthropic) ────────────────────────────────────────────────

const TOOLS = [
  {
    name: 'buscar_horarios_calcom',
    description: 'Busca horários disponíveis para agendamento via Cal.com. Use quando o cliente quiser agendar.',
    input_schema: { type: 'object', properties: {}, required: [] },
  },
  {
    name: 'agendar_calcom',
    description: 'Agenda uma reunião via Cal.com quando o cliente confirmar um horário específico.',
    input_schema: {
      type: 'object',
      properties: {
        lead_id:    { type: 'string' },
        nome:       { type: 'string' },
        email:      { type: 'string' },
        telefone:   { type: 'string' },
        datetime:   { type: 'string', description: 'ISO format UTC' },
        titulo:     { type: 'string' },
        modalidade: { type: 'string', enum: ['online', 'presencial'] },
      },
      required: ['nome', 'email', 'datetime', 'titulo'],
    },
  },
  {
    name: 'verificar_disponibilidade',
    description: 'Verifica disponibilidade na agenda antes de propor ou criar um agendamento.',
    input_schema: {
      type: 'object',
      properties: {
        data:        { type: 'string', description: 'YYYY-MM-DD' },
        hora_inicio: { type: 'string', description: 'HH:mm' },
        hora_fim:    { type: 'string', description: 'HH:mm' },
      },
      required: ['data'],
    },
  },
  {
    name: 'criar_compromisso',
    description: 'Cria um compromisso interno na agenda do escritório.',
    input_schema: {
      type: 'object',
      properties: {
        titulo:         { type: 'string' },
        tipo:           { type: 'string', enum: ['Reunião', 'Audiência', 'Prazo', 'Outro'] },
        data_inicio:    { type: 'string' },
        data_fim:       { type: 'string' },
        descricao:      { type: 'string' },
        lead_id:        { type: 'string' },
        processo_id:    { type: 'string' },
        responsavel_id: { type: 'string' },
      },
      required: ['titulo', 'data_inicio'],
    },
  },
  {
    name: 'criar_tarefa',
    description: 'Cria uma tarefa no sistema para um usuário ou processo.',
    input_schema: {
      type: 'object',
      properties: {
        titulo:         { type: 'string' },
        descricao:      { type: 'string' },
        data_limite:    { type: 'string' },
        prioridade:     { type: 'string', enum: ['Baixa', 'Media', 'Alta', 'Urgente'] },
        cliente_id:     { type: 'string' },
        processo_id:    { type: 'string' },
        responsavel_id: { type: 'string' },
      },
      required: ['titulo'],
    },
  },
  {
    name: 'buscar_contratos_clicksign',
    description: 'Busca contratos pendentes ou finalizados no Clicksign.',
    input_schema: { type: 'object', properties: {}, required: [] },
  },
  {
    name: 'buscar_lead',
    description: 'Busca leads/clientes pelo nome, email ou telefone.',
    input_schema: {
      type: 'object',
      properties: {
        nome:     { type: 'string' },
        email:    { type: 'string' },
        telefone: { type: 'string' },
      },
    },
  },
  {
    name: 'listar_compromissos',
    description: 'Lista compromissos da agenda em um período.',
    input_schema: {
      type: 'object',
      properties: {
        data_inicio: { type: 'string' },
        data_fim:    { type: 'string' },
      },
    },
  },
  {
    name: 'listar_tarefas_pendentes',
    description: 'Lista todas as tarefas pendentes do sistema.',
    input_schema: { type: 'object', properties: {} },
  },
  {
    name: 'criar_interacao',
    description: 'Registra uma interação (ligação, email, WhatsApp, reunião) com um cliente.',
    input_schema: {
      type: 'object',
      properties: {
        cliente_id: { type: 'string' },
        tipo:       { type: 'string', enum: ['Ligação', 'Email', 'WhatsApp', 'Reunião', 'Outro'] },
        resumo:     { type: 'string' },
        detalhes:   { type: 'string' },
        direcao:    { type: 'string', enum: ['Entrada', 'Saída'] },
      },
      required: ['cliente_id', 'tipo', 'resumo'],
    },
  },
  {
    name: 'listar_usuarios',
    description: 'Lista usuários do sistema com nome, email e cargo.',
    input_schema: { type: 'object', properties: {} },
  },
  {
    name: 'notificar_prazos_proximos',
    description: 'Envia notificações de tarefas com prazo nos próximos 3 dias.',
    input_schema: { type: 'object', properties: {} },
  },
];

// ─── Execute tool via isa-actions ─────────────────────────────────────────────

async function executeAction(name: string, input: any): Promise<any> {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) return { error: 'Supabase não configurado' };
  try {
    const res = await fetch(`${SUPABASE_URL}/functions/v1/isa-actions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': SUPABASE_SERVICE_KEY,
        'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
      },
      body: JSON.stringify({ action: name, data: input }),
    });
    const text = await res.text();
    try { return JSON.parse(text); } catch { return { result: text }; }
  } catch (err) {
    return { error: String(err) };
  }
}

// ─── History persistence ──────────────────────────────────────────────────────

async function loadHistory(conversationId: string): Promise<{ role: string; content: string }[]> {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) return [];
  try {
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/ai_messages?conversation_id=eq.${conversationId}&order=created_at.asc&limit=${MAX_HISTORY}`,
      { headers: { 'apikey': SUPABASE_SERVICE_KEY, 'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}` } }
    );
    if (!res.ok) return [];
    const rows = await res.json();
    return rows.map((r: any) => ({ role: r.role, content: r.content }));
  } catch {
    return [];
  }
}

async function saveMessages(
  conversationId: string,
  leadId: string | null,
  messages: { role: string; content: string }[]
): Promise<void> {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY || messages.length === 0) return;
  try {
    await fetch(`${SUPABASE_URL}/rest/v1/ai_messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': SUPABASE_SERVICE_KEY,
        'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
        'Prefer': 'return=minimal',
      },
      body: JSON.stringify(
        messages.map(m => ({
          conversation_id: conversationId,
          lead_id: leadId || null,
          role: m.role,
          content: m.content,
        }))
      ),
    });
  } catch (err) {
    console.error('[ai-chat] Failed to save messages:', err);
  }
}

// ─── Resolve lead by phone ────────────────────────────────────────────────────

async function getLeadIdForPhone(phone: string): Promise<string | null> {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY || !phone) return null;
  try {
    const suffix = phone.replace(/\D/g, '').slice(-9);
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/leads_juridicos?telefone=ilike.*${suffix}*&select=id&limit=1`,
      { headers: { 'apikey': SUPABASE_SERVICE_KEY, 'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}` } }
    );
    if (!res.ok) return null;
    const data = await res.json();
    return data?.[0]?.id ?? null;
  } catch {
    return null;
  }
}

// ─── Main handler ─────────────────────────────────────────────────────────────

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    if (!ANTHROPIC_API_KEY) throw new Error('ANTHROPIC_API_KEY não configurada');

    const { message, threadId: clientThreadId, lead_id, phone, persona } = await req.json();
    if (!message) throw new Error('message é obrigatório');

    const activeSystemPrompt = persona === 'donna' ? DONNA_SYSTEM_PROMPT : SYSTEM_PROMPT;

    // Resolve lead
    let resolvedLeadId = lead_id || null;
    if (!resolvedLeadId && phone) resolvedLeadId = await getLeadIdForPhone(phone);

    // Conversation ID — UUID reutilizado pelo cliente para continuidade
    const conversationId  = clientThreadId || crypto.randomUUID();
    const isNewConversation = !clientThreadId;

    console.log('[ai-chat] model:', MODEL, '| conv:', conversationId, '| new:', isNewConversation);

    // Load previous messages from DB
    const history = await loadHistory(conversationId);

    // Build Claude messages array
    const claudeMessages: any[] = [
      ...history,
      { role: 'user', content: message },
    ];

    // ─── Agentic tool-use loop ──────────────────────────────────────────────

    let responseText = '';
    let iterations   = 0;
    const toSave: { role: string; content: string }[] = [{ role: 'user', content: message }];

    while (iterations < MAX_TOOL_ITER) {
      iterations++;

      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': ANTHROPIC_API_KEY,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: MODEL,
          max_tokens: MAX_TOKENS,
          system: activeSystemPrompt,
          tools: TOOLS,
          messages: claudeMessages,
        }),
      });

      if (!res.ok) {
        const errText = await res.text();
        throw new Error(`Anthropic API ${res.status}: ${errText}`);
      }

      const data = await res.json();
      console.log('[ai-chat] stop_reason:', data.stop_reason, '| iter:', iterations);

      // Collect text from response blocks
      const textBlocks = (data.content || []).filter((b: any) => b.type === 'text');
      if (textBlocks.length > 0) {
        responseText = textBlocks.map((b: any) => b.text).join('\n');
      }

      // Done — no more tools
      if (data.stop_reason !== 'tool_use') {
        toSave.push({ role: 'assistant', content: responseText });
        break;
      }

      const toolUseBlocks = (data.content || []).filter((b: any) => b.type === 'tool_use');
      if (toolUseBlocks.length === 0) {
        toSave.push({ role: 'assistant', content: responseText });
        break;
      }

      // Add assistant turn (with tool_use blocks) to in-memory history
      claudeMessages.push({ role: 'assistant', content: data.content });

      // Execute tools in parallel
      const toolResults = await Promise.all(
        toolUseBlocks.map(async (tb: any) => {
          console.log('[ai-chat] tool:', tb.name, JSON.stringify(tb.input).slice(0, 120));
          const result = await executeAction(tb.name, tb.input);
          return {
            type: 'tool_result',
            tool_use_id: tb.id,
            content: JSON.stringify(result),
          };
        })
      );

      // Feed results back as user turn
      claudeMessages.push({ role: 'user', content: toolResults });
    }

    if (!responseText) {
      responseText = 'Desculpe, não consegui processar sua mensagem. Tente novamente.';
      toSave.push({ role: 'assistant', content: responseText });
    }

    // Persist this exchange (only text, not tool call blocks)
    await saveMessages(conversationId, resolvedLeadId, toSave);

    return new Response(
      JSON.stringify({
        response:   responseText,
        threadId:   conversationId,
        lead_id:    resolvedLeadId,
        new_thread: isNewConversation,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[ai-chat] Error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Erro desconhecido' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
