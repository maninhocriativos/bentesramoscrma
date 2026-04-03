const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { banco, dataInicial, dataFinal, tiposCobranças, nomeCliente, cpf, numeroContrato, arquivosBase64 } = await req.json();

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY não configurada");

    const imageContents = (arquivosBase64 || []).map((file: { base64: string; mimeType: string; name: string }) => {
      if (file.mimeType === 'application/pdf') {
        return {
          type: "image_url" as const,
          image_url: { url: `data:application/pdf;base64,${file.base64}` },
        };
      }
      return {
        type: "image_url" as const,
        image_url: { url: `data:${file.mimeType};base64,${file.base64}` },
      };
    });

    const tiposTexto = (tiposCobranças || []).join(", ");

    const systemPrompt = `Você é um especialista em direito bancário do consumidor brasileiro. Analise extratos bancários e identifique cobranças indevidas com precisão cirúrgica. Responda APENAS em JSON válido, sem markdown.`;

    const userPrompt = `Analise os extratos bancários anexados do banco ${banco} referentes ao período de ${dataInicial} a ${dataFinal}.

${nomeCliente ? `Cliente: ${nomeCliente}` : ""}
${cpf ? `CPF: ${cpf}` : ""}
${numeroContrato ? `Contrato: ${numeroContrato}` : ""}

TIPOS DE COBRANÇA PARA VERIFICAR: ${tiposTexto}

IDENTIFIQUE:
1. Cobranças de seguros não solicitados ou sem autorização expressa
2. Tarifas vedadas pela Resolução BACEN 3.919/2010 (TAC, TEC vedadas desde 2008)
3. Serviços contratados sem autorização expressa
4. Cobranças duplicadas no mesmo período
5. Valores divergentes de contratos
6. Encargos calculados incorretamente

PARA CADA COBRANÇA INDEVIDA IDENTIFICADA:
- data: data do lançamento
- descricao: descrição exata como aparece no extrato
- valor_unitario: valor cobrado
- quantidade_ocorrencias: quantas vezes aparece
- valor_total: valor total
- categoria: tipo da cobrança
- status: 'confirmado' | 'indicio' | 'requer_verificacao'
- base_legal: lei ou resolução violada
- justificativa: por que é indevida
- recorrente: boolean

REGRAS CRÍTICAS:
- IOF é imposto legal — NUNCA classifique como indevido
- Juros dentro da taxa BACEN são legais
- Só confirme se houver evidência clara no extrato
- Diferencie cobrança única de cobrança recorrente
- Calcule o total de cada cobrança recorrente no período analisado

Responda em JSON:
{
  "resumo": {
    "total_lancamentos": number,
    "irregularidades_encontradas": number,
    "valor_total_indevido": number,
    "periodo_analisado": string,
    "banco": string
  },
  "cobrancas_indevidas": [
    {
      "data": string,
      "descricao": string,
      "valor_unitario": number,
      "quantidade_ocorrencias": number,
      "valor_total": number,
      "categoria": string,
      "status": string,
      "base_legal": string,
      "justificativa": string,
      "recorrente": boolean
    }
  ],
  "por_categoria": [
    {
      "categoria": string,
      "total": number,
      "ocorrencias": number
    }
  ],
  "recomendacao": {
    "tipo_acao": string,
    "fundamentacao": string,
    "estimativa_recuperacao": number,
    "prazo_prescricional": string,
    "prioridade": "alta" | "media" | "baixa"
  }
}`;

    const messages: any[] = [
      { role: "system", content: systemPrompt },
      {
        role: "user",
        content: [
          { type: "text", text: userPrompt },
          ...imageContents,
        ],
      },
    ];

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit excedido. Tente novamente em alguns instantes." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "Créditos insuficientes. Adicione créditos ao workspace." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const t = await response.text();
      console.error("AI gateway error:", response.status, t);
      return new Response(JSON.stringify({ error: "Erro no gateway de IA" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const aiResult = await response.json();
    const content = aiResult.choices?.[0]?.message?.content || "";

    // Parse JSON from response (remove markdown fences if present)
    let parsed;
    try {
      const cleaned = content.replace(/```json\s*/g, "").replace(/```\s*/g, "").trim();
      parsed = JSON.parse(cleaned);
    } catch {
      console.error("Failed to parse AI response:", content);
      return new Response(JSON.stringify({ error: "A IA retornou um formato inválido. Tente novamente." }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify(parsed), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("analyze-extrato error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Erro desconhecido" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
