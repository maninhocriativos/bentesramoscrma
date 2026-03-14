import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

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

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

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

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: `Resumo do caso:\n\n${resumo}` },
        ],
        temperature: 0.7,
        max_tokens: 2000,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Limite de requisições excedido. Tente novamente em alguns segundos." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "Créditos de IA insuficientes." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const t = await response.text();
      console.error("AI gateway error:", response.status, t);
      return new Response(JSON.stringify({ error: "Erro ao processar com IA" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || "";

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
