import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY');
// Assistant ID - pode ser configurado via env ou passado na requisição
const DEFAULT_ASSISTANT_ID = Deno.env.get('OPENAI_ASSISTANT_ID') || '';

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

    console.log('Recebendo mensagem:', message);
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

    // Executar o assistant
    console.log('Executando assistant...');
    const runResponse = await fetch(`https://api.openai.com/v1/threads/${currentThreadId}/runs`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
        'OpenAI-Beta': 'assistants=v2',
      },
      body: JSON.stringify({
        assistant_id: assistantToUse,
      }),
    });

    if (!runResponse.ok) {
      const error = await runResponse.text();
      console.error('Erro ao executar assistant:', error);
      throw new Error(`Erro ao executar assistant: ${error}`);
    }

    const run = await runResponse.json();
    console.log('Run iniciado:', run.id);

    // Aguardar a conclusão do run (polling)
    let runStatus = run.status;
    let attempts = 0;
    const maxAttempts = 60; // 60 segundos máximo

    while (runStatus !== 'completed' && runStatus !== 'failed' && runStatus !== 'cancelled' && attempts < maxAttempts) {
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      const statusResponse = await fetch(`https://api.openai.com/v1/threads/${currentThreadId}/runs/${run.id}`, {
        headers: {
          'Authorization': `Bearer ${OPENAI_API_KEY}`,
          'OpenAI-Beta': 'assistants=v2',
        },
      });
      
      const statusData = await statusResponse.json();
      runStatus = statusData.status;
      attempts++;
      console.log(`Status do run (tentativa ${attempts}):`, runStatus);
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
