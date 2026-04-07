const serve = Deno.serve;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const OPENAI_API_KEY          = Deno.env.get('OPENAI_API_KEY');
const DEFAULT_ASSISTANT_ID    = Deno.env.get('OPENAI_ASSISTANT_ID') || '';
const SUPABASE_URL            = Deno.env.get('SUPABASE_URL');
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

// ─── Tools ────────────────────────────────────────────────────────────────────

const AVAILABLE_TOOLS = [
  {
    type: "function",
    function: {
      name: "buscar_horarios_calcom",
      description: "Busca horários disponíveis para agendamento via Cal.com. SEMPRE use esta função quando o cliente pedir para agendar ou quiser marcar um horário.",
      parameters: { type: "object", properties: {}, required: [] },
    },
  },
  {
    type: "function",
    function: {
      name: "agendar_calcom",
      description: "Agenda uma reunião via Cal.com quando o cliente confirmar um horário.",
      parameters: {
        type: "object",
        properties: {
          lead_id:    { type: "string" },
          nome:       { type: "string" },
          email:      { type: "string" },
          telefone:   { type: "string" },
          datetime:   { type: "string", description: "ISO format UTC" },
          titulo:     { type: "string" },
          modalidade: { type: "string", enum: ["online", "presencial"] },
        },
        required: ["nome", "email", "datetime", "titulo"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "verificar_disponibilidade",
      description: "Verifica se há horários disponíveis na agenda antes de propor ou criar um agendamento.",
      parameters: {
        type: "object",
        properties: {
          data:        { type: "string", description: "YYYY-MM-DD" },
          hora_inicio: { type: "string", description: "HH:mm" },
          hora_fim:    { type: "string", description: "HH:mm" },
        },
        required: ["data"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "criar_compromisso",
      description: "Cria um compromisso interno na agenda.",
      parameters: {
        type: "object",
        properties: {
          titulo:         { type: "string" },
          tipo:           { type: "string", enum: ["Reunião", "Audiência", "Prazo", "Outro"] },
          data_inicio:    { type: "string" },
          data_fim:       { type: "string" },
          descricao:      { type: "string" },
          lead_id:        { type: "string" },
          processo_id:    { type: "string" },
          responsavel_id: { type: "string" },
        },
        required: ["titulo", "data_inicio"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "criar_tarefa",
      description: "Cria uma tarefa no sistema.",
      parameters: {
        type: "object",
        properties: {
          titulo:         { type: "string" },
          descricao:      { type: "string" },
          data_limite:    { type: "string" },
          prioridade:     { type: "string", enum: ["Baixa", "Media", "Alta", "Urgente"] },
          cliente_id:     { type: "string" },
          processo_id:    { type: "string" },
          responsavel_id: { type: "string" },
        },
        required: ["titulo"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "buscar_contratos_clicksign",
      description: "Busca contratos pendentes/finalizados no Clicksign.",
      parameters: { type: "object", properties: {}, required: [] },
    },
  },
  {
    type: "function",
    function: {
      name: "buscar_lead",
      description: "Busca leads/clientes pelo nome, email ou telefone.",
      parameters: {
        type: "object",
        properties: {
          nome:     { type: "string" },
          email:    { type: "string" },
          telefone: { type: "string" },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "listar_compromissos",
      description: "Lista compromissos da agenda.",
      parameters: {
        type: "object",
        properties: {
          data_inicio: { type: "string" },
          data_fim:    { type: "string" },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "listar_tarefas_pendentes",
      description: "Lista tarefas pendentes do sistema.",
      parameters: { type: "object", properties: {} },
    },
  },
  {
    type: "function",
    function: {
      name: "criar_interacao",
      description: "Registra uma interação com um cliente.",
      parameters: {
        type: "object",
        properties: {
          cliente_id: { type: "string" },
          tipo:       { type: "string", enum: ["Ligação", "Email", "WhatsApp", "Reunião", "Outro"] },
          resumo:     { type: "string" },
          detalhes:   { type: "string" },
          direcao:    { type: "string", enum: ["Entrada", "Saída"] },
        },
        required: ["cliente_id", "tipo", "resumo"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "listar_usuarios",
      description: "Lista usuários do sistema com nome, email e cargo.",
      parameters: { type: "object", properties: {} },
    },
  },
  {
    type: "function",
    function: {
      name: "notificar_prazos_proximos",
      description: "Envia notificações de tarefas com prazo nos próximos 3 dias.",
      parameters: { type: "object", properties: {} },
    },
  },
];

// ─── Execute tool action ──────────────────────────────────────────────────────

async function executeAction(functionName: string, args: any): Promise<any> {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error('Supabase env vars não configuradas');
  }

  const response = await fetch(`${SUPABASE_URL}/functions/v1/isa-actions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'apikey': SUPABASE_SERVICE_ROLE_KEY,
      'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
    },
    body: JSON.stringify({ action: functionName, data: args }),
  });

  const raw = await response.text();
  try {
    return raw ? JSON.parse(raw) : null;
  } catch {
    return { success: false, message: raw };
  }
}

// ─── Thread persistence helpers ───────────────────────────────────────────────

/**
 * Busca o threadId salvo para um lead no Supabase.
 * Retorna null se não encontrado.
 */
async function getThreadIdForLead(leadId: string): Promise<string | null> {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) return null;
  try {
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/leads_juridicos?id=eq.${leadId}&select=openai_thread_id&limit=1`,
      {
        headers: {
          'apikey': SUPABASE_SERVICE_ROLE_KEY,
          'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
        },
      }
    );
    if (!res.ok) return null;
    const data = await res.json();
    return data?.[0]?.openai_thread_id ?? null;
  } catch {
    return null;
  }
}

/**
 * Busca o threadId pelo número de telefone (para WhatsApp).
 * Útil quando não temos lead_id mas temos o telefone.
 */
async function getThreadIdForPhone(phone: string): Promise<{ threadId: string | null; leadId: string | null }> {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) return { threadId: null, leadId: null };
  try {
    const phoneSuffix = phone.replace(/\D/g, '').slice(-9);
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/leads_juridicos?telefone=ilike.*${phoneSuffix}*&select=id,openai_thread_id&limit=1`,
      {
        headers: {
          'apikey': SUPABASE_SERVICE_ROLE_KEY,
          'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
        },
      }
    );
    if (!res.ok) return { threadId: null, leadId: null };
    const data = await res.json();
    return {
      threadId: data?.[0]?.openai_thread_id ?? null,
      leadId: data?.[0]?.id ?? null,
    };
  } catch {
    return { threadId: null, leadId: null };
  }
}

/**
 * Salva o threadId no lead para persistência futura.
 */
async function saveThreadIdForLead(leadId: string, threadId: string): Promise<void> {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY || !leadId) return;
  try {
    await fetch(
      `${SUPABASE_URL}/rest/v1/leads_juridicos?id=eq.${leadId}`,
      {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'apikey': SUPABASE_SERVICE_ROLE_KEY,
          'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
          'Prefer': 'return=minimal',
        },
        body: JSON.stringify({ openai_thread_id: threadId }),
      }
    );
  } catch (err) {
    console.error('[ai-chat] Failed to save threadId:', err);
  }
}

// ─── Main handler ─────────────────────────────────────────────────────────────

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    if (!OPENAI_API_KEY) throw new Error('OPENAI_API_KEY não configurada');

    const { message, threadId: clientThreadId, assistantId, lead_id, phone } = await req.json();

    const assistantToUse = assistantId || DEFAULT_ASSISTANT_ID;
    if (!assistantToUse) throw new Error('Assistant ID não fornecido');

    console.log('[ai-chat] Message:', message?.substring(0, 100));
    console.log('[ai-chat] lead_id:', lead_id, '| phone:', phone, '| clientThreadId:', clientThreadId);

    // ─── Resolver threadId ────────────────────────────────────────────────────
    // Prioridade: 1) clientThreadId (passado pelo caller)
    //             2) thread salvo no lead (por lead_id)
    //             3) thread salvo no lead (por telefone)
    //             4) criar nova thread

    let resolvedLeadId = lead_id || null;
    let currentThreadId = clientThreadId || null;

    if (!currentThreadId && resolvedLeadId) {
      currentThreadId = await getThreadIdForLead(resolvedLeadId);
      if (currentThreadId) {
        console.log(`[ai-chat] ♻️ Reusing thread from lead ${resolvedLeadId}: ${currentThreadId}`);
      }
    }

    if (!currentThreadId && phone) {
      const result = await getThreadIdForPhone(phone);
      if (result.threadId) {
        currentThreadId = result.threadId;
        resolvedLeadId = resolvedLeadId || result.leadId;
        console.log(`[ai-chat] ♻️ Reusing thread from phone ${phone}: ${currentThreadId}`);
      }
    }

    const isNewThread = !currentThreadId;

    if (!currentThreadId) {
      console.log('[ai-chat] Creating new thread...');
      const res = await fetch('https://api.openai.com/v1/threads', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${OPENAI_API_KEY}`,
          'Content-Type': 'application/json',
          'OpenAI-Beta': 'assistants=v2',
        },
        body: JSON.stringify({}),
      });

      if (!res.ok) throw new Error(`Erro ao criar thread: ${await res.text()}`);
      const thread = await res.json();
      currentThreadId = thread.id;
      console.log('[ai-chat] New thread:', currentThreadId);
    }

    // ─── Adicionar mensagem à thread ─────────────────────────────────────────

    const msgRes = await fetch(`https://api.openai.com/v1/threads/${currentThreadId}/messages`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
        'OpenAI-Beta': 'assistants=v2',
      },
      body: JSON.stringify({ role: 'user', content: message }),
    });

    if (!msgRes.ok) throw new Error(`Erro ao adicionar mensagem: ${await msgRes.text()}`);

    // ─── Executar assistant ───────────────────────────────────────────────────

    const runRes = await fetch(`https://api.openai.com/v1/threads/${currentThreadId}/runs`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
        'OpenAI-Beta': 'assistants=v2',
      },
      body: JSON.stringify({
        assistant_id: assistantToUse,
        tools: AVAILABLE_TOOLS,
      }),
    });

    if (!runRes.ok) throw new Error(`Erro ao executar assistant: ${await runRes.text()}`);
    const run = await runRes.json();

    // ─── Aguardar conclusão (com suporte a tool calls) ────────────────────────

    let runStatus = run.status;
    let attempts  = 0;
    const maxAttempts = 120;

    while (!['completed', 'failed', 'cancelled'].includes(runStatus) && attempts < maxAttempts) {
      await new Promise(r => setTimeout(r, 1000));
      attempts++;

      const statusRes = await fetch(`https://api.openai.com/v1/threads/${currentThreadId}/runs/${run.id}`, {
        headers: {
          'Authorization': `Bearer ${OPENAI_API_KEY}`,
          'OpenAI-Beta': 'assistants=v2',
        },
      });

      const runData = await statusRes.json();
      runStatus = runData.status;
      console.log(`[ai-chat] Run status (${attempts}):`, runStatus);

      if (runStatus === 'requires_action' && runData.required_action?.type === 'submit_tool_outputs') {
        const toolCalls   = runData.required_action.submit_tool_outputs.tool_calls;
        const toolOutputs = [];

        for (const tc of toolCalls) {
          const result = await executeAction(tc.function.name, JSON.parse(tc.function.arguments));
          toolOutputs.push({ tool_call_id: tc.id, output: JSON.stringify(result) });
        }

        await fetch(`https://api.openai.com/v1/threads/${currentThreadId}/runs/${run.id}/submit_tool_outputs`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${OPENAI_API_KEY}`,
            'Content-Type': 'application/json',
            'OpenAI-Beta': 'assistants=v2',
          },
          body: JSON.stringify({ tool_outputs: toolOutputs }),
        });
      }
    }

    if (runStatus !== 'completed') {
      throw new Error(`Run não completou. Status: ${runStatus}`);
    }

    // ─── Buscar resposta ──────────────────────────────────────────────────────

    const messagesRes = await fetch(
      `https://api.openai.com/v1/threads/${currentThreadId}/messages?limit=1`,
      {
        headers: {
          'Authorization': `Bearer ${OPENAI_API_KEY}`,
          'OpenAI-Beta': 'assistants=v2',
        },
      }
    );

    if (!messagesRes.ok) throw new Error(`Erro ao buscar mensagens: ${await messagesRes.text()}`);

    const messagesData = await messagesRes.json();
    const responseText = messagesData.data[0].content
      .filter((c: any) => c.type === 'text')
      .map((c: any) => c.text.value)
      .join('\n');

    console.log('[ai-chat] Response:', responseText.substring(0, 100) + '...');

    // ─── Persistir threadId no lead (se novo ou lead recém-identificado) ──────

    if (resolvedLeadId && (isNewThread || !clientThreadId)) {
      await saveThreadIdForLead(resolvedLeadId, currentThreadId);
      console.log(`[ai-chat] 💾 ThreadId salvo para lead ${resolvedLeadId}: ${currentThreadId}`);
    }

    return new Response(JSON.stringify({
      response:  responseText,
      threadId:  currentThreadId,
      lead_id:   resolvedLeadId,
      new_thread: isNewThread,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('[ai-chat] Error:', error);
    return new Response(JSON.stringify({
      error: error instanceof Error ? error.message : 'Erro desconhecido',
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
