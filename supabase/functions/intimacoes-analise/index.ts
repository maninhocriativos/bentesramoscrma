import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY")!;
const MODEL = "claude-sonnet-4-6";

interface AcaoSugerida {
  titulo: string;
  descricao: string;
  prazo_dias: number | null;
  prioridade: "Urgente" | "Alta" | "Normal";
}

interface AnaliseResult {
  resumo: string;
  recomendacao: string;
  acoes: AcaoSugerida[];
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const {
      conteudo,
      tipo_intimacao,
      tribunal,
      processo_cnj,
      processo_titulo,
      data_publicacao,
      data_intimacao,
    } = await req.json();

    if (!conteudo) {
      return new Response(
        JSON.stringify({ success: false, error: "conteudo é obrigatório" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const dataContext = [
      processo_cnj ? `Processo CNJ: ${processo_cnj}` : "",
      processo_titulo ? `Partes: ${processo_titulo}` : "",
      tribunal ? `Tribunal: ${tribunal}` : "",
      tipo_intimacao ? `Tipo: ${tipo_intimacao}` : "",
      data_publicacao ? `Data de publicação: ${data_publicacao}` : "",
      data_intimacao ? `Prazo de intimação: ${data_intimacao}` : "",
    ].filter(Boolean).join("\n");

    const prompt = `Você é Isa, assistente jurídica do escritório Bentes Ramos Advogados. Analise a intimação abaixo e retorne um JSON estruturado.

DADOS DA INTIMAÇÃO:
${dataContext}

CONTEÚDO DA PUBLICAÇÃO:
${conteudo.slice(0, 4000)}

Retorne APENAS um JSON válido (sem markdown, sem explicações fora do JSON) com esta estrutura exata:
{
  "resumo": "Explicação clara e objetiva em 2-4 frases do que aconteceu nesta intimação. Use linguagem acessível para o cliente entender.",
  "recomendacao": "Recomendação específica do que o advogado deve fazer, com base no tipo de ato processual. Mencione os recursos ou providências cabíveis e os prazos legais aplicáveis.",
  "acoes": [
    {
      "titulo": "Nome da ação/peça processual",
      "descricao": "O que fazer especificamente nesta ação",
      "prazo_dias": 15,
      "prioridade": "Alta"
    }
  ]
}

REGRAS:
- "acoes" deve ter entre 1 e 5 ações ordenadas por urgência
- "prazo_dias" é o número de dias úteis a partir da intimação (null se indeterminado)
- "prioridade" deve ser "Urgente" (≤3 dias), "Alta" (4-15 dias) ou "Normal" (>15 dias)
- Considere os prazos do CPC/CLT conforme o tipo de processo e tribunal
- Se for Diário Oficial, considere que o prazo começa no próximo dia útil após a publicação
- Responda sempre em português brasileiro
- Não invente informações — baseie-se apenas no conteúdo fornecido`;

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 1500,
        messages: [{ role: "user", content: prompt }],
      }),
      signal: AbortSignal.timeout(30000),
    });

    if (!response.ok) {
      const err = await response.text();
      throw new Error(`Anthropic API error ${response.status}: ${err}`);
    }

    const anthropicData = await response.json();
    const rawText = anthropicData.content?.[0]?.text || "";

    // Extrai JSON da resposta (remove possível markdown)
    const jsonMatch = rawText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error("Resposta da IA não contém JSON válido");

    const analise: AnaliseResult = JSON.parse(jsonMatch[0]);

    // Valida estrutura mínima
    if (!analise.resumo || !analise.recomendacao || !Array.isArray(analise.acoes)) {
      throw new Error("Estrutura do JSON retornado é inválida");
    }

    return new Response(
      JSON.stringify({ success: true, analise }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Erro desconhecido";
    console.error("❌ [intimacoes-analise]", msg);
    return new Response(
      JSON.stringify({ success: false, error: msg }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
