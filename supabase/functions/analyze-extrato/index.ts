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
              text: `Você é um assistente de análise bancária. Leia TODAS as páginas deste extrato bancário, da primeira à última, sem pular nenhuma.

TAREFA: Liste TODOS os lançamentos que se enquadram nestas categorias, verificando CADA PÁGINA individualmente:

CATEGORIAS A BUSCAR:
1. TARIFA BANCARIA (CESTA CELULAR, CESTA CLASSIC, CESTA PREMIUM, manutenção de conta)
2. SEGURO (VIDA, PRESTAMISTA, BRADESCO VIDA PREV, proteção financeira, acidentes)
3. CAPITALIZAÇÃO
4. CLUBE DE BENEFICIOS
5. TAC - Tarifa de Abertura de Crédito
6. TEC - Taxa de Emissão de Carnê
7. Qualquer serviço com cobrança mensal repetida

INSTRUÇÕES CRÍTICAS:
- Verifique CADA página do documento, incluindo páginas do meio (páginas 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18...)
- Para cada lançamento encontrado, informe: DATA | DESCRIÇÃO EXATA | VALOR DÉBITO
- Liste CADA ocorrência individualmente, mesmo que seja a mesma cobrança em meses diferentes
- NÃO agrupe, NÃO resuma, NÃO pule nenhuma ocorrência
- Se encontrar TARIFA BANCARIA em abril, maio, julho ou agosto, INCLUA
- Se encontrar SEGURO em qualquer mês, INCLUA
- Percorra o documento mês a mês garantindo cobertura total

Formato de saída para cada lançamento:
DATA | DESCRIÇÃO | VALOR

Liste todos sem exceção.`,
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
      console.error("ANTHROPIC_API_KEY não configurada — usando fallback");
    }

    const contentParts: any[] = [];
    let textoExtraido = "";

    for (const file of arquivosBase64 || []) {
      if (file.mimeType === "application/pdf") {
        if (ANTHROPIC_API_KEY) {
          console.log("Extraindo cobranças do PDF:", file.name);
          const texto = await extrairTextoPdf(file.base64, ANTHROPIC_API_KEY);
          if (texto) {
            textoExtraido += `\n\n=== COBRANÇAS EXTRAÍDAS DO PDF: ${file.name} ===\n${texto}`;
            console.log("Extração concluída. Tamanho:", texto.length, "chars");
            console.log("Primeiros 1000 chars:", texto.substring(0, 1000));
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

    const systemPrompt = `Você é um especialista em direito bancário do consumidor brasileiro. Analise os lançamentos fornecidos e identifique cobranças indevidas com precisão. Responda APENAS em JSON válido, sem markdown, sem texto fora do JSON.`;

    const userPrompt = `Analise as cobranças extraídas do extrato bancário do banco ${banco || "não informado"}, período ${dataInicial || "não informado"} a ${dataFinal || "não informado"}.

Cliente: ${nomeCliente || "não informado"}
CPF: ${cpf || "não informado"}
Contrato: ${numeroContrato || "não informado"}

${textoExtraido || "Sem texto extraído — analise os arquivos anexados."}

REGRAS SOBRE O QUE É INDEVIDO:
- IOF = imposto legal, NUNCA inclua
- ENCARGOS LIMITE DE CRED = juros cheque especial = legal, NUNCA inclua
- TARIFA BANCARIA / CESTA CELULAR / CESTA CLASSIC = indevida sem contrato expresso assinado, SEMPRE inclua
- BRADESCO VIDA PREV / SEGURO VIDA / SEGURO PRESTAMISTA = indevido sem contrato de seguro, SEMPRE inclua
- TAC e TEC = vedadas desde 2008 pela Resolução BACEN 3.518/2007, SEMPRE inclua
- Capitalização, clube de benefícios sem autorização = SEMPRE inclua

REGRA CRÍTICA — NUNCA AGRUPE VALORES DIFERENTES:
- Se CESTA CELULAR foi cobrada R$ 32,00 em jan/fev/mar/abr/mai e depois mudou para R$ 24,00 em jun/jul/ago/set/out/nov = crie 2 itens separados
- Se CESTA mudou de valor novamente em dez para R$ 26,90 = crie mais 1 item separado
- Se SEGURO foi cobrado R$ 13,90 em jan e depois R$ 14,84 nos demais meses = crie 2 itens separados
- NUNCA some valores diferentes no mesmo item

REGRA CRÍTICA — CONTAGEM COMPLETA MÊS A MÊS:
- Conte TODAS as ocorrências de cada valor, verificando os 12 meses
- Janeiro, Fevereiro, Março, Abril, Maio, Junho, Julho, Agosto, Setembro, Outubro, Novembro, Dezembro
- quantidade_ocorrencias = número exato de vezes que aquele valor apareceu
- valor_total = valor_unitario × quantidade_ocorrencias
- valor_total_indevido = soma de TODOS os valor_total
- estimativa_recuperacao = igual ao valor_total_indevido
- NUNCA deixe valores como 0 se a cobrança foi identificada

Responda EXATAMENTE neste JSON:
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
      "data": "data da primeira ocorrência deste valor",
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
