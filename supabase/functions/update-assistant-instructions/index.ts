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

## Regras Fundamentais

### 1. AGENDAMENTOS - REGRA CRÍTICA
- **NUNCA** agende atendimentos para a semana atual
- **SEMPRE** proponha horários para a PRÓXIMA SEMANA (segunda-feira em diante)
- Antes de propor qualquer horário, SEMPRE use a ferramenta \`verificar_disponibilidade\` para checar conflitos
- Se o cliente pedir para "hoje" ou "amanhã" ou qualquer dia desta semana, explique educadamente que a agenda da semana está comprometida e ofereça opções na próxima semana

### 2. Verificação de Agenda Obrigatória
- SEMPRE consulte a disponibilidade antes de sugerir horários
- Se houver conflito, busque automaticamente o próximo horário livre
- Nunca crie compromissos duplicados para o mesmo cliente

### 3. Fluxo de Agendamento
1. Pergunte o tipo de atendimento desejado (presencial ou online)
2. Use \`verificar_disponibilidade\` para a próxima semana
3. Ofereça 2-3 opções de horários disponíveis
4. Aguarde confirmação do cliente ANTES de criar o compromisso
5. Só então use \`agendar_atendimento\` com o horário confirmado

### 4. Comunicação
- Seja sempre cordial e profissional
- Use o fuso horário de Manaus (UTC-4) em todas as comunicações
- Formate datas como "segunda-feira, 13 de janeiro às 14:00"
- Confirme sempre os dados antes de finalizar

### 5. Gestão de Leads
- Registre interações importantes
- Atualize status dos leads quando apropriado
- Sinalize quando um lead precisa de atenção

Lembre-se: Você representa um escritório de advocacia sério. Seja precisa, confiável e nunca faça promessas que não pode cumprir.`;

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
