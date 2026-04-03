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
              source: { type: "base64", media_type: "application/pdf", data: base64 },
            },
            {
              type: "text",
              text: `Leia TODAS as páginas deste extrato bancário sem pular nenhuma.

Liste APENAS os lançamentos destas categorias, um por linha, exatamente neste formato:
DATA|DESCRIÇÃO|VALOR

Categorias a buscar:
- TARIFA BANCARIA (CESTA CELULAR, CESTA CLASSIC, manutenção)
- SEGURO (VIDA, PRESTAMISTA, BRADESCO VIDA PREV)
- CAPITALIZAÇÃO
- TAC ou TEC
- CLUBE DE BENEFICIOS

REGRAS:
- Uma linha por lançamento
- Não agrupe, não resuma
- Inclua TODOS os meses: janeiro fevereiro março abril maio junho julho agosto setembro outubro novembro dezembro
- Formato exato: 06/01/2017|TARIFA BANCARIA CESTA CELULAR|32.00
- Use ponto como separador decimal
- Não inclua IOF, não inclua ENCARGOS LIMITE DE CRED

Liste tudo:`,
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

// Agrupa lançamentos por descrição+valor no próprio código
function agruparLancamentos(texto: string) {
  const linhas = texto.split("\n").filter((l) => l.includes("|"));
  const lancamentos: Array<{ data: string; descricao: string; valor: number }> = [];

  for (const linha of linhas) {
    const partes = linha.trim().split("|");
    if (partes.length < 3) continue;
    const data = partes[0].trim();
    const descricao = partes[1].trim();
    const valorStr = partes[2].trim().replace(",", ".");
    const valor = parseFloat(valorStr);
    if (isNaN(valor) || valor <= 0) continue;
    lancamentos.push({ data, descricao, valor });
  }

  // Agrupa por descrição + valor (chave única)
  const grupos = new Map<
    string,
    {
      data: string;
      descricao: string;
      valor: number;
      ocorrencias: number;
      datas: string[];
    }
  >();

  for (const l of lancamentos) {
    // Normaliza descrição para agrupar variações
    const descNorm = l.descricao.toUpperCase().replace(/\s+/g, " ").trim();
    const chave = `${descNorm}||${l.valor.toFixed(2)}`;

    if (grupos.has(chave)) {
      const g = grupos.get(chave)!;
      g.ocorrencias++;
      g.datas.push(l.data);
    } else {
      grupos.set(chave, {
        data: l.data,
        descricao: l.descricao,
        valor: l.valor,
        ocorrencias: 1,
        datas: [l.data],
      });
    }
  }

  return Array.from(grupos.values());
}

// Classifica categoria e base legal
function classificar(descricao: string): { categoria: string; baseLegal: string; justificativa: string } {
  const d = descricao.toUpperCase();

  if (d.includes("CESTA") || d.includes("TARIFA BANCARIA") || d.includes("MANUTENCAO") || d.includes("MANUTENÇÃO")) {
    return {
      categoria: "Tarifas Bancárias",
      baseLegal: "Resolução CMN nº 3.919/2010 — tarifas só são permitidas mediante contratação expressa",
      justificativa: "Tarifa bancária cobrada mensalmente sem evidência de contratação expressa pelo cliente",
    };
  }
  if (d.includes("SEGURO") || d.includes("VIDA PREV") || d.includes("BRADESCO VIDA") || d.includes("PRESTAMISTA")) {
    return {
      categoria: "Seguros",
      baseLegal: "CDC Art. 39, III e IV — venda casada proibida; seguro não pode ser imposto sem contrato expresso",
      justificativa: "Seguro cobrado mensalmente sem contrato de seguro apresentado ou autorização expressa do cliente",
    };
  }
  if (d.includes("CAPITALIZ")) {
    return {
      categoria: "Capitalização",
      baseLegal: "CDC Art. 39, III — venda casada proibida",
      justificativa: "Título de capitalização contratado sem autorização expressa",
    };
  }
  if (d.includes("TAC") || d.includes("ABERTURA DE CREDITO")) {
    return {
      categoria: "TAC — Vedada",
      baseLegal: "Resolução BACEN 3.518/2007 — TAC vedada desde 2008",
      justificativa: "Tarifa de Abertura de Crédito proibida pela regulação do Banco Central",
    };
  }
  if (d.includes("TEC") || d.includes("EMISSAO DE CARNE")) {
    return {
      categoria: "TEC — Vedada",
      baseLegal: "Resolução BACEN 3.518/2007 — TEC vedada desde 2008",
      justificativa: "Taxa de Emissão de Carnê proibida pela regulação do Banco Central",
    };
  }
  if (d.includes("CLUBE") || d.includes("BENEFICIO")) {
    return {
      categoria: "Serviços Não Solicitados",
      baseLegal: "CDC Art. 39, III — venda casada proibida",
      justificativa: "Serviço contratado sem autorização expressa do cliente",
    };
  }

  return {
    categoria: "Outros",
    baseLegal: "CDC Art. 39 — prática abusiva",
    justificativa: "Cobrança sem evidência de contratação expressa",
  };
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

    let textoExtraido = "";
    const contentParts: any[] = [];

    for (const file of arquivosBase64 || []) {
      if (file.mimeType === "application/pdf") {
        if (ANTHROPIC_API_KEY) {
          console.log("Extraindo PDF:", file.name);
          const texto = await extrairTextoPdf(file.base64, ANTHROPIC_API_KEY);
          if (texto) {
            textoExtraido += texto;
            console.log("Extraído:", texto.length, "chars");
            console.log("Amostra:", texto.substring(0, 600));
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

    // Se temos texto extraído, processamos no código sem depender do Gemini para agrupar
    if (textoExtraido) {
      console.log("Processando agrupamento no código...");
      const grupos = agruparLancamentos(textoExtraido);
      console.log("Grupos encontrados:", grupos.length);

      if (grupos.length > 0) {
        const cobrancas_indevidas = grupos.map((g) => {
          const { categoria, baseLegal, justificativa } = classificar(g.descricao);
          return {
            data: g.data,
            descricao: g.descricao,
            valor_unitario: g.valor,
            quantidade_ocorrencias: g.ocorrencias,
            valor_total: parseFloat((g.valor * g.ocorrencias).toFixed(2)),
            categoria,
            status: "confirmado",
            base_legal: baseLegal,
            justificativa,
            recorrente: g.ocorrencias > 1,
          };
        });

        const valor_total_indevido = parseFloat(cobrancas_indevidas.reduce((s, c) => s + c.valor_total, 0).toFixed(2));

        // Agrupa por categoria
        const catMap = new Map<string, { total: number; ocorrencias: number }>();
        cobrancas_indevidas.forEach((c) => {
          const existing = catMap.get(c.categoria) || { total: 0, ocorrencias: 0 };
          catMap.set(c.categoria, {
            total: parseFloat((existing.total + c.valor_total).toFixed(2)),
            ocorrencias: existing.ocorrencias + c.quantidade_ocorrencias,
          });
        });

        const por_categoria = Array.from(catMap.entries()).map(([categoria, v]) => ({
          categoria,
          total: v.total,
          ocorrencias: v.ocorrencias,
        }));

        const resultado = {
          resumo: {
            total_lancamentos: cobrancas_indevidas.reduce((s, c) => s + c.quantidade_ocorrencias, 0),
            irregularidades_encontradas: cobrancas_indevidas.length,
            valor_total_indevido,
            periodo_analisado: `${dataInicial} a ${dataFinal}`,
            banco: banco || "",
          },
          cobrancas_indevidas,
          por_categoria,
          recomendacao: {
            tipo_acao: "Requerimento administrativo e/ou Ação Judicial de repetição de indébito",
            fundamentacao: `Foram identificadas cobranças indevidas no extrato bancário do ${banco}, totalizando ${valor_total_indevido.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}. As cobranças incluem tarifas bancárias cobradas sem contratação expressa (Resolução CMN nº 3.919/2010) e seguros cobrados sem autorização (CDC Art. 39, III). O consumidor tem direito à devolução em dobro dos valores cobrados indevidamente, conforme Art. 42, parágrafo único do CDC. Recomenda-se o envio de notificação extrajudicial ao banco e, se não houver resposta, o ajuizamento de ação judicial.`,
            estimativa_recuperacao: parseFloat((valor_total_indevido * 2).toFixed(2)),
            prazo_prescricional:
              "5 anos para tarifas (Art. 27 do CDC) e 10 anos para seguros (Art. 205 do Código Civil)",
            prioridade: valor_total_indevido > 300 ? "alta" : "media",
          },
        };

        console.log("Resultado processado no código:", JSON.stringify(resultado.resumo));

        return new Response(JSON.stringify(resultado), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    // Fallback para Gemini se não tiver texto extraído ou extração falhou
    console.log("Usando Gemini como fallback...");

    const tiposTexto = (tiposCobranças || []).join(", ");

    const systemPrompt = `Você é um especialista em direito bancário do consumidor brasileiro. Analise os lançamentos e identifique cobranças indevidas. Responda APENAS em JSON válido, sem markdown.`;

    const userPrompt = `Analise o extrato do banco ${banco || "não informado"}, período ${dataInicial} a ${dataFinal}.
Cliente: ${nomeCliente || "não informado"}
${textoExtraido ? `LANÇAMENTOS:\n${textoExtraido}` : ""}
TIPOS: ${tiposTexto}

Identifique TARIFAS BANCÁRIAS e SEGUROS indevidos.
Para cada item: valor_unitario e valor_total nunca podem ser 0.
Itens com valores diferentes devem ser separados.

Responda em JSON:
{
  "resumo": {"total_lancamentos":0,"irregularidades_encontradas":0,"valor_total_indevido":0,"periodo_analisado":"","banco":""},
  "cobrancas_indevidas": [{"data":"","descricao":"","valor_unitario":0,"quantidade_ocorrencias":0,"valor_total":0,"categoria":"","status":"confirmado","base_legal":"","justificativa":"","recorrente":true}],
  "por_categoria": [{"categoria":"","total":0,"ocorrencias":0}],
  "recomendacao": {"tipo_acao":"","fundamentacao":"","estimativa_recuperacao":0,"prazo_prescricional":"","prioridade":"alta"}
}`;

    const messages: any[] = [
      { role: "system", content: systemPrompt },
      { role: "user", content: [{ type: "text", text: userPrompt }, ...contentParts] },
    ];

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

    if (!response.ok) {
      return new Response(
        JSON.stringify({
          error: `Gateway retornou status ${response.status}: ${responseText.substring(0, 200)}`,
        }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
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
          fundamentacao: `Erro: ${content.substring(0, 300)}`,
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
