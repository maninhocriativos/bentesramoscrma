const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

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
              text: `Analise TODAS as páginas deste extrato bancário e liste APENAS os lançamentos que se enquadram nestas categorias:

1. TARIFA BANCARIA (qualquer tipo: CESTA CELULAR, CESTA CLASSIC, manutenção, etc)
2. SEGURO (qualquer tipo: VIDA, PRESTAMISTA, BRADESCO VIDA PREV, etc)
3. CAPITALIZAÇÃO
4. CLUBE DE BENEFICIOS
5. TAC ou TEC
6. Qualquer serviço cobrado mensalmente com descrição repetida

Para CADA lançamento encontrado informe exatamente:
DATA | DESCRIÇÃO EXATA | VALOR DÉBITO

Liste TODOS individualmente, mês a mês, do início ao fim do extrato. Não agrupe, não resuma, não pule nenhum.`,
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

    const contentParts: any[] = [];
    let textoExtraido = "";

    for (const file of arquivosBase64 || []) {
      if (file.mimeType === "application/pdf") {
        if (ANTHROPIC_API_KEY) {
          console.log("Extraindo cobranças do PDF:", file.name);
          const texto = await extrairTextoPdf(file.base64, ANTHROPIC_API_KEY);
          if (texto) {
            textoExtraido += `\n\n=== COBRANÇAS IDENTIFICADAS NO PDF: ${file.name} ===\n${texto}`;
            console.log("Extração concluída, tamanho:", texto.length, "chars");
          }
        } else {
          contentParts.push({
            type: "image_url",
            image_url: { url: `data:application/pdf;base64,${file.base64}` },
          });
        }
      } else {
        contentParts.push({
          type: "image_url",
          image_url: { url: `data:${file.mimeType};base64,${file.base64}` },
        });
      }
    }

    const tiposTexto = (tiposCobranças || []).join(", ");

    const systemPrompt = `Você é um especialista em direito bancário do consumidor brasileiro. Analise os lançamentos fornecidos e identifique cobranças indevidas. Responda APENAS em JSON válido, sem markdown, sem texto fora do JSON.`;

    const userPrompt = `Analise as cobranças extraídas do extrato bancário do banco ${banco || "não informado"}, período ${dataInicial || "não informado"} a ${dataFinal || "não informado"}.

Cliente: ${nomeCliente || "não informado"}
CPF: ${cpf || "não informado"}
Contrato: ${numeroContrato || "não informado"}

${textoExtraido}

REGRAS SOBRE O QUE É INDEVIDO:
- IOF = imposto legal, NUNCA inclua
- ENCARGOS LIMITE DE CRED = juros cheque especial = legal, NUNCA inclua
- TARIFA BANCARIA / CESTA CELULAR / CESTA CLASSIC = indevida sem contrato expresso, INCLUA
- BRADESCO VIDA PREV / SEGURO VIDA = indevido sem contrato de seguro, INCLUA
- TAC e TEC = vedadas desde 2008, INCLUA
- Capitalização, clube de benefícios sem autorização = INCLUA

REGRA CRÍTICA — AGRUPAMENTO POR VALOR:
- Se a mesma cobrança teve valores DIFERENTES em períodos distintos, crie um item SEPARADO para cada valor
- Exemplo correto para CESTA CELULAR que variou:
  Item 1: valor_unitario 32.00, quantidade_ocorrencias 5, valor_total 160.00 (jan a mai)
  Item 2: valor_unitario 24.00, quantidade_ocorrencias 6, valor_total 144.00 (jun a nov)
  Item 3: valor_unitario 26.90, quantidade_ocorrencias 1, valor_total 26.90 (dez)
- Exemplo correto para SEGURO que variou:
  Item 1: valor_unitario 13.90, quantidade_ocorrencias 1, valor_total 13.90 (jan)
  Item 2: valor_unitario 14.84, quantidade_ocorrencias 10, valor_total 148.40 (fev a dez)
- NUNCA some valores diferentes no mesmo item

REGRA CRÍTICA — CONTAGEM COMPLETA:
- Conte TODAS as ocorrências de cada valor no período inteiro
- Verifique mês a mês do início ao fim do extrato
- quantidade_ocorrencias deve ser o número exato de vezes que aquele valor apareceu
- valor_total = valor_unitario × quantidade_ocorrencias
- valor_total_indevido no resumo = soma de TODOS os valor_total
- estimativa_recuperacao = igual ao valor_total_indevido
- NUNCA deixe valores monetários como 0 se a cobrança foi identificada

Responda EXATAMENTE neste JSON com valores reais:
{
  "resumo": {
    "total_lancamentos": 0,
    "irregularidades_encontradas": 0,
    "valor_total_indevido": 0.00,
    "periodo_analisado": "${dataInicial} a ${dataFinal}",
    "banco": "${banco}"
  },
  "cobrancas_indevidas": [
    {
      "data": "data da primeira ocorrência deste valor específico",
      "descricao": "descrição exata como aparece no extrato",
      "valor_unitario": 0.00,
      "quantidade_ocorrencias": 0,
      "valor_total": 0.00,
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
      "total": 0.00,
      "ocorrencias": 0
    }
  ],
  "recomendacao": {
    "tipo_acao": "",
    "fundamentacao": "",
    "estimativa_recuperacao": 0.00,
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

    console.log("Chamando gateway. Texto extraído:", textoExtraido.length, "chars");

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
    console.log("Resposta gateway:", responseText.substring(0, 800));

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
      console.error("Falha ao parsear JSON:", content.substring(0, 500));
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
          fundamentacao: `Erro ao processar: ${content.substring(0, 300)}`,
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
    console.error("Erro geral:", e.message);
    return new Response(JSON.stringify({ error: e.message || "Erro desconhecido" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
