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
              text: "Extraia TODO o texto deste extrato bancário exatamente como aparece. Para cada lançamento transcreva: data, descrição completa, valor de débito, valor de crédito e saldo. Mantenha TODOS os lançamentos sem exceção, do primeiro ao último. Não resuma, não interprete, apenas transcreva linha por linha.",
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
    if (!ANTHROPIC_API_KEY) {
      console.error("ANTHROPIC_API_KEY não configurada");
    }

    const contentParts: any[] = [];
    let textoExtraido = "";

    for (const file of arquivosBase64 || []) {
      if (file.mimeType === "application/pdf") {
        if (ANTHROPIC_API_KEY) {
          console.log("Extraindo texto do PDF:", file.name);
          const texto = await extrairTextoPdf(file.base64, ANTHROPIC_API_KEY);
          if (texto) {
            textoExtraido += `\n\n=== CONTEÚDO DO PDF: ${file.name} ===\n${texto}`;
            console.log("Texto extraído com sucesso, tamanho:", texto.length, "chars");
          } else {
            console.error("Extração retornou vazio para:", file.name);
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

    const systemPrompt = `Você é um especialista em direito bancário do consumidor brasileiro com 20 anos de experiência. Analise extratos bancários e identifique cobranças indevidas com precisão cirúrgica. Responda APENAS em JSON válido, sem markdown, sem texto fora do JSON. NUNCA deixe valores monetários como 0 se a cobrança foi identificada no extrato.`;

    const userPrompt = `Analise os extratos bancários do banco ${banco || "não informado"} no período de ${dataInicial || "não informado"} a ${dataFinal || "não informado"}.

Cliente: ${nomeCliente || "não informado"}
CPF: ${cpf || "não informado"}
Contrato: ${numeroContrato || "não informado"}

${textoExtraido ? `CONTEÚDO COMPLETO DOS EXTRATOS:\n${textoExtraido}` : ""}

TIPOS DE COBRANÇA PARA VERIFICAR: ${tiposTexto}

REGRAS OBRIGATÓRIAS SOBRE VALORES:
- NUNCA coloque valor_unitario, valor_total, total ou estimativa_recuperacao como 0 se a cobrança foi identificada
- valor_unitario = valor de UMA única ocorrência (extraia do extrato)
- quantidade_ocorrencias = total de vezes que aparece no período
- valor_total = valor_unitario × quantidade_ocorrencias (calcule e preencha)
- estimativa_recuperacao = soma de todos os valor_total das cobranças indevidas

REGRAS SOBRE O QUE É INDEVIDO:
- IOF é imposto legal — NUNCA classifique como indevido
- ENCARGOS LIMITE DE CRED (cheque especial) — legal, NÃO inclua
- TARIFA BANCÁRIA / CESTA CELULAR / CESTA CLASSIC — indevida se cobrada mensalmente sem contrato expresso assinado
- BRADESCO VIDA PREV / SEGURO VIDA — indevido se cobrado mensalmente sem contrato de seguro apresentado
- TAC e TEC — vedadas desde 2008 pela Resolução BACEN 3.518/2007
- Serviços não solicitados (capitalização, clube de benefícios) — indevidos

PROCESSO DE ANÁLISE:
1. Leia TODOS os lançamentos do extrato
2. Identifique cada TARIFA BANCÁRIA e some os valores de todas as ocorrências no ano
3. Identifique cada SEGURO cobrado e some os valores de todas as ocorrências no ano  
4. Identifique outros serviços não solicitados
5. Preencha valor_unitario com o valor real do extrato
6. Preencha quantidade_ocorrencias com o número real de cobranças encontradas
7. Calcule valor_total = valor_unitario × quantidade_ocorrencias

Responda EXATAMENTE neste JSON com valores REAIS do extrato:
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
      "data": "data da primeira ocorrência",
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

    console.log("Chamando gateway. Texto extraído:", textoExtraido.length, "chars. ContentParts:", contentParts.length);

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
    console.log("Resposta gateway (primeiros 800 chars):", responseText.substring(0, 800));

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
      if (!jsonMatch) throw new Error("Nenhum JSON encontrado na resposta");
      parsed = JSON.parse(jsonMatch[0]);
    } catch {
      console.error("Falha ao parsear JSON. Conteúdo completo:", content);
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
    console.error("Erro geral analyze-extrato:", e.message);
    return new Response(JSON.stringify({ error: e.message || "Erro desconhecido" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
