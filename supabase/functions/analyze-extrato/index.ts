const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const body = await req.json();
    const { banco, dataInicial, dataFinal, tiposCobranças, nomeCliente, cpf, numeroContrato, arquivosBase64 } = body;

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      return new Response(JSON.stringify({ error: "LOVABLE_API_KEY não configurada" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const contentParts: any[] = [];

    for (const file of (arquivosBase64 || [])) {
      if (file.mimeType === "application/pdf") {
        contentParts.push({
          type: "image_url",
          image_url: {
            url: `data:application/pdf;base64,${file.base64}`,
          },
        });
      } else {
        contentParts.push({
          type: "image_url",
          image_url: {
            url: `data:${file.mimeType};base64,${file.base64}`,
          },
        });
      }
    }

    const tiposTexto = (tiposCobranças || []).join(", ");

    const systemPrompt = `Você é um especialista em direito bancário do consumidor brasileiro. Analise extratos bancários e identifique cobranças indevidas. Responda APENAS em JSON válido, sem markdown, sem texto fora do JSON.`;

    const userPrompt = `Analise os extratos bancários do banco ${banco || "não informado"} no período de ${dataInicial || "não informado"} a ${dataFinal || "não informado"}.
Cliente: ${nomeCliente || "não informado"}
CPF: ${cpf || "não informado"}
Contrato: ${numeroContrato || "não informado"}

TIPOS DE COBRANÇA PARA VERIFICAR: ${tiposTexto}

IMPORTANTE: Analise as imagens anexadas. Identifique todos os lançamentos visíveis. Mesmo que não encontre irregularidades claras, retorne o resumo com o total de lançamentos identificados.

IDENTIFIQUE:
1. Cobranças de seguros não solicitados
2. Tarifas vedadas pela Resolução BACEN 3.919/2010
3. Serviços contratados sem autorização
4. Cobranças duplicadas
5. Valores divergentes de contratos

Responda exatamente neste JSON:
{
  "resumo": {
    "total_lancamentos": 0,
    "irregularidades_encontradas": 0,
    "valor_total_indevido": 0,
    "periodo_analisado": "",
    "banco": ""
  },
  "cobrancas_indevidas": [],
  "por_categoria": [],
  "recomendacao": {
    "tipo_acao": "",
    "fundamentacao": "",
    "estimativa_recuperacao": 0,
    "prazo_prescricional": "",
    "prioridade": "media"
  }
}`;

    const messages: any[] = [
      { role: "system", content: systemPrompt },
      {
        role: "user",
        content: [
          { type: "text", text: userPrompt },
          ...contentParts,
        ],
      },
    ];

    console.log("Chamando gateway com modelo gemini-2.5-flash, arquivos:", arquivosBase64?.length);

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        max_tokens: 4096,
        messages,
      }),
    });

    const responseText = await response.text();
    console.log("Status gateway:", response.status);
    console.log("Resposta gateway (primeiros 500 chars):", responseText.substring(0, 500));

    if (!response.ok) {
      return new Response(JSON.stringify({ 
        error: `Gateway retornou status ${response.status}: ${responseText.substring(0, 200)}` 
      }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const aiResult = JSON.parse(responseText);
    const content = aiResult.choices?.[0]?.message?.content || "";

    console.log("Conteúdo bruto da IA (primeiros 1000 chars):", content.substring(0, 1000));

    let parsed;
    try {
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (!jsonMatch) throw new Error("Nenhum JSON encontrado na resposta");
      const cleaned = jsonMatch[0];
      parsed = JSON.parse(cleaned);
    } catch (err) {
      console.error("Falha ao parsear. Conteúdo completo:", content);
      parsed = {
        resumo: {
          total_lancamentos: 0,
          irregularidades_encontradas: 0,
          valor_total_indevido: 0,
          periodo_analisado: `${dataInicial} a ${dataFinal}`,
          banco: banco || "",
        },
        cobrancas_indevidas: [],
        por_categoria: [],
        recomendacao: {
          tipo_acao: "Análise manual necessária",
          fundamentacao: `Não foi possível processar automaticamente. Conteúdo recebido: ${content.substring(0, 200)}`,
          estimativa_recuperacao: 0,
          prazo_prescricional: "A verificar",
          prioridade: "media",
        },
      };
    }

    return new Response(JSON.stringify(parsed), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (e: any) {
    console.error("Erro geral analyze-extrato:", e.message);
    return new Response(JSON.stringify({ error: e.message || "Erro desconhecido" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
