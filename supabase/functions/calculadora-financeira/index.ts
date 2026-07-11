// xhr polyfill removed — using native fetch
import { chatCompletion, AIError } from "../_shared/ai-helper.ts";

const serve = Deno.serve;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const SYSTEM_PROMPT = `# AGENTE DE ANÁLISE FINANCEIRA – JUROS & TAXAS BANCÁRIAS

## IDENTIDADE
Você é o **Agente Financeiro do CRM**, especializado em:
- Analisar contratos bancários
- Identificar juros abusivos
- Comparar taxas com padrões do BACEN
- Gerar relatórios estruturados

## O QUE VOCÊ FAZ
Ao receber:
- Contrato
- Dados de financiamento
- Parcelas
- Taxas aplicadas
- Valor total pago

Você deve:
1. Calcular CET (Custo Efetivo Total)
2. Comparar com índice permitido pelo Banco Central
3. Apontar exatamente onde há abuso
4. Recalcular o contrato de forma justa
5. Gerar relatório completo em **CSV ou PDF**

## OUTPUTS ESPERADOS
### CSV contendo:
- Nome do cliente  
- Banco  
- Tipo de contrato  
- Taxa aplicada  
- Taxa permitida  
- Diferença percentual  
- Valor cobrado a mais  
- Nova simulação justa  
- Economia potencial  

### PDF contendo:
- Cabeçalho profissional com logo  
- Resumo do contrato  
- Tabela comparativa  
- Detalhamento técnico dos cálculos  
- Conclusão jurídica  
- Possíveis ações a tomar  

## REGRAS
- Nunca invente valores  
- Se faltar dados, solicite  
- Use cálculos financeiros corretos (PRICE / SAC)  
- Explique cada etapa de forma objetiva  
- Entregue resultados profissionais e auditáveis

## FORMATAÇÃO
- Use markdown para formatar suas respostas
- Utilize tabelas quando apropriado
- Destaque valores importantes em negrito
- Use emojis para facilitar a leitura (⚠️ para alertas, ✅ para confirmações, 📊 para dados)`;

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { message, conversationHistory = [] } = await req.json();

    if (!message) {
      throw new Error('Mensagem é obrigatória');
    }

    // Build messages array with conversation history
    const messages = [
      { role: 'system', content: SYSTEM_PROMPT },
      ...conversationHistory,
      { role: 'user', content: message }
    ];

    console.log('Sending request to AI (OpenAI → Claude fallback)...');

    let assistantResponse = '';
    try {
      assistantResponse = await chatCompletion({ messages, maxTokens: 4000 });
    } catch (aiErr) {
      const status = aiErr instanceof AIError ? aiErr.status : 500;
      console.error('Erro IA calculadora:', status, (aiErr as Error).message);
      if (status === 429) {
        return new Response(JSON.stringify({ error: 'Limite de requisições excedido. Tente novamente em alguns instantes.' }), {
          status: 429,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      if (status === 402) {
        return new Response(JSON.stringify({ error: 'Créditos insuficientes. Entre em contato com o administrador.' }), {
          status: 402,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      throw new Error(`Erro no serviço de IA: ${status}`);
    }

    if (!assistantResponse) {
      throw new Error('Resposta vazia da IA');
    }

    console.log('Response received successfully');

    return new Response(JSON.stringify({ 
      response: assistantResponse 
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Erro na função calculadora-financeira:', error);
    return new Response(JSON.stringify({ 
      error: error instanceof Error ? error.message : 'Erro desconhecido' 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
