// xhr polyfill removed — using native fetch
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
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY não configurada');
    }

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

    console.log('Sending request to AI gateway...');

    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages,
        stream: false,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('AI gateway error:', response.status, errorText);
      
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: 'Limite de requisições excedido. Tente novamente em alguns instantes.' }), {
          status: 429,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: 'Créditos insuficientes. Entre em contato com o administrador.' }), {
          status: 402,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      
      throw new Error(`Erro no gateway de IA: ${response.status}`);
    }

    const data = await response.json();
    const assistantResponse = data.choices?.[0]?.message?.content;

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
