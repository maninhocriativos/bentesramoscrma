import { chatCompletion, AIError } from "../_shared/ai-helper.ts";

const serve = Deno.serve;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { resumo, tipo_acao } = await req.json();

    if (!resumo || resumo.trim().length < 20) {
      return new Response(
        JSON.stringify({ error: "O resumo do caso deve ter pelo menos 20 caracteres." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const systemPrompt = `Você é um advogado brasileiro altamente qualificado, especialista em redação de petições iniciais cíveis e consumeristas. Sua tarefa é transformar um resumo informal dos fatos em texto jurídico formal.

INSTRUÇÕES:
1. Reescreva o resumo fornecido em 3 a 5 parágrafos utilizando linguagem jurídica formal e persuasiva
2. O texto deve ser adequado para a seção "DOS FATOS" de uma petição inicial
3. Use conectivos jurídicos adequados (destarte, outrossim, mister, ad argumentandum tantum, etc.)
4. Mantenha todos os fatos narrados pelo advogado, apenas formalize a linguagem
5. Não invente fatos novos
6. Cite princípios gerais quando pertinente (boa-fé objetiva, vulnerabilidade do consumidor, etc.)
7. Use parágrafos bem estruturados com início, meio e conclusão lógica
8. O tom deve ser firme, persuasivo e respeitoso
${tipo_acao ? `9. O tipo de ação é: ${tipo_acao}. Considere isso no enquadramento jurídico.` : ''}

Retorne APENAS o texto dos fatos, sem títulos ou cabeçalhos.`;

    let content = "";
    try {
      content = await chatCompletion({
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: `Resumo do caso:\n\n${resumo}` },
        ],
        temperature: 0.7,
        maxTokens: 2000,
      });
    } catch (aiErr) {
      const status = aiErr instanceof AIError ? aiErr.status : 500;
      console.error("Erro IA petition-rewrite:", status, (aiErr as Error).message);
      if (status === 429) {
        return new Response(JSON.stringify({ error: "Limite de requisições excedido. Tente novamente em alguns segundos." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (status === 402) {
        return new Response(JSON.stringify({ error: "Créditos de IA insuficientes." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      return new Response(JSON.stringify({ error: "Erro ao processar com IA" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ fatos_juridicos: content }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("petition-rewrite error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Erro desconhecido" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
