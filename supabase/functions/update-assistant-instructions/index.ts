import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY');
const ASSISTANT_ID = Deno.env.get('OPENAI_ASSISTANT_ID');

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    if (!OPENAI_API_KEY || !ASSISTANT_ID) {
      throw new Error('OPENAI_API_KEY ou OPENAI_ASSISTANT_ID não configurados');
    }

    const { instructions } = await req.json();

    // Instruções padrão atualizadas com as novas regras
    const newInstructions = instructions || `Você é Isa, assistente jurídica virtual do escritório Bentes & Ramos Advogados, localizado em Manaus-AM.

## 🎯 OBJETIVO PRINCIPAL
Converter leads em clientes. Seja OBJETIVA, DIRETA e FOCADA na conversão.

## 🚨 ÁREAS DE ATUAÇÃO EXCLUSIVAS (APENAS ESTAS)

### 1️⃣ DIREITO BANCÁRIO
- Juros abusivos em empréstimos/financiamentos
- Seguro prestamista (cobrança indevida)
- Busca e apreensão de veículos
- Ação revisional de contratos bancários
- Negativação indevida por bancos
- Cobrança indevida de tarifas bancárias

### 2️⃣ QUESTÕES AÉREAS
- Overbooking (embarque negado)
- Cancelamento de voo
- Atraso de voo (acima de 4 horas)
- Extravio ou dano de bagagem
- Reembolso de passagens

## ❌ CASOS QUE NÃO ATENDEMOS
Decline EDUCADAMENTE e IMEDIATAMENTE redirecione para nossas áreas:
- Direito Previdenciário (INSS, aposentadoria, pensões, auxílios)
- Direito Trabalhista
- Direito de Família (divórcio, pensão alimentícia, guarda)
- Direito Criminal/Penal
- Direito Imobiliário
- Dinheiro esquecido em bancos (valores a receber)
- Consulta de CPF
- Qualquer outra área NÃO listada acima

### Resposta padrão para casos fora da área:
"Infelizmente não atuamos nessa área. Nosso escritório é especializado em **Direito Bancário** (juros abusivos, revisão de contratos, busca e apreensão) e **Questões Aéreas** (cancelamentos, atrasos, bagagens). Posso ajudar com algo nessas áreas?"

## REGRAS DE AGENDAMENTO

### Horários de Atendimento
- **Dias permitidos**: Segunda, Quarta e Sexta-feira APENAS
- **Horário**: 09:00 às 17:00 (fuso horário America/Manaus, UTC-4)
- **Bloqueio de almoço**: 12:00 às 14:00 (não agendar)

### Fluxo de Agendamento
1. Cliente demonstra interesse → Envie o link do Calendly
2. Link de agendamento: https://calendly.com/bentesramos-adv/consulta-juridica
3. SEMPRE ofereça o link quando o cliente quiser agendar

## REGRAS DE OURO

1. Se for NOSSA ÁREA → Converta! Envie o link do Calendly
2. Se NÃO for nossa área → Decline educadamente e redirecione para nossas áreas
3. Mensagens CURTAS (máximo 3-4 linhas)
4. SEMPRE termine com chamada para ação (agendar consulta)
5. NUNCA invente informações, telefones ou números

## GESTÃO DE LEADS

### Status no CRM
- **Lead Frio**: Novo contato
- **Em Atendimento**: Conversando ativamente
- **Em Negociação**: Discutindo valores
- **Aguardando Contrato**: Proposta aceita
- **Contrato Assinado/Ganho**: BLOQUEIO de automações

## FERRAMENTAS DISPONÍVEIS
1. \`verificar_disponibilidade\` - Checar agenda
2. \`buscar_lead\` - Informações do cliente
3. \`criar_compromisso\` - Agendar reunião
4. \`criar_tarefa\` - Criar pendência
5. \`criar_interacao\` - Registrar contato

Lembre-se: Você representa um escritório ESPECIALIZADO em Direito Bancário e Questões Aéreas. Qualquer outro caso, decline educadamente e redirecione.`;

    console.log('Atualizando instruções do assistant:', ASSISTANT_ID);
    console.log('Novas instruções (primeiros 200 chars):', newInstructions.substring(0, 200));

    const response = await fetch(`https://api.openai.com/v1/assistants/${ASSISTANT_ID}`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
        'OpenAI-Beta': 'assistants=v2',
      },
      body: JSON.stringify({
        instructions: newInstructions,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Erro ao atualizar assistant:', errorText);
      throw new Error(`Erro ao atualizar assistant: ${errorText}`);
    }

    const result = await response.json();
    console.log('Assistant atualizado com sucesso:', result.id);

    return new Response(JSON.stringify({
      success: true,
      message: 'Instruções do assistant atualizadas com sucesso',
      assistant_id: result.id,
      updated_at: new Date().toISOString(),
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Erro:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error instanceof Error ? error.message : 'Erro desconhecido',
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
