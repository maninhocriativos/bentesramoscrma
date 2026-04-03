const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// Extrai texto de PDF usando a API do Anthropic (Claude lê PDF nativamente)
async function extrairTextoPdf(base64: string, apiKey: string): Promise<string> {
  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 8192,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "document",
              source: {
                type: "base64",
                media_type: "application/pdf",
                data: base64,
              },
            },
            {
              type: "text",
              text: "Extraia TODO o texto deste extrato bancário exatamente como aparece, mantendo datas, descrições, valores de crédito, débito e saldo. Não resuma, não interprete, apenas transcreva todos os lançamentos linha por linha.",
            },
          ],
        },
      ],
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    console.error("Erro ao extrair PDF:", err);
    return "";
  }

  const result = await response.json();
  return result.content?.[0]?.text || "";
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const body = await req.json();
    const { banco, dataInicial, dataFinal, tiposCobranças, nomeCliente, cpf, numeroContrato, arquivosBase64 } = body;

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      return new Response(JSON.stringify({ error: "LOVABLE_API_KEY não configurada" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");

    // Monta conteúdo separando PDFs (extrai texto) de imagens
    const contentParts: any[] = [];
    let textoExtraido = "";

    for (const file of arquivosBase64 || []) {
      if (file.mimeType === "application/pdf") {
        if (ANTHROPIC_API_KEY) {
          // Extrai texto completo do PDF via Claude
          console.log("Extraindo texto do PDF:", file.name);
          const texto = await extrairTextoPdf(file.base64, ANTHROPIC_API_KEY);
          if (texto) {
            textoExtraido += `\n\n=== CONTEÚDO DO PDF: ${file.name} ===\n${texto}`;
            console.log("Texto extraído com sucesso, tamanho:", texto.length);
          }
        } else {
          // Fallback: envia como image_url se não tiver chave Anthropic
          contentParts.push({
            type: "image_url",
            image_url: { url: `data:application/pdf;base64,${file.base64}` },
          });
        }
      } else {
        // Imagens vão direto como image_url
        contentParts.push({
          type: "image_url",
          image_url: { url: `data:${file.mimeType};base64,${file.base64}` },
        });
      }
    }

    const tiposTexto = (tiposCobranças || []).join(", ");

    const systemPrompt = `Você é um especialista em direito bancário do consumidor brasileiro com 20 anos de experiência. Analise extratos bancários e identifique cobranças indevidas com precisão. Responda APENAS em JSON válido, sem markdown, sem texto fora do JSON.`;

    const userPrompt = `Analise os extratos bancários do banco ${banco || "não informado"} no período de ${dataInicial || "não informado"} a ${dataFinal || "não informado"}.

Cliente: ${nomeCliente || "não informado"}
CPF: ${cpf || "não informado"}
Contrato: ${numeroContrato || "não informado"}

${textoExtraido ? `CONTEÚDO COMPLETO DOS EXTRATOS:\n${textoExtraido}` : ""}

TIPOS DE COBRANÇA PARA VERIFICAR: ${tiposTexto}

REGRAS CRÍTICAS:
- IOF é imposto legal — NUNCA classifique como indevido
- Juros dentro da taxa contratada são legais
- ENCARGOS LIMITE DE CRED são juros de cheque especial — só são indevidos se a taxa cobrada superar o limite BACEN
- Só confirme cobrança indevida se houver evidência clara no extrato
- Calcule o total de cada cobrança recorrente somando todas as ocorrências no período

IDENTIFIQUE:
1. Seguros não solicitados (Seguro Prestamista, Seguro Vida cobrado mensalmente sem contrato expresso)
2. Tarifas vedadas pela Resolução BACEN 3.919/2010 (TAC, TEC)
3. Pacotes de serviços/cestas cobrados sem autorização expressa
4. Serviços contratados sem autorização (capitalização, clube de benefícios)
5. Cobranças duplicadas no mesmo período

Para TARIFA BANCÁRIA / CESTA DE SERVIÇOS: é indevida se não há evidência de contratação expressa do pacote.
Para SEGURO VIDA / BRADESCO VIDA PREV: é indevida se cobrada mensalmente sem contrato de seguro apresentado.

Responda EXATAMENTE neste JSON sem nenhum texto fora dele:
{
  "resumo": {
    "total_lancamentos": 0,
    "irregularidades_encontradas": 0,
    "valor_total_indevido": 0,
    "periodo_analisado": "",
    "banco": ""
  },
  "cobrancas_indevidas": [
    {
      "data": "",
      "descricao": "",
      "valor_unitario": 0,
      "quantidade_ocorrencias": 0,
      "valor_total": 0,
      "categoria": "",
      "status": "confirmado",
      "base_legal": "",
      "justificativa": "",
      "recorrente": true
    }
  ],
  "por_categoria": [
    {
      "categoria": "",
      "total": 0,
      "ocorrencias": 0
    }
  ],
  "recomendacao": {
    "tipo_acao": "",
    "fundamentacao": "",
    "estimativa_recuperacao": 0,
    "prazo_prescricional": "",
    "prioridade": "alta"
  }
}`;

    const messages: any[] = [
      { role: "system", content: systemPrompt },
      {
        role: "user",
        content: [{ type: "text", text: userPrompt }, ...contentParts],
      },
    ];

    console.log("Chamando gateway, texto extraído:", textoExtraido.length, "chars");

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        max_tokens: 8192,
        messages,
      }),
    });

    const responseText = await response.text();
    console.log("Status gateway:", response.status);
    console.log("Resposta gateway (primeiros 500 chars):", responseText.substring(0, 500));

    if (!response.ok) {
      return new Response(
        JSON.stringify({
          error: `Gateway retornou status ${response.status}: ${responseText.substring(0, 200)}`,
        }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const aiResult = JSON.parse(responseText);
    const content = aiResult.choices?.[0]?.message?.content || "";

    let parsed;
    try {
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (!jsonMatch) throw new Error("Nenhum JSON encontrado");
      parsed = JSON.parse(jsonMatch[0]);
    } catch {
      console.error("Falha ao parsear. Conteúdo:", content.substring(0, 500));
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
          fundamentacao: `Erro ao processar resposta: ${content.substring(0, 200)}`,
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
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
