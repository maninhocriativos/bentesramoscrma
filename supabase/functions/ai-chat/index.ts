// xhr polyfill removed — using native fetch
const serve = Deno.serve;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY');
const DEFAULT_ASSISTANT_ID = Deno.env.get('OPENAI_ASSISTANT_ID') || '';
const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

// Tools disponíveis para o assistant
const AVAILABLE_TOOLS = [
  {
    type: "function",
    function: {
      name: "buscar_horarios_calcom",
      description: "Busca horários disponíveis para agendamento via Cal.com. SEMPRE use esta função quando o cliente pedir para agendar ou quiser marcar um horário. Retorna até 6 opções de horários formatados para os próximos dias permitidos (Segunda, Quarta e Sexta, das 09h às 17h, exceto 12h-14h).",
      parameters: {
        type: "object",
        properties: {},
        required: [],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "agendar_calcom",
      description: "Agenda uma reunião via Cal.com quando o cliente confirmar um horário. Use após o cliente escolher um dos horários oferecidos. Cria o compromisso no Cal.com e no CRM automaticamente.",
      parameters: {
        type: "object",
        properties: {
          lead_id: { type: "string", description: "ID do lead no CRM" },
          nome: { type: "string", description: "Nome do cliente" },
          email: { type: "string", description: "Email do cliente" },
          telefone: { type: "string", description: "Telefone do cliente" },
          datetime: { type: "string", description: "Data e hora selecionada no formato ISO (YYYY-MM-DDTHH:mm:ss.000Z em UTC)" },
          titulo: { type: "string", description: "Título da reunião (ex: Consulta Jurídica - Direito Bancário)" },
          modalidade: { type: "string", enum: ["online", "presencial"], description: "Modalidade da reunião" },
        },
        required: ["nome", "email", "datetime", "titulo"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "verificar_disponibilidade",
      description: "Verifica se há horários disponíveis na agenda antes de propor ou criar um agendamento. SEMPRE use esta função ANTES de sugerir qualquer horário ao cliente. Retorna os compromissos existentes no período e indica se o horário está livre.",
      parameters: {
        type: "object",
        properties: {
          data: { type: "string", description: "Data para verificar no formato YYYY-MM-DD" },
          hora_inicio: { type: "string", description: "Hora de início desejada no formato HH:mm (opcional, se não informado retorna toda a agenda do dia)" },
          hora_fim: { type: "string", description: "Hora de término desejada no formato HH:mm (opcional)" },
        },
        required: ["data"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "criar_compromisso",
      description: "Cria um novo compromisso/evento na agenda do escritório. IMPORTANTE: Prefira usar agendar_calcom para agendamentos com clientes, pois já integra com Cal.com. Use esta função apenas para compromissos internos.",
      parameters: {
        type: "object",
        properties: {
          titulo: { type: "string", description: "Título do compromisso" },
          tipo: { type: "string", enum: ["Reunião", "Audiência", "Prazo", "Outro"], description: "Tipo do compromisso" },
          data_inicio: { type: "string", description: "Data e hora de início no formato ISO (YYYY-MM-DDTHH:mm:ss)." },
          data_fim: { type: "string", description: "Data e hora de término no formato ISO (opcional)" },
          descricao: { type: "string", description: "Descrição detalhada do compromisso" },
          lead_id: { type: "string", description: "ID do lead/cliente relacionado (opcional)" },
          processo_id: { type: "string", description: "ID do processo relacionado (opcional)" },
          responsavel_id: { type: "string", description: "ID do usuário responsável (opcional, será notificado por email)" },
        },
        required: ["titulo", "data_inicio"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "criar_tarefa",
      description: "Cria uma nova tarefa no sistema. Notifica automaticamente o responsável por email. Use listar_usuarios primeiro para obter o ID do responsável.",
      parameters: {
        type: "object",
        properties: {
          titulo: { type: "string", description: "Título da tarefa" },
          descricao: { type: "string", description: "Descrição da tarefa" },
          data_limite: { type: "string", description: "Data limite no formato YYYY-MM-DD" },
          prioridade: { type: "string", enum: ["Baixa", "Media", "Alta", "Urgente"], description: "Prioridade da tarefa" },
          cliente_id: { type: "string", description: "ID do cliente relacionado (opcional)" },
          processo_id: { type: "string", description: "ID do processo relacionado (opcional)" },
          responsavel_id: { type: "string", description: "ID do usuário responsável (será notificado por email)" },
        },
        required: ["titulo"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "buscar_contratos_clicksign",
      description: "Busca os contratos pendentes de assinatura e finalizados no Clicksign. Use quando o usuário perguntar sobre contratos, assinaturas pendentes, documentos para assinar.",
      parameters: {
        type: "object",
        properties: {},
        required: [],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "buscar_lead",
      description: "Busca leads/clientes no sistema pelo nome, email ou telefone.",
      parameters: {
        type: "object",
        properties: {
          nome: { type: "string", description: "Nome do lead para buscar" },
          email: { type: "string", description: "Email do lead para buscar" },
          telefone: { type: "string", description: "Telefone do lead para buscar" },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "listar_compromissos",
      description: "Lista os compromissos da agenda. Use para ver a agenda, reuniões agendadas, etc.",
      parameters: {
        type: "object",
        properties: {
          data_inicio: { type: "string", description: "Data inicial no formato ISO para filtrar" },
          data_fim: { type: "string", description: "Data final no formato ISO para filtrar" },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "listar_tarefas_pendentes",
      description: "Lista as tarefas pendentes do sistema.",
      parameters: {
        type: "object",
        properties: {},
      },
    },
  },
  {
    type: "function",
    function: {
      name: "criar_interacao",
      description: "Registra uma interação com um cliente (ligação, email, reunião, etc.)",
      parameters: {
        type: "object",
        properties: {
          cliente_id: { type: "string", description: "ID do cliente" },
          tipo: { type: "string", enum: ["Ligação", "Email", "WhatsApp", "Reunião", "Outro"], description: "Tipo da interação" },
          resumo: { type: "string", description: "Resumo da interação" },
          detalhes: { type: "string", description: "Detalhes da interação" },
          direcao: { type: "string", enum: ["Entrada", "Saída"], description: "Direção da interação" },
        },
        required: ["cliente_id", "tipo", "resumo"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "listar_usuarios",
      description: "Lista todos os usuários aprovados do sistema com nome, email e cargo. Use para encontrar o ID de um usuário antes de atribuir tarefas ou compromissos.",
      parameters: {
        type: "object",
        properties: {},
      },
    },
  },
  {
    type: "function",
    function: {
      name: "notificar_prazos_proximos",
      description: "Envia notificações por email para todas as tarefas com prazo nos próximos 3 dias.",
      parameters: {
        type: "object",
        properties: {},
      },
    },
  },
];

// Função para executar ações
async function executeAction(functionName: string, args: any): Promise<any> {
  console.log('Executando ação:', functionName, args);

  if (!SUPABASE_URL) {
    throw new Error('SUPABASE_URL não configurada');
  }
  if (!SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY não configurada');
  }

  const url = `${SUPABASE_URL}/functions/v1/isa-actions`;

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      // O gateway do Supabase costuma exigir apikey + Authorization.
      // Como o verify_jwt está desativado no endpoint, usamos a service role key aqui.
      'apikey': SUPABASE_SERVICE_ROLE_KEY,
      'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
    },
    body: JSON.stringify({
      action: functionName,
      data: args,
    }),
  });

  const raw = await response.text();
  let parsed: any;
  try {
    parsed = raw ? JSON.parse(raw) : null;
  } catch {
    parsed = { success: false, message: raw };
  }

  if (!response.ok) {
    console.error('Falha ao executar ação:', {
      functionName,
      status: response.status,
      raw,
    });
    return {
      success: false,
      message: `Falha ao executar ${functionName} (HTTP ${response.status})`,
      data: parsed,
    };
  }

  console.log('Resultado da ação:', parsed);
  return parsed;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    if (!OPENAI_API_KEY) {
      throw new Error('OPENAI_API_KEY não configurada');
    }

    const { message, threadId, assistantId } = await req.json();
    
    const assistantToUse = assistantId || DEFAULT_ASSISTANT_ID;
    
    if (!assistantToUse) {
      throw new Error('Assistant ID não fornecido');
    }

    console.log('Recebendo mensagem:', message?.substring(0, 100));
    console.log('Thread ID:', threadId);
    console.log('Assistant ID:', assistantToUse);

    // Criar ou usar thread existente
    let currentThreadId = threadId;
    
    if (!currentThreadId) {
      console.log('Criando nova thread...');
      const threadResponse = await fetch('https://api.openai.com/v1/threads', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${OPENAI_API_KEY}`,
          'Content-Type': 'application/json',
          'OpenAI-Beta': 'assistants=v2',
        },
        body: JSON.stringify({}),
      });
      
      if (!threadResponse.ok) {
        const error = await threadResponse.text();
        console.error('Erro ao criar thread:', error);
        throw new Error(`Erro ao criar thread: ${error}`);
      }
      
      const thread = await threadResponse.json();
      currentThreadId = thread.id;
      console.log('Thread criada:', currentThreadId);
    }

    // Adicionar mensagem à thread
    console.log('Adicionando mensagem à thread...');
    const messageResponse = await fetch(`https://api.openai.com/v1/threads/${currentThreadId}/messages`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
        'OpenAI-Beta': 'assistants=v2',
      },
      body: JSON.stringify({
        role: 'user',
        content: message,
      }),
    });

    if (!messageResponse.ok) {
      const error = await messageResponse.text();
      console.error('Erro ao adicionar mensagem:', error);
      throw new Error(`Erro ao adicionar mensagem: ${error}`);
    }

    // Executar o assistant com tools
    console.log('Executando assistant com tools...');
    const runResponse = await fetch(`https://api.openai.com/v1/threads/${currentThreadId}/runs`, {
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

    if (!runResponse.ok) {
      const error = await runResponse.text();
      console.error('Erro ao executar assistant:', error);
      throw new Error(`Erro ao executar assistant: ${error}`);
    }

    const run = await runResponse.json();
    console.log('Run iniciado:', run.id);

    // Aguardar a conclusão do run com suporte a tool calls
    let runStatus = run.status;
    let runData = run;
    let attempts = 0;
    const maxAttempts = 120; // 2 minutos máximo

    while (runStatus !== 'completed' && runStatus !== 'failed' && runStatus !== 'cancelled' && attempts < maxAttempts) {
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      const statusResponse = await fetch(`https://api.openai.com/v1/threads/${currentThreadId}/runs/${run.id}`, {
        headers: {
          'Authorization': `Bearer ${OPENAI_API_KEY}`,
          'OpenAI-Beta': 'assistants=v2',
        },
      });
      
      runData = await statusResponse.json();
      runStatus = runData.status;
      attempts++;
      console.log(`Status do run (tentativa ${attempts}):`, runStatus);

      // Se precisa chamar uma tool
      if (runStatus === 'requires_action' && runData.required_action?.type === 'submit_tool_outputs') {
        const toolCalls = runData.required_action.submit_tool_outputs.tool_calls;
        console.log('Tool calls necessárias:', toolCalls.length);

        const toolOutputs = [];
        
        for (const toolCall of toolCalls) {
          const functionName = toolCall.function.name;
          const args = JSON.parse(toolCall.function.arguments);
          
          console.log(`Executando tool: ${functionName}`, args);
          
          const result = await executeAction(functionName, args);
          
          toolOutputs.push({
            tool_call_id: toolCall.id,
            output: JSON.stringify(result),
          });
        }

        // Submeter os resultados das tools
        console.log('Submetendo resultados das tools...');
        const submitResponse = await fetch(`https://api.openai.com/v1/threads/${currentThreadId}/runs/${run.id}/submit_tool_outputs`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${OPENAI_API_KEY}`,
            'Content-Type': 'application/json',
            'OpenAI-Beta': 'assistants=v2',
          },
          body: JSON.stringify({ tool_outputs: toolOutputs }),
        });

        if (!submitResponse.ok) {
          const error = await submitResponse.text();
          console.error('Erro ao submeter tool outputs:', error);
        }
      }
    }

    if (runStatus !== 'completed') {
      throw new Error(`Run não completou. Status: ${runStatus}`);
    }

    // Buscar mensagens da thread
    console.log('Buscando resposta...');
    const messagesResponse = await fetch(`https://api.openai.com/v1/threads/${currentThreadId}/messages?limit=1`, {
      headers: {
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
        'OpenAI-Beta': 'assistants=v2',
      },
    });

    if (!messagesResponse.ok) {
      const error = await messagesResponse.text();
      console.error('Erro ao buscar mensagens:', error);
      throw new Error(`Erro ao buscar mensagens: ${error}`);
    }

    const messagesData = await messagesResponse.json();
    const assistantMessage = messagesData.data[0];
    
    const responseText = assistantMessage.content
      .filter((c: any) => c.type === 'text')
      .map((c: any) => c.text.value)
      .join('\n');

    console.log('Resposta do assistant:', responseText.substring(0, 100) + '...');

    return new Response(JSON.stringify({
      response: responseText,
      threadId: currentThreadId,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Erro no ai-chat:', error);
    return new Response(JSON.stringify({ 
      error: error instanceof Error ? error.message : 'Erro desconhecido' 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
